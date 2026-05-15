/**
 * Bulk hardening engine for MCP configs.
 *
 * Selects findings by severity mode, generates deterministic safe-default
 * remediation plans and patches for each, merges all operations (deduplicating
 * and conflict-resolving), applies them to a deep clone of the original config,
 * and re-runs the MCP scanner to produce a before/after comparison.
 *
 * No LLM calls. No external APIs. No mutation of input data.
 */

import { applyJsonPatch } from "@/lib/governance/json-patch";
import { analyzeMcp } from "@/lib/scan/adapters/mcp";
import { riskScoreFromFindings, decisionFrom } from "@/lib/scan-engine";
import type { ScanFinding } from "@/lib/scan-engine";
import type { JsonPatchOp } from "@/lib/governance/types";
import type { RemediationPlan } from "./types";
import type { GeneratedPatch, JsonPatchOperation, PatchPreviewResult } from "./patch-types";
import {
  type BulkHardeningMode,
  type BulkHardeningRequest,
  type BulkHardeningResult,
  type BulkOperationGroup,
  type OperationLabel,
  type SkippedFinding,
} from "./bulk-types";
import { FIXABLE_MCP_RULES, generateSafeDefaultPlan } from "./safe-defaults";
import { generatePatch } from "./patch-generator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function findingKey(f: ScanFinding): string {
  return `${f.rule_id}::${f.target}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function toGovOp(o: JsonPatchOperation): JsonPatchOp {
  if (o.op === "remove") return { op: "remove", path: o.path };
  if (o.op === "add") return { op: "add", path: o.path, value: o.value };
  return { op: "replace", path: o.path, value: o.value };
}

// ─── Finding selection ────────────────────────────────────────────────────────

/**
 * Select findings to harden based on mode.
 * Returns selected findings (will be processed) and skipped findings (with reasons).
 */
export function selectFindings(
  findings: ScanFinding[],
  mode: BulkHardeningMode
): { selected: ScanFinding[]; skipped: SkippedFinding[] } {
  const selected: ScanFinding[] = [];
  const skipped: SkippedFinding[] = [];

  for (const f of findings) {
    const key = findingKey(f);

    if (!FIXABLE_MCP_RULES.has(f.rule_id)) {
      skipped.push({
        findingId: key,
        ruleId: f.rule_id,
        target: f.target,
        reason: "No automated patch template available for this rule.",
      });
      continue;
    }

    const sevOk =
      mode === "all_fixable" ||
      (mode === "critical_only" && f.severity === "critical") ||
      (mode === "critical_and_high" &&
        (f.severity === "critical" || f.severity === "high"));

    if (!sevOk) {
      skipped.push({
        findingId: key,
        ruleId: f.rule_id,
        target: f.target,
        reason: `Severity "${f.severity}" is not included in "${mode}" mode.`,
      });
      continue;
    }

    selected.push(f);
  }

  return { selected, skipped };
}

// ─── Operation deduplication + conflict resolution ────────────────────────────

type MergeResult = {
  operations: JsonPatchOperation[];
  warnings: string[];
};

type PatchLike = Pick<GeneratedPatch, "operations" | "canPreview" | "warnings">;

/**
 * Merge multiple lists of patch operations into one deduplicated, conflict-free list.
 *
 * Rules:
 * - Same path + same op + same value → keep first, drop duplicate (silent).
 * - Same path + different value → conflict:
 *   - boolean: choose true (more restrictive).
 *   - array: union both lists.
 *   - other: keep first, emit warning.
 */
export function mergeOperations(patches: PatchLike[]): MergeResult {
  const seen = new Map<string, JsonPatchOperation>();
  const warnings: string[] = [];
  const result: JsonPatchOperation[] = [];

  for (const patch of patches) {
    for (const opRaw of patch.operations) {
      const existing = seen.get(opRaw.path);

      if (!existing) {
        seen.set(opRaw.path, opRaw);
        result.push(opRaw);
        continue;
      }

      // Same path already seen — check for conflict
      const existingVal = existing.value;
      const newVal = opRaw.value;

      const isSame = JSON.stringify(existingVal) === JSON.stringify(newVal);
      if (isSame) {
        // Exact duplicate — silently skip
        continue;
      }

      // Conflict — resolve by choosing the safest value
      if (typeof existingVal === "boolean" && typeof newVal === "boolean") {
        // Most restrictive: true wins (requiresConfirmation, readOnly, etc.)
        if (newVal === true && existingVal !== true) {
          existing.value = true;
          warnings.push(
            `Conflict at "${opRaw.path}": chose true (more restrictive) over false.`
          );
        }
        // else keep existing (already true or same) — no warning needed
      } else if (Array.isArray(existingVal) && Array.isArray(newVal)) {
        // Union arrays (e.g. blockedCommands from two rules)
        const union = [...new Set([...existingVal as unknown[], ...newVal as unknown[]])];
        existing.value = union;
        warnings.push(
          `Conflict at "${opRaw.path}": merged arrays from two rules into union (${union.length} items).`
        );
      } else {
        // Keep first, warn
        warnings.push(
          `Conflict at "${opRaw.path}": kept value from ${existing.ruleId}, ignored value from ${opRaw.ruleId}. Manual review required.`
        );
      }
    }
  }

  return { operations: result, warnings };
}

// ─── Operation grouping ───────────────────────────────────────────────────────

function labelForPatch(patch: GeneratedPatch, plan: RemediationPlan): OperationLabel {
  if (!patch.canPreview || patch.operations.length === 0) {
    return "cannot be safely auto-fixed";
  }
  if (plan.needsHumanReview) {
    return "needs manual refinement";
  }
  return "auto-applied safe default";
}

function buildOperationGroups(
  patches: GeneratedPatch[],
  plans: RemediationPlan[]
): BulkOperationGroup[] {
  return patches.map((patch, i) => {
    const plan = plans[i];
    return {
      toolOrTarget: patch.target,
      ruleId: patch.ruleId,
      operations: patch.operations,
      label: labelForPatch(patch, plan),
      warnings: patch.warnings,
    };
  });
}

// ─── Apply combined patch in memory ──────────────────────────────────────────

function applyOperations(
  originalConfig: unknown,
  operations: JsonPatchOperation[]
): { applied: unknown; applyWarnings: string[] } {
  const applyWarnings: string[] = [];

  if (!isRecord(originalConfig)) {
    applyWarnings.push("Config is not an object — cannot apply patches.");
    return { applied: originalConfig, applyWarnings };
  }

  if (operations.length === 0) {
    return { applied: originalConfig, applyWarnings };
  }

  try {
    const govOps = operations.map(toGovOp);
    const applied = applyJsonPatch(originalConfig as Record<string, unknown>, govOps);
    return { applied, applyWarnings };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    applyWarnings.push(`Patch application error: ${msg}. Hardened config may be incomplete.`);
    return { applied: originalConfig, applyWarnings };
  }
}

// ─── Re-scan hardenedconfig ───────────────────────────────────────────────────

function buildPreviewResult(
  originalConfig: unknown,
  hardenedConfig: unknown,
  applyWarnings: string[]
): PatchPreviewResult {
  const beforeFindings = analyzeMcp(originalConfig);
  const beforeScore = riskScoreFromFindings(beforeFindings);
  const beforeDecision = decisionFrom(beforeFindings);
  const beforeKeys = new Set(beforeFindings.map(findingKey));

  const afterFindings = analyzeMcp(hardenedConfig);
  const afterScore = riskScoreFromFindings(afterFindings);
  const afterDecision = decisionFrom(afterFindings);
  const afterKeys = new Set(afterFindings.map(findingKey));

  const resolvedFindingIds = [...beforeKeys].filter((k) => !afterKeys.has(k));
  const newFindings = afterFindings.filter((f) => !beforeKeys.has(findingKey(f)));
  const remainingFindings = afterFindings.filter((f) => beforeKeys.has(findingKey(f)));

  const warnings = [...applyWarnings];
  if (newFindings.length > 0) {
    warnings.push(
      `${newFindings.length} new finding(s) appeared after hardening — review the applied patches carefully.`
    );
  }

  return {
    beforeScore,
    afterScore,
    beforeDecision,
    afterDecision,
    resolvedFindingIds,
    remainingFindings,
    newFindings,
    appliedConfig: hardenedConfig,
    warnings,
  };
}

// ─── Public orchestrator ──────────────────────────────────────────────────────

/**
 * Run the full bulk hardening pipeline:
 * 1. Select findings by mode
 * 2. Generate safe-default remediation plans
 * 3. Generate JSON patch operations per plan
 * 4. Merge operations (deduplicate + resolve conflicts)
 * 5. Apply combined patch in memory
 * 6. Re-run scanner on hardened config
 * 7. Return full BulkHardeningResult
 */
export function runBulkHardening(request: BulkHardeningRequest): BulkHardeningResult {
  const { originalConfig, findings, mode } = request;

  // Step 1: Select findings
  const { selected, skipped } = selectFindings(findings, mode);

  // Step 2: Generate safe-default plans
  const plans: RemediationPlan[] = selected.map((f) => generateSafeDefaultPlan(f));

  // Step 3: Generate patches
  const patches: GeneratedPatch[] = plans.map((plan) =>
    generatePatch(plan, originalConfig)
  );

  // Step 4: Merge operations
  const applicablePatches = patches.filter((p) => p.canPreview && p.operations.length > 0);
  const { operations: combinedOperations, warnings: mergeWarnings } =
    mergeOperations(applicablePatches);

  // Step 5: Apply combined patch
  const { applied: hardenedConfig, applyWarnings } = applyOperations(
    originalConfig,
    combinedOperations
  );

  // Step 6: Re-scan
  const previewResult = buildPreviewResult(originalConfig, hardenedConfig, applyWarnings);

  // Step 7: Collect warnings + manual review items
  const patchWarnings = patches.flatMap((p) => p.warnings);
  const allWarnings = [...mergeWarnings, ...patchWarnings, ...previewResult.warnings];

  const manualReviewRequired: string[] = [];
  for (const plan of plans) {
    if (plan.needsHumanReview) {
      manualReviewRequired.push(
        `${plan.ruleId} on ${plan.target}: ${plan.summary}`
      );
    }
  }
  // Add skipped findings that need attention
  for (const s of skipped) {
    if (!FIXABLE_MCP_RULES.has(s.ruleId)) {
      manualReviewRequired.push(`${s.ruleId} on ${s.target}: ${s.reason}`);
    }
  }

  const groups = buildOperationGroups(patches, plans);

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    mode,
    selectedFindings: selected,
    skippedFindings: skipped,
    generatedPlans: plans,
    generatedPatches: patches,
    combinedOperations,
    operationGroups: groups,
    hardenedConfig,
    previewResult,
    warnings: [...new Set(allWarnings)],
    manualReviewRequired,
  };
}

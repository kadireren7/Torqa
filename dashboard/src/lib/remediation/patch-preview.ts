/**
 * In-memory patch preview for MCP configs.
 *
 * Applies a GeneratedPatch onto a deep clone of the original config,
 * re-runs the MCP scanner, and produces a before/after comparison.
 * Nothing is mutated — safe to call repeatedly.
 */

import { applyJsonPatch } from "@/lib/governance/json-patch";
import { analyzeMcp } from "@/lib/scan/adapters/mcp";
import { riskScoreFromFindings, decisionFrom } from "@/lib/scan-engine";
import type { ScanFinding } from "@/lib/scan-engine";
import type { JsonPatchOp } from "@/lib/governance/types";
import type { GeneratedPatch, JsonPatchOperation, PatchPreviewResult } from "./patch-types";

function findingKey(f: ScanFinding): string {
  return `${f.rule_id}::${f.target}`;
}

/** Convert our richer JsonPatchOperation to the governance JsonPatchOp discriminated union. */
function toGovOp(o: JsonPatchOperation): JsonPatchOp {
  if (o.op === "remove") return { op: "remove", path: o.path };
  if (o.op === "add") return { op: "add", path: o.path, value: o.value };
  return { op: "replace", path: o.path, value: o.value };
}

export function previewPatch(
  originalContent: unknown,
  patch: GeneratedPatch
): PatchPreviewResult {
  const warnings: string[] = [...patch.warnings];

  // Before state
  const beforeFindings = analyzeMcp(originalContent);
  const beforeScore = riskScoreFromFindings(beforeFindings);
  const beforeDecision = decisionFrom(beforeFindings);
  const beforeKeys = new Set(beforeFindings.map(findingKey));

  // Apply patch
  let appliedConfig: unknown = originalContent;
  if (patch.operations.length > 0) {
    if (typeof originalContent !== "object" || originalContent === null) {
      warnings.push("Config is not an object — patch cannot be applied.");
      return {
        beforeScore,
        afterScore: beforeScore,
        beforeDecision,
        afterDecision: beforeDecision,
        resolvedFindingIds: [],
        remainingFindings: beforeFindings,
        newFindings: [],
        appliedConfig: originalContent,
        warnings,
      };
    }

    try {
      const govOps = patch.operations.map(toGovOp);
      appliedConfig = applyJsonPatch(originalContent as Record<string, unknown>, govOps);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Patch application error: ${msg}. Preview may be incomplete.`);
      appliedConfig = originalContent;
    }
  }

  // After state
  const afterFindings = analyzeMcp(appliedConfig);
  const afterScore = riskScoreFromFindings(afterFindings);
  const afterDecision = decisionFrom(afterFindings);
  const afterKeys = new Set(afterFindings.map(findingKey));

  // Resolved: in before but not in after
  const resolvedFindingIds = [...beforeKeys].filter((k) => !afterKeys.has(k));

  // New findings introduced by patch (should be 0 normally)
  const newFindings = afterFindings.filter((f) => !beforeKeys.has(findingKey(f)));

  // Remaining: in after and also in before (still present)
  const remainingFindings = afterFindings.filter((f) => beforeKeys.has(findingKey(f)));

  if (afterScore <= beforeScore && resolvedFindingIds.length === 0) {
    warnings.push(
      "This patch does not resolve the targeted finding. Manual review and a more specific fix are required."
    );
  }

  if (newFindings.length > 0) {
    warnings.push(
      `${newFindings.length} new finding(s) appeared after patch — verify the applied changes carefully.`
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
    appliedConfig,
    warnings,
  };
}

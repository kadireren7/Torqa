/**
 * POST /api/fixes/apply
 *
 * Body shape:
 *   {
 *     scanId?: uuid,                       // optional scan_history row this fix relates to
 *     finding: {                           // identification of the finding being fixed
 *       signature: string,                 // sha256 hex
 *       rule_id: string,
 *       source: string,
 *       target: string,
 *       severity: ScanSeverity,
 *     },
 *     fix: {
 *       type: 'safe_auto' | 'structural' | 'manual_required',
 *       patch: JsonPatchOp[],              // RFC6902-lite ops
 *       explanation?: string,
 *     },
 *     content: object,                     // workflow JSON to patch (we never persist the raw bytes)
 *     mode_override?: GovernanceMode,      // interactive flow can carry rationale
 *     rationale?: string,
 *   }
 *
 * Behavior — depends on the active governance mode:
 *   - autonomous + safe_auto:    apply patch immediately → applied_fixes + governance_decisions(apply_fix)
 *   - autonomous + structural:   queue (autonomous still asks for approval on non-safe fixes)
 *   - supervised:                always queue → pending_approvals + governance_decisions(apply_fix=queued)
 *   - interactive:               record rationale + queue (response is remembered for re-scans)
 *   - manual_required:           never auto; queue with status=pending and explicit reason
 *
 * Returns:
 *   { status: 'applied', appliedFix }   when patched immediately
 *   { status: 'queued',  pendingApproval } when waiting for human decision
 */

import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import { applyJsonPatch } from "@/lib/governance/json-patch";
import {
  isFixType,
  type FixType,
  type GovernanceMode,
  type JsonPatchOp,
} from "@/lib/governance/types";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit, SCAN_JSON_BODY_MAX_BYTES } from "@/lib/request-body";
import type { ScanSeverity } from "@/lib/scan-engine";
import { dispatchGovernanceDecisionSignal } from "@/lib/governance-signals";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

export const runtime = "nodejs";

const VALID_SEVERITY: ScanSeverity[] = ["info", "review", "high", "critical"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJsonPatchOp(value: unknown): value is JsonPatchOp {
  if (!isPlainObject(value)) return false;
  if (typeof value.path !== "string" || !value.path.startsWith("/")) return false;
  if (value.op === "add" || value.op === "replace") return "value" in value;
  if (value.op === "remove") return true;
  return false;
}

type DecisionShape =
  | { kind: "apply"; type: FixType }
  | { kind: "queue"; type: FixType; reason: string };

function decideOutcome(mode: GovernanceMode, type: FixType): DecisionShape {
  if (type === "manual_required") {
    return { kind: "queue", type, reason: "manual remediation only" };
  }
  if (mode === "autonomous" && type === "safe_auto") {
    return { kind: "apply", type };
  }
  if (mode === "autonomous" && type === "structural") {
    return { kind: "queue", type, reason: "structural fixes require approval even in autonomous" };
  }
  if (mode === "interactive") {
    return { kind: "queue", type, reason: "interactive mode collects user response" };
  }
  return { kind: "queue", type, reason: "supervised mode queues all fixes" };
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required to apply fixes", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to apply or queue fixes", requestId);
  }

  const parsed = await readJsonBodyWithByteLimit(request, SCAN_JSON_BODY_MAX_BYTES);
  if (!parsed.ok) return jsonErrorResponse(parsed.status, parsed.message, requestId);
  const body = parsed.value;
  if (!isPlainObject(body)) {
    return jsonErrorResponse(400, "Request body must be a JSON object", requestId);
  }

  const finding = body.finding;
  const fix = body.fix;
  const content = body.content;
  if (!isPlainObject(finding) || !isPlainObject(fix) || !isPlainObject(content)) {
    return jsonErrorResponse(400, "Fields 'finding', 'fix', and 'content' must each be JSON objects", requestId);
  }

  const signature = typeof finding.signature === "string" ? finding.signature.trim() : "";
  const rule_id = typeof finding.rule_id === "string" ? finding.rule_id.trim() : "";
  const source = typeof finding.source === "string" ? finding.source.trim() : "";
  const target = typeof finding.target === "string" ? finding.target.trim() : "";
  const severityRaw = typeof finding.severity === "string" ? (finding.severity as ScanSeverity) : null;
  const severity: ScanSeverity = severityRaw && VALID_SEVERITY.includes(severityRaw) ? severityRaw : "review";
  const fixType = fix.type;
  if (!signature || !rule_id || !source || !target) {
    return jsonErrorResponse(400, "Fields 'finding.signature/rule_id/source/target' are required", requestId);
  }
  if (!isFixType(fixType)) {
    return jsonErrorResponse(400, "Field 'fix.type' must be safe_auto, structural, or manual_required", requestId);
  }
  const patchRaw = Array.isArray(fix.patch) ? fix.patch : [];
  if (patchRaw.length > 64) {
    return jsonErrorResponse(400, "fix.patch cannot exceed 64 ops", requestId);
  }
  for (const op of patchRaw) {
    if (!isJsonPatchOp(op)) {
      return jsonErrorResponse(400, "fix.patch contains an invalid operation", requestId);
    }
  }
  const patch = patchRaw as JsonPatchOp[];
  const explanation = typeof fix.explanation === "string" ? fix.explanation.trim().slice(0, 2000) : null;

  const scanIdRaw = typeof body.scanId === "string" ? body.scanId.trim() : null;
  const scanId = scanIdRaw && UUID_RE.test(scanIdRaw) ? scanIdRaw : null;
  const rationale = typeof body.rationale === "string" ? body.rationale.trim().slice(0, 4000) : null;

  const decision = decideOutcome(scope.mode, fixType);

  if (decision.kind === "apply") {
    let after: unknown;
    try {
      after = applyJsonPatch(content, patch);
    } catch (e) {
      return jsonErrorResponse(
        400,
        e instanceof Error ? `Patch failed: ${e.message}` : "Patch failed",
        requestId,
        "patch_error"
      );
    }

    const { data: appliedFix, error: insertError } = await supabase
      .from("applied_fixes")
      .insert({
        user_id: scope.userId,
        organization_id: scope.organizationId,
        scan_id: scanId,
        finding_signature: signature,
        rule_id,
        source,
        target,
        fix_type: fixType,
        mode: scope.mode,
        before_value: content,
        after_value: after,
        fix_patch: patch,
        applied_by: scope.userId,
      })
      .select("id, finding_signature, rule_id, source, target, fix_type, mode, applied_at")
      .maybeSingle();
    if (insertError) return jsonDatabaseErrorResponse(requestId);

    const { data: applyDecision } = await supabase
      .from("governance_decisions")
      .insert({
        user_id: scope.userId,
        organization_id: scope.organizationId,
        scan_id: scanId,
        finding_signature: signature,
        decision_type: "apply_fix",
        mode: scope.mode,
        actor_user_id: scope.userId,
        rationale,
        payload: {
          rule_id,
          source,
          target,
          severity,
          fix_type: fixType,
          applied_fix_id: appliedFix?.id ?? null,
        },
      })
      .select(
        "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id"
      )
      .maybeSingle();
    if (applyDecision) {
      void dispatchGovernanceDecisionSignal(
        { supabase },
        applyDecision as GovernanceDecisionRow & { organization_id: string | null }
      ).catch(() => {});
    }

    return attachRequestIdHeader(
      NextResponse.json({
        status: "applied",
        appliedFix,
        after,
      }),
      requestId
    );
  }

  // Queue path: write a pending_approval and a governance_decisions audit row.
  let after: unknown = null;
  if (patch.length > 0) {
    try {
      after = applyJsonPatch(content, patch);
    } catch {
      after = null;
    }
  }
  const { data: pending, error: pendingError } = await supabase
    .from("pending_approvals")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      scan_id: scanId,
      finding_signature: signature,
      rule_id,
      source,
      target,
      severity,
      fix_type: fixType,
      fix_patch: patch,
      before_value: content,
      after_value: after,
      explanation,
      status: "pending",
    })
    .select(
      "id, finding_signature, rule_id, source, target, severity, fix_type, status, created_at, expires_at"
    )
    .maybeSingle();
  if (pendingError) return jsonDatabaseErrorResponse(requestId);

  const queuedDecisionType = scope.mode === "interactive" ? "interactive_response" : "apply_fix";
  const { data: queueDecision } = await supabase
    .from("governance_decisions")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      scan_id: scanId,
      finding_signature: signature,
      decision_type: queuedDecisionType,
      mode: scope.mode,
      actor_user_id: scope.userId,
      rationale,
      payload: {
        queued: true,
        reason: decision.reason,
        pending_approval_id: pending?.id ?? null,
        rule_id,
        source,
        target,
        severity,
        fix_type: fixType,
      },
    })
    .select(
      "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id"
    )
    .maybeSingle();
  if (queueDecision) {
    void dispatchGovernanceDecisionSignal(
      { supabase },
      queueDecision as GovernanceDecisionRow & { organization_id: string | null }
    ).catch(() => {});
  }

  return attachRequestIdHeader(
    NextResponse.json({
      status: "queued",
      reason: decision.reason,
      pendingApproval: pending,
    }),
    requestId
  );
}

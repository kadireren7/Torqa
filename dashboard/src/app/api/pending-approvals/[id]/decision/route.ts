/**
 * POST /api/pending-approvals/{id}/decision
 *
 * Body: { action: 'approve' | 'reject', rationale?: string }
 *
 * On approve: the queued patch is applied (writes applied_fixes) and the row
 * transitions to status='approved'. On reject: the row transitions to
 * status='rejected' with the supplied rationale. Both write a
 * governance_decisions audit row.
 */

import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import { applyJsonPatch } from "@/lib/governance/json-patch";
import type { JsonPatchOp, FixType } from "@/lib/governance/types";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit } from "@/lib/request-body";
import { dispatchGovernanceDecisionSignal } from "@/lib/governance-signals";
import type { GovernanceDecisionRow, GovernanceDecisionType } from "@/lib/governance/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type DecisionInsert = {
  user_id: string;
  organization_id: string | null;
  scan_id: string | null;
  finding_signature: string | null;
  decision_type: GovernanceDecisionType;
  mode: string;
  actor_user_id: string;
  rationale: string | null;
  payload: Record<string, unknown>;
};

async function recordDecisionAndSignal(
  supabase: SupabaseClient,
  insert: DecisionInsert
): Promise<void> {
  const { data } = await supabase
    .from("governance_decisions")
    .insert(insert)
    .select(
      "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id"
    )
    .maybeSingle();
  if (data) {
    void dispatchGovernanceDecisionSignal(
      { supabase },
      data as GovernanceDecisionRow & { organization_id: string | null }
    ).catch(() => {});
  }
}

const DECISION_BODY_MAX_BYTES = 8 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required to decide on approvals", requestId, "service_unavailable");
  }
  const { id } = await ctx.params;
  if (!id || !UUID_RE.test(id)) {
    return jsonErrorResponse(400, "Path 'id' must be a UUID", requestId);
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to decide on approvals", requestId);
  }

  const parsed = await readJsonBodyWithByteLimit(request, DECISION_BODY_MAX_BYTES);
  if (!parsed.ok) return jsonErrorResponse(parsed.status, parsed.message, requestId);
  const body = parsed.value;
  if (!isPlainObject(body)) {
    return jsonErrorResponse(400, "Request body must be a JSON object", requestId);
  }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return jsonErrorResponse(400, "Field 'action' must be 'approve' or 'reject'", requestId);
  }
  const rationaleRaw = typeof body.rationale === "string" ? body.rationale.trim() : "";
  const rationale = rationaleRaw ? rationaleRaw.slice(0, 4000) : null;

  const { data: row, error: readError } = await supabase
    .from("pending_approvals")
    .select(
      "id, user_id, organization_id, scan_id, finding_signature, rule_id, source, target, severity, fix_type, fix_patch, before_value, status"
    )
    .eq("id", id)
    .maybeSingle();
  if (readError) return jsonDatabaseErrorResponse(requestId);
  if (!row) return jsonErrorResponse(404, "Pending approval not found", requestId);
  if (row.status !== "pending") {
    return jsonErrorResponse(409, `Approval already ${row.status}`, requestId, "conflict");
  }

  if (row.organization_id) {
    if (row.organization_id !== scope.organizationId || !scope.isAdmin) {
      return jsonErrorResponse(403, "Only workspace owners or admins can decide on approvals", requestId);
    }
  } else if (row.user_id !== scope.userId) {
    return jsonErrorResponse(403, "You do not own this approval", requestId);
  }

  const decidedAt = new Date().toISOString();
  const nextStatus: "approved" | "rejected" = action === "approve" ? "approved" : "rejected";

  if (nextStatus === "rejected") {
    const { error: rejectError } = await supabase
      .from("pending_approvals")
      .update({
        status: "rejected",
        decided_at: decidedAt,
        decided_by: scope.userId,
        decided_rationale: rationale,
      })
      .eq("id", id);
    if (rejectError) return jsonDatabaseErrorResponse(requestId);

    await recordDecisionAndSignal(supabase, {
      user_id: scope.userId,
      organization_id: scope.organizationId,
      scan_id: row.scan_id,
      finding_signature: row.finding_signature,
      decision_type: "reject_fix",
      mode: scope.mode,
      actor_user_id: scope.userId,
      rationale,
      payload: { pending_approval_id: id, rule_id: row.rule_id, target: row.target, source: row.source, severity: row.severity },
    });

    return attachRequestIdHeader(NextResponse.json({ status: "rejected" }), requestId);
  }

  // approve → apply the patch onto the stored before_value.
  if (!Array.isArray(row.fix_patch) || row.fix_patch.length === 0) {
    // Nothing to apply (manual_required path); transition to approved without applied_fixes row.
    const { error: approveError } = await supabase
      .from("pending_approvals")
      .update({
        status: "approved",
        decided_at: decidedAt,
        decided_by: scope.userId,
        decided_rationale: rationale,
      })
      .eq("id", id);
    if (approveError) return jsonDatabaseErrorResponse(requestId);

    await recordDecisionAndSignal(supabase, {
      user_id: scope.userId,
      organization_id: scope.organizationId,
      scan_id: row.scan_id,
      finding_signature: row.finding_signature,
      decision_type: "approve_fix",
      mode: scope.mode,
      actor_user_id: scope.userId,
      rationale,
      payload: {
        pending_approval_id: id,
        rule_id: row.rule_id,
        target: row.target,
        source: row.source,
        severity: row.severity,
        applied_fix_id: null,
        manual_only: true,
      },
    });

    return attachRequestIdHeader(NextResponse.json({ status: "approved", appliedFix: null }), requestId);
  }

  if (row.before_value === null || typeof row.before_value !== "object") {
    return jsonErrorResponse(409, "Approval is missing the before_value snapshot", requestId, "conflict");
  }
  let after: unknown;
  try {
    after = applyJsonPatch(row.before_value as Record<string, unknown>, row.fix_patch as JsonPatchOp[]);
  } catch (e) {
    return jsonErrorResponse(
      400,
      e instanceof Error ? `Patch failed: ${e.message}` : "Patch failed",
      requestId,
      "patch_error"
    );
  }

  const { data: appliedFix, error: appliedError } = await supabase
    .from("applied_fixes")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      scan_id: row.scan_id,
      finding_signature: row.finding_signature,
      rule_id: row.rule_id,
      source: row.source,
      target: row.target,
      fix_type: row.fix_type as FixType,
      mode: scope.mode,
      before_value: row.before_value,
      after_value: after,
      fix_patch: row.fix_patch,
      applied_by: scope.userId,
    })
    .select("id, applied_at")
    .maybeSingle();
  if (appliedError) return jsonDatabaseErrorResponse(requestId);

  const { error: approveError } = await supabase
    .from("pending_approvals")
    .update({
      status: "approved",
      decided_at: decidedAt,
      decided_by: scope.userId,
      decided_rationale: rationale,
    })
    .eq("id", id);
  if (approveError) return jsonDatabaseErrorResponse(requestId);

  await recordDecisionAndSignal(supabase, {
    user_id: scope.userId,
    organization_id: scope.organizationId,
    scan_id: row.scan_id,
    finding_signature: row.finding_signature,
    decision_type: "approve_fix",
    mode: scope.mode,
    actor_user_id: scope.userId,
    rationale,
    payload: {
      pending_approval_id: id,
      rule_id: row.rule_id,
      target: row.target,
      source: row.source,
      severity: row.severity,
      applied_fix_id: appliedFix?.id ?? null,
    },
  });

  return attachRequestIdHeader(
    NextResponse.json({ status: "approved", appliedFix, after }),
    requestId
  );
}

import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { dispatchGovernanceDecisionSignal } from "@/lib/governance-signals";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required to revoke accepted risks", requestId, "service_unavailable");
  }
  const { id } = await ctx.params;
  if (!id || !UUID_RE.test(id)) {
    return jsonErrorResponse(400, "Path 'id' must be a UUID", requestId);
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to revoke an accepted risk", requestId);
  }

  const { data: existing, error: readError } = await supabase
    .from("accepted_risks")
    .select("id, finding_signature, organization_id, user_id, revoked_at, rule_id, source, target, severity")
    .eq("id", id)
    .maybeSingle();
  if (readError) return jsonDatabaseErrorResponse(requestId);
  if (!existing) return jsonErrorResponse(404, "Accepted risk not found", requestId);

  if (existing.organization_id) {
    if (existing.organization_id !== scope.organizationId || !scope.isAdmin) {
      return jsonErrorResponse(403, "Only workspace owners or admins can revoke risks", requestId);
    }
  } else if (existing.user_id !== scope.userId) {
    return jsonErrorResponse(403, "You do not own this accepted risk", requestId);
  }

  if (existing.revoked_at) {
    return attachRequestIdHeader(NextResponse.json({ ok: true, alreadyRevoked: true }), requestId);
  }

  const { error: updateError } = await supabase
    .from("accepted_risks")
    .update({ revoked_at: new Date().toISOString(), revoked_by: scope.userId })
    .eq("id", id);
  if (updateError) return jsonDatabaseErrorResponse(requestId);

  const { data: revokeDecision } = await supabase
    .from("governance_decisions")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      finding_signature: existing.finding_signature,
      decision_type: "revoke_risk",
      mode: scope.mode,
      actor_user_id: scope.userId,
      payload: {
        accepted_risk_id: id,
        rule_id: existing.rule_id,
        source: existing.source,
        target: existing.target,
        severity: existing.severity,
      },
    })
    .select(
      "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id"
    )
    .maybeSingle();
  if (revokeDecision) {
    void dispatchGovernanceDecisionSignal(
      { supabase },
      revokeDecision as GovernanceDecisionRow & { organization_id: string | null }
    ).catch(() => {});
  }

  return attachRequestIdHeader(NextResponse.json({ ok: true }), requestId);
}

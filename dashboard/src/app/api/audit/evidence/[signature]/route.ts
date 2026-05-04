import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ signature: string }> };

/**
 * Audit evidence chain — given a finding signature, return all related rows
 * across the governance audit surface so the UI can drill into a single
 * timeline entry and see exactly what happened to that finding.
 *
 * Returns:
 *   - decisions[]      — every governance_decisions row with this signature
 *   - applied_fixes[]  — fixes applied to this finding (may be empty)
 *   - accepted_risks[] — accept/revoke history (may be empty)
 *   - pending_approvals[] — queued approvals + their status
 *   - first_seen_at, last_decision_at — convenience timestamps for the header
 */
export async function GET(request: Request, context: RouteContext) {
  const requestId = getOrCreateRequestId(request);
  const { signature } = await context.params;
  if (!signature || signature.length < 4) {
    return jsonErrorResponse(400, "Signature is required", requestId);
  }

  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required for audit evidence", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) return jsonErrorResponse(401, "Sign in required", requestId);

  const scopeFilter = scope.organizationId
    ? { col: "organization_id" as const, value: scope.organizationId }
    : null;

  const decisionsQ = supabase
    .from("governance_decisions")
    .select("id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at")
    .eq("finding_signature", signature)
    .order("created_at", { ascending: false })
    .limit(200);
  const fixesQ = supabase
    .from("applied_fixes")
    .select(
      "id, scan_id, finding_signature, rule_id, source, target, fix_type, mode, before_value, after_value, fix_patch, applied_by, applied_at, reverted_at"
    )
    .eq("finding_signature", signature)
    .order("applied_at", { ascending: false })
    .limit(50);
  const risksQ = supabase
    .from("accepted_risks")
    .select(
      "id, finding_signature, rule_id, source, target, severity, rationale, accepted_by, accepted_at, expires_at, revoked_at, revoked_by"
    )
    .eq("finding_signature", signature)
    .order("accepted_at", { ascending: false })
    .limit(50);
  const approvalsQ = supabase
    .from("pending_approvals")
    .select(
      "id, scan_id, finding_signature, rule_id, source, target, severity, fix_type, fix_patch, before_value, after_value, explanation, status, decided_at, decided_by, decided_rationale, created_at, expires_at"
    )
    .eq("finding_signature", signature)
    .order("created_at", { ascending: false })
    .limit(50);

  const scopedDecisions = scopeFilter
    ? decisionsQ.eq(scopeFilter.col, scopeFilter.value)
    : decisionsQ.is("organization_id", null).eq("user_id", scope.userId);
  const scopedFixes = scopeFilter
    ? fixesQ.eq(scopeFilter.col, scopeFilter.value)
    : fixesQ.is("organization_id", null).eq("user_id", scope.userId);
  const scopedRisks = scopeFilter
    ? risksQ.eq(scopeFilter.col, scopeFilter.value)
    : risksQ.is("organization_id", null).eq("user_id", scope.userId);
  const scopedApprovals = scopeFilter
    ? approvalsQ.eq(scopeFilter.col, scopeFilter.value)
    : approvalsQ.is("organization_id", null).eq("user_id", scope.userId);

  const [decRes, fixRes, riskRes, apprRes] = await Promise.all([
    scopedDecisions,
    scopedFixes,
    scopedRisks,
    scopedApprovals,
  ]);

  if (decRes.error || fixRes.error || riskRes.error || apprRes.error) {
    return jsonDatabaseErrorResponse(requestId);
  }

  const decisions = decRes.data ?? [];
  const fixes = fixRes.data ?? [];
  const risks = riskRes.data ?? [];
  const approvals = apprRes.data ?? [];

  // Resolve actor display info (profiles).
  const actorIds = new Set<string>();
  for (const d of decisions) if (d.actor_user_id) actorIds.add(d.actor_user_id as string);
  for (const f of fixes) if (f.applied_by) actorIds.add(f.applied_by as string);
  for (const r of risks) {
    if (r.accepted_by) actorIds.add(r.accepted_by as string);
    if (r.revoked_by) actorIds.add(r.revoked_by as string);
  }
  for (const a of approvals) if (a.decided_by) actorIds.add(a.decided_by as string);

  const actors: Record<string, { displayName: string | null }> = {};
  if (actorIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(actorIds));
    if (Array.isArray(profiles)) {
      for (const p of profiles as Array<{ id: string; display_name: string | null }>) {
        actors[p.id] = { displayName: p.display_name };
      }
    }
  }

  // Compute timeline anchors.
  const firstSeenAt = [...decisions, ...fixes.map((f) => ({ created_at: f.applied_at })), ...risks.map((r) => ({ created_at: r.accepted_at })), ...approvals]
    .map((row) => (typeof row.created_at === "string" ? row.created_at : null))
    .filter((t): t is string => Boolean(t))
    .sort()
    .at(0) ?? null;
  const lastDecisionAt = decisions[0]?.created_at ?? null;

  return attachRequestIdHeader(
    NextResponse.json({
      signature,
      decisions,
      applied_fixes: fixes,
      accepted_risks: risks,
      pending_approvals: approvals,
      actors,
      first_seen_at: firstSeenAt,
      last_decision_at: lastDecisionAt,
    }),
    requestId
  );
}

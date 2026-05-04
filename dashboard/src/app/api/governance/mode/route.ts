import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope, asGovernanceModeView } from "@/lib/governance/scope";
import { isGovernanceMode } from "@/lib/governance/types";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit } from "@/lib/request-body";
import { dispatchGovernanceDecisionSignal } from "@/lib/governance-signals";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

export const runtime = "nodejs";

const MODE_BODY_MAX_BYTES = 4 * 1024;

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const supabase = await createClient();
  if (!supabase) {
    if (isSupabaseConfigured()) {
      return jsonErrorResponse(503, "Supabase not initialized", requestId, "service_unavailable");
    }
    // Local mode: return safe defaults so the UI still renders.
    const scope = await resolveGovernanceScope(null);
    return attachRequestIdHeader(
      NextResponse.json({ governance: asGovernanceModeView(scope) }),
      requestId
    );
  }
  const scope = await resolveGovernanceScope(supabase);
  return attachRequestIdHeader(
    NextResponse.json({ governance: asGovernanceModeView(scope) }),
    requestId
  );
}

export async function PUT(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(503, "Supabase is required to change mode", requestId, "service_unavailable");
  }
  const supabase = await createClient();
  if (!supabase) {
    return jsonErrorResponse(503, "Supabase not initialized", requestId, "service_unavailable");
  }

  const parsed = await readJsonBodyWithByteLimit(request, MODE_BODY_MAX_BYTES);
  if (!parsed.ok) {
    return jsonErrorResponse(parsed.status, parsed.message, requestId);
  }
  const body = parsed.value;
  const next = body && typeof body === "object" ? (body as Record<string, unknown>).mode : null;
  if (!isGovernanceMode(next)) {
    return jsonErrorResponse(
      400,
      "Field 'mode' must be one of: autonomous, supervised, interactive",
      requestId
    );
  }

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to change governance mode", requestId);
  }
  if (!scope.organizationId) {
    return jsonErrorResponse(
      400,
      "Switch to a workspace before changing the governance mode (personal scope is read-only).",
      requestId,
      "personal_scope_readonly"
    );
  }
  if (!scope.isAdmin) {
    return jsonErrorResponse(403, "Only workspace owners or admins can change the governance mode.", requestId);
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ governance_mode: next, updated_at: new Date().toISOString() })
    .eq("id", scope.organizationId);
  if (updateError) {
    return jsonDatabaseErrorResponse(requestId);
  }

  const { data: modeDecision } = await supabase
    .from("governance_decisions")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      decision_type: "mode_change",
      mode: next,
      actor_user_id: scope.userId,
      payload: { from_mode: scope.mode, to_mode: next },
    })
    .select(
      "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id"
    )
    .maybeSingle();
  if (modeDecision) {
    void dispatchGovernanceDecisionSignal(
      { supabase },
      modeDecision as GovernanceDecisionRow & { organization_id: string | null }
    ).catch(() => {});
  }

  return attachRequestIdHeader(
    NextResponse.json({
      governance: { ...asGovernanceModeView(scope), mode: next },
    }),
    requestId
  );
}

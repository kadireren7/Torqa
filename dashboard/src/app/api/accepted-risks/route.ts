import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { readJsonBodyWithByteLimit } from "@/lib/request-body";
import type { ScanSeverity } from "@/lib/scan-engine";
import { dispatchGovernanceDecisionSignal } from "@/lib/governance-signals";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

export const runtime = "nodejs";

const ACCEPTED_RISK_MAX_BYTES = 16 * 1024;
const VALID_SEVERITY: ScanSeverity[] = ["info", "review", "high", "critical"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return attachRequestIdHeader(NextResponse.json({ items: [] }), requestId);
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to view accepted risks", requestId);
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get("status") ?? "active";

  let query = supabase
    .from("accepted_risks")
    .select(
      "id, finding_signature, rule_id, source, target, severity, rationale, organization_id, accepted_by, accepted_at, expires_at, revoked_at"
    )
    .order("accepted_at", { ascending: false })
    .limit(200);

  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  } else {
    query = query.is("organization_id", null).eq("user_id", scope.userId);
  }

  if (filter === "active") {
    query = query.is("revoked_at", null);
  } else if (filter === "revoked") {
    query = query.not("revoked_at", "is", null);
  }

  const { data, error } = await query;
  if (error) return jsonDatabaseErrorResponse(requestId);

  return attachRequestIdHeader(NextResponse.json({ items: data ?? [] }), requestId);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return jsonErrorResponse(
      503,
      "Supabase is required to record accepted risks",
      requestId,
      "service_unavailable"
    );
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to accept a risk", requestId);
  }
  if (scope.organizationId && !scope.isAdmin) {
    return jsonErrorResponse(403, "Only workspace owners or admins can accept risks.", requestId);
  }

  const parsed = await readJsonBodyWithByteLimit(request, ACCEPTED_RISK_MAX_BYTES);
  if (!parsed.ok) return jsonErrorResponse(parsed.status, parsed.message, requestId);
  const body = parsed.value;
  if (!isPlainObject(body)) {
    return jsonErrorResponse(400, "Request body must be a JSON object", requestId);
  }

  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  const rule_id = typeof body.rule_id === "string" ? body.rule_id.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const target = typeof body.target === "string" ? body.target.trim() : "";
  const severity = typeof body.severity === "string" ? (body.severity as ScanSeverity) : null;
  const rationale = typeof body.rationale === "string" ? body.rationale.trim() : "";
  const expiresRaw = body.expires_at;

  if (!signature || signature.length > 256) {
    return jsonErrorResponse(400, "Field 'signature' is required (sha256 hex)", requestId);
  }
  if (!rule_id || rule_id.length > 200) {
    return jsonErrorResponse(400, "Field 'rule_id' is required", requestId);
  }
  if (!source || source.length > 64) {
    return jsonErrorResponse(400, "Field 'source' is required", requestId);
  }
  if (!target || target.length > 256) {
    return jsonErrorResponse(400, "Field 'target' is required", requestId);
  }
  if (!severity || !VALID_SEVERITY.includes(severity)) {
    return jsonErrorResponse(
      400,
      `Field 'severity' must be one of: ${VALID_SEVERITY.join(", ")}`,
      requestId
    );
  }
  if (!rationale || rationale.length < 4 || rationale.length > 4000) {
    return jsonErrorResponse(
      400,
      "Field 'rationale' must be 4–4000 characters describing why the risk is intentional",
      requestId
    );
  }

  let expires_at: string | null = null;
  if (expiresRaw === null || expiresRaw === undefined || expiresRaw === "") {
    expires_at = null;
  } else if (typeof expiresRaw === "string") {
    const d = new Date(expiresRaw);
    if (Number.isNaN(d.getTime())) {
      return jsonErrorResponse(400, "Field 'expires_at' must be ISO 8601 datetime or null", requestId);
    }
    if (d.getTime() < Date.now()) {
      return jsonErrorResponse(400, "Field 'expires_at' must be in the future", requestId);
    }
    expires_at = d.toISOString();
  } else if (typeof expiresRaw === "number") {
    // days from now (30/90/180 shorthand)
    const days = Math.round(expiresRaw);
    if (!Number.isFinite(days) || days <= 0 || days > 3650) {
      return jsonErrorResponse(400, "Field 'expires_at' as days must be 1..3650", requestId);
    }
    expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  } else {
    return jsonErrorResponse(400, "Field 'expires_at' must be ISO date string, days number, or null", requestId);
  }

  const { data, error } = await supabase
    .from("accepted_risks")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      finding_signature: signature,
      rule_id,
      source,
      target,
      severity,
      rationale,
      accepted_by: scope.userId,
      expires_at,
    })
    .select("id, finding_signature, rule_id, source, target, severity, rationale, accepted_at, expires_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return jsonErrorResponse(409, "This finding is already on the accepted-risk registry.", requestId, "conflict");
    }
    return jsonDatabaseErrorResponse(requestId);
  }

  const { data: decisionRow } = await supabase
    .from("governance_decisions")
    .insert({
      user_id: scope.userId,
      organization_id: scope.organizationId,
      finding_signature: signature,
      decision_type: "accept_risk",
      mode: scope.mode,
      actor_user_id: scope.userId,
      rationale,
      payload: { rule_id, source, target, severity, expires_at },
    })
    .select(
      "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id"
    )
    .maybeSingle();

  if (decisionRow) {
    void dispatchGovernanceDecisionSignal(
      { supabase },
      decisionRow as GovernanceDecisionRow & { organization_id: string | null }
    ).catch(() => {});
  }

  return attachRequestIdHeader(NextResponse.json({ item: data }, { status: 201 }), requestId);
}

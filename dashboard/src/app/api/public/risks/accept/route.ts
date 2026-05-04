import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachRequestIdHeader } from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import {
  authenticatePublicApiRequest,
  getRequestIp,
  logPublicApiUsage,
} from "@/lib/public-api-auth";
import { wrapPublicError, wrapPublicSuccess } from "@/lib/public-api-envelope";
import { readJsonBodyWithByteLimit } from "@/lib/request-body";
import { listSourceIds } from "@/lib/scan/source-registry";
import type { ScanSeverity, ScanSource } from "@/lib/scan-engine";
import { DEFAULT_GOVERNANCE_MODE } from "@/lib/governance/types";
import { dispatchGovernanceDecisionSignal } from "@/lib/governance-signals";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

export const runtime = "nodejs";

const ENDPOINT = "/api/public/risks/accept";
const ACCEPTED_RISK_MAX_BYTES = 16 * 1024;
const VALID_SEVERITY: ScanSeverity[] = ["info", "review", "high", "critical"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Programmatically accept a finding as a known risk via API key. Used by
 * pipelines that already vetted a finding and want to suppress it on
 * subsequent scans without UI clicks.
 *
 * Records both the `accepted_risks` row and a `governance_decisions` audit
 * entry so the action shows up in the audit timeline.
 */
export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const respondError = (status: number, code: string, message: string) =>
    attachRequestIdHeader(
      NextResponse.json(wrapPublicError(code, message, requestId), { status }),
      requestId
    );

  const admin = createAdminClient();
  if (!admin) return respondError(503, "service_unavailable", "Public API is temporarily unavailable");

  const auth = await authenticatePublicApiRequest(admin, request);
  if (!auth.ok) return respondError(auth.status, auth.code, auth.message);

  let statusCode = 201;
  let errorCode: string | null = null;
  try {
    const parsed = await readJsonBodyWithByteLimit(request, ACCEPTED_RISK_MAX_BYTES);
    if (!parsed.ok) {
      statusCode = parsed.status;
      errorCode = parsed.status === 413 ? "payload_too_large" : "invalid_json";
      return respondError(parsed.status, errorCode, parsed.message);
    }
    const body = parsed.value;
    if (!isPlainObject(body)) {
      statusCode = 400;
      errorCode = "invalid_shape";
      return respondError(400, "bad_request", "Body must be a JSON object");
    }

    const organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;
    if (organizationId && !auth.scope.organizationIds.includes(organizationId)) {
      statusCode = 403;
      errorCode = "forbidden";
      return respondError(403, "forbidden", "API key is not a member of that organization");
    }
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";
    const ruleId = typeof body.rule_id === "string" ? body.rule_id.trim() : "";
    const source = typeof body.source === "string" ? body.source.trim() : "";
    const target = typeof body.target === "string" ? body.target.trim() : "";
    const severity = typeof body.severity === "string" ? (body.severity as ScanSeverity) : null;
    const rationale = typeof body.rationale === "string" ? body.rationale.trim() : "";
    const expiresRaw = body.expires_at;

    if (!signature || signature.length > 256) {
      statusCode = 400;
      errorCode = "missing_signature";
      return respondError(400, "bad_request", "signature is required (1..256 chars)");
    }
    if (!ruleId || ruleId.length > 200) {
      statusCode = 400;
      errorCode = "missing_rule_id";
      return respondError(400, "bad_request", "rule_id is required");
    }
    if (!source || !listSourceIds().includes(source as ScanSource)) {
      statusCode = 400;
      errorCode = "invalid_source";
      return respondError(400, "bad_request", `source must be one of ${listSourceIds().join(", ")}`);
    }
    if (!target || target.length > 256) {
      statusCode = 400;
      errorCode = "missing_target";
      return respondError(400, "bad_request", "target is required");
    }
    if (!severity || !VALID_SEVERITY.includes(severity)) {
      statusCode = 400;
      errorCode = "invalid_severity";
      return respondError(400, "bad_request", `severity must be one of ${VALID_SEVERITY.join(", ")}`);
    }
    if (!rationale || rationale.length < 4 || rationale.length > 4000) {
      statusCode = 400;
      errorCode = "invalid_rationale";
      return respondError(400, "bad_request", "rationale must be 4..4000 chars");
    }

    let expiresAt: string | null = null;
    if (expiresRaw === null || expiresRaw === undefined || expiresRaw === "") {
      expiresAt = null;
    } else if (typeof expiresRaw === "string") {
      const d = new Date(expiresRaw);
      if (Number.isNaN(d.getTime())) {
        statusCode = 400;
        errorCode = "invalid_expires_at";
        return respondError(400, "bad_request", "expires_at must be ISO 8601 datetime");
      }
      if (d.getTime() < Date.now()) {
        statusCode = 400;
        errorCode = "expires_at_past";
        return respondError(400, "bad_request", "expires_at must be in the future");
      }
      expiresAt = d.toISOString();
    } else if (typeof expiresRaw === "number") {
      const days = Math.round(expiresRaw);
      if (!Number.isFinite(days) || days <= 0 || days > 3650) {
        statusCode = 400;
        errorCode = "invalid_expires_days";
        return respondError(400, "bad_request", "expires_at as days must be 1..3650");
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    } else {
      statusCode = 400;
      errorCode = "invalid_expires_at";
      return respondError(400, "bad_request", "expires_at must be ISO string, days number, or null");
    }

    const { data, error } = await admin
      .from("accepted_risks")
      .insert({
        user_id: auth.scope.userId,
        organization_id: organizationId,
        finding_signature: signature,
        rule_id: ruleId,
        source,
        target,
        severity,
        rationale,
        accepted_by: auth.scope.userId,
        expires_at: expiresAt,
      })
      .select("id, finding_signature, rule_id, source, target, severity, rationale, accepted_at, expires_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        statusCode = 409;
        errorCode = "conflict";
        return respondError(409, "conflict", "This finding is already on the accepted-risk registry");
      }
      statusCode = 500;
      errorCode = "database_error";
      return respondError(500, "database_error", "Failed to record acceptance");
    }

    const { data: decisionRow } = await admin
      .from("governance_decisions")
      .insert({
        user_id: auth.scope.userId,
        organization_id: organizationId,
        finding_signature: signature,
        decision_type: "accept_risk",
        mode: DEFAULT_GOVERNANCE_MODE,
        actor_user_id: auth.scope.userId,
        rationale,
        payload: { rule_id: ruleId, source, target, severity, expires_at: expiresAt, via: "public_api" },
      })
      .select(
        "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id"
      )
      .maybeSingle();
    if (decisionRow) {
      void dispatchGovernanceDecisionSignal(
        { supabase: admin },
        decisionRow as GovernanceDecisionRow & { organization_id: string | null }
      ).catch(() => {});
    }

    return attachRequestIdHeader(
      NextResponse.json(wrapPublicSuccess({ item: data }, requestId), { status: 201 }),
      requestId
    );
  } finally {
    void logPublicApiUsage(admin, auth.scope, {
      endpoint: ENDPOINT,
      statusCode,
      errorCode,
      requestIp: getRequestIp(request),
      metadata: { requestId },
    });
  }
}

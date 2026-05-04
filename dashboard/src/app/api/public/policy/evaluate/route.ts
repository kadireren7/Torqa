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
import { evaluatePolicyRules } from "@/lib/governance/policy-v2/evaluator";
import { resolvePolicyPack } from "@/lib/governance/policy-v2/resolver";
import { listSourceIds } from "@/lib/scan/source-registry";
import type { ScanFinding, ScanSource } from "@/lib/scan-engine";

export const runtime = "nodejs";

const EVALUATE_MAX_BODY_BYTES = 256 * 1024;
const ENDPOINT = "/api/public/policy/evaluate";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function normalizeFindings(value: unknown): { ok: true; findings: ScanFinding[] } | { ok: false; reason: string } {
  if (!Array.isArray(value)) return { ok: false, reason: "findings must be an array" };
  if (value.length > 2000) return { ok: false, reason: "Too many findings (>2000)" };
  const out: ScanFinding[] = [];
  for (const f of value) {
    if (!isPlainObject(f)) return { ok: false, reason: "Each finding must be an object" };
    const severity = f.severity;
    if (severity !== "info" && severity !== "review" && severity !== "high" && severity !== "critical") {
      return { ok: false, reason: `Invalid severity: ${String(severity)}` };
    }
    const rule_id = typeof f.rule_id === "string" ? f.rule_id : null;
    const target = typeof f.target === "string" ? f.target : null;
    if (!rule_id || !target) {
      return { ok: false, reason: "Each finding requires rule_id and target" };
    }
    out.push({
      severity,
      rule_id,
      target,
      explanation: typeof f.explanation === "string" ? f.explanation : "",
      suggested_fix: typeof f.suggested_fix === "string" ? f.suggested_fix : "",
      signature: typeof f.signature === "string" ? f.signature : undefined,
      accepted_risk: f.accepted_risk === true ? true : undefined,
    } as ScanFinding);
  }
  return { ok: true, findings: out };
}

/**
 * Evaluate a finding-set against a Policy Pack v2 by id. Used by CI runners
 * that already have findings (from a prior scan or from their own engine)
 * and need a verdict (pass/review/block) without re-scanning.
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

  let statusCode = 200;
  let errorCode: string | null = null;
  try {
    const parsed = await readJsonBodyWithByteLimit(request, EVALUATE_MAX_BODY_BYTES);
    if (!parsed.ok) {
      statusCode = parsed.status;
      errorCode = parsed.status === 413 ? "payload_too_large" : "invalid_json";
      return respondError(parsed.status, errorCode, parsed.message);
    }
    const body = parsed.value;
    if (!isPlainObject(body)) {
      statusCode = 400;
      errorCode = "invalid_shape";
      return respondError(400, "bad_request", "Request body must be a JSON object");
    }

    const packId = typeof body.policyPackId === "string" ? body.policyPackId.trim() : "";
    if (!packId) {
      statusCode = 400;
      errorCode = "missing_pack_id";
      return respondError(400, "bad_request", "policyPackId is required");
    }
    const sourceRaw = body.source;
    const VALID = listSourceIds();
    if (typeof sourceRaw !== "string" || !VALID.includes(sourceRaw as ScanSource)) {
      statusCode = 400;
      errorCode = "invalid_source";
      return respondError(400, "bad_request", `source must be one of ${VALID.join(", ")}`);
    }
    const riskScore =
      typeof body.riskScore === "number" && Number.isFinite(body.riskScore)
        ? Math.max(0, Math.min(100, body.riskScore))
        : 0;

    const f = normalizeFindings(body.findings);
    if (!f.ok) {
      statusCode = 400;
      errorCode = "invalid_findings";
      return respondError(400, "bad_request", f.reason);
    }

    // Pack visibility: must belong to the API key's user or one of their orgs.
    const { data: packRow, error: packErr } = await admin
      .from("policy_packs")
      .select("id, user_id, organization_id")
      .eq("id", packId)
      .maybeSingle();
    if (packErr) {
      statusCode = 500;
      errorCode = "database_error";
      return respondError(500, "database_error", "Failed to load policy pack");
    }
    if (!packRow) {
      statusCode = 404;
      errorCode = "pack_not_found";
      return respondError(404, "not_found", "Policy pack not found");
    }
    const visible =
      packRow.user_id === auth.scope.userId ||
      (typeof packRow.organization_id === "string" && auth.scope.organizationIds.includes(packRow.organization_id));
    if (!visible) {
      statusCode = 403;
      errorCode = "forbidden";
      return respondError(403, "forbidden", "API key cannot evaluate this policy pack");
    }

    const resolved = await resolvePolicyPack(admin, packId);
    if (!resolved) {
      statusCode = 404;
      errorCode = "pack_not_found";
      return respondError(404, "not_found", "Policy pack could not be resolved");
    }

    const result = evaluatePolicyRules(
      resolved.rules,
      resolved.defaultVerdict,
      resolved.name,
      resolved.packId,
      { findings: f.findings, riskScore, source: sourceRaw as ScanSource }
    );

    return attachRequestIdHeader(
      NextResponse.json(wrapPublicSuccess(result, requestId)),
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

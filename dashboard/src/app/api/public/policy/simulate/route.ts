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
import { resolvePolicyPack } from "@/lib/governance/policy-v2/resolver";
import {
  simulatePolicyPack,
  type SimulationRange,
} from "@/lib/governance/policy-v2/simulator";
import { DEFAULT_GOVERNANCE_MODE } from "@/lib/governance/types";

export const runtime = "nodejs";

const ENDPOINT = "/api/public/policy/simulate";
const SIMULATE_BODY_MAX_BYTES = 64 * 1024;
const VALID_RANGES: SimulationRange[] = ["last-7-days", "last-30-days", "last-90-days"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Programmatic policy simulation — runs the given pack id against historical
 * scans for the pack's natural scope (its owning user/org). Useful for CI
 * pipelines that want to dry-run a pack change before promoting it.
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
    const parsed = await readJsonBodyWithByteLimit(request, SIMULATE_BODY_MAX_BYTES);
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
    const packId = typeof body.policyPackId === "string" ? body.policyPackId.trim() : "";
    if (!packId) {
      statusCode = 400;
      errorCode = "missing_pack_id";
      return respondError(400, "bad_request", "policyPackId is required");
    }
    const range = (typeof body.range === "string" ? body.range : "last-30-days") as SimulationRange;
    if (!VALID_RANGES.includes(range)) {
      statusCode = 400;
      errorCode = "invalid_range";
      return respondError(400, "bad_request", `range must be one of ${VALID_RANGES.join(", ")}`);
    }

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
    const orgId = typeof packRow.organization_id === "string" ? packRow.organization_id : null;
    const visible =
      packRow.user_id === auth.scope.userId ||
      (orgId !== null && auth.scope.organizationIds.includes(orgId));
    if (!visible) {
      statusCode = 403;
      errorCode = "forbidden";
      return respondError(403, "forbidden", "API key cannot simulate this policy pack");
    }

    const resolved = await resolvePolicyPack(admin, packId);
    if (!resolved) {
      statusCode = 404;
      errorCode = "pack_not_found";
      return respondError(404, "not_found", "Policy pack could not be resolved");
    }

    const summary = await simulatePolicyPack(
      admin,
      {
        userId: auth.scope.userId,
        organizationId: orgId,
        mode: DEFAULT_GOVERNANCE_MODE,
        isAdmin: false,
      },
      resolved,
      range
    );

    return attachRequestIdHeader(
      NextResponse.json(
        wrapPublicSuccess(
          { summary, pack: { id: resolved.packId, name: resolved.name } },
          requestId
        )
      ),
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

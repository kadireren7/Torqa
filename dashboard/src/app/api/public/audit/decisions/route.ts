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
import { DECISION_TYPES_FOR_FILTERS } from "@/lib/audit/decision-format";
import type { GovernanceDecisionType } from "@/lib/governance/types";

export const runtime = "nodejs";

const ENDPOINT = "/api/public/audit/decisions";

function clampInt(raw: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), max);
}

function clampOffset(raw: string | null, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), max);
}

function parseIso(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * Read-only paginated audit feed. Returns governance decisions visible to
 * the API key (personal + every org membership). CI pipelines can poll this
 * to attach evidence to release artifacts.
 */
export async function GET(request: Request) {
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
    const url = new URL(request.url);
    const limit = clampInt(url.searchParams.get("limit"), 100, 500);
    const offset = clampOffset(url.searchParams.get("offset"), 10_000);
    const typeRaw = url.searchParams.get("type");
    const type =
      typeRaw && DECISION_TYPES_FOR_FILTERS.includes(typeRaw as GovernanceDecisionType)
        ? (typeRaw as GovernanceDecisionType)
        : null;
    const since = parseIso(url.searchParams.get("since"));
    const until = parseIso(url.searchParams.get("until"));
    const signature = url.searchParams.get("signature");
    const orgFilter = url.searchParams.get("organizationId");

    let query = admin
      .from("governance_decisions")
      .select(
        "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id, user_id",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (orgFilter) {
      if (!auth.scope.organizationIds.includes(orgFilter)) {
        statusCode = 403;
        errorCode = "forbidden";
        return respondError(403, "forbidden", "API key is not a member of that organization");
      }
      query = query.eq("organization_id", orgFilter);
    } else if (auth.scope.organizationIds.length > 0) {
      const orgFilterStr = auth.scope.organizationIds
        .map((id) => `organization_id.eq.${id}`)
        .join(",");
      query = query.or(`and(user_id.eq.${auth.scope.userId},organization_id.is.null),${orgFilterStr}`);
    } else {
      query = query.is("organization_id", null).eq("user_id", auth.scope.userId);
    }

    if (type) query = query.eq("decision_type", type);
    if (signature) query = query.eq("finding_signature", signature);
    if (since) query = query.gte("created_at", since);
    if (until) query = query.lte("created_at", until);

    const { data, error, count } = await query;
    if (error) {
      statusCode = 500;
      errorCode = "database_error";
      return respondError(500, "database_error", "Failed to load decisions");
    }

    return attachRequestIdHeader(
      NextResponse.json(
        wrapPublicSuccess(
          {
            items: data ?? [],
            total: typeof count === "number" ? count : null,
            limit,
            offset,
          },
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

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  attachRequestIdHeader,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import {
  authenticatePublicApiRequest,
  getRequestIp,
  logPublicApiUsage,
} from "@/lib/public-api-auth";
import { wrapPublicError, wrapPublicSuccess } from "@/lib/public-api-envelope";
import { rowToPolicyPackDto } from "@/lib/governance/policy-v2/dto";

export const runtime = "nodejs";

const ENDPOINT = "/api/public/policy-packs";

/**
 * List policy packs visible to the calling API key. The personal pack of
 * the key holder plus every pack belonging to an org they're a member of.
 *
 * Pure read endpoint — no side effects beyond usage telemetry.
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
    let query = admin
      .from("policy_packs")
      .select(
        "id, user_id, organization_id, name, slug, description, level, source_type, parent_pack_id, parent_template_slug, default_verdict, rules, enabled, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    const orgIds = auth.scope.organizationIds;
    if (orgIds.length > 0) {
      // Personal pack OR org packs.
      const orgFilter = orgIds.map((id) => `organization_id.eq.${id}`).join(",");
      query = query.or(`and(user_id.eq.${auth.scope.userId},organization_id.is.null),${orgFilter}`);
    } else {
      query = query.is("organization_id", null).eq("user_id", auth.scope.userId);
    }

    const { data, error } = await query;
    if (error) {
      statusCode = 500;
      errorCode = "database_error";
      return respondError(500, "database_error", "Failed to list policy packs");
    }
    const items = (data ?? []).map((r) => rowToPolicyPackDto(r as Record<string, unknown>));
    return attachRequestIdHeader(
      NextResponse.json(wrapPublicSuccess({ items }, requestId)),
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

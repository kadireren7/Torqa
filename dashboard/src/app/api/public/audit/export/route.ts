import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachRequestIdHeader } from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import {
  authenticatePublicApiRequest,
  getRequestIp,
  logPublicApiUsage,
} from "@/lib/public-api-auth";
import { wrapPublicError } from "@/lib/public-api-envelope";
import { buildAuditCsv, type ExportRowInput } from "@/lib/audit/export-csv";
import type {
  GovernanceDecisionRow,
  GovernanceDecisionType,
} from "@/lib/governance/types";

export const runtime = "nodejs";

const ENDPOINT = "/api/public/audit/export";
const MAX_EXPORT_ROWS = 5000;

function parseIso(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * API-key-authenticated audit export, mirroring the internal
 * `/api/audit/export` but accessible from CI/CD pipelines and SDKs.
 *
 * Format defaults to `csv`. JSON returns a slim envelope with metadata.
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
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    if (format !== "csv" && format !== "json") {
      statusCode = 400;
      errorCode = "invalid_format";
      return respondError(400, "bad_request", "format must be 'csv' or 'json'");
    }
    const since = parseIso(url.searchParams.get("since"));
    const until = parseIso(url.searchParams.get("until"));
    const decisionType = url.searchParams.get("type") as GovernanceDecisionType | null;
    const orgFilter = url.searchParams.get("organizationId");

    let query = admin
      .from("governance_decisions")
      .select(
        "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at, organization_id, user_id"
      )
      .order("created_at", { ascending: false })
      .limit(MAX_EXPORT_ROWS);

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

    if (decisionType) query = query.eq("decision_type", decisionType);
    if (since) query = query.gte("created_at", since);
    if (until) query = query.lte("created_at", until);

    const { data, error } = await query;
    if (error) {
      statusCode = 500;
      errorCode = "database_error";
      return respondError(500, "database_error", "Failed to query audit log");
    }

    const rows = (data ?? []) as Array<
      GovernanceDecisionRow & { organization_id: string | null; user_id: string }
    >;

    const actorIds = Array.from(new Set(rows.map((r) => r.actor_user_id).filter(Boolean)));
    const actors: Record<string, string | null> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds);
      if (Array.isArray(profiles)) {
        for (const p of profiles as Array<{ id: string; display_name: string | null }>) {
          actors[p.id] = p.display_name;
        }
      }
    }

    if (format === "json") {
      const payload = {
        generated_at: new Date().toISOString(),
        filters: { since, until, decisionType, organizationId: orgFilter ?? null },
        total: rows.length,
        capped: rows.length === MAX_EXPORT_ROWS,
        rows: rows.map((r) => ({
          ...r,
          actor_display_name: actors[r.actor_user_id] ?? null,
        })),
      };
      const res = NextResponse.json(payload);
      res.headers.set(
        "content-disposition",
        `attachment; filename="torqa-audit-${new Date().toISOString().slice(0, 10)}.json"`
      );
      return attachRequestIdHeader(res, requestId);
    }

    const inputs: ExportRowInput[] = rows.map((r) => ({
      row: r,
      actorDisplayName: actors[r.actor_user_id] ?? null,
    }));
    const csv = buildAuditCsv(inputs);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="torqa-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        "x-request-id": requestId,
      },
    });
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

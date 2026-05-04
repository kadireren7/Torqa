import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import { DECISION_TYPES_FOR_FILTERS } from "@/lib/audit/decision-format";
import type { GovernanceDecisionType } from "@/lib/governance/types";

export const runtime = "nodejs";

function clampLimit(raw: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), max);
}

function parseIso(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return attachRequestIdHeader(NextResponse.json({ items: [], actors: {} }), requestId);
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) {
    return jsonErrorResponse(401, "Sign in to view the decision audit log", requestId);
  }

  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"), 100, 500);
  const offset = clampLimit(url.searchParams.get("offset"), 0, 10_000);
  const decisionTypeRaw = url.searchParams.get("type");
  const decisionType =
    decisionTypeRaw && DECISION_TYPES_FOR_FILTERS.includes(decisionTypeRaw as GovernanceDecisionType)
      ? (decisionTypeRaw as GovernanceDecisionType)
      : null;
  const actorUserId = url.searchParams.get("actor");
  const signature = url.searchParams.get("signature");
  const scanId = url.searchParams.get("scanId");
  const since = parseIso(url.searchParams.get("since"));
  const until = parseIso(url.searchParams.get("until"));
  const search = url.searchParams.get("q");

  let query = supabase
    .from("governance_decisions")
    .select(
      "id, scan_id, finding_signature, decision_type, mode, actor_user_id, rationale, payload, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  } else {
    query = query.is("organization_id", null).eq("user_id", scope.userId);
  }
  if (decisionType) query = query.eq("decision_type", decisionType);
  if (actorUserId) query = query.eq("actor_user_id", actorUserId);
  if (signature) query = query.eq("finding_signature", signature);
  if (scanId) query = query.eq("scan_id", scanId);
  if (since) query = query.gte("created_at", since);
  if (until) query = query.lte("created_at", until);
  if (search && search.trim()) {
    // Search rationale + payload-stringified target/rule_id via OR pattern.
    const term = search.trim().slice(0, 200);
    query = query.or(
      `rationale.ilike.%${term}%,finding_signature.ilike.%${term}%,scan_id.eq.${term}`
    );
  }

  const { data, error, count } = await query;
  if (error) return jsonDatabaseErrorResponse(requestId);

  const items = data ?? [];

  // Resolve actor display info from organization_members → users join.
  const actorIds = Array.from(
    new Set(items.map((row) => row.actor_user_id).filter((id): id is string => typeof id === "string"))
  );
  const actors: Record<string, { displayName: string | null }> = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);
    if (Array.isArray(profiles)) {
      for (const p of profiles as Array<{ id: string; display_name: string | null }>) {
        actors[p.id] = { displayName: p.display_name };
      }
    }
    for (const id of actorIds) {
      if (!actors[id]) actors[id] = { displayName: null };
    }
  }

  return attachRequestIdHeader(
    NextResponse.json({
      items,
      actors,
      total: typeof count === "number" ? count : null,
      limit,
      offset,
    }),
    requestId
  );
}

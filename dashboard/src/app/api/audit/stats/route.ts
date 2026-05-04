import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveGovernanceScope } from "@/lib/governance/scope";
import {
  attachRequestIdHeader,
  jsonDatabaseErrorResponse,
  jsonErrorResponse,
} from "@/lib/api-json-error";
import { getOrCreateRequestId } from "@/lib/api-request-id";
import type { GovernanceDecisionType } from "@/lib/governance/types";

export const runtime = "nodejs";

const VALID_RANGE_DAYS = [7, 30, 90] as const;
type RangeDays = (typeof VALID_RANGE_DAYS)[number];

/**
 * Audit stats — KPIs and breakdowns powering the audit page header.
 *
 * Pulls the last N days (default 30) of `governance_decisions` for the active
 * scope, then aggregates client-side: per-day counts, per-type counts,
 * per-actor counts, and a few one-shot totals (fixes / accepts / approvals).
 */
export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  if (!isSupabaseConfigured()) {
    return attachRequestIdHeader(
      NextResponse.json({ totals: {}, byDay: [], byType: {}, byActor: [] }),
      requestId
    );
  }
  const supabase = await createClient();
  if (!supabase) return jsonDatabaseErrorResponse(requestId);

  const scope = await resolveGovernanceScope(supabase);
  if (!scope.userId) return jsonErrorResponse(401, "Sign in required", requestId);

  const url = new URL(request.url);
  const reqDays = Number.parseInt(url.searchParams.get("days") ?? "30", 10);
  const days: RangeDays = (VALID_RANGE_DAYS as readonly number[]).includes(reqDays)
    ? (reqDays as RangeDays)
    : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("governance_decisions")
    .select("decision_type, actor_user_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  } else {
    query = query.is("organization_id", null).eq("user_id", scope.userId);
  }

  const { data, error } = await query;
  if (error) return jsonDatabaseErrorResponse(requestId);

  const rows = (data ?? []) as Array<{
    decision_type: GovernanceDecisionType;
    actor_user_id: string;
    created_at: string;
  }>;

  const byType: Record<string, number> = {};
  const byActor = new Map<string, number>();
  const byDay = new Map<string, number>();

  for (const row of rows) {
    byType[row.decision_type] = (byType[row.decision_type] ?? 0) + 1;
    byActor.set(row.actor_user_id, (byActor.get(row.actor_user_id) ?? 0) + 1);
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  // Always emit a contiguous day series so charts align.
  const daySeries: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    daySeries.push({ date: d, count: byDay.get(d) ?? 0 });
  }

  // Resolve actor display names for top contributors.
  const topActorIds = Array.from(byActor.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  const actors: Record<string, { displayName: string | null }> = {};
  if (topActorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", topActorIds);
    if (Array.isArray(profiles)) {
      for (const p of profiles as Array<{ id: string; display_name: string | null }>) {
        actors[p.id] = { displayName: p.display_name };
      }
    }
  }

  const byActorList = topActorIds.map((id) => ({
    actorUserId: id,
    displayName: actors[id]?.displayName ?? null,
    count: byActor.get(id) ?? 0,
  }));

  const totals = {
    decisions: rows.length,
    fixes: byType.apply_fix ?? 0,
    acceptedRisks: byType.accept_risk ?? 0,
    approvals: (byType.approve_fix ?? 0) + (byType.reject_fix ?? 0),
    modeChanges: byType.mode_change ?? 0,
    interactiveResponses: byType.interactive_response ?? 0,
  };

  return attachRequestIdHeader(
    NextResponse.json({
      rangeDays: days,
      totals,
      byType,
      byDay: daySeries,
      byActor: byActorList,
    }),
    requestId
  );
}

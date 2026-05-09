/**
 * GET /api/automations/runs  — list recent playbook runs
 */
import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ runs: [] });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ runs: [] });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const playbookId = searchParams.get("playbook_id");
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  let query = supabase
    .from("playbook_runs")
    .select("id, playbook_id, triggered_by, trigger_ref, status, actions_total, actions_ok, log, started_at, finished_at, playbooks(name)")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (playbookId) {
    query = query.eq("playbook_id", playbookId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const runs = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    playbook_name: (r.playbooks as { name?: string } | null)?.name ?? null,
    playbooks: undefined,
  }));

  return NextResponse.json({ runs });
}

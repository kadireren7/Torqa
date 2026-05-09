/**
 * GET  /api/automations/playbooks   — list playbooks for the current user/org
 * POST /api/automations/playbooks   — create a new playbook
 */
import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ playbooks: [] });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ playbooks: [] });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("playbooks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ playbooks: data ?? [] });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available in offline mode" }, { status: 503 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (!b.name || typeof b.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!b.trigger || typeof b.trigger !== "object") {
    return NextResponse.json({ error: "trigger is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("playbooks")
    .insert({
      name: b.name,
      description: typeof b.description === "string" ? b.description : null,
      trigger: b.trigger,
      conditions: Array.isArray(b.conditions) ? b.conditions : [],
      actions: Array.isArray(b.actions) ? b.actions : [],
      enabled: b.enabled !== false,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ playbook: data }, { status: 201 });
}

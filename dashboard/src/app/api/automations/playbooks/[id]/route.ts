/**
 * GET    /api/automations/playbooks/[id]
 * PUT    /api/automations/playbooks/[id]
 * DELETE /api/automations/playbooks/[id]
 */
import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

async function getAuthed(id: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { supabase, user, playbook: data };
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await getAuthed(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ playbook: ctx.playbook });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await getAuthed(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.description === "string" || b.description === null) patch.description = b.description;
  if (b.trigger && typeof b.trigger === "object") patch.trigger = b.trigger;
  if (Array.isArray(b.conditions)) patch.conditions = b.conditions;
  if (Array.isArray(b.actions)) patch.actions = b.actions;
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;

  const { data, error } = await ctx.supabase
    .from("playbooks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ playbook: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await getAuthed(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await ctx.supabase
    .from("playbooks")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ ok: true });
}

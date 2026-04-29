import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlainObject } from "@/lib/json-guards";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_onboarding_progress")
    .select("wizard_completed_at,dismissed_checklist_at,steps_ack,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    wizardCompletedAt: data?.wizard_completed_at ?? null,
    dismissedChecklistAt: data?.dismissed_checklist_at ?? null,
    stepsAck: (data?.steps_ack && typeof data.steps_ack === "object" ? data.steps_ack : {}) as Record<
      string,
      unknown
    >,
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.wizardCompleted === true) {
    updates.wizard_completed_at = new Date().toISOString();
  }
  if (body.dismissChecklist === true) {
    updates.dismissed_checklist_at = new Date().toISOString();
  }
  if (body.stepsAck && typeof body.stepsAck === "object" && !Array.isArray(body.stepsAck)) {
    const { data: existing } = await supabase
      .from("user_onboarding_progress")
      .select("steps_ack")
      .eq("user_id", user.id)
      .maybeSingle();
    const prev =
      existing?.steps_ack && typeof existing.steps_ack === "object" && !Array.isArray(existing.steps_ack)
        ? (existing.steps_ack as Record<string, unknown>)
        : {};
    updates.steps_ack = { ...prev, ...(body.stepsAck as Record<string, unknown>) };
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("user_onboarding_progress")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;

  if (row) {
    const res = await supabase.from("user_onboarding_progress").update(updates).eq("user_id", user.id).select().single();
    data = res.data as Record<string, unknown> | null;
    error = res.error;
  } else {
    const res = await supabase
      .from("user_onboarding_progress")
      .insert({ user_id: user.id, ...updates })
      .select()
      .single();
    data = res.data as Record<string, unknown> | null;
    error = res.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    wizardCompletedAt: data?.wizard_completed_at ?? null,
    dismissedChecklistAt: data?.dismissed_checklist_at ?? null,
    stepsAck: data?.steps_ack ?? {},
    updatedAt: data?.updated_at ?? null,
  });
}

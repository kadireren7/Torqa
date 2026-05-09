/**
 * POST /api/marketplace/install/[id]   — Install a pack
 * DELETE /api/marketplace/install/[id] — Uninstall a pack
 */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available in offline mode" }, { status: 503 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check pack exists
  const { data: pack } = await supabase
    .from("marketplace_packs")
    .select("id, name, slug, pack_definition")
    .eq("id", id)
    .maybeSingle();

  if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  // Install (upsert)
  const { error } = await supabase.from("marketplace_installations").upsert({
    pack_id: id,
    user_id: user.id,
  }, { onConflict: "pack_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });

  // Increment download count (RPC may not exist yet — ignore error)
  await supabase.rpc("increment_pack_downloads", { pack_id: id }).then(
    () => {},
    () => {}
  );

  return NextResponse.json({ ok: true, pack: { id, name: pack.name, slug: pack.slug } });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available in offline mode" }, { status: 503 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("marketplace_installations")
    .delete()
    .eq("pack_id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

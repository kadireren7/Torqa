import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .from("organization_members")
    .select("role, organizations ( id, name, slug )")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workspaces = (data ?? [])
    .map((r: { role: string; organizations: unknown }) => {
      const o = r.organizations;
      const org = Array.isArray(o) ? o[0] : o;
      if (!org || typeof org !== "object" || Array.isArray(org)) return null;
      const rec = org as Record<string, unknown>;
      if (typeof rec.id !== "string" || typeof rec.name !== "string" || typeof rec.slug !== "string") return null;
      return { id: rec.id, name: rec.name, slug: rec.slug, role: r.role };
    })
    .filter((w): w is { id: string; name: string; slug: string; role: string } => w !== null);

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = body && typeof body === "object" && !Array.isArray(body) ? (body as { name?: unknown }).name : null;
  const slug = body && typeof body === "object" && !Array.isArray(body) ? (body as { slug?: unknown }).slug : null;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: 'Field "name" must be a non-empty string' }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug.trim()) {
    return NextResponse.json({ error: 'Field "slug" must be a non-empty string' }, { status: 400 });
  }

  const slugNorm = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  if (!slugNorm) {
    return NextResponse.json({ error: "Slug must contain letters or numbers" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_organization", {
    p_name: name.trim().slice(0, 200),
    p_slug: slugNorm,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const orgId = data as string;
  return NextResponse.json({ id: orgId });
}

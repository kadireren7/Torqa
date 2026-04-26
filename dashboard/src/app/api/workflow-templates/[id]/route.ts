import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type DbRowFull = {
  id: string;
  name: string;
  source: string;
  content: unknown;
  created_at: string;
  updated_at: string;
};

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

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
    .from("workflow_templates")
    .select("id, name, source, content, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = data as DbRowFull;
  if (!row.content || typeof row.content !== "object" || Array.isArray(row.content)) {
    return NextResponse.json({ error: "Invalid stored content" }, { status: 500 });
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    source: row.source,
    content: row.content as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }
  const name = (body as Record<string, unknown>).name;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: 'Field "name" must be a non-empty string' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workflow_templates")
    .update({
      name: name.trim().slice(0, 512),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, source, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = data as Omit<DbRowFull, "content">;
  return NextResponse.json({
    id: row.id,
    name: row.name,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

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

  const { data, error } = await supabase.from("workflow_templates").delete().eq("id", id).select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

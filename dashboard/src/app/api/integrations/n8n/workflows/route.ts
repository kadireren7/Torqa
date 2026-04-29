import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Authenticated proxy: Torqa dashboard → self-hosted n8n `GET /api/v1/workflows`.
 * Set `N8N_BASE_URL` and `N8N_API_KEY` on the server (read-only key recommended).
 */
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

  const base = process.env.N8N_BASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.N8N_API_KEY?.trim();
  if (!base || !key) {
    return NextResponse.json(
      { error: "N8N_BASE_URL and N8N_API_KEY must be set on the server to list workflows." },
      { status: 503 }
    );
  }

  const url = `${base}/api/v1/workflows`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
      signal: ac.signal,
    });
    if (!res.ok) {
      return NextResponse.json({ error: `n8n HTTP ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as unknown;
    return NextResponse.json({ workflows: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "n8n request failed" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}

/**
 * GET  /api/marketplace          — List all public packs (with install status)
 * POST /api/marketplace          — Publish a new pack (authenticated)
 */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.toLowerCase();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ packs: FALLBACK_PACKS });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ packs: FALLBACK_PACKS });

  let query = supabase
    .from("marketplace_packs")
    .select("*")
    .eq("is_public", true)
    .order("downloads", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data: packs } = await query.limit(50);

  // Get installed pack IDs for the current user
  const { data: { user } } = await supabase.auth.getUser();
  let installedIds = new Set<string>();
  if (user) {
    const { data: installs } = await supabase
      .from("marketplace_installations")
      .select("pack_id")
      .eq("user_id", user.id);
    installedIds = new Set((installs ?? []).map(i => i.pack_id as string));
  }

  let result = (packs ?? FALLBACK_PACKS).map(p => ({
    ...p,
    installed: installedIds.has(p.id),
  }));

  if (q) {
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.tags as string[]).some(t => t.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ packs: result });
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
  const required = ["slug", "name", "description", "pack_definition"];
  for (const f of required) {
    if (!b[f]) return NextResponse.json({ error: `${f} is required` }, { status: 400 });
  }

  const { data, error } = await supabase.from("marketplace_packs").insert({
    slug: b.slug,
    name: b.name,
    description: b.description,
    author: (b.author as string) ?? user.email?.split("@")[0] ?? "community",
    category: (b.category as string) ?? "general",
    rules_count: Array.isArray((b.pack_definition as Record<string, unknown>)?.rules)
      ? ((b.pack_definition as Record<string, unknown>).rules as unknown[]).length
      : 0,
    tags: Array.isArray(b.tags) ? b.tags : [],
    pack_definition: b.pack_definition,
    is_official: false,
    is_public: b.is_public !== false,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ pack: data }, { status: 201 });
}

// Fallback for offline mode
const FALLBACK_PACKS = [
  { id: "1", slug: "torqa-baseline", name: "Torqa Baseline", description: "Default governance pack.", author: "Torqa", category: "security", rules_count: 14, downloads: 8421, tags: ["credentials","webhooks"], is_official: true, installed: false },
  { id: "2", slug: "soc2-compliance", name: "SOC 2 Compliance", description: "SOC 2 Type II policy pack.", author: "Torqa", category: "compliance", rules_count: 22, downloads: 3812, tags: ["soc2","enterprise"], is_official: true, installed: false },
  { id: "3", slug: "ai-agent-safety", name: "AI Agent Safety", description: "Governance for autonomous AI agents.", author: "Torqa", category: "ai-agents", rules_count: 12, downloads: 6733, tags: ["ai-agents","safety"], is_official: true, installed: false },
  { id: "4", slug: "github-actions-strict", name: "GitHub Actions Strict", description: "Enforce secrets management in GitHub Actions.", author: "community", category: "ci-cd", rules_count: 9, downloads: 1547, tags: ["github","ci-cd"], is_official: false, installed: false },
  { id: "5", slug: "n8n-production-ready", name: "n8n Production Ready", description: "Comprehensive n8n ruleset for production.", author: "community", category: "general", rules_count: 16, downloads: 4290, tags: ["n8n","production"], is_official: false, installed: false },
  { id: "6", slug: "iso27001", name: "ISO 27001", description: "ISO/IEC 27001:2022 control mappings.", author: "Torqa", category: "compliance", rules_count: 19, downloads: 2104, tags: ["iso27001","audit"], is_official: true, installed: false },
];

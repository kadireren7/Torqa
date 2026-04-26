import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const countOnly = searchParams.get("count") === "1";

  if (countOnly) {
    const { count, error } = await supabase
      .from("in_app_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ unread: count ?? 0 });
  }

  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const [listRes, countRes] = await Promise.all([
    supabase
      .from("in_app_notifications")
      .select("id, title, body, severity, read_at, created_at, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("in_app_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message }, { status: 500 });
  }
  if (countRes.error) {
    return NextResponse.json({ error: countRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: listRes.data ?? [],
    unreadCount: countRes.count ?? 0,
  });
}

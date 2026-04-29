import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isScanApiSuccess } from "@/lib/scan-api-guards";
import { generateScanReportPdfBuffer } from "@/lib/pdf/scan-report-pdf";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_request: Request, ctx: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await ctx.params;

  if (!isUuid(scanId)) {
    return NextResponse.json({ error: "Invalid scan id" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
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

  const { data: row, error } = await supabase.from("scan_history").select("*").eq("id", scanId).maybeSingle();

  if (error) {
    console.error("[pdf] scan_history select error:", error.message);
    return NextResponse.json({ error: "Failed to load scan" }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = row.result;
  if (!isScanApiSuccess(result)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orgId = typeof row.organization_id === "string" ? row.organization_id : null;
  if (orgId) {
    const { data: membership, error: memErr } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memErr || !membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const owner = typeof row.user_id === "string" ? row.user_id : null;
    if (owner && owner !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const buf = await generateScanReportPdfBuffer({
      reportIdLabel: scanId,
      workflowName: typeof row.workflow_name === "string" ? row.workflow_name : null,
      source: typeof row.source === "string" ? row.source : result.source,
      createdAt: typeof row.created_at === "string" ? row.created_at : String(row.created_at ?? ""),
      result,
    });

    const filename = `torqa-scan-report-${scanId}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[pdf] generation failed:", e);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

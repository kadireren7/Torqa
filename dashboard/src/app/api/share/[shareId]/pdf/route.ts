import { NextResponse } from "next/server";
import { fetchSharedScanByShareId, isSharedScanFetchConfigured, isValidShareId } from "@/lib/share-scan";
import { generateScanReportPdfBuffer } from "@/lib/pdf/scan-report-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await ctx.params;

  if (!isValidShareId(shareId)) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  if (!isSharedScanFetchConfigured()) {
    return NextResponse.json({ error: "Share PDF is not configured" }, { status: 503 });
  }

  const payload = await fetchSharedScanByShareId(shareId);
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await generateScanReportPdfBuffer({
      reportIdLabel: shareId,
      workflowName: payload.workflow_name,
      source: payload.source,
      createdAt: payload.created_at,
      result: payload.result,
    });

    const filename = `torqa-scan-report-${shareId}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    console.error("[pdf] share generation failed:", e);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

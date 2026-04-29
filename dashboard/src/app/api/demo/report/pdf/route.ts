import { NextResponse } from "next/server";
import { demoScanReport } from "@/lib/demo-report";
import { generateScanReportPdfBuffer } from "@/lib/pdf/scan-report-pdf";

export const runtime = "nodejs";

export async function GET() {
  try {
    const buf = await generateScanReportPdfBuffer({
      reportIdLabel: "demo-report",
      workflowName: "Customer support escalation workflow (demo)",
      source: demoScanReport.source,
      createdAt: new Date().toISOString(),
      result: demoScanReport,
    });
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="torqa-demo-report.pdf"',
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("[pdf] demo report generation failed:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

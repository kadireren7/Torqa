import { describe, expect, it } from "vitest";
import { buildScanApiResult } from "@/lib/scan-engine";
import { generateScanReportPdfBuffer } from "@/lib/pdf/scan-report-pdf";

describe("generateScanReportPdfBuffer", () => {
  it("produces a valid PDF magic header and non-trivial size", async () => {
    const result = buildScanApiResult({ nodes: [], connections: {} }, "n8n");
    const buf = await generateScanReportPdfBuffer({
      reportIdLabel: "550e8400-e29b-41d4-a716-446655440000",
      workflowName: "Unit test workflow",
      source: "n8n",
      createdAt: "2026-01-15T12:00:00.000Z",
      result,
    });
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(500);
    // Body text is Flate-compressed; metadata Title object still embeds "Torqa scan" in clear text in most builds.
    expect(buf.toString("latin1")).toMatch(/Torqa/);
  });
});

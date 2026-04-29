import { describe, expect, it, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  fetchShared: vi.fn(),
  genPdf: vi.fn(),
}));

vi.mock("@/lib/share-scan", () => ({
  isSharedScanFetchConfigured: () => true,
  isValidShareId: (id: string) => /^tq_[a-f0-9]{48}$/.test(id),
  fetchSharedScanByShareId: hoisted.fetchShared,
}));

vi.mock("@/lib/pdf/scan-report-pdf", () => ({
  generateScanReportPdfBuffer: hoisted.genPdf,
}));

import { buildScanApiResult } from "@/lib/scan-engine";
import { GET } from "@/app/api/share/[shareId]/pdf/route";

const SHARE_ID = "tq_" + "a".repeat(48);

describe("GET /api/share/[shareId]/pdf", () => {
  beforeEach(() => {
    hoisted.fetchShared.mockReset();
    hoisted.genPdf.mockReset();
    hoisted.genPdf.mockResolvedValue(Buffer.from("%PDF-1.4\n"));
  });

  it("returns 404 when share token invalid", async () => {
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ shareId: "not-a-token" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when share payload missing", async () => {
    hoisted.fetchShared.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ shareId: SHARE_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 PDF when share valid", async () => {
    const result = buildScanApiResult({ y: 2 }, "generic");
    hoisted.fetchShared.mockResolvedValue({
      result,
      source: "generic",
      workflow_name: "Shared wf",
      created_at: "2026-02-01T00:00:00Z",
    });
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ shareId: SHARE_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });
});

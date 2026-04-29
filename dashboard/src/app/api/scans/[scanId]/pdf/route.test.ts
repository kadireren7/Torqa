import { describe, expect, it, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  genPdf: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: hoisted.getUser },
    from: hoisted.from,
  })),
}));

vi.mock("@/lib/pdf/scan-report-pdf", () => ({
  generateScanReportPdfBuffer: hoisted.genPdf,
}));

import { buildScanApiResult } from "@/lib/scan-engine";
import { GET } from "@/app/api/scans/[scanId]/pdf/route";

const SCAN_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /api/scans/[scanId]/pdf", () => {
  beforeEach(() => {
    hoisted.getUser.mockReset();
    hoisted.from.mockReset();
    hoisted.genPdf.mockReset();
    hoisted.genPdf.mockResolvedValue(Buffer.from("%PDF-1.4\n"));
  });

  it("returns 401 when unauthenticated", async () => {
    hoisted.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/scans/x/pdf"), {
      params: Promise.resolve({ scanId: SCAN_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when scan row missing", async () => {
    hoisted.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    hoisted.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    });
    const res = await GET(new Request("http://localhost/api/scans/x/pdf"), {
      params: Promise.resolve({ scanId: SCAN_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 PDF for personal scan owner", async () => {
    hoisted.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const result = buildScanApiResult({ x: 1 }, "generic");
    hoisted.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: SCAN_ID,
              workflow_name: "Demo",
              source: "generic",
              created_at: "2026-01-01T00:00:00Z",
              organization_id: null,
              user_id: "user-1",
              result,
            },
            error: null,
          }),
        }),
      }),
    });
    const res = await GET(new Request("http://localhost/api/scans/x/pdf"), {
      params: Promise.resolve({ scanId: SCAN_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("torqa-scan-report-");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });
});

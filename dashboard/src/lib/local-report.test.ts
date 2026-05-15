import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateReportId,
  saveReport,
  loadReport,
  listReports,
  deleteReport,
} from "./local-report";

const REPORT_PREFIX = "torqa:report:";
const REPORT_INDEX_KEY = "torqa:report:index";

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => { store.set(key, value); },
    removeItem: (key: string): void => { store.delete(key); },
    clear: (): void => { store.clear(); },
    get length(): number { return store.size; },
    key: (index: number): string | null => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
    // expose store for testing
    _store: store,
  };
}

describe("local-report", () => {
  let mockStorage: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockStorage = createLocalStorageMock();
    if (typeof window === "undefined") {
      vi.stubGlobal("window", { localStorage: mockStorage });
    } else {
      vi.stubGlobal("window", { ...window, localStorage: mockStorage });
    }
    vi.stubGlobal("localStorage", mockStorage);
  });

  describe("generateReportId", () => {
    it("produces 8-char alphanumeric strings", () => {
      const id = generateReportId();
      expect(id).toHaveLength(8);
      expect(id).toMatch(/^[a-z0-9]{8}$/);
    });

    it("produces unique IDs", () => {
      const ids = new Set(Array.from({ length: 20 }, () => generateReportId()));
      expect(ids.size).toBe(20);
    });
  });

  describe("saveReport and loadReport (round-trip)", () => {
    it("preserves all fields", () => {
      const data = {
        source: "mcp",
        scanResult: { status: "FAIL", riskScore: 22 },
        originalConfig: { tools: [] },
      };
      const id = saveReport(data);
      const loaded = loadReport(id);
      expect(loaded).not.toBeNull();
      expect(loaded!.reportId).toBe(id);
      expect(loaded!.source).toBe("mcp");
      expect(loaded!.scanResult).toEqual({ status: "FAIL", riskScore: 22 });
      expect(loaded!.originalConfig).toEqual({ tools: [] });
      expect(loaded!.appVersion).toBe("0.5.0");
      expect(typeof loaded!.createdAt).toBe("string");
    });

    it("sets createdAt as valid ISO date string", () => {
      const id = saveReport({ source: "n8n", scanResult: {} });
      const loaded = loadReport(id);
      expect(loaded).not.toBeNull();
      const d = new Date(loaded!.createdAt);
      expect(d.getTime()).not.toBeNaN();
    });
  });

  describe("loadReport error cases", () => {
    it("returns null for unknown ID", () => {
      expect(loadReport("nonexist")).toBeNull();
    });

    it("returns null for malformed JSON", () => {
      mockStorage.setItem(`${REPORT_PREFIX}badid`, "not-json{{{");
      expect(loadReport("badid")).toBeNull();
    });

    it("returns null for missing required fields", () => {
      mockStorage.setItem(
        `${REPORT_PREFIX}partial`,
        JSON.stringify({ reportId: "partial", createdAt: "2024-01-01" })
      );
      expect(loadReport("partial")).toBeNull();
    });

    it("returns null for array JSON", () => {
      mockStorage.setItem(`${REPORT_PREFIX}arr`, JSON.stringify([1, 2, 3]));
      expect(loadReport("arr")).toBeNull();
    });
  });

  describe("max 50 reports", () => {
    it("enforces max 50 reports when saving the 51st", () => {
      for (let i = 0; i < 51; i++) {
        saveReport({ source: "mcp", scanResult: { index: i } });
      }
      const ids = listReports();
      expect(ids.length).toBe(50);
    });

    it("drops the oldest report when exceeding max", () => {
      const firstId = saveReport({ source: "mcp", scanResult: { first: true } });
      for (let i = 0; i < 50; i++) {
        saveReport({ source: "mcp", scanResult: { index: i } });
      }
      const ids = listReports();
      expect(ids).not.toContain(firstId);
      expect(loadReport(firstId)).toBeNull();
    });
  });

  describe("listReports", () => {
    it("returns empty array when no reports", () => {
      expect(listReports()).toEqual([]);
    });

    it("returns most recent first", () => {
      const id1 = saveReport({ source: "n8n", scanResult: { i: 1 } });
      const id2 = saveReport({ source: "mcp", scanResult: { i: 2 } });
      const id3 = saveReport({ source: "generic", scanResult: { i: 3 } });
      const ids = listReports();
      expect(ids[0]).toBe(id3);
      expect(ids[1]).toBe(id2);
      expect(ids[2]).toBe(id1);
    });
  });

  describe("deleteReport", () => {
    it("removes only the target report", () => {
      const id1 = saveReport({ source: "n8n", scanResult: {} });
      const id2 = saveReport({ source: "mcp", scanResult: {} });
      deleteReport(id1);
      expect(loadReport(id1)).toBeNull();
      expect(loadReport(id2)).not.toBeNull();
      const ids = listReports();
      expect(ids).not.toContain(id1);
      expect(ids).toContain(id2);
    });

    it("is a no-op for unknown ID", () => {
      const id = saveReport({ source: "mcp", scanResult: {} });
      deleteReport("nonexistent");
      expect(loadReport(id)).not.toBeNull();
    });
  });

  describe("index integrity", () => {
    it("handles malformed index gracefully", () => {
      mockStorage.setItem(REPORT_INDEX_KEY, "not-json");
      // Should not throw when listing
      expect(() => listReports()).not.toThrow();
      expect(listReports()).toEqual([]);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getUsageState,
  saveUsageState,
  canUseFeature,
  incrementUsage,
  getRemainingUsage,
  resetUsage,
  DAILY_LIMITS,
  USAGE_KEY,
  todayString,
} from "./usage-limits";

// Simple in-memory localStorage mock
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
  };
}

describe("usage-limits", () => {
  let mockStorage: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockStorage = createLocalStorageMock();
    vi.stubGlobal("localStorage", mockStorage);
    // Ensure window is defined
    if (typeof window === "undefined") {
      vi.stubGlobal("window", { localStorage: mockStorage });
    } else {
      vi.stubGlobal("window", { ...window, localStorage: mockStorage });
    }
  });

  describe("todayString", () => {
    it("returns YYYY-MM-DD format", () => {
      const s = todayString();
      expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("scan limit (3/day)", () => {
    it("allows first 3 scans", () => {
      expect(canUseFeature("scan")).toBe(true);
      incrementUsage("scan");
      expect(canUseFeature("scan")).toBe(true);
      incrementUsage("scan");
      expect(canUseFeature("scan")).toBe(true);
      incrementUsage("scan");
    });

    it("blocks the 4th scan", () => {
      incrementUsage("scan");
      incrementUsage("scan");
      incrementUsage("scan");
      expect(canUseFeature("scan")).toBe(false);
    });
  });

  describe("hardening limit (1/day)", () => {
    it("allows 1 hardening", () => {
      expect(canUseFeature("hardening")).toBe(true);
      incrementUsage("hardening");
    });

    it("blocks the 2nd hardening", () => {
      incrementUsage("hardening");
      expect(canUseFeature("hardening")).toBe(false);
    });
  });

  describe("report limit (3/day)", () => {
    it("allows 3 report saves", () => {
      expect(canUseFeature("report")).toBe(true);
      incrementUsage("report");
      expect(canUseFeature("report")).toBe(true);
      incrementUsage("report");
      expect(canUseFeature("report")).toBe(true);
      incrementUsage("report");
    });

    it("blocks the 4th report save", () => {
      incrementUsage("report");
      incrementUsage("report");
      incrementUsage("report");
      expect(canUseFeature("report")).toBe(false);
    });
  });

  describe("daily reset", () => {
    it("resets counts when stored date is yesterday", () => {
      const yesterday = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      })();

      const staleState = { date: yesterday, scan: 3, hardening: 1, report: 3 };
      mockStorage.setItem(USAGE_KEY, JSON.stringify(staleState));

      const state = getUsageState();
      expect(state.date).toBe(todayString());
      expect(state.scan).toBe(0);
      expect(state.hardening).toBe(0);
      expect(state.report).toBe(0);
    });
  });

  describe("malformed localStorage", () => {
    it("recovers gracefully from non-JSON value", () => {
      mockStorage.setItem(USAGE_KEY, "not-valid-json!!!");
      const state = getUsageState();
      expect(state.scan).toBe(0);
      expect(state.hardening).toBe(0);
      expect(state.report).toBe(0);
      expect(state.date).toBe(todayString());
    });

    it("recovers from wrong-typed object", () => {
      mockStorage.setItem(USAGE_KEY, JSON.stringify({ date: 123, scan: "bad" }));
      const state = getUsageState();
      expect(state.scan).toBe(0);
    });

    it("recovers from null value", () => {
      mockStorage.setItem(USAGE_KEY, "null");
      const state = getUsageState();
      expect(state.scan).toBe(0);
    });
  });

  describe("getRemainingUsage", () => {
    it("returns full limit when no usage", () => {
      expect(getRemainingUsage("scan")).toBe(DAILY_LIMITS.scan);
      expect(getRemainingUsage("hardening")).toBe(DAILY_LIMITS.hardening);
      expect(getRemainingUsage("report")).toBe(DAILY_LIMITS.report);
    });

    it("decrements correctly", () => {
      incrementUsage("scan");
      expect(getRemainingUsage("scan")).toBe(DAILY_LIMITS.scan - 1);
      incrementUsage("scan");
      expect(getRemainingUsage("scan")).toBe(DAILY_LIMITS.scan - 2);
    });

    it("never returns below 0", () => {
      // Manually set past limit
      const state = { date: todayString(), scan: 100, hardening: 100, report: 100 };
      saveUsageState(state);
      expect(getRemainingUsage("scan")).toBe(0);
    });
  });

  describe("incrementUsage", () => {
    it("returns updated state with incremented count", () => {
      const before = getUsageState();
      const after = incrementUsage("scan");
      expect(after.scan).toBe(before.scan + 1);
    });

    it("persists the increment", () => {
      incrementUsage("report");
      const state = getUsageState();
      expect(state.report).toBe(1);
    });
  });

  describe("resetUsage", () => {
    it("removes all usage data", () => {
      incrementUsage("scan");
      incrementUsage("hardening");
      resetUsage();
      const state = getUsageState();
      expect(state.scan).toBe(0);
      expect(state.hardening).toBe(0);
      expect(state.report).toBe(0);
    });
  });
});

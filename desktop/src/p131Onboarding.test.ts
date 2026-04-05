import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dismissP131Hint,
  loadP131,
  markP131Milestone,
  P131_HINT_WELCOME_HOME,
  shouldShowHint,
} from "./p131Onboarding";

function attachMemoryLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true, writable: true });
}

beforeEach(() => {
  attachMemoryLocalStorage();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("p131Onboarding", () => {
  it("defaults empty milestones and no dismissals", () => {
    const s = loadP131();
    expect(s.folder).toBe(false);
    expect(s.buildOk).toBe(false);
    expect(s.preview).toBe(false);
    expect(s.compare).toBe(false);
    expect(s.dismissed).toEqual([]);
  });

  it("marks folder idempotently in storage", () => {
    const a = markP131Milestone("folder");
    expect(a.folder).toBe(true);
    const b = markP131Milestone("folder");
    expect(b.folder).toBe(true);
    expect(loadP131().folder).toBe(true);
  });

  it("dismissHint hides shouldShowHint", () => {
    dismissP131Hint(P131_HINT_WELCOME_HOME);
    const snap = loadP131();
    expect(shouldShowHint(snap, P131_HINT_WELCOME_HOME, true)).toBe(false);
    expect(shouldShowHint(snap, P131_HINT_WELCOME_HOME, false)).toBe(false);
  });
});

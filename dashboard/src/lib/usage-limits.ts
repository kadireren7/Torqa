// Local-first daily usage limits (localStorage-based, no auth)
// Kinds: "scan" | "hardening" | "report"
// Limits: scan=3/day, hardening=1/day, report=3/day (saves, not scans)
// Reset: daily based on local date (stored as YYYY-MM-DD)

export type UsageKind = "scan" | "hardening" | "report";

export type UsageState = {
  date: string; // YYYY-MM-DD
  scan: number;
  hardening: number;
  report: number;
};

export const DAILY_LIMITS: Record<UsageKind, number> = {
  scan: 3,
  hardening: 1,
  report: 3,
};

// Key used in localStorage
export const USAGE_KEY = "torqa:usage";

// Returns today's date as YYYY-MM-DD (local time)
export function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultState(): UsageState {
  return { date: todayString(), scan: 0, hardening: 0, report: 0 };
}

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__torqa_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Load usage state from localStorage, reset if stale date, return defaults if missing/invalid
export function getUsageState(): UsageState {
  if (!isLocalStorageAvailable()) return defaultState();
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return defaultState();
    }
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.date !== "string" ||
      typeof obj.scan !== "number" ||
      typeof obj.hardening !== "number" ||
      typeof obj.report !== "number"
    ) {
      return defaultState();
    }
    const today = todayString();
    if (obj.date !== today) {
      // Stale date — reset counts
      return { date: today, scan: 0, hardening: 0, report: 0 };
    }
    return {
      date: obj.date,
      scan: obj.scan,
      hardening: obj.hardening,
      report: obj.report,
    };
  } catch {
    return defaultState();
  }
}

// Save usage state to localStorage
export function saveUsageState(state: UsageState): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(USAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write errors (e.g. storage quota exceeded)
  }
}

// Check if user can perform action (has not reached today's limit)
export function canUseFeature(kind: UsageKind): boolean {
  const state = getUsageState();
  return state[kind] < DAILY_LIMITS[kind];
}

// Increment usage counter for kind. Returns new state.
export function incrementUsage(kind: UsageKind): UsageState {
  const state = getUsageState();
  const updated: UsageState = { ...state, [kind]: state[kind] + 1 };
  saveUsageState(updated);
  return updated;
}

// Get remaining uses for kind today
export function getRemainingUsage(kind: UsageKind): number {
  const state = getUsageState();
  return Math.max(0, DAILY_LIMITS[kind] - state[kind]);
}

// Reset all usage counts (for dev/debug)
export function resetUsage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(USAGE_KEY);
  } catch {
    // Ignore
  }
}

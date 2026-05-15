// Local report storage using localStorage
// torqa:report:{id} — stores report JSON
// torqa:report:index — stores array of report IDs (max 50)

export type LocalReport = {
  reportId: string;
  createdAt: string;
  source: string; // "mcp" | "n8n" | etc.
  scanResult: unknown;
  originalConfig?: unknown;
  appVersion: string; // "0.5.0"
};

const REPORT_PREFIX = "torqa:report:";
const REPORT_INDEX_KEY = "torqa:report:index";
const MAX_REPORTS = 50;
const APP_VERSION = "0.5.0";

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__torqa_report_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Generate a short ID (8 alphanumeric chars)
export function generateReportId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  // Use crypto.getRandomValues if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      id += chars[b % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return id;
}

function getIndex(): string[] {
  if (!isLocalStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(REPORT_INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function saveIndex(ids: string[]): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(REPORT_INDEX_KEY, JSON.stringify(ids));
  } catch {
    // Ignore write errors
  }
}

// Save report to localStorage. Returns reportId. Enforces max 50 reports (drops oldest).
export function saveReport(
  data: Omit<LocalReport, "reportId" | "createdAt" | "appVersion">
): string {
  const reportId = generateReportId();
  const report: LocalReport = {
    reportId,
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    ...data,
  };

  if (!isLocalStorageAvailable()) return reportId;

  try {
    window.localStorage.setItem(
      `${REPORT_PREFIX}${reportId}`,
      JSON.stringify(report)
    );
  } catch {
    return reportId;
  }

  // Update index (prepend new ID, enforce max)
  let ids = getIndex();
  ids = [reportId, ...ids.filter((id) => id !== reportId)];
  if (ids.length > MAX_REPORTS) {
    // Drop oldest (last entries)
    const toRemove = ids.slice(MAX_REPORTS);
    for (const id of toRemove) {
      try {
        window.localStorage.removeItem(`${REPORT_PREFIX}${id}`);
      } catch {
        // Ignore
      }
    }
    ids = ids.slice(0, MAX_REPORTS);
  }
  saveIndex(ids);

  return reportId;
}

function isValidReport(obj: Record<string, unknown>): obj is LocalReport {
  return (
    typeof obj.reportId === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.source === "string" &&
    "scanResult" in obj
  );
}

// Load report by ID. Returns null if not found or invalid.
export function loadReport(id: string): LocalReport | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(`${REPORT_PREFIX}${id}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (!isValidReport(obj)) return null;
    return obj as LocalReport;
  } catch {
    return null;
  }
}

// List all saved report IDs (most recent first)
export function listReports(): string[] {
  return getIndex();
}

// Delete a specific report
export function deleteReport(id: string): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(`${REPORT_PREFIX}${id}`);
  } catch {
    // Ignore
  }
  const ids = getIndex().filter((v) => v !== id);
  saveIndex(ids);
}

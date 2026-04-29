import type { ScanApiSuccess } from "@/lib/scan-engine";

/** Prioritized guidance lines (same logic as the scan report UI). */
export function buildScanRecommendations(result: ScanApiSuccess): string[] {
  const lines: string[] = [];
  if (result.status === "FAIL") {
    lines.push("Resolve all critical findings before production handoff.");
  } else if (result.status === "NEEDS REVIEW") {
    lines.push("Schedule a security review for flagged workflow nodes.");
  } else {
    lines.push("No blocking issues under current preview rules — keep running CLI validation for full coverage.");
  }
  const fixes = result.findings.map((f) => f.suggested_fix.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const f of fixes) {
    if (seen.has(f) || lines.length >= 8) break;
    seen.add(f);
    lines.push(f);
  }
  if (result.source === "n8n") {
    lines.push("Prefer least-privilege credentials and explicit HTTP error paths for n8n exports.");
  } else {
    lines.push("For richer checks on workflow exports, re-run with source set to n8n when applicable.");
  }
  return lines.slice(0, 8);
}

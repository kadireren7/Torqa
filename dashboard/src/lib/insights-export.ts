import type { InsightsPayload } from "@/lib/insights-types";

function escCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV snapshot: meta, totals, top rules/workflows, policy outcomes, member stats. */
export function buildInsightsCsvSnapshot(data: InsightsPayload): string {
  const rows: string[][] = [];
  rows.push(["section", "field", "value"]);
  rows.push(["meta", "mode", data.mode]);
  rows.push(["meta", "scope", data.scope]);
  rows.push(["meta", "days", String(data.days)]);
  rows.push(["meta", "statusFilter", data.status]);
  rows.push(["meta", "policyGateFilter", data.policyGate]);
  rows.push(["totals", "totalScans", String(data.totals.totalScans)]);
  rows.push(["totals", "criticalFindingsCaught", String(data.totals.criticalFindingsCaught)]);
  rows.push(["totals", "governanceFailures", String(data.totals.governanceFailures)]);
  rows.push(["totals", "avgTrustScore", data.totals.avgTrustScore === null ? "" : String(data.totals.avgTrustScore)]);
  rows.push([
    "totals",
    "policyFailureRatePct",
    data.totals.policyFailureRate === null ? "" : String(data.totals.policyFailureRate),
  ]);
  rows.push(["totals", "riskTrendDirection", data.totals.riskTrendDirection]);

  for (const r of data.topRules) {
    rows.push(["topRule", r.ruleId, String(r.count)]);
  }
  for (const w of data.topWorkflows) {
    rows.push([
      "topWorkflow",
      w.name,
      `scanCount=${w.scanCount};avgTrust=${w.avgTrust};engineFailRate=${w.engineFailRate}`,
    ]);
  }
  for (const p of data.policyOutcomes) {
    rows.push(["policyOutcome", p.policyName, `pass=${p.pass};warn=${p.warn};fail=${p.fail}`]);
  }
  for (const m of data.memberStats) {
    rows.push([
      "member",
      m.email ?? m.userId,
      `scanCount=${m.scanCount};criticalFindings=${m.criticalFindings};governanceFails=${m.governanceFails}`,
    ]);
  }

  return rows.map((r) => r.map(escCell).join(",")).join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

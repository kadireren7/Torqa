import { TORQA_PR_MAX_FILE_BYTES } from "@/lib/github-pr/constants";
import type { PrFileScanRow, PrScanAggregate } from "@/lib/github-pr/types";
import { githubFetchRepoFileUtf8 } from "@/lib/github-pr/github-rest-client";
import { isLikelyN8nExport, runScanAnalysis, type ScanDecision, type ScanFinding, type ScanSource } from "@/lib/scan-engine";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function worstDecision(a: ScanDecision, b: ScanDecision): ScanDecision {
  const rank = (d: ScanDecision) => (d === "FAIL" ? 0 : d === "NEEDS REVIEW" ? 1 : 2);
  return rank(a) <= rank(b) ? a : b;
}

function pickSourceForJson(parsed: Record<string, unknown>, path: string): ScanSource {
  const lower = path.toLowerCase();
  if (lower.includes("n8n") || isLikelyN8nExport(parsed)) return "n8n";
  return "generic";
}

export function scanRawFileContent(path: string, text: string): Omit<PrFileScanRow, "path"> {
  if (path.endsWith(".tq")) {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (isPlainObject(parsed)) {
          const source = pickSourceForJson(parsed, path);
          const r = runScanAnalysis(parsed, source);
          return { source, decision: r.decision, riskScore: r.riskScore, findings: r.findings };
        }
      } catch {
        /* fall through to surface wrapper */
      }
    }
    const wrapped = { __torqa_tq_surface: text.slice(0, TORQA_PR_MAX_FILE_BYTES) };
    const r = runScanAnalysis(wrapped, "generic");
    return { source: "generic", decision: r.decision, riskScore: r.riskScore, findings: r.findings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "invalid_json" };
  }
  if (!isPlainObject(parsed)) {
    return { error: "json_root_not_object" };
  }
  const source = pickSourceForJson(parsed, path);
  const r = runScanAnalysis(parsed, source);
  return { source, decision: r.decision, riskScore: r.riskScore, findings: r.findings };
}

export function aggregateRows(rows: PrFileScanRow[]): PrScanAggregate {
  let overallStatus: ScanDecision = "PASS";
  let overallRisk = 100;
  let criticalHighCount = 0;
  const allFindings: ScanFinding[] = [];

  for (const row of rows) {
    if (row.skipped || row.error || row.decision === undefined || row.riskScore === undefined || !row.findings) {
      continue;
    }
    overallStatus = worstDecision(overallStatus, row.decision);
    overallRisk = Math.min(overallRisk, row.riskScore);
    for (const f of row.findings) {
      if (f.severity === "critical" || f.severity === "high") criticalHighCount += 1;
      allFindings.push({ ...f, rule_id: `${row.path}: ${f.rule_id}` });
    }
  }

  const severityOrder = (s: ScanFinding["severity"]) =>
    s === "critical" ? 0 : s === "high" ? 1 : s === "review" ? 2 : 3;
  allFindings.sort((a, b) => {
    const d = severityOrder(a.severity) - severityOrder(b.severity);
    if (d !== 0) return d;
    return a.rule_id.localeCompare(b.rule_id);
  });
  const topFindings = allFindings.slice(0, 5);

  return { files: rows, overallStatus, overallRisk, criticalHighCount, topFindings };
}

export async function scanPrFilesFromGithub(
  token: string,
  owner: string,
  repo: string,
  headSha: string,
  paths: string[],
  maxFiles: number,
  maxBytes: number
): Promise<PrFileScanRow[]> {
  const rows: PrFileScanRow[] = [];
  const slice = paths.slice(0, maxFiles);
  for (const path of slice) {
    try {
      const { text, skipped } = await githubFetchRepoFileUtf8(token, owner, repo, path, headSha, maxBytes);
      if (skipped) {
        rows.push({ path, skipped });
        continue;
      }
      rows.push({ path, ...scanRawFileContent(path, text) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rows.push({ path, error: msg.slice(0, 240) });
    }
  }
  return rows;
}

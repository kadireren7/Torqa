import { TORQA_PR_COMMENT_MARKER } from "@/lib/github-pr/constants";
import type { PrScanAggregate } from "@/lib/github-pr/types";

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/**
 * Build the sticky PR comment body (markdown).
 */
export function buildPrScanCommentMarkdown(
  aggregate: PrScanAggregate,
  opts: { owner: string; repo: string; prNumber: number; dashboardBaseUrl: string | null }
): string {
  const { owner, repo, prNumber, dashboardBaseUrl } = opts;
  const lines: string[] = [];
  lines.push(TORQA_PR_COMMENT_MARKER);
  lines.push("### Torqa — PR workflow scan");
  lines.push("");
  lines.push(`**Repository:** \`${owner}/${repo}\`  **PR:** #${prNumber}`);
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| **Status** | **${aggregate.overallStatus}** |`);
  lines.push(`| **Risk score** | ${aggregate.overallRisk} / 100 |`);
  lines.push(`| **Critical + high findings** | ${aggregate.criticalHighCount} |`);
  lines.push("");

  const scanned = aggregate.files.filter((f) => !f.skipped && !f.error);
  const skipped = aggregate.files.filter((f) => f.skipped || f.error);
  lines.push(`**Files scanned:** ${scanned.length}  ·  **Skipped / errors:** ${skipped.length}`);
  if (skipped.length) {
    lines.push("");
    lines.push("<details><summary>Skipped paths</summary>");
    lines.push("");
    for (const s of skipped.slice(0, 20)) {
      const reason = s.skipped ?? s.error ?? "unknown";
      lines.push(`- \`${s.path}\` — ${escapeMd(reason)}`);
    }
    if (skipped.length > 20) lines.push(`- … +${skipped.length - 20} more`);
    lines.push("");
    lines.push("</details>");
  }

  lines.push("");
  lines.push("#### Top findings");
  lines.push("");
  if (aggregate.topFindings.length === 0) {
    lines.push("_No critical/high/review findings aggregated across scanned files._");
  } else {
    for (let i = 0; i < aggregate.topFindings.length; i += 1) {
      const f = aggregate.topFindings[i];
      lines.push(`${i + 1}. **${f.severity.toUpperCase()}** — \`${escapeMd(f.rule_id)}\`  `);
      lines.push(`   - ${escapeMd(f.explanation)}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "_Heuristic scan (dashboard engine preview). For full IR/policy gates run `torqa validate` in CI._"
  );
  if (dashboardBaseUrl) {
    const base = dashboardBaseUrl.replace(/\/$/, "");
    lines.push("");
    lines.push(`**Dashboard:** [Open scan workspace](${base}/scan)`);
  }

  return lines.join("\n");
}

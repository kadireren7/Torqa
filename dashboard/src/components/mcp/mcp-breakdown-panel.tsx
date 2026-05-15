"use client";

import { RefreshCcw, Shield, WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanApiSuccess, ScanDecision, ScanFinding } from "@/lib/scan-engine";
import { cn } from "@/lib/utils";

// ─── Score breakdown ───────────────────────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<ScanFinding["severity"], number> = {
  critical: 20,
  high: 20,
  review: 8,
  info: 2,
};

function ScoreBreakdown({ findings }: { findings: ScanFinding[] }) {
  const criticals = findings.filter((f) => f.severity === "critical");
  const highs = findings.filter((f) => f.severity === "high");
  const reviews = findings.filter((f) => f.severity === "review");
  const infos = findings.filter((f) => f.severity === "info");

  const rows: { label: string; count: number; deduction: number; color: string }[] = [];
  if (criticals.length > 0)
    rows.push({ label: "Critical", count: criticals.length, deduction: criticals.length * SEVERITY_WEIGHTS.critical, color: "text-rose-300" });
  if (highs.length > 0)
    rows.push({ label: "High", count: highs.length, deduction: highs.length * SEVERITY_WEIGHTS.high, color: "text-rose-300" });
  if (reviews.length > 0)
    rows.push({ label: "Review", count: reviews.length, deduction: reviews.length * SEVERITY_WEIGHTS.review, color: "text-amber-300" });
  if (infos.length > 0)
    rows.push({ label: "Info", count: infos.length, deduction: infos.length * SEVERITY_WEIGHTS.info, color: "text-slate-400" });

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score breakdown</p>
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Base score</span>
          <span className="font-mono font-semibold text-foreground">100</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className={cn("flex justify-between text-[11px]", r.color)}>
            <span>
              {r.count} × {r.label} (−{r.deduction / r.count})
            </span>
            <span className="font-mono font-semibold">−{r.deduction}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Category breakdown ────────────────────────────────────────────────────────

function categoryLabel(ruleId: string): string {
  const part = ruleId.replace("mcp.", "").replace(/_/g, " ");
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function CategoryBreakdown({ findings }: { findings: ScanFinding[] }) {
  const categories = new Map<string, { count: number; worst: ScanFinding["severity"] }>();
  const order: ScanFinding["severity"][] = ["critical", "high", "review", "info"];

  for (const f of findings) {
    const cat = f.rule_id;
    const existing = categories.get(cat);
    if (!existing) {
      categories.set(cat, { count: 1, worst: f.severity });
    } else {
      const worstIdx = Math.min(order.indexOf(existing.worst), order.indexOf(f.severity));
      categories.set(cat, { count: existing.count + 1, worst: order[worstIdx] });
    }
  }

  if (categories.size === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">By category</p>
      <div className="space-y-1">
        {Array.from(categories.entries()).map(([ruleId, { count, worst }]) => (
          <div key={ruleId} className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">{categoryLabel(ruleId)}</span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                worst === "critical" || worst === "high"
                  ? "bg-rose-500/15 text-rose-300"
                  : worst === "review"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-slate-500/15 text-slate-300"
              )}
            >
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top risky tools ───────────────────────────────────────────────────────────

function TopRiskyTools({ findings }: { findings: ScanFinding[] }) {
  const tools = new Map<string, { count: number; worst: ScanFinding["severity"] }>();
  const order: ScanFinding["severity"][] = ["critical", "high", "review", "info"];

  for (const f of findings) {
    const match = /^tools\.(\S+)/.exec(f.target);
    if (!match) continue;
    const toolName = match[1];
    const existing = tools.get(toolName);
    if (!existing) {
      tools.set(toolName, { count: 1, worst: f.severity });
    } else {
      const worstIdx = Math.min(order.indexOf(existing.worst), order.indexOf(f.severity));
      tools.set(toolName, { count: existing.count + 1, worst: order[worstIdx] });
    }
  }

  const sorted = Array.from(tools.entries())
    .sort((a, b) => order.indexOf(a[1].worst) - order.indexOf(b[1].worst))
    .slice(0, 5);

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top risky tools</p>
      <div className="space-y-1">
        {sorted.map(([toolName, { count, worst }]) => (
          <div key={toolName} className="flex items-center justify-between gap-2">
            <code className="truncate font-mono text-[11px] text-foreground">{toolName}</code>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                worst === "critical" || worst === "high"
                  ? "bg-rose-500/15 text-rose-300"
                  : worst === "review"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-slate-500/15 text-slate-300"
              )}
            >
              {count} {count === 1 ? "finding" : "findings"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Decision explanation ──────────────────────────────────────────────────────

function decisionExplanation(decision: ScanDecision, score: number): string {
  if (decision === "PASS")
    return `Trust index ${score}/100 — safe enough for current policy. No blocking issues found.`;
  if (decision === "NEEDS REVIEW")
    return `Trust index ${score}/100 — risky findings require human review before production use.`;
  return `Trust index ${score}/100 — critical issues must be fixed before this MCP server can be used in production.`;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export type McpBreakdownPanelProps = {
  result: ScanApiSuccess;
  onRerunScan?: () => void;
  onHardenAll?: () => void;
};

export function McpBreakdownPanel({ result, onRerunScan, onHardenAll }: McpBreakdownPanelProps) {
  const { findings, status, riskScore } = result;
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const hasBlockingFindings = criticalCount > 0 || highCount > 0;

  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.06] via-card to-card p-5 shadow-lg ring-1 ring-cyan-500/10 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">MCP Security</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Analysis breakdown</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {decisionExplanation(status, riskScore)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRerunScan && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRerunScan}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              Re-run scan
            </Button>
          )}
          {hasBlockingFindings && onHardenAll && (
            <Button
              type="button"
              size="sm"
              onClick={onHardenAll}
              className="h-8 gap-1.5 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
            >
              <Shield className="h-3.5 w-3.5" aria-hidden />
              Fix all critical issues
              {criticalCount > 0 && (
                <span className="ml-1 rounded bg-white/20 px-1 py-0.5 text-[9px] font-bold">
                  {criticalCount}
                </span>
              )}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            className="h-8 gap-1.5 border-amber-500/40 bg-amber-500/[0.06] text-xs text-amber-300 opacity-80"
            title="GitHub PR creation requires OAuth — planned for a future release"
          >
            <WrenchIcon className="h-3.5 w-3.5" aria-hidden />
            Create PR
            <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
              planned
            </span>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <ScoreBreakdown findings={findings} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <CategoryBreakdown findings={findings} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <TopRiskyTools findings={findings} />
        </div>
      </div>
    </section>
  );
}

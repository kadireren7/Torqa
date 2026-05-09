import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  FileStack,
  Gauge,
  Shield,
  Zap,
} from "lucide-react";
import { RiskTrendChart } from "@/components/risk-trend-chart";
import { ScanOutcomeBadge } from "@/components/scan-outcome-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getHomeDashboardData } from "@/data/home-metrics";
import { cn } from "@/lib/utils";
import { OverviewFirstRun } from "@/components/onboarding/overview-first-run";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
  description: "Connect sources, monitor workflows, enforce policies continuously.",
};

type GovernanceDecisionRow = {
  id: string;
  decision_type: string;
  finding_signature: string | null;
  rationale: string | null;
  mode: string | null;
  created_at: string;
};

async function getRecentDecisions(): Promise<GovernanceDecisionRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("governance_decisions")
    .select("id, decision_type, finding_signature, rationale, mode, created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []) as GovernanceDecisionRow[];
}

const DECISION_META: Record<string, { label: string; color: string }> = {
  apply_fix:            { label: "Fix applied",       color: "var(--emerald)" },
  accept_risk:          { label: "Risk accepted",     color: "var(--amber)" },
  revoke_risk:          { label: "Risk revoked",      color: "var(--fg-3)" },
  approve_fix:          { label: "Fix approved",      color: "var(--emerald)" },
  reject_fix:           { label: "Fix rejected",      color: "var(--rose)" },
  mode_change:          { label: "Mode changed",      color: "var(--accent)" },
  interactive_response: { label: "Response recorded", color: "var(--fg-3)" },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function DashboardOverviewPage() {
  const [home, decisions] = await Promise.all([
    getHomeDashboardData(),
    getRecentDecisions(),
  ]);

  const totalOutcomes = home.passCount + home.failCount + home.reviewCount;
  const passRate = totalOutcomes > 0 ? Math.round((home.passCount / totalOutcomes) * 100) : null;

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Hero ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
            Overview
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]" style={{ color: "var(--fg-1)" }}>
            Governance control
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sources"
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all duration-150 hover:opacity-80"
            style={{
              background: "var(--overlay-md)",
              border: "1px solid var(--line-2)",
              color: "var(--fg-2)",
            }}
          >
            Connect source
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Link
            href="/scan"
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all duration-150 hover:opacity-90"
            style={{
              background: "var(--accent)",
              color: "var(--surface-0)",
            }}
          >
            <Shield className="h-3 w-3" />
            Scan now
          </Link>
        </div>
      </div>

      <OverviewFirstRun
        mode={home.mode}
        savedReportsAllTime={home.savedReportsAllTime}
        onboarding={home.onboarding}
      />

      {/* ── Metric grid ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 stagger-children">
        <MetricTile
          label="Scans (30d)"
          value={home.totalScans30d}
          icon={<Activity className="h-3.5 w-3.5" />}
          sub="Total last month"
        />
        <MetricTile
          label="Avg trust score"
          value={home.avgTrustScore ?? "—"}
          icon={<Gauge className="h-3.5 w-3.5" />}
          sub="Mean posture 0–100"
          accent={
            typeof home.avgTrustScore === "number"
              ? home.avgTrustScore >= 70 ? "var(--emerald)" : home.avgTrustScore >= 45 ? "var(--amber)" : "var(--rose)"
              : undefined
          }
        />
        <MetricTile
          label="Policy failures"
          value={home.policyFailures30d}
          icon={<Shield className="h-3.5 w-3.5" />}
          sub="Failed checks (30d)"
          accent={home.policyFailures30d > 0 ? "var(--rose)" : undefined}
        />
        <MetricTile
          label="Pass rate"
          value={passRate === null ? "—" : `${passRate}%`}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          sub={`${home.passCount} pass · ${home.failCount} fail · ${home.reviewCount} review`}
          accent={
            passRate !== null
              ? passRate >= 75 ? "var(--emerald)" : passRate >= 50 ? "var(--amber)" : "var(--rose)"
              : undefined
          }
        />
        <MetricTile
          label="Scans this week"
          value={home.scansThisWeek}
          icon={<Activity className="h-3.5 w-3.5" />}
          sub="Last 7 days"
        />
        <MetricTile
          label="Saved reports"
          value={home.savedReportsAllTime}
          icon={<FileStack className="h-3.5 w-3.5" />}
          sub="All time in library"
        />
        <MetricTile
          label="High-risk scans"
          value={home.highRiskScans30d}
          icon={<Zap className="h-3.5 w-3.5" />}
          sub="Trust < 60 or FAIL (30d)"
          accent={home.highRiskScans30d > 0 ? "var(--amber)" : undefined}
        />
        <MetricTile
          label="Schedule success"
          value={home.scheduleSuccessRate30d === null ? "—" : `${home.scheduleSuccessRate30d}%`}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          sub="Completed rate (30d)"
        />
      </div>

      {/* ── Trend chart ── */}
      <SectionCard
        title="Scan outcome trend"
        sub="Last 14 days"
        action={{ href: "/reports", label: "Reports" }}
      >
        <div className="pt-2">
          <RiskTrendChart
            data={home.outcomeTrend}
            seriesLabels={{ safe: "Pass", needsReview: "Review", blocked: "Fail" }}
          />
        </div>
      </SectionCard>

      {/* ── Two-col ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top findings */}
        <SectionCard title="Top findings" sub="Most frequent rule hits">
          {home.topFindingRules.length === 0 ? (
            <EmptyState text="No findings yet. Run a scan to populate." />
          ) : (
            <div className="space-y-1 pt-2">
              {home.topFindingRules.map((rule, i) => (
                <div
                  key={rule.ruleId}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors duration-150"
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--overlay-sm)",
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <code className="font-mono text-[11px]" style={{ color: "var(--fg-2)" }}>
                    {rule.ruleId}
                  </code>
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{
                      background: "var(--overlay-md)",
                      color: "var(--fg-2)",
                    }}
                  >
                    {rule.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Activity */}
        <SectionCard
          title="Activity"
          sub="Recent governance decisions"
          action={{ href: "/audit", label: "Full log" }}
        >
          {decisions.length === 0 ? (
            <EmptyState text="No governance decisions yet." />
          ) : (
            <div className="pt-2 space-y-[1px]">
              {decisions.map((d) => {
                const meta = DECISION_META[d.decision_type] ?? { label: d.decision_type, color: "var(--fg-3)" };
                return (
                  <div
                    key={d.id}
                    className="flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150"
                    style={{ ["--hover-bg" as string]: "var(--overlay-hover)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--overlay-hover)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: meta.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>
                          {meta.label}
                        </p>
                        {d.rationale && (
                          <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--fg-3)" }}>
                            {d.rationale}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "var(--fg-4)" }}>
                      {timeAgo(d.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Recent scans ── */}
      <SectionCard
        title="Recent scans"
        sub="Latest governance analyses"
        action={{ href: "/scan/history", label: "View history" }}
      >
        <div className="pt-2">
          {home.recentScans.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}
              >
                <Shield className="h-5 w-5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--fg-1)" }}>No scans yet</p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--fg-3)" }}>Connect a source to start scanning</p>
              </div>
              <Link
                href="/scan"
                className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all duration-150 hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--surface-0)" }}
              >
                Run first scan <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "var(--line)" }} className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Workflow</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Source</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Trust</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>Outcome</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {home.recentScans.map((s) => (
                  <TableRow
                    key={s.id}
                    style={{ borderColor: "var(--line)" }}
                    className="transition-colors duration-100"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--overlay-hover)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <TableCell>
                      {home.mode === "mock" ? (
                        <span className="line-clamp-1 max-w-[200px] text-[13px] font-medium" style={{ color: "var(--fg-1)" }}>
                          {s.workflowName ?? "Untitled"}
                        </span>
                      ) : (
                        <Link
                          href={`/scan/${s.id}`}
                          className="line-clamp-1 max-w-[200px] text-[13px] font-medium transition-colors duration-150"
                          style={{ color: "var(--fg-1)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-1)"; }}
                        >
                          {s.workflowName ?? "Untitled"}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[11px] capitalize font-medium"
                        style={{ background: "var(--overlay-md)", color: "var(--fg-2)" }}
                      >
                        {s.source}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-[13px]" style={{ color: "var(--fg-2)" }}>
                      {s.riskScore}
                    </TableCell>
                    <TableCell><ScanOutcomeBadge status={s.status} /></TableCell>
                    <TableCell className="text-right text-[11px]" style={{ color: "var(--fg-3)" }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SectionCard>

    </div>
  );
}

/* ── Sub-components ── */

function MetricTile({
  label,
  value,
  icon,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  sub: string;
  accent?: string;
}) {
  return (
    <div
      className="animate-fade-in-up card-lift rounded-xl p-4"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--fg-4)" }}
      >
        <span style={{ color: "var(--fg-4)" }}>{icon}</span>
        {label}
      </div>
      <div
        className={cn("text-[28px] font-semibold tabular-nums tracking-tight leading-none")}
        style={{ color: accent ?? "var(--fg-1)" }}
      >
        {value}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--fg-3)" }}>
        {sub}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div
      className="animate-fade-in-up rounded-xl"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-0">
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>{title}</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>{sub}</p>
        </div>
        {action && (
          <Link
            href={action.href}
            className="flex items-center gap-1 text-[12px] transition-colors duration-150"
            style={{ color: "var(--fg-3)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-3)"; }}
          >
            {action.label}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>{text}</p>
    </div>
  );
}

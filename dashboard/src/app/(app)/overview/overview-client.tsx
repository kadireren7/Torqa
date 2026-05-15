"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  Cpu,
  FileStack,
  Gauge,
  KeyRound,
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
import { OverviewFirstRun } from "@/components/onboarding/overview-first-run";
import type { HomeDashboardData } from "@/data/types";
import type { GovernanceModeView } from "@/lib/governance/types";

const EASE = [0.16, 1, 0.3, 1] as const;

const DECISION_META: Record<string, { label: string; color: string }> = {
  apply_fix:            { label: "Fix applied",       color: "var(--emerald)" },
  accept_risk:          { label: "Risk accepted",     color: "var(--amber)" },
  revoke_risk:          { label: "Risk revoked",      color: "var(--fg-3)" },
  approve_fix:          { label: "Fix approved",      color: "var(--emerald)" },
  reject_fix:           { label: "Fix rejected",      color: "var(--rose)" },
  mode_change:          { label: "Mode changed",      color: "var(--accent)" },
  interactive_response: { label: "Response recorded", color: "var(--fg-3)" },
};

type DecisionRow = {
  id: string;
  decision_type: string;
  finding_signature: string | null;
  rationale: string | null;
  mode: string | null;
  created_at: string;
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay: i * 0.05 },
  }),
};

export function OverviewClient({
  home,
  decisions,
  governance,
}: {
  home: HomeDashboardData;
  decisions: DecisionRow[];
  governance: GovernanceModeView;
}) {
  const totalOutcomes = home.passCount + home.failCount + home.reviewCount;
  const passRate = totalOutcomes > 0 ? Math.round((home.passCount / totalOutcomes) * 100) : null;
  const governanceLabel =
    governance.mode.charAt(0).toUpperCase() + governance.mode.slice(1);
  const settingsCards = [
    {
      title: "Governance mode",
      desc:
        governance.scope === "org"
          ? `${governanceLabel} mode is active for the current workspace.`
          : "Personal scope is read-only. Activate a workspace to control operation mode.",
      href: governance.scope === "org" ? "/settings/governance" : "/workspace",
      cta: governance.scope === "org" ? "Open governance" : "Activate workspace",
      icon: Shield,
      accent: governance.scope === "org" ? "var(--accent)" : "var(--amber)",
      meta: `${governance.scope === "org" ? "Workspace" : "Personal"} · ${governanceLabel}`,
    },
    {
      title: "API keys",
      desc: "Create and revoke tokens for API, CI, MCP, and external automation.",
      href: "/settings/api",
      cta: "Manage keys",
      icon: KeyRound,
      accent: "var(--emerald)",
      meta: "Developer access",
    },
    {
      title: "Workspace",
      desc: "Choose the active workspace, invite teammates, and move out of personal-only mode.",
      href: "/workspace",
      cta: "Open workspace",
      icon: Building2,
      accent: "var(--amber)",
      meta: governance.scope === "org" ? "Shared scope active" : "Personal scope active",
    },
    {
      title: "MCP server",
      desc: "Check the MCP endpoint, setup guide, and API key path for Claude-compatible tools.",
      href: "/mcp",
      cta: "Open MCP",
      icon: Cpu,
      accent: "var(--accent)",
      meta: "JSON-RPC endpoint",
    },
  ];

  const metrics = [
    {
      label: "Scans (30d)",
      value: home.totalScans30d,
      icon: Activity,
      sub: "Total last month",
    },
    {
      label: "Avg trust score",
      value: home.avgTrustScore ?? "—",
      icon: Gauge,
      sub: "Mean posture 0–100",
      accent:
        typeof home.avgTrustScore === "number"
          ? home.avgTrustScore >= 70
            ? "var(--emerald)"
            : home.avgTrustScore >= 45
            ? "var(--amber)"
            : "var(--rose)"
          : undefined,
    },
    {
      label: "Policy failures",
      value: home.policyFailures30d,
      icon: Shield,
      sub: "Failed checks (30d)",
      accent: home.policyFailures30d > 0 ? "var(--rose)" : undefined,
    },
    {
      label: "Pass rate",
      value: passRate === null ? "—" : `${passRate}%`,
      icon: BarChart3,
      sub: `${home.passCount} pass · ${home.failCount} fail · ${home.reviewCount} review`,
      accent:
        passRate !== null
          ? passRate >= 75
            ? "var(--emerald)"
            : passRate >= 50
            ? "var(--amber)"
            : "var(--rose)"
          : undefined,
    },
    {
      label: "This week",
      value: home.scansThisWeek,
      icon: Activity,
      sub: "Scans last 7 days",
    },
    {
      label: "Saved reports",
      value: home.savedReportsAllTime,
      icon: FileStack,
      sub: "All time in library",
    },
    {
      label: "High-risk scans",
      value: home.highRiskScans30d,
      icon: Zap,
      sub: "Trust < 60 or FAIL",
      accent: home.highRiskScans30d > 0 ? "var(--amber)" : undefined,
    },
    {
      label: "Schedule success",
      value: home.scheduleSuccessRate30d === null ? "—" : `${home.scheduleSuccessRate30d}%`,
      icon: BarChart3,
      sub: "Completed rate (30d)",
    },
    {
      label: "Active playbooks",
      value: home.playbooksActive,
      icon: Zap,
      sub: "Automation rules enabled",
      accent: home.playbooksActive > 0 ? "var(--accent)" : undefined,
    },
    {
      label: "Playbook runs",
      value: home.playbookRuns24h,
      icon: Activity,
      sub: "Triggered last 24h",
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
            Console
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]" style={{ color: "var(--fg-1)" }}>
            MCP Security Console
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Scan MCP configs, detect unsafe tools, fix critical issues, and export hardened configs before AI agents use them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/scan"
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all duration-200 hover:opacity-90"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Scan MCP config
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Link
            href="/scan?sample=unsafe_mcp&source=mcp"
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all duration-200 hover:opacity-90"
            style={{ background: "var(--overlay-md)", border: "1px solid var(--line-2)", color: "var(--fg-2)" }}
          >
            <Shield className="h-3 w-3" />
            Try unsafe MCP demo
          </Link>
        </div>
      </motion.div>

      <OverviewFirstRun
        mode={home.mode}
        savedReportsAllTime={home.savedReportsAllTime}
        onboarding={home.onboarding}
      />

      {home.mode !== "supabase" ? (
        <motion.div
          custom={0.5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Local demo mode</p>
              <p className="text-xs text-muted-foreground">
                Overview metrics use sample data. Run a scan to populate real results — no account needed.
              </p>
            </div>
            <Link href="/workspace" className="text-xs font-medium text-primary hover:underline">
              Connect cloud
            </Link>
          </div>
        </motion.div>
      ) : null}

      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="rounded-xl"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Quick controls</p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
              Frequently used settings surfaced directly on the dashboard.
            </p>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1 text-[12px] transition-colors duration-150 hover:opacity-60"
            style={{ color: "var(--fg-3)" }}
          >
            All settings <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid gap-3 px-5 pb-5 pt-4 md:grid-cols-2 xl:grid-cols-4">
          {settingsCards.map((card, i) => (
            <motion.div
              key={card.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="rounded-xl p-4"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "var(--overlay-md)" }}
                >
                  <card.icon className="h-4 w-4" style={{ color: card.accent }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    {card.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
                    {card.meta}
                  </p>
                </div>
              </div>
              <p className="min-h-[52px] text-[12px] leading-relaxed" style={{ color: "var(--fg-3)" }}>
                {card.desc}
              </p>
              <Link
                href={card.href}
                className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium transition-colors duration-150 hover:opacity-70"
                style={{ color: card.accent }}
              >
                {card.cta}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Metric grid */}
      <motion.div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
      >
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            custom={i}
            variants={fadeUp}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="rounded-xl p-4"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
          >
            <div
              className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--fg-4)" }}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </div>
            <div
              className="text-[28px] font-semibold tabular-nums tracking-tight leading-none"
              style={{ color: m.accent ?? "var(--fg-1)" }}
            >
              {m.value}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--fg-3)" }}>
              {m.sub}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Trend chart */}
      <motion.div
        custom={3}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="rounded-xl"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Scan outcome trend</p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Last 14 days</p>
          </div>
          <Link
            href="/reports"
            className="flex items-center gap-1 text-[12px] transition-colors duration-150 hover:opacity-60"
            style={{ color: "var(--fg-3)" }}
          >
            Reports <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="px-5 pb-5 pt-2">
          {home.outcomeTrend.length === 0 ? (
            <div className="flex h-[160px] items-center justify-center text-center">
              <div>
                <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>No scan data yet</p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--fg-4)" }}>Run your first scan to populate this chart</p>
              </div>
            </div>
          ) : (
            <RiskTrendChart
              data={home.outcomeTrend}
              seriesLabels={{ safe: "Pass", needsReview: "Review", blocked: "Fail" }}
            />
          )}
        </div>
      </motion.div>

      {/* Two-col */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top findings */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-xl"
          style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
        >
          <div className="px-5 pt-5 pb-0">
            <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Top findings</p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Most frequent rule hits</p>
          </div>
          <div className="px-5 pb-5">
            {home.topFindingRules.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>No findings yet. Run a scan to populate.</p>
              </div>
            ) : (
              <div className="space-y-1 pt-2">
                {home.topFindingRules.map((rule, i) => (
                  <motion.div
                    key={rule.ruleId}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{ border: "1px solid var(--line)", background: "var(--overlay-sm)" }}
                  >
                    <code className="font-mono text-[11px]" style={{ color: "var(--fg-2)" }}>
                      {rule.ruleId}
                    </code>
                    <span
                      className="rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                      style={{ background: "var(--overlay-md)", color: "var(--fg-2)" }}
                    >
                      {rule.count}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Activity */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-xl"
          style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Activity</p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Recent scan events</p>
            </div>
            <Link
              href="/audit"
              className="flex items-center gap-1 text-[12px] transition-colors duration-150 hover:opacity-60"
              style={{ color: "var(--fg-3)" }}
            >
              Full log <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-5 pb-5">
            {decisions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>No scan events yet. Run your first MCP scan.</p>
              </div>
            ) : (
              <div className="pt-2 space-y-px">
                {decisions.map((d, i) => {
                  const meta = DECISION_META[d.decision_type] ?? { label: d.decision_type, color: "var(--fg-3)" };
                  return (
                    <motion.div
                      key={d.id}
                      custom={i}
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                      whileHover={{ backgroundColor: "var(--overlay-hover)" }}
                      className="flex items-start justify-between gap-3 rounded-lg px-2 py-2.5"
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
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent scans */}
      <motion.div
        custom={6}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="rounded-xl"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Recent scans</p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Latest MCP security analyses</p>
          </div>
          <Link
            href="/scan/history"
            className="flex items-center gap-1 text-[12px] transition-colors duration-150 hover:opacity-60"
            style={{ color: "var(--fg-3)" }}
          >
            View history <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="px-5 pb-5 pt-2">
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
                <p className="mt-1 text-[12px]" style={{ color: "var(--fg-3)" }}>
                  Connect a source for real workflows, or try a demo scan to preview the report flow.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/sources"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all duration-200 hover:opacity-90"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Connect a source <ArrowUpRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/scan?sample=customer_support_n8n&source=n8n"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-all duration-200 hover:opacity-90"
                  style={{ background: "var(--overlay-md)", border: "1px solid var(--line-2)", color: "var(--fg-2)" }}
                >
                  Try demo scan
                </Link>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "var(--line)" }} className="hover:bg-transparent">
                  {["Workflow", "Source", "Trust", "Outcome", "When"].map((h, idx) => (
                    <TableHead
                      key={h}
                      className={`text-[11px] font-semibold uppercase tracking-wide${idx === 4 ? " text-right" : ""}`}
                      style={{ color: "var(--fg-4)" }}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {home.recentScans.map((s, i) => (
                  <motion.tr
                    key={s.id}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    whileHover={{ backgroundColor: "var(--overlay-hover)" }}
                    className="border-b transition-colors duration-100"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <TableCell>
                      <Link
                        href={`/scan/${s.id}`}
                        className="line-clamp-1 max-w-[200px] text-[13px] font-medium transition-colors duration-150 hover:opacity-70"
                        style={{ color: "var(--fg-1)" }}
                      >
                        {s.workflowName ?? "Untitled"}
                      </Link>
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
                    <TableCell>
                      <ScanOutcomeBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right text-[11px]" style={{ color: "var(--fg-3)" }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </motion.div>
    </div>
  );
}

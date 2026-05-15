"use client";

import Link from "next/link";
import { ArrowRight, FileJson2, Shield, Play, BookOpen } from "lucide-react";
import type { HomeDashboardMode, HomeOnboardingCounts } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  mode: HomeDashboardMode;
  savedReportsAllTime: number;
  onboarding: HomeOnboardingCounts | null;
};

type StartPath = {
  id: string;
  label: string;
  href: string;
  desc: string;
  Icon: typeof FileJson2;
  badge?: string;
};

export function OverviewFirstRun({ mode, savedReportsAllTime, onboarding }: Props) {
  const cloud = mode === "supabase" && onboarding !== null;
  const firstScanDone = savedReportsAllTime > 0;
  const startPaths: StartPath[] = [
    {
      id: "build",
      label: "Build workflow",
      href: "/demo/mcp-workflow-builder",
      desc: "Describe an automation in plain English and get a structured MCP workflow plan with tool selection, approval points, and exportable JSON.",
      Icon: Play,
      badge: "new",
    },
    {
      id: "scan",
      label: "Scan MCP tools",
      href: "/scan",
      desc: "Upload or paste your MCP server config JSON to detect unsafe tools, exposed secrets, and risky permissions before using them in workflows.",
      Icon: FileJson2,
    },
    {
      id: "reports",
      label: "Workflow reports",
      href: "/reports",
      desc: "Browse scan reports and workflow plans saved in your browser. No account needed — all local.",
      Icon: Shield,
    },
    {
      id: "policies",
      label: "Tool safety policies",
      href: "/policies",
      desc: "Browse built-in policy templates: approval gates, risky tools, secret handling, filesystem and network access.",
      Icon: BookOpen,
    },
  ];

  return (
    <Card className="border-border/70 bg-card/50 shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg font-semibold">
            {firstScanDone ? "First scan complete" : "Build an MCP workflow or scan tools in under 2 minutes"}
          </CardTitle>
          <Badge variant="secondary">{cloud ? "Cloud mode" : "Local demo mode"}</Badge>
        </div>
        <CardDescription className="max-w-2xl">
          {firstScanDone
            ? "You have a report. Build a workflow, run another scan, or browse tool safety policies."
            : "Torqa turns plain-English automation requests into structured MCP workflow plans, then scans tool configs to surface unsafe permissions and secrets before execution."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {startPaths.map((path) => (
            <Link
              key={path.id}
              href={path.href}
              className="group rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/30 hover:bg-muted/35"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <path.Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground group-hover:text-primary">{path.label}</span>
                    {path.badge ? <Badge variant="outline">{path.badge}</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{path.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Open path <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {cloud
              ? "Running in cloud mode. Scan history and reports are persisted per workspace."
              : "Running in local demo mode. Scan history and reports are stored in your browser only."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/scan" className="text-xs font-medium text-primary hover:underline">
              Scan MCP tools
            </Link>
            {!cloud ? (
              <Link href="/waitlist" className="text-xs font-medium text-primary hover:underline">
                Join early access
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

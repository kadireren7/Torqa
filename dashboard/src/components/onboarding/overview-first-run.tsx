"use client";

import Link from "next/link";
import { ArrowRight, GitBranch, Link2, Play, Workflow } from "lucide-react";
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
  Icon: typeof Workflow;
  advanced?: boolean;
};

export function OverviewFirstRun({ mode, savedReportsAllTime, onboarding }: Props) {
  const cloud = mode === "supabase" && onboarding !== null;
  const firstScanDone = savedReportsAllTime > 0;
  const startPaths: StartPath[] = [
    {
      id: "n8n",
      label: "Connect n8n",
      href: "/sources#n8n",
      desc: "Best for real workflow exports and recurring governance scans.",
      Icon: Workflow,
    },
    {
      id: "github",
      label: "Connect GitHub Actions",
      href: "/sources#github",
      desc: "Review workflow YAML before risky changes land in your repos.",
      Icon: GitBranch,
    },
    {
      id: "demo",
      label: "Try demo workflow",
      href: "/scan?sample=customer_support_n8n&source=n8n",
      desc: "Loads a sample n8n workflow so you can reach a first report fast.",
      Icon: Play,
    },
    {
      id: "manual",
      label: "Advanced manual scan",
      href: "/advanced/manual-scan",
      desc: "Paste or upload JSON directly when you already know the exact payload to test.",
      Icon: Link2,
      advanced: true,
    },
  ];

  return (
    <Card className="border-border/70 bg-card/50 shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg font-semibold">
            {firstScanDone ? "First report complete" : "Get your first report in under 2 minutes"}
          </CardTitle>
          <Badge variant="secondary">{cloud ? "Workspace mode" : "Local demo mode"}</Badge>
        </div>
        <CardDescription className="max-w-2xl">
          {firstScanDone
            ? "You have a report. Next, connect a real source so Torqa can keep scanning workflows without manual uploads."
            : "Torqa scans workflow definitions before they reach production, then returns findings, trust score, and a clear next action."}
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
                    {path.advanced ? <Badge variant="outline">Advanced</Badge> : null}
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
              ? "Primary action: connect a source. Demo scan is still available if you want to preview the report shape first."
              : "In local demo mode, overview data is sample data and source connections are not saved until cloud mode is enabled."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/sources" className="text-xs font-medium text-primary hover:underline">
              Connect a source
            </Link>
            {!cloud ? (
              <Link href="/workspace" className="text-xs font-medium text-primary hover:underline">
                Connect cloud
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

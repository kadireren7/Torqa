"use client";

import Link from "next/link";
import { FileJson2, Shield, GitBranch, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPublicSupabaseUrl } from "@/lib/env";
import { EmptyStateCta } from "@/components/onboarding/empty-state-cta";

const useCloud = hasPublicSupabaseUrl();

const ACTIVE_OPTIONS = [
  {
    id: "paste",
    title: "Upload or paste MCP config",
    description:
      "Drop in a .json file or paste your MCP server config. Torqa scans it with the deterministic rule engine — no AI, no black-box scoring.",
    href: "/scan",
    cta: "Open scanner",
    icon: FileJson2,
    accent: "var(--accent)",
  },
  {
    id: "demo",
    title: "Try the unsafe MCP demo",
    description:
      "Load an intentionally vulnerable MCP server config to see real findings: unrestricted filesystem write, shell exec without validation, hardcoded secrets.",
    href: "/scan?sample=unsafe_mcp&source=mcp",
    cta: "Try demo",
    icon: Shield,
    accent: "var(--rose, #ef4444)",
  },
];

const PLANNED_OPTIONS = [
  {
    id: "live-mcp",
    title: "Live MCP connection",
    description:
      "Connect a running MCP server directly. Torqa will pull the tool manifest and scan it automatically.",
    icon: Wifi,
  },
  {
    id: "github",
    title: "GitHub repo import",
    description:
      "Import MCP server configs from a GitHub repository. Scan on every PR or push.",
    icon: GitBranch,
  },
];

export default function SourcesPage() {
  return (
    <div className="space-y-10 pb-10">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sources</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">MCP Configs</h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Bring in MCP server configs to scan. Upload JSON directly, paste a config, or connect a live source when ready.
        </p>
      </div>

      {!useCloud && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Local demo mode</p>
              <p className="text-xs text-muted-foreground">
                Source connections are not saved until cloud mode is enabled. You can still scan any MCP config right now.
              </p>
            </div>
            <Link href="/scan" className="text-xs font-medium text-primary hover:underline">
              Try demo scan
            </Link>
          </div>
        </div>
      )}

      {/* Active options */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Available now</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {ACTIVE_OPTIONS.map((opt) => (
            <Card
              key={opt.id}
              className="border-border/70 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <opt.icon className="h-4 w-4" style={{ color: opt.accent }} aria-hidden />
                  {opt.title}
                </CardTitle>
                <CardDescription className="text-sm">{opt.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={opt.href}
                  className="inline-flex items-center rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
                  style={{ background: opt.accent, color: "#fff" }}
                >
                  {opt.cta}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Planned options */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Coming soon</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANNED_OPTIONS.map((opt) => (
            <Card
              key={opt.id}
              className="border-border/50 bg-muted/10 opacity-75"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                  <opt.icon className="h-4 w-4" aria-hidden />
                  {opt.title}
                  <Badge variant="outline" className="ml-1 text-[10px]">Planned</Badge>
                </CardTitle>
                <CardDescription className="text-sm">{opt.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/waitlist"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Join early access →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* If no source-specific empty state, lead to scan */}
      <EmptyStateCta
        icon={FileJson2}
        title="Start with any MCP config"
        description="Upload a local config, paste JSON, or load the unsafe MCP demo to see Torqa's scanner in action."
        primary={{ href: "/scan", label: "Scan MCP tools" }}
        secondary={{ href: "/scan?sample=unsafe_mcp&source=mcp", label: "Try unsafe demo" }}
        className="border-border/60 bg-muted/20"
      />
    </div>
  );
}

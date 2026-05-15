"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Copy,
  Download,
  FileJson2,
  Shield,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LocalReport, loadReport } from "@/lib/local-report";
import { cn } from "@/lib/utils";

function isScanResultShape(v: unknown): v is {
  status: string;
  riskScore: number;
  findings: unknown[];
  totals?: { high?: number; review?: number; info?: number };
  source?: string;
} {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.status === "string" &&
    typeof obj.riskScore === "number" &&
    Array.isArray(obj.findings)
  );
}

function decisionColor(status: string): string {
  if (status === "PASS") return "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
  if (status === "NEEDS REVIEW") return "border-amber-500/50 bg-amber-500/10 text-amber-200";
  return "border-rose-500/50 bg-rose-500/10 text-rose-200";
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    mcp: "MCP server",
    n8n: "n8n workflow",
    "ai-agent": "AI agent",
    github: "GitHub Actions",
    make: "Make.com",
    zapier: "Zapier",
    lambda: "AWS Lambda",
    generic: "Generic JSON",
  };
  return map[source] ?? source;
}

export default function ReportPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [report, setReport] = useState<LocalReport | null | "loading">("loading");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!id) {
      setReport(null);
      return;
    }
    const loaded = loadReport(id);
    setReport(loaded);
  }, [id]);

  const handleCopyJson = async () => {
    if (!report || report === "loading") return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(report.scanResult, null, 2)
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    if (!report || report === "loading") return;
    const blob = new Blob(
      [JSON.stringify(report.scanResult, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torqa-report-${report.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  if (report === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--surface-0)" }}
      >
        <p className="text-sm" style={{ color: "var(--fg-3)" }}>
          Loading report…
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 py-20 text-center"
        style={{ background: "var(--surface-0)" }}
      >
        <Shield className="h-12 w-12 opacity-30" style={{ color: "var(--fg-3)" }} />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold" style={{ color: "var(--fg-1)" }}>
            Report not found
          </h1>
          <p
            className="max-w-[480px] text-sm leading-relaxed"
            style={{ color: "var(--fg-3)" }}
          >
            This report is stored locally in your browser. It may have been deleted,
            opened in a different browser, or the local data was cleared. Reports
            are not synced to any server in local demo mode.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/scan"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Run a new scan
          </Link>
          <Link
            href="/"
            className="rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const scan = isScanResultShape(report.scanResult) ? report.scanResult : null;
  const isMcp = report.source === "mcp";
  const criticalCount =
    scan?.totals?.high ??
    (Array.isArray(scan?.findings)
      ? (scan.findings as unknown[]).filter((f) => {
          const finding = f as Record<string, unknown>;
          return finding.severity === "critical" || finding.severity === "high";
        }).length
      : 0);
  const totalFindings = scan?.findings.length ?? 0;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--surface-0)" }}
    >
      {/* Top nav */}
      <div
        className="sticky top-0 z-10 border-b px-5 py-3 sm:px-10"
        style={{
          background: "var(--surface-1)",
          borderColor: "var(--line)",
        }}
      >
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--fg-1)" }}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--accent)" }}
                aria-hidden
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            Torqa
          </Link>
          <button
            onClick={() => void handleCopyLink()}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
            style={{ borderColor: "var(--line-2)", color: "var(--fg-3)" }}
          >
            <Copy className="h-3 w-3" aria-hidden />
            {copiedLink ? "Copied link!" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] space-y-8 px-5 py-10 sm:px-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold"
            >
              Local report
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-xs"
              style={{ color: "var(--fg-4)" }}
            >
              {report.reportId}
            </Badge>
            <Badge
              variant="outline"
              className="capitalize"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                color: "var(--accent)",
              }}
            >
              {sourceLabel(report.source)}
            </Badge>
            {isMcp && (
              <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
                MCP security analysis
              </Badge>
            )}
          </div>
          <h1
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{ color: "var(--fg-1)" }}
          >
            Scan report
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-3)" }}>
            Saved{" "}
            {new Date(report.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" · "}
            Local demo report · stored in this browser only
          </p>
        </div>

        {/* Notice: local-only */}
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
            background: "color-mix(in srgb, var(--accent) 5%, transparent)",
          }}
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--accent)" }}
          />
          <p className="text-sm leading-relaxed" style={{ color: "var(--fg-2)" }}>
            This report is stored locally in your browser. It is not shared with any
            server and will be lost if you clear site data. Copy the report JSON to
            back it up.
          </p>
        </div>

        {/* KPI cards */}
        {scan && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card
              className={cn(
                "border",
                scan.status === "PASS"
                  ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                  : scan.status === "NEEDS REVIEW"
                    ? "border-amber-500/30 bg-amber-500/[0.06]"
                    : "border-rose-500/30 bg-rose-500/[0.06]"
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Decision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className={cn("text-sm font-bold", decisionColor(scan.status))}>
                  {scan.status}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Trust score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className="text-3xl font-bold tabular-nums tracking-tight"
                  style={{ color: "var(--fg-1)" }}
                >
                  {scan.riskScore}
                  <span className="text-lg font-normal text-muted-foreground">/100</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className="text-3xl font-bold tabular-nums tracking-tight"
                  style={{ color: "var(--fg-1)" }}
                >
                  {totalFindings}
                </p>
                {criticalCount > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-rose-400">
                    <ShieldAlert className="h-3 w-3" aria-hidden />
                    {criticalCount} critical / high
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* MCP summary */}
        {isMcp && (
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
              background: "color-mix(in srgb, var(--accent) 4%, transparent)",
            }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              MCP security analysis
            </p>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--fg-2)" }}>
              This report covers an MCP server configuration scan. Torqa checks for
              risky tool permissions, exposed secrets, unsafe capabilities, and
              tool scope misalignment. Review findings and apply fixes to harden your
              MCP server before deployment.
            </p>
            <div className="mt-3">
              <Link
                href="/scan?sample=unsafe_mcp&source=mcp"
                className="text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--accent)" }}
              >
                Run another MCP scan →
              </Link>
            </div>
          </div>
        )}

        {/* Export toolbar */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => void handleCopyJson()}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copied ? "Copied!" : "Copy report JSON"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download JSON
          </Button>
          <Button asChild type="button" size="sm" className="h-9 gap-2">
            <Link href="/scan">
              <FileJson2 className="h-3.5 w-3.5" aria-hidden />
              New scan
            </Link>
          </Button>
        </div>

        {/* Raw JSON preview */}
        <div className="space-y-2">
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "var(--fg-4)" }}
          >
            Report JSON (truncated preview)
          </p>
          <div
            className="max-h-[320px] overflow-auto rounded-xl border p-4"
            style={{
              background: "var(--surface-1)",
              borderColor: "var(--line)",
            }}
          >
            <pre
              className="font-mono text-[12px] leading-relaxed"
              style={{ color: "var(--fg-2)" }}
            >
              {JSON.stringify(report.scanResult, null, 2).slice(0, 3000)}
              {JSON.stringify(report.scanResult, null, 2).length > 3000
                ? "\n\n… (truncated — download for full JSON)"
                : ""}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

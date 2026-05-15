"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Code2,
  FileJson2,
  Loader2,
  Play,
  Radar,
  RefreshCcw,
  UploadCloud,
} from "lucide-react";
import { TorqaLogoScanning } from "@/components/torqa-logo";
import { ScanReportView } from "@/components/scan-report-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ScanApiSuccess, ScanSource } from "@/lib/scan-engine";
import { isScanApiSuccess } from "@/lib/scan-api-guards";
import { appendLocalScanNotifications } from "@/lib/notifications-local";
import { extractWorkflowName } from "@/lib/workflow-json";
import { localWorkflowGet } from "@/lib/workflow-templates-local";
import { hasPublicSupabaseUrl } from "@/lib/env";
import {
  canUseFeature,
  getRemainingUsage,
  incrementUsage,
  resetUsage,
  DAILY_LIMITS,
} from "@/lib/usage-limits";
import { ScanOnboardingTour } from "@/components/scan-onboarding-tour";

const DOCS_TREE_URL = "https://github.com/kadireren7/Torqa/tree/main/docs";
const GITHUB_REPO_URL = "https://github.com/kadireren7/Torqa";

const hasSupabase = hasPublicSupabaseUrl();

type JsonDetectionLabel = "MCP server config" | "AI agent config" | "Unknown JSON";

function detectJsonType(obj: Record<string, unknown>): JsonDetectionLabel {
  const hasTools = Array.isArray(obj.tools);
  const hasServerInfo = "serverInfo" in obj;
  const hasMcpVersion = "mcpVersion" in obj;
  if (hasTools && (hasServerInfo || hasMcpVersion)) return "MCP server config";
  if (Array.isArray(obj.nodes) || "workflow" in obj) return "AI agent config";
  return "Unknown JSON";
}

function SummarySkeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Scanning">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-muted/40 p-5 shadow-inner">
          <div className="mb-3 h-3 w-20 rounded bg-muted-foreground/20" />
          <div className="mb-2 h-8 w-28 rounded bg-muted-foreground/15" />
          <div className="h-2 w-full rounded bg-muted-foreground/10" />
        </div>
      ))}
    </div>
  );
}

async function persistScanToHistory(
  source: ScanSource,
  content: object,
  result: ScanApiSuccess
): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!hasSupabase) {
    return { ok: true, skipped: true };
  }
  const workflowName = extractWorkflowName(content);
  try {
    const res = await fetch("/api/scans", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, result, workflowName }),
    });
    if (res.status === 401 || res.status === 503) return { ok: true, skipped: true };
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export function ScanPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jsonText, setJsonText] = useState("");
  const [source, setSource] = useState<ScanSource | "auto">("auto");
  const [detectedSource, setDetectedSource] = useState<ScanSource | null>(null);
  const [detectionConfidence, setDetectionConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanApiSuccess | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [policySelect, setPolicySelect] = useState("none");
  const [policyTemplates, setPolicyTemplates] = useState<{ slug: string; name: string }[]>([]);
  const [workspacePolicies, setWorkspacePolicies] = useState<{ id: string; name: string }[]>([]);
  const [policyPacks, setPolicyPacks] = useState<{ id: string; name: string; level: string; sourceType: string | null }[]>([]);
  const [policyPackSelect, setPolicyPackSelect] = useState("none");
  const [scannedContent, setScannedContent] = useState<unknown>(null);
  const [entryNotice, setEntryNotice] = useState<string | null>(null);
  const sampleBootstrapDone = useRef(false);

  // Usage limits
  const [scansRemaining, setScansRemaining] = useState<number>(DAILY_LIMITS.scan);
  const [scanLimitReached, setScanLimitReached] = useState(false);

  // Drag-and-drop
  const [isDragging, setIsDragging] = useState(false);
  const [detectedJsonType, setDetectedJsonType] = useState<JsonDetectionLabel | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setScansRemaining(getRemainingUsage("scan"));
    setScanLimitReached(!canUseFeature("scan"));
  }, []);

  const libraryId = searchParams.get("library")?.trim() ?? "";
  const projectSlug = searchParams.get("project")?.trim() ?? "";
  const sampleParam = searchParams.get("sample")?.trim() ?? "";
  const sampleSourceParam = searchParams.get("source")?.trim() ?? "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tplRes = await fetch("/api/policy-templates");
        if (cancelled || !tplRes.ok) return;
        const j = (await tplRes.json()) as { templates?: { slug?: string; name?: string }[] };
        const list = Array.isArray(j.templates)
          ? j.templates
              .filter((t) => typeof t.slug === "string" && typeof t.name === "string")
              .map((t) => ({ slug: t.slug as string, name: t.name as string }))
          : [];
        setPolicyTemplates(list);
      } catch {
        /* ignore */
      }
      if (!hasSupabase || cancelled) return;
      try {
        const polRes = await fetch("/api/workspace-policies", { credentials: "include" });
        if (cancelled || !polRes.ok) return;
        const j = (await polRes.json()) as { policies?: { id?: string; name?: string }[] };
        const plist = Array.isArray(j.policies)
          ? j.policies
              .filter((p) => typeof p.id === "string" && typeof p.name === "string")
              .map((p) => ({ id: p.id as string, name: p.name as string }))
          : [];
        setWorkspacePolicies(plist);
      } catch {
        /* ignore */
      }
      try {
        const packRes = await fetch("/api/policy-packs", { credentials: "include" });
        if (cancelled || !packRes.ok) return;
        const j = (await packRes.json()) as {
          items?: { id?: string; name?: string; level?: string; sourceType?: string | null }[];
        };
        const list = Array.isArray(j.items)
          ? j.items
              .filter((p) => typeof p.id === "string" && typeof p.name === "string")
              .map((p) => ({
                id: p.id as string,
                name: p.name as string,
                level: typeof p.level === "string" ? p.level : "workspace",
                sourceType: typeof p.sourceType === "string" ? p.sourceType : null,
              }))
          : [];
        setPolicyPacks(list);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!libraryId) return;
    let cancelled = false;
    void (async () => {
      let content: Record<string, unknown> | null = null;
      let src: ScanSource = "n8n";
      if (hasSupabase) {
        try {
          const res = await fetch(`/api/workflow-templates/${encodeURIComponent(libraryId)}`, {
            credentials: "include",
          });
          if (res.ok) {
            const d = (await res.json()) as {
              content?: unknown;
              source?: string;
            };
            if (d.content && typeof d.content === "object" && !Array.isArray(d.content)) {
              content = d.content as Record<string, unknown>;
              if (d.source === "n8n" || d.source === "generic") src = d.source;
            }
          }
        } catch {
          /* try local */
        }
      }
      if (!content) {
        const row = localWorkflowGet(libraryId);
        if (row) {
          content = row.content;
          src = row.source;
        }
      }
      if (cancelled) return;
      if (content) {
        setJsonText(JSON.stringify(content, null, 2));
        setSource(src);
        setError(null);
        setResult(null);
        setSaveNotice(null);
        setEntryNotice(null);
      } else {
        setError("Could not load that workflow from your library.");
      }
      router.replace("/scan", { scroll: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryId, router]);

  const runScan = useCallback(async () => {
    setError(null);
    setResult(null);
    setSaveNotice(null);
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setError("Paste JSON or upload a file first.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setError("Invalid JSON — fix syntax and try again.");
      return;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("Root JSON value must be an object (e.g. a workflow export), not an array or primitive.");
      return;
    }
    const contentObj = parsed as object;

    // Increment usage for local demo tracking (non-blocking)
    const newState = incrementUsage("scan");
    setScansRemaining(Math.max(0, DAILY_LIMITS.scan - newState.scan));
    setScanLimitReached(!canUseFeature("scan"));

    setIsScanning(true);
    try {
      const scanBody: Record<string, unknown> = { source, content: parsed };
      setDetectedSource(null);
      setDetectionConfidence(null);
      if (policySelect.startsWith("template:")) {
        scanBody.policyTemplateSlug = policySelect.slice("template:".length);
      } else if (policySelect.startsWith("workspace:")) {
        scanBody.workspacePolicyId = policySelect.slice("workspace:".length);
      }
      if (policyPackSelect !== "none") {
        scanBody.policyPackId = policyPackSelect;
      }
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanBody),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setError("Invalid response from server.");
        return;
      }
      if (!res.ok) {
        const errObj = data && typeof data === "object" ? (data as { error?: unknown; requestId?: unknown }) : null;
        const msg =
          errObj && typeof errObj.error === "string"
            ? errObj.error
            : `Scan failed (${res.status}).`;
        const ref =
          errObj && typeof errObj.requestId === "string" && errObj.requestId.trim()
            ? ` Reference: ${errObj.requestId.trim()}`
            : "";
        setError(`${msg}${ref} Tip: verify source type, JSON shape, and engine mode settings before retrying.`);
        return;
      }
      if (!isScanApiSuccess(data)) {
        setError("Unexpected response shape from server.");
        return;
      }
      setResult(data);
      setScannedContent(parsed);
      if (data.detection) {
        setDetectedSource(data.source);
        setDetectionConfidence(data.detection.confidence);
      }
      const resolvedSource = data.source;
      if (!hasSupabase) {
        appendLocalScanNotifications(data, resolvedSource);
      }
      const persisted = await persistScanToHistory(resolvedSource, contentObj, data);
      if (persisted.ok && !persisted.skipped) {
        setSaveNotice("Saved to your scan history.");
      }
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setIsScanning(false);
    }
  }, [jsonText, source, policySelect, policyPackSelect]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setJsonError(null);
    setResult(null);
    setSaveNotice(null);
    setEntryNotice(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setJsonText(text);
      // Try to detect type
      try {
        const p = JSON.parse(text);
        if (p && typeof p === "object" && !Array.isArray(p)) {
          setDetectedJsonType(detectJsonType(p as Record<string, unknown>));
        } else {
          setDetectedJsonType(null);
        }
      } catch {
        setDetectedJsonType(null);
      }
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setJsonError("Only .json files are supported.");
      return;
    }
    setError(null);
    setJsonError(null);
    setResult(null);
    setSaveNotice(null);
    setEntryNotice(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setJsonText(text);
      try {
        const p = JSON.parse(text);
        if (p && typeof p === "object" && !Array.isArray(p)) {
          setDetectedJsonType(detectJsonType(p as Record<string, unknown>));
          setJsonError(null);
        } else {
          setDetectedJsonType(null);
          setJsonError("Root value must be a JSON object, not an array or primitive.");
        }
      } catch {
        setDetectedJsonType(null);
        setJsonError("Invalid JSON — file contains a syntax error.");
      }
    };
    reader.onerror = () => setJsonError("Could not read the file.");
    reader.readAsText(file, "utf-8");
  }, []);

  const loadSample = useCallback(async (
    name:
      | "minimal_n8n"
      | "customer_support_n8n"
      | "make_scenario"
      | "zapier_zap"
      | "lambda_function"
      | "unsafe_mcp",
    sourceHint: ScanSource | "auto" = "auto",
    notice?: string
  ) => {
    setLoadingSample(name);
    setError(null);
    setResult(null);
    setSaveNotice(null);
    setEntryNotice(null);
    setSource(sourceHint);
    try {
      const res = await fetch(`/scan-samples/${name}.json`);
      if (!res.ok) throw new Error("fetch failed");
      const text = await res.text();
      setJsonText(text);
      if (notice) setEntryNotice(notice);
    } catch {
      setEntryNotice(null);
      setError("Could not load sample JSON.");
    } finally {
      setLoadingSample(null);
    }
  }, []);

  useEffect(() => {
    if (!sampleParam || sampleBootstrapDone.current) return;
    const validSamples = new Set([
      "minimal_n8n",
      "customer_support_n8n",
      "make_scenario",
      "zapier_zap",
      "lambda_function",
      "unsafe_mcp",
    ]);
    if (!validSamples.has(sampleParam)) return;
    sampleBootstrapDone.current = true;
    const sourceHint: ScanSource | "auto" =
      sampleSourceParam === "n8n" ||
      sampleSourceParam === "make" ||
      sampleSourceParam === "zapier" ||
      sampleSourceParam === "lambda" ||
      sampleSourceParam === "github" ||
      sampleSourceParam === "ai-agent" ||
      sampleSourceParam === "generic" ||
      sampleSourceParam === "mcp"
        ? sampleSourceParam
        : "auto";
    const sampleNotice = sampleParam === "unsafe_mcp"
      ? "Unsafe MCP demo loaded — this config has intentional security violations. Click Run scan to see findings."
      : "Demo workflow loaded. Click Run scan to generate your first report.";
    void loadSample(
      sampleParam as "minimal_n8n" | "customer_support_n8n" | "make_scenario" | "zapier_zap" | "lambda_function" | "unsafe_mcp",
      sourceHint,
      sampleNotice
    );
  }, [loadSample, sampleParam, sampleSourceParam]);

  const busy = isScanning || loadingSample !== null;

  return (
    <div className="space-y-10 pb-8 sm:space-y-12 sm:pb-12">
      <ScanOnboardingTour />
      <div className="space-y-3 border-b border-border/60 pb-8 sm:pb-10">
        {projectSlug ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <span>
              Scanning in context of project{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{projectSlug}</code>
            </span>
            <Link href={`/projects/${encodeURIComponent(projectSlug)}`} className="font-medium text-primary hover:underline">
              Project details →
            </Link>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MCP Security</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              MCP Config Scanner
            </h1>
            <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Upload or paste your MCP server config, run a deterministic scan, and review findings with fix guidance.{" "}
              Uses{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">POST /api/scan</code>
              {" "}— results include engine mode (real vs preview/fallback). For full validation, use the CLI.
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href="/reports" className="font-medium text-primary hover:underline">
                View local reports →
              </Link>
              <Link href="/policies" className="font-medium text-primary hover:underline">
                Tool safety policies →
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:max-w-[240px] sm:flex-col sm:items-stretch sm:text-left">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Radar className="h-3.5 w-3.5 shrink-0 text-primary" />
              Server-side
            </span>
            <span className="leading-snug">Server analysis can be real engine or preview heuristic depending on provider mode.</span>
          </div>
        </div>

        {!hasSupabase ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-foreground">Local demo mode</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Scans still run, but shared history, saved reports, and source connections stay unavailable until cloud mode is enabled.
            </p>
          </div>
        ) : null}

        {/* Usage badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs">
            <span className="font-medium text-foreground">Local demo limits</span>
            <span className="text-muted-foreground">·</span>
            <span className={scansRemaining === 0 ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
              Scans today: {DAILY_LIMITS.scan - scansRemaining}/{DAILY_LIMITS.scan}
            </span>
          </div>
          {scanLimitReached && (
            <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs">
              Limit reached
            </Badge>
          )}
        </div>
      </div>

      {/* Limit-reached card */}
      {scanLimitReached ? (
        <Card className="border-rose-500/30 bg-rose-500/[0.05]">
          <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-300">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Daily scan limit reached
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                You&apos;ve reached today&apos;s free local demo limit (3 scans/day). Come back tomorrow, reset the demo counter, or join early access for more quota.
              </p>
              <Link
                href="/waitlist"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Join early access for more scans →
              </Link>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 border-rose-500/30 text-rose-300 hover:border-rose-500/50"
              onClick={() => {
                resetUsage();
                setScansRemaining(DAILY_LIMITS.scan);
                setScanLimitReached(false);
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              Reset local demo data
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 px-5 py-5 sm:px-6 sm:py-6">
          <CardTitle className="text-lg font-semibold sm:text-xl">Input</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            JSON file, paste area, and source hint for heuristics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-5 py-6 sm:space-y-8 sm:px-6 sm:py-8">
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">New here?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Load the unsafe MCP demo first, then click <span className="font-medium text-foreground">Run scan</span> to see real findings in under 2 minutes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void loadSample(
                      "unsafe_mcp",
                      "mcp",
                      "Unsafe MCP demo loaded — this config has intentional security violations. Click Run scan to see findings."
                    )
                  }
                >
                  Try unsafe MCP demo
                </Button>
                <Button asChild type="button" size="sm" variant="outline">
                  <Link href="/reports">View local reports</Link>
                </Button>
              </div>
            </div>
          </div>

          {entryNotice ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
              {entryNotice}
            </div>
          ) : null}

          {/* Drag-and-drop zone */}
          <div
            role="region"
            aria-label="Drop zone for JSON files"
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-muted/10"}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("scan-file-hidden")?.click()}
          >
            <UploadCloud className={`h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground/60"}`} aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">
                {isDragging ? "Drop the .json file here" : "Drag & drop a .json file"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">or click to browse</p>
            </div>
            {detectedJsonType && (
              <Badge
                variant="outline"
                className={
                  detectedJsonType === "MCP server config"
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                    : detectedJsonType === "AI agent config"
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                      : "border-border/60 text-muted-foreground"
                }
              >
                Auto-detected: {detectedJsonType}
              </Badge>
            )}
            {jsonError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {jsonError}
              </p>
            )}
            <input
              id="scan-file-hidden"
              type="file"
              accept="application/json,.json"
              onChange={onFile}
              disabled={busy}
              className="hidden"
              aria-hidden
            />
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="scan-file" className="text-sm font-medium">
                JSON file (file picker)
              </Label>
              <input
                id="scan-file"
                type="file"
                accept="application/json,.json"
                onChange={onFile}
                disabled={busy}
                className="block w-full max-w-md cursor-pointer text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full justify-center sm:w-auto"
                disabled={busy}
                onClick={() => loadSample("unsafe_mcp", "mcp", "Unsafe MCP demo loaded — intentional violations. Click Run scan to see findings.")}
              >
                {loadingSample === "unsafe_mcp" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson2 className="mr-2 h-4 w-4" />
                )}
                Unsafe MCP demo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full justify-center sm:w-auto"
                disabled={busy}
                onClick={() => loadSample("minimal_n8n", "n8n")}
              >
                {loadingSample === "minimal_n8n" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson2 className="mr-2 h-4 w-4" />
                )}
                Minimal n8n
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full justify-center sm:w-auto"
                disabled={busy}
                onClick={() => loadSample("make_scenario", "auto")}
              >
                {loadingSample === "make_scenario" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson2 className="mr-2 h-4 w-4" />
                )}
                Make.com sample
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full justify-center sm:w-auto"
                disabled={busy}
                onClick={() => loadSample("zapier_zap", "auto")}
              >
                {loadingSample === "zapier_zap" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson2 className="mr-2 h-4 w-4" />
                )}
                Zapier sample
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full justify-center sm:w-auto"
                disabled={busy}
                onClick={() => loadSample("lambda_function", "auto")}
              >
                {loadingSample === "lambda_function" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson2 className="mr-2 h-4 w-4" />
                )}
                Lambda sample
              </Button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="scan-source" className="text-sm font-medium">
                Source
              </Label>
              <select
                id="scan-source"
                value={source}
                disabled={busy}
                onChange={(e) => setSource(e.target.value as ScanSource | "auto")}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="auto">Auto-detect (recommended)</option>
                <option value="mcp">MCP server config / tool manifest</option>
                <option value="n8n">n8n workflow export</option>
                <option value="make">Make.com scenario</option>
                <option value="zapier">Zapier zap</option>
                <option value="lambda">AWS Lambda / SAM</option>
                <option value="github">GitHub Actions workflow</option>
                <option value="ai-agent">AI Agent JSON</option>
                <option value="generic">Generic JSON</option>
              </select>
              {detectedSource && source === "auto" ? (
                <p className="text-xs text-muted-foreground">
                  Detected as <span className="font-mono font-medium text-foreground">{detectedSource}</span>
                  {detectionConfidence !== null
                    ? ` · confidence ${Math.round(detectionConfidence * 100)}%`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="scan-policy" className="text-sm font-medium">
                Policy (optional)
              </Label>
              <select
                id="scan-policy"
                value={policySelect}
                disabled={busy}
                onChange={(e) => setPolicySelect(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="none">None — engine scan only</option>
                {policyTemplates.length > 0 ? (
                  <optgroup label="Built-in templates">
                    {policyTemplates.map((t) => (
                      <option key={t.slug} value={`template:${t.slug}`}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {workspacePolicies.length > 0 ? (
                  <optgroup label="Workspace policies">
                    {workspacePolicies.map((p) => (
                      <option key={p.id} value={`workspace:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                When set, the API attaches a governance verdict (PASS / WARN / FAIL) without changing the underlying
                scan.{" "}
                <Link href="/policies" className="font-medium text-primary hover:underline">
                  Manage policies
                </Link>
              </p>
            </div>
          </div>

          {policyPacks.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="scan-policy-pack" className="text-sm font-medium">
                  Policy pack v2 (optional)
                </Label>
                <select
                  id="scan-policy-pack"
                  value={policyPackSelect}
                  disabled={busy}
                  onChange={(e) => setPolicyPackSelect(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="none">None — no v2 evaluation</option>
                  {policyPacks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.level === "source" ? `source · ${p.sourceType ?? ""}` : "workspace"}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Attaches a programmable verdict computed from custom rules (independent from the threshold policy
                  above).{" "}
                  <Link href="/policies/packs" className="font-medium text-primary hover:underline">
                    Manage packs
                  </Link>
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="scan-json" className="text-sm font-medium">
              Paste JSON
            </Label>
            <textarea
              id="scan-json"
              value={jsonText}
              onChange={(e) => {
                setEntryNotice(null);
                setJsonText(e.target.value);
              }}
              disabled={busy}
              placeholder='{ "name": "…", "nodes": [ … ] }'
              spellCheck={false}
              rows={12}
              className="min-h-[200px] w-full resize-y rounded-lg border border-input bg-background/50 px-3 py-3 font-mono text-[13px] leading-relaxed text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[240px] sm:text-sm"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              size="lg"
              onClick={() => void runScan()}
              disabled={busy}
              className="h-12 w-full gap-2 bg-cyan-600 text-sm font-semibold text-white hover:bg-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400 sm:w-auto sm:min-w-[180px]"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run scan
                </>
              )}
            </Button>
            {isScanning && (
              <p className="text-center text-xs text-muted-foreground sm:text-left">Calling server scan…</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mobile sticky action bar — shown when result has critical/high findings */}
      {result && !isScanning && (result.totals.high > 0) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-11 flex-1 bg-cyan-600 text-sm font-semibold text-white hover:bg-cyan-500"
              onClick={() => void runScan()}
              disabled={busy}
            >
              Re-scan
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 text-sm"
              onClick={() => {
                const el = document.querySelector("[data-findings-section]");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View findings
            </Button>
          </div>
        </div>
      )}

      {(isScanning || result) && (
        <section className="space-y-6 sm:space-y-8" aria-live="polite">
          {isScanning && (
            <div
              className="rounded-xl px-4 py-5 sm:px-6"
              style={{ background: "var(--surface-1)", border: "1px solid rgba(249,115,22,0.18)" }}
            >
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                <TorqaLogoScanning size={32} />
                <div className="text-center sm:text-left">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    Scanning workflow…
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
                    Applying governance rules and policy pack
                  </p>
                </div>
              </div>
            </div>
          )}

          {isScanning && <SummarySkeleton />}

          {result && !isScanning && (
            <ScanReportView
              result={result}
              notice={saveNotice}
              onRerunScan={() => void runScan()}
              governance={
                scannedContent !== null
                  ? {
                      content: scannedContent,
                      source: result.source,
                      onResolved: () => {
                        setSaveNotice(
                          "Action recorded. Re-run the scan to refresh the gate decision against the latest accepted-risks and applied fixes."
                        );
                      },
                    }
                  : null
              }
            />
          )}

          {result && !isScanning ? (
            <Card className="border-border/70 bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Next step</CardTitle>
                <CardDescription>
                  {hasSupabase
                    ? "Review findings, apply fixes, and export a hardened config for your agents."
                    : "Browse tool safety policies or scan another MCP tool config. Local reports are saved in your browser."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/scan">Scan another config</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={saveNotice ? "/scan/history" : "/reports"}>
                    {saveNotice ? "Open scan history" : "View local reports"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </section>
      )}

      <footer className="mt-4 border-t border-border/70 pt-8 sm:mt-6 sm:pt-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            Torqa dashboard · engine mode shown on each scan result
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
            <Link
              href={DOCS_TREE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Docs
            </Link>
            <Link
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Code2 className="h-4 w-4" aria-hidden />
              GitHub
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

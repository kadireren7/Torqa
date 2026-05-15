"use client";

import { useState, useCallback } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCopy,
  Download,
  GitBranchIcon,
  Info,
  Loader2,
  Shield,
  ShieldCheck,
  TriangleAlert,
  WrenchIcon,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ScanApiSuccess, ScanDecision } from "@/lib/scan-engine";
import { runBulkHardening } from "@/lib/remediation/bulk-hardening";
import type { BulkHardeningMode, BulkHardeningResult, BulkOperationGroup } from "@/lib/remediation/bulk-types";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decisionBg(d: ScanDecision): string {
  if (d === "PASS") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (d === "NEEDS REVIEW") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-rose-500/40 bg-rose-500/10 text-rose-200";
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-300";
  if (score >= 40) return "text-amber-300";
  return "text-rose-300";
}

function labelStyles(label: BulkOperationGroup["label"]): string {
  if (label === "auto-applied safe default") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (label === "needs manual refinement") return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  return "bg-rose-500/10 text-rose-300 border-rose-500/30";
}

function ruleLabel(ruleId: string): string {
  return ruleId.replace("mcp.", "").replace(/_/g, " ");
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyJson(data: unknown) {
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
}

// ─── Mode selector ────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: BulkHardeningMode; label: string; description: string }[] = [
  {
    value: "critical_only",
    label: "Critical only",
    description: "Fix findings that would cause an immediate FAIL decision.",
  },
  {
    value: "critical_and_high",
    label: "Critical + High",
    description: "Fix all critical and high severity findings. Recommended.",
  },
  {
    value: "all_fixable",
    label: "All fixable",
    description: "Apply safe defaults to every finding with an automated patch.",
  },
];

// ─── Score card ───────────────────────────────────────────────────────────────

function ScoreCard({
  label,
  score,
  decision,
}: {
  label: string;
  score: number;
  decision: ScanDecision;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("text-3xl font-bold tabular-nums", scoreColor(score))}>{score}</span>
      <Badge variant="outline" className={cn("w-fit text-[10px]", decisionBg(decision))}>
        {decision}
      </Badge>
    </div>
  );
}

// ─── Collapsible operation group ──────────────────────────────────────────────

function OperationGroupCard({ group }: { group: BulkOperationGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-[11px] text-foreground">{group.toolOrTarget}</code>
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                labelStyles(group.label)
              )}
            >
              {group.label}
            </span>
          </div>
          <p className="text-[11px] capitalize text-muted-foreground">{ruleLabel(group.ruleId)}</p>
          {group.operations.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {group.operations.length} operation{group.operations.length !== 1 ? "s" : ""}
            </p>
          )}
          {group.label === "cannot be safely auto-fixed" && (
            <p className="text-[11px] text-rose-400">No automated patch available — manual fix required.</p>
          )}
        </div>
        <ChevronDown
          className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-3">
          {group.operations.length === 0 && (
            <p className="text-xs text-muted-foreground">No operations generated for this finding.</p>
          )}
          {group.operations.map((op, i) => (
            <div key={i} className="space-y-1 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono font-semibold",
                    op.op === "replace"
                      ? "border-amber-500/40 text-amber-300"
                      : op.op === "remove"
                        ? "border-rose-500/40 text-rose-300"
                        : "border-cyan-500/40 text-cyan-300"
                  )}
                >
                  {op.op}
                </Badge>
                <code className="font-mono text-[11px] text-foreground">{op.path}</code>
              </div>
              {op.value !== undefined && (
                <p className="font-mono text-[11px] text-muted-foreground break-all">
                  → {JSON.stringify(op.value)}
                </p>
              )}
              {op.before !== undefined && (
                <p className="font-mono text-[11px] text-muted-foreground/60 break-all line-through">
                  {JSON.stringify(op.before)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/80">{op.reason}</p>
            </div>
          ))}
          {group.warnings.length > 0 && (
            <div className="space-y-1">
              {group.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                  <p className="text-[11px] text-amber-300">{w}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Results view ─────────────────────────────────────────────────────────────

function HardeningResults({
  result,
  onCopyPatch,
  onDownloadPatch,
  onCopyConfig,
  onDownloadConfig,
  copyState,
}: {
  result: BulkHardeningResult;
  onCopyPatch: () => void;
  onDownloadPatch: () => void;
  onCopyConfig: () => void;
  onDownloadConfig: () => void;
  copyState: "idle" | "patch" | "config";
}) {
  const { previewResult, selectedFindings, skippedFindings, operationGroups, warnings, manualReviewRequired } = result;
  const scoreDelta = previewResult.afterScore - previewResult.beforeScore;
  const resolved = previewResult.resolvedFindingIds.length;
  const remaining = previewResult.remainingFindings.length;

  return (
    <div className="space-y-6">
      {/* Safe defaults notice */}
      <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-200">Safe defaults applied — manual review required</p>
          <p className="text-xs leading-relaxed text-amber-300/80">
            All patches use conservative, security-positive defaults. Some settings (like allowedCommands, allowedTables,
            allowedPaths) are intentionally left unconfigured and must be set for your specific use case before production use.
          </p>
        </div>
      </div>

      {/* Score comparison */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreCard label="Before" score={previewResult.beforeScore} decision={previewResult.beforeDecision} />
        <ScoreCard label="After hardening" score={previewResult.afterScore} decision={previewResult.afterDecision} />
      </div>
      {scoreDelta > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <p className="text-sm font-medium text-emerald-300">
            Trust index improved by +{scoreDelta} points
          </p>
        </div>
      )}

      {/* Finding counts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-3 text-center">
          <p className="text-2xl font-bold text-foreground">{selectedFindings.length}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected</p>
        </div>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-3 text-center">
          <p className="text-2xl font-bold text-emerald-300">{resolved}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resolved</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-3 text-center">
          <p className={cn("text-2xl font-bold", remaining > 0 ? "text-amber-300" : "text-emerald-300")}>{remaining}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Remaining</p>
        </div>
      </div>

      {skippedFindings.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Skipped ({skippedFindings.length})
          </p>
          <ul className="mt-2 space-y-1">
            {skippedFindings.map((s, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0 text-muted-foreground/50">•</span>
                <span>
                  <code className="font-mono">{s.target}</code> — {s.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Operations */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Operations ({result.combinedOperations.length} total, {operationGroups.length} groups)
        </p>
        <div className="space-y-2">
          {operationGroups.map((group, i) => (
            <OperationGroupCard key={i} group={group} />
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Warnings</p>
          <div className="space-y-1.5">
            {warnings.slice(0, 10).map((w, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                <p className="text-[11px] text-amber-300">{w}</p>
              </div>
            ))}
            {warnings.length > 10 && (
              <p className="text-[11px] text-muted-foreground px-1">+{warnings.length - 10} more warnings in the patch JSON.</p>
            )}
          </div>
        </div>
      )}

      {/* Manual review items */}
      {manualReviewRequired.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manual review required</p>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3">
            <ul className="space-y-1.5">
              {manualReviewRequired.slice(0, 6).map((item, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-rose-300">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
              {manualReviewRequired.length > 6 && (
                <li className="text-[11px] text-muted-foreground">+{manualReviewRequired.length - 6} more items.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      <Separator />

      {/* Export actions */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Export</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={onCopyPatch}
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
            {copyState === "patch" ? "Copied!" : "Copy full patch"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={onDownloadPatch}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download patch .json
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={onCopyConfig}
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
            {copyState === "config" ? "Copied!" : "Copy hardened config"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={onDownloadConfig}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download hardened config
          </Button>
        </div>

        {/* Create PR — planned */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="h-9 w-full gap-1.5 border-amber-500/40 bg-amber-500/[0.06] text-xs text-amber-300 opacity-80"
          title="GitHub PR creation requires OAuth — planned for a future release"
        >
          <GitBranchIcon className="h-3.5 w-3.5" aria-hidden />
          Create PR
          <span className="ml-auto rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            planned
          </span>
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export type BulkHardeningWorkspaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanResult: ScanApiSuccess | null;
  mcpContent?: unknown;
};

export function BulkHardeningWorkspace({
  open,
  onOpenChange,
  scanResult,
  mcpContent,
}: BulkHardeningWorkspaceProps) {
  const [mode, setMode] = useState<BulkHardeningMode>("critical_and_high");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BulkHardeningResult | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "patch" | "config">("idle");

  const criticalCount = scanResult?.findings.filter((f) => f.severity === "critical").length ?? 0;
  const highCount = scanResult?.findings.filter((f) => f.severity === "high").length ?? 0;

  const handleRun = useCallback(() => {
    if (!scanResult || !mcpContent) return;
    setIsRunning(true);
    setResult(null);

    // Use setTimeout to let the UI render the loading state first
    setTimeout(() => {
      try {
        const r = runBulkHardening({
          originalConfig: mcpContent,
          findings: scanResult.findings,
          mode,
          safeDefaults: true,
        });
        setResult(r);
      } finally {
        setIsRunning(false);
      }
    }, 0);
  }, [scanResult, mcpContent, mode]);

  const handleReset = useCallback(() => {
    setResult(null);
  }, []);

  const handleCopyPatch = useCallback(async () => {
    if (!result) return;
    await copyJson(result.combinedOperations);
    setCopyState("patch");
    setTimeout(() => setCopyState("idle"), 2000);
  }, [result]);

  const handleDownloadPatch = useCallback(() => {
    if (!result) return;
    downloadJson(result.combinedOperations, `torqa-mcp-patch-${result.id}.json`);
  }, [result]);

  const handleCopyConfig = useCallback(async () => {
    if (!result) return;
    await copyJson(result.hardenedConfig);
    setCopyState("config");
    setTimeout(() => setCopyState("idle"), 2000);
  }, [result]);

  const handleDownloadConfig = useCallback(() => {
    if (!result) return;
    downloadJson(result.hardenedConfig, `torqa-mcp-hardened-${result.id}.json`);
  }, [result]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-400" aria-hidden />
            <SheetTitle className="text-base font-semibold">Harden MCP config</SheetTitle>
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
            Apply safe defaults to critical and high findings in one step.
            {criticalCount > 0 && ` ${criticalCount} critical`}
            {criticalCount > 0 && highCount > 0 && ","}
            {highCount > 0 && ` ${highCount} high`}
            {(criticalCount > 0 || highCount > 0) && " findings detected."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {!result && (
            <>
              {/* Mode selector */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scope</p>
                <div className="space-y-2">
                  {MODE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                        mode === opt.value
                          ? "border-cyan-500/50 bg-cyan-500/[0.08]"
                          : "border-border/60 bg-card/40 hover:border-border"
                      )}
                    >
                      <input
                        type="radio"
                        name="harden-mode"
                        value={opt.value}
                        checked={mode === opt.value}
                        onChange={() => setMode(opt.value)}
                        className="mt-0.5 accent-cyan-500"
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Safe defaults notice */}
              <div className="flex gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Safe defaults — no LLM calls</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Torqa uses deterministic, rule-based safe defaults for each finding type.
                    No AI inference, no external API calls. All patches are previewed in memory
                    before download — your config is never modified remotely.
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Some patches (allowedCommands, allowedPaths, allowedTables) require manual
                    configuration after download to match your environment.
                  </p>
                </div>
              </div>

              {/* Run button */}
              <Button
                type="button"
                className="h-10 w-full gap-2 bg-cyan-600 text-white hover:bg-cyan-500"
                onClick={handleRun}
                disabled={isRunning || !mcpContent}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <WrenchIcon className="h-4 w-4" aria-hidden />
                    Run hardening
                  </>
                )}
              </Button>

              {!mcpContent && (
                <p className="text-center text-xs text-amber-400">
                  Run a scan first — original MCP config is required to generate patches.
                </p>
              )}
            </>
          )}

          {result && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Hardening complete
                  <span className="ml-2 text-xs text-muted-foreground capitalize">({result.mode.replace("_", " ")})</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleReset}
                >
                  Change scope
                </Button>
              </div>
              <HardeningResults
                result={result}
                onCopyPatch={handleCopyPatch}
                onDownloadPatch={handleDownloadPatch}
                onCopyConfig={handleCopyConfig}
                onDownloadConfig={handleDownloadConfig}
                copyState={copyState}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

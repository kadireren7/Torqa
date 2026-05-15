"use client";

import { useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Info,
  RefreshCcw,
  Shield,
  Sparkles,
  WrenchIcon,
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ScanApiSuccess, ScanFinding } from "@/lib/scan-engine";
import { getQuestionsForRule } from "@/lib/remediation/questions";
import { generateRemediationPlan } from "@/lib/remediation/plan-generator";
import { generatePatch } from "@/lib/remediation/patch-generator";
import { previewPatch } from "@/lib/remediation/patch-preview";
import type { RemediationAnswer, RemediationPlan } from "@/lib/remediation/types";
import type { GeneratedPatch, PatchPreviewResult } from "@/lib/remediation/patch-types";
import { cn } from "@/lib/utils";

// ─── Why-it-matters lookup ─────────────────────────────────────────────────────

const WHY_IT_MATTERS: Record<string, string> = {
  "mcp.exec_without_allowlist":
    "Shell execution without restrictions is one of the most dangerous capabilities in an MCP server. Any agent or process with access can run arbitrary code — deleting files, stealing secrets, establishing backdoors, or pivoting to internal network resources.",
  "mcp.unrestricted_filesystem_access":
    "Unrestricted filesystem access allows agents to read sensitive files like /etc/passwd or ~/.ssh/id_rsa, and write access without path constraints enables overwriting arbitrary files including system binaries.",
  "mcp.hardcoded_secret":
    "Secrets in MCP server configs are visible to every agent, user, or process with access to the manifest. Once exposed in logs, version control, or screenshots, a secret must be treated as compromised and rotated immediately.",
  "mcp.overbroad_network_access":
    "A tool with unrestricted URL access can be exploited for SSRF attacks — reaching internal services (databases, metadata APIs, auth servers) that should not be reachable, or exfiltrating data to attacker-controlled servers.",
  "mcp.missing_input_validation":
    "Without input validation, agents can pass arbitrary data — oversized strings, injection payloads, or unexpected types — that get executed or stored downstream, leading to runtime errors or security vulnerabilities in production.",
  "mcp.ambiguous_tool_description":
    "AI agents rely on tool descriptions to decide when and how to use them. Vague descriptions lead to tools being called at wrong times, with wrong arguments, or more frequently than intended — amplifying blast radius and side effects.",
  "mcp.production_deploy_without_confirmation":
    "Production deployments triggered autonomously by an AI agent can cause immediate, widespread outages. A single misconfigured deploy can take down services, corrupt data, or expose security holes to millions of users with no human review.",
  "mcp.database_write_without_scope":
    "Unrestricted database write access allows agents to modify or destroy any data. Queries like DROP TABLE, DELETE FROM users, or UPDATE accounts SET role='admin' can cause catastrophic, irreversible harm.",
};

function getWhyItMatters(ruleId: string): string {
  return (
    WHY_IT_MATTERS[ruleId] ??
    "This finding represents a security risk that requires remediation before the tool can safely be used in production."
  );
}

// ─── Severity helpers ──────────────────────────────────────────────────────────

function severityBadgeClass(s: ScanFinding["severity"]): string {
  if (s === "critical" || s === "high")
    return "border-rose-500/60 bg-rose-500/15 text-rose-200";
  if (s === "review") return "border-amber-500/60 bg-amber-500/15 text-amber-200";
  return "border-slate-500/50 bg-slate-500/10 text-slate-300";
}

function severityLabel(s: ScanFinding["severity"]): string {
  if (s === "critical" || s === "high") return "Critical";
  if (s === "review") return "Review";
  return "Info";
}

// ─── Stage stepper ─────────────────────────────────────────────────────────────

type Stage = "questions" | "plan" | "patch" | "preview";

const STAGE_LABELS: Record<Stage, string> = {
  questions: "1. Questions",
  plan: "2. Plan",
  patch: "3. Patch",
  preview: "4. Preview",
};

const STAGES: Stage[] = ["questions", "plan", "patch", "preview"];

function StageStepper({ current }: { current: Stage }) {
  const idx = STAGES.indexOf(current);
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              i < idx
                ? "bg-primary/20 text-primary/80"
                : i === idx
                  ? "bg-primary/30 text-primary"
                  : "bg-muted/40 text-muted-foreground/60"
            )}
          >
            {STAGE_LABELS[s]}
          </span>
          {i < STAGES.length - 1 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-hidden />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Question inputs ───────────────────────────────────────────────────────────

type QuestionInputProps = {
  id: string;
  label: string;
  type: "boolean" | "text" | "select" | "multiselect";
  options?: string[];
  placeholder?: string;
  required: boolean;
  value: RemediationAnswer["value"] | undefined;
  onChange: (value: RemediationAnswer["value"]) => void;
};

function QuestionInput({
  id,
  label,
  type,
  options,
  placeholder,
  required,
  value,
  onChange,
}: QuestionInputProps) {
  const labelEl = (
    <Label htmlFor={id} className="text-sm font-medium leading-snug text-foreground">
      {label}
      {required && <span className="ml-1 text-rose-400">*</span>}
    </Label>
  );

  if (type === "boolean") {
    const boolVal = typeof value === "boolean" ? value : null;
    return (
      <div className="space-y-2">
        {labelEl}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              boolVal === true
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                : "border-border/70 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              boolVal === false
                ? "border-rose-500/60 bg-rose-500/15 text-rose-200"
                : "border-border/70 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            No
          </button>
        </div>
      </div>
    );
  }

  if (type === "select" && options) {
    const strVal = typeof value === "string" ? value : "";
    return (
      <div className="space-y-2">
        {labelEl}
        <select
          id={id}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">— select —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "multiselect" && options) {
    const arrVal = Array.isArray(value) ? value : [];
    const toggle = (opt: string) => {
      const next = arrVal.includes(opt) ? arrVal.filter((v) => v !== opt) : [...arrVal, opt];
      onChange(next);
    };
    return (
      <div className="space-y-2">
        {labelEl}
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const selected = arrVal.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/70 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const strVal = typeof value === "string" ? value : "";
  return (
    <div className="space-y-2">
      {labelEl}
      <input
        id={id}
        type="text"
        value={strVal}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}

// ─── Plan view ────────────────────────────────────────────────────────────────

function PlanView({
  plan,
  hasMcpContent,
  onGeneratePatch,
  onBack,
}: {
  plan: RemediationPlan;
  hasMcpContent: boolean;
  onGeneratePatch: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const copyPlan = useCallback(async () => {
    const text = [
      `# Remediation Plan — ${plan.ruleId}`,
      `Target: ${plan.target}`,
      ``,
      `## Summary`,
      plan.summary,
      ``,
      `## Recommended Changes`,
      ...plan.recommendedChanges.map((c) => `- ${c}`),
      ``,
      `## Policy Draft`,
      "```json",
      JSON.stringify(plan.policyDraft, null, 2),
      "```",
      ``,
      `Confidence: ${plan.confidence} | Human review: ${plan.needsHumanReview ? "required" : "optional"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [plan]);

  const confidenceColor =
    plan.confidence === "high"
      ? "text-emerald-400"
      : plan.confidence === "medium"
        ? "text-amber-400"
        : "text-rose-400";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
        <span className="text-sm font-semibold text-foreground">Remediation plan generated</span>
        <span className={cn("ml-auto text-[10px] font-bold uppercase tracking-wider", confidenceColor)}>
          {plan.confidence} confidence
        </span>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">Summary</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{plan.summary}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Recommended changes
        </p>
        <ol className="space-y-2">
          {plan.recommendedChanges.map((change, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted/60 text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <span className="leading-relaxed text-foreground/90">{change}</span>
            </li>
          ))}
        </ol>
      </div>

      {plan.needsHumanReview && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <span>Human review required before applying this plan.</span>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/20">
        <button
          type="button"
          onClick={() => setJsonExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <span>Policy draft JSON</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", jsonExpanded ? "rotate-180" : "")}
            aria-hidden
          />
        </button>
        {jsonExpanded && (
          <pre className="overflow-x-auto rounded-b-lg border-t border-border/50 bg-black/20 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
            {JSON.stringify(plan.policyDraft, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void copyPlan()}
        >
          <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
          {copied ? "Copied!" : "Copy plan"}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onGeneratePatch}
          disabled={!hasMcpContent}
          title={hasMcpContent ? "Generate a JSON patch from this plan" : "MCP config not available for patch generation"}
        >
          <WrenchIcon className="h-3.5 w-3.5" aria-hidden />
          Generate patch
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled
          className="h-8 gap-1.5 border-amber-500/40 bg-amber-500/[0.06] text-xs text-amber-300 opacity-80"
          title="GitHub PR creation requires OAuth — planned for a future release"
        >
          Create PR
          <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            Planned
          </span>
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground"
        onClick={onBack}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Back to questions
      </Button>
    </div>
  );
}

// ─── Patch view ────────────────────────────────────────────────────────────────

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return JSON.stringify(v, null, 2);
}

function OpBadge({ op }: { op: "add" | "replace" | "remove" }) {
  const cls =
    op === "add"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : op === "replace"
        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
        : "border-rose-500/40 bg-rose-500/10 text-rose-300";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase", cls)}>
      {op}
    </span>
  );
}

function PatchView({
  patch,
  hasMcpContent,
  onPreview,
  onBack,
}: {
  patch: GeneratedPatch;
  hasMcpContent: boolean;
  onPreview: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyPatch = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(patch.operations.map((o) => ({
        op: o.op,
        path: o.path,
        ...(o.op !== "remove" ? { value: o.value } : {}),
      })), null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [patch]);

  const downloadPatch = useCallback(() => {
    const data = JSON.stringify(patch.operations.map((o) => ({
      op: o.op,
      path: o.path,
      ...(o.op !== "remove" ? { value: o.value } : {}),
    })), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torqa-patch-${patch.ruleId.replace(/\./g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [patch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <WrenchIcon className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-sm font-semibold text-foreground">Patch generated</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {patch.operations.length} operation{patch.operations.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">Summary</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{patch.summary}</p>
      </div>

      {patch.warnings.length > 0 && (
        <div className="space-y-2">
          {patch.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <span className="text-xs leading-relaxed">{w}</span>
            </div>
          ))}
        </div>
      )}

      {patch.operations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Operations
          </p>
          <div className="space-y-2">
            {patch.operations.map((o, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <OpBadge op={o.op} />
                  <code className="font-mono text-[11px] text-foreground/90">{o.path}</code>
                </div>
                {o.reason && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{o.reason}</p>
                )}
                {o.op !== "remove" && (
                  <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
                    {o.before !== undefined && (
                      <>
                        <span className="text-muted-foreground/70">before</span>
                        <code className="font-mono text-rose-300/90 break-all">
                          {formatValue(o.before)}
                        </code>
                      </>
                    )}
                    <span className="text-muted-foreground/70">after</span>
                    <code className="font-mono text-emerald-300/90 break-all">
                      {formatValue(o.value)}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          No operations generated. Review the warnings above.
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void copyPatch()}
        >
          <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
          {copied ? "Copied!" : "Copy patch JSON"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={downloadPatch}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Download .json
        </Button>
        {patch.canPreview && hasMcpContent && (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onPreview}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Preview after patch
          </Button>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground"
        onClick={onBack}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Back to plan
      </Button>
    </div>
  );
}

// ─── Preview view ──────────────────────────────────────────────────────────────

function ScoreDelta({ before, after }: { before: number; after: number }) {
  const improved = after > before;
  const same = after === before;
  const delta = after - before;

  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Before</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{before}</p>
      </div>
      <ArrowRight
        className={cn(
          "h-5 w-5 shrink-0",
          improved ? "text-emerald-400" : same ? "text-muted-foreground" : "text-rose-400"
        )}
        aria-hidden
      />
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">After</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            improved ? "text-emerald-400" : same ? "text-foreground" : "text-rose-400"
          )}
        >
          {after}
        </p>
      </div>
      {!same && (
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-bold",
            improved ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          )}
        >
          {improved ? "+" : ""}{delta}
        </span>
      )}
    </div>
  );
}

function PreviewView({
  preview,
  onBack,
}: {
  preview: PatchPreviewResult;
  onBack: () => void;
}) {
  const improved = preview.afterScore > preview.beforeScore;
  const resolvedCount = preview.resolvedFindingIds.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-sm font-semibold text-foreground">Preview result</span>
      </div>

      {/* Score comparison */}
      <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Trust index
        </p>
        <ScoreDelta before={preview.beforeScore} after={preview.afterScore} />
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {preview.beforeDecision}
            <ArrowRight className="mx-1 inline h-3 w-3" aria-hidden />
            <span
              className={cn(
                "font-semibold",
                preview.afterDecision === "PASS"
                  ? "text-emerald-300"
                  : preview.afterDecision === "NEEDS REVIEW"
                    ? "text-amber-300"
                    : "text-rose-300"
              )}
            >
              {preview.afterDecision}
            </span>
          </span>
        </div>
      </div>

      {/* Resolved findings */}
      {resolvedCount > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-200">
              {resolvedCount} finding{resolvedCount === 1 ? "" : "s"} resolved
            </p>
            <ul className="mt-1 space-y-0.5">
              {preview.resolvedFindingIds.map((k) => (
                <li key={k} className="font-mono text-[10px] text-emerald-300/80">{k}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <p className="text-sm text-amber-100">
            This patch did not resolve the targeted finding in the preview. A manual fix or more
            specific configuration may be needed.
          </p>
        </div>
      )}

      {/* New findings */}
      {preview.newFindings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.08] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-rose-200">
              {preview.newFindings.length} new finding{preview.newFindings.length === 1 ? "" : "s"} introduced
            </p>
            <p className="mt-0.5 text-xs text-rose-100/80">
              Review the patch operations — the applied changes may have created new issues.
            </p>
          </div>
        </div>
      )}

      {/* Remaining findings count */}
      {preview.remainingFindings.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{preview.remainingFindings.length}</span>{" "}
            finding{preview.remainingFindings.length === 1 ? "" : "s"} still present after patch.
          </p>
        </div>
      )}

      {/* Preview warnings */}
      {preview.warnings.length > 0 && (
        <div className="space-y-2">
          {preview.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <span className="text-xs leading-relaxed text-amber-100">{w}</span>
            </div>
          ))}
        </div>
      )}

      {improved && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-xs leading-relaxed text-foreground/90">
            Applying this patch improves the trust index. Export the patch JSON and apply it to your
            MCP server configuration to resolve these findings in production.
          </p>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground"
        onClick={onBack}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Back to patch
      </Button>
    </div>
  );
}

// ─── Main workspace ────────────────────────────────────────────────────────────

export type RemediationWorkspaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: ScanFinding | null;
  /** Original MCP config content — required for patch generation and preview. */
  mcpContent?: unknown;
  /** Current scan result — used for context (not strictly required). */
  scanResult?: ScanApiSuccess | null;
};

export function RemediationWorkspace({
  open,
  onOpenChange,
  finding,
  mcpContent,
}: RemediationWorkspaceProps) {
  const [stage, setStage] = useState<Stage>("questions");
  const [answers, setAnswers] = useState<RemediationAnswer[]>([]);
  const [plan, setPlan] = useState<RemediationPlan | null>(null);
  const [patch, setPatch] = useState<GeneratedPatch | null>(null);
  const [preview, setPreview] = useState<PatchPreviewResult | null>(null);

  const questions = finding ? getQuestionsForRule(finding.rule_id) : [];

  const setAnswer = useCallback((questionId: string, value: RemediationAnswer["value"]) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { questionId, value };
        return next;
      }
      return [...prev, { questionId, value }];
    });
  }, []);

  const getAnswer = useCallback(
    (questionId: string): RemediationAnswer["value"] | undefined => {
      return answers.find((a) => a.questionId === questionId)?.value;
    },
    [answers]
  );

  const requiredSatisfied = questions
    .filter((q) => q.required)
    .every((q) => {
      const val = getAnswer(q.id);
      if (typeof val === "boolean") return true;
      if (typeof val === "string") return val.trim().length > 0;
      if (Array.isArray(val)) return val.length > 0;
      return false;
    });

  const handleGeneratePlan = useCallback(() => {
    if (!finding) return;
    const generated = generateRemediationPlan(
      `${finding.rule_id}:${finding.target}`,
      finding.rule_id,
      finding.target,
      answers
    );
    setPlan(generated);
    setStage("plan");
  }, [finding, answers]);

  const handleGeneratePatch = useCallback(() => {
    if (!plan || !mcpContent) return;
    const generated = generatePatch(plan, mcpContent);
    setPatch(generated);
    setStage("patch");
  }, [plan, mcpContent]);

  const handlePreview = useCallback(() => {
    if (!patch || !mcpContent) return;
    const result = previewPatch(mcpContent, patch);
    setPreview(result);
    setStage("preview");
  }, [patch, mcpContent]);

  const handleReset = useCallback(() => {
    setAnswers([]);
    setPlan(null);
    setPatch(null);
    setPreview(null);
    setStage("questions");
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) handleReset();
      onOpenChange(v);
    },
    [handleReset, onOpenChange]
  );

  if (!finding) return null;

  const whyItMatters = getWhyItMatters(finding.rule_id);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <SheetTitle className="text-base font-semibold">Fix with Torqa</SheetTitle>
          </div>
          <SheetDescription className="text-xs leading-relaxed">
            Answer the questions below. Torqa builds a structured remediation plan and generates a
            deterministic JSON patch — no AI, no guessing.
          </SheetDescription>
          <div className="pt-1">
            <StageStepper current={stage} />
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Finding context */}
          <div className="border-b border-border/50 bg-muted/[0.06] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-[10px] font-bold uppercase", severityBadgeClass(finding.severity))}
              >
                {severityLabel(finding.severity)}
              </Badge>
              <code className="rounded bg-muted/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {finding.rule_id}
              </code>
            </div>
            <p className="mt-2 font-mono text-sm font-medium text-foreground">{finding.target}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{finding.explanation}</p>

            <Separator className="my-3 bg-border/50" />

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Why it matters
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-100/90">{whyItMatters}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6 px-5 py-5 sm:px-6">
            {/* ── Stage: questions ── */}
            {stage === "questions" && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" aria-hidden />
                    <h3 className="text-sm font-semibold text-foreground">Guided remediation</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Answer the questions below, then click <strong>Generate plan</strong>.
                    Required questions are marked <span className="text-rose-400">*</span>.
                  </p>
                </div>

                <div className="space-y-5">
                  {questions.map((q) => (
                    <QuestionInput
                      key={q.id}
                      id={q.id}
                      label={q.label}
                      type={q.type}
                      options={q.options}
                      placeholder={q.placeholder}
                      required={q.required}
                      value={getAnswer(q.id)}
                      onChange={(val) => setAnswer(q.id, val)}
                    />
                  ))}
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleGeneratePlan}
                    disabled={!requiredSatisfied}
                    className="w-full gap-2 sm:w-auto"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Generate plan
                  </Button>
                  {!requiredSatisfied && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Answer all required questions to generate the plan.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ── Stage: plan ── */}
            {stage === "plan" && plan && (
              <>
                <PlanView
                  plan={plan}
                  hasMcpContent={mcpContent !== undefined}
                  onGeneratePatch={handleGeneratePatch}
                  onBack={() => setStage("questions")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={handleReset}
                >
                  <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                  Start over
                </Button>
              </>
            )}

            {/* ── Stage: patch ── */}
            {stage === "patch" && patch && (
              <>
                <PatchView
                  patch={patch}
                  hasMcpContent={mcpContent !== undefined}
                  onPreview={handlePreview}
                  onBack={() => setStage("plan")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={handleReset}
                >
                  <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                  Start over
                </Button>
              </>
            )}

            {/* ── Stage: preview ── */}
            {stage === "preview" && preview && (
              <>
                <PreviewView
                  preview={preview}
                  onBack={() => setStage("patch")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={handleReset}
                >
                  <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                  Start over
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

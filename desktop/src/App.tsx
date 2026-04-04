import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { TorqaRequest } from "./torqaApi";
import { tryParseTorqaJson } from "./parseTorqaJson";

type ThemeMode = "dark" | "light";

type ProductMode = "prompt" | "advanced";

type BenchMetrics = Record<string, number | boolean | null | undefined>;

type AppPipelineVisual = "idle" | "generate" | "validate" | "build" | "preview" | "done";

/** Locks `torqa app` / `generate-tq` to a core profile (CLI `--gen-category`). */
type PromptGenCategory = "landing" | "crud" | "automation";

const PRODUCT_MODE_KEY = "torqa-desktop-product-mode";

/** Three product categories — each chip sets example text + generation profile in core (`tq_intent`). */
const PROMPT_TEMPLATES: { label: string; genCategory: PromptGenCategory; text: string }[] = [
  {
    label: "Landing page",
    genCategory: "landing",
    text:
      "A marketing landing page: bold hero headline and subhead, three benefit cards with icons, logos/social proof strip, pricing teaser, primary CTA and secondary link, footer with newsletter email capture (single field). Mobile-first layout.",
  },
  {
    label: "CRUD app",
    genCategory: "crud",
    text:
      "A CRUD admin app for products: table list with name, SKU, price, stock, status; row click opens an edit form (name, price, stock, description); create new product flow; soft-delete via status archived. Include a read-only detail summary view.",
  },
  {
    label: "Automation tool",
    genCategory: "automation",
    text:
      "An internal automation tool: user submits a job with job_type and payload_ref; job is queued with run_id; manager approves or rejects with reason_code; on approval the runner executes and writes started_at, finished_at, outcome, and actor_id for audit. Show pending and history states.",
  },
];

type OneClickDemo = { id: string; label: string; genCategory: PromptGenCategory; text: string };

/** Same prompts as templates — full `torqa app` in one click (folder picker if needed). */
const ONE_CLICK_DEMOS: OneClickDemo[] = [
  { id: "startup-landing", label: "Startup landing page", genCategory: "landing", text: PROMPT_TEMPLATES[0].text },
  { id: "admin-dashboard", label: "Admin dashboard", genCategory: "crud", text: PROMPT_TEMPLATES[1].text },
  { id: "automation-pipeline", label: "Automation pipeline", genCategory: "automation", text: PROMPT_TEMPLATES[2].text },
];

const ONBOARDING_LINE = "Type what you want. We'll build it.";

/** Appended when user clicks Improve this app (refinement loop). */
const IMPROVE_APPEND =
  "Improve: tighten UI copy, add one missing screen users expect, and keep the same flow constraints.";

const EMPTY_PROMPT_VERSIONS: [string, string, string] = ["", "", ""];

const TRIAL_HINTS_KEY = "torqa-desktop-trial-hints-seen";

const PREVIEW_SPLIT_PCT_KEY = "torqa-desktop-preview-split-pct";

function readPreviewSplitPct(): number {
  try {
    const v = localStorage.getItem(PREVIEW_SPLIT_PCT_KEY);
    const n = v ? Number(v) : 52;
    return Number.isFinite(n) && n >= 22 && n <= 80 ? n : 52;
  } catch {
    return 52;
  }
}

function readTrialHintsSeen(): boolean {
  try {
    return localStorage.getItem(TRIAL_HINTS_KEY) === "1";
  } catch {
    return true;
  }
}

function markTrialHintsSeen() {
  try {
    localStorage.setItem(TRIAL_HINTS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Merge `suggested_next` hints from core JSON (top-level or under diagnostics). */
function collectSuggestedNextStrings(j: Record<string, unknown> | null | undefined): string[] {
  if (!j) return [];
  const out: string[] = [];
  const sn = j.suggested_next;
  if (Array.isArray(sn)) {
    for (const x of sn) {
      if (typeof x === "string" && x.trim()) out.push(x.trim());
    }
  }
  const d = j.diagnostics;
  if (typeof d === "object" && d !== null && !Array.isArray(d)) {
    const sn2 = (d as Record<string, unknown>).suggested_next;
    if (Array.isArray(sn2)) {
      for (const x of sn2) {
        if (typeof x === "string" && x.trim() && !out.includes(x.trim())) out.push(x.trim());
      }
    }
  }
  return out;
}

/** Where the prompt pipeline failed: LLM vs deterministic TORQA gates vs setup. */
type FailureAxis = "gpt" | "torqa" | "setup" | "unknown";

function classifyPipelineFailureAxis(json: Record<string, unknown> | null): FailureAxis {
  if (!json) return "unknown";
  const fa = json.failure_axis;
  if (fa === "gpt" || fa === "torqa" || fa === "setup") return fa;
  const st = typeof json.stage === "string" ? json.stage : "";
  if (st === "invalid_prompt" || st === "bad_workspace") return "setup";
  const stages = json.stages as Record<string, unknown> | undefined;
  const gen = stages?.generate;
  if (isRecord(gen) && gen.ok === false) return "gpt";
  const code = String(json.code ?? "");
  if (code.startsWith("PX_AI")) return "gpt";
  const issuesRaw = json.issues;
  if (Array.isArray(issuesRaw)) {
    const blob = JSON.stringify(issuesRaw).toLowerCase();
    if (blob.includes("openai_api_key") || blob.includes("px_ai")) return "gpt";
  }
  const parseSt = stages?.parse;
  if (isRecord(parseSt) && parseSt.ok === false) return "torqa";
  const mat = stages?.materialize;
  if (isRecord(mat) && mat.ok === false) return "torqa";
  const diag = json.diagnostics;
  if (isRecord(diag) && diag.ok === false) return "torqa";
  if (st === "parse" || /\bTQ[_-]?/i.test(code) || code.toLowerCase().includes("parse")) return "torqa";
  if (json.ok === false && stages && isRecord(gen) && gen.ok === true) return "torqa";
  return "unknown";
}

function summarizeAppPipelineFailure(
  json: Record<string, unknown> | null,
  stderr: string,
  stdout: string,
): { lines: string[]; fixes: string[]; axis: FailureAxis } {
  const lines: string[] = [];
  const fixes: string[] = [];
  if (!json) {
    lines.push("TORQA did not return readable JSON (check Activity for the raw log).");
    const tail = (stderr || stdout).trim();
    if (tail) lines.push(tail.length > 1400 ? `${tail.slice(0, 1400)}...` : tail);
    fixes.push("Confirm the core is installed: in the repo root run pip install -e .");
    fixes.push("If this step was AI generation, set OPENAI_API_KEY and restart the app.");
    return { lines, fixes, axis: "unknown" };
  }
  const stage = typeof json.stage === "string" ? json.stage : null;
  const message = typeof json.message === "string" ? json.message : null;
  if (stage) lines.push(`Stage: ${stage}`);
  if (message) lines.push(message);
  const errs = json.errors;
  if (Array.isArray(errs) && errs.length) {
    lines.push("Errors:");
    for (const e of errs.slice(0, 10)) lines.push(`  • ${String(e)}`);
  }
  const issues = json.issues;
  if (Array.isArray(issues) && issues.length) {
    lines.push("Issues:");
    for (const it of issues.slice(0, 8)) {
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        lines.push(`  • ${o.message != null ? String(o.message) : JSON.stringify(o)}`);
      } else lines.push(`  • ${String(it)}`);
    }
  }
  const code = json.code != null ? String(json.code) : "";
  const hint = typeof json.hint === "string" ? json.hint : null;
  if (code) lines.push(`Code: ${code}`);
  if (hint) lines.push(`Hint: ${hint}`);

  if (stage === "invalid_prompt" || (message && message.toLowerCase().includes("empty prompt"))) {
    fixes.push("Enter a short description of what you want, then run Build from prompt again.");
  }
  if (
    stage === "generate" ||
    code.includes("PX_AI") ||
    (message && /openai|api key|401|403/i.test(message))
  ) {
    fixes.push("Set OPENAI_API_KEY in your user environment and restart TORQA Desktop.");
    fixes.push("Check network access to your model provider.");
  }
  if (stage === "parse" || code.toLowerCase().includes("parse") || code.includes("TQ")) {
    fixes.push("Simplify the prompt (one main flow, named inputs) or use “Improve this app” with a concrete fix.");
  }
  for (const s of collectSuggestedNextStrings(json)) {
    if (!fixes.includes(s)) fixes.push(s);
  }
  if (fixes.length === 0) {
    fixes.push("Review the Activity tab, tweak your prompt, and try again.");
  }
  const axis = classifyPipelineFailureAxis(json);
  return { lines: lines.length ? lines : ["Build did not complete."], fixes, axis };
}

function PipelineFailureAxisDiff({ axis, compact }: { axis: FailureAxis; compact?: boolean }) {
  const gptActive = axis === "gpt";
  const torqaActive = axis === "torqa";
  const setupActive = axis === "setup";
  return (
    <div
      className={`failure-axis-diff${compact ? " failure-axis-diff--compact" : ""}`}
      role="region"
      aria-label="GPT versus TORQA failure context"
    >
      <div className="failure-axis-diff-title">What failed — GPT vs TORQA</div>
      <div className="failure-axis-diff-grid">
        <div
          className={`failure-axis-col failure-axis-col--gpt${gptActive ? " failure-axis-col--active" : ""}`}
          data-active={gptActive ? "true" : undefined}
        >
          <div className="failure-axis-col-head">GPT / OpenAI (non-deterministic)</div>
          <p className="failure-axis-col-lede">
            Typical failures: missing <code>OPENAI_API_KEY</code>, HTTP 401/429/5xx, model JSON shape errors, or max repair
            retries while the verifier still rejects output.
          </p>
          {gptActive ? (
            <p className="failure-axis-col-badge">This run stopped here — the LLM path did not yield an accepted step.</p>
          ) : null}
        </div>
        <div
          className={`failure-axis-col failure-axis-col--torqa${torqaActive ? " failure-axis-col--active" : ""}`}
          data-active={torqaActive ? "true" : undefined}
        >
          <div className="failure-axis-col-head">TORQA (deterministic)</div>
          <p className="failure-axis-col-lede">
            Same parser and diagnostic rules every time: invalid <code>.tq</code> syntax, IR shape, materialize consistency, or
            post-build diagnostics — independent of the model’s “creativity”.
          </p>
          {torqaActive ? (
            <p className="failure-axis-col-badge">
              This run stopped here — GPT may have produced text, but TORQA did not pass the spec through its gates.
            </p>
          ) : null}
        </div>
      </div>
      {setupActive ? (
        <p className="failure-axis-setup-note">
          <strong>Setup</strong> — workspace or prompt was invalid before GPT or TORQA ran. Fix folder / text, then retry.
        </p>
      ) : null}
      {axis === "unknown" ? (
        <p className="failure-axis-setup-note">
          See details below. If the log mentions OpenAI or <code>PX_AI</code>, treat it as a <strong>GPT</strong> failure; if it
          mentions parse, TQ errors, or materialize, treat it as <strong>TORQA</strong>.
        </p>
      ) : null}
    </div>
  );
}

function GptTorqaSuccessDiff() {
  return (
    <div className="gpt-torqa-success-diff" role="region" aria-label="NL assistants versus TORQA success path">
      <div className="gpt-torqa-success-diff-title">Why this build is trustworthy</div>
      <div className="gpt-torqa-success-grid">
        <div className="gpt-torqa-success-col gpt-torqa-success-col--gpt">
          <div className="gpt-torqa-success-label">GPT · Claude · Gemini (NL)</div>
          <p>
            <strong>Stochastic assistants</strong> — wording and structure can differ run to run; when you use OpenAI here,
            retries and API latency vary (see metrics above). Same idea for any chat model: great for ideas, weak as a lone
            contract.
          </p>
        </div>
        <div className="gpt-torqa-success-col gpt-torqa-success-col--torqa">
          <div className="gpt-torqa-success-label">TORQA execution layer</div>
          <p>
            <strong>Same rules every time</strong> — this <code>.tq</code> was parsed and run through full diagnostics before
            materialize; the shipped surface is only what passed those gates.
          </p>
        </div>
      </div>
    </div>
  );
}

function readStoredProductMode(): ProductMode {
  try {
    return localStorage.getItem(PRODUCT_MODE_KEY) === "advanced" ? "advanced" : "prompt";
  } catch {
    return "prompt";
  }
}

function getShell(): NonNullable<typeof window.torqaShell> {
  const s = window.torqaShell;
  if (!s) {
    throw new Error("TORQA shell yok — uygulama Electron içinde çalıştırılmalı (torqa-desktop veya cd desktop && npm run start).");
  }
  return s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Readable diagnostics for the Diagnostics tab (core JSON shape). */
function formatDiagnosticsHuman(d: Record<string, unknown>): string {
  const lines: string[] = [];
  if (typeof d.ok === "boolean") lines.push(`ok: ${d.ok}`);
  const issues = d.issues;
  if (Array.isArray(issues) && issues.length) {
    lines.push("", "Issues:");
    for (const it of issues.slice(0, 48)) {
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        const msg = o.message != null ? String(o.message) : JSON.stringify(o);
        lines.push(`  • ${msg}`);
        if (o.code != null) lines.push(`    code: ${String(o.code)}`);
      } else lines.push(`  • ${String(it)}`);
    }
    if (issues.length > 48) lines.push(`  … ${issues.length - 48} more`);
  }
  const warnings = d.warnings;
  if (Array.isArray(warnings) && warnings.length) {
    lines.push("", "Warnings:");
    for (const w of warnings.slice(0, 24)) {
      lines.push(`  • ${typeof w === "object" && w !== null ? JSON.stringify(w) : String(w)}`);
    }
  }
  const sem = d.semantic_report;
  if (isRecord(sem)) {
    const errs = sem.errors;
    const warns = sem.warnings;
    if (Array.isArray(errs) && errs.length) {
      lines.push("", "Semantic errors:");
      for (const e of errs.slice(0, 16)) lines.push(`  • ${JSON.stringify(e)}`);
    }
    if (Array.isArray(warns) && warns.length) {
      lines.push("", "Semantic warnings:");
      for (const w of warns.slice(0, 16)) lines.push(`  • ${JSON.stringify(w)}`);
    }
  }
  if (lines.length <= 1 && Object.keys(d).length) return JSON.stringify(d, null, 2);
  return lines.join("\n");
}

const MAX_REPAIR_CONTEXT = 6000;
const MAX_SOURCE_IN_REPAIR = 32000;

function surfaceFailureSummaryForRepair(json: Record<string, unknown> | null, stderr: string): string {
  const parts: string[] = [];
  if (json) {
    if (typeof json.message === "string") parts.push(json.message);
    if (json.code != null) parts.push(`code: ${String(json.code)}`);
    if (typeof json.hint === "string") parts.push(`hint: ${json.hint}`);
    const d = json.diagnostics;
    if (isRecord(d)) parts.push(formatDiagnosticsHuman(d).slice(0, 4000));
    for (const s of collectSuggestedNextStrings(json)) parts.push(`suggested_next: ${s}`);
  }
  const tail = stderr.trim();
  if (tail) parts.push(tail.slice(0, 2000));
  return parts.filter(Boolean).join("\n\n").slice(0, MAX_REPAIR_CONTEXT);
}

function appPipelineIndex(s: AppPipelineVisual): number {
  if (s === "idle") return -1;
  if (s === "done") return 4;
  const map: Record<Exclude<AppPipelineVisual, "idle" | "done">, number> = {
    generate: 0,
    validate: 1,
    build: 2,
    preview: 3,
  };
  return map[s];
}

function summarizeBuildPayload(json: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`ok: ${Boolean(json.ok)}`);
  if (json.written_under != null) parts.push(`written_under: ${String(json.written_under)}`);
  if (json.local_webapp != null) parts.push(`local_webapp: ${String(json.local_webapp)}`);
  const w = json.written;
  if (Array.isArray(w)) parts.push(`files written: ${w.length}`);
  const err = json.errors;
  if (Array.isArray(err) && err.length) parts.push(`errors: ${err.map(String).join("; ")}`);
  return parts.join("\n");
}

/** When `torqa build` / project JSON reports failure, surface core hints for the UI. */
function summarizeBuildFailureForUi(
  json: Record<string, unknown> | null,
  stderr: string,
  stdout: string,
): { lines: string[]; fixes: string[] } {
  if (!json) {
    const tail = (stderr || stdout).trim();
    return {
      lines: tail ? [tail.length > 1800 ? `${tail.slice(0, 1800)}…` : tail] : ["Build failed (no JSON from core)."],
      fixes: [
        "Open the Output tab for the raw log.",
        "From the repo root: pip install -e . — then restart the desktop app.",
      ],
    };
  }
  const lines: string[] = [];
  const fixes = collectSuggestedNextStrings(json);
  const d = json.diagnostics;
  if (isRecord(d)) {
    for (const s of collectSuggestedNextStrings(d)) {
      if (!fixes.includes(s)) fixes.push(s);
    }
    const human = formatDiagnosticsHuman(d);
    if (human.trim()) lines.push(human.slice(0, 4500));
  }
  if (json.written_under != null) lines.unshift(`written_under: ${String(json.written_under)}`);
  const errs = json.errors;
  if (Array.isArray(errs)) for (const e of errs.slice(0, 14)) lines.push(String(e));
  const ce = json.consistency_errors;
  if (Array.isArray(ce)) for (const e of ce.slice(0, 10)) lines.push(`consistency: ${String(e)}`);
  if (json.code != null) lines.push(`code: ${String(json.code)}`);
  if (typeof json.hint === "string") lines.push(`hint: ${json.hint}`);
  if (fixes.length === 0) {
    fixes.push("Open the Output tab for the full core log.", "Edit the .tq file or narrow projection scope, then Build again.");
  }
  const uniqueLines = lines.filter(Boolean);
  return { lines: uniqueLines.length ? uniqueLines : ["Build did not succeed."], fixes };
}

/** Token estimates from successful `torqa app` JSON (`stages.token_hint`). */
type PipelineTokenEstimates = {
  promptTokens: number;
  tqTokens: number;
  reductionPercent: number | null;
};

/** OpenAI Chat Completions usage + timing from core (`api_metrics` / `stages.generate.api_metrics`). */
type ApiCallMetrics = {
  provider: string;
  model: string;
  httpCalls: number;
  retryCount: number;
  latencyMsTotal: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  estimatedCostUsd: number | null;
  pricingNote?: string;
};

function parseApiMetrics(raw: unknown): ApiCallMetrics | null {
  if (!isRecord(raw)) return null;
  const httpCalls = Number(raw.http_calls);
  if (!Number.isFinite(httpCalls) || httpCalls < 1) return null;
  const usage = raw.usage;
  if (!isRecord(usage)) return null;
  const pt = Number(usage.prompt_tokens);
  const ct = Number(usage.completion_tokens);
  const tt = Number(usage.total_tokens);
  if (!Number.isFinite(pt) || !Number.isFinite(ct) || !Number.isFinite(tt)) return null;
  const latencyMsTotal = Number(raw.latency_ms_total);
  if (!Number.isFinite(latencyMsTotal)) return null;
  const retryCount = Number(raw.retry_count);
  const ec = raw.estimated_cost_usd;
  const estimatedCostUsd =
    ec === null || ec === undefined
      ? null
      : typeof ec === "number" && Number.isFinite(ec)
        ? ec
        : typeof ec === "string" && ec.trim() && Number.isFinite(Number(ec))
          ? Number(ec)
          : null;
  return {
    provider: typeof raw.provider === "string" ? raw.provider : "openai",
    model: typeof raw.model === "string" ? raw.model : "",
    httpCalls: Math.round(httpCalls),
    retryCount: Number.isFinite(retryCount) ? Math.max(0, Math.round(retryCount)) : 0,
    latencyMsTotal,
    usage: {
      promptTokens: Math.round(pt),
      completionTokens: Math.round(ct),
      totalTokens: Math.round(tt),
    },
    estimatedCostUsd,
    pricingNote: typeof raw.pricing_note === "string" ? raw.pricing_note : undefined,
  };
}

function tokenEstimatesAria(e: PipelineTokenEstimates): string {
  const r = e.reductionPercent != null ? `${Math.round(e.reductionPercent)} percent` : "not reported";
  return `Estimated tokens from core: prompt ${Math.round(e.promptTokens)}, dot t q ${Math.round(e.tqTokens)}, reduction ${r}`;
}

/** Snapshot after `torqa app` / `generate-tq`: same NL task vs validated .tq (assistant-style brief vs TORQA execution layer). */
type StackVsTorqaComparison = {
  nlPrompt: string;
  tqSource: string;
  promptTokens?: number;
  tqTokens?: number;
  reductionPercent: number | null;
};

function StackVsTorqaPanel({ snap, compact }: { snap: StackVsTorqaComparison; compact?: boolean }) {
  const hasTok =
    typeof snap.promptTokens === "number" &&
    typeof snap.tqTokens === "number" &&
    Number.isFinite(snap.promptTokens) &&
    Number.isFinite(snap.tqTokens);
  const pt = hasTok ? Math.round(snap.promptTokens!) : 0;
  const tt = hasTok ? Math.round(snap.tqTokens!) : 0;
  const maxTok = hasTok ? Math.max(pt, tt, 1) : 1;
  const nlChars = snap.nlPrompt.length;
  const tqChars = snap.tqSource.length;
  const root = `stack-vs-torqa-panel${compact ? " stack-vs-torqa-panel--compact" : ""}`;
  const redBar =
    snap.reductionPercent != null ? Math.max(0, Math.min(100, Number(snap.reductionPercent))) : null;
  return (
    <div className={root} role="region" aria-label="Same pipeline: NL task for GPT Claude Gemini versus TORQA spec">
      <h4 className="stack-vs-torqa-heading">Assistants (GPT · Claude · Gemini) vs TORQA execution layer</h4>
      <p className="stack-vs-torqa-lede">
        <strong>NL column</strong>: the same natural-language task you would paste into ChatGPT, Claude, Gemini, or similar — the{" "}
        <em>same</em> brief this pipeline used as input. <strong>TORQA</strong>: the validated <code>.tq</code> surface from that{" "}
        <em>same</em> run — the compression-first execution layer (parse + full diagnostics before materialize). Assistant output
        stays stochastic; the shipped <code>.tq</code> path is deterministic. Tokens: <code>estimate_tokens</code> on each body.
      </p>
      {hasTok ? (
        <>
          <div className="stack-vs-torqa-token-grid">
            <div className="stack-vs-torqa-token-card">
              <div className="stack-vs-torqa-col-title">NL (GPT · Claude · Gemini style)</div>
              <div className="stack-vs-torqa-token-big">{pt}</div>
              <div className="stack-vs-torqa-col-sub">est. tokens</div>
            </div>
            <div className="stack-vs-torqa-vs" aria-hidden>
              vs
            </div>
            <div className="stack-vs-torqa-token-card stack-vs-torqa-token-card--torqa">
              <div className="stack-vs-torqa-col-title">TORQA</div>
              <div className="stack-vs-torqa-token-big">{tt}</div>
              <div className="stack-vs-torqa-col-sub">est. tokens · .tq</div>
            </div>
          </div>
          <div className="stack-vs-torqa-bar-block">
            <div className="stack-vs-torqa-bar-row">
              <span className="stack-vs-torqa-bar-label">NL task</span>
              <div className="stack-vs-torqa-bar-track">
                <div className="stack-vs-torqa-bar-fill stack-vs-torqa-bar-fill--nl" style={{ width: `${(pt / maxTok) * 100}%` }} />
              </div>
            </div>
            <div className="stack-vs-torqa-bar-row">
              <span className="stack-vs-torqa-bar-label">.tq spec</span>
              <div className="stack-vs-torqa-bar-track">
                <div className="stack-vs-torqa-bar-fill stack-vs-torqa-bar-fill--tq" style={{ width: `${(tt / maxTok) * 100}%` }} />
              </div>
            </div>
            {redBar != null ? (
              <div className="stack-vs-torqa-bar-row stack-vs-torqa-bar-row--red">
                <span className="stack-vs-torqa-bar-label">Reduction</span>
                <div className="stack-vs-torqa-bar-track stack-vs-torqa-bar-track--red">
                  <div className="stack-vs-torqa-bar-fill stack-vs-torqa-bar-fill--red" style={{ width: `${redBar}%` }} />
                </div>
                <span className="stack-vs-torqa-bar-pct">{Math.round(redBar)}%</span>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <p className="stack-vs-torqa-lede-muted">Token estimates unavailable — compare output text below.</p>
      )}
      {snap.reductionPercent != null ? (
        <p className="stack-vs-torqa-reduction">
          Estimated token bulk vs NL task alone: <strong>{Math.round(snap.reductionPercent)}%</strong> less in the TORQA surface.
        </p>
      ) : null}
      <p className="stack-vs-torqa-stats" aria-label="Character counts">
        Output size (characters): NL task <strong>{nlChars.toLocaleString()}</strong> · TORQA <strong>{tqChars.toLocaleString()}</strong>
        {nlChars > 0 ? (
          <>
            {" "}
            (<strong>{Math.round((100 * tqChars) / nlChars)}%</strong> of NL length)
          </>
        ) : null}
      </p>
      <div className="stack-vs-torqa-output-grid">
        <div className="stack-vs-torqa-output-col">
          <div className="stack-vs-torqa-output-head">Output — Google stack (NL, same pipeline input)</div>
          <pre className="stack-vs-torqa-pre">{snap.nlPrompt}</pre>
        </div>
        <div className="stack-vs-torqa-output-col">
          <div className="stack-vs-torqa-output-head">Output — TORQA (.tq from same run)</div>
          <pre className="stack-vs-torqa-pre">{snap.tqSource}</pre>
        </div>
      </div>
    </div>
  );
}

function TokenEstimatePanel({
  estimates,
  variant = "default",
}: {
  estimates: PipelineTokenEstimates;
  variant?: "default" | "compact";
}) {
  const { promptTokens, tqTokens, reductionPercent } = estimates;
  const max = Math.max(promptTokens, tqTokens, 1);
  const promptBarPct = Math.min(100, (promptTokens / max) * 100);
  const tqBarPct = Math.min(100, (tqTokens / max) * 100);
  const red =
    reductionPercent != null ? Math.max(0, Math.min(100, Number(reductionPercent))) : null;
  const rootClass = `token-estimate-panel${variant === "compact" ? " token-estimate-panel--compact" : ""}`;

  return (
    <div className={rootClass} role="group" aria-label={tokenEstimatesAria(estimates)}>
      <div className="token-estimate-panel-title">Token comparison (core est.)</div>
      <div className="token-estimate-bars">
        <div className="token-estimate-row">
          <div className="token-estimate-row-head">
            <span className="token-estimate-label">NL (GPT · Claude · Gemini style task)</span>
            <span className="token-estimate-num">{Math.round(promptTokens)}</span>
          </div>
          <div className="token-estimate-track" aria-hidden>
            <div className="token-estimate-fill token-estimate-fill--prompt" style={{ width: `${promptBarPct}%` }} />
          </div>
        </div>
        <div className="token-estimate-row">
          <div className="token-estimate-row-head">
            <span className="token-estimate-label">TORQA .tq spec</span>
            <span className="token-estimate-num">{Math.round(tqTokens)}</span>
          </div>
          <div className="token-estimate-track" aria-hidden>
            <div className="token-estimate-fill token-estimate-fill--tq" style={{ width: `${tqBarPct}%` }} />
          </div>
        </div>
      </div>
      <div className="token-estimate-reduction-block">
        <div className="token-estimate-row-head">
          <span className="token-estimate-label">Reduction vs NL task</span>
          <span className="token-estimate-num token-estimate-num--accent">
            {red != null ? `${Math.round(red)}%` : "—"}
          </span>
        </div>
        <div className="token-estimate-track token-estimate-track--reduction" aria-hidden>
          {red != null ? (
            <div className="token-estimate-fill token-estimate-fill--reduction" style={{ width: `${red}%` }} />
          ) : (
            <div className="token-estimate-fill token-estimate-fill--reduction token-estimate-fill--empty" />
          )}
        </div>
      </div>
    </div>
  );
}

function ApiCallMetricsPanel({ m, compact }: { m: ApiCallMetrics; compact?: boolean }) {
  const root = `api-call-metrics${compact ? " api-call-metrics--compact" : ""}`;
  const costStr =
    m.estimatedCostUsd != null && Number.isFinite(m.estimatedCostUsd)
      ? `~$${m.estimatedCostUsd.toFixed(4)} USD`
      : "— (no rate for this model)";
  return (
    <div className={root} role="region" aria-label="OpenAI API calls, latency, and estimated cost">
      <div className="api-call-metrics-title">Live API (OpenAI Chat Completions)</div>
      <ul className="api-call-metrics-list">
        <li>
          <span className="api-call-metrics-k">HTTP calls</span>{" "}
          <span className="api-call-metrics-v">{m.httpCalls}</span>
        </li>
        <li>
          <span className="api-call-metrics-k">Repair retries</span>{" "}
          <span className="api-call-metrics-v">{m.retryCount}</span>
          <span className="api-call-metrics-hint"> (extra rounds after the first response)</span>
        </li>
        <li>
          <span className="api-call-metrics-k">Total latency</span>{" "}
          <span className="api-call-metrics-v">{Math.round(m.latencyMsTotal)} ms</span>
        </li>
        <li>
          <span className="api-call-metrics-k">Billable tokens (API)</span>{" "}
          <span className="api-call-metrics-v">
            in {m.usage.promptTokens.toLocaleString()} · out {m.usage.completionTokens.toLocaleString()} · total{" "}
            {m.usage.totalTokens.toLocaleString()}
          </span>
        </li>
        <li>
          <span className="api-call-metrics-k">Est. cost</span> <span className="api-call-metrics-v">{costStr}</span>
        </li>
        <li>
          <span className="api-call-metrics-k">Model</span>{" "}
          <span className="api-call-metrics-v api-call-metrics-mono">{m.model || "—"}</span>
        </li>
      </ul>
      {m.pricingNote && !compact ? (
        <p className="api-call-metrics-note">{m.pricingNote}</p>
      ) : null}
    </div>
  );
}

function DesktopApp() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [productMode, setProductMode] = useState<ProductMode>(readStoredProductMode);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [paths, setPaths] = useState<{ repoRoot: string; pythonExe: string } | null>(null);
  const [tqFiles, setTqFiles] = useState<string[]>([]);
  const [activeRel, setActiveRel] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [bottomTab, setBottomTab] = useState<"output" | "diagnostics" | "activity">("output");
  const [bottomOpen, setBottomOpen] = useState(true);
  const [trialLog, setTrialLog] = useState<string[]>([]);
  const [pipelineFailure, setPipelineFailure] = useState<{
    lines: string[];
    fixes: string[];
    axis: FailureAxis;
  } | null>(null);
  const [buildFailurePanel, setBuildFailurePanel] = useState<{ lines: string[]; fixes: string[] } | null>(null);
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [lastWebappDir, setLastWebappDir] = useState<string | null>(null);
  /** Code | embedded Vite preview side-by-side */
  const [previewSplitOpen, setPreviewSplitOpen] = useState(true);
  const [previewEditorPercent, setPreviewEditorPercent] = useState(readPreviewSplitPct);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const editorSplitRef = useRef<HTMLDivElement | null>(null);
  const splitDragRef = useRef<{ startX: number; startPct: number } | null>(null);
  const splitPctLiveRef = useRef(readPreviewSplitPct());
  const [showTrialSetupHints, setShowTrialSetupHints] = useState(() => !readTrialHintsSeen());
  const [rightTab, setRightTab] = useState<"ir" | "bench">("ir");
  const [rightOpen, setRightOpen] = useState(true);
  const [busy, setBusy] = useState<"idle" | "surface" | "build" | "bench" | "generate" | "app">("idle");
  const [appPipelineStep, setAppPipelineStep] = useState<AppPipelineVisual>("idle");
  const [pipelineTokenEstimates, setPipelineTokenEstimates] = useState<PipelineTokenEstimates | null>(null);
  const [stackVsTorqaCompare, setStackVsTorqaCompare] = useState<StackVsTorqaComparison | null>(null);
  const [apiCallMetrics, setApiCallMetrics] = useState<ApiCallMetrics | null>(null);
  /** Three prompt slots (v1 / v2 / v3) for iteration without losing earlier drafts. */
  const [promptVersions, setPromptVersions] = useState<[string, string, string]>(() => [...EMPTY_PROMPT_VERSIONS]);
  const [promptVersionIndex, setPromptVersionIndex] = useState(0);
  /** When set, core uses `--gen-category` (overrides heuristic intent). */
  const [promptGenCategory, setPromptGenCategory] = useState<PromptGenCategory | null>(null);
  const [gate, setGate] = useState<"idle" | "ok" | "fail">("idle");
  const [outputText, setOutputText] = useState("");
  const [diagText, setDiagText] = useState("");
  const [irPreview, setIrPreview] = useState("");
  const [benchMetrics, setBenchMetrics] = useState<BenchMetrics | null>(null);
  const [pipelineStages, setPipelineStages] = useState<unknown[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<Record<string, unknown> | null>(null);
  const [written, setWritten] = useState<string[]>([]);
  const [lastTorqaCommand, setLastTorqaCommand] = useState("");
  const [buildSummaryLine, setBuildSummaryLine] = useState("");
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const workspaceSwitchRef = useRef<string | null>(null);
  splitPctLiveRef.current = previewEditorPercent;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = splitDragRef.current;
      const el = editorSplitRef.current;
      if (!d || !el) return;
      const w = el.getBoundingClientRect().width;
      if (w < 120) return;
      const deltaPct = ((e.clientX - d.startX) / w) * 100;
      const next = Math.min(80, Math.max(22, d.startPct + deltaPct));
      splitPctLiveRef.current = next;
      setPreviewEditorPercent(next);
    };
    const onUp = () => {
      if (!splitDragRef.current) return;
      splitDragRef.current = null;
      try {
        localStorage.setItem(PREVIEW_SPLIT_PCT_KEY, String(Math.round(splitPctLiveRef.current)));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onSplitGutterMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    splitDragRef.current = { startX: e.clientX, startPct: previewEditorPercent };
  };

  const updatePromptAt = useCallback((idx: number, text: string) => {
    setPromptVersions((v) => {
      const n: [string, string, string] = [...v];
      n[idx] = text;
      return n;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const prev = workspaceSwitchRef.current;
    workspaceSwitchRef.current = workspace;
    if (prev != null && workspace != null && prev !== workspace) {
      setPromptVersions([...EMPTY_PROMPT_VERSIONS]);
      setPromptVersionIndex(0);
      setPromptGenCategory(null);
    }
  }, [workspace]);

  useEffect(() => {
    try {
      localStorage.setItem(PRODUCT_MODE_KEY, productMode);
    } catch {
      /* ignore */
    }
  }, [productMode]);

  useEffect(() => {
    void (async () => {
      try {
        const p = await getShell().getPaths();
        setPaths(p);
        const ws = await getShell().getWorkspace();
        setWorkspace(ws);
      } catch {
        setPaths(null);
      }
    })();
  }, []);

  const clearPanels = useCallback(() => {
    setGate("idle");
    setOutputText("");
    setDiagText("");
    setIrPreview("");
    setBenchMetrics(null);
    setPipelineStages([]);
    setPipelineSummary(null);
    setWritten([]);
    setLastTorqaCommand("");
    setBuildSummaryLine("");
    setTrialLog([]);
    setPipelineFailure(null);
    setBuildFailurePanel(null);
    setLastPreviewUrl(null);
    setLastWebappDir(null);
    setPipelineTokenEstimates(null);
    setStackVsTorqaCompare(null);
    setApiCallMetrics(null);
    setPromptGenCategory(null);
    setAppPipelineStep("idle");
  }, []);

  const appendTrialLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTrialLog((prev) => [...prev.slice(-199), `[${stamp}] ${line}`]);
  }, []);

  const improveThisApp = useCallback(() => {
    const idx = promptVersionIndex;
    setPromptVersions((v) => {
      const n: [string, string, string] = [...v];
      const t = n[idx].trim();
      n[idx] = t ? `${t}\n\n${IMPROVE_APPEND}` : IMPROVE_APPEND;
      return n;
    });
    setPipelineFailure(null);
    setBuildFailurePanel(null);
    setBottomTab("output");
    appendTrialLog(`Refinement appended to v${idx + 1} — run Build from prompt again`);
  }, [appendTrialLog, promptVersionIndex]);

  const duplicatePromptToNextSlot = useCallback(() => {
    const from = promptVersionIndex;
    if (from >= 2) return;
    const next = from + 1;
    const cur = promptVersions[from].trim();
    if (!cur) return;
    const existingNext = promptVersions[next].trim();
    if (existingNext && !window.confirm(`Replace v${next + 1} with a copy of v${from + 1}?`)) return;
    setPromptVersions((v) => {
      const n: [string, string, string] = [...v];
      n[next] = v[from];
      return n;
    });
    setPromptVersionIndex(next);
    appendTrialLog(`v${next + 1} is now a copy of v${from + 1} — edit, Improve, or Build`);
  }, [appendTrialLog, promptVersionIndex, promptVersions]);

  const refreshTree = useCallback(async (root: string) => {
    const list = await getShell().listTqFiles(root);
    setTqFiles(list);
  }, []);

  useEffect(() => {
    if (workspace) void refreshTree(workspace);
    else {
      setTqFiles([]);
      setActiveRel(null);
      setContent("");
    }
  }, [workspace, refreshTree]);

  useEffect(() => {
    const shell = window.torqaShell;
    if (!shell?.subscribeShellEvents) return undefined;
    return shell.subscribeShellEvents({
      onWorkspaceOpened: (dir) => {
        setWorkspace(dir);
        clearPanels();
      },
      onTqFileOpened: (r) => {
        void (async () => {
          if (dirtyRef.current && !confirm("Discard unsaved changes?")) return;
          setProductMode("advanced");
          setWorkspace(r.workspaceRoot);
          clearPanels();
          try {
            const list = await shell.listTqFiles(r.workspaceRoot);
            setTqFiles(list);
            const rd = await shell.readFile(r.workspaceRoot, r.relativePath);
            if (!rd.ok) {
              setBottomOpen(true);
              setBottomTab("output");
              setOutputText(`Read failed: ${rd.error}`);
              return;
            }
            setActiveRel(r.relativePath);
            setContent(rd.content);
            setDirty(false);
          } catch (e) {
            setBottomOpen(true);
            setBottomTab("output");
            setOutputText(String(e));
          }
        })();
      },
    });
  }, [clearPanels]);

  const openProject = async (opts?: { setMode?: ProductMode }): Promise<string | null> => {
    if (opts?.setMode) setProductMode(opts.setMode);
    try {
      const root = await getShell().openWorkspace();
      if (!root) return null;
      setWorkspace(root);
      clearPanels();
      return root;
    } catch (e) {
      setBottomOpen(true);
      setBottomTab("output");
      setOutputText(`Open folder failed: ${String(e)}`);
      return null;
    }
  };

  const openTqFile = async () => {
    setProductMode("advanced");
    try {
      const r = await getShell().openTqFile();
      if (!r) return;
      if (dirty && !confirm("Discard unsaved changes?")) return;
      setWorkspace(r.workspaceRoot);
      clearPanels();
      const list = await getShell().listTqFiles(r.workspaceRoot);
      setTqFiles(list);
      const rd = await getShell().readFile(r.workspaceRoot, r.relativePath);
      if (!rd.ok) {
        setBottomOpen(true);
        setBottomTab("output");
        setOutputText(`Read failed: ${rd.error}`);
        return;
      }
      setActiveRel(r.relativePath);
      setContent(rd.content);
      setDirty(false);
    } catch (e) {
      setBottomOpen(true);
      setBottomTab("output");
      setOutputText(`Open .tq file failed: ${String(e)}`);
    }
  };

  const loadFile = async (rel: string, opts?: { skipDirtyCheck?: boolean; workspaceRoot?: string }) => {
    const ws = opts?.workspaceRoot ?? workspace;
    if (!ws) return;
    if (dirty && !opts?.skipDirtyCheck && !confirm("Discard unsaved changes?")) return;
    const r = await getShell().readFile(ws, rel);
    if (!r.ok) {
      setBottomOpen(true);
      setBottomTab("output");
      appendOutput(`Read file (${rel})`, { exitCode: 1, stdout: "", stderr: r.error });
      return;
    }
    setActiveRel(rel);
    setContent(r.content);
    setDirty(false);
  };

  const saveFile = async () => {
    if (!workspace || !activeRel) return;
    const r = await getShell().saveFile(workspace, activeRel, content);
    if (!r.ok) {
      setBottomOpen(true);
      setBottomTab("output");
      appendOutput(`Save (${activeRel})`, { exitCode: 1, stdout: "", stderr: r.error });
      return;
    }
    setDirty(false);
    setBottomOpen(true);
    setBottomTab("output");
    appendOutput(`Save (${activeRel})`, { exitCode: 0, stdout: "Saved to disk.", stderr: "" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveFile();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workspace, activeRel, content, dirty]);

  const appendOutput = (
    label: string,
    res: { stdout: string; stderr: string; exitCode: number },
    cmd?: string,
  ) => {
    const block = [
      cmd ? `Command: ${cmd}` : "",
      `— ${label} — exit ${res.exitCode}`,
      res.stdout ? `stdout:\n${res.stdout}` : "",
      res.stderr ? `stderr:\n${res.stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    setOutputText((prev) => (prev ? `${prev}\n\n${block}` : block));
  };

  const attemptValidateAutoRepair = useCallback(
    async (rel: string, failJson: Record<string, unknown> | null, resStderr: string): Promise<boolean> => {
      if (!workspace || !rel.toLowerCase().endsWith(".tq")) return false;
      const rd = await getShell().readFile(workspace, rel);
      const source = rd.ok ? rd.content : "";
      if (!source.trim()) {
        appendTrialLog("Auto-fix skipped: could not read .tq from disk");
        return false;
      }
      const errCtx = surfaceFailureSummaryForRepair(failJson, resStderr);
      const prompt = [
        "Rewrite the following TORQA .tq file to fix all surface / validation errors. Keep the same product intent, screens, and user flow.",
        "Output must be valid .tq syntax only (the toolchain extracts tq_text from the model response).",
        "",
        "--- ERRORS AND CONTEXT ---",
        errCtx,
        "",
        "--- CURRENT .tq ---",
        source.slice(0, MAX_SOURCE_IN_REPAIR),
      ].join("\n");
      appendTrialLog("Validate failed — one AI auto-fix attempt (generate-tq)…");
      setBottomOpen(true);
      setBottomTab("output");
      setBusy("generate");
      try {
        const gen = await getShell().torqaRun({
          kind: "generateTq",
          workspaceRoot: workspace,
          prompt,
          maxRetries: 3,
        });
        appendOutput("Auto-fix after validate (generate-tq)", gen, "torqa --json generate-tq --workspace <ws> --prompt-stdin");
        const gj = tryParseTorqaJson(gen.stdout, gen.stderr) as Record<string, unknown> | null;
        const tqText = gj && typeof gj.tq_text === "string" ? gj.tq_text : null;
        if (!gj?.ok || !tqText || gen.exitCode !== 0) {
          appendTrialLog("Auto-fix did not return a new .tq (check Output; OPENAI_API_KEY required for AI repair)");
          return false;
        }
        const wr = await getShell().saveFile(workspace, rel, tqText);
        if (!wr.ok) {
          appendTrialLog(`Auto-fix: save failed — ${wr.error}`);
          return false;
        }
        await refreshTree(workspace);
        if (activeRel === rel) {
          setContent(tqText);
          setDirty(false);
        }
        appendTrialLog("Auto-fix saved — re-running Validate once");
        return true;
      } finally {
        setBusy("idle");
      }
    },
    [workspace, appendTrialLog, refreshTree, activeRel],
  );

  const runValidateForRel = async (rel: string, opts?: { allowAutoRepair?: boolean }) => {
    if (!workspace) return;
    const allowAutoRepair = opts?.allowAutoRepair !== false;
    setBusy("surface");
    setGate("idle");
    setBottomOpen(true);
    setBottomTab("output");
    const cmd = `torqa --json surface "${workspace.replace(/\\/g, "/")}/${rel}"`;
    setLastTorqaCommand(cmd);
    const res = await getShell().torqaRun({
      kind: "surface",
      workspaceRoot: workspace,
      relativePath: rel,
    });
    appendOutput("Validate (surface → IR + diagnostics)", res, cmd);
    const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
    if (json && isRecord(json.diagnostics as unknown)) {
      setDiagText(formatDiagnosticsHuman(json.diagnostics as Record<string, unknown>));
      setGate(Boolean(json.ok) && res.exitCode === 0 ? "ok" : "fail");
    } else if (json) {
      setDiagText(JSON.stringify(json, null, 2));
      setGate(Boolean(json.ok) && res.exitCode === 0 ? "ok" : "fail");
    } else {
      setDiagText(res.stderr || res.stdout || "(no JSON from core — see Output tab)");
      setGate(res.exitCode === 0 ? "ok" : "fail");
    }
    if (json?.ir_bundle) {
      setIrPreview(JSON.stringify(json.ir_bundle, null, 2));
      setRightOpen(true);
      setRightTab("ir");
    } else if (!json?.ir_bundle && res.exitCode !== 0) {
      setIrPreview("");
    }
    setPipelineStages([]);
    setPipelineSummary(null);
    setWritten([]);
    setBuildSummaryLine("");
    setBusy("idle");

    const ok = json ? Boolean(json.ok) && res.exitCode === 0 : res.exitCode === 0;
    if (ok) setBuildFailurePanel(null);
    if (!ok && allowAutoRepair) {
      const repaired = await attemptValidateAutoRepair(rel, json, res.stderr);
      if (repaired) await runValidateForRel(rel, { allowAutoRepair: false });
    }
  };

  const runValidate = async () => {
    if (!activeRel) return;
    await runValidateForRel(activeRel);
  };

  const seedSample = async (which: "minimal" | "flagship") => {
    if (!workspace) return;
    const r = await getShell().seedSampleTq(workspace, which);
    if (!r.ok) {
      appendOutput("Sample copy", { exitCode: 1, stdout: "", stderr: r.error });
      setBottomOpen(true);
      setBottomTab("output");
      return;
    }
    await refreshTree(workspace);
    await loadFile(r.relativePath, { skipDirtyCheck: true });
  };

  const quickDemo = async () => {
    if (!workspace) return;
    const r = await getShell().seedSampleTq(workspace, "minimal");
    if (!r.ok) {
      appendOutput("Quick demo", { exitCode: 1, stdout: "", stderr: r.error });
      setBottomOpen(true);
      setBottomTab("output");
      return;
    }
    await refreshTree(workspace);
    const rd = await getShell().readFile(workspace, r.relativePath);
    if (!rd.ok) {
      appendOutput("Quick demo (read)", { exitCode: 1, stdout: "", stderr: rd.error });
      return;
    }
    setActiveRel(r.relativePath);
    setContent(rd.content);
    setDirty(false);
    await runValidateForRel(r.relativePath);
  };

  const runBuild = async () => {
    if (!workspace || !activeRel) return;
    setBusy("build");
    setGate("idle");
    setBuildFailurePanel(null);
    setBuildSummaryLine("");
    setBottomOpen(true);
    setBottomTab("output");
    const wsDisplay = workspace.replace(/\\/g, "/");
    const buildCmd = `torqa --json build "${wsDisplay}/${activeRel}" --root "${wsDisplay}" --out torqa_generated_out --engine-mode python_only`;
    setLastTorqaCommand(buildCmd);
    const res = await getShell().torqaRun({
      kind: "build",
      workspaceRoot: workspace,
      relativePath: activeRel,
      outDir: "torqa_generated_out",
      engineMode: "python_only",
    });
    appendOutput("Build (materialize project)", res, buildCmd);
    const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
    if (json && isRecord(json.diagnostics as unknown)) {
      setDiagText(formatDiagnosticsHuman(json.diagnostics as Record<string, unknown>));
    } else if (json) {
      setDiagText(JSON.stringify(json, null, 2));
    } else {
      setDiagText(res.stderr || res.stdout || "(no JSON from core)");
    }
    const ok = json ? Boolean(json.ok) && res.exitCode === 0 : res.exitCode === 0;
    setGate(ok ? "ok" : "fail");
    const stages = (json?.pipeline_stages as unknown[]) || [];
    setPipelineStages(stages);
    setPipelineSummary((json?.pipeline_summary as Record<string, unknown>) || null);
    const w = json?.written;
    setWritten(Array.isArray(w) ? (w as string[]) : []);
    if (json) setBuildSummaryLine(summarizeBuildPayload(json));
    else setBuildSummaryLine("");
    if (json?.ir_bundle) {
      setIrPreview(JSON.stringify(json.ir_bundle, null, 2));
    }
    setBusy("idle");
    if (!ok) {
      setBuildFailurePanel(summarizeBuildFailureForUi(json, res.stderr, res.stdout));
      appendTrialLog("Build failed — see Suggested fixes (Diagnostics tab and banner above editor)");
      setBottomTab("diagnostics");
    }
  };

  const runBuildFromPrompt = async (opts?: {
    workspaceRoot?: string;
    promptText?: string;
    genCategory?: PromptGenCategory | null;
    logSlot?: string;
  }) => {
    const ws = opts?.workspaceRoot ?? workspace;
    if (!ws) return;
    const vIdx = promptVersionIndex;
    const raw = opts?.promptText !== undefined ? opts.promptText : promptVersions[vIdx];
    const promptText = raw.trim();
    if (!promptText) return;
    const genCat = opts?.genCategory !== undefined ? opts.genCategory : promptGenCategory;
    setBusy("app");
    setAppPipelineStep("generate");
    setPipelineTokenEstimates(null);
    setStackVsTorqaCompare(null);
    setApiCallMetrics(null);
    setPipelineFailure(null);
    setBuildFailurePanel(null);
    setGate("idle");
    setBottomOpen(true);
    setBottomTab("output");
    setLastTorqaCommand("torqa --json app --workspace <ws> --prompt-stdin");
    setLastPreviewUrl(null);
    const slot = opts?.logSlot ?? `v${vIdx + 1}`;
    appendTrialLog(`Started: torqa app (${slot}) — generate → validate → materialize — profile: ${genCat ?? "auto"}`);

    let phaseTimer: number | undefined;
    phaseTimer = window.setInterval(() => {
      setAppPipelineStep((s) => {
        if (s === "generate") return "validate";
        if (s === "validate") return "build";
        return "build";
      });
    }, 1400);

    try {
      const res = await getShell().torqaRun({
        kind: "appPipeline",
        workspaceRoot: ws,
        prompt: promptText,
        maxRetries: 3,
        outDir: "torqa_generated_out",
        engineMode: "python_only",
        ...(genCat ? { genCategory: genCat } : {}),
      });
      if (phaseTimer != null) window.clearInterval(phaseTimer);
      phaseTimer = undefined;

      appendOutput("Build from prompt (torqa app)", res, "torqa --json app --workspace <ws> --prompt-stdin");
      const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
      appendTrialLog(`Core exit ${res.exitCode}${json?.ok ? " (JSON ok flag)" : ""}`);

      const stages = json?.stages as Record<string, unknown> | undefined;

      if (!json?.ok || res.exitCode !== 0) {
        setPipelineTokenEstimates(null);
        setStackVsTorqaCompare(null);
        const stagesFail = json?.stages as Record<string, unknown> | undefined;
        const genFail = stagesFail?.generate as Record<string, unknown> | undefined;
        setApiCallMetrics(parseApiMetrics(genFail?.api_metrics));
        const fail = summarizeAppPipelineFailure(json, res.stderr, res.stdout);
        setPipelineFailure(fail);
        setGate("fail");
        setDiagText(json ? JSON.stringify(json, null, 2) : res.stderr || res.stdout || "(no JSON)");
        setAppPipelineStep("idle");
        appendTrialLog("Failed — see Activity for why and suggested fixes");
        setBottomTab("activity");
        setBottomOpen(true);
        return;
      }

      const genStage = stages?.generate as Record<string, unknown> | undefined;
      const amGen = parseApiMetrics(genStage?.api_metrics);
      setApiCallMetrics(amGen);

      const th = stages?.token_hint as Record<string, unknown> | undefined;
      let pipelineTok: PipelineTokenEstimates | null = null;
      if (th && typeof th.prompt_token_estimate === "number" && typeof th.tq_token_estimate === "number") {
        const p = Number(th.prompt_token_estimate);
        const t = Number(th.tq_token_estimate);
        const r = typeof th.reduction_percent === "number" ? th.reduction_percent : null;
        pipelineTok = { promptTokens: p, tqTokens: t, reductionPercent: r };
        setPipelineTokenEstimates(pipelineTok);
        appendTrialLog(`Token hint: .tq ${Math.round(t)} vs prompt ${Math.round(p)}${r != null ? ` (${r}% reduction est.)` : ""}`);
      } else {
        setPipelineTokenEstimates(null);
      }

      if (amGen) {
        appendTrialLog(
          `OpenAI: ${amGen.httpCalls} HTTP call(s), ${Math.round(amGen.latencyMsTotal)} ms total, est. cost ${amGen.estimatedCostUsd != null ? `~$${amGen.estimatedCostUsd.toFixed(4)}` : "n/a"}`,
        );
      }

      setGate("ok");
      setAppPipelineStep("preview");
      appendTrialLog("Spec generated and project materialized");
      const wt = stages?.write_tq as Record<string, unknown> | undefined;
      const rel = typeof wt?.relative_path === "string" ? wt.relative_path : null;
      let tqSnapshot = "";
      if (rel) {
        await refreshTree(ws);
        const rd = await getShell().readFile(ws, rel);
        if (rd.ok) {
          tqSnapshot = rd.content;
          setActiveRel(rel);
          setContent(rd.content);
          setDirty(false);
          appendTrialLog(`Loaded ${rel} into editor`);
        }
      }
      if (tqSnapshot) {
        setStackVsTorqaCompare({
          nlPrompt: promptText,
          tqSource: tqSnapshot,
          promptTokens: pipelineTok?.promptTokens,
          tqTokens: pipelineTok?.tqTokens,
          reductionPercent: pipelineTok?.reductionPercent ?? null,
        });
      } else {
        setStackVsTorqaCompare(null);
      }
      if (json.diagnostics && isRecord(json.diagnostics)) {
        setDiagText(formatDiagnosticsHuman(json.diagnostics as Record<string, unknown>));
      }
      const w = json.written;
      setWritten(Array.isArray(w) ? (w as string[]) : []);
      setBuildSummaryLine(summarizeBuildPayload(json));

      const lw = json.local_webapp as Record<string, unknown> | undefined;
      const abs = lw?.webapp_dir_absolute;
      if (typeof abs === "string") {
        setLastWebappDir(abs);
        if (window.torqaShell?.startVitePreview) {
          appendTrialLog("Starting embedded preview (npm / Vite on a free port)…");
          const pv = await window.torqaShell.startVitePreview(abs);
          const failUrl = !pv.ok && typeof (pv as { url?: string }).url === "string" ? (pv as { url: string }).url : null;
          appendOutput(
            "Preview (Vite dev server)",
            pv.ok
              ? {
                  exitCode: 0,
                  stdout: `HTTP health check OK — embedded preview: ${pv.url} (port ${pv.port})`,
                  stderr: "",
                }
              : { exitCode: 1, stdout: failUrl ? `URL to try manually: ${failUrl}` : "", stderr: pv.error },
          );
          if (pv.ok) {
            setLastPreviewUrl(pv.url);
            setPreviewSplitOpen(true);
            setPreviewRefreshKey((k) => k + 1);
            appendTrialLog(`Preview ready (embedded): ${pv.url} port ${pv.port}`);
          } else {
            if (failUrl) {
              setLastPreviewUrl(failUrl);
              appendTrialLog(`Preview uncertain — use Open preview or terminal. ${failUrl}`);
            } else {
              setLastPreviewUrl(null);
            }
            appendTrialLog(`Preview error: ${pv.error}`);
            appendOutput("Preview fallback", {
              exitCode: 0,
              stdout: `In a terminal:\n  cd "${abs}"\n  npm install\n  npm run dev -- --host 127.0.0.1 --port 5173`,
              stderr: "",
            });
          }
        } else {
          appendTrialLog("No preview bridge — open generated/webapp manually");
        }
      } else {
        setLastWebappDir(null);
        appendTrialLog("No webapp path in response (check Output for details)");
      }

      setAppPipelineStep("done");
      appendTrialLog("Pipeline complete");
    } catch (e) {
      if (phaseTimer != null) window.clearInterval(phaseTimer);
      appendOutput("Build from prompt", { exitCode: 1, stdout: "", stderr: String(e) });
      appendTrialLog(`Exception: ${String(e)}`);
      setPipelineFailure({
        lines: ["Unexpected error while running the pipeline.", String(e)],
        fixes: ["Restart TORQA Desktop.", "If this repeats, copy Activity log and report an issue."],
        axis: "unknown",
      });
      setGate("fail");
      setAppPipelineStep("idle");
      setBottomTab("activity");
      setBottomOpen(true);
    } finally {
      if (phaseTimer != null) window.clearInterval(phaseTimer);
      setBusy("idle");
    }
  };

  const runOneClickDemo = async (demo: OneClickDemo) => {
    if (busy !== "idle") return;
    setProductMode("prompt");
    let wsPath = workspace;
    if (!wsPath) {
      const root = await openProject({ setMode: "prompt" });
      wsPath = root;
      if (!wsPath) {
        appendTrialLog("One-click demo cancelled — no folder selected.");
        return;
      }
    }
    appendTrialLog(`One-click demo: ${demo.label}`);
    setPromptVersionIndex(0);
    setPromptGenCategory(demo.genCategory);
    setPromptVersions((prev) => [demo.text, prev[1], prev[2]]);
    await runBuildFromPrompt({
      workspaceRoot: wsPath,
      promptText: demo.text,
      genCategory: demo.genCategory,
      logSlot: `one-click:${demo.id}`,
    });
  };

  const retryPreview = async () => {
    const dir = lastWebappDir;
    if (!dir || !window.torqaShell?.startVitePreview) return;
    setBottomOpen(true);
    setBottomTab("activity");
    appendTrialLog("Retry preview requested");
    const pv = await window.torqaShell.startVitePreview(dir);
    const failUrl = !pv.ok && typeof (pv as { url?: string }).url === "string" ? (pv as { url: string }).url : null;
    appendOutput(
      "Preview retry",
      pv.ok
        ? { exitCode: 0, stdout: `Health check OK — embedded: ${pv.url} (port ${pv.port})`, stderr: "" }
        : { exitCode: 1, stdout: failUrl ? `Try manually: ${failUrl}` : "", stderr: pv.error },
    );
    if (pv.ok) {
      setLastPreviewUrl(pv.url);
      setPreviewSplitOpen(true);
      setPreviewRefreshKey((k) => k + 1);
      appendTrialLog(`Preview: ${pv.url} port ${pv.port} (embedded)`);
    } else {
      if (failUrl) setLastPreviewUrl(failUrl);
      appendTrialLog(`Preview retry failed: ${pv.error}`);
    }
  };

  const openPreviewInBrowser = async () => {
    const u = lastPreviewUrl;
    if (!u) return;
    if (window.torqaShell?.openExternalUrl) {
      const r = await window.torqaShell.openExternalUrl(u);
      if (!r.ok) appendTrialLog(`Open URL failed: ${(r as { error?: string }).error ?? ""}`);
      else appendTrialLog(`Opened ${u}`);
    } else {
      window.open(u, "_blank", "noopener,noreferrer");
    }
  };

  const runGenerateTq = async () => {
    if (!workspace) return;
    const promptText = promptVersions[promptVersionIndex].trim();
    if (!promptText) return;
    setBusy("generate");
    setGate("idle");
    setStackVsTorqaCompare(null);
    setPipelineTokenEstimates(null);
    setApiCallMetrics(null);
    setPipelineFailure(null);
    setBottomOpen(true);
    setBottomTab("output");
    appendTrialLog(`Generate .tq — profile: ${promptGenCategory ?? "auto"}`);
    const res = await getShell().torqaRun({
      kind: "generateTq",
      workspaceRoot: workspace,
      prompt: promptText,
      maxRetries: 3,
      ...(promptGenCategory ? { genCategory: promptGenCategory } : {}),
    });
    appendOutput(
      "Generate .tq (core: torqa generate-tq — parse + diagnostics)",
      res,
      "torqa --json generate-tq --workspace <ws> --prompt-stdin",
    );
    const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
    const tqText = json && typeof json.tq_text === "string" ? json.tq_text : null;
    if (!json?.ok || !tqText) {
      setApiCallMetrics(parseApiMetrics(json?.api_metrics));
      setPipelineFailure(summarizeAppPipelineFailure(json, res.stderr, res.stdout));
      setGate("fail");
      setDiagText(json ? JSON.stringify(json, null, 2) : res.stderr || res.stdout || "(no JSON)");
      setBottomTab("diagnostics");
      setBusy("idle");
      return;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_");
    const name = `generated_${ts}.tq`;
    const wr = await getShell().saveFile(workspace, name, tqText);
    if (!wr.ok) {
      const amSaveFail = parseApiMetrics(json.api_metrics);
      setApiCallMetrics(amSaveFail);
      setPipelineFailure({
        lines: [`Could not save ${name}: ${wr.error}`],
        fixes: ["Check workspace folder permissions or pick another project folder."],
        axis: "setup",
      });
      appendOutput(`Save ${name}`, { exitCode: 1, stdout: "", stderr: wr.error });
      setGate("fail");
      setBottomTab("activity");
      setBusy("idle");
      return;
    }
    await refreshTree(workspace);
    setActiveRel(name);
    setContent(tqText);
    setDirty(false);
    setIrPreview("");
    setGate("ok");
    const amGtq = parseApiMetrics(json.api_metrics);
    setApiCallMetrics(amGtq);
    if (amGtq) {
      appendTrialLog(
        `OpenAI: ${amGtq.httpCalls} HTTP call(s), ${Math.round(amGtq.latencyMsTotal)} ms, est. ${amGtq.estimatedCostUsd != null ? `~$${amGtq.estimatedCostUsd.toFixed(4)}` : "n/a"}`,
      );
    }
    const th = json.token_hint as Record<string, unknown> | undefined;
    let ptok: PipelineTokenEstimates | null = null;
    if (th && typeof th.prompt_token_estimate === "number" && typeof th.tq_token_estimate === "number") {
      ptok = {
        promptTokens: Number(th.prompt_token_estimate),
        tqTokens: Number(th.tq_token_estimate),
        reductionPercent: typeof th.reduction_percent === "number" ? th.reduction_percent : null,
      };
      setPipelineTokenEstimates(ptok);
    } else {
      setPipelineTokenEstimates(null);
    }
    setStackVsTorqaCompare({
      nlPrompt: promptText,
      tqSource: tqText,
      promptTokens: ptok?.promptTokens,
      tqTokens: ptok?.tqTokens,
      reductionPercent: ptok?.reductionPercent ?? null,
    });
    appendTrialLog("NL vs TORQA execution layer — see Diagnostics for token + output comparison");
    setBottomTab("diagnostics");
    appendOutput(`Saved ${name}`, { exitCode: 0, stdout: "Valid .tq — use Validate / Build when ready (not auto-run).", stderr: "" });
    setBusy("idle");
  };

  const runBenchmark = async () => {
    setBusy("bench");
    setBottomOpen(true);
    setBottomTab("output");
    const hasOpenTq = Boolean(workspace && activeRel);
    const req: TorqaRequest = hasOpenTq
      ? { kind: "benchmark", workspaceRoot: workspace!, relativePath: activeRel! }
      : { kind: "benchmark" };
    const explain =
      "Core: if the open file sits in a P31 benchmark folder (BENCHMARK_TASK.md + app.tq + expected_output_summary.json), " +
      "runs `src.benchmarks.cli` on that directory with `--no-generated`. Otherwise runs `torqa --json demo benchmark` " +
      "(flagship baseline JSON shipped in the repo).";
    setLastTorqaCommand(hasOpenTq ? "benchmark (auto: P31 dir or flagship)" : "torqa --json demo benchmark");
    const res = await getShell().torqaRun(req);
    appendOutput("Benchmark", res, explain);
    const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
    const m = json?.metrics as BenchMetrics | undefined;
    setBenchMetrics(m && typeof m === "object" ? m : null);
    setRightOpen(true);
    setRightTab("bench");
    setBusy("idle");
  };

  const cmTheme = theme === "dark" ? vscodeDark : vscodeLight;
  const extensions = useMemo(() => [EditorView.lineWrapping], []);

  const statusClass =
    busy !== "idle" ? "run" : gate === "ok" ? "ok" : gate === "fail" ? "fail" : "idle";
  const statusLabel =
    busy === "surface"
      ? "Validating…"
      : busy === "build"
        ? "Building…"
        : busy === "bench"
          ? "Benchmark…"
          : busy === "generate"
            ? "Generating…"
            : busy === "app"
              ? "Pipeline…"
              : gate === "ok"
                ? "PASS"
                : gate === "fail"
                  ? "FAIL"
                  : "Ready";

  const workspaceShort =
    workspace && workspace.length > 48 ? `…${workspace.slice(-44)}` : workspace || "";

  if (!workspace) {
    return (
      <div className="shell">
        <header className="titlebar titlebar-minimal">
          <span className="brand">TORQA Desktop</span>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              title="Theme"
            >
              {theme === "dark" ? "◐" : "◑"}
            </button>
          </div>
        </header>
        <div className="launch-root">
          <div className="launch-inner">
            <div className="launch-brand">
              <h1>TORQA Desktop</h1>
              <p>Describe intent. Get a validated spec. Ship with the same core as the CLI.</p>
            </div>
            <div className="mode-pills" role="tablist" aria-label="Mode">
              <button
                type="button"
                role="tab"
                aria-selected={productMode === "prompt"}
                className={productMode === "prompt" ? "on" : ""}
                onClick={() => setProductMode("prompt")}
              >
                Prompt
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={productMode === "advanced"}
                className={productMode === "advanced" ? "on" : ""}
                onClick={() => setProductMode("advanced")}
              >
                Advanced · .tq
              </button>
            </div>
            {productMode === "prompt" ? (
              <div className="launch-card">
                <h2>Build from a prompt</h2>
                <p className="launch-onboarding">{ONBOARDING_LINE}</p>
                <p className="launch-tagline">
                  Pick an example or write your own. TORQA generates a validated <code>.tq</code> spec and a preview app in your
                  folder.
                </p>
                <div className="launch-template-row" role="group" aria-label="Example prompts and generation profile">
                  <button
                    type="button"
                    className={`btn btn-template-chip${promptGenCategory === null ? " on" : ""}`}
                    disabled={busy !== "idle"}
                    onClick={() => setPromptGenCategory(null)}
                    title="Let the core infer landing / CRUD / automation from your wording"
                  >
                    Auto profile
                  </button>
                  {PROMPT_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      className={`btn btn-template-chip${promptGenCategory === t.genCategory ? " on" : ""}`}
                      disabled={busy !== "idle"}
                      onClick={() => {
                        updatePromptAt(0, t.text);
                        setPromptGenCategory(t.genCategory);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="launch-textarea"
                  value={promptVersions[0]}
                  onChange={(e) => updatePromptAt(0, e.target.value)}
                  placeholder="e.g. A minimal sign-in flow with username, password, and audit fields..."
                  disabled={busy !== "idle"}
                  aria-label="Prompt"
                />
                {showTrialSetupHints ? (
                  <div className="trial-setup-hint">
                    <strong>First run</strong>
                    <ol>
                      <li>Choose an empty or test folder (TORQA writes files there).</li>
                      <li>Set <code>OPENAI_API_KEY</code> in your environment, then restart the app.</li>
                      <li>Install <a href="https://nodejs.org/">Node.js</a> for the browser preview (optional but recommended).</li>
                    </ol>
                    <button type="button" className="btn btn-compact" onClick={() => { markTrialHintsSeen(); setShowTrialSetupHints(false); }}>
                      Got it
                    </button>
                  </div>
                ) : null}
                <div className="launch-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void openProject({ setMode: "prompt" })}
                  >
                    Choose project folder
                  </button>
                </div>
                <div className="launch-one-click" role="region" aria-label="One-click demos">
                  <h3 className="launch-one-click-title">One-click demos</h3>
                  <p className="launch-one-click-desc">
                    Chooses a project folder if needed, then runs the full pipeline (generate → validate → materialize → embedded
                    preview when Node is available).
                  </p>
                  <div className="launch-one-click-row">
                    {ONE_CLICK_DEMOS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="btn btn-primary launch-demo-btn"
                        disabled={busy !== "idle"}
                        onClick={() => void runOneClickDemo(d)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="launch-footnote">
                  After you pick a folder: <strong>Build from prompt</strong> runs generate, validate, materialize, and opens
                  preview when possible. Or use <strong>Generate .tq only</strong>.
                </p>
              </div>
            ) : (
              <div className="launch-card">
                <h2>Edit existing TORQA</h2>
                <p className="launch-tagline">
                  Open a project folder or a single <code>.tq</code> file. Edit specs manually and run Validate / Build / Benchmark
                  against the same core.
                </p>
                <div className="launch-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void openProject({ setMode: "advanced" })}>
                    Choose folder
                  </button>
                  <button type="button" className="btn" onClick={() => void openTqFile()}>
                    Open .tq file…
                  </button>
                </div>
                <p className="launch-footnote">
                  Prefer generating from plain language? Switch to <strong>Prompt</strong> above.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="titlebar">
        <span className="brand">TORQA</span>
        <div className="titlebar-mode-pills" role="tablist" aria-label="Product mode">
          <button
            type="button"
            className={productMode === "prompt" ? "on" : ""}
            onClick={() => setProductMode("prompt")}
            title="Prompt-first: generate .tq from description"
          >
            Prompt
          </button>
          <button
            type="button"
            className={productMode === "advanced" ? "on" : ""}
            onClick={() => setProductMode("advanced")}
            title="Editor mode: open and edit .tq files"
          >
            Advanced
          </button>
        </div>
        <button type="button" className="btn" onClick={() => void openProject()} title="Change project folder">
          Folder…
        </button>
        <button type="button" className="btn" onClick={() => void openTqFile()} title="Ctrl+O · switches to Advanced">
          Open .tq…
        </button>
        <span
          className="status-pill idle"
          style={{ marginLeft: 8, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={workspace || undefined}
        >
          {workspaceShort}
        </span>
        <div className="toolbar-actions">
          <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          <button
            type="button"
            className="btn"
            disabled={!workspace || !activeRel || busy !== "idle"}
            onClick={() => void runValidate()}
            title="Validate current file via core"
          >
            Validate
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!workspace || !activeRel || busy !== "idle"}
            onClick={() => void runBuild()}
          >
            Build
          </button>
          <button type="button" className="btn" disabled={busy !== "idle"} onClick={() => void runBenchmark()}>
            Benchmark
          </button>
          <button
            type="button"
            className="btn"
            disabled={!activeRel}
            onClick={() => void saveFile()}
            title="Save (Ctrl/Cmd+S)"
          >
            Save
          </button>
          <button
            type="button"
            className="btn theme-toggle"
            onClick={() => setRightOpen((o) => !o)}
            title="Toggle right panel"
          >
            ⧉
          </button>
          <button type="button" className="btn theme-toggle" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "◐" : "◑"}
          </button>
        </div>
      </header>

      {productMode === "prompt" ? (
        <section className="prompt-strip prompt-strip-centered" aria-label="Prompt to app">
          <div className={`app-pipeline-track${busy === "app" ? " thinking" : ""}`}>
            {(["Generating", "Validating", "Building", "Launching"] as const).map((lab, i) => {
              const cur = appPipelineIndex(appPipelineStep);
              const done = appPipelineStep === "done" || cur > i;
              const active = busy === "app" && cur === i;
              return (
                <span key={lab} className={`app-pipeline-step${done ? " done" : ""}${active ? " active" : ""}`}>
                  {lab}
                </span>
              );
            })}
          </div>
          <div className="prompt-version-tabs" role="tablist" aria-label="Prompt version">
            {([0, 1, 2] as const).map((i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={promptVersionIndex === i}
                className={promptVersionIndex === i ? "on" : ""}
                disabled={busy !== "idle"}
                onClick={() => setPromptVersionIndex(i)}
              >
                v{i + 1}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-compact prompt-version-dup"
              disabled={busy !== "idle" || promptVersionIndex >= 2 || !promptVersions[promptVersionIndex].trim()}
              onClick={() => duplicatePromptToNextSlot()}
              title="Copy this prompt to the next slot for a new iteration"
            >
              Copy → next slot
            </button>
          </div>
          <textarea
            className="prompt-hero-input"
            value={promptVersions[promptVersionIndex]}
            onChange={(e) => updatePromptAt(promptVersionIndex, e.target.value)}
            placeholder="Describe what you want to build…"
            rows={4}
            disabled={busy !== "idle"}
            aria-label={`Prompt draft v${promptVersionIndex + 1}`}
          />
          <div className="prompt-template-row" role="group" aria-label="Generation profile and examples">
            <button
              type="button"
              className={`btn btn-template-chip${promptGenCategory === null ? " on" : ""}`}
              disabled={busy !== "idle"}
              onClick={() => setPromptGenCategory(null)}
              title="Infer profile from prompt text (no --gen-category)"
            >
              Auto
            </button>
            {PROMPT_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                className={`btn btn-template-chip${promptGenCategory === t.genCategory ? " on" : ""}`}
                disabled={busy !== "idle"}
                onClick={() => {
                  updatePromptAt(promptVersionIndex, t.text);
                  setPromptGenCategory(t.genCategory);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="prompt-category-hint">
            <strong>Profile:</strong> {promptGenCategory ?? "auto (heuristic)"} — locked categories send stricter .tq authoring rules to
            the model (core <code>tq_intent</code>).
          </p>
          <p className="prompt-onboarding-line" aria-live="polite">
            {ONBOARDING_LINE}
          </p>
          <div className="prompt-strip-row prompt-strip-actions">
            <button
              type="button"
              className="btn btn-primary btn-build-app"
              disabled={!workspace || !promptVersions[promptVersionIndex].trim() || busy !== "idle"}
              onClick={() => void runBuildFromPrompt()}
            >
              Build from prompt
            </button>
            <button
              type="button"
              className="btn"
              disabled={!workspace || !promptVersions[promptVersionIndex].trim() || busy !== "idle"}
              onClick={() => void runGenerateTq()}
              title="Only generate .tq — no build"
            >
              Generate .tq only
            </button>
            <button
              type="button"
              className="btn"
              disabled={!workspace || busy !== "idle"}
              onClick={() => improveThisApp()}
              title="Append an improvement line to the active v1–v3 prompt, then Build again"
            >
              Improve this app
            </button>
            <span className="prompt-strip-hint">
              <strong>Refine:</strong> Build → <strong>Improve this app</strong> (appends to active vN) → Build again. Use{" "}
              <strong>v1–v3</strong> to keep earlier drafts. Preview: ports <strong>5173–5228</strong>, then embedded pane + split
              view. Node/npm for Vite.
            </span>
          </div>
          {pipelineFailure && gate === "fail" ? (
            <div className="trial-failure-panel" role="alert">
              <h3 className="trial-failure-title">We could not finish the build</h3>
              <PipelineFailureAxisDiff axis={pipelineFailure.axis} />
              <ul className="trial-failure-list">
                {pipelineFailure.lines.map((line, i) => (
                  <li key={`l-${i}`}>{line}</li>
                ))}
              </ul>
              <p className="trial-failure-fixes-title">Try this</p>
              <ul className="trial-failure-fixes">
                {pipelineFailure.fixes.map((line, i) => (
                  <li key={`f-${i}`}>{line}</li>
                ))}
              </ul>
              <div className="trial-failure-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-compact"
                  disabled={!workspace || !promptVersions[promptVersionIndex].trim() || busy !== "idle"}
                  onClick={() => void runBuildFromPrompt()}
                >
                  Retry pipeline
                </button>
                <button type="button" className="btn btn-compact" onClick={() => setBottomTab("activity")}>
                  Open Activity log
                </button>
              </div>
              {apiCallMetrics ? (
                <div className="trial-failure-api-wrap">
                  <strong className="trial-failure-api-title">OpenAI calls before failure</strong>
                  <ApiCallMetricsPanel m={apiCallMetrics} compact />
                </div>
              ) : null}
            </div>
          ) : null}
          {gate === "ok" && appPipelineStep === "done" && busy === "idle" ? (
            <div className="trial-success-panel" role="status">
              <h3 className="trial-success-title">Your app is ready</h3>
              <GptTorqaSuccessDiff />
              {pipelineTokenEstimates ? (
                <div className="trial-success-tokens-wrap">
                  <TokenEstimatePanel estimates={pipelineTokenEstimates} />
                </div>
              ) : null}
              {apiCallMetrics ? (
                <div className="trial-success-api-wrap">
                  <ApiCallMetricsPanel m={apiCallMetrics} />
                </div>
              ) : null}
              {stackVsTorqaCompare ? (
                <div className="trial-success-compare-wrap">
                  <StackVsTorqaPanel snap={stackVsTorqaCompare} />
                </div>
              ) : null}
              <div className="trial-success-actions">
                {lastPreviewUrl ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={() => setPreviewSplitOpen(true)}>
                      Show split view
                    </button>
                    <button type="button" className="btn" onClick={() => void openPreviewInBrowser()}>
                      Open in browser
                    </button>
                    {lastWebappDir ? (
                      <button type="button" className="btn" onClick={() => void retryPreview()}>
                        Retry preview
                      </button>
                    ) : null}
                  </>
                ) : lastWebappDir ? (
                  <button type="button" className="btn btn-primary" onClick={() => void retryPreview()}>
                    Start preview
                  </button>
                ) : null}
              </div>
              {!lastPreviewUrl && lastWebappDir ? (
                <p className="trial-success-foot">
                  Preview did not start automatically. Install Node.js, then use Start preview, or run{" "}
                  <code>npm install</code> and <code>npm run dev</code> in <code>generated/webapp</code>.
                </p>
              ) : null}
            </div>
          ) : null}
          {pipelineTokenEstimates && gate === "ok" && appPipelineStep !== "done" ? (
            <div className="token-hint-banner">
              <TokenEstimatePanel estimates={pipelineTokenEstimates} variant="compact" />
            </div>
          ) : null}
          {stackVsTorqaCompare && gate === "ok" && busy === "idle" && appPipelineStep === "done" && productMode === "prompt" ? (
            <div className="stack-vs-torqa-strip" role="status">
              <span className="stack-vs-torqa-strip-msg">
                NL vs TORQA execution layer: token + side-by-side text in the success card above and in{" "}
                <strong>Diagnostics</strong>.
              </span>
              <div className="stack-vs-torqa-strip-actions">
                <button type="button" className="btn btn-compact" onClick={() => setBottomTab("diagnostics")}>
                  Open Diagnostics
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="body-row">
        <aside className="sidebar">
          <div className="sidebar-head">Project</div>
          <div className="sidebar-sub">{productMode === "prompt" ? ".tq files · prompt mode" : ".tq files · advanced"}</div>
          <details className="examples-details">
            <summary>Examples &amp; quick start</summary>
            <div className="examples-details-inner">
              <div className="sidebar-one-click">
                <div className="sidebar-one-click-label">One-click demos (folder picker if none open)</div>
                <div className="sidebar-one-click-btns">
                  {ONE_CLICK_DEMOS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="btn btn-compact btn-primary"
                      disabled={busy !== "idle"}
                      onClick={() => void runOneClickDemo(d)}
                      title={
                        workspace
                          ? "Full torqa app pipeline for this scenario"
                          : "Choose a folder if needed, then run the full pipeline"
                      }
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-compact btn-primary"
                disabled={!workspace || busy !== "idle"}
                onClick={() => void quickDemo()}
                title="Copy minimal sample and run Validate"
              >
                Quick demo
              </button>
              <button
                type="button"
                className="btn btn-compact"
                disabled={!workspace || busy !== "idle"}
                onClick={() => void seedSample("minimal")}
              >
                Load minimal sample
              </button>
              <button
                type="button"
                className="btn btn-compact"
                disabled={!workspace || busy !== "idle"}
                onClick={() => void seedSample("flagship")}
              >
                Load flagship sample
              </button>
            </div>
          </details>
          <div className="file-tree">
            {workspace && tqFiles.length === 0 ? (
              <div className="empty-hint" style={{ padding: "8px 10px", textAlign: "left" }}>
                No <code>.tq</code> files yet.{" "}
                {productMode === "prompt" ? "Use Build from prompt or Generate .tq only above" : "Add files or try Examples"}.
              </div>
            ) : null}
            {workspace &&
              tqFiles.map((f) => (
                <div
                  key={f}
                  className={`file-item${f === activeRel ? " active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => void loadFile(f)}
                  onKeyDown={(e) => e.key === "Enter" && void loadFile(f)}
                >
                  {f}
                </div>
              ))}
          </div>
        </aside>

        <section className="center">
          {buildFailurePanel && gate === "fail" && busy === "idle" ? (
            <div className="build-failure-banner" role="region" aria-label="Build suggested fixes">
              <div className="build-failure-banner-title">Build did not finish — try this</div>
              <ul className="build-failure-banner-fixes">
                {buildFailurePanel.fixes.slice(0, 8).map((line, i) => (
                  <li key={`bfb-${i}`}>{line}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-compact" onClick={() => setBottomTab("diagnostics")}>
                Open Diagnostics for details
              </button>
            </div>
          ) : null}
          <div
            className={`editor-split${previewSplitOpen && lastPreviewUrl ? " editor-split-active" : ""}`}
            ref={editorSplitRef}
          >
            <div
              className="editor-split-code"
              style={previewSplitOpen && lastPreviewUrl ? { width: `${previewEditorPercent}%`, flexShrink: 0 } : { flex: 1, minWidth: 0 }}
            >
              <div className="editor-head" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span>
                  {activeRel ? `${activeRel}${dirty ? " · modified" : ""}` : "No file open"}
                  {!activeRel && workspace && productMode === "prompt"
                    ? " — generate a spec or pick a file"
                    : !activeRel && workspace
                      ? " — open a file from the list or Examples"
                      : ""}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {lastPreviewUrl ? (
                    <>
                      <span className="editor-preview-toolbar" role="toolbar" aria-label="Preview">
                        <button
                          type="button"
                          className="btn btn-compact"
                          onClick={() => setPreviewSplitOpen((o) => !o)}
                          title={previewSplitOpen ? "Hide embedded preview (full-width editor)" : "Show code + preview split"}
                        >
                          {previewSplitOpen ? "Hide preview" : "Split preview"}
                        </button>
                        {previewSplitOpen ? (
                          <button
                            type="button"
                            className="btn btn-compact"
                            onClick={() => setPreviewRefreshKey((k) => k + 1)}
                            title="Reload iframe"
                          >
                            Reload
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-compact"
                          onClick={() => void openPreviewInBrowser()}
                          title="Open preview URL in the system browser"
                        >
                          Browser
                        </button>
                      </span>
                    </>
                  ) : null}
                  {paths ? (
                    <span
                      style={{ opacity: 0.65, textAlign: "right", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={`${paths.repoRoot}\n${paths.pythonExe}`}
                    >
                      Core connected
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="editor-wrap">
                {!activeRel ? (
                  <div className="empty-hint" style={{ maxWidth: 440, margin: "0 auto" }}>
                    {productMode === "prompt" ? (
                      <>
                        <strong>Prompt mode:</strong> use <strong>Build from prompt</strong> for the full pipeline, or{" "}
                        <strong>Generate .tq only</strong>. Advanced users can still <strong>Validate</strong> / <strong>Build</strong>{" "}
                        manually.
                      </>
                    ) : (
                      <>
                        <strong>Advanced mode:</strong> select a <code>.tq</code> file from the list, or use <strong>Examples</strong>{" "}
                        for a starter. All checks run in TORQA core.
                      </>
                    )}
                  </div>
                ) : (
                  <CodeMirror
                    value={content}
                    height="100%"
                    theme={cmTheme}
                    extensions={extensions}
                    onChange={(v) => {
                      setContent(v);
                      setDirty(true);
                    }}
                    basicSetup={{ lineNumbers: true, foldGutter: true }}
                  />
                )}
              </div>
            </div>
            {previewSplitOpen && lastPreviewUrl ? (
              <>
                <div
                  className="editor-split-gutter"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize editor and preview"
                  onMouseDown={onSplitGutterMouseDown}
                />
                <div className="editor-split-preview">
                  <div className="preview-pane-head">
                    <span className="preview-pane-title">Live preview</span>
                    <span className="preview-pane-url" title={lastPreviewUrl}>
                      {lastPreviewUrl}
                    </span>
                  </div>
                  <iframe
                    key={`${lastPreviewUrl}-${previewRefreshKey}`}
                    className="preview-iframe"
                    src={lastPreviewUrl}
                    title="Generated webapp preview"
                  />
                </div>
              </>
            ) : null}
          </div>
        </section>

        <aside className={`insight${rightOpen ? "" : " collapsed"}`}>
          <div className="insight-tabs">
            <button type="button" className={rightTab === "ir" ? "on" : ""} onClick={() => setRightTab("ir")}>
              IR preview
            </button>
            <button type="button" className={rightTab === "bench" ? "on" : ""} onClick={() => setRightTab("bench")}>
              Benchmark
            </button>
          </div>
          <div className="insight-body">
            {rightTab === "ir" ? (
              irPreview ? (
                <pre style={{ margin: 0 }}>{irPreview}</pre>
              ) : (
                <div className="empty-hint">Run <strong>Validate</strong> on a <code>.tq</code> file to load IR from core.</div>
              )
            ) : benchMetrics ? (
              <div>
                <div className="bm-hero">
                  {typeof benchMetrics.semantic_compression_ratio === "number"
                    ? `${benchMetrics.semantic_compression_ratio.toFixed(2)}×`
                    : "—"}
                </div>
                <div style={{ color: "var(--text-dim)", marginBottom: 12 }}>
                  Token estimates (flagship / P31 folder). Multi-scenario workflow proof (repo root):{" "}
                  <code>docs/TOKEN_PROOF.md</code> · <code>torqa-token-proof</code> ·{" "}
                  <code>reports/token_proof.json</code>. See Output for the exact command.
                </div>
                {(
                  [
                    ["task_prompt_token_estimate", "NL task (est.)"],
                    ["torqa_source_token_estimate", ".tq surface (est.)"],
                    ["ir_bundle_token_estimate", "IR bundle (est.)"],
                    ["generated_output_token_estimate", "Generated (est.)"],
                  ] as const
                ).map(([k, lab]) =>
                  typeof benchMetrics[k] === "number" ? (
                    <div key={k} className="bm-row">
                      <span>{lab}</span>
                      <span>{String(benchMetrics[k])}</span>
                    </div>
                  ) : null,
                )}
              </div>
            ) : (
              <div className="empty-hint">
                Run <strong>Benchmark</strong> for flagship-style compression on disk. For the public **workflow token
                proof** (five scenarios, validation-gated), see <code>docs/TOKEN_PROOF.md</code> and{" "}
                <code>torqa-token-proof</code>. If this panel stays empty, open the Output tab for stderr.
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className={`bottom${bottomOpen ? "" : " collapsed"}`}>
        <div className="bottom-tabs">
          <button type="button" className={bottomTab === "output" ? "on" : ""} onClick={() => setBottomTab("output")}>
            Output
          </button>
          <button
            type="button"
            className={bottomTab === "diagnostics" ? "on" : ""}
            onClick={() => setBottomTab("diagnostics")}
          >
            Diagnostics
          </button>
          <button
            type="button"
            className={bottomTab === "activity" ? "on" : ""}
            onClick={() => setBottomTab("activity")}
            title="Step-by-step log of what the app did"
          >
            Activity
          </button>
          {pipelineStages.length > 0 && (
            <div className="pipeline" style={{ marginLeft: 12 }}>
              {(pipelineStages as { stage?: string; stage_ok?: boolean }[]).map((s, i) => (
                <span
                  key={`${s.stage}-${i}`}
                  className={`pipe-step${s.stage_ok ? " ok" : s.stage_ok === false ? " fail" : ""}`}
                >
                  {s.stage ?? "?"}
                </span>
              ))}
            </div>
          )}
          {lastTorqaCommand ? (
            <span
              className="pipeline"
              style={{ marginLeft: 8, opacity: 0.75, fontSize: 11, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={lastTorqaCommand}
            >
              Last core: {lastTorqaCommand.length > 42 ? `${lastTorqaCommand.slice(0, 40)}…` : lastTorqaCommand}
            </span>
          ) : null}
          <button type="button" className="bottom-toggle" onClick={() => setBottomOpen((o) => !o)}>
            {bottomOpen ? "▼" : "▲"}
          </button>
        </div>
        {bottomOpen ? (
          <div className="bottom-body">
            {bottomTab === "output" ? (
              outputText || <span className="empty-hint">Command output from TORQA core will appear here.</span>
            ) : bottomTab === "activity" ? (
              <div className="activity-panel">
                {pipelineFailure ? (
                  <div className="activity-failure-block">
                    <strong>Prompt pipeline — last failure</strong>
                    <p className="activity-failure-axis">
                      Classified axis:{" "}
                      <strong>
                        {pipelineFailure.axis === "gpt"
                          ? "GPT / OpenAI (LLM path)"
                          : pipelineFailure.axis === "torqa"
                            ? "TORQA (deterministic gates)"
                            : pipelineFailure.axis === "setup"
                              ? "Setup (workspace / prompt)"
                              : "Unknown — see log"}
                      </strong>
                    </p>
                    <ul className="activity-log-list">
                      {pipelineFailure.lines.map((line, i) => (
                        <li key={`pf-${i}`}>{line}</li>
                      ))}
                    </ul>
                    <strong>Suggested fixes</strong>
                    <ul className="activity-log-list">
                      {pipelineFailure.fixes.map((line, i) => (
                        <li key={`fx-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {buildFailurePanel ? (
                  <div className="activity-failure-block">
                    <strong>Build — suggested fixes</strong>
                    <ul className="activity-log-list">
                      {buildFailurePanel.fixes.map((line, i) => (
                        <li key={`bf-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {trialLog.length ? (
                  <ul className="activity-log-list activity-log-steps">
                    {trialLog.map((line, i) => (
                      <li key={`tl-${i}`}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="empty-hint">
                    Activity fills in as you run <strong>Build from prompt</strong> — timestamps show what happened in order.
                  </span>
                )}
              </div>
            ) : (
              <>
                {pipelineFailure ? (
                  <div className="diagnostics-pipeline-failure-block">
                    <PipelineFailureAxisDiff axis={pipelineFailure.axis} compact />
                  </div>
                ) : null}
                {buildFailurePanel ? (
                  <div className="build-failure-diagnostics" role="region" aria-label="Build failure details">
                    <strong style={{ display: "block", marginBottom: 8 }}>Suggested fixes (from core)</strong>
                    <ul className="activity-log-list" style={{ marginBottom: 12 }}>
                      {buildFailurePanel.fixes.map((line, i) => (
                        <li key={`bdf-${i}`}>{line}</li>
                      ))}
                    </ul>
                    <strong style={{ display: "block", marginBottom: 8 }}>Details</strong>
                    <ul className="activity-log-list" style={{ marginBottom: 16 }}>
                      {buildFailurePanel.lines.slice(0, 24).map((line, i) => (
                        <li key={`bdl-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {pipelineTokenEstimates ? (
                  <div className="diagnostics-token-block">
                    <strong className="diagnostics-token-heading">Prompt pipeline — token estimates</strong>
                    <TokenEstimatePanel estimates={pipelineTokenEstimates} variant="compact" />
                  </div>
                ) : null}
                {apiCallMetrics ? (
                  <div className="diagnostics-api-block">
                    <strong className="diagnostics-api-heading">OpenAI API — latency, retries, cost</strong>
                    <ApiCallMetricsPanel m={apiCallMetrics} compact />
                  </div>
                ) : null}
                {stackVsTorqaCompare ? (
                  <div className="diagnostics-compare-block">
                    <strong className="diagnostics-compare-heading">Assistants (NL) vs TORQA execution layer</strong>
                    <StackVsTorqaPanel snap={stackVsTorqaCompare} compact />
                  </div>
                ) : null}
                {buildSummaryLine ? (
                  <pre style={{ margin: "0 0 8px", color: "var(--accent, #6cb3ff)" }}>{buildSummaryLine}</pre>
                ) : null}
                {pipelineSummary ? (
                  <pre style={{ margin: "0 0 8px" }}>{JSON.stringify(pipelineSummary, null, 2)}</pre>
                ) : null}
                {diagText ||
                  (!buildFailurePanel &&
                  !pipelineFailure &&
                  !pipelineTokenEstimates &&
                  !apiCallMetrics &&
                  !stackVsTorqaCompare &&
                  !buildSummaryLine &&
                  !pipelineSummary &&
                  written.length === 0 ? (
                    <span className="empty-hint">No diagnostics yet. Run <strong>Validate</strong> or <strong>Build</strong>.</span>
                  ) : null)}
                {written.length > 0 ? (
                  <div>
                    <strong>Generated paths</strong>
                    <ul className="written-list">
                      {written.slice(0, 80).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                    {written.length > 80 ? <div>... {written.length - 80} more</div> : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function ElectronMissing() {
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);
  return (
    <div
      className="shell electron-missing"
      data-theme="dark"
      style={{
        padding: "28px 32px",
        maxWidth: 760,
        margin: "0 auto",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Klasör / .tq açma bu görünümde çalışmaz</h1>
      <p style={{ lineHeight: 1.65 }}>
        <code>torqaShell</code> yüklenmedi — arayüz büyük ihtimalle <strong>tarayıcıda</strong> (ör.{" "}
        <code>http://localhost:5173</code>) açılıyor. Dosya diyaloğu yalnızca{" "}
        <strong>Electron masaüstü penceresinde</strong> çalışır; tarayıcıda güvenlik nedeniyle köprü yoktur.
      </p>
      <h2 style={{ marginBottom: 12 }}>Şunu yapın</h2>
      <ol style={{ lineHeight: 1.75 }}>
        <li>
          Bu tarayıcı sekmesini kapatın (adres çubuğunda <code>http://</code> görüyorsanız doğrudan bu hatadır).
        </li>
        <li>
          PowerShell / Terminal:{" "}
          <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 8, background: "var(--panel, #2d2d2d)" }}>
            {`cd desktop\nnpm install\nnpm run build\nnpm start`}
          </pre>
        </li>
        <li>
          Alternatif (repo kökü): <code>pip install -e .</code> ardından <code>torqa-desktop</code>
        </li>
        <li>
          <code>npm run dev</code> kullanıyorsanız: Electron’un açtığı <strong>masaüstü penceresini</strong> kullanın (gömülü önizleme
          bu pencerededir).
        </li>
      </ol>
      <p style={{ opacity: 0.85, fontSize: 13 }}>
        Doğru pencerede adres çubuğu yoktur; üstte “File” menüsü ve TORQA uygulaması görünür.
      </p>
    </div>
  );
}

export default function App() {
  if (typeof window !== "undefined" && !window.torqaShell) {
    return <ElectronMissing />;
  }
  return <DesktopApp />;
}

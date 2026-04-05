import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { TorqaRequest } from "./torqaApi";
import { tryParseTorqaJson } from "./parseTorqaJson";
import { ComparisonSummaryPanel } from "./ComparisonSummaryPanel";
import { ModelComparePanel } from "./ModelComparePanel";
import type { ReferenceAggregate } from "./modelCompareReference";
import { parseReferenceAggregateFromTokenProofJson } from "./modelCompareReference";
import { createTranslate, detectLocale, I18nProvider, LanguageToggle, useI18n, type Translate } from "./i18n";
import { P131Hint } from "./P131Hint";
import {
  dismissP131Hint,
  loadP131,
  markP131Milestone,
  P131_HINT_READY_BUILD,
  P131_HINT_TRY_COMPARE,
  P131_HINT_TRY_PREVIEW,
  P131_HINT_WELCOME_HOME,
  shouldShowHint,
  type P131Snapshot,
} from "./p131Onboarding";
import { recordTrialEvent } from "./trialClient";
import { TrialFeedbackPanel } from "./TrialFeedbackPanel";

type ThemeMode = "dark" | "light";

type ProductMode = "prompt" | "advanced";

type BenchMetrics = Record<string, number | boolean | null | undefined>;

type AppPipelineVisual = "idle" | "generate" | "validate" | "build" | "preview" | "done";

/** Locks `torqa app` / `generate-tq` to a core profile (CLI `--gen-category`). */
type PromptGenCategory =
  | "landing"
  | "crud"
  | "automation"
  | "crm"
  | "onboarding"
  | "approvals"
  | "dashboard";

/** P114: LLM vendor passed to core `--llm-provider`. */
type LlmProviderChoice = "openai" | "anthropic" | "google";

/** P129: `--llm-gen-mode` preset (default balanced = core defaults). */
type LlmGenModeChoice = "balanced" | "cheapest" | "fastest" | "highest_quality" | "most_reliable";

const LS_LLM_MODEL_ID = "torqa-desktop-llm-model-id";
const LS_LLM_FALLBACK_ID = "torqa-desktop-llm-fallback-id";
const LS_LLM_GEN_MODE = "torqa-desktop-llm-gen-mode";

const PRODUCT_MODE_KEY = "torqa-desktop-product-mode";

function readLocalStorageString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function readLlmGenModeChoice(): LlmGenModeChoice {
  const v = readLocalStorageString(LS_LLM_GEN_MODE, "balanced").toLowerCase();
  const ok: LlmGenModeChoice[] = ["balanced", "cheapest", "fastest", "highest_quality", "most_reliable"];
  return (ok.includes(v as LlmGenModeChoice) ? v : "balanced") as LlmGenModeChoice;
}

const EMPTY_PROMPT_VERSIONS: [string, string, string] = ["", "", ""];

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
  t: Translate,
): { lines: string[]; fixes: string[]; axis: FailureAxis } {
  const lines: string[] = [];
  const fixes: string[] = [];
  if (!json) {
    lines.push(t("fail.noJson"));
    const tail = (stderr || stdout).trim();
    if (tail) lines.push(tail.length > 1400 ? `${tail.slice(0, 1400)}...` : tail);
    fixes.push(t("fail.fix.core"));
    fixes.push(t("fail.fix.apikey"));
    return { lines, fixes, axis: "unknown" };
  }
  const stage = typeof json.stage === "string" ? json.stage : null;
  const message = typeof json.message === "string" ? json.message : null;
  if (stage) lines.push(t("fail.stage", { stage }));
  if (message) lines.push(message);
  const errs = json.errors;
  if (Array.isArray(errs) && errs.length) {
    lines.push(t("fail.errors"));
    for (const e of errs.slice(0, 10)) lines.push(`  • ${String(e)}`);
  }
  const issues = json.issues;
  if (Array.isArray(issues) && issues.length) {
    lines.push(t("fail.issues"));
    for (const it of issues.slice(0, 8)) {
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        lines.push(`  • ${o.message != null ? String(o.message) : JSON.stringify(o)}`);
      } else lines.push(`  • ${String(it)}`);
    }
  }
  const code = json.code != null ? String(json.code) : "";
  const hint = typeof json.hint === "string" ? json.hint : null;
  if (code) lines.push(t("fail.code", { code }));
  if (hint) lines.push(t("fail.hint", { hint }));

  if (stage === "invalid_prompt" || (message && message.toLowerCase().includes("empty prompt"))) {
    fixes.push(t("fail.fix.prompt"));
  }
  if (
    stage === "generate" ||
    code.includes("PX_AI") ||
    (message && /openai|api key|401|403/i.test(message))
  ) {
    fixes.push(t("fail.fix.openaiEnv"));
    fixes.push(t("fail.fix.network"));
  }
  if (stage === "parse" || code.toLowerCase().includes("parse") || code.includes("TQ")) {
    fixes.push(t("fail.fix.simplify"));
  }
  for (const s of collectSuggestedNextStrings(json)) {
    if (!fixes.includes(s)) fixes.push(s);
  }
  if (fixes.length === 0) {
    fixes.push(t("fail.fix.activity"));
  }
  const stagesGen = (json.stages as Record<string, unknown> | undefined)?.generate;
  const relNested = isRecord(stagesGen) ? stagesGen.reliability : undefined;
  const relTop = json.reliability;
  const rel = isRecord(relNested) ? relNested : isRecord(relTop) ? relTop : null;
  if (rel) {
    const ac = rel.attempt_count;
    if (typeof ac === "number" && ac > 1) {
      lines.push(t("fail.reliability.attempts", { n: String(ac) }));
    }
    const kinds = rel.failure_kinds_seen_in_order;
    if (Array.isArray(kinds) && kinds.length) {
      lines.push(t("fail.reliability.kinds", { kinds: kinds.map(String).join(", ") }));
    }
  }
  const axis = classifyPipelineFailureAxis(json);
  return { lines: lines.length ? lines : [t("fail.incomplete")], fixes, axis };
}

function PipelineFailureAxisDiff({ axis, compact }: { axis: FailureAxis; compact?: boolean }) {
  const { t } = useI18n();
  const gptActive = axis === "gpt";
  const torqaActive = axis === "torqa";
  const setupActive = axis === "setup";
  return (
    <div
      className={`failure-axis-diff${compact ? " failure-axis-diff--compact" : ""}`}
      role="region"
      aria-label={t("failure.axis.aria")}
    >
      <div className="failure-axis-diff-title">{t("failure.axis.title")}</div>
      <div className="failure-axis-diff-grid">
        <div
          className={`failure-axis-col failure-axis-col--gpt${gptActive ? " failure-axis-col--active" : ""}`}
          data-active={gptActive ? "true" : undefined}
        >
          <div className="failure-axis-col-head">{t("failure.axis.gpt.head")}</div>
          <p className="failure-axis-col-lede">{t("failure.axis.gpt.lede")}</p>
          {gptActive ? <p className="failure-axis-col-badge">{t("failure.axis.gpt.badge")}</p> : null}
        </div>
        <div
          className={`failure-axis-col failure-axis-col--torqa${torqaActive ? " failure-axis-col--active" : ""}`}
          data-active={torqaActive ? "true" : undefined}
        >
          <div className="failure-axis-col-head">{t("failure.axis.torqa.head")}</div>
          <p className="failure-axis-col-lede">{t("failure.axis.torqa.lede")}</p>
          {torqaActive ? <p className="failure-axis-col-badge">{t("failure.axis.torqa.badge")}</p> : null}
        </div>
      </div>
      {setupActive ? (
        <p className="failure-axis-setup-note">
          <strong>{t("failure.axis.setup.bold")}</strong>
          {t("failure.axis.setup.after")}
        </p>
      ) : null}
      {axis === "unknown" ? (
        <p className="failure-axis-setup-note">
          {t("failure.axis.unknownNote", {
            pxai: "PX_AI",
            gpt: t("failure.axis.noteBold.gpt"),
            torqa: t("failure.axis.noteBold.torqa"),
          })}
        </p>
      ) : null}
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
    throw new Error(createTranslate(detectLocale())("shell.bridge.error"));
  }
  return s;
}

/** Lets React paint loading state before a long `ipcRenderer.invoke` (P102). */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

const TORQA_PROGRESS_PREFIX = "TORQA_PROGRESS_JSON:";

/** P116: lines core prints to stderr during multi-phase .tq generation. */
function parseTorqaStderrProgress(stderr: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const line of (stderr || "").split("\n")) {
    const p = line.indexOf(TORQA_PROGRESS_PREFIX);
    if (p < 0) continue;
    try {
      const o = JSON.parse(line.slice(p + TORQA_PROGRESS_PREFIX.length)) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) out.push(o as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function appendTorqaProgressTrialLog(stderr: string, append: (s: string) => void, t: Translate) {
  for (const row of parseTorqaStderrProgress(stderr)) {
    if (row.kind !== "tq_gen_phase") continue;
    append(
      t("p116.progressLine", {
        phase: String(row.phase ?? ""),
        total: String(row.total ?? ""),
        id: String(row.id ?? ""),
        status: String(row.status ?? ""),
      }),
    );
  }
}

function GenPhaseTraceRow({ trace, t }: { trace: Record<string, unknown>[]; t: Translate }) {
  return (
    <div className="p116-phase-trace" role="list" aria-label={t("p116.trace.aria")}>
      <div className="p116-phase-trace-title">{t("p116.trace.title")}</div>
      <div className="p116-phase-trace-pills">
        {trace.map((row, i) => {
          const ok = row.ok === true;
          const pid = String(row.id ?? row.phase ?? i);
          return (
            <span
              key={`${pid}-${i}`}
              className={`p116-phase-pill${ok ? " p116-phase-pill--ok" : " p116-phase-pill--fail"}`}
              role="listitem"
            >
              {String(row.phase ?? i + 1)}/{String(row.total ?? "?")} · {pid}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function InlineSpinner({ label }: { label?: string }) {
  return (
    <span className="p102-spinner-wrap" role="presentation">
      <span className="p102-spinner" aria-hidden />
      {label ? <span className="p102-spinner-label">{label}</span> : null}
    </span>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Readable diagnostics for the Diagnostics tab (core JSON shape). */
function formatDiagnosticsHuman(d: Record<string, unknown>, t?: Translate): string {
  const tr = t ?? createTranslate(detectLocale());
  const lines: string[] = [];
  if (typeof d.ok === "boolean") lines.push(`ok: ${d.ok}`);
  const issues = d.issues;
  if (Array.isArray(issues) && issues.length) {
    lines.push("", tr("diag.human.issues"));
    for (const it of issues.slice(0, 48)) {
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        const msg = o.message != null ? String(o.message) : JSON.stringify(o);
        lines.push(`  • ${msg}`);
        if (o.code != null) lines.push(`    code: ${String(o.code)}`);
      } else lines.push(`  • ${String(it)}`);
    }
    if (issues.length > 48) lines.push(tr("diag.human.more", { n: issues.length - 48 }));
  }
  const warnings = d.warnings;
  if (Array.isArray(warnings) && warnings.length) {
    lines.push("", tr("diag.human.warnings"));
    for (const w of warnings.slice(0, 24)) {
      lines.push(`  • ${typeof w === "object" && w !== null ? JSON.stringify(w) : String(w)}`);
    }
  }
  const sem = d.semantic_report;
  if (isRecord(sem)) {
    const errs = sem.errors;
    const warns = sem.warnings;
    if (Array.isArray(errs) && errs.length) {
      lines.push("", tr("diag.human.semErr"));
      for (const e of errs.slice(0, 16)) lines.push(`  • ${JSON.stringify(e)}`);
    }
    if (Array.isArray(warns) && warns.length) {
      lines.push("", tr("diag.human.semWarn"));
      for (const w of warns.slice(0, 16)) lines.push(`  • ${JSON.stringify(w)}`);
    }
  }
  if (lines.length <= 1 && Object.keys(d).length) return JSON.stringify(d, null, 2);
  return lines.join("\n");
}

const MAX_REPAIR_CONTEXT = 6000;
const MAX_SOURCE_IN_REPAIR = 32000;

function surfaceFailureSummaryForRepair(
  json: Record<string, unknown> | null,
  stderr: string,
  t?: Translate,
): string {
  const parts: string[] = [];
  if (json) {
    if (typeof json.message === "string") parts.push(json.message);
    if (json.code != null) parts.push(`code: ${String(json.code)}`);
    if (typeof json.hint === "string") parts.push(`hint: ${json.hint}`);
    const d = json.diagnostics;
    if (isRecord(d)) parts.push(formatDiagnosticsHuman(d, t).slice(0, 4000));
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

/** P103 — plain-language status for each pipeline phase (from `torqa app` JSON). */
type HumanPhaseStatus = "ok" | "fail" | "skipped" | "waiting";

type HumanPhase = { status: HumanPhaseStatus; text: string };

type HumanPipelineSteps = {
  generating: HumanPhase;
  validating: HumanPhase;
  building: HumanPhase;
  launching: HumanPhase;
};

function humanizeAppPipelineStages(
  json: Record<string, unknown> | null,
  overallOk: boolean,
  previewOutcome: "ok" | "failed" | "none",
  t: Translate,
): HumanPipelineSteps {
  if (!json) {
    return {
      generating: { status: "fail", text: t("human.none.result") },
      validating: { status: "skipped", text: t("human.dash") },
      building: { status: "skipped", text: t("human.dash") },
      launching: { status: "skipped", text: t("human.dash") },
    };
  }
  const stages = json.stages as Record<string, unknown> | undefined;
  const gen = stages?.generate;
  const parse = stages?.parse;
  const mat = stages?.materialize;
  const genOk = isRecord(gen) && gen.ok === true;
  const genFail = isRecord(gen) && gen.ok === false;
  const parseOk = isRecord(parse) && parse.ok === true;
  const parseFail = isRecord(parse) && parse.ok === false;
  const matOk = isRecord(mat) && mat.ok === true;
  const matFail = isRecord(mat) && mat.ok === false;

  const generating: HumanPhase = genFail
    ? { status: "fail", text: t("human.gen.fail") }
    : genOk
      ? { status: "ok", text: t("human.gen.ok") }
      : { status: "waiting", text: t("human.gen.wait") };

  const validating: HumanPhase =
    genFail || !genOk
      ? { status: "skipped", text: t("human.val.skip.draft") }
      : parseFail
        ? { status: "fail", text: t("human.val.fail.parse") }
        : parseOk
          ? { status: "ok", text: t("human.val.ok") }
          : { status: "waiting", text: t("human.val.wait") };

  const building: HumanPhase =
    genFail || parseFail || !genOk
      ? { status: "skipped", text: t("human.build.skip") }
      : matFail
        ? { status: "fail", text: t("human.build.fail.write") }
        : matOk
          ? { status: "ok", text: t("human.build.ok") }
          : !overallOk
            ? { status: "fail", text: t("human.build.fail.generic") }
            : { status: "ok", text: t("human.build.ok") };

  const launching: HumanPhase =
    !overallOk || matFail || parseFail || genFail
      ? { status: "skipped", text: t("human.launch.skip") }
      : previewOutcome === "ok"
        ? { status: "ok", text: t("human.launch.ok.preview") }
        : previewOutcome === "failed"
          ? { status: "ok", text: t("human.launch.ok.node") }
          : { status: "skipped", text: t("human.launch.skip.preview") };

  return { generating, validating, building, launching };
}

function pipelineBusyHint(step: AppPipelineVisual, t: Translate): string {
  if (step === "generate") return t("pipeline.busy.generate");
  if (step === "validate") return t("pipeline.busy.validate");
  if (step === "build") return t("pipeline.busy.build");
  if (step === "preview") return t("pipeline.busy.preview");
  if (step === "done") return t("pipeline.busy.done");
  return t("pipeline.busy.working");
}

function FriendlyFailureLead({ axis }: { axis: FailureAxis }) {
  const { t } = useI18n();
  const msg =
    axis === "gpt"
      ? t("failure.lead.gpt")
      : axis === "torqa"
        ? t("failure.lead.torqa")
        : axis === "setup"
          ? t("failure.lead.setup")
          : t("failure.lead.unknown");
  return <p className="p103-failure-lead">{msg}</p>;
}

function PipelineRunSummaryList({ steps }: { steps: HumanPipelineSteps }) {
  const { t } = useI18n();
  const rows: { key: string; label: string; phase: HumanPhase }[] = [
    { key: "g", label: t("pipeline.summary.generating"), phase: steps.generating },
    { key: "v", label: t("pipeline.summary.validating"), phase: steps.validating },
    { key: "b", label: t("pipeline.summary.building"), phase: steps.building },
    { key: "l", label: t("pipeline.summary.launching"), phase: steps.launching },
  ];
  return (
    <ul className="p103-summary-list">
      {rows.map(({ key, label, phase }) => (
        <li key={key} className={`p103-summary-row p103-summary-row--${phase.status}`}>
          <span className="p103-summary-mark" aria-hidden />
          <div className="p103-summary-body">
            <span className="p103-summary-label">{label}</span>
            <span className="p103-summary-text">{phase.text}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

const PIPELINE_PHASE_KEYS: (keyof HumanPipelineSteps)[] = ["generating", "validating", "building", "launching"];

function appPipelineStepPillClass(
  index: number,
  human: HumanPipelineSteps | null,
  busy: "idle" | "surface" | "build" | "bench" | "generate" | "app",
  appPipelineStep: AppPipelineVisual,
  gate: "idle" | "ok" | "fail",
): string {
  const key = PIPELINE_PHASE_KEYS[index];
  if (human) {
    const st = human[key].status;
    if (st === "fail") return "app-pipeline-step fail";
    if (st === "ok") return "app-pipeline-step done";
    if (st === "skipped") return "app-pipeline-step skipped";
    return "app-pipeline-step";
  }
  const cur = appPipelineIndex(appPipelineStep);
  const done = appPipelineStep === "done" || cur > index;
  const active = busy === "app" && gate === "idle" && cur === index;
  return `app-pipeline-step${done ? " done" : ""}${active ? " active" : ""}`;
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
  t: Translate,
): { lines: string[]; fixes: string[] } {
  if (!json) {
    const tail = (stderr || stdout).trim();
    return {
      lines: tail ? [tail.length > 1800 ? `${tail.slice(0, 1800)}…` : tail] : [t("buildFailure.noJson")],
      fixes: [t("buildFailure.openOutput"), t("buildFailure.pip")],
    };
  }
  const lines: string[] = [];
  const fixes = collectSuggestedNextStrings(json);
  const d = json.diagnostics;
  if (isRecord(d)) {
    for (const s of collectSuggestedNextStrings(d)) {
      if (!fixes.includes(s)) fixes.push(s);
    }
    const human = formatDiagnosticsHuman(d, t);
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
    fixes.push(t("buildFailure.openOutput"), t("buildFailure.editTq"));
  }
  const uniqueLines = lines.filter(Boolean);
  return { lines: uniqueLines.length ? uniqueLines : [t("buildFailure.generic")], fixes };
}

/** Token estimates from `token_hint` in app / generate-tq / build JSON. */
type TokenComparisonBasis = "nl_prompt" | "ir_bundle_json";

type PipelineTokenEstimates = {
  promptTokens: number;
  tqTokens: number;
  reductionPercent: number | null;
  compressionRatio: number | null;
  comparisonBasis: TokenComparisonBasis;
  estimatorId?: string;
};

type TokenProofRef = {
  avgPromptReductionPct: number;
  avgCompressionRatio: number;
  scenarioCount: number;
  suiteId: string;
};

const ILLUSTRATIVE_INPUT_USD_PER_1M = 2.5;

function illustrativeInputCostUsd(tokens: number): number {
  return (tokens / 1_000_000) * ILLUSTRATIVE_INPUT_USD_PER_1M;
}

function parsePipelineTokenHint(th: Record<string, unknown> | undefined): PipelineTokenEstimates | null {
  if (!th) return null;
  const p = th.prompt_token_estimate;
  const tq = th.tq_token_estimate;
  if (typeof p !== "number" || typeof tq !== "number") return null;
  if (!Number.isFinite(p) || !Number.isFinite(tq)) return null;
  const promptTokens = p;
  const tqTokens = tq;
  const basisRaw = th.comparison_basis;
  const comparisonBasis: TokenComparisonBasis = basisRaw === "ir_bundle_json" ? "ir_bundle_json" : "nl_prompt";
  let reductionPercent: number | null =
    typeof th.reduction_percent === "number" && Number.isFinite(th.reduction_percent) ? th.reduction_percent : null;
  if (reductionPercent == null && promptTokens > 0) {
    reductionPercent = Math.round(10000 * (1 - tqTokens / promptTokens)) / 100;
  }
  let compressionRatio: number | null =
    typeof th.compression_ratio === "number" && Number.isFinite(th.compression_ratio) ? th.compression_ratio : null;
  if (compressionRatio == null && tqTokens > 0) {
    compressionRatio = Math.round(10000 * (promptTokens / tqTokens)) / 10000;
  }
  const estimatorId = typeof th.estimator_id === "string" ? th.estimator_id : undefined;
  return { promptTokens, tqTokens, reductionPercent, compressionRatio, comparisonBasis, estimatorId };
}

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

function providerDisplayName(t: Translate, raw: string): string {
  const k = raw.toLowerCase();
  if (k === "openai") return t("llm.gpt");
  if (k === "anthropic") return t("llm.claude");
  if (k === "google") return t("llm.gemini");
  return raw.trim() ? raw : t("tokenPanel.emdash");
}

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

/** Snapshot after `torqa app` / `generate-tq`: same NL task vs validated .tq (assistant-style brief vs TORQA execution layer). */
type StackVsTorqaComparison = {
  nlPrompt: string;
  tqSource: string;
  promptTokens?: number;
  tqTokens?: number;
  reductionPercent: number | null;
};

function StackVsTorqaPanel({ snap, compact }: { snap: StackVsTorqaComparison; compact?: boolean }) {
  const { t } = useI18n();
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
  const ratioPart =
    nlChars > 0 ? t("stack.stats.ratio", { pct: String(Math.round((100 * tqChars) / nlChars)) }) : "";
  return (
    <div className={root} role="region" aria-label={t("stack.aria")}>
      <h4 className="stack-vs-torqa-heading">{t("stack.title")}</h4>
      <p className="stack-vs-torqa-lede">
        {t("stack.lede", { left: t("stack.leftBold"), right: t("stack.rightBold") })}
      </p>
      {hasTok ? (
        <>
          <div className="stack-vs-torqa-token-grid">
            <div className="stack-vs-torqa-token-card">
              <div className="stack-vs-torqa-col-title">{t("stack.col.plain")}</div>
              <div className="stack-vs-torqa-token-big">{pt}</div>
              <div className="stack-vs-torqa-col-sub">{t("stack.tokensEst")}</div>
            </div>
            <div className="stack-vs-torqa-vs" aria-hidden>
              {t("stack.vs")}
            </div>
            <div className="stack-vs-torqa-token-card stack-vs-torqa-token-card--torqa">
              <div className="stack-vs-torqa-col-title">{t("stack.col.spec")}</div>
              <div className="stack-vs-torqa-token-big">{tt}</div>
              <div className="stack-vs-torqa-col-sub">{t("stack.tokensEst")}</div>
            </div>
          </div>
          <div className="stack-vs-torqa-bar-block">
            <div className="stack-vs-torqa-bar-row">
              <span className="stack-vs-torqa-bar-label">{t("stack.bar.prompt")}</span>
              <div className="stack-vs-torqa-bar-track">
                <div className="stack-vs-torqa-bar-fill stack-vs-torqa-bar-fill--nl" style={{ width: `${(pt / maxTok) * 100}%` }} />
              </div>
            </div>
            <div className="stack-vs-torqa-bar-row">
              <span className="stack-vs-torqa-bar-label">{t("stack.bar.spec")}</span>
              <div className="stack-vs-torqa-bar-track">
                <div className="stack-vs-torqa-bar-fill stack-vs-torqa-bar-fill--tq" style={{ width: `${(tt / maxTok) * 100}%` }} />
              </div>
            </div>
            {redBar != null ? (
              <div className="stack-vs-torqa-bar-row stack-vs-torqa-bar-row--red">
                <span className="stack-vs-torqa-bar-label">{t("stack.bar.reduction")}</span>
                <div className="stack-vs-torqa-bar-track stack-vs-torqa-bar-track--red">
                  <div className="stack-vs-torqa-bar-fill stack-vs-torqa-bar-fill--red" style={{ width: `${redBar}%` }} />
                </div>
                <span className="stack-vs-torqa-bar-pct">{Math.round(redBar)}%</span>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <p className="stack-vs-torqa-lede-muted">{t("stack.noTokens")}</p>
      )}
      {snap.reductionPercent != null ? (
        <p className="stack-vs-torqa-reduction">
          {t("stack.reductionLine", { pct: String(Math.round(snap.reductionPercent)) })}
        </p>
      ) : null}
      <p className="stack-vs-torqa-stats" aria-label="Character counts">
        {t("stack.stats", {
          nl: nlChars.toLocaleString(),
          tq: tqChars.toLocaleString(),
          ratio: ratioPart,
        })}
      </p>
      <div className="stack-vs-torqa-output-grid">
        <div className="stack-vs-torqa-output-col">
          <div className="stack-vs-torqa-output-head">{t("stack.out.prompt")}</div>
          <pre className="stack-vs-torqa-pre">{snap.nlPrompt}</pre>
        </div>
        <div className="stack-vs-torqa-output-col">
          <div className="stack-vs-torqa-output-head">{t("stack.out.spec")}</div>
          <pre className="stack-vs-torqa-pre">{snap.tqSource}</pre>
        </div>
      </div>
    </div>
  );
}

function TokenSavingsPanel({
  estimates,
  tokenProofRef,
  compact,
}: {
  estimates: PipelineTokenEstimates;
  tokenProofRef: TokenProofRef | null;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { promptTokens, tqTokens, reductionPercent, compressionRatio, comparisonBasis, estimatorId } = estimates;
  const ptR = Math.round(promptTokens);
  const tqR = Math.round(tqTokens);
  const max = Math.max(promptTokens, tqTokens, 1);
  const leftBarPct = Math.min(100, (promptTokens / max) * 100);
  const tqBarPct = Math.min(100, (tqTokens / max) * 100);
  const red =
    reductionPercent != null ? Math.max(0, Math.min(100, Number(reductionPercent))) : null;
  const ratioDisp =
    compressionRatio != null && Number.isFinite(compressionRatio) && compressionRatio > 0
      ? compressionRatio >= 10
        ? compressionRatio.toFixed(1)
        : compressionRatio.toFixed(2)
      : null;
  const comparisonLabel =
    comparisonBasis === "ir_bundle_json" ? t("tokenPanel.label.irJson") : t("tokenPanel.label.plain");

  const summaryLine =
    comparisonBasis === "ir_bundle_json"
      ? red != null && red > 0
        ? t("tokenSavings.summary.ir", { pct: String(Math.round(red)) })
        : t("tokenSavings.summary.irNeutral")
      : red != null && red > 0
        ? t("tokenSavings.summary.nl", { pct: String(Math.round(red)) })
        : t("tokenSavings.summary.nlNeutral", { pt: ptR.toLocaleString(), tq: tqR.toLocaleString() });

  const hiCost = illustrativeInputCostUsd(promptTokens);
  const loCost = illustrativeInputCostUsd(tqTokens);
  const saveCost = Math.max(0, hiCost - loCost);

  const root = `p106-token-savings${compact ? " p106-token-savings--compact" : ""}`;

  return (
    <div className={root} role="region" aria-label={t("tokenSavings.aria")}>
      <div className="p106-token-savings-head">
        <span className="p106-token-savings-title">{t("tokenSavings.title")}</span>
        <span className="p106-token-savings-badge p106-token-savings-badge--estimate">{t("tokenSavings.badge.estimate")}</span>
        {comparisonBasis === "ir_bundle_json" ? (
          <span className="p106-token-savings-badge">{t("tokenSavings.badge.build")}</span>
        ) : (
          <span className="p106-token-savings-badge">{t("tokenSavings.badge.intent")}</span>
        )}
      </div>

      <div className="p106-token-savings-stats" role="group">
        <div className="p106-token-savings-stat">
          <span className="p106-token-savings-stat-k">{comparisonLabel}</span>
          <span className="p106-token-savings-stat-v">{ptR.toLocaleString()}</span>
        </div>
        <div className="p106-token-savings-stat">
          <span className="p106-token-savings-stat-k">{t("tokenSavings.stat.torqa")}</span>
          <span className="p106-token-savings-stat-v p106-token-savings-stat-v--accent">{tqR.toLocaleString()}</span>
        </div>
        <div className="p106-token-savings-stat">
          <span className="p106-token-savings-stat-k">{t("tokenSavings.stat.reduction")}</span>
          <span className="p106-token-savings-stat-v">
            {red != null ? `${Math.round(red)}%` : t("tokenPanel.emdash")}
          </span>
        </div>
        <div className="p106-token-savings-stat">
          <span className="p106-token-savings-stat-k">{t("tokenSavings.stat.ratio")}</span>
          <span className="p106-token-savings-stat-v">{ratioDisp != null ? `${ratioDisp}×` : t("tokenPanel.emdash")}</span>
        </div>
      </div>

      <div className="p106-token-savings-bars" aria-hidden>
        <div className="p106-token-savings-bar-row">
          <span className="p106-token-savings-bar-lab">{comparisonLabel}</span>
          <div className="p106-token-savings-track">
            <div className="p106-token-savings-fill p106-token-savings-fill--left" style={{ width: `${leftBarPct}%` }} />
          </div>
          <span className="p106-token-savings-bar-num">{ptR}</span>
        </div>
        <div className="p106-token-savings-bar-row">
          <span className="p106-token-savings-bar-lab">{t("tokenSavings.bar.torqa")}</span>
          <div className="p106-token-savings-track">
            <div className="p106-token-savings-fill p106-token-savings-fill--tq" style={{ width: `${tqBarPct}%` }} />
          </div>
          <span className="p106-token-savings-bar-num">{tqR}</span>
        </div>
      </div>

      <p className="p106-token-savings-summary">{summaryLine}</p>

      <div className="p106-token-savings-cost">
        <div className="p106-token-savings-cost-title">{t("tokenSavings.cost.title")}</div>
        <p className="p106-token-savings-cost-lead">
          {t("tokenSavings.cost.lead", { rate: ILLUSTRATIVE_INPUT_USD_PER_1M.toFixed(2) })}
        </p>
        <p className="p106-token-savings-cost-line">
          {t("tokenSavings.cost.line", {
            hi: hiCost < 0.0001 ? "<0.0001" : hiCost.toFixed(4),
            lo: loCost < 0.0001 ? "<0.0001" : loCost.toFixed(4),
            save: saveCost < 0.0001 ? "<0.0001" : saveCost.toFixed(4),
          })}
        </p>
      </div>

      {tokenProofRef ? (
        <p className="p106-token-savings-proof">
          {t("tokenSavings.proof.line", {
            pct: String(Math.round(tokenProofRef.avgPromptReductionPct)),
            n: String(tokenProofRef.scenarioCount),
            suite: tokenProofRef.suiteId || "token_proof",
          })}
        </p>
      ) : (
        <p className="p106-token-savings-proof p106-token-savings-proof--muted">{t("tokenSavings.proof.missing")}</p>
      )}

      {estimatorId ? (
        <p className="p106-token-savings-estimator">{t("tokenSavings.estimator", { id: estimatorId })}</p>
      ) : null}
    </div>
  );
}

function P114LlmControls({
  tr,
  disabled,
  llmProvider,
  onProviderChange,
  presence,
  showKeys,
  onToggleKeys,
  keyDrafts,
  onDraftChange,
  onSaveNonEmptyKeys,
  onClearKey,
  keyError,
  llmModelId,
  onLlmModelIdChange,
  llmFallbackModelId,
  onLlmFallbackModelIdChange,
  llmGenMode,
  onLlmGenModeChange,
}: {
  tr: Translate;
  disabled?: boolean;
  llmProvider: LlmProviderChoice;
  onProviderChange: (v: LlmProviderChoice) => void;
  presence: { haveOpenAi: boolean; haveAnthropic: boolean; haveGoogle: boolean } | null;
  showKeys: boolean;
  onToggleKeys: () => void;
  keyDrafts: Record<LlmProviderChoice, string>;
  onDraftChange: (slot: LlmProviderChoice, v: string) => void;
  onSaveNonEmptyKeys: () => void;
  onClearKey: (slot: LlmProviderChoice) => void;
  keyError: string | null;
  llmModelId: string;
  onLlmModelIdChange: (v: string) => void;
  llmFallbackModelId: string;
  onLlmFallbackModelIdChange: (v: string) => void;
  llmGenMode: LlmGenModeChoice;
  onLlmGenModeChange: (v: LlmGenModeChoice) => void;
}) {
  const slots: LlmProviderChoice[] = ["openai", "anthropic", "google"];
  return (
    <div className="p114-llm-card" role="group" aria-label={tr("llm.aria")}>
      <div className="p114-llm-card-head">
        <span className="p114-llm-card-title">{tr("llm.sectionTitle")}</span>
        <span className="p114-llm-card-vendors">{tr("llm.vendorStrip")}</span>
      </div>
      <div className="p114-llm-row">
        <label className="p114-llm-select-wrap">
          <span className="p114-llm-label">{tr("llm.label")}</span>
          <select
            className="p114-llm-select"
            value={llmProvider}
            disabled={disabled}
            onChange={(e) => onProviderChange(e.target.value as LlmProviderChoice)}
          >
            <option value="openai">{tr("llm.gpt")}</option>
            <option value="anthropic">{tr("llm.claude")}</option>
            <option value="google">{tr("llm.gemini")}</option>
          </select>
        </label>
        {presence ? (
          <span className="p114-llm-presence" title={tr("llm.presenceTitle")}>
            <span className={presence.haveOpenAi ? "p114-llm-dot p114-llm-dot--on" : "p114-llm-dot"} title={tr("llm.key.openai")} aria-label={tr("llm.key.openai")} />
            <span className={presence.haveAnthropic ? "p114-llm-dot p114-llm-dot--on" : "p114-llm-dot"} title={tr("llm.key.anthropic")} aria-label={tr("llm.key.anthropic")} />
            <span className={presence.haveGoogle ? "p114-llm-dot p114-llm-dot--on" : "p114-llm-dot"} title={tr("llm.key.google")} aria-label={tr("llm.key.google")} />
          </span>
        ) : null}
        <button type="button" className="btn btn-compact p114-llm-keys-toggle" onClick={onToggleKeys}>
          {showKeys ? tr("llm.hideKeys") : tr("llm.showKeys")}
        </button>
        {showKeys ? (
          <div className="p114-llm-keys-panel">
            <p className="p114-llm-keys-lede">{tr("llm.keysHint")}</p>
            {slots.map((slot) => (
              <div key={slot} className="p114-llm-key-line">
                <label className="p114-llm-key-label">{tr(`llm.key.${slot}`)}</label>
                <input
                  type="password"
                  className="p114-llm-key-input"
                  value={keyDrafts[slot]}
                  onChange={(e) => onDraftChange(slot, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={tr("llm.keyPlaceholder")}
                />
                <button type="button" className="btn btn-compact" onClick={() => void onClearKey(slot)}>
                  {tr("llm.clearSlot")}
                </button>
              </div>
            ))}
            <div className="p114-llm-keys-actions">
              <button type="button" className="btn btn-compact btn-primary" onClick={() => void onSaveNonEmptyKeys()}>
                {tr("llm.saveKeys")}
              </button>
            </div>
            {keyError ? <p className="p114-llm-key-err">{keyError}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="p114-llm-row p114-llm-row--wrap">
        <label className="p114-llm-field">
          <span className="p114-llm-label">{tr("llm.genMode")}</span>
          <select
            className="p114-llm-select"
            value={llmGenMode}
            disabled={disabled}
            onChange={(e) => onLlmGenModeChange(e.target.value as LlmGenModeChoice)}
            aria-label={tr("llm.genMode")}
          >
            <option value="balanced">{tr("llm.genMode.balanced")}</option>
            <option value="cheapest">{tr("llm.genMode.cheapest")}</option>
            <option value="fastest">{tr("llm.genMode.fastest")}</option>
            <option value="highest_quality">{tr("llm.genMode.highest_quality")}</option>
            <option value="most_reliable">{tr("llm.genMode.most_reliable")}</option>
          </select>
        </label>
        <label className="p114-llm-field p114-llm-field--grow">
          <span className="p114-llm-label">{tr("llm.modelId")}</span>
          <input
            type="text"
            className="p114-llm-text-input"
            value={llmModelId}
            disabled={disabled}
            onChange={(e) => onLlmModelIdChange(e.target.value)}
            placeholder={tr("llm.modelId.placeholder")}
            spellCheck={false}
            autoComplete="off"
            aria-label={tr("llm.modelId")}
          />
        </label>
        <label className="p114-llm-field p114-llm-field--grow">
          <span className="p114-llm-label">{tr("llm.fallbackModelId")}</span>
          <input
            type="text"
            className="p114-llm-text-input"
            value={llmFallbackModelId}
            disabled={disabled}
            onChange={(e) => onLlmFallbackModelIdChange(e.target.value)}
            placeholder={tr("llm.fallbackModelId.placeholder")}
            spellCheck={false}
            autoComplete="off"
            aria-label={tr("llm.fallbackModelId")}
          />
        </label>
      </div>
      <p className="p114-llm-card-hint">{tr("llm.flowHint")}</p>
    </div>
  );
}

/** P130: quality score, comparison metrics, profile, and per-run reliability from core JSON. */
type LlmRunInsights = {
  qualityScore: number | null;
  partialValidity: number | null;
  generationProfile: Record<string, unknown> | null;
  reliability: Record<string, unknown> | null;
};

function parseLlmRunInsights(genOrRoot: Record<string, unknown> | null | undefined): LlmRunInsights | null {
  if (!genOrRoot) return null;
  const qDirect = genOrRoot.tq_quality_score;
  const cmRaw = genOrRoot.llm_comparison_metrics;
  const cm = isRecord(cmRaw) ? cmRaw : null;
  const q =
    typeof qDirect === "number" && Number.isFinite(qDirect)
      ? qDirect
      : typeof cm?.quality_score === "number" && Number.isFinite(cm.quality_score)
        ? cm.quality_score
        : null;
  const pv =
    typeof cm?.attempt_partial_validity_rate === "number" && Number.isFinite(cm.attempt_partial_validity_rate)
      ? cm.attempt_partial_validity_rate
      : null;
  const profRaw = genOrRoot.llm_generation_profile;
  const relRaw = genOrRoot.reliability;
  const prof = isRecord(profRaw) ? profRaw : null;
  const rel = isRecord(relRaw) ? relRaw : null;
  if (q == null && pv == null && !prof && !rel) return null;
  return {
    qualityScore: q != null ? Math.round(q) : null,
    partialValidity: pv,
    generationProfile: prof,
    reliability: rel,
  };
}

function appendLlmProofToTrialLog(insights: LlmRunInsights | null, append: (s: string) => void, t: Translate) {
  if (!insights) return;
  if (insights.qualityScore != null) append(t("p130.trialLog.quality", { score: String(insights.qualityScore) }));
  if (insights.partialValidity != null && insights.partialValidity < 1) {
    append(t("p130.trialLog.partialValidity", { rate: String(insights.partialValidity) }));
  }
  const rel = insights.reliability;
  if (rel?.repaired_success === true) append(t("p130.trialLog.repaired"));
  else if (rel?.first_pass_success === true) append(t("p130.trialLog.firstPass"));
  const prof = insights.generationProfile;
  if (prof && typeof prof.mode === "string" && prof.mode.trim()) {
    append(t("p130.trialLog.profileMode", { mode: prof.mode }));
  }
}

function LlmProofPanel({ insights, compact, t }: { insights: LlmRunInsights; compact?: boolean; t: Translate }) {
  const prof = insights.generationProfile;
  const mode = prof && typeof prof.mode === "string" ? prof.mode : null;
  const primary = prof && typeof prof.primary_model === "string" ? prof.primary_model : null;
  const fallback = prof && typeof prof.fallback_model === "string" ? prof.fallback_model.trim() : "";
  const rel = insights.reliability;
  let relLine: string | null = null;
  if (rel?.repaired_success === true) relLine = t("p130.proof.repaired");
  else if (rel?.first_pass_success === true) relLine = t("p130.proof.firstPass");
  const ac = rel?.attempt_count;
  const root = `p130-llm-proof${compact ? " p130-llm-proof--compact" : ""}`;
  return (
    <div className={root} role="region" aria-label={t("p130.proof.aria")}>
      <div className="p130-llm-proof-title">{t("p130.proof.title")}</div>
      <ul className="p130-llm-proof-list">
        {insights.qualityScore != null ? (
          <li>
            <span className="p130-llm-proof-k">{t("p130.proof.quality")}</span>{" "}
            <span className="p130-llm-proof-v">{insights.qualityScore}/100</span>
          </li>
        ) : null}
        {insights.partialValidity != null && insights.partialValidity < 1 ? (
          <li>
            <span className="p130-llm-proof-k">{t("p130.proof.partialValidity")}</span>{" "}
            <span className="p130-llm-proof-v">{insights.partialValidity}</span>
          </li>
        ) : null}
        {mode ? (
          <li>
            <span className="p130-llm-proof-k">{t("p130.proof.mode")}</span>{" "}
            <span className="p130-llm-proof-v p130-llm-proof-mono">{mode}</span>
          </li>
        ) : null}
        {primary ? (
          <li>
            <span className="p130-llm-proof-k">{t("p130.proof.models")}</span>{" "}
            <span className="p130-llm-proof-v p130-llm-proof-mono">
              {primary}
              {fallback && fallback.toLowerCase() !== primary.toLowerCase() ? ` → ${fallback}` : ""}
            </span>
          </li>
        ) : null}
        {relLine ? (
          <li>
            <span className="p130-llm-proof-k">{t("p130.proof.reliability")}</span> <span className="p130-llm-proof-v">{relLine}</span>
          </li>
        ) : null}
        {typeof ac === "number" && ac >= 1 && !compact ? (
          <li className="p130-llm-proof-attempts">
            <span className="p130-llm-proof-v">{t("p130.proof.attemptsLine", { n: String(ac) })}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ApiCallMetricsPanel({ m, compact }: { m: ApiCallMetrics; compact?: boolean }) {
  const { t } = useI18n();
  const root = `api-call-metrics${compact ? " api-call-metrics--compact" : ""}`;
  const costStr =
    m.estimatedCostUsd != null && Number.isFinite(m.estimatedCostUsd)
      ? t("api.cost.usd", { usd: m.estimatedCostUsd.toFixed(4) })
      : t("api.cost.na");
  return (
    <div className={root} role="region" aria-label={t("api.aria")}>
      <div className="api-call-metrics-head">
        <span className="api-call-metrics-live-badge">{t("api.liveBadge")}</span>
        <div className="api-call-metrics-title">{t("api.title")}</div>
      </div>
      {!compact ? <p className="api-call-metrics-honest">{t("api.honestNote")}</p> : null}
      <ul className="api-call-metrics-list">
        <li>
          <span className="api-call-metrics-k">{t("api.provider")}</span>{" "}
          <span className="api-call-metrics-v api-call-metrics-mono">{providerDisplayName(t, m.provider)}</span>
        </li>
        <li>
          <span className="api-call-metrics-k">{t("api.httpCalls")}</span>{" "}
          <span className="api-call-metrics-v">{m.httpCalls}</span>
        </li>
        <li>
          <span className="api-call-metrics-k">{t("api.retries")}</span>{" "}
          <span className="api-call-metrics-v">{m.retryCount}</span>
          <span className="api-call-metrics-hint">{t("api.retries.hint")}</span>
        </li>
        <li>
          <span className="api-call-metrics-k">{t("api.latency")}</span>{" "}
          <span className="api-call-metrics-v">{Math.round(m.latencyMsTotal)} ms</span>
        </li>
        <li>
          <span className="api-call-metrics-k">{t("api.billable")}</span>{" "}
          <span className="api-call-metrics-v">
            {t("api.billable.line", {
              inT: m.usage.promptTokens.toLocaleString(),
              outT: m.usage.completionTokens.toLocaleString(),
              totT: m.usage.totalTokens.toLocaleString(),
            })}
          </span>
        </li>
        <li>
          <span className="api-call-metrics-k">{t("api.cost")}</span> <span className="api-call-metrics-v">{costStr}</span>
        </li>
        <li>
          <span className="api-call-metrics-k">{t("api.model")}</span>{" "}
          <span className="api-call-metrics-v api-call-metrics-mono">{m.model || t("tokenPanel.emdash")}</span>
        </li>
      </ul>
      {m.pricingNote && !compact ? (
        <p className="api-call-metrics-note">{m.pricingNote}</p>
      ) : null}
    </div>
  );
}

function DesktopApp() {
  const { t: tr } = useI18n();
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [productMode, setProductMode] = useState<ProductMode>(readStoredProductMode);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [paths, setPaths] = useState<{ repoRoot: string; pythonExe: string } | null>(null);
  const [tqFiles, setTqFiles] = useState<string[]>([]);
  const [activeRel, setActiveRel] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [bottomTab, setBottomTab] = useState<"summary" | "output" | "diagnostics" | "activity">("output");
  const [pipelineHumanSteps, setPipelineHumanSteps] = useState<HumanPipelineSteps | null>(null);
  const [bottomOpen, setBottomOpen] = useState(false);
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
  const [rightTab, setRightTab] = useState<"ir" | "bench" | "models" | "feedback">("ir");
  const [rightOpen, setRightOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("torqa.sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState<"idle" | "surface" | "build" | "bench" | "generate" | "app">("idle");
  const [appPipelineStep, setAppPipelineStep] = useState<AppPipelineVisual>("idle");
  const [pipelineTokenEstimates, setPipelineTokenEstimates] = useState<PipelineTokenEstimates | null>(null);
  const [tokenProofRef, setTokenProofRef] = useState<TokenProofRef | null>(null);
  const [modelCompareAggregate, setModelCompareAggregate] = useState<ReferenceAggregate | null>(null);
  const [comparisonReport, setComparisonReport] = useState<Record<string, unknown> | null>(null);
  const [stackVsTorqaCompare, setStackVsTorqaCompare] = useState<StackVsTorqaComparison | null>(null);
  const [compareDetailsOpen, setCompareDetailsOpen] = useState(false);
  const [p131Snap, setP131Snap] = useState<P131Snapshot>(() => loadP131());
  const [apiCallMetrics, setApiCallMetrics] = useState<ApiCallMetrics | null>(null);

  useEffect(() => {
    if (!stackVsTorqaCompare) setCompareDetailsOpen(false);
  }, [stackVsTorqaCompare]);
  /** P116: last completed multi-phase .tq generation trace (from core JSON). */
  const [lastGenPhaseTrace, setLastGenPhaseTrace] = useState<Record<string, unknown>[] | null>(null);
  /** P130: quality / comparison / reliability snapshot from last generate or app pipeline. */
  const [llmRunInsights, setLlmRunInsights] = useState<LlmRunInsights | null>(null);
  /** P116: rotating sub-hint while the app pipeline is in the generate step. */
  const [p116GenHintIdx, setP116GenHintIdx] = useState(0);
  /** Primary prompt text (extra slots reserved for future iteration). */
  const [promptVersions, setPromptVersions] = useState<[string, string, string]>(() => [...EMPTY_PROMPT_VERSIONS]);
  /** When set, core uses `--gen-category` (overrides heuristic intent). */
  const [promptGenCategory, setPromptGenCategory] = useState<PromptGenCategory | null>(null);
  /** P114: preferred LLM + optional encrypted keys (Electron main process). */
  const [llmProvider, setLlmProvider] = useState<LlmProviderChoice>("openai");
  const [llmPresence, setLlmPresence] = useState<{
    haveOpenAi: boolean;
    haveAnthropic: boolean;
    haveGoogle: boolean;
  } | null>(null);
  const [showLlmKeys, setShowLlmKeys] = useState(false);
  const [llmKeyDrafts, setLlmKeyDrafts] = useState<Record<LlmProviderChoice, string>>({
    openai: "",
    anthropic: "",
    google: "",
  });
  const [llmKeyError, setLlmKeyError] = useState<string | null>(null);
  const [llmModelId, setLlmModelId] = useState(() => readLocalStorageString(LS_LLM_MODEL_ID, ""));
  const [llmFallbackModelId, setLlmFallbackModelId] = useState(() => readLocalStorageString(LS_LLM_FALLBACK_ID, ""));
  const [llmGenMode, setLlmGenMode] = useState<LlmGenModeChoice>(() => readLlmGenModeChoice());
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
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  /** P102 — focus prompt when prompt mode is visible so typing works immediately. */
  useLayoutEffect(() => {
    if (productMode !== "prompt") return;
    const el = promptTextareaRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [productMode, workspace]);

  useEffect(() => {
    const prev = workspaceSwitchRef.current;
    workspaceSwitchRef.current = workspace;
    if (prev != null && workspace != null && prev !== workspace) {
      setPromptVersions([...EMPTY_PROMPT_VERSIONS]);
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
        if (ws) setP131Snap(markP131Milestone("folder"));
      } catch {
        setPaths(null);
      }
    })();
  }, []);

  useEffect(() => {
    const root = paths?.repoRoot;
    if (!root || !getShell().readFile) {
      setTokenProofRef(null);
      setModelCompareAggregate(null);
      setComparisonReport(null);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const rd = await getShell().readFile(root, "reports/token_proof.json");
      const rd136 = await getShell().readFile(root, "reports/comparison_report.json");
      if (cancelled) return;
      if (rd136.ok) {
        try {
          setComparisonReport(JSON.parse(rd136.content) as Record<string, unknown>);
        } catch {
          setComparisonReport(null);
        }
      } else {
        setComparisonReport(null);
      }
      if (!rd.ok) {
        setTokenProofRef(null);
        setModelCompareAggregate(null);
        return;
      }
      try {
        const data = JSON.parse(rd.content) as Record<string, unknown>;
        setModelCompareAggregate(parseReferenceAggregateFromTokenProofJson(data));
        const pub = data.public_summary;
        if (!pub || typeof pub !== "object" || Array.isArray(pub)) {
          setTokenProofRef(null);
          return;
        }
        const ps = pub as Record<string, unknown>;
        const pr = ps.average_prompt_token_reduction_percent_vs_torqa;
        const cr = ps.average_compression_ratio_prompt_per_torqa;
        const n = ps.passed_scenario_count ?? ps.scenario_count;
        const sid = ps.suite_id;
        if (typeof pr !== "number" || typeof cr !== "number" || !Number.isFinite(pr) || !Number.isFinite(cr)) {
          setTokenProofRef(null);
          return;
        }
        setTokenProofRef({
          avgPromptReductionPct: pr,
          avgCompressionRatio: cr,
          scenarioCount: typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0,
          suiteId: typeof sid === "string" ? sid : "",
        });
      } catch {
        setTokenProofRef(null);
        setModelCompareAggregate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paths?.repoRoot]);

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
    setPipelineHumanSteps(null);
    setLastGenPhaseTrace(null);
  }, []);

  const appendTrialLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTrialLog((prev) => [...prev.slice(-199), `[${stamp}] ${line}`]);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LLM_MODEL_ID, llmModelId);
    } catch {
      /* ignore */
    }
  }, [llmModelId]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_LLM_FALLBACK_ID, llmFallbackModelId);
    } catch {
      /* ignore */
    }
  }, [llmFallbackModelId]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_LLM_GEN_MODE, llmGenMode);
    } catch {
      /* ignore */
    }
  }, [llmGenMode]);

  const llmTorqaExtras = useMemo(() => {
    const o: {
      llmModel?: string;
      fallbackModel?: string;
      llmGenMode?: LlmGenModeChoice;
    } = {};
    if (llmModelId.trim()) o.llmModel = llmModelId.trim();
    if (llmFallbackModelId.trim()) o.fallbackModel = llmFallbackModelId.trim();
    if (llmGenMode !== "balanced") o.llmGenMode = llmGenMode;
    return o;
  }, [llmModelId, llmFallbackModelId, llmGenMode]);

  const refreshLlmPresence = useCallback(async () => {
    const shell = window.torqaShell;
    if (!shell?.getLlmState) {
      setLlmPresence(null);
      return;
    }
    try {
      const s = await shell.getLlmState();
      setLlmPresence({
        haveOpenAi: s.haveOpenAi,
        haveAnthropic: s.haveAnthropic,
        haveGoogle: s.haveGoogle,
      });
      const p = String(s.provider || "openai").toLowerCase();
      if (p === "openai" || p === "anthropic" || p === "google") setLlmProvider(p);
    } catch {
      setLlmPresence(null);
    }
  }, []);

  const handleLlmProviderChange = useCallback(
    async (v: LlmProviderChoice) => {
      setLlmProvider(v);
      try {
        const r = await window.torqaShell?.setLlmProvider?.(v);
        if (r && !r.ok) appendTrialLog(tr("llm.providerSaveError", { error: r.error }));
      } catch (e) {
        appendTrialLog(tr("llm.providerSaveError", { error: String(e) }));
      }
      await refreshLlmPresence();
    },
    [appendTrialLog, tr, refreshLlmPresence],
  );

  const saveLlmKeys = useCallback(async () => {
    setLlmKeyError(null);
    const shell = window.torqaShell;
    if (!shell?.setLlmApiKey) {
      setLlmKeyError(tr("llm.saveUnavailable"));
      return;
    }
    const slots: LlmProviderChoice[] = ["openai", "anthropic", "google"];
    try {
      for (const slot of slots) {
        const v = llmKeyDrafts[slot].trim();
        if (!v) continue;
        const r = await shell.setLlmApiKey(slot, v);
        if (!r.ok) {
          setLlmKeyError(tr("llm.saveError", { error: r.error }));
          return;
        }
      }
      setLlmKeyDrafts({ openai: "", anthropic: "", google: "" });
      await refreshLlmPresence();
      appendTrialLog(tr("llm.keysSaved"));
    } catch (e) {
      setLlmKeyError(tr("llm.saveError", { error: String(e) }));
    }
  }, [llmKeyDrafts, tr, refreshLlmPresence, appendTrialLog]);

  const clearLlmKey = useCallback(
    async (slot: LlmProviderChoice) => {
      setLlmKeyError(null);
      const shell = window.torqaShell;
      if (!shell?.setLlmApiKey) return;
      const r = await shell.setLlmApiKey(slot, null);
      if (!r.ok) {
        setLlmKeyError(tr("llm.saveError", { error: r.error }));
        return;
      }
      setLlmKeyDrafts((d) => ({ ...d, [slot]: "" }));
      await refreshLlmPresence();
    },
    [tr, refreshLlmPresence],
  );

  useEffect(() => {
    void refreshLlmPresence();
  }, [paths?.repoRoot, refreshLlmPresence]);

  useEffect(() => {
    if (busy !== "app" || appPipelineStep !== "generate" || pipelineHumanSteps) return undefined;
    const id = window.setInterval(() => setP116GenHintIdx((x) => (x + 1) % 3), 2400);
    return () => window.clearInterval(id);
  }, [busy, appPipelineStep, pipelineHumanSteps]);

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
        setP131Snap(markP131Milestone("folder"));
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
      setP131Snap(markP131Milestone("folder"));
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
      setP131Snap(markP131Milestone("folder"));
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

  const saveFile = async (): Promise<boolean> => {
    if (!workspace || !activeRel) return false;
    const r = await getShell().saveFile(workspace, activeRel, content);
    if (!r.ok) {
      setBottomOpen(true);
      setBottomTab("output");
      appendOutput(`Save (${activeRel})`, { exitCode: 1, stdout: "", stderr: r.error });
      return false;
    }
    setDirty(false);
    setBottomOpen(true);
    setBottomTab("output");
    appendOutput(`Save (${activeRel})`, { exitCode: 0, stdout: "Saved to disk.", stderr: "" });
    return true;
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
      const errCtx = surfaceFailureSummaryForRepair(failJson, resStderr, tr);
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
      recordTrialEvent("validate_auto_repair_attempt");
      setBottomOpen(true);
      setBottomTab("output");
      setBusy("generate");
      try {
        await yieldToUi();
        const gen = await getShell().torqaRun({
          kind: "generateTq",
          workspaceRoot: workspace,
          prompt,
          llmProvider,
          ...llmTorqaExtras,
        });
        appendOutput("Auto-fix after validate (generate-tq)", gen, "torqa --json generate-tq --workspace <ws> --prompt-stdin");
        const gj = tryParseTorqaJson(gen.stdout, gen.stderr) as Record<string, unknown> | null;
        const tqText = gj && typeof gj.tq_text === "string" ? gj.tq_text : null;
        if (!gj?.ok || !tqText || gen.exitCode !== 0) {
          appendTrialLog(tr("llm.autoFixNoTq"));
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
    [workspace, appendTrialLog, refreshTree, activeRel, tr, llmProvider, llmTorqaExtras],
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
    await yieldToUi();
    const res = await getShell().torqaRun({
      kind: "surface",
      workspaceRoot: workspace,
      relativePath: rel,
    });
    appendOutput("Validate (surface → IR + diagnostics)", res, cmd);
    const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
    if (json && isRecord(json.diagnostics as unknown)) {
      setDiagText(formatDiagnosticsHuman(json.diagnostics as Record<string, unknown>, tr));
      setGate(Boolean(json.ok) && res.exitCode === 0 ? "ok" : "fail");
    } else if (json) {
      setDiagText(JSON.stringify(json, null, 2));
      setGate(Boolean(json.ok) && res.exitCode === 0 ? "ok" : "fail");
    } else {
      setDiagText(res.stderr || res.stdout || tr("output.noJsonSurface"));
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

  const runBuild = async () => {
    if (!workspace || !activeRel) return;
    recordTrialEvent("build_attempt");
    setBusy("build");
    setGate("idle");
    setBuildFailurePanel(null);
    setBuildSummaryLine("");
    setBottomOpen(true);
    setBottomTab("output");
    const wsDisplay = workspace.replace(/\\/g, "/");
    const buildCmd = `torqa --json build "${wsDisplay}/${activeRel}" --root "${wsDisplay}" --out torqa_generated_out --engine-mode python_only`;
    setLastTorqaCommand(buildCmd);
    await yieldToUi();
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
      setDiagText(formatDiagnosticsHuman(json.diagnostics as Record<string, unknown>, tr));
    } else if (json) {
      setDiagText(JSON.stringify(json, null, 2));
    } else {
      setDiagText(res.stderr || res.stdout || tr("output.noJsonBuild"));
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
    const thBuild = json?.token_hint;
    const tokBuild = parsePipelineTokenHint(isRecord(thBuild) ? thBuild : undefined);
    if (ok && tokBuild) {
      setPipelineTokenEstimates(tokBuild);
      appendTrialLog(
        `Token savings: TORQA surface ~${Math.round(tokBuild.tqTokens)} vs comparison ~${Math.round(tokBuild.promptTokens)} (${tokBuild.comparisonBasis})`,
      );
      setBottomTab("diagnostics");
      setBottomOpen(true);
    }
    setBusy("idle");
    recordTrialEvent(ok ? "build_success" : "build_failure");
    if (ok) setP131Snap(markP131Milestone("buildOk"));
    if (!ok) {
      setBuildFailurePanel(summarizeBuildFailureForUi(json, res.stderr, res.stdout, tr));
      appendTrialLog("Build failed — see Details tab and banner above editor");
      setBottomTab("diagnostics");
    }
  };

  const runBuildFromPrompt = async (opts?: {
    workspaceRoot?: string;
    promptText?: string;
    genCategory?: PromptGenCategory | null;
    logSlot?: string;
    evolveMode?: "improve" | "add-feature";
    evolveFromRelativePath?: string;
  }) => {
    const ws = opts?.workspaceRoot ?? workspace;
    if (!ws) return;
    const raw = opts?.promptText !== undefined ? opts.promptText : promptVersions[0];
    const promptText = raw.trim();
    if (!promptText) return;
    const genCat = opts?.genCategory !== undefined ? opts.genCategory : promptGenCategory;
    recordTrialEvent("app_pipeline_attempt");
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
    setPipelineHumanSteps(null);
    const evo =
      opts?.evolveMode && opts?.evolveFromRelativePath
        ? ` --evolve-mode ${opts.evolveMode} --evolve-from ${opts.evolveFromRelativePath.replace(/\\/g, "/")}`
        : "";
    setLastTorqaCommand(`torqa --json app --workspace <ws> --prompt-stdin${evo}`);
    setLastPreviewUrl(null);
    setLastGenPhaseTrace(null);
    setLlmRunInsights(null);
    setP116GenHintIdx(0);
    const slot = opts?.logSlot ?? "main";
    appendTrialLog(
      tr("llm.appStarted", {
        slot,
        model: providerDisplayName(tr, llmProvider),
        profile: genCat ?? "auto",
      }),
    );

    let phaseTimer: number | undefined;
    phaseTimer = window.setInterval(() => {
      setAppPipelineStep((s) => {
        if (s === "generate") return "validate";
        if (s === "validate") return "build";
        return "build";
      });
    }, 1400);

    try {
      await yieldToUi();
      const res = await getShell().torqaRun({
        kind: "appPipeline",
        workspaceRoot: ws,
        prompt: promptText,
        outDir: "torqa_generated_out",
        engineMode: "python_only",
        llmProvider,
        ...llmTorqaExtras,
        ...(genCat ? { genCategory: genCat } : {}),
        ...(opts?.evolveMode && opts?.evolveFromRelativePath
          ? {
              evolveMode: opts.evolveMode,
              evolveFromRelativePath: opts.evolveFromRelativePath.replace(/\\/g, "/"),
            }
          : {}),
      });
      if (phaseTimer != null) window.clearInterval(phaseTimer);
      phaseTimer = undefined;

      appendOutput("Build from prompt (torqa app)", res, "torqa --json app --workspace <ws> --prompt-stdin");
      appendTorqaProgressTrialLog(res.stderr, appendTrialLog, tr);
      const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
      appendTrialLog(`Core exit ${res.exitCode}${json?.ok ? " (JSON ok flag)" : ""}`);

      const stages = json?.stages as Record<string, unknown> | undefined;

      if (!json?.ok || res.exitCode !== 0) {
        recordTrialEvent("app_pipeline_failure");
        setPipelineTokenEstimates(null);
        setStackVsTorqaCompare(null);
        const stagesFail = json?.stages as Record<string, unknown> | undefined;
        const genFail = stagesFail?.generate as Record<string, unknown> | undefined;
        const amFail = parseApiMetrics(genFail?.api_metrics);
        setApiCallMetrics(amFail);
        if (amFail && amFail.retryCount > 0) {
          recordTrialEvent("llm_retry_observed", { count: amFail.retryCount });
        }
        const fail = summarizeAppPipelineFailure(json, res.stderr, res.stdout, tr);
        setPipelineFailure(fail);
        setGate("fail");
        setDiagText(json ? JSON.stringify(json, null, 2) : res.stderr || res.stdout || tr("output.noJsonApp"));
        setAppPipelineStep("idle");
        appendTrialLog(tr("trial.log.pipelineFail"));
        setPipelineHumanSteps(humanizeAppPipelineStages(json, false, "none", tr));
        setBottomTab("summary");
        setBottomOpen(true);
        setLastGenPhaseTrace(null);
        setLlmRunInsights(parseLlmRunInsights(isRecord(genFail) ? genFail : json));
        return;
      }

      let previewOutcome: "ok" | "failed" | "none" = "none";

      const genStage = stages?.generate as Record<string, unknown> | undefined;
      const ptr = genStage?.phase_trace;
      setLastGenPhaseTrace(Array.isArray(ptr) ? (ptr as Record<string, unknown>[]) : null);
      const amGen = parseApiMetrics(genStage?.api_metrics);
      setApiCallMetrics(amGen);

      const th = stages?.token_hint as Record<string, unknown> | undefined;
      const pipelineTok = parsePipelineTokenHint(isRecord(th) ? th : undefined);
      if (pipelineTok) {
        setPipelineTokenEstimates(pipelineTok);
        appendTrialLog(
          `Token hint: .tq ${Math.round(pipelineTok.tqTokens)} vs comparison ${Math.round(pipelineTok.promptTokens)}${pipelineTok.reductionPercent != null ? ` (${pipelineTok.reductionPercent}% reduction est.)` : ""}`,
        );
      } else {
        setPipelineTokenEstimates(null);
      }

      if (amGen) {
        if (amGen.retryCount > 0) {
          recordTrialEvent("llm_retry_observed", { count: amGen.retryCount });
        }
        appendTrialLog(
          `${providerDisplayName(tr, amGen.provider)}: ${amGen.httpCalls} HTTP call(s), ${Math.round(amGen.latencyMsTotal)} ms total, est. cost ${amGen.estimatedCostUsd != null ? `~$${amGen.estimatedCostUsd.toFixed(4)}` : "n/a"}`,
        );
      }
      if (genStage && genStage.llm_fallback_used) {
        appendTrialLog(tr("llm.fallbackUsed"));
      }
      if (genStage && genStage.llm_same_provider_fallback_used) {
        appendTrialLog(tr("llm.sameProviderFallbackUsed"));
      }
      {
        const ins = parseLlmRunInsights(isRecord(genStage) ? genStage : null);
        setLlmRunInsights(ins);
        appendLlmProofToTrialLog(ins, appendTrialLog, tr);
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
        const edN = wt?.edition;
        if (typeof edN === "number") {
          appendTrialLog(tr("p117.savedEdition", { edition: String(edN), path: rel }));
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
        setDiagText(formatDiagnosticsHuman(json.diagnostics as Record<string, unknown>, tr));
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
          await yieldToUi();
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
            previewOutcome = "ok";
            setLastPreviewUrl(pv.url);
            setPreviewSplitOpen(true);
            setPreviewRefreshKey((k) => k + 1);
            setP131Snap(markP131Milestone("preview"));
            recordTrialEvent("preview_embedded");
            appendTrialLog(`Preview ready (embedded): ${pv.url} port ${pv.port}`);
          } else {
            previewOutcome = "failed";
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

      setP131Snap(markP131Milestone("buildOk"));
      setAppPipelineStep("done");
      setPipelineHumanSteps(humanizeAppPipelineStages(json, true, previewOutcome, tr));
      setBottomTab("summary");
      setBottomOpen(true);
      appendTrialLog("Pipeline complete");
      recordTrialEvent("app_pipeline_success");
    } catch (e) {
      recordTrialEvent("app_pipeline_failure");
      if (phaseTimer != null) window.clearInterval(phaseTimer);
      appendOutput("Build from prompt", { exitCode: 1, stdout: "", stderr: String(e) });
      appendTrialLog(`Exception: ${String(e)}`);
      setLlmRunInsights(null);
      setPipelineFailure({
        lines: [tr("human.exception.line1"), String(e)],
        fixes: [tr("human.exception.fix1"), tr("human.exception.fix2")],
        axis: "unknown",
      });
      setGate("fail");
      setAppPipelineStep("idle");
      setPipelineHumanSteps(humanizeAppPipelineStages(null, false, "none", tr));
      setBottomTab("summary");
      setBottomOpen(true);
    } finally {
      if (phaseTimer != null) window.clearInterval(phaseTimer);
      setBusy("idle");
    }
  };

  /** Full app pipeline; opens folder picker when no workspace is set yet. */
  const handleBuildApp = async () => {
    if (busy !== "idle") return;
    const text = promptVersions[0].trim();
    if (!text) return;
    setProductMode("prompt");
    let ws = workspace;
    if (!ws) {
      const root = await openProject({ setMode: "prompt" });
      if (!root) return;
      ws = root;
    }
    await runBuildFromPrompt({ workspaceRoot: ws, promptText: text });
  };

  /** P117: full ``app`` pipeline reading current .tq from disk (--evolve-from). */
  const handleEvolveApp = async (mode: "improve" | "add-feature") => {
    if (busy !== "idle") return;
    const text = promptVersions[0].trim();
    if (!text) return;
    let ws = workspace;
    if (!ws) {
      const root = await openProject({ setMode: "prompt" });
      if (!root) return;
      ws = root;
    }
    const rel = activeRel;
    if (!rel?.toLowerCase().endsWith(".tq")) {
      setBottomOpen(true);
      setBottomTab("activity");
      appendTrialLog(tr("p117.needTq"));
      return;
    }
    if (dirty) {
      const okSave = await saveFile();
      if (!okSave) return;
    }
    const relNorm = rel.replace(/\\/g, "/");
    setProductMode("prompt");
    await runBuildFromPrompt({
      workspaceRoot: ws,
      promptText: text,
      evolveMode: mode,
      evolveFromRelativePath: relNorm,
    });
  };

  const retryPreview = async () => {
    const dir = lastWebappDir;
    if (!dir || !window.torqaShell?.startVitePreview) return;
    recordTrialEvent("preview_retry");
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
      setP131Snap(markP131Milestone("preview"));
      recordTrialEvent("preview_embedded");
      appendTrialLog(`Preview: ${pv.url} port ${pv.port} (embedded)`);
    } else {
      if (failUrl) setLastPreviewUrl(failUrl);
      appendTrialLog(`Preview retry failed: ${pv.error}`);
    }
  };

  const openPreviewInBrowser = async () => {
    const u = lastPreviewUrl;
    if (!u) return;
    recordTrialEvent("preview_external_browser");
    setP131Snap(markP131Milestone("preview"));
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
    const promptText = promptVersions[0].trim();
    if (!promptText) return;
    recordTrialEvent("generate_tq_attempt");
    setBusy("generate");
    setGate("idle");
    setStackVsTorqaCompare(null);
    setPipelineTokenEstimates(null);
    setApiCallMetrics(null);
    setPipelineFailure(null);
    setLlmRunInsights(null);
    setBottomOpen(true);
    setBottomTab("output");
    appendTrialLog(
      tr("llm.generateTqStarted", {
        model: providerDisplayName(tr, llmProvider),
        profile: promptGenCategory ?? "auto",
      }),
    );
    setLastGenPhaseTrace(null);
    await yieldToUi();
    const res = await getShell().torqaRun({
      kind: "generateTq",
      workspaceRoot: workspace,
      prompt: promptText,
      llmProvider,
      ...llmTorqaExtras,
      ...(promptGenCategory ? { genCategory: promptGenCategory } : {}),
    });
    appendOutput(
      "Generate .tq (core: torqa generate-tq — parse + diagnostics)",
      res,
      "torqa --json generate-tq --workspace <ws> --prompt-stdin",
    );
    appendTorqaProgressTrialLog(res.stderr, appendTrialLog, tr);
    const json = tryParseTorqaJson(res.stdout, res.stderr) as Record<string, unknown> | null;
    const tqText = json && typeof json.tq_text === "string" ? json.tq_text : null;
    if (!json?.ok || !tqText) {
      recordTrialEvent("generate_tq_failure");
      setApiCallMetrics(parseApiMetrics(json?.api_metrics));
      setPipelineFailure(summarizeAppPipelineFailure(json, res.stderr, res.stdout, tr));
      setLlmRunInsights(json ? parseLlmRunInsights(json) : null);
      setGate("fail");
      setDiagText(json ? JSON.stringify(json, null, 2) : res.stderr || res.stdout || tr("output.noJsonApp"));
      setBottomTab("diagnostics");
      setLastGenPhaseTrace(null);
      setBusy("idle");
      return;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_");
    const name = `generated_${ts}.tq`;
    const wr = await getShell().saveFile(workspace, name, tqText);
    if (!wr.ok) {
      recordTrialEvent("generate_tq_failure");
      const amSaveFail = parseApiMetrics(json.api_metrics);
      setApiCallMetrics(amSaveFail);
      setPipelineFailure({
        lines: [tr("save.fail.line", { name, error: wr.error })],
        fixes: [tr("save.fail.fix")],
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
        `${providerDisplayName(tr, amGtq.provider)}: ${amGtq.httpCalls} HTTP call(s), ${Math.round(amGtq.latencyMsTotal)} ms, est. ${amGtq.estimatedCostUsd != null ? `~$${amGtq.estimatedCostUsd.toFixed(4)}` : "n/a"}`,
      );
    }
    if (json && json.llm_fallback_used) {
      appendTrialLog(tr("llm.fallbackUsed"));
    }
    if (json && json.llm_same_provider_fallback_used) {
      appendTrialLog(tr("llm.sameProviderFallbackUsed"));
    }
    const gpt = json.phase_trace;
    if (Array.isArray(gpt) && gpt.length) {
      setLastGenPhaseTrace(gpt as Record<string, unknown>[]);
      appendTrialLog(
        tr("p116.traceSummary", {
          summary: (gpt as Record<string, unknown>[])
            .map((p) => `${String(p.phase ?? "")}/${String(p.total ?? "")}:${String(p.id ?? "")}`)
            .join(" → "),
        }),
      );
    } else {
      setLastGenPhaseTrace(null);
    }
    const th = json.token_hint as Record<string, unknown> | undefined;
    const ptok = parsePipelineTokenHint(isRecord(th) ? th : undefined);
    if (ptok) {
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
    appendTrialLog("Token comparison — see Details for full breakdown");
    {
      const ins = parseLlmRunInsights(json);
      setLlmRunInsights(ins);
      appendLlmProofToTrialLog(ins, appendTrialLog, tr);
    }
    setBottomTab("diagnostics");
    appendOutput(`Saved ${name}`, { exitCode: 0, stdout: "Valid .tq — use Validate / Build when ready (not auto-run).", stderr: "" });
    setP131Snap(markP131Milestone("buildOk"));
    recordTrialEvent("generate_tq_success");
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
    await yieldToUi();
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
  const statusLabel = useMemo(() => {
    if (busy === "surface") return tr("status.validating");
    if (busy === "build") return tr("status.building");
    if (busy === "bench") return tr("status.benchmark");
    if (busy === "generate") return tr("status.generating");
    if (busy === "app") return tr("status.pipeline");
    if (gate === "ok") return tr("status.pass");
    if (gate === "fail") return tr("status.fail");
    return tr("status.ready");
  }, [busy, gate, tr]);

  const pipelinePillLabels = useMemo(
    () => [
      tr("pipeline.pill.generating"),
      tr("pipeline.pill.validating"),
      tr("pipeline.pill.building"),
      tr("pipeline.pill.launching"),
    ],
    [tr],
  );

  const workspaceShort =
    workspace && workspace.length > 48 ? `…${workspace.slice(-44)}` : workspace || "";

  const llmControlsEl = (
    <P114LlmControls
      tr={tr}
      disabled={busy !== "idle"}
      llmProvider={llmProvider}
      onProviderChange={(v) => void handleLlmProviderChange(v)}
      presence={llmPresence}
      showKeys={showLlmKeys}
      onToggleKeys={() => setShowLlmKeys((x) => !x)}
      keyDrafts={llmKeyDrafts}
      onDraftChange={(slot, v) => setLlmKeyDrafts((d) => ({ ...d, [slot]: v }))}
      onSaveNonEmptyKeys={() => void saveLlmKeys()}
      onClearKey={(slot) => void clearLlmKey(slot)}
      keyError={llmKeyError}
      llmModelId={llmModelId}
      onLlmModelIdChange={setLlmModelId}
      llmFallbackModelId={llmFallbackModelId}
      onLlmFallbackModelIdChange={setLlmFallbackModelId}
      llmGenMode={llmGenMode}
      onLlmGenModeChange={setLlmGenMode}
    />
  );

  if (!workspace) {
    return (
      <div className="shell">
        <header className="titlebar titlebar-minimal p101-titlebar">
          <span className="brand">{tr("brand")}</span>
          <div className="toolbar-actions">
            <LanguageToggle className="i18n-lang-toggle i18n-lang-toggle--titlebar" />
            <button
              type="button"
              className="btn theme-toggle"
              onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
              title={tr("theme.toggle")}
            >
              {theme === "dark" ? "◐" : "◑"}
            </button>
          </div>
        </header>
        <div className="shell-main-scroll launch-root shell-main-scroll--launch p101-home p104-home">
          <div className="shell-main-scroll-inner p101-home-inner">
            <p className="p131-home-lead">{tr("p131.home.lead")}</p>
            {shouldShowHint(p131Snap, P131_HINT_WELCOME_HOME, !p131Snap.folder) ? (
              <P131Hint
                t={tr}
                text={tr("p131.hint.welcomeHome")}
                onDismiss={() => setP131Snap(dismissP131Hint(P131_HINT_WELCOME_HOME))}
              />
            ) : null}
            <div className="p104-workspace-row p131-home-folder-row">
              <button
                type="button"
                className="btn p104-workspace-btn p131-home-folder-btn"
                disabled={busy !== "idle"}
                onClick={() => void openProject({ setMode: "prompt" })}
                title={tr("home.chooseFolder.title")}
              >
                {tr("home.chooseFolder")}
              </button>
            </div>
            <label className="p131-home-prompt-label" htmlFor="p131-home-prompt">
              {tr("p131.home.promptLabel")}
            </label>
            <textarea
              id="p131-home-prompt"
              ref={promptTextareaRef}
              className="p101-prompt-hero p104-prompt-hero"
              value={promptVersions[0]}
              onChange={(e) => updatePromptAt(0, e.target.value)}
              placeholder={tr("home.prompt.placeholder")}
              aria-label={tr("home.prompt.aria")}
              rows={6}
            />
            <div className="p114-llm-home-wrap">{llmControlsEl}</div>
            <div className="p101-primary-row">
              <button
                type="button"
                className="btn btn-primary p101-btn-build p102-btn-primary-loading"
                disabled={busy !== "idle" || !promptVersions[0].trim()}
                aria-busy={busy === "app"}
                onClick={() => void handleBuildApp()}
              >
                {busy === "app" ? (
                  <>
                    <InlineSpinner />
                    <span>{tr("home.building")}</span>
                  </>
                ) : (
                  tr("home.build")
                )}
              </button>
            </div>
            <div className="p104-secondary-actions">
              <button
                type="button"
                className="btn p104-linkish"
                disabled={busy !== "idle"}
                onClick={() => void openProject({ setMode: "prompt" })}
              >
                {tr("home.openProject")}
              </button>
              <span className="p104-secondary-dot" aria-hidden>
                ·
              </span>
              <button
                type="button"
                className="btn p104-linkish"
                disabled={busy !== "idle"}
                onClick={() => void openProject({ setMode: "advanced" })}
              >
                {tr("home.editor")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className={`titlebar${productMode === "prompt" ? " titlebar-minimal p101-titlebar-workspace" : ""}`}>
        <span className="brand">{tr("brand")}</span>
        {productMode === "advanced" ? (
          <>
            <button type="button" className="btn" onClick={() => void openProject()} title={tr("title.openFolder")}>
              {tr("btn.folder")}
            </button>
            <button type="button" className="btn" onClick={() => void openTqFile()} title={tr("title.openTq")}>
              {tr("title.openTqEllipsis")}
            </button>
            <span
              className="status-pill idle p101-path-pill"
              title={workspace || undefined}
            >
              {workspaceShort}
            </span>
          </>
        ) : (
          <span className="status-pill idle p101-path-pill" title={workspace || undefined}>
            {workspaceShort}
          </span>
        )}
        <div className="toolbar-actions">
          <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          {productMode === "advanced" ? (
            <>
              <button
                type="button"
                className="btn p102-btn-with-spinner"
                disabled={!workspace || !activeRel || busy !== "idle"}
                aria-busy={busy === "surface"}
                onClick={() => void runValidate()}
                title={tr("title.validateCore")}
              >
                {busy === "surface" ? (
                  <>
                    <InlineSpinner />
                    <span>{tr("status.validating")}</span>
                  </>
                ) : (
                  tr("btn.validate")
                )}
              </button>
              <button
                type="button"
                className="btn btn-compact p102-btn-with-spinner"
                disabled={!workspace || !promptVersions[0].trim() || busy !== "idle"}
                aria-busy={busy === "generate"}
                onClick={() => void runGenerateTq()}
                title={tr("title.genTqOnly")}
              >
                {busy === "generate" ? (
                  <>
                    <InlineSpinner />
                    <span>{tr("status.generating")}</span>
                  </>
                ) : (
                  tr("btn.genTq")
                )}
              </button>
              <button
                type="button"
                className="btn btn-compact"
                disabled={
                  !workspace ||
                  !activeRel?.toLowerCase().endsWith(".tq") ||
                  !promptVersions[0].trim() ||
                  busy !== "idle"
                }
                title={tr("p117.improve.title")}
                onClick={() => void handleEvolveApp("improve")}
              >
                {tr("p117.improve")}
              </button>
              <button
                type="button"
                className="btn btn-compact"
                disabled={
                  !workspace ||
                  !activeRel?.toLowerCase().endsWith(".tq") ||
                  !promptVersions[0].trim() ||
                  busy !== "idle"
                }
                title={tr("p117.addFeature.title")}
                onClick={() => void handleEvolveApp("add-feature")}
              >
                {tr("p117.addFeature")}
              </button>
              <button
                type="button"
                className="btn btn-primary p102-btn-primary-loading"
                disabled={!workspace || !activeRel || busy !== "idle"}
                aria-busy={busy === "build"}
                onClick={() => void runBuild()}
              >
                {busy === "build" ? (
                  <>
                    <InlineSpinner />
                    <span>{tr("status.building")}</span>
                  </>
                ) : (
                  tr("btn.build")
                )}
              </button>
              <button
                type="button"
                className="btn p102-btn-with-spinner"
                disabled={busy !== "idle"}
                aria-busy={busy === "bench"}
                onClick={() => void runBenchmark()}
              >
                {busy === "bench" ? (
                  <>
                    <InlineSpinner />
                    <span>{tr("status.benchmark")}</span>
                  </>
                ) : (
                  tr("btn.benchmark")
                )}
              </button>
              <button
                type="button"
                className="btn"
                disabled={!activeRel}
                onClick={() => void saveFile()}
                title={tr("title.save")}
              >
                {tr("btn.save")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn p101-btn-secondary"
                onClick={() => void openProject({ setMode: "prompt" })}
                title={tr("title.openExisting")}
              >
                {tr("home.openProject")}
              </button>
              <button
                type="button"
                className="btn p101-btn-secondary"
                onClick={() => setProductMode("advanced")}
                title={tr("title.editor")}
              >
                {tr("home.editor")}
              </button>
            </>
          )}
          <LanguageToggle className="i18n-lang-toggle i18n-lang-toggle--titlebar" />
          <button
            type="button"
            className="btn theme-toggle"
            onClick={() => setRightOpen((o) => !o)}
            title={tr("title.toggleRight")}
          >
            ⧉
          </button>
          <button
            type="button"
            className="btn theme-toggle"
            onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
            title={tr("theme.toggle")}
          >
            {theme === "dark" ? "◐" : "◑"}
          </button>
        </div>
      </header>

      {productMode === "advanced" && workspace ? <div className="p114-llm-advanced-strip">{llmControlsEl}</div> : null}

      <div className="shell-main-scroll">
        <div className="shell-main-scroll-inner">
      {productMode === "prompt" ? (
        <section
          className="prompt-strip prompt-strip-centered p104-prompt-strip"
          aria-label={tr("prompt.section.aria")}
          aria-busy={busy === "app"}
        >
          {workspace ? <p className="p131-workspace-lead">{tr("p131.workspace.lead")}</p> : null}
          {shouldShowHint(p131Snap, P131_HINT_READY_BUILD, Boolean(workspace && p131Snap.folder && !p131Snap.buildOk)) ? (
            <P131Hint
              t={tr}
              text={tr("p131.hint.readyBuild")}
              onDismiss={() => setP131Snap(dismissP131Hint(P131_HINT_READY_BUILD))}
            />
          ) : null}
          {busy === "app" || pipelineHumanSteps ? (
            <>
              {busy === "app" && gate === "idle" && !pipelineHumanSteps ? (
                <>
                  <p className="p104-pipeline-status" aria-live="polite">
                    {pipelineBusyHint(appPipelineStep, tr)}
                  </p>
                  {appPipelineStep === "generate" ? (
                    <p className="p116-gen-substatus" aria-live="polite">
                      {tr(`p116.rotate.${p116GenHintIdx % 3}` as "p116.rotate.0")}
                    </p>
                  ) : null}
                </>
              ) : null}
              <div
                className={`app-pipeline-track${busy === "app" && !pipelineHumanSteps ? " thinking" : ""}`}
                role="list"
                aria-label={tr("pipeline.steps.aria")}
              >
                {pipelinePillLabels.map((lab, i) => (
                  <span
                    key={i}
                    role="listitem"
                    className={appPipelineStepPillClass(i, pipelineHumanSteps, busy, appPipelineStep, gate)}
                  >
                    {lab}
                  </span>
                ))}
              </div>
              {busy === "app" && !pipelineHumanSteps ? (
                <div className="p103-pipeline-progress" aria-hidden>
                  <div className="p103-pipeline-progress-bar" />
                </div>
              ) : null}
            </>
          ) : null}
          <textarea
            ref={promptTextareaRef}
            className="prompt-hero-input p101-workspace-prompt p104-workspace-prompt"
            value={promptVersions[0]}
            onChange={(e) => updatePromptAt(0, e.target.value)}
            placeholder={tr("home.prompt.placeholder")}
            rows={5}
            aria-label={tr("home.prompt.aria")}
          />
          <div className="p114-llm-prompt-wrap">{llmControlsEl}</div>
          <div className="prompt-strip-row prompt-strip-actions p101-workspace-actions p104-workspace-actions">
            <button
              type="button"
              className="btn btn-primary btn-build-app p101-btn-build p102-btn-primary-loading"
              disabled={!workspace || !promptVersions[0].trim() || busy !== "idle"}
              aria-busy={busy === "app"}
              onClick={() => void handleBuildApp()}
            >
              {busy === "app" ? (
                <>
                  <InlineSpinner />
                  <span>{tr("home.building")}</span>
                </>
              ) : (
                tr("home.build")
              )}
            </button>
          </div>
          {workspace && activeRel?.toLowerCase().endsWith(".tq") ? (
            <div className="p117-evolve-row prompt-strip-row" role="group" aria-label={tr("p117.group.aria")}>
              <button
                type="button"
                className="btn btn-compact"
                disabled={!promptVersions[0].trim() || busy !== "idle"}
                aria-busy={busy === "app"}
                title={tr("p117.improve.title")}
                onClick={() => void handleEvolveApp("improve")}
              >
                {tr("p117.improve")}
              </button>
              <button
                type="button"
                className="btn btn-compact"
                disabled={!promptVersions[0].trim() || busy !== "idle"}
                aria-busy={busy === "app"}
                title={tr("p117.addFeature.title")}
                onClick={() => void handleEvolveApp("add-feature")}
              >
                {tr("p117.addFeature")}
              </button>
            </div>
          ) : null}
          {pipelineFailure && gate === "fail" ? (
            <div className="trial-failure-panel" role="alert">
              <h3 className="trial-failure-title">{tr("trial.fail.title")}</h3>
              <FriendlyFailureLead axis={pipelineFailure.axis} />
              <details className="p103-tech-details">
                <summary>{tr("trial.techDetails")}</summary>
                <PipelineFailureAxisDiff axis={pipelineFailure.axis} />
              </details>
              <p className="trial-failure-fixes-title">{tr("trial.engineDetails")}</p>
              <ul className="trial-failure-list">
                {pipelineFailure.lines.map((line, i) => (
                  <li key={`l-${i}`}>{line}</li>
                ))}
              </ul>
              <p className="trial-failure-fixes-title">{tr("trial.whatToTry")}</p>
              <ul className="trial-failure-fixes">
                {pipelineFailure.fixes.map((line, i) => (
                  <li key={`f-${i}`}>{line}</li>
                ))}
              </ul>
              <div className="trial-failure-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-compact p102-btn-primary-loading"
                  disabled={!workspace || !promptVersions[0].trim() || busy !== "idle"}
                  aria-busy={busy === "app"}
                  onClick={() => void handleBuildApp()}
                >
                  {busy === "app" ? (
                    <>
                      <InlineSpinner />
                      <span>{tr("trial.retrying")}</span>
                    </>
                  ) : (
                    tr("trial.tryAgain")
                  )}
                </button>
                <button type="button" className="btn btn-compact" onClick={() => setBottomTab("summary")}>
                  {tr("trial.openSummary")}
                </button>
              </div>
              {apiCallMetrics ? (
                <div className="trial-failure-api-wrap">
                  <strong className="trial-failure-api-title">{tr("trial.apiBeforeFail")}</strong>
                  <ApiCallMetricsPanel m={apiCallMetrics} compact />
                </div>
              ) : null}
              {llmRunInsights ? <LlmProofPanel insights={llmRunInsights} compact t={tr} /> : null}
            </div>
          ) : null}
          {gate === "ok" && appPipelineStep === "done" && busy === "idle" ? (
            <div className="trial-success-panel" role="status">
              <h3 className="trial-success-title">{tr("trial.success.title")}</h3>
              {lastGenPhaseTrace && lastGenPhaseTrace.length > 0 ? (
                <GenPhaseTraceRow trace={lastGenPhaseTrace} t={tr} />
              ) : null}
              {pipelineTokenEstimates || apiCallMetrics ? (
                <p className="p123-trial-metrics-intro">{tr("trial.success.metricsIntro")}</p>
              ) : null}
              {pipelineTokenEstimates ? (
                <TokenSavingsPanel estimates={pipelineTokenEstimates} tokenProofRef={tokenProofRef} />
              ) : null}
              {apiCallMetrics ? (
                <div className="trial-success-api-wrap">
                  <ApiCallMetricsPanel m={apiCallMetrics} />
                </div>
              ) : null}
              {llmRunInsights ? <LlmProofPanel insights={llmRunInsights} t={tr} /> : null}
              {stackVsTorqaCompare &&
              shouldShowHint(p131Snap, P131_HINT_TRY_COMPARE, p131Snap.buildOk && !p131Snap.compare) ? (
                <P131Hint
                  t={tr}
                  text={tr("p131.hint.tryCompare")}
                  onDismiss={() => setP131Snap(dismissP131Hint(P131_HINT_TRY_COMPARE))}
                />
              ) : null}
              {stackVsTorqaCompare ? (
                <details
                  className="p103-compare-details"
                  open={compareDetailsOpen}
                  onToggle={(e) => {
                    const el = e.currentTarget;
                    setCompareDetailsOpen(el.open);
                    if (el.open) {
                      setP131Snap(markP131Milestone("compare"));
                      recordTrialEvent("comparison_panel_opened", { context: "trial_stack_vs_torqa" });
                    }
                  }}
                >
                  <summary>{tr("trial.compare.summary")}</summary>
                  <div className="trial-success-compare-wrap">
                    <StackVsTorqaPanel snap={stackVsTorqaCompare} />
                  </div>
                </details>
              ) : null}
              <div className="trial-success-actions">
                {activeRel?.toLowerCase().endsWith(".tq") ? (
                  <div className="p117-evolve-row trial-success-evolve" role="group" aria-label={tr("p117.group.aria")}>
                    <button
                      type="button"
                      className="btn btn-compact"
                      disabled={!promptVersions[0].trim() || busy !== "idle"}
                      title={tr("p117.improve.title")}
                      onClick={() => void handleEvolveApp("improve")}
                    >
                      {tr("p117.improve")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-compact"
                      disabled={!promptVersions[0].trim() || busy !== "idle"}
                      title={tr("p117.addFeature.title")}
                      onClick={() => void handleEvolveApp("add-feature")}
                    >
                      {tr("p117.addFeature")}
                    </button>
                  </div>
                ) : null}
                {lastPreviewUrl ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setP131Snap(markP131Milestone("preview"));
                        recordTrialEvent("preview_embedded");
                        setPreviewSplitOpen(true);
                      }}
                    >
                      {tr("trial.splitView")}
                    </button>
                    <button type="button" className="btn" onClick={() => void openPreviewInBrowser()}>
                      {tr("trial.openBrowser")}
                    </button>
                    {lastWebappDir ? (
                      <button type="button" className="btn" onClick={() => void retryPreview()}>
                        {tr("trial.retryPreview")}
                      </button>
                    ) : null}
                  </>
                ) : lastWebappDir ? (
                  <button type="button" className="btn btn-primary" onClick={() => void retryPreview()}>
                    {tr("trial.startPreview")}
                  </button>
                ) : null}
              </div>
              {!lastPreviewUrl && lastWebappDir ? (
                <p className="trial-success-foot">
                  {tr("trial.previewFoot", {
                    npmI: tr("trial.preview.npmI"),
                    npmDev: tr("trial.preview.npmDev"),
                    webapp: tr("trial.preview.webapp"),
                  })}
                </p>
              ) : null}
              {shouldShowHint(p131Snap, P131_HINT_TRY_PREVIEW, p131Snap.buildOk && !p131Snap.preview) ? (
                <P131Hint
                  t={tr}
                  text={tr("p131.hint.tryPreview")}
                  onDismiss={() => setP131Snap(dismissP131Hint(P131_HINT_TRY_PREVIEW))}
                />
              ) : null}
            </div>
          ) : null}
          {pipelineTokenEstimates && gate === "ok" && appPipelineStep !== "done" ? (
            <div className="token-hint-banner">
              <TokenSavingsPanel estimates={pipelineTokenEstimates} tokenProofRef={tokenProofRef} compact />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="body-row">
        <aside
          className={`sidebar p104-sidebar${sidebarCollapsed ? " sidebar--collapsed" : ""}`}
        >
          <div className="sidebar-toolbar">
            <button
              type="button"
              className="sidebar-collapse-toggle"
              title={sidebarCollapsed ? tr("sidebar.expand") : tr("sidebar.collapse")}
              aria-expanded={!sidebarCollapsed}
              onClick={() => {
                setSidebarCollapsed((c) => {
                  const n = !c;
                  try {
                    localStorage.setItem("torqa.sidebarCollapsed", n ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                  return n;
                });
              }}
            >
              {sidebarCollapsed ? "▶" : "◀"}
            </button>
          </div>
          <div className="file-tree">
            {workspace && tqFiles.length === 0 ? (
              <div className="empty-hint p104-empty-sidebar" style={{ padding: "8px 10px", textAlign: "left" }}>
                {tr("sidebar.empty.tq", { tq: ".tq" })}
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
            <div className="build-failure-banner" role="region" aria-label={tr("banner.buildFail.aria")}>
              <div className="build-failure-banner-title">{tr("banner.buildFail")}</div>
              <ul className="build-failure-banner-fixes">
                {buildFailurePanel.fixes.slice(0, 8).map((line, i) => (
                  <li key={`bfb-${i}`}>{line}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-compact" onClick={() => setBottomTab("diagnostics")}>
                {tr("banner.openDetails")}
              </button>
            </div>
          ) : null}
          {pipelineTokenEstimates && gate === "ok" && productMode === "advanced" && busy === "idle" ? (
            <div className="p106-token-savings-strip">
              <TokenSavingsPanel estimates={pipelineTokenEstimates} tokenProofRef={tokenProofRef} compact />
            </div>
          ) : null}
          {llmRunInsights && gate === "ok" && productMode === "advanced" && busy === "idle" ? (
            <div className="p130-llm-proof-strip">
              <LlmProofPanel insights={llmRunInsights} compact t={tr} />
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
                  {activeRel
                    ? `${activeRel}${dirty ? tr("editor.modified") : ""}`
                    : tr("editor.noFile")}
                  {!activeRel && workspace && productMode === "prompt"
                    ? ""
                    : !activeRel && workspace
                      ? tr("editor.pickFile")
                      : ""}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {lastPreviewUrl ? (
                    <>
                      <span className="editor-preview-toolbar" role="toolbar" aria-label={tr("editor.toolbar.preview")}>
                        <button
                          type="button"
                          className="btn btn-compact"
                          onClick={() =>
                            setPreviewSplitOpen((o) => {
                              const next = !o;
                              if (next) {
                                setP131Snap(markP131Milestone("preview"));
                                recordTrialEvent("preview_embedded");
                              }
                              return next;
                            })
                          }
                          title={previewSplitOpen ? tr("title.previewHide") : tr("title.previewSplit")}
                        >
                          {previewSplitOpen ? tr("editor.hidePreview") : tr("editor.splitPreview")}
                        </button>
                        {previewSplitOpen ? (
                          <button
                            type="button"
                            className="btn btn-compact"
                            onClick={() => setPreviewRefreshKey((k) => k + 1)}
                            title={tr("title.reloadPreview")}
                          >
                            {tr("editor.reload")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-compact"
                          onClick={() => void openPreviewInBrowser()}
                          title={tr("title.browserPreview")}
                        >
                          {tr("editor.browser")}
                        </button>
                      </span>
                    </>
                  ) : null}
                  {paths ? (
                    <span
                      style={{ opacity: 0.65, textAlign: "right", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={`${paths.repoRoot}\n${paths.pythonExe}`}
                    >
                      {tr("editor.coreConnected")}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="editor-wrap">
                {!activeRel ? (
                  <div className="empty-hint p104-empty-editor" style={{ maxWidth: 360, margin: "0 auto" }}>
                    {productMode === "prompt" ? (
                      tr("editor.empty.prompt")
                    ) : (
                      tr("editor.empty.advanced", { tq: ".tq" })
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
                  aria-label={tr("editor.resizeSplit")}
                  onMouseDown={onSplitGutterMouseDown}
                />
                <div className="editor-split-preview">
                  <div className="preview-pane-head">
                    <span className="preview-pane-title">{tr("preview.title")}</span>
                    <span className="preview-pane-url" title={lastPreviewUrl}>
                      {lastPreviewUrl}
                    </span>
                  </div>
                  <iframe
                    key={`${lastPreviewUrl}-${previewRefreshKey}`}
                    className="preview-iframe"
                    src={lastPreviewUrl}
                    title={tr("preview.iframeTitle")}
                  />
                </div>
              </>
            ) : null}
          </div>
        </section>

        <aside className={`insight${rightOpen ? "" : " collapsed"}`}>
          <div className="insight-tabs">
            <button type="button" className={rightTab === "ir" ? "on" : ""} onClick={() => setRightTab("ir")}>
              {tr("insight.tab.spec")}
            </button>
            <button type="button" className={rightTab === "bench" ? "on" : ""} onClick={() => setRightTab("bench")}>
              {tr("insight.tab.bench")}
            </button>
            <button
              type="button"
              className={rightTab === "models" ? "on" : ""}
              onClick={() => {
                setRightTab("models");
                recordTrialEvent("comparison_panel_opened", { context: "models_tab" });
              }}
            >
              {tr("insight.tab.models")}
            </button>
            <button type="button" className={rightTab === "feedback" ? "on" : ""} onClick={() => setRightTab("feedback")}>
              {tr("insight.tab.feedback")}
            </button>
          </div>
          <div className="insight-body">
            {rightTab === "ir" ? (
              irPreview ? (
                <pre style={{ margin: 0 }}>{irPreview}</pre>
              ) : (
                <div className="empty-hint">
                  {tr("insight.empty.before")}{" "}
                  <strong>{tr("btn.validate")}</strong>
                  {tr("insight.empty.after")}
                </div>
              )
            ) : rightTab === "bench" ? (
              benchMetrics ? (
                <div>
                  <div className="bm-hero">
                    {typeof benchMetrics.semantic_compression_ratio === "number"
                      ? `${benchMetrics.semantic_compression_ratio.toFixed(2)}×`
                      : tr("tokenPanel.emdash")}
                  </div>
                  <div style={{ color: "var(--text-dim)", marginBottom: 12 }}>
                    {tr("insight.bench.tokenNote", {
                      doc: "docs/TOKEN_PROOF.md",
                      cmd: "torqa-token-proof",
                      rep: "reports/token_proof.json",
                    })}
                  </div>
                  {(
                    [
                      ["task_prompt_token_estimate", tr("bench.row.nlTask")],
                      ["torqa_source_token_estimate", tr("bench.row.tqSurface")],
                      ["ir_bundle_token_estimate", tr("bench.row.irBundle")],
                      ["generated_output_token_estimate", tr("bench.row.generated")],
                    ] as [string, string][]
                  ).map(([k, lab]) =>
                    typeof benchMetrics[k as keyof BenchMetrics] === "number" ? (
                      <div key={k} className="bm-row">
                        <span>{lab}</span>
                        <span>{String(benchMetrics[k as keyof BenchMetrics])}</span>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : (
                <div className="empty-hint">{tr("insight.bench.emptyPara")}</div>
              )
            ) : rightTab === "models" ? (
              <>
                <ComparisonSummaryPanel report={comparisonReport} t={tr} />
                <ModelComparePanel aggregate={modelCompareAggregate} />
              </>
            ) : (
              <TrialFeedbackPanel t={tr} variant="sidebar" />
            )}
          </div>
        </aside>
      </div>
        </div>
      </div>

      <footer className={`bottom${bottomOpen ? "" : " collapsed"}`}>
        <div className="bottom-tabs">
          <button type="button" className={bottomTab === "summary" ? "on" : ""} onClick={() => setBottomTab("summary")}>
            {tr("bottom.runSummary")}
          </button>
          <button type="button" className={bottomTab === "output" ? "on" : ""} onClick={() => setBottomTab("output")}>
            {tr("bottom.output")}
          </button>
          <button
            type="button"
            className={bottomTab === "diagnostics" ? "on" : ""}
            onClick={() => setBottomTab("diagnostics")}
          >
            {tr("bottom.details")}
          </button>
          <button
            type="button"
            className={bottomTab === "activity" ? "on" : ""}
            onClick={() => setBottomTab("activity")}
            title={tr("bottom.activity.title")}
          >
            {tr("bottom.activity")}
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
              {tr("bottom.lastRun", {
                cmd: lastTorqaCommand.length > 42 ? `${lastTorqaCommand.slice(0, 40)}…` : lastTorqaCommand,
              })}
            </span>
          ) : null}
          <button type="button" className="bottom-toggle" onClick={() => setBottomOpen((o) => !o)}>
            {bottomOpen ? "▼" : "▲"}
          </button>
        </div>
        {bottomOpen ? (
          <div className="bottom-body">
            {bottomTab === "summary" ? (
              pipelineHumanSteps ? (
                <div className="p103-bottom-summary">
                  <p className="p103-summary-intro">{tr("summary.intro")}</p>
                  <PipelineRunSummaryList steps={pipelineHumanSteps} />
                  <div className="p103-summary-links">
                    <button type="button" className="btn btn-compact" onClick={() => setBottomTab("output")}>
                      {tr("summary.rawOutput")}
                    </button>
                    <button type="button" className="btn btn-compact" onClick={() => setBottomTab("diagnostics")}>
                      {tr("summary.techDetails")}
                    </button>
                  </div>
                </div>
              ) : (
                <span className="empty-hint">{tr("summary.empty.hint")}</span>
              )
            ) : bottomTab === "output" ? (
              outputText || <span className="empty-hint">{tr("output.empty")}</span>
            ) : bottomTab === "activity" ? (
              <div className="activity-panel">
                {pipelineFailure ? (
                  <div className="activity-failure-block">
                    <strong>{tr("activity.fail.title")}</strong>
                    <p className="activity-failure-axis">
                      {tr("activity.fail.area")}{" "}
                      <strong>
                        {pipelineFailure.axis === "gpt"
                          ? tr("activity.area.ai")
                          : pipelineFailure.axis === "torqa"
                            ? tr("activity.area.checks")
                            : pipelineFailure.axis === "setup"
                              ? tr("activity.area.setup")
                              : tr("activity.area.unknown")}
                      </strong>
                    </p>
                    <ul className="activity-log-list">
                      {pipelineFailure.lines.map((line, i) => (
                        <li key={`pf-${i}`}>{line}</li>
                      ))}
                    </ul>
                    <strong>{tr("activity.suggested")}</strong>
                    <ul className="activity-log-list">
                      {pipelineFailure.fixes.map((line, i) => (
                        <li key={`fx-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {buildFailurePanel ? (
                  <div className="activity-failure-block">
                    <strong>{tr("activity.buildFixes")}</strong>
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
                  <span className="empty-hint">{tr("activity.empty.line")}</span>
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
                  <div className="build-failure-diagnostics" role="region" aria-label={tr("diag.region.buildFailure")}>
                    <strong style={{ display: "block", marginBottom: 8 }}>{tr("diag.suggestedFixes")}</strong>
                    <ul className="activity-log-list" style={{ marginBottom: 12 }}>
                      {buildFailurePanel.fixes.map((line, i) => (
                        <li key={`bdf-${i}`}>{line}</li>
                      ))}
                    </ul>
                    <strong style={{ display: "block", marginBottom: 8 }}>{tr("diag.details")}</strong>
                    <ul className="activity-log-list" style={{ marginBottom: 16 }}>
                      {buildFailurePanel.lines.slice(0, 24).map((line, i) => (
                        <li key={`bdl-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {pipelineTokenEstimates ? (
                  <div className="diagnostics-token-block">
                    <TokenSavingsPanel estimates={pipelineTokenEstimates} tokenProofRef={tokenProofRef} compact />
                  </div>
                ) : null}
                {apiCallMetrics ? (
                  <div className="diagnostics-api-block">
                    <strong className="diagnostics-api-heading">{tr("diag.apiUsage")}</strong>
                    <ApiCallMetricsPanel m={apiCallMetrics} compact />
                  </div>
                ) : null}
                {stackVsTorqaCompare ? (
                  <div className="diagnostics-compare-block">
                    <strong className="diagnostics-compare-heading">{tr("diag.compare")}</strong>
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
                    <span className="empty-hint">
                      {tr("diag.empty.before")} <strong>{tr("btn.validate")}</strong>
                      {tr("diag.empty.after")}
                      <strong>{tr("btn.build")}</strong>
                      {tr("diag.empty.end")}
                    </span>
                  ) : null)}
                {written.length > 0 ? (
                  <div>
                    <strong>{tr("diag.generatedPaths")}</strong>
                    <ul className="written-list">
                      {written.slice(0, 80).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                    {written.length > 80 ? (
                      <div>{tr("diag.moreFiles", { n: String(written.length - 80) })}</div>
                    ) : null}
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
  const { t } = useI18n();
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <h1 style={{ marginTop: 0, flex: 1 }}>{t("shell.missing.title")}</h1>
        <LanguageToggle className="i18n-lang-toggle i18n-lang-toggle--titlebar" />
      </div>
      <p style={{ lineHeight: 1.65 }}>{t("shell.missing.p1")}</p>
      <h2 style={{ marginBottom: 12 }}>{t("shell.missing.h2")}</h2>
      <ol style={{ lineHeight: 1.75 }}>
        <li>{t("shell.missing.li1")}</li>
        <li>
          {t("shell.missing.li2.before")}{" "}
          <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 8, background: "var(--panel, #2d2d2d)" }}>
            {`cd desktop\nnpm install\nnpm run build\nnpm start`}
          </pre>
        </li>
        <li>{t("shell.missing.li3")}</li>
        <li>{t("shell.missing.li4")}</li>
      </ol>
      <p style={{ opacity: 0.85, fontSize: 13 }}>{t("shell.missing.foot")}</p>
    </div>
  );
}

function AppGate() {
  if (typeof window !== "undefined" && !window.torqaShell) {
    return <ElectronMissing />;
  }
  return <DesktopApp />;
}

export default function App() {
  return (
    <I18nProvider>
      <AppGate />
    </I18nProvider>
  );
}




/**
 * P107 / P136: offline reference comparison from checked-in token proof JSON.
 * Dollar figures are illustrative reference tiers only — not live quotes.
 * Keep USD/Mtok tables aligned with `src/benchmarks/comparison_report_build.py` and `reports/comparison_report.json`.
 */

export type ReferenceAggregate = {
  passedCount: number;
  avgPromptIn: number;
  avgTorqaIn: number;
  avgLlmOutput: number;
  avgIrOut: number;
  suiteId: string;
  estimatorId: string;
};

export type VendorReferenceProfile = {
  id: "gpt" | "claude" | "gemini";
  /** USD per 1M input tokens (reference table, not live). */
  inputUsdPerMTok: number;
  /** USD per 1M output tokens (reference table, not live). */
  outputUsdPerMTok: number;
};

/** Example published-style list tiers for side-by-side math; verify with vendors. */
export const VENDOR_REFERENCE_PROFILES: VendorReferenceProfile[] = [
  { id: "gpt", inputUsdPerMTok: 2.5, outputUsdPerMTok: 10 },
  { id: "claude", inputUsdPerMTok: 3.0, outputUsdPerMTok: 15 },
  { id: "gemini", inputUsdPerMTok: 1.25, outputUsdPerMTok: 5 },
];

export function costUsdReference(inTok: number, outTok: number, p: VendorReferenceProfile): number {
  return (inTok / 1_000_000) * p.inputUsdPerMTok + (outTok / 1_000_000) * p.outputUsdPerMTok;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Aggregate passing scenarios from `reports/token_proof.json` shape. */
export function parseReferenceAggregateFromTokenProofJson(raw: unknown): ReferenceAggregate | null {
  if (!isRecord(raw)) return null;
  const scenarios = raw.scenarios;
  if (!Array.isArray(scenarios)) return null;
  const prompts: number[] = [];
  const torqas: number[] = [];
  const baselines: number[] = [];
  const irs: number[] = [];
  for (const s of scenarios) {
    if (!isRecord(s) || s.ok !== true) continue;
    const tc = s.token_counts;
    if (!isRecord(tc)) continue;
    const pt = Number(tc.prompt_tokens);
    const tt = Number(tc.torqa_tokens);
    const bt = Number(tc.baseline_code_tokens);
    const it = Number(tc.ir_tokens);
    if (![pt, tt, bt, it].every((n) => Number.isFinite(n))) continue;
    prompts.push(pt);
    torqas.push(tt);
    baselines.push(bt);
    irs.push(it);
  }
  if (prompts.length === 0) return null;
  const pub = isRecord(raw.public_summary) ? raw.public_summary : null;
  const suiteId = pub && typeof pub.suite_id === "string" ? pub.suite_id : "";
  const estimatorId = typeof raw.estimator_id === "string" ? raw.estimator_id : "utf8_bytes_div_4_v1";
  return {
    passedCount: prompts.length,
    avgPromptIn: mean(prompts),
    avgTorqaIn: mean(torqas),
    avgLlmOutput: mean(baselines),
    avgIrOut: mean(irs),
    suiteId,
    estimatorId,
  };
}

export function inputReductionVsTorqaPct(promptIn: number, torqaIn: number): number | null {
  if (!(promptIn > 0) || !Number.isFinite(promptIn) || !Number.isFinite(torqaIn)) return null;
  return (100 * (promptIn - torqaIn)) / promptIn;
}

export function costReductionVsNlPct(nlCost: number, torqaCost: number): number | null {
  if (!(nlCost > 0) || !Number.isFinite(nlCost) || !Number.isFinite(torqaCost)) return null;
  return (100 * (nlCost - torqaCost)) / nlCost;
}

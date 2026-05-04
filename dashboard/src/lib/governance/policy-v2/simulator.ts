/**
 * Policy Pack v2 — what-if simulator.
 *
 * Loads recent scan_history rows, runs the resolved pack against each one,
 * and returns aggregate impact counts plus a per-scan delta. This is the
 * server-side engine for the "what would happen if I activated this pack?"
 * feature in the editor.
 *
 * Pure with respect to the database: it only reads scan_history; it never
 * mutates it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluatePolicyRules } from "@/lib/governance/policy-v2/evaluator";
import type {
  PolicyV2EvaluationResult,
  PolicyVerdict,
} from "@/lib/governance/policy-v2/types";
import type {
  ScanApiSuccess,
  ScanFinding,
  ScanSource,
  ScanSeverity,
} from "@/lib/scan-engine";
import type { GovernanceScope } from "@/lib/governance/scope";
import type { ResolvedPolicyPack } from "@/lib/governance/policy-v2/resolver";

export type SimulationRange = "last-7-days" | "last-30-days" | "last-90-days";

export type SimulationScanOutcome = {
  scanId: string;
  source: ScanSource;
  workflowName: string | null;
  createdAt: string;
  riskScore: number;
  /** Verdict produced by the v2 pack on this historical scan. */
  newVerdict: PolicyVerdict;
  /** Best-effort representation of the scan's prior gate (engine-only). */
  priorStatus: "PASS" | "NEEDS REVIEW" | "FAIL";
  hits: PolicyV2EvaluationResult["hits"];
};

export type SimulationSummary = {
  range: SimulationRange;
  totalScans: number;
  evaluated: number;
  outcomes: {
    pass: number;
    review: number;
    block: number;
  };
  /** Newly blocked = previously not FAIL but now block. */
  newlyBlocked: number;
  /** Newly passed = previously FAIL but now pass. */
  newlyPassed: number;
  /** Newly review = previously not WARN/REVIEW but now review. */
  newlyReview: number;
  scans: SimulationScanOutcome[];
};

const RANGE_DAYS: Record<SimulationRange, number> = {
  "last-7-days": 7,
  "last-30-days": 30,
  "last-90-days": 90,
};

const VALID_SEVERITIES: ScanSeverity[] = ["info", "review", "high", "critical"];
const VALID_SOURCES: ScanSource[] = [
  "n8n",
  "generic",
  "github",
  "ai-agent",
  "make",
  "zapier",
  "lambda",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function coerceFinding(value: unknown): ScanFinding | null {
  if (!isPlainObject(value)) return null;
  const severity = typeof value.severity === "string" ? value.severity : null;
  const rule_id = typeof value.rule_id === "string" ? value.rule_id : null;
  const target = typeof value.target === "string" ? value.target : "workflow";
  const explanation = typeof value.explanation === "string" ? value.explanation : "";
  const suggested_fix = typeof value.suggested_fix === "string" ? value.suggested_fix : "";
  if (!severity || !rule_id) return null;
  if (!VALID_SEVERITIES.includes(severity as ScanSeverity)) return null;
  return {
    severity: severity as ScanSeverity,
    rule_id,
    target,
    explanation,
    suggested_fix,
  };
}

function coerceScanResult(raw: unknown): { findings: ScanFinding[]; riskScore: number; status: "PASS" | "NEEDS REVIEW" | "FAIL" } | null {
  if (!isPlainObject(raw)) return null;
  const arr = Array.isArray(raw.findings) ? raw.findings : [];
  const findings: ScanFinding[] = [];
  for (const f of arr) {
    const norm = coerceFinding(f);
    if (norm) findings.push(norm);
  }
  const riskScore = typeof raw.riskScore === "number" && Number.isFinite(raw.riskScore) ? raw.riskScore : 100;
  const status = raw.status === "FAIL" || raw.status === "NEEDS REVIEW" || raw.status === "PASS" ? raw.status : "PASS";
  return { findings, riskScore, status };
}

function coerceSource(value: unknown): ScanSource {
  if (typeof value !== "string") return "generic";
  return VALID_SOURCES.includes(value as ScanSource) ? (value as ScanSource) : "generic";
}

export async function simulatePolicyPack(
  supabase: SupabaseClient,
  scope: GovernanceScope,
  pack: ResolvedPolicyPack,
  range: SimulationRange
): Promise<SimulationSummary> {
  const days = RANGE_DAYS[range] ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("scan_history")
    .select("id, source, workflow_name, result, created_at, user_id, organization_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  } else if (scope.userId) {
    query = query.is("organization_id", null).eq("user_id", scope.userId);
  } else {
    return emptySummary(range);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return emptySummary(range);

  const outcomes: SimulationScanOutcome[] = [];
  let evaluated = 0;
  let pass = 0;
  let review = 0;
  let block = 0;
  let newlyBlocked = 0;
  let newlyPassed = 0;
  let newlyReview = 0;

  for (const row of data as Array<{
    id: string;
    source: string;
    workflow_name: string | null;
    result: unknown;
    created_at: string;
  }>) {
    const coerced = coerceScanResult(row.result);
    if (!coerced) continue;
    const src = coerceSource(row.source);
    evaluated += 1;

    const evalResult = evaluatePolicyRules(
      pack.rules,
      pack.defaultVerdict,
      pack.name,
      pack.packId,
      {
        findings: coerced.findings,
        riskScore: coerced.riskScore,
        source: src,
      }
    );

    if (evalResult.verdict === "block") block += 1;
    else if (evalResult.verdict === "review") review += 1;
    else pass += 1;

    if (coerced.status !== "FAIL" && evalResult.verdict === "block") newlyBlocked += 1;
    if (coerced.status === "FAIL" && evalResult.verdict === "pass") newlyPassed += 1;
    if (coerced.status === "PASS" && evalResult.verdict === "review") newlyReview += 1;

    outcomes.push({
      scanId: row.id,
      source: src,
      workflowName: row.workflow_name,
      createdAt: row.created_at,
      riskScore: coerced.riskScore,
      newVerdict: evalResult.verdict,
      priorStatus: coerced.status,
      hits: evalResult.hits.slice(0, 10),
    });
  }

  return {
    range,
    totalScans: data.length,
    evaluated,
    outcomes: { pass, review, block },
    newlyBlocked,
    newlyPassed,
    newlyReview,
    scans: outcomes,
  };
}

function emptySummary(range: SimulationRange): SimulationSummary {
  return {
    range,
    totalScans: 0,
    evaluated: 0,
    outcomes: { pass: 0, review: 0, block: 0 },
    newlyBlocked: 0,
    newlyPassed: 0,
    newlyReview: 0,
    scans: [],
  };
}

/** Re-export for ScanApiSuccess consumers if they need to rebuild totals locally. */
export type { ScanApiSuccess };

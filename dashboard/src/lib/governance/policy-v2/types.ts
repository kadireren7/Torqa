/**
 * Policy Pack v2 — programmable rule schema and evaluation result types.
 *
 * Inheritance chain:
 *     parent_template_slug (built-in thresholds, optional)
 *       ↓
 *     parent_pack_id chain (self-FK, optional, depth-limited)
 *       ↓
 *     this pack's rules + default_verdict
 *       ↓
 *     run override (rules passed at scan time, optional)
 *
 * Child rules are appended after parent rules. The first matching rule wins
 * unless `mode = "all"` is set on the pack (we keep "first-match" for v0.2.1).
 *
 * The grammar is JSON-only by design: easy to validate, deterministic to evaluate,
 * straightforward for the editor UI to roundtrip.
 */

import type { ScanFinding, ScanSeverity, ScanSource } from "@/lib/scan-engine";
import type { PolicyEvaluationResult, PolicyGateStatus } from "@/lib/policy-types";

export type PolicyPackLevel = "workspace" | "source";
export type PolicyVerdict = "pass" | "review" | "block";

/** Set of fields reachable from a rule predicate. */
export type RuleField =
  // per-finding fields:
  | "severity"
  | "rule_id"
  | "target"
  | "source"
  // per-scan fields (only valid in scope=scan rules):
  | "risk_score"
  | "findings_count"
  | "critical_count"
  | "review_count"
  | "info_count";

export type RuleOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

/** A single predicate atom: `field op value`. */
export type RulePredicate = {
  field: RuleField;
  op: RuleOperator;
  value: string | number | string[] | number[];
};

/** Boolean composition of predicates. */
export type RuleCondition =
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition }
  | RulePredicate;

/**
 * `finding` rules evaluate per-finding (one verdict per finding match).
 * `scan` rules evaluate once over the whole scan (e.g. risk_score < 60).
 *
 * For `finding` scope rules, accepted-risk findings are skipped automatically
 * by the resolver (they are filtered out of `findings` upstream).
 */
export type RuleScope = "finding" | "scan";

export type PolicyRule = {
  id: string;
  name: string;
  scope: RuleScope;
  when: RuleCondition;
  /** Verdict raised when the rule matches. */
  then: PolicyVerdict;
  /** Optional message surfaced in evaluation output and the UI. */
  message?: string;
  enabled?: boolean;
};

export type PolicyPack = {
  id: string;
  organizationId: string | null;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  level: PolicyPackLevel;
  sourceType: ScanSource | null;
  parentPackId: string | null;
  parentTemplateSlug: string | null;
  defaultVerdict: PolicyVerdict;
  rules: PolicyRule[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PolicyPackInput = {
  name: string;
  slug?: string;
  description?: string | null;
  level: PolicyPackLevel;
  sourceType?: ScanSource | null;
  parentPackId?: string | null;
  parentTemplateSlug?: string | null;
  defaultVerdict?: PolicyVerdict;
  rules?: PolicyRule[];
  enabled?: boolean;
};

/** A single rule firing on the scan. */
export type RuleHit = {
  ruleId: string;
  ruleName: string;
  scope: RuleScope;
  verdict: PolicyVerdict;
  message: string | null;
  /** When scope=finding, the matched finding's signature (or rule_id+target). */
  findingSignature: string | null;
  /** When scope=finding, the matched finding's rule_id for reporting. */
  findingRuleId: string | null;
  /** When scope=finding, the matched finding's target. */
  findingTarget: string | null;
};

export type PolicyV2EvaluationResult = {
  /** Final verdict after combining all rule hits + default_verdict. */
  verdict: PolicyVerdict;
  /** Equivalent gate status for legacy UIs (block→FAIL, review→WARN, pass→PASS). */
  gateStatus: PolicyGateStatus;
  /** Human-readable label of the pack (or "ad-hoc" for run-overrides). */
  packName: string;
  /** Resolved id of the pack used (null for ad-hoc). */
  packId: string | null;
  /** All rules that matched (in order). */
  hits: RuleHit[];
  /** Combined effect for telemetry / UI. */
  reasons: string[];
  /**
   * If a parent threshold template (legacy) was inherited, this contains the
   * legacy threshold evaluation so the UI can surface both layers.
   */
  thresholdEvaluation?: PolicyEvaluationResult;
};

/** Verdict precedence — block > review > pass. Used to combine hits. */
export const VERDICT_RANK: Record<PolicyVerdict, number> = {
  pass: 0,
  review: 1,
  block: 2,
};

export function strongerVerdict(a: PolicyVerdict, b: PolicyVerdict): PolicyVerdict {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}

export function gateStatusFromVerdict(v: PolicyVerdict): PolicyGateStatus {
  if (v === "block") return "FAIL";
  if (v === "review") return "WARN";
  return "PASS";
}

/** Constants used by the validator and the editor UI. */
export const VALID_SEVERITIES: ScanSeverity[] = ["info", "review", "high", "critical"];
export const VALID_SOURCES: ScanSource[] = [
  "n8n",
  "generic",
  "github",
  "ai-agent",
  "make",
  "zapier",
  "lambda",
];
export const VALID_VERDICTS: PolicyVerdict[] = ["pass", "review", "block"];
export const VALID_RULE_FIELDS: RuleField[] = [
  "severity",
  "rule_id",
  "target",
  "source",
  "risk_score",
  "findings_count",
  "critical_count",
  "review_count",
  "info_count",
];
export const VALID_RULE_OPERATORS: RuleOperator[] = [
  "eq",
  "neq",
  "in",
  "not_in",
  "contains",
  "starts_with",
  "ends_with",
  "regex",
  "gt",
  "gte",
  "lt",
  "lte",
];

export const NUMERIC_FIELDS = new Set<RuleField>([
  "risk_score",
  "findings_count",
  "critical_count",
  "review_count",
  "info_count",
]);

export const SCAN_ONLY_FIELDS = new Set<RuleField>([
  "risk_score",
  "findings_count",
  "critical_count",
  "review_count",
  "info_count",
]);

/** Helper to compute scan-level totals for `scope=scan` rules. */
export function scanLevelTotals(findings: ScanFinding[], riskScore: number) {
  let critical = 0;
  let review = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === "critical" || f.severity === "high") critical += 1;
    else if (f.severity === "review") review += 1;
    else info += 1;
  }
  return {
    risk_score: riskScore,
    findings_count: findings.length,
    critical_count: critical,
    review_count: review,
    info_count: info,
  };
}

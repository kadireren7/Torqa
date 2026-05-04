/**
 * Policy Pack v2 — pure evaluator.
 *
 * Given a list of (already-resolved) rules and a scan, returns a verdict and
 * the list of matching hits. Deterministic: same input → same output, no IO.
 *
 * Combine semantics:
 *   - `pass` is the default.
 *   - Any `block` hit immediately raises the verdict to `block`.
 *   - `review` hits raise the verdict to `review` unless something else has
 *     already raised it to `block`.
 *   - Pack-level `default_verdict` is applied last; it never *lowers* the
 *     verdict (only raises it when no rule matched).
 */

import type { ScanFinding, ScanSource } from "@/lib/scan-engine";
import {
  gateStatusFromVerdict,
  scanLevelTotals,
  strongerVerdict,
  type PolicyRule,
  type PolicyV2EvaluationResult,
  type PolicyVerdict,
  type RuleCondition,
  type RuleField,
  type RuleHit,
  type RulePredicate,
} from "@/lib/governance/policy-v2/types";

export type EvaluatorInput = {
  findings: ScanFinding[];
  riskScore: number;
  source: ScanSource;
};

function readFindingField(field: RuleField, finding: ScanFinding, source: ScanSource): unknown {
  switch (field) {
    case "severity":
      return finding.severity;
    case "rule_id":
      return finding.rule_id;
    case "target":
      return finding.target;
    case "source":
      return source;
    default:
      return undefined;
  }
}

function readScanField(
  field: RuleField,
  totals: ReturnType<typeof scanLevelTotals>,
  source: ScanSource
): unknown {
  switch (field) {
    case "risk_score":
      return totals.risk_score;
    case "findings_count":
      return totals.findings_count;
    case "critical_count":
      return totals.critical_count;
    case "review_count":
      return totals.review_count;
    case "info_count":
      return totals.info_count;
    case "source":
      return source;
    default:
      return undefined;
  }
}

function evalLeaf(predicate: RulePredicate, actual: unknown): boolean {
  const { op, value } = predicate;
  switch (op) {
    case "eq":
      return actual === value;
    case "neq":
      return actual !== value;
    case "in":
      return Array.isArray(value) && (value as Array<string | number>).some((v) => v === actual);
    case "not_in":
      return Array.isArray(value) && !(value as Array<string | number>).some((v) => v === actual);
    case "contains":
      return typeof actual === "string" && typeof value === "string" && actual.includes(value);
    case "starts_with":
      return typeof actual === "string" && typeof value === "string" && actual.startsWith(value);
    case "ends_with":
      return typeof actual === "string" && typeof value === "string" && actual.endsWith(value);
    case "regex": {
      if (typeof actual !== "string" || typeof value !== "string") return false;
      try {
        return new RegExp(value).test(actual);
      } catch {
        return false;
      }
    }
    case "gt":
      return typeof actual === "number" && typeof value === "number" && actual > value;
    case "gte":
      return typeof actual === "number" && typeof value === "number" && actual >= value;
    case "lt":
      return typeof actual === "number" && typeof value === "number" && actual < value;
    case "lte":
      return typeof actual === "number" && typeof value === "number" && actual <= value;
    default:
      return false;
  }
}

function evalCondition(
  cond: RuleCondition,
  read: (field: RuleField) => unknown
): boolean {
  if ("all" in cond) return cond.all.every((c) => evalCondition(c, read));
  if ("any" in cond) return cond.any.some((c) => evalCondition(c, read));
  if ("not" in cond) return !evalCondition(cond.not, read);
  return evalLeaf(cond, read(cond.field));
}

function findingSignature(f: ScanFinding): string {
  return f.signature ?? `${f.rule_id}|${f.target}`;
}

export function evaluatePolicyRules(
  rules: PolicyRule[],
  defaultVerdict: PolicyVerdict,
  packName: string,
  packId: string | null,
  input: EvaluatorInput
): PolicyV2EvaluationResult {
  const hits: RuleHit[] = [];
  let verdict: PolicyVerdict = "pass";

  // Filter accepted-risk findings — they were intentionally excluded from the
  // gate posture by the governance layer. We honor the same contract here.
  const findings = input.findings.filter((f) => !f.accepted_risk);

  const totals = scanLevelTotals(findings, input.riskScore);

  const enabledRules = rules.filter((r) => r.enabled !== false);

  for (const rule of enabledRules) {
    if (rule.scope === "finding") {
      for (const f of findings) {
        const matched = evalCondition(rule.when, (field) => readFindingField(field, f, input.source));
        if (matched) {
          hits.push({
            ruleId: rule.id,
            ruleName: rule.name,
            scope: "finding",
            verdict: rule.then,
            message: rule.message ?? null,
            findingSignature: findingSignature(f),
            findingRuleId: f.rule_id,
            findingTarget: f.target,
          });
          verdict = strongerVerdict(verdict, rule.then);
        }
      }
    } else {
      const matched = evalCondition(rule.when, (field) => readScanField(field, totals, input.source));
      if (matched) {
        hits.push({
          ruleId: rule.id,
          ruleName: rule.name,
          scope: "scan",
          verdict: rule.then,
          message: rule.message ?? null,
          findingSignature: null,
          findingRuleId: null,
          findingTarget: null,
        });
        verdict = strongerVerdict(verdict, rule.then);
      }
    }
  }

  const finalVerdict = strongerVerdict(verdict, defaultVerdict);

  const reasons: string[] = [];
  if (hits.length === 0) {
    reasons.push(
      `No rule matched. Default verdict from pack: ${defaultVerdict.toUpperCase()}.`
    );
  } else {
    const blocks = hits.filter((h) => h.verdict === "block").length;
    const reviews = hits.filter((h) => h.verdict === "review").length;
    const passes = hits.filter((h) => h.verdict === "pass").length;
    if (blocks) reasons.push(`${blocks} rule${blocks === 1 ? "" : "s"} forced BLOCK.`);
    if (reviews) reasons.push(`${reviews} rule${reviews === 1 ? "" : "s"} forced REVIEW.`);
    if (passes) reasons.push(`${passes} rule${passes === 1 ? "" : "s"} matched as PASS.`);
  }

  return {
    verdict: finalVerdict,
    gateStatus: gateStatusFromVerdict(finalVerdict),
    packName,
    packId,
    hits,
    reasons,
  };
}

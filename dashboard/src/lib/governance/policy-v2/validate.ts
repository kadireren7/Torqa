/**
 * Policy Pack v2 — rules JSON validator.
 *
 * Used by the API on insert/update and by the editor UI as a real-time linter.
 * Returns a structured list of issues so the editor can highlight rules.
 */

import {
  NUMERIC_FIELDS,
  SCAN_ONLY_FIELDS,
  VALID_RULE_FIELDS,
  VALID_RULE_OPERATORS,
  VALID_SEVERITIES,
  VALID_SOURCES,
  VALID_VERDICTS,
  type PolicyRule,
  type RuleCondition,
  type RuleField,
  type RuleOperator,
  type RulePredicate,
} from "@/lib/governance/policy-v2/types";

export type PolicyValidationIssue = {
  level: "error" | "warning";
  ruleIndex: number | null;
  path: string;
  message: string;
};

export type PolicyValidationResult = {
  ok: boolean;
  issues: PolicyValidationIssue[];
  /** Cleaned, structurally valid rules (only when issues has no errors). */
  rules: PolicyRule[];
};

const MAX_RULES = 100;
const MAX_DEPTH = 6;
const MAX_RULE_NAME = 200;
const MAX_MESSAGE = 500;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function pushError(out: PolicyValidationIssue[], idx: number | null, path: string, message: string) {
  out.push({ level: "error", ruleIndex: idx, path, message });
}

function pushWarn(out: PolicyValidationIssue[], idx: number | null, path: string, message: string) {
  out.push({ level: "warning", ruleIndex: idx, path, message });
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

function validateValueForField(
  field: RuleField,
  op: RuleOperator,
  value: unknown
): { ok: true; value: RulePredicate["value"] } | { ok: false; reason: string } {
  // Operator → expected shape.
  if (op === "in" || op === "not_in") {
    if (NUMERIC_FIELDS.has(field)) {
      if (!isNumberArray(value)) return { ok: false, reason: "expected an array of numbers" };
      return { ok: true, value };
    }
    if (!isStringArray(value)) return { ok: false, reason: "expected an array of strings" };
    return { ok: true, value };
  }

  if (op === "regex") {
    if (typeof value !== "string") return { ok: false, reason: "regex value must be a string" };
    try {
      // Compile once to surface bad patterns up front.
      void new RegExp(value);
    } catch {
      return { ok: false, reason: "invalid regular expression" };
    }
    return { ok: true, value };
  }

  if (op === "gt" || op === "gte" || op === "lt" || op === "lte") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, reason: `${op} requires a finite number` };
    }
    if (!NUMERIC_FIELDS.has(field)) {
      return { ok: false, reason: `${op} is only valid on numeric fields (e.g. risk_score)` };
    }
    return { ok: true, value };
  }

  // eq, neq, contains, starts_with, ends_with → scalar string/number.
  if (NUMERIC_FIELDS.has(field)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, reason: "expected a number" };
    }
    return { ok: true, value };
  }

  if (typeof value !== "string") return { ok: false, reason: "expected a string" };

  if (field === "severity" && (op === "eq" || op === "neq")) {
    if (!VALID_SEVERITIES.includes(value as (typeof VALID_SEVERITIES)[number])) {
      return {
        ok: false,
        reason: `severity must be one of ${VALID_SEVERITIES.join(", ")}`,
      };
    }
  }
  if (field === "source" && (op === "eq" || op === "neq")) {
    if (!VALID_SOURCES.includes(value as (typeof VALID_SOURCES)[number])) {
      return {
        ok: false,
        reason: `source must be one of ${VALID_SOURCES.join(", ")}`,
      };
    }
  }

  return { ok: true, value };
}

function validatePredicate(
  raw: Record<string, unknown>,
  ruleIndex: number,
  path: string,
  scope: "finding" | "scan",
  out: PolicyValidationIssue[]
): RulePredicate | null {
  const field = raw.field;
  const op = raw.op;
  const value = raw.value;

  if (typeof field !== "string" || !VALID_RULE_FIELDS.includes(field as RuleField)) {
    pushError(out, ruleIndex, `${path}.field`, `field must be one of ${VALID_RULE_FIELDS.join(", ")}`);
    return null;
  }
  const f = field as RuleField;

  if (typeof op !== "string" || !VALID_RULE_OPERATORS.includes(op as RuleOperator)) {
    pushError(out, ruleIndex, `${path}.op`, `op must be one of ${VALID_RULE_OPERATORS.join(", ")}`);
    return null;
  }
  const o = op as RuleOperator;

  if (scope === "finding" && SCAN_ONLY_FIELDS.has(f)) {
    pushError(
      out,
      ruleIndex,
      `${path}.field`,
      `field "${f}" is only valid in rules with scope="scan"`
    );
    return null;
  }
  if (scope === "scan" && !SCAN_ONLY_FIELDS.has(f)) {
    pushWarn(
      out,
      ruleIndex,
      `${path}.field`,
      `field "${f}" reads per-finding values; using it in a scope="scan" rule will only see the first finding`
    );
  }

  const v = validateValueForField(f, o, value);
  if (!v.ok) {
    pushError(out, ruleIndex, `${path}.value`, v.reason);
    return null;
  }
  return { field: f, op: o, value: v.value };
}

function validateCondition(
  raw: unknown,
  ruleIndex: number,
  path: string,
  scope: "finding" | "scan",
  out: PolicyValidationIssue[],
  depth: number
): RuleCondition | null {
  if (depth > MAX_DEPTH) {
    pushError(out, ruleIndex, path, `condition nesting too deep (max ${MAX_DEPTH})`);
    return null;
  }
  if (!isPlainObject(raw)) {
    pushError(out, ruleIndex, path, "condition must be a JSON object");
    return null;
  }

  const keys = Object.keys(raw);
  // Compound: {all|any: [...]} or {not: {...}}.
  if (keys.length === 1 && (keys[0] === "all" || keys[0] === "any")) {
    const arr = (raw as Record<string, unknown>)[keys[0]];
    if (!Array.isArray(arr) || arr.length === 0) {
      pushError(out, ruleIndex, `${path}.${keys[0]}`, `"${keys[0]}" must be a non-empty array`);
      return null;
    }
    if (arr.length > 16) {
      pushError(out, ruleIndex, `${path}.${keys[0]}`, `"${keys[0]}" supports at most 16 children`);
      return null;
    }
    const children: RuleCondition[] = [];
    for (let i = 0; i < arr.length; i += 1) {
      const child = validateCondition(arr[i], ruleIndex, `${path}.${keys[0]}[${i}]`, scope, out, depth + 1);
      if (!child) return null;
      children.push(child);
    }
    return keys[0] === "all" ? { all: children } : { any: children };
  }
  if (keys.length === 1 && keys[0] === "not") {
    const inner = (raw as Record<string, unknown>).not;
    const child = validateCondition(inner, ruleIndex, `${path}.not`, scope, out, depth + 1);
    if (!child) return null;
    return { not: child };
  }

  // Leaf predicate.
  return validatePredicate(raw, ruleIndex, path, scope, out);
}

export function validatePolicyRules(value: unknown): PolicyValidationResult {
  const issues: PolicyValidationIssue[] = [];
  const cleaned: PolicyRule[] = [];

  if (!Array.isArray(value)) {
    issues.push({
      level: "error",
      ruleIndex: null,
      path: "rules",
      message: "rules must be an array",
    });
    return { ok: false, issues, rules: [] };
  }
  if (value.length > MAX_RULES) {
    issues.push({
      level: "error",
      ruleIndex: null,
      path: "rules",
      message: `at most ${MAX_RULES} rules allowed`,
    });
    return { ok: false, issues, rules: [] };
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < value.length; i += 1) {
    const r = value[i];
    if (!isPlainObject(r)) {
      pushError(issues, i, `rules[${i}]`, "each rule must be a JSON object");
      continue;
    }

    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (!id || id.length > 80) {
      pushError(issues, i, `rules[${i}].id`, "id must be a 1..80 char string");
      continue;
    }
    if (!/^[a-zA-Z0-9._:-]+$/.test(id)) {
      pushError(issues, i, `rules[${i}].id`, "id may only contain letters, numbers, '.', '_', ':' and '-'");
      continue;
    }
    if (seenIds.has(id)) {
      pushError(issues, i, `rules[${i}].id`, `duplicate rule id "${id}"`);
      continue;
    }
    seenIds.add(id);

    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name || name.length > MAX_RULE_NAME) {
      pushError(issues, i, `rules[${i}].name`, `name must be 1..${MAX_RULE_NAME} chars`);
      continue;
    }

    const scopeRaw = typeof r.scope === "string" ? r.scope : "finding";
    if (scopeRaw !== "finding" && scopeRaw !== "scan") {
      pushError(issues, i, `rules[${i}].scope`, "scope must be 'finding' or 'scan'");
      continue;
    }
    const scope = scopeRaw as "finding" | "scan";

    const verdictRaw = typeof r.then === "string" ? r.then : "";
    if (!VALID_VERDICTS.includes(verdictRaw as (typeof VALID_VERDICTS)[number])) {
      pushError(
        issues,
        i,
        `rules[${i}].then`,
        `then must be one of ${VALID_VERDICTS.join(", ")}`
      );
      continue;
    }
    const verdict = verdictRaw as PolicyRule["then"];

    if (!r.when) {
      pushError(issues, i, `rules[${i}].when`, "when is required");
      continue;
    }
    const when = validateCondition(r.when, i, `rules[${i}].when`, scope, issues, 1);
    if (!when) continue;

    const message =
      typeof r.message === "string" && r.message.trim()
        ? r.message.trim().slice(0, MAX_MESSAGE)
        : undefined;
    const enabled = r.enabled === false ? false : true;

    cleaned.push({
      id,
      name,
      scope,
      when,
      then: verdict,
      message,
      enabled,
    });
  }

  const ok = issues.every((i) => i.level !== "error");
  return { ok, issues, rules: ok ? cleaned : [] };
}

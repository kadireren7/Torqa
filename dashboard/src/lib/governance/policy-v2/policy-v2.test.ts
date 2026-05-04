import { describe, expect, it } from "vitest";
import { validatePolicyRules } from "./validate";
import { evaluatePolicyRules } from "./evaluator";
import { strongerVerdict } from "./types";
import type { ScanFinding } from "@/lib/scan-engine";

const FINDING_CRITICAL: ScanFinding = {
  severity: "critical",
  rule_id: "v1.http.tls_verification_disabled",
  target: "node:fetch",
  explanation: "TLS off",
  suggested_fix: "Re-enable TLS",
};

const FINDING_REVIEW: ScanFinding = {
  severity: "review",
  rule_id: "v1.flow.error_strategy_missing",
  target: "wf:root",
  explanation: "missing",
  suggested_fix: "add",
};

const FINDING_PLAINTEXT: ScanFinding = {
  severity: "high",
  rule_id: "v1.secret.plaintext_detected",
  target: "node:set",
  explanation: "leak",
  suggested_fix: "vault",
};

describe("validatePolicyRules", () => {
  it("accepts a minimal valid rule", () => {
    const r = validatePolicyRules([
      {
        id: "r1",
        name: "Block crit",
        scope: "finding",
        when: { field: "severity", op: "eq", value: "critical" },
        then: "block",
      },
    ]);
    expect(r.ok).toBe(true);
    expect(r.rules).toHaveLength(1);
  });

  it("rejects unknown field", () => {
    const r = validatePolicyRules([
      {
        id: "r1",
        name: "x",
        scope: "finding",
        when: { field: "nope", op: "eq", value: "x" },
        then: "block",
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.path.endsWith(".field"))).toBe(true);
  });

  it("rejects scan-only field on finding-scope rule", () => {
    const r = validatePolicyRules([
      {
        id: "r1",
        name: "x",
        scope: "finding",
        when: { field: "risk_score", op: "lt", value: 60 },
        then: "block",
      },
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate ids", () => {
    const r = validatePolicyRules([
      { id: "r1", name: "a", scope: "finding", when: { field: "severity", op: "eq", value: "critical" }, then: "block" },
      { id: "r1", name: "b", scope: "finding", when: { field: "severity", op: "eq", value: "critical" }, then: "block" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /duplicate/.test(i.message))).toBe(true);
  });

  it("validates compound conditions", () => {
    const r = validatePolicyRules([
      {
        id: "r1",
        name: "compound",
        scope: "finding",
        when: {
          all: [
            { field: "severity", op: "in", value: ["critical", "high"] },
            { field: "source", op: "eq", value: "ai-agent" },
          ],
        },
        then: "block",
      },
    ]);
    expect(r.ok).toBe(true);
  });

  it("rejects regex with invalid pattern", () => {
    const r = validatePolicyRules([
      {
        id: "r1",
        name: "bad regex",
        scope: "finding",
        when: { field: "rule_id", op: "regex", value: "(unclosed" },
        then: "block",
      },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("evaluatePolicyRules", () => {
  it("returns default verdict when no rule matches", () => {
    const out = evaluatePolicyRules([], "review", "P", null, {
      findings: [FINDING_CRITICAL],
      riskScore: 100,
      source: "n8n",
    });
    expect(out.verdict).toBe("review");
    expect(out.gateStatus).toBe("WARN");
    expect(out.hits).toHaveLength(0);
  });

  it("blocks when finding rule matches", () => {
    const rules = validatePolicyRules([
      {
        id: "r1",
        name: "Block critical",
        scope: "finding",
        when: { field: "severity", op: "in", value: ["critical", "high"] },
        then: "block",
      },
    ]);
    expect(rules.ok).toBe(true);
    const out = evaluatePolicyRules(rules.rules, "pass", "P", null, {
      findings: [FINDING_CRITICAL, FINDING_REVIEW],
      riskScore: 90,
      source: "n8n",
    });
    expect(out.verdict).toBe("block");
    expect(out.hits).toHaveLength(1);
    expect(out.hits[0].ruleId).toBe("r1");
  });

  it("scan-scope rule reads totals correctly", () => {
    const rules = validatePolicyRules([
      {
        id: "low-trust",
        name: "Low trust",
        scope: "scan",
        when: { field: "risk_score", op: "lt", value: 60 },
        then: "block",
      },
    ]);
    expect(rules.ok).toBe(true);
    const out = evaluatePolicyRules(rules.rules, "pass", "P", null, {
      findings: [FINDING_REVIEW],
      riskScore: 40,
      source: "n8n",
    });
    expect(out.verdict).toBe("block");
    expect(out.hits[0].scope).toBe("scan");
  });

  it("filters out accepted-risk findings", () => {
    const accepted: ScanFinding = {
      ...FINDING_PLAINTEXT,
      accepted_risk: {
        id: "x",
        acceptedAt: new Date().toISOString(),
        expiresAt: null,
        rationale: "test",
      },
    };
    const rules = validatePolicyRules([
      {
        id: "r-secret",
        name: "Block plaintext",
        scope: "finding",
        when: { field: "rule_id", op: "eq", value: "v1.secret.plaintext_detected" },
        then: "block",
      },
    ]);
    expect(rules.ok).toBe(true);
    const out = evaluatePolicyRules(rules.rules, "pass", "P", null, {
      findings: [accepted],
      riskScore: 80,
      source: "n8n",
    });
    expect(out.verdict).toBe("pass");
    expect(out.hits).toHaveLength(0);
  });

  it("strongerVerdict precedence is block > review > pass", () => {
    expect(strongerVerdict("pass", "review")).toBe("review");
    expect(strongerVerdict("review", "block")).toBe("block");
    expect(strongerVerdict("block", "pass")).toBe("block");
    expect(strongerVerdict("pass", "pass")).toBe("pass");
  });

  it("respects enabled=false on rules", () => {
    const rules = validatePolicyRules([
      {
        id: "r1",
        name: "Block crit",
        scope: "finding",
        when: { field: "severity", op: "eq", value: "critical" },
        then: "block",
        enabled: false,
      },
    ]);
    expect(rules.ok).toBe(true);
    const out = evaluatePolicyRules(rules.rules, "pass", "P", null, {
      findings: [FINDING_CRITICAL],
      riskScore: 80,
      source: "n8n",
    });
    expect(out.verdict).toBe("pass");
  });

  it("compound AND condition matches only when all sub-predicates pass", () => {
    const rules = validatePolicyRules([
      {
        id: "agent-crit",
        name: "Agent critical",
        scope: "finding",
        when: {
          all: [
            { field: "source", op: "eq", value: "ai-agent" },
            { field: "severity", op: "eq", value: "critical" },
          ],
        },
        then: "block",
      },
    ]);
    expect(rules.ok).toBe(true);
    const noMatch = evaluatePolicyRules(rules.rules, "pass", "P", null, {
      findings: [FINDING_CRITICAL],
      riskScore: 80,
      source: "n8n",
    });
    expect(noMatch.verdict).toBe("pass");
    const match = evaluatePolicyRules(rules.rules, "pass", "P", null, {
      findings: [FINDING_CRITICAL],
      riskScore: 80,
      source: "ai-agent",
    });
    expect(match.verdict).toBe("block");
  });
});

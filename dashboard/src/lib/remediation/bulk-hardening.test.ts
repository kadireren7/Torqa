import { describe, it, expect } from "vitest";
import { analyzeMcp } from "@/lib/scan/adapters/mcp";
import { riskScoreFromFindings } from "@/lib/scan-engine";
import { selectFindings, mergeOperations, runBulkHardening } from "./bulk-hardening";
import { generateSafeDefaultPlan, FIXABLE_MCP_RULES } from "./safe-defaults";
import type { ScanFinding } from "@/lib/scan-engine";
import type { JsonPatchOperation } from "./patch-types";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const UNSAFE_MCP_CONFIG = {
  serverInfo: { name: "dev-assistant", version: "1.0.0" },
  config: {
    api_key: "sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456",
    database_url: "postgresql://admin:hunter2@prod-db.internal:5432/main",
    openai_token: "sk-live-supersecrettoken9999",
  },
  tools: [
    {
      name: "run_command",
      description: "Runs a shell command on the server",
      inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
    },
    {
      name: "write_file",
      description: "Writes content to a file on the filesystem",
      inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    },
    {
      name: "fetch_url",
      description: "Fetches content from any URL on the internet",
      inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
    {
      name: "query_database",
      description: "Executes a SQL query against the production database",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
    {
      name: "deploy_production",
      description: "Deploys a service to the production environment",
      inputSchema: { type: "object", properties: { service: { type: "string" }, version: { type: "string" } }, required: ["service", "version"] },
    },
    {
      name: "helper_tool",
      description: "Helper",
      inputSchema: { type: "object", properties: {} },
    },
  ],
};

function makeFindings(): ScanFinding[] {
  return analyzeMcp(UNSAFE_MCP_CONFIG);
}

// ─── selectFindings ───────────────────────────────────────────────────────────

describe("selectFindings", () => {
  it("critical_only selects only critical findings", () => {
    const findings = makeFindings();
    const { selected, skipped } = selectFindings(findings, "critical_only");
    expect(selected.every((f) => f.severity === "critical")).toBe(true);
    expect(skipped.length).toBeGreaterThan(0);
  });

  it("critical_and_high selects critical and high findings", () => {
    const findings = makeFindings();
    const { selected, skipped } = selectFindings(findings, "critical_and_high");
    expect(selected.every((f) => f.severity === "critical" || f.severity === "high")).toBe(true);
    const skippedSevs = skipped.map((s) => findings.find((f) => f.rule_id === s.ruleId)?.severity);
    expect(skippedSevs.every((s) => s === "review" || s === "info" || s === undefined)).toBe(true);
  });

  it("all_fixable selects all findings with known fixable rules", () => {
    const findings = makeFindings();
    const { selected } = selectFindings(findings, "all_fixable");
    expect(selected.every((f) => FIXABLE_MCP_RULES.has(f.rule_id))).toBe(true);
  });

  it("skips findings with unknown rule IDs", () => {
    const findings: ScanFinding[] = [
      {
        severity: "critical",
        rule_id: "mcp.some_unknown_rule",
        target: "tools.foo",
        explanation: "test",
        suggested_fix: "test",
      },
    ];
    const { selected, skipped } = selectFindings(findings, "all_fixable");
    expect(selected).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/No automated patch/);
  });
});

// ─── generateSafeDefaultPlan ──────────────────────────────────────────────────

describe("generateSafeDefaultPlan", () => {
  const rules = [
    "mcp.exec_without_allowlist",
    "mcp.unrestricted_filesystem_access",
    "mcp.hardcoded_secret",
    "mcp.overbroad_network_access",
    "mcp.missing_input_validation",
    "mcp.ambiguous_tool_description",
    "mcp.production_deploy_without_confirmation",
    "mcp.database_write_without_scope",
  ] as const;

  for (const ruleId of rules) {
    it(`generates safe defaults for ${ruleId}`, () => {
      const finding: ScanFinding = {
        severity: "critical",
        rule_id: ruleId,
        target: ruleId === "mcp.hardcoded_secret" ? "config.api_key" : "tools.test_tool",
        explanation: "test",
        suggested_fix: "test",
      };
      const plan = generateSafeDefaultPlan(finding);
      expect(plan.findingId).toContain(ruleId);
      expect(plan.ruleId).toBe(ruleId);
      expect(plan.policyDraft).toBeTruthy();
      expect(plan.recommendedChanges.length).toBeGreaterThan(0);
      expect(plan.summary.length).toBeGreaterThan(0);
    });
  }

  it("hardcoded secrets are replaced with env var placeholder", () => {
    const finding: ScanFinding = {
      severity: "critical",
      rule_id: "mcp.hardcoded_secret",
      target: "config.api_key",
      explanation: "test",
      suggested_fix: "test",
    };
    const plan = generateSafeDefaultPlan(finding);
    expect(plan.policyDraft.envVar).toBe("API_KEY");
    expect(plan.policyDraft.action).toBe("replace_with_env_var");
    expect(plan.policyDraft.rotateImmediately).toBe(true);
  });

  it("production deploy plan sets requireConfirmation and allowedBranches", () => {
    const finding: ScanFinding = {
      severity: "critical",
      rule_id: "mcp.production_deploy_without_confirmation",
      target: "tools.deploy_production",
      explanation: "test",
      suggested_fix: "test",
    };
    const plan = generateSafeDefaultPlan(finding);
    expect(plan.policyDraft.requireConfirmation).toBe(true);
    expect(plan.policyDraft.allowedBranches).toContain("main");
    expect(plan.policyDraft.requireCIPassing).toBe(true);
  });

  it("database plan restricts to read operations", () => {
    const finding: ScanFinding = {
      severity: "high",
      rule_id: "mcp.database_write_without_scope",
      target: "tools.query_database",
      explanation: "test",
      suggested_fix: "test",
    };
    const plan = generateSafeDefaultPlan(finding);
    expect(Array.isArray(plan.policyDraft.allowedOperations)).toBe(true);
    expect((plan.policyDraft.allowedOperations as string[])).toContain("read");
    expect(plan.policyDraft.blockedTables).toBeTruthy();
  });
});

// ─── mergeOperations ──────────────────────────────────────────────────────────

describe("mergeOperations", () => {
  function makeOp(path: string, value: unknown, rule = "rule.a"): JsonPatchOperation {
    return {
      op: "add",
      path,
      value,
      reason: "test",
      sourceFindingId: "fid",
      ruleId: rule,
    };
  }

  it("deduplicates identical operations (same path + same value)", () => {
    const op1 = makeOp("/tools/0/readOnly", true);
    const op2 = makeOp("/tools/0/readOnly", true); // duplicate
    const patch1 = { operations: [op1], canPreview: true, warnings: [] as string[] };
    const patch2 = { operations: [op2], canPreview: true, warnings: [] as string[] };

    const { operations } = mergeOperations([patch1, patch2]);
    const pathOps = operations.filter((o) => o.path === "/tools/0/readOnly");
    expect(pathOps).toHaveLength(1);
  });

  it("conflicts produce warning and choose truthy boolean", () => {
    const op1 = makeOp("/tools/0/requiresConfirmation", false, "rule.a");
    const op2 = makeOp("/tools/0/requiresConfirmation", true, "rule.b");
    const patch1 = { operations: [op1], canPreview: true, warnings: [] as string[] };
    const patch2 = { operations: [op2], canPreview: true, warnings: [] as string[] };

    const { operations, warnings } = mergeOperations([patch1, patch2]);
    const found = operations.find((o) => o.path === "/tools/0/requiresConfirmation");
    expect(found?.value).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("array conflicts produce union", () => {
    const op1 = makeOp("/tools/0/blockedCommands", ["sudo", "rm -rf"], "rule.a");
    const op2 = makeOp("/tools/0/blockedCommands", ["curl", "wget"], "rule.b");
    const patch1 = { operations: [op1], canPreview: true, warnings: [] as string[] };
    const patch2 = { operations: [op2], canPreview: true, warnings: [] as string[] };

    const { operations, warnings } = mergeOperations([patch1, patch2]);
    const found = operations.find((o) => o.path === "/tools/0/blockedCommands");
    const val = found?.value as string[];
    expect(val).toContain("sudo");
    expect(val).toContain("curl");
    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ─── runBulkHardening ─────────────────────────────────────────────────────────

describe("runBulkHardening", () => {
  it("does not mutate original config", () => {
    const original = JSON.parse(JSON.stringify(UNSAFE_MCP_CONFIG)) as typeof UNSAFE_MCP_CONFIG;
    const findings = analyzeMcp(original);
    runBulkHardening({ originalConfig: original, findings, mode: "critical_only", safeDefaults: true });
    expect(original.config.api_key).toBe("sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456");
    expect(original.tools[0].name).toBe("run_command");
  });

  it("improves trust score for unsafe MCP sample", () => {
    const findings = makeFindings();
    const beforeScore = riskScoreFromFindings(findings);
    const result = runBulkHardening({
      originalConfig: UNSAFE_MCP_CONFIG,
      findings,
      mode: "critical_and_high",
      safeDefaults: true,
    });
    expect(result.previewResult.afterScore).toBeGreaterThan(beforeScore);
  });

  it("hardened config scan has fewer critical findings than original", () => {
    const findings = makeFindings();
    const originalCriticals = findings.filter((f) => f.severity === "critical").length;
    const result = runBulkHardening({
      originalConfig: UNSAFE_MCP_CONFIG,
      findings,
      mode: "critical_and_high",
      safeDefaults: true,
    });
    const hardenedFindings = analyzeMcp(result.hardenedConfig);
    const hardenedCriticals = hardenedFindings.filter((f) => f.severity === "critical").length;
    expect(hardenedCriticals).toBeLessThan(originalCriticals);
  });

  it("hardcoded secrets are replaced with env placeholder in hardened config", () => {
    const findings = makeFindings();
    const result = runBulkHardening({
      originalConfig: UNSAFE_MCP_CONFIG,
      findings,
      mode: "all_fixable",
      safeDefaults: true,
    });
    const hc = result.hardenedConfig as typeof UNSAFE_MCP_CONFIG;
    // At least one secret should be replaced with an env var reference
    const configVals = Object.values(hc.config ?? {});
    const anyReplaced = configVals.some((v) => typeof v === "string" && v.startsWith("$"));
    expect(anyReplaced).toBe(true);
  });

  it("returns resolved findings in preview result", () => {
    const findings = makeFindings();
    const result = runBulkHardening({
      originalConfig: UNSAFE_MCP_CONFIG,
      findings,
      mode: "critical_and_high",
      safeDefaults: true,
    });
    expect(result.previewResult.resolvedFindingIds.length).toBeGreaterThan(0);
  });

  it("create PR is not implemented (no pr-related fields in result)", () => {
    const findings = makeFindings();
    const result = runBulkHardening({
      originalConfig: UNSAFE_MCP_CONFIG,
      findings,
      mode: "critical_only",
      safeDefaults: true,
    });
    // BulkHardeningResult has no pr or github fields
    expect((result as Record<string, unknown>).pr).toBeUndefined();
    expect((result as Record<string, unknown>).githubPr).toBeUndefined();
  });

  it("all_fixable processes more findings than critical_only", () => {
    const findings = makeFindings();
    const r1 = runBulkHardening({ originalConfig: UNSAFE_MCP_CONFIG, findings, mode: "critical_only", safeDefaults: true });
    const r2 = runBulkHardening({ originalConfig: UNSAFE_MCP_CONFIG, findings, mode: "all_fixable", safeDefaults: true });
    expect(r2.selectedFindings.length).toBeGreaterThanOrEqual(r1.selectedFindings.length);
  });

  it("returns operation groups for each processed finding", () => {
    const findings = makeFindings();
    const result = runBulkHardening({
      originalConfig: UNSAFE_MCP_CONFIG,
      findings,
      mode: "critical_and_high",
      safeDefaults: true,
    });
    expect(result.operationGroups.length).toBeGreaterThan(0);
    for (const g of result.operationGroups) {
      expect(["auto-applied safe default", "needs manual refinement", "cannot be safely auto-fixed"]).toContain(g.label);
    }
  });
});

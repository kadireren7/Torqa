import { describe, it, expect } from "vitest";
import { getQuestionsForRule, getAllSupportedRuleIds } from "./questions";
import { generateRemediationPlan } from "./plan-generator";
import type { RemediationAnswer } from "./types";

const MCP_RULES = [
  "mcp.exec_without_allowlist",
  "mcp.unrestricted_filesystem_access",
  "mcp.hardcoded_secret",
  "mcp.overbroad_network_access",
  "mcp.missing_input_validation",
  "mcp.ambiguous_tool_description",
  "mcp.production_deploy_without_confirmation",
  "mcp.database_write_without_scope",
];

describe("Remediation question templates", () => {
  it("has templates for all 8 MCP rules", () => {
    const supported = getAllSupportedRuleIds();
    for (const rule of MCP_RULES) {
      expect(supported).toContain(rule);
    }
  });

  it("each rule has 2–5 questions", () => {
    for (const rule of MCP_RULES) {
      const qs = getQuestionsForRule(rule);
      expect(qs.length).toBeGreaterThanOrEqual(2);
      expect(qs.length).toBeLessThanOrEqual(5);
    }
  });

  it("falls back to default questions for unknown rule", () => {
    const qs = getQuestionsForRule("mcp.unknown_rule_xyz");
    expect(qs.length).toBeGreaterThan(0);
  });

  it("every question has id, label, type, required", () => {
    for (const rule of MCP_RULES) {
      const qs = getQuestionsForRule(rule);
      for (const q of qs) {
        expect(typeof q.id).toBe("string");
        expect(typeof q.label).toBe("string");
        expect(["boolean", "text", "multiselect", "select"]).toContain(q.type);
        expect(typeof q.required).toBe("boolean");
      }
    }
  });

  it("select/multiselect questions have options array", () => {
    for (const rule of MCP_RULES) {
      const qs = getQuestionsForRule(rule);
      for (const q of qs) {
        if (q.type === "select" || q.type === "multiselect") {
          expect(Array.isArray(q.options)).toBe(true);
          expect((q.options ?? []).length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("exec_without_allowlist plan generation", () => {
  it("produces allowlist policy when commands provided", () => {
    const answers: RemediationAnswer[] = [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "npm test, npm run build" },
      { questionId: "require_confirmation", value: true },
      { questionId: "environment", value: "local-only" },
    ];
    const plan = generateRemediationPlan("f1", "mcp.exec_without_allowlist", "tools.run_command", answers);
    expect(plan.policyDraft.allowedCommands).toContain("npm test");
    expect(plan.policyDraft.requiresConfirmation).toBe(true);
    expect(plan.policyDraft.environment).toBe("local-only");
    expect(plan.confidence).toBe("high");
    expect(plan.needsHumanReview).toBe(false);
  });

  it("recommends removal when exec is not allowed", () => {
    const answers: RemediationAnswer[] = [
      { questionId: "allow_exec", value: false },
    ];
    const plan = generateRemediationPlan("f1", "mcp.exec_without_allowlist", "tools.run_command", answers);
    expect(plan.policyDraft.action).toBe("remove_tool");
    expect(plan.recommendedChanges[0]).toMatch(/[Rr]emove/);
  });

  it("needsHumanReview true when no commands specified", () => {
    const answers: RemediationAnswer[] = [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "" },
    ];
    const plan = generateRemediationPlan("f1", "mcp.exec_without_allowlist", "tools.run_command", answers);
    expect(plan.needsHumanReview).toBe(true);
  });
});

describe("hardcoded_secret plan generation", () => {
  it("produces env-var based recommendation", () => {
    const answers: RemediationAnswer[] = [
      { questionId: "move_to_env", value: true },
      { questionId: "env_var_name", value: "API_KEY" },
      { questionId: "rotate_secret", value: false },
      { questionId: "block_in_ci", value: true },
    ];
    const plan = generateRemediationPlan("f2", "mcp.hardcoded_secret", "config.api_key", answers);
    expect(plan.policyDraft.envVar).toBe("API_KEY");
    expect(plan.policyDraft.action).toBe("replace_with_env_var");
    expect(plan.policyDraft.blockInCI).toBe(true);
    expect(plan.confidence).toBe("high");
  });

  it("needsHumanReview true when rotation required", () => {
    const answers: RemediationAnswer[] = [
      { questionId: "move_to_env", value: true },
      { questionId: "rotate_secret", value: true },
    ];
    const plan = generateRemediationPlan("f2", "mcp.hardcoded_secret", "config.api_key", answers);
    expect(plan.needsHumanReview).toBe(true);
  });
});

describe("database_write_without_scope plan generation", () => {
  it("produces scoped operation/table policy", () => {
    const answers: RemediationAnswer[] = [
      { questionId: "allowed_tables", value: "products, orders" },
      { questionId: "allowed_operations", value: ["read", "insert"] },
      { questionId: "confirm_destructive", value: true },
      { questionId: "block_user_tables", value: true },
    ];
    const plan = generateRemediationPlan(
      "f3", "mcp.database_write_without_scope", "tools.query_database", answers
    );
    expect(plan.policyDraft.allowedTables).toContain("products");
    expect(plan.policyDraft.allowedOperations).toContain("read");
    expect(plan.policyDraft.requireConfirmationForDestructive).toBe(true);
    expect((plan.policyDraft.blockedTables as string[])).toContain("users");
    expect(plan.confidence).toBe("high");
    expect(plan.needsHumanReview).toBe(false);
  });
});

describe("missing answers produce needsHumanReview true and low confidence", () => {
  it("exec_without_allowlist with empty answers", () => {
    const plan = generateRemediationPlan("f1", "mcp.exec_without_allowlist", "tools.run_command", []);
    expect(plan.needsHumanReview).toBe(true);
    expect(plan.confidence).toBe("low");
  });

  it("missing_input_validation with empty answers", () => {
    const plan = generateRemediationPlan("f4", "mcp.missing_input_validation", "tools.helper_tool", []);
    expect(plan.needsHumanReview).toBe(true);
  });

  it("database_write_without_scope with empty answers", () => {
    const plan = generateRemediationPlan("f3", "mcp.database_write_without_scope", "tools.query_database", []);
    expect(plan.needsHumanReview).toBe(true);
    expect(plan.confidence).toBe("low");
  });

  it("hardcoded_secret with empty answers still generates a plan", () => {
    const plan = generateRemediationPlan("f2", "mcp.hardcoded_secret", "config.api_key", []);
    expect(typeof plan.summary).toBe("string");
    expect(plan.summary.length).toBeGreaterThan(0);
  });
});

describe("plan output structure", () => {
  it("every plan has required fields", () => {
    for (const rule of MCP_RULES) {
      const plan = generateRemediationPlan("fx", rule, "tools.some_tool", []);
      expect(typeof plan.findingId).toBe("string");
      expect(typeof plan.ruleId).toBe("string");
      expect(typeof plan.target).toBe("string");
      expect(typeof plan.summary).toBe("string");
      expect(Array.isArray(plan.recommendedChanges)).toBe(true);
      expect(typeof plan.policyDraft).toBe("object");
      expect(["low", "medium", "high"]).toContain(plan.confidence);
      expect(typeof plan.needsHumanReview).toBe("boolean");
      expect(["generate_patch_planned", "manual_review", "ready_for_policy_generation"]).toContain(
        plan.nextStep
      );
    }
  });
});

import { describe, it, expect } from "vitest";
import { generatePatch } from "./patch-generator";
import { previewPatch } from "./patch-preview";
import { generateRemediationPlan } from "./plan-generator";
import type { RemediationAnswer } from "./types";

// ─── Shared MCP config fixture ────────────────────────────────────────────────

const UNSAFE_MCP_CONFIG = {
  serverInfo: { name: "dev-assistant", version: "1.0.0" },
  config: {
    api_key: "sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456",
    database_url: "postgresql://admin:hunter2@prod-db.internal:5432/main",
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
      description: "Helper tool that manages things",
      inputSchema: { type: "object", properties: {} },
    },
  ],
};

function plan(
  ruleId: string,
  target: string,
  answers: RemediationAnswer[]
) {
  return generateRemediationPlan(`${ruleId}:${target}`, ruleId, target, answers);
}

// ─── Patch generator tests ────────────────────────────────────────────────────

describe("patch-generator — exec_without_allowlist", () => {
  it("generates allowedCommands + requiresConfirmation operations", () => {
    const p = plan("mcp.exec_without_allowlist", "tools.run_command", [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "npm test, npm run build" },
      { questionId: "require_confirmation", value: true },
      { questionId: "environment", value: "local-only" },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    expect(patch.warnings).toHaveLength(0);
    const paths = patch.operations.map((o) => o.path);
    expect(paths.some((p) => p.includes("allowedCommands"))).toBe(true);
    expect(paths.some((p) => p.includes("requiresConfirmation"))).toBe(true);
    const allowedOp = patch.operations.find((o) => o.path.includes("allowedCommands"));
    expect(Array.isArray(allowedOp?.value)).toBe(true);
    expect((allowedOp?.value as string[]).includes("npm test")).toBe(true);
  });

  it("generates remove op when exec is not allowed", () => {
    const p = plan("mcp.exec_without_allowlist", "tools.run_command", [
      { questionId: "allow_exec", value: false },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.operations[0].op).toBe("remove");
    expect(patch.operations[0].path).toBe("/tools/0");
  });

  it("returns canPreview=false when tool not found", () => {
    const p = plan("mcp.exec_without_allowlist", "tools.nonexistent_tool", [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "npm test" },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(false);
    expect(patch.warnings.length).toBeGreaterThan(0);
  });
});

describe("patch-generator — unrestricted_filesystem_access", () => {
  it("generates allowedPaths + readOnly + deniedPaths operations", () => {
    const p = plan("mcp.unrestricted_filesystem_access", "tools.write_file", [
      { questionId: "access_mode", value: "read-only" },
      { questionId: "allowed_paths", value: "/app, ./project" },
      { questionId: "denied_paths", value: "/etc, ~/.ssh" },
      { questionId: "sandbox_to_project", value: true },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const paths = patch.operations.map((o) => o.path);
    expect(paths.some((p) => p.includes("readOnly"))).toBe(true);
    expect(paths.some((p) => p.includes("allowedPaths"))).toBe(true);
    expect(paths.some((p) => p.includes("deniedPaths"))).toBe(true);
  });
});

describe("patch-generator — hardcoded_secret", () => {
  it("replaces literal secret with env var reference", () => {
    const p = plan("mcp.hardcoded_secret", "config.api_key", [
      { questionId: "move_to_env", value: true },
      { questionId: "env_var_name", value: "API_KEY" },
      { questionId: "rotate_secret", value: false },
      { questionId: "block_in_ci", value: true },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const replaceOp = patch.operations.find((o) => o.op === "replace");
    expect(replaceOp).toBeDefined();
    expect(replaceOp?.path).toBe("/config/api_key");
    expect(replaceOp?.value).toBe("$API_KEY");
    // before should show the original secret
    expect(typeof replaceOp?.before).toBe("string");
  });

  it("adds rotate warning when rotation required", () => {
    const p = plan("mcp.hardcoded_secret", "config.api_key", [
      { questionId: "move_to_env", value: true },
      { questionId: "env_var_name", value: "API_KEY" },
      { questionId: "rotate_secret", value: true },
      { questionId: "block_in_ci", value: false },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.warnings.some((w) => w.toLowerCase().includes("rotat"))).toBe(true);
  });

  it("canPreview=false when secret path not found", () => {
    const p = plan("mcp.hardcoded_secret", "config.nonexistent_field", [
      { questionId: "move_to_env", value: true },
      { questionId: "env_var_name", value: "MY_SECRET" },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(false);
  });
});

describe("patch-generator — overbroad_network_access", () => {
  it("generates allowedDomains + blockInternalIPs operations", () => {
    const p = plan("mcp.overbroad_network_access", "tools.fetch_url", [
      { questionId: "allowed_domains", value: "api.example.com, cdn.example.com" },
      { questionId: "block_arbitrary_urls", value: true },
      { questionId: "require_user_approval", value: false },
      { questionId: "block_internal_ips", value: true },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const paths = patch.operations.map((o) => o.path);
    expect(paths.some((p) => p.includes("allowedDomains"))).toBe(true);
    expect(paths.some((p) => p.includes("blockInternalIPs"))).toBe(true);
    const domainsOp = patch.operations.find((o) => o.path.includes("allowedDomains"));
    expect((domainsOp?.value as string[]).includes("api.example.com")).toBe(true);
  });
});

describe("patch-generator — missing_input_validation", () => {
  it("generates inputSchema replace operation", () => {
    const p = plan("mcp.missing_input_validation", "tools.helper_tool", [
      { questionId: "accepted_fields", value: "name, action" },
      { questionId: "required_fields", value: "action" },
      { questionId: "add_length_constraints", value: true },
      { questionId: "use_enums_or_patterns", value: false },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const schemaOp = patch.operations.find((o) => o.path.includes("inputSchema"));
    expect(schemaOp).toBeDefined();
    const schema = schemaOp?.value as Record<string, unknown>;
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
  });
});

describe("patch-generator — ambiguous_tool_description", () => {
  it("replaces description with clear text", () => {
    const p = plan("mcp.ambiguous_tool_description", "tools.helper_tool", [
      { questionId: "clear_description", value: "Manages environment configuration for the current workspace only." },
      { questionId: "never_do", value: "Never modifies production settings." },
      { questionId: "mention_permissions", value: true },
      { questionId: "mention_confirmation", value: false },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const descOp = patch.operations.find((o) => o.path.includes("description"));
    expect(descOp?.op).toBe("replace");
    expect(typeof descOp?.value).toBe("string");
    expect((descOp?.value as string).length).toBeGreaterThan(20);
  });

  it("canPreview=false when no description provided", () => {
    const p = plan("mcp.ambiguous_tool_description", "tools.helper_tool", [
      { questionId: "clear_description", value: "" },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(false);
  });
});

describe("patch-generator — production_deploy_without_confirmation", () => {
  it("generates requiresConfirmation + approvers operations", () => {
    const p = plan("mcp.production_deploy_without_confirmation", "tools.deploy_production", [
      { questionId: "require_confirmation", value: true },
      { questionId: "approvers", value: "ops, lead-engineer" },
      { questionId: "allowed_branches", value: "main, release/*" },
      { questionId: "require_ci", value: true },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const paths = patch.operations.map((o) => o.path);
    expect(paths.some((p) => p.includes("requiresConfirmation"))).toBe(true);
    expect(paths.some((p) => p.includes("approvers"))).toBe(true);
    expect(paths.some((p) => p.includes("allowedBranches"))).toBe(true);
    expect(paths.some((p) => p.includes("requireCIPassing"))).toBe(true);
  });
});

describe("patch-generator — database_write_without_scope", () => {
  it("generates allowedTables + allowedOperations + blockedTables", () => {
    const p = plan("mcp.database_write_without_scope", "tools.query_database", [
      { questionId: "allowed_tables", value: "products, orders, logs" },
      { questionId: "allowed_operations", value: ["read", "insert"] },
      { questionId: "confirm_destructive", value: true },
      { questionId: "block_user_tables", value: true },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const paths = patch.operations.map((o) => o.path);
    expect(paths.some((p) => p.includes("allowedTables"))).toBe(true);
    expect(paths.some((p) => p.includes("allowedOperations"))).toBe(true);
    expect(paths.some((p) => p.includes("blockedTables"))).toBe(true);
    expect(paths.some((p) => p.includes("requireConfirmationForDelete"))).toBe(true);
    const tablesOp = patch.operations.find((o) => o.path.includes("allowedTables"));
    expect((tablesOp?.value as string[]).includes("products")).toBe(true);
  });
});

// ─── Preview verification tests ───────────────────────────────────────────────

describe("preview verification — improves score on exec rule", () => {
  it("reduces critical findings after patching exec tool", () => {
    const p = plan("mcp.exec_without_allowlist", "tools.run_command", [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "npm test, npm run build" },
      { questionId: "require_confirmation", value: true },
      { questionId: "environment", value: "local-only" },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(true);
    const result = previewPatch(UNSAFE_MCP_CONFIG, patch);
    expect(result.afterScore).toBeGreaterThanOrEqual(result.beforeScore);
    expect(result.resolvedFindingIds.some((k) => k.includes("exec_without_allowlist"))).toBe(true);
  });
});

describe("preview verification — improves score on deploy rule", () => {
  it("resolves production_deploy_without_confirmation after patch", () => {
    const p = plan("mcp.production_deploy_without_confirmation", "tools.deploy_production", [
      { questionId: "require_confirmation", value: true },
      { questionId: "approvers", value: "ops" },
      { questionId: "allowed_branches", value: "main" },
      { questionId: "require_ci", value: true },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    const result = previewPatch(UNSAFE_MCP_CONFIG, patch);
    expect(result.afterScore).toBeGreaterThanOrEqual(result.beforeScore);
    expect(result.resolvedFindingIds.some((k) => k.includes("production_deploy"))).toBe(true);
  });
});

describe("preview verification — score comparison", () => {
  it("beforeScore matches direct analyzer output", () => {
    const p = plan("mcp.exec_without_allowlist", "tools.run_command", [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "npm test" },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    const result = previewPatch(UNSAFE_MCP_CONFIG, patch);
    expect(result.beforeScore).toBeLessThan(60); // unsafe sample is FAIL
    expect(result.beforeDecision).toBe("FAIL");
  });

  it("appliedConfig is a deep clone, not the original", () => {
    const p = plan("mcp.exec_without_allowlist", "tools.run_command", [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "npm test" },
      { questionId: "require_confirmation", value: true },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    const result = previewPatch(UNSAFE_MCP_CONFIG, patch);
    // Original must be unchanged
    const originalTools = (UNSAFE_MCP_CONFIG as Record<string, unknown>).tools as Record<string, unknown>[];
    expect(originalTools[0].allowedCommands).toBeUndefined();
    // Applied clone should have the new property
    const appliedTools = (result.appliedConfig as Record<string, unknown>).tools as Record<string, unknown>[];
    expect(appliedTools[0].allowedCommands).toBeDefined();
  });
});

describe("preview verification — unresolved target", () => {
  it("produces canPreview=false warning for unknown tool", () => {
    const p = plan("mcp.exec_without_allowlist", "tools.nonexistent_tool", [
      { questionId: "allow_exec", value: true },
      { questionId: "allowed_commands", value: "npm test" },
    ]);
    const patch = generatePatch(p, UNSAFE_MCP_CONFIG);
    expect(patch.canPreview).toBe(false);
    expect(patch.warnings.length).toBeGreaterThan(0);
  });
});

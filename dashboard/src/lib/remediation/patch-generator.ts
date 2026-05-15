/**
 * Deterministic MCP patch generator.
 *
 * Converts a RemediationPlan + original MCP config into RFC6902-style JSON
 * Patch operations that can be previewed in-memory or exported as JSON.
 *
 * Rules: all 8 MCP rules. No LLM calls, no external APIs.
 */

import { readJsonPointer } from "@/lib/governance/json-patch";
import type { RemediationPlan } from "./types";
import type { GeneratedPatch, JsonPatchOperation } from "./patch-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Parse "tools.run_command" → "run_command". Returns null if not a tool target. */
function resolveToolName(target: string): string | null {
  const m = /^tools\.([^\s.[\]]+)/.exec(target);
  return m ? m[1] : null;
}

/** Find the index of a tool by name in content.tools[]. Returns -1 if not found. */
function findToolIndex(content: unknown, toolName: string): number {
  if (!isRecord(content)) return -1;
  const tools = Array.isArray(content.tools) ? content.tools : [];
  return tools.findIndex((t) => isRecord(t) && t.name === toolName);
}

/**
 * Convert a dotted / bracket-notation path to an RFC6902 JSON Pointer.
 *   "config.api_key"    → "/config/api_key"
 *   "tools[0].password" → "/tools/0/password"
 */
function targetToPointer(target: string): string {
  const normalized = target.replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").map((seg) =>
    seg.replace(/~/g, "~0").replace(/\//g, "~1")
  );
  return "/" + segments.join("/");
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function op(
  opType: "add" | "replace" | "remove",
  path: string,
  value: unknown,
  reason: string,
  findingId: string,
  ruleId: string,
  content: unknown
): JsonPatchOperation {
  const before = opType !== "add"
    ? safeRead(content, path)
    : safeRead(content, path); // read anyway for display even on add
  const base: JsonPatchOperation = {
    op: opType,
    path,
    reason,
    sourceFindingId: findingId,
    ruleId,
    before,
  };
  if (opType !== "remove") {
    base.value = value;
  }
  return base;
}

function safeRead(content: unknown, path: string): unknown {
  try {
    return readJsonPointer(content, path);
  } catch {
    return undefined;
  }
}

// ─── Rule-specific patch builders ─────────────────────────────────────────────

type PatchResult = {
  operations: JsonPatchOperation[];
  warnings: string[];
  canPreview: boolean;
};

function unresolvedTool(toolName: string | null): PatchResult {
  const warn = toolName
    ? `Tool "${toolName}" not found in config tools array. Patch cannot be applied automatically.`
    : "Cannot resolve tool name from finding target. Manual patch required.";
  return { operations: [], warnings: [warn], canPreview: false };
}

function patchExec(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const toolName = resolveToolName(plan.target);
  if (!toolName) return unresolvedTool(null);
  const idx = findToolIndex(content, toolName);
  if (idx < 0) return unresolvedTool(toolName);

  const pd = plan.policyDraft;
  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  if (pd.action === "remove_tool") {
    ops.push(op("remove", `/tools/${idx}`, undefined, "Remove unsafe shell execution tool.", findingId, plan.ruleId, content));
  } else {
    if (Array.isArray(pd.allowedCommands) && pd.allowedCommands.length > 0) {
      ops.push(op("add", `/tools/${idx}/allowedCommands`, pd.allowedCommands,
        "Restrict executable commands to an explicit allowlist.", findingId, plan.ruleId, content));
      ops.push(op("add", `/tools/${idx}/blockedCommands`,
        ["rm -rf", "sudo", "curl", "ssh", "wget", "chmod 777"],
        "Block known-dangerous commands regardless of allowlist.", findingId, plan.ruleId, content));
    } else {
      warnings.push("No specific commands were provided. Add an allowedCommands list manually before applying.");
    }
    if (pd.requiresConfirmation === true) {
      ops.push(op("add", `/tools/${idx}/requiresConfirmation`, true,
        "Require user confirmation before executing any command.", findingId, plan.ruleId, content));
    }
    if (typeof pd.environment === "string") {
      ops.push(op("add", `/tools/${idx}/environment`, pd.environment,
        `Restrict execution to ${pd.environment} environment.`, findingId, plan.ruleId, content));
    }
  }

  return { operations: ops, warnings, canPreview: ops.length > 0 };
}

function patchFilesystem(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const toolName = resolveToolName(plan.target);
  if (!toolName) return unresolvedTool(null);
  const idx = findToolIndex(content, toolName);
  if (idx < 0) return unresolvedTool(toolName);

  const pd = plan.policyDraft;
  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  if (pd.readOnly === true) {
    ops.push(op("add", `/tools/${idx}/readOnly`, true,
      "Mark tool as read-only to prevent file writes.", findingId, plan.ruleId, content));
  }

  if (Array.isArray(pd.allowedPaths) && pd.allowedPaths.length > 0) {
    ops.push(op("add", `/tools/${idx}/allowedPaths`, pd.allowedPaths,
      "Restrict filesystem access to explicit allowed paths.", findingId, plan.ruleId, content));
  } else if (pd.sandbox === "project-directory") {
    ops.push(op("add", `/tools/${idx}/sandbox`, "project-directory",
      "Sandbox tool to the current project working directory.", findingId, plan.ruleId, content));
  } else {
    warnings.push("No allowed paths specified. Add allowedPaths or enable sandbox mode manually.");
  }

  const deniedPaths = Array.isArray(pd.deniedPaths)
    ? pd.deniedPaths
    : ["/etc", "~/.ssh", "/root", "/proc", "/sys"];
  ops.push(op("add", `/tools/${idx}/deniedPaths`, deniedPaths,
    "Block access to sensitive system paths.", findingId, plan.ruleId, content));

  return { operations: ops, warnings, canPreview: true };
}

function patchSecret(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const pd = plan.policyDraft;
  const targetPath = typeof pd.target === "string" ? pd.target : plan.target;
  const pointer = targetToPointer(targetPath);
  const envVar = typeof pd.envVar === "string" ? pd.envVar : "SECRET_VALUE";
  const envRef = `$${envVar}`;

  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  // Check the value exists at the path
  const existing = safeRead(content, pointer);
  if (existing === undefined) {
    warnings.push(`Secret path "${targetPath}" not found in config. Verify the path and apply the replacement manually.`);
    return { operations: ops, warnings, canPreview: false };
  }

  ops.push(op("replace", pointer, envRef,
    `Replace hardcoded secret with environment variable reference $${envVar}.`, findingId, plan.ruleId, content));

  if (pd.rotateImmediately === true) {
    warnings.push("Rotate the secret immediately — it may have been exposed in logs or version control.");
  }
  if (pd.blockInCI === true) {
    warnings.push("Add a pre-commit hook or CI secret scanning step to detect this pattern in future commits.");
  }

  return { operations: ops, warnings, canPreview: true };
}

function patchNetwork(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const toolName = resolveToolName(plan.target);
  if (!toolName) return unresolvedTool(null);
  const idx = findToolIndex(content, toolName);
  if (idx < 0) return unresolvedTool(toolName);

  const pd = plan.policyDraft;
  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  if (Array.isArray(pd.allowedDomains) && pd.allowedDomains.length > 0) {
    ops.push(op("add", `/tools/${idx}/allowedDomains`, pd.allowedDomains,
      "Restrict network access to an explicit domain allowlist.", findingId, plan.ruleId, content));
    ops.push(op("add", `/tools/${idx}/blockedDomains`, [],
      "Initialize blocked domains list — extend as needed.", findingId, plan.ruleId, content));
  } else {
    warnings.push("No allowed domains specified. Define allowedDomains before applying this patch.");
  }

  if (pd.requiresConfirmation === true) {
    ops.push(op("add", `/tools/${idx}/requiresConfirmationForExternalRequests`, true,
      "Require user approval before making external network requests.", findingId, plan.ruleId, content));
  }

  if (pd.blockInternalIPs === true) {
    ops.push(op("add", `/tools/${idx}/blockInternalIPs`, true,
      "Block requests to localhost and RFC1918 ranges to prevent SSRF.", findingId, plan.ruleId, content));
    ops.push(op("add", `/tools/${idx}/blockedRanges`,
      ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
      "Block all private/loopback IP ranges.", findingId, plan.ruleId, content));
  }

  return { operations: ops, warnings, canPreview: ops.length > 0 };
}

function patchInputValidation(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const toolName = resolveToolName(plan.target);
  if (!toolName) return unresolvedTool(null);
  const idx = findToolIndex(content, toolName);
  if (idx < 0) return unresolvedTool(toolName);

  const pd = plan.policyDraft;
  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  const schema = pd.inputSchema;
  if (isRecord(schema) && typeof schema.type === "string") {
    ops.push(op("replace", `/tools/${idx}/inputSchema`, schema,
      "Replace empty/missing inputSchema with typed schema including required fields and constraints.",
      findingId, plan.ruleId, content));
  } else {
    // Build a minimal schema
    const minimalSchema = {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    };
    ops.push(op("add", `/tools/${idx}/inputSchema`, minimalSchema,
      "Add minimal typed inputSchema. Extend properties based on actual tool requirements.",
      findingId, plan.ruleId, content));
    warnings.push("No field definitions were provided. The generated schema is a skeleton — add typed properties before deploying.");
  }

  return { operations: ops, warnings, canPreview: true };
}

function patchDescription(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const toolName = resolveToolName(plan.target);
  if (!toolName) return unresolvedTool(null);
  const idx = findToolIndex(content, toolName);
  if (idx < 0) return unresolvedTool(toolName);

  const pd = plan.policyDraft;
  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  if (typeof pd.description === "string" && pd.description.trim()) {
    ops.push(op("replace", `/tools/${idx}/description`, pd.description.trim(),
      "Replace vague description with a specific, actionable description.", findingId, plan.ruleId, content));
    // Add security boundaries note
    ops.push(op("add", `/tools/${idx}/securityBoundaries`,
      { permissionBoundary: "explicit grant only", confirmationRequired: false },
      "Document tool security boundaries for agent trust evaluation.", findingId, plan.ruleId, content));
  } else {
    warnings.push("No description text was provided. Provide a clear description before applying this patch.");
    return { operations: ops, warnings, canPreview: false };
  }

  return { operations: ops, warnings, canPreview: true };
}

function patchDeploy(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const toolName = resolveToolName(plan.target);
  if (!toolName) return unresolvedTool(null);
  const idx = findToolIndex(content, toolName);
  if (idx < 0) return unresolvedTool(toolName);

  const pd = plan.policyDraft;
  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  ops.push(op("add", `/tools/${idx}/requiresConfirmation`, pd.requireConfirmation ?? true,
    "Require explicit confirmation before any production deployment.", findingId, plan.ruleId, content));

  if (Array.isArray(pd.approvers) && pd.approvers.length > 0) {
    ops.push(op("add", `/tools/${idx}/approvers`, pd.approvers,
      "Define approved roles for production deploy authorization.", findingId, plan.ruleId, content));
  } else {
    warnings.push("No approvers defined. Specify at least one approver role before deploying to production.");
  }

  if (Array.isArray(pd.allowedBranches) && pd.allowedBranches.length > 0) {
    ops.push(op("add", `/tools/${idx}/allowedBranches`, pd.allowedBranches,
      "Restrict deploys to authorized branches only.", findingId, plan.ruleId, content));
  }

  if (pd.requireCIPassing === true) {
    ops.push(op("add", `/tools/${idx}/requireCIPassing`, true,
      "Block deploys when CI is failing.", findingId, plan.ruleId, content));
  }

  return { operations: ops, warnings, canPreview: true };
}

function patchDatabase(plan: RemediationPlan, findingId: string, content: unknown): PatchResult {
  const toolName = resolveToolName(plan.target);
  if (!toolName) return unresolvedTool(null);
  const idx = findToolIndex(content, toolName);
  if (idx < 0) return unresolvedTool(toolName);

  const pd = plan.policyDraft;
  const ops: JsonPatchOperation[] = [];
  const warnings: string[] = [];

  if (Array.isArray(pd.allowedTables) && pd.allowedTables.length > 0) {
    ops.push(op("add", `/tools/${idx}/allowedTables`, pd.allowedTables,
      "Restrict database access to explicit table allowlist.", findingId, plan.ruleId, content));
  } else {
    warnings.push("No table allowlist provided. Add allowedTables before applying this patch.");
  }

  if (Array.isArray(pd.allowedOperations) && pd.allowedOperations.length > 0) {
    ops.push(op("add", `/tools/${idx}/allowedOperations`, pd.allowedOperations,
      "Restrict SQL operations to explicit allowlist.", findingId, plan.ruleId, content));

    const isReadOnly = !pd.allowedOperations.includes("delete") && !pd.allowedOperations.includes("update");
    if (isReadOnly) {
      ops.push(op("add", `/tools/${idx}/readOnly`, true,
        "Mark as read-only since only SELECT operations are allowed.", findingId, plan.ruleId, content));
    }
  }

  if (pd.requireConfirmationForDestructive === true) {
    ops.push(op("add", `/tools/${idx}/requireConfirmationForDelete`, true,
      "Require confirmation before any destructive database operation.", findingId, plan.ruleId, content));
  }

  if (Array.isArray(pd.blockedTables) && pd.blockedTables.length > 0) {
    ops.push(op("add", `/tools/${idx}/blockedTables`, pd.blockedTables,
      "Block access to sensitive user/customer tables.", findingId, plan.ruleId, content));
  }

  return { operations: ops, warnings, canPreview: ops.length > 0 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generatePatch(
  plan: RemediationPlan,
  originalContent: unknown
): GeneratedPatch {
  const findingId = plan.findingId;
  const ruleId = plan.ruleId;

  let result: PatchResult;

  switch (ruleId) {
    case "mcp.exec_without_allowlist":
      result = patchExec(plan, findingId, originalContent);
      break;
    case "mcp.unrestricted_filesystem_access":
      result = patchFilesystem(plan, findingId, originalContent);
      break;
    case "mcp.hardcoded_secret":
      result = patchSecret(plan, findingId, originalContent);
      break;
    case "mcp.overbroad_network_access":
      result = patchNetwork(plan, findingId, originalContent);
      break;
    case "mcp.missing_input_validation":
      result = patchInputValidation(plan, findingId, originalContent);
      break;
    case "mcp.ambiguous_tool_description":
      result = patchDescription(plan, findingId, originalContent);
      break;
    case "mcp.production_deploy_without_confirmation":
      result = patchDeploy(plan, findingId, originalContent);
      break;
    case "mcp.database_write_without_scope":
      result = patchDatabase(plan, findingId, originalContent);
      break;
    default:
      result = {
        operations: [],
        warnings: [`No patch template for rule "${ruleId}". Apply the plan changes manually.`],
        canPreview: false,
      };
  }

  return {
    id: uid(),
    findingId,
    ruleId,
    target: plan.target,
    createdAt: new Date().toISOString(),
    operations: result.operations,
    policyDraft: plan.policyDraft,
    summary: plan.summary,
    warnings: result.warnings,
    canPreview: result.canPreview,
  };
}

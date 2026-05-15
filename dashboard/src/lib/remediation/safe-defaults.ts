/**
 * Deterministic safe-default remediation plans for all 8 MCP rules.
 *
 * These plans are generated without user input — they apply the most
 * conservative, security-positive defaults available. All plans are
 * flagged needsHumanReview: true and should be treated as a starting
 * point, not a complete fix.
 *
 * No LLM calls. No external APIs. Pure deterministic logic.
 */

import type { ScanFinding } from "@/lib/scan-engine";
import type { RemediationPlan } from "./types";

// ─── Shared safe constants ────────────────────────────────────────────────────

export const SAFE_BLOCKED_COMMANDS = [
  "rm -rf", "sudo", "curl", "wget", "ssh", "scp", "chmod", "chown",
  "mkfs", "dd", "shred", "kill", "pkill",
];

export const SAFE_DENIED_PATHS = [
  "/", "~/.ssh", "~/.aws", "~/.config", ".env", ".env.local",
  "/etc", "/root", "/proc", "/sys", "/boot", "/dev",
];

export const SAFE_BLOCKED_TABLES = [
  "users", "accounts", "customers", "sessions", "tokens", "payments",
  "credentials", "secrets", "api_keys",
];

export const SAFE_BLOCKED_IP_RANGES = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findingId(f: ScanFinding): string {
  return `${f.rule_id}::${f.target}`;
}

function derivedEnvVarName(target: string): string {
  const part = target.split(".").pop() ?? target;
  return part.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

// ─── Rule-specific safe-default plan builders ─────────────────────────────────

function safeDefaultExec(f: ScanFinding): RemediationPlan {
  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Apply confirmation gate and blocked-commands list to ${f.target} — allowedCommands requires manual configuration.`,
    recommendedChanges: [
      "Set requiresConfirmation: true — require user approval before any command runs.",
      `Block known-dangerous commands: ${SAFE_BLOCKED_COMMANDS.slice(0, 6).join(", ")}, and more.`,
      "Set localOnly: true — restrict to local environment.",
      "WARNING: No allowedCommands were inferred. Add an explicit allowlist before production use.",
    ],
    policyDraft: {
      tool: f.target.replace(/^tools\./, ""),
      requiresConfirmation: true,
      allowedCommands: [],
      blockedCommands: SAFE_BLOCKED_COMMANDS,
      localOnly: true,
    },
    confidence: "medium",
    needsHumanReview: true,
    nextStep: "generate_patch_planned",
  };
}

function safeDefaultFilesystem(f: ScanFinding): RemediationPlan {
  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Restrict ${f.target} to read-only within the project directory; block all sensitive paths.`,
    recommendedChanges: [
      "Set readOnly: true — prevent any file writes.",
      "Set allowedPaths: [\"./\"] — restrict to current working directory.",
      `Set deniedPaths to block: ${SAFE_DENIED_PATHS.slice(0, 5).join(", ")}, and more.`,
      "WARNING: allowedPaths may need adjustment for your project layout.",
    ],
    policyDraft: {
      tool: f.target.replace(/^tools\./, ""),
      readOnly: true,
      allowedPaths: ["./"],
      deniedPaths: SAFE_DENIED_PATHS,
      sandbox: "project-directory",
    },
    confidence: "medium",
    needsHumanReview: true,
    nextStep: "generate_patch_planned",
  };
}

function safeDefaultSecret(f: ScanFinding): RemediationPlan {
  const envVar = derivedEnvVarName(f.target);
  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Replace hardcoded secret at ${f.target} with \${${envVar}} and rotate immediately.`,
    recommendedChanges: [
      `Replace the hardcoded value with env var reference: \${${envVar}}`,
      "Rotate this secret immediately — treat it as compromised.",
      "Add secret scanning to CI pipeline to prevent future occurrences.",
    ],
    policyDraft: {
      target: f.target,
      envVar,
      action: "replace_with_env_var",
      rotateImmediately: true,
      secretPolicy: { useEnvOnly: true, rotateRequired: true },
    },
    confidence: "high",
    needsHumanReview: true,
    nextStep: "generate_patch_planned",
  };
}

function safeDefaultNetwork(f: ScanFinding): RemediationPlan {
  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Block all outbound domains on ${f.target}, add SSRF protection and confirmation gate.`,
    recommendedChanges: [
      "Set allowedDomains: [] — no domains permitted until explicitly whitelisted.",
      "Set requiresConfirmationForExternalRequests: true — gate every network call on approval.",
      "Block internal IP ranges to prevent SSRF attacks.",
      "WARNING: allowedDomains must be configured before this tool can make any requests.",
    ],
    policyDraft: {
      tool: f.target.replace(/^tools\./, ""),
      allowedDomains: [],
      blockedDomains: ["*"],
      requiresConfirmation: true,
      blockInternalIPs: true,
      blockedRanges: SAFE_BLOCKED_IP_RANGES,
    },
    confidence: "medium",
    needsHumanReview: true,
    nextStep: "generate_patch_planned",
  };
}

function safeDefaultInputValidation(f: ScanFinding): RemediationPlan {
  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Add minimal strict inputSchema to ${f.target} — extend properties before production use.`,
    recommendedChanges: [
      "Add a typed inputSchema with additionalProperties: false.",
      "WARNING: No field definitions were inferred. Add typed properties before deploying.",
    ],
    policyDraft: {
      tool: f.target.replace(/^tools\./, ""),
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
    confidence: "low",
    needsHumanReview: true,
    nextStep: "generate_patch_planned",
  };
}

function safeDefaultDescription(f: ScanFinding): RemediationPlan {
  const toolName = f.target.replace(/^tools\./, "");
  const strictDesc =
    `This tool (${toolName}) is restricted and must operate only within explicitly configured policy boundaries. ` +
    `Always verify scope and permissions before invocation. ` +
    `Requires explicit user authorization for any action with side effects.`;

  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Replace vague description on ${f.target} with a policy-bounded, explicit description.`,
    recommendedChanges: [
      "Replace vague description with one that states purpose, scope, and constraints.",
      "Add securityBoundaries metadata for agent trust evaluation.",
    ],
    policyDraft: {
      tool: toolName,
      description: strictDesc,
      securityBoundaries: {
        permissionBoundary: "explicit grant only",
        confirmationRequired: false,
      },
    },
    confidence: "medium",
    needsHumanReview: false,
    nextStep: "generate_patch_planned",
  };
}

function safeDefaultDeploy(f: ScanFinding): RemediationPlan {
  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Add confirmation gate to ${f.target} — restrict to main branch, require passing CI.`,
    recommendedChanges: [
      "Set requireConfirmation: true — no autonomous production deploys.",
      "Set requiresApproval: true — require human authorization.",
      "Set allowedBranches: [\"main\"] — only deploy from the main branch.",
      "Set requireCIPassing: true — block deploys when CI is red.",
    ],
    policyDraft: {
      tool: f.target.replace(/^tools\./, ""),
      requireConfirmation: true,
      requiresApproval: true,
      allowedBranches: ["main"],
      requireCIPassing: true,
    },
    confidence: "high",
    needsHumanReview: false,
    nextStep: "generate_patch_planned",
  };
}

function safeDefaultDatabase(f: ScanFinding): RemediationPlan {
  return {
    findingId: findingId(f),
    ruleId: f.rule_id,
    target: f.target,
    summary: `Restrict ${f.target} to read-only operations; block destructive queries and sensitive tables.`,
    recommendedChanges: [
      "Set allowedOperations: [\"read\"] — read-only by default.",
      "Set requireConfirmationForDestructive: true — gate deletes and truncates.",
      `Block sensitive tables: ${SAFE_BLOCKED_TABLES.join(", ")}.`,
      "WARNING: allowedTables must be configured to restrict table access further.",
    ],
    policyDraft: {
      tool: f.target.replace(/^tools\./, ""),
      allowedOperations: ["read"],
      requireConfirmationForDestructive: true,
      blockedTables: SAFE_BLOCKED_TABLES,
    },
    confidence: "medium",
    needsHumanReview: true,
    nextStep: "generate_patch_planned",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** All 8 MCP rule IDs that have automated patch support. */
export const FIXABLE_MCP_RULES = new Set([
  "mcp.exec_without_allowlist",
  "mcp.unrestricted_filesystem_access",
  "mcp.hardcoded_secret",
  "mcp.overbroad_network_access",
  "mcp.missing_input_validation",
  "mcp.ambiguous_tool_description",
  "mcp.production_deploy_without_confirmation",
  "mcp.database_write_without_scope",
]);

/**
 * Generate a deterministic safe-default remediation plan for a finding.
 * Does not require user answers — applies the most conservative safe policy.
 */
export function generateSafeDefaultPlan(finding: ScanFinding): RemediationPlan {
  switch (finding.rule_id) {
    case "mcp.exec_without_allowlist":
      return safeDefaultExec(finding);
    case "mcp.unrestricted_filesystem_access":
      return safeDefaultFilesystem(finding);
    case "mcp.hardcoded_secret":
      return safeDefaultSecret(finding);
    case "mcp.overbroad_network_access":
      return safeDefaultNetwork(finding);
    case "mcp.missing_input_validation":
      return safeDefaultInputValidation(finding);
    case "mcp.ambiguous_tool_description":
      return safeDefaultDescription(finding);
    case "mcp.production_deploy_without_confirmation":
      return safeDefaultDeploy(finding);
    case "mcp.database_write_without_scope":
      return safeDefaultDatabase(finding);
    default:
      return {
        findingId: findingId(finding),
        ruleId: finding.rule_id,
        target: finding.target,
        summary: `Manual review required for ${finding.target}.`,
        recommendedChanges: ["Review the finding and apply the suggested fix manually."],
        policyDraft: { rule: finding.rule_id, target: finding.target, action: "manual_fix_required" },
        confidence: "low",
        needsHumanReview: true,
        nextStep: "manual_review",
      };
  }
}

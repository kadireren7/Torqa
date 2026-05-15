import type { RemediationAnswer, RemediationPlan } from "./types";

function answerStr(answers: RemediationAnswer[], id: string): string {
  const a = answers.find((x) => x.questionId === id);
  return typeof a?.value === "string" ? a.value.trim() : "";
}

function answerBool(answers: RemediationAnswer[], id: string): boolean | null {
  const a = answers.find((x) => x.questionId === id);
  if (typeof a?.value === "boolean") return a.value;
  if (typeof a?.value === "string") {
    const v = a.value.toLowerCase();
    if (v === "true" || v === "yes") return true;
    if (v === "false" || v === "no") return false;
  }
  return null;
}

function answerList(answers: RemediationAnswer[], id: string): string[] {
  const a = answers.find((x) => x.questionId === id);
  if (Array.isArray(a?.value)) return (a.value as string[]).filter(Boolean);
  if (typeof a?.value === "string" && a.value.trim()) {
    return a.value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function hasAnyAnswer(answers: RemediationAnswer[]): boolean {
  return answers.some((a) => {
    if (typeof a.value === "boolean") return true;
    if (typeof a.value === "string") return a.value.trim().length > 0;
    if (Array.isArray(a.value)) return a.value.length > 0;
    return false;
  });
}

export function generateRemediationPlan(
  findingId: string,
  ruleId: string,
  target: string,
  answers: RemediationAnswer[]
): RemediationPlan {
  const has = hasAnyAnswer(answers);
  switch (ruleId) {
    case "mcp.exec_without_allowlist": return planExec(findingId, ruleId, target, answers, has);
    case "mcp.unrestricted_filesystem_access": return planFilesystem(findingId, ruleId, target, answers, has);
    case "mcp.hardcoded_secret": return planSecret(findingId, ruleId, target, answers, has);
    case "mcp.overbroad_network_access": return planNetwork(findingId, ruleId, target, answers, has);
    case "mcp.missing_input_validation": return planInputValidation(findingId, ruleId, target, answers, has);
    case "mcp.ambiguous_tool_description": return planDescription(findingId, ruleId, target, answers, has);
    case "mcp.production_deploy_without_confirmation": return planDeploy(findingId, ruleId, target, answers, has);
    case "mcp.database_write_without_scope": return planDatabase(findingId, ruleId, target, answers, has);
    default: return planGeneric(findingId, ruleId, target);
  }
}

function planExec(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const allowExec = answerBool(answers, "allow_exec");
  const allowedCommands = answerList(answers, "allowed_commands");
  const requireConfirmation = answerBool(answers, "require_confirmation");
  const environment = answerStr(answers, "environment");

  const changes: string[] = [];
  const policy: Record<string, unknown> = { tool: target.replace("tools.", "") };

  if (allowExec === false) {
    changes.push("Remove this tool — shell execution is not needed and presents unacceptable risk.");
    policy.action = "remove_tool";
  } else {
    if (allowedCommands.length > 0) {
      changes.push(`Set allowedCommands: [${allowedCommands.join(", ")}] in the tool inputSchema as an enum.`);
      policy.allowedCommands = allowedCommands;
      policy.blockedCommands = ["rm -rf", "sudo", "curl", "ssh", "wget", "chmod 777"];
    } else {
      changes.push("Define an explicit allowedCommands list — no open-ended shell access.");
    }
    if (requireConfirmation === true) {
      changes.push("Set requiresConfirmation: true on the tool config.");
      policy.requiresConfirmation = true;
    }
    if (environment) {
      changes.push(`Restrict environment scope to: ${environment}.`);
      policy.environment = environment;
    }
  }

  const confidence: RemediationPlan["confidence"] =
    allowedCommands.length > 0 ? "high" : has ? "medium" : "low";
  const needsHumanReview = allowedCommands.length === 0 || allowExec === null;

  return {
    findingId, ruleId, target,
    summary: allowExec === false
      ? "Remove the shell execution tool — it presents too high a risk."
      : `Restrict ${target} to an explicit command allowlist${requireConfirmation ? " with confirmation required" : ""}.`,
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview,
    nextStep: needsHumanReview ? "manual_review" : "generate_patch_planned",
  };
}

function planFilesystem(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const accessMode = answerStr(answers, "access_mode");
  const allowedPaths = answerList(answers, "allowed_paths");
  const deniedPaths = answerList(answers, "denied_paths");
  const sandboxToProject = answerBool(answers, "sandbox_to_project");

  const changes: string[] = [];
  const policy: Record<string, unknown> = { tool: target.replace("tools.", "") };

  if (accessMode === "read-only") {
    changes.push("Set readOnly: true on the tool config.");
    policy.readOnly = true;
  }
  if (allowedPaths.length > 0) {
    changes.push(`Set allowedPaths: [${allowedPaths.join(", ")}].`);
    policy.allowedPaths = allowedPaths;
  } else if (sandboxToProject === true) {
    changes.push("Sandbox the tool to the project working directory.");
    policy.sandbox = "project-directory";
  } else {
    changes.push("Define an explicit allowedPaths list or enable sandbox mode.");
  }
  const effectiveDenied = deniedPaths.length > 0 ? deniedPaths : ["/etc", "~/.ssh", "/root", "/proc", "/sys"];
  changes.push(`Set deniedPaths: [${effectiveDenied.join(", ")}].`);
  policy.deniedPaths = effectiveDenied;

  const confidence: RemediationPlan["confidence"] =
    allowedPaths.length > 0 ? "high" : has ? "medium" : "low";
  const needsHumanReview = allowedPaths.length === 0 && sandboxToProject !== true;

  return {
    findingId, ruleId, target,
    summary: `Restrict ${target} to explicit allowed paths${accessMode === "read-only" ? " in read-only mode" : ""}.`,
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview,
    nextStep: needsHumanReview ? "manual_review" : "generate_patch_planned",
  };
}

function planSecret(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const moveToEnv = answerBool(answers, "move_to_env");
  const envVarName = answerStr(answers, "env_var_name");
  const rotateSecret = answerBool(answers, "rotate_secret");
  const blockInCi = answerBool(answers, "block_in_ci");

  const suggestedEnv =
    envVarName ||
    target.split(".").pop()?.toUpperCase().replace(/[^A-Z0-9]/g, "_") ||
    "SECRET_VALUE";

  const changes: string[] = [];
  const policy: Record<string, unknown> = { target };

  if (moveToEnv !== false) {
    changes.push(`Replace the hardcoded value with env var reference: $${suggestedEnv}`);
    policy.envVar = suggestedEnv;
    policy.action = "replace_with_env_var";
  }
  if (rotateSecret === true) {
    changes.push(
      "Rotate this secret immediately — treat it as compromised since it appeared in a config file."
    );
    policy.rotateImmediately = true;
  }
  if (blockInCi === true) {
    changes.push("Add a pre-commit hook or CI secret scanning step to block this pattern in future commits.");
    policy.blockInCI = true;
  }

  const confidence: RemediationPlan["confidence"] = envVarName ? "high" : has ? "medium" : "low";

  return {
    findingId, ruleId, target,
    summary: `Replace the hardcoded secret at ${target} with $${suggestedEnv}${rotateSecret ? " and rotate immediately" : ""}.`,
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview: rotateSecret === true,
    nextStep: "generate_patch_planned",
  };
}

function planNetwork(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const allowedDomains = answerList(answers, "allowed_domains");
  const blockArbitraryUrls = answerBool(answers, "block_arbitrary_urls");
  const requireUserApproval = answerBool(answers, "require_user_approval");
  const blockInternalIps = answerBool(answers, "block_internal_ips");

  const changes: string[] = [];
  const policy: Record<string, unknown> = { tool: target.replace("tools.", "") };

  if (allowedDomains.length > 0) {
    changes.push(`Set allowedDomains: [${allowedDomains.join(", ")}].`);
    policy.allowedDomains = allowedDomains;
  } else {
    changes.push("Define an explicit allowedDomains allowlist — block all other hosts by default.");
  }
  if (blockArbitraryUrls === true) {
    changes.push("Validate all URL inputs against allowedDomains before making requests.");
    policy.blockArbitraryUrls = true;
  }
  if (requireUserApproval === true) {
    changes.push("Set requiresConfirmation: true to gate each network request on user approval.");
    policy.requiresConfirmation = true;
  }
  if (blockInternalIps === true) {
    changes.push("Block requests to localhost and RFC1918 ranges to prevent SSRF attacks.");
    policy.blockInternalIPs = true;
    policy.blockedRanges = ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];
  }

  const confidence: RemediationPlan["confidence"] =
    allowedDomains.length > 0 ? "high" : has ? "medium" : "low";

  return {
    findingId, ruleId, target,
    summary: `Restrict ${target} to an explicit domain allowlist${blockInternalIps ? " with SSRF protection" : ""}.`,
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview: allowedDomains.length === 0,
    nextStep: allowedDomains.length > 0 ? "ready_for_policy_generation" : "manual_review",
  };
}

function planInputValidation(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const acceptedFields = answerList(answers, "accepted_fields");
  const requiredFields = answerList(answers, "required_fields");
  const addLengthConstraints = answerBool(answers, "add_length_constraints");
  const useEnumsOrPatterns = answerBool(answers, "use_enums_or_patterns");

  const changes: string[] = [];
  const properties: Record<string, unknown> = {};

  for (const field of acceptedFields) {
    const fieldDef: Record<string, unknown> = { type: "string" };
    if (addLengthConstraints) {
      fieldDef.minLength = 1;
      fieldDef.maxLength = 256;
    }
    properties[field] = fieldDef;
  }

  if (acceptedFields.length > 0) {
    changes.push(`Define inputSchema with typed properties: ${acceptedFields.join(", ")}.`);
  } else {
    changes.push("Define a typed inputSchema with explicit properties and types.");
  }
  if (requiredFields.length > 0) {
    changes.push(`Mark required fields: ${requiredFields.join(", ")}.`);
  }
  if (addLengthConstraints === true) {
    changes.push("Add minLength and maxLength to all string fields.");
  }
  if (useEnumsOrPatterns === true) {
    changes.push("Use enum or pattern constraints on fields that accept limited values.");
  }
  changes.push("Set additionalProperties: false to block unexpected input fields.");

  const effectiveRequired = requiredFields.length > 0 ? requiredFields : acceptedFields;
  const policy: Record<string, unknown> = {
    tool: target.replace("tools.", ""),
    inputSchema: {
      type: "object",
      properties,
      required: effectiveRequired,
      additionalProperties: false,
    },
  };

  const confidence: RemediationPlan["confidence"] =
    acceptedFields.length > 0 ? "high" : has ? "medium" : "low";

  return {
    findingId, ruleId, target,
    summary: `Add a typed inputSchema to ${target} with explicit fields, required constraints, and additionalProperties: false.`,
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview: acceptedFields.length === 0,
    nextStep: acceptedFields.length > 0 ? "ready_for_policy_generation" : "manual_review",
  };
}

function planDescription(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const clearDescription = answerStr(answers, "clear_description");
  const neverDo = answerStr(answers, "never_do");
  const mentionPermissions = answerBool(answers, "mention_permissions");
  const mentionConfirmation = answerBool(answers, "mention_confirmation");

  let newDescription = clearDescription;
  if (neverDo) newDescription += ` Never: ${neverDo}`;
  if (mentionPermissions) newDescription += " Operates within explicitly granted permissions only.";
  if (mentionConfirmation) newDescription += " Requires user confirmation before executing.";

  const changes: string[] = [];
  if (clearDescription) {
    changes.push(`Update description to: "${newDescription.trim()}"`);
  } else {
    changes.push("Write a clear description that states what the tool does, what it accesses, and its side effects.");
  }
  if (neverDo) changes.push(`Add explicit constraint: "${neverDo}"`);
  if (mentionPermissions === true) changes.push("State which permissions and resources the tool accesses.");
  if (mentionConfirmation === true) changes.push("Include confirmation requirements in the description.");

  const policy: Record<string, unknown> = {
    tool: target.replace("tools.", ""),
    ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
  };

  const confidence: RemediationPlan["confidence"] = clearDescription ? "high" : has ? "medium" : "low";

  return {
    findingId, ruleId, target,
    summary: clearDescription
      ? "Update the tool description to be specific and actionable."
      : "Rewrite the tool description to clearly state purpose, scope, and constraints.",
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview: !clearDescription,
    nextStep: clearDescription ? "ready_for_policy_generation" : "manual_review",
  };
}

function planDeploy(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const requireConfirmation = answerBool(answers, "require_confirmation");
  const approvers = answerList(answers, "approvers");
  const allowedBranches = answerList(answers, "allowed_branches");
  const requireCi = answerBool(answers, "require_ci");

  const changes: string[] = [];
  const policy: Record<string, unknown> = { tool: target.replace("tools.", "") };

  if (requireConfirmation !== false) {
    changes.push("Set requireConfirmation: true on the tool config.");
    policy.requireConfirmation = true;
  }
  if (approvers.length > 0) {
    changes.push(`Define approvers: [${approvers.join(", ")}].`);
    policy.approvers = approvers;
  } else {
    changes.push("Define at least one approver role before enabling production deploy.");
  }
  if (allowedBranches.length > 0) {
    changes.push(`Restrict deploys to branches: [${allowedBranches.join(", ")}].`);
    policy.allowedBranches = allowedBranches;
  }
  if (requireCi === true) {
    changes.push("Set requireCIPassing: true to gate deploys on a green CI status.");
    policy.requireCIPassing = true;
  }

  const confidence: RemediationPlan["confidence"] =
    approvers.length > 0 || allowedBranches.length > 0 ? "high" : has ? "medium" : "low";
  const needsHumanReview = approvers.length === 0;

  return {
    findingId, ruleId, target,
    summary: `Add human-in-the-loop gate to ${target}: confirmation required${approvers.length > 0 ? ` from ${approvers.join(" or ")}` : ""}.`,
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview,
    nextStep: needsHumanReview ? "manual_review" : "generate_patch_planned",
  };
}

function planDatabase(
  findingId: string, ruleId: string, target: string,
  answers: RemediationAnswer[], has: boolean
): RemediationPlan {
  const allowedTables = answerList(answers, "allowed_tables");
  const allowedOperations = answerList(answers, "allowed_operations");
  const confirmDestructive = answerBool(answers, "confirm_destructive");
  const blockUserTables = answerBool(answers, "block_user_tables");

  const changes: string[] = [];
  const policy: Record<string, unknown> = { tool: target.replace("tools.", "") };

  if (allowedTables.length > 0) {
    changes.push(`Set allowedTables: [${allowedTables.join(", ")}].`);
    policy.allowedTables = allowedTables;
  } else {
    changes.push("Define an explicit table allowlist — no unrestricted database access.");
  }
  if (allowedOperations.length > 0) {
    changes.push(`Set allowedOperations: [${allowedOperations.join(", ")}].`);
    policy.allowedOperations = allowedOperations;
    if (!allowedOperations.includes("delete") && !allowedOperations.includes("update")) {
      policy.readOnly = true;
    }
  }
  if (confirmDestructive === true) {
    changes.push("Set requireConfirmationForDestructive: true for DELETE and TRUNCATE operations.");
    policy.requireConfirmationForDestructive = true;
  }
  if (blockUserTables === true) {
    const blocked = ["users", "accounts", "customers", "sessions", "tokens", "payments"];
    changes.push(`Block access to sensitive tables: ${blocked.join(", ")}.`);
    policy.blockedTables = blocked;
  }

  const confidence: RemediationPlan["confidence"] =
    allowedTables.length > 0 ? "high" : has ? "medium" : "low";
  const needsHumanReview = allowedTables.length === 0;

  return {
    findingId, ruleId, target,
    summary: `Scope ${target} to an explicit table and operation allowlist${confirmDestructive ? " with confirmation for destructive ops" : ""}.`,
    recommendedChanges: changes,
    policyDraft: policy,
    confidence,
    needsHumanReview,
    nextStep: needsHumanReview ? "manual_review" : "ready_for_policy_generation",
  };
}

function planGeneric(findingId: string, ruleId: string, target: string): RemediationPlan {
  return {
    findingId, ruleId, target,
    summary: `Address the identified risk at ${target}. Manual review required.`,
    recommendedChanges: [
      "Review the finding explanation and apply the suggested fix.",
      "Verify the change in a staging environment before production.",
    ],
    policyDraft: { rule: ruleId, target, action: "manual_fix_required" },
    confidence: "low",
    needsHumanReview: true,
    nextStep: "manual_review",
  };
}

/**
 * MCP (Model Context Protocol) server config adapter — deterministic detector + analyzer.
 *
 * Parses MCP tool manifests and server configs. Detects risky tool permissions,
 * exposed secrets, unsafe capabilities, missing input validation, and ambiguous
 * tool descriptions that could be abused by AI agents.
 *
 * Rule ID format: mcp.<category>.<issue>
 * Severity levels match the rest of the scan engine: critical | high | review | info
 */

import type { ScanFinding, ScanSeverity } from "@/lib/scan-engine";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function pushFinding(
  out: ScanFinding[],
  severity: ScanSeverity,
  rule_id: string,
  target: string,
  explanation: string,
  suggested_fix: string
) {
  out.push({ severity, rule_id, target, explanation, suggested_fix });
}

// ─── Tool shape ──────────────────────────────────────────────────────────────

type MCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

function normalizeTool(raw: unknown): MCPTool | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : null;
  if (!name) return null;
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const inputSchema = isRecord(raw.inputSchema) ? raw.inputSchema : null;
  return { name, description, inputSchema, raw };
}

function getSchemaProperties(schema: Record<string, unknown> | null): Record<string, unknown> {
  if (!schema) return {};
  const props = schema.properties;
  return isRecord(props) ? props : {};
}

function fieldHasConstraint(field: unknown): boolean {
  if (!isRecord(field)) return false;
  return (
    Array.isArray(field.enum) ||
    typeof field.pattern === "string" ||
    typeof field.const !== "undefined" ||
    (typeof field.minLength === "number" && typeof field.maxLength === "number")
  );
}

// ─── Secret detection ─────────────────────────────────────────────────────────

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|passwd|bearer|authorization|credential|private[_-]?key)/i;
const SECRET_VALUE_PREFIXES = ["sk-", "ghp_", "ghs_", "xoxb-", "xoxp-", "xoxa-", "eyJ"];
const MASKED_PATTERN = /(\*{3,}|<redacted>|<hidden>|your[-_]?(key|token|secret)|changeme|xxx+)/i;
const EXPR_PATTERN = /(\{\{.+\}\}|\$\{.+\}|<%.*%>|\$[A-Z_]+)/;

function looksPlaintextSecret(key: string, value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 8) return false;
  if (MASKED_PATTERN.test(v)) return false;
  if (EXPR_PATTERN.test(v)) return false;
  if (/^(true|false|null|undefined|\d+)$/i.test(v)) return false;
  if (/^[a-z]+:\/\/\S+$/i.test(v) && !SECRET_VALUE_PREFIXES.some((p) => v.includes(p))) return false;
  if (SECRET_KEY_PATTERN.test(key)) return true;
  if (SECRET_VALUE_PREFIXES.some((p) => v.startsWith(p))) return true;
  return false;
}

function flattenSecrets(
  obj: unknown,
  basePath: string,
  out: { keyPath: string; value: string }[],
  depth = 0
): void {
  if (depth > 6) return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => flattenSecrets(item, `${basePath}[${i}]`, out, depth + 1));
    return;
  }
  if (!isRecord(obj)) return;
  for (const [k, v] of Object.entries(obj)) {
    const path = basePath ? `${basePath}.${k}` : k;
    if (typeof v === "string") {
      out.push({ keyPath: path, value: v });
    } else {
      flattenSecrets(v, path, out, depth + 1);
    }
  }
}

// ─── Rule implementations ─────────────────────────────────────────────────────

const EXEC_NAME_PATTERN = /^(run|exec|execute|shell|bash|cmd|command|invoke|spawn|subprocess|sh|terminal|eval)/i;
const EXEC_DESC_PATTERN = /(execut|run[s ]|shell|command|bash|invoke)/i;

function ruleExecWithoutAllowlist(tools: MCPTool[], out: ScanFinding[]): void {
  for (const tool of tools) {
    const isExecByName = EXEC_NAME_PATTERN.test(tool.name);
    const isExecByDesc = EXEC_DESC_PATTERN.test(tool.description);
    if (!isExecByName && !isExecByDesc) continue;

    const props = getSchemaProperties(tool.inputSchema);
    const commandField = props.command ?? props.cmd ?? props.args ?? props.script;
    const hasAllowlist = fieldHasConstraint(commandField);
    const hasTopLevelAllowlist =
      isRecord(tool.raw.allowedCommands) ||
      Array.isArray(tool.raw.allowedCommands) ||
      isRecord(tool.raw.commandAllowlist) ||
      Array.isArray(tool.raw.commandAllowlist);

    if (!hasAllowlist && !hasTopLevelAllowlist) {
      pushFinding(
        out,
        "critical",
        "mcp.exec_without_allowlist",
        `tools.${tool.name}`,
        `Tool "${tool.name}" can execute arbitrary shell commands with no command allowlist or constraint on the command parameter. Any agent or user with access can run arbitrary code on your server.`,
        "Add an allowedCommands enum to the command input schema, or restrict the tool to a specific operation rather than accepting arbitrary shell commands."
      );
    }
  }
}

const FS_NAME_PATTERN = /^(write|read|delete|remove|move|copy|rename|list|ls|cat|open|create)[-_]?(file|dir|directory|path|folder)|^(file|dir|fs|filesystem)[_-]?(write|read|list|delete|access)/i;
const FS_DESC_PATTERN = /(file system|filesystem|write[s ]?to file|read[s ]?file|list[s ]?files|delete[s ]?file|directory|folder access)/i;
const PATH_FIELD_NAMES = ["path", "file_path", "filepath", "directory", "dir", "dest", "destination", "source", "src"];

function ruleUnrestrictedFilesystemAccess(tools: MCPTool[], out: ScanFinding[]): void {
  for (const tool of tools) {
    const isFsByName = FS_NAME_PATTERN.test(tool.name);
    const isFsByDesc = FS_DESC_PATTERN.test(tool.description);
    if (!isFsByName && !isFsByDesc) continue;

    const props = getSchemaProperties(tool.inputSchema);
    const pathField = PATH_FIELD_NAMES.map((k) => props[k]).find(Boolean);
    const hasPathConstraint = fieldHasConstraint(pathField);
    const hasTopLevelConstraint =
      Array.isArray(tool.raw.allowedPaths) ||
      Array.isArray(tool.raw.deniedPaths) ||
      typeof tool.raw.sandbox === "string" ||
      tool.raw.sandbox === true;

    if (!hasPathConstraint && !hasTopLevelConstraint) {
      const isWrite = /write|delete|remove|move|rename|create/i.test(tool.name + " " + tool.description);
      pushFinding(
        out,
        isWrite ? "critical" : "high",
        "mcp.unrestricted_filesystem_access",
        `tools.${tool.name}`,
        `Tool "${tool.name}" accesses the filesystem with no path constraints, allowed path list, or sandbox. An agent could read sensitive files (e.g. /etc/passwd, ~/.ssh/id_rsa) or overwrite arbitrary paths.`,
        "Add an allowedPaths array to the tool config, restrict the path parameter with a pattern or enum, or sandbox the tool to a specific working directory."
      );
    }
  }
}

function ruleHardcodedSecret(content: unknown, out: ScanFinding[]): void {
  const pairs: { keyPath: string; value: string }[] = [];
  flattenSecrets(content, "", pairs, 0);

  const seen = new Set<string>();
  for (const { keyPath, value } of pairs) {
    const lastKey = keyPath.split(".").pop() ?? keyPath;
    if (!looksPlaintextSecret(lastKey, value)) continue;
    const dedupeKey = `${keyPath}:${value.slice(0, 16)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const masked = value.length > 12
      ? `${value.slice(0, 6)}${"*".repeat(Math.min(8, value.length - 8))}${value.slice(-4)}`
      : "***";

    pushFinding(
      out,
      "critical",
      "mcp.hardcoded_secret",
      keyPath,
      `Potential plaintext secret detected at "${keyPath}" (value: ${masked}). Secrets in MCP server configs are readable by any agent, user, or process with access to the manifest.`,
      "Move secrets to environment variables or a secrets manager. Reference them as env var references (e.g. $SECRET_NAME) rather than hardcoding values."
    );
  }
}

const NETWORK_NAME_PATTERN = /^(fetch|http|request|curl|download|get|post|call|invoke|webhook|api[_-]?call|browse|navigate|web)/i;
const NETWORK_DESC_PATTERN = /(fetch[es]? (from|url|any)|http request|call[s]? any|external api|internet|arbitrary url|browse the web)/i;
const URL_FIELD_NAMES = ["url", "uri", "endpoint", "href", "link", "target_url"];

function ruleOverbroadNetworkAccess(tools: MCPTool[], out: ScanFinding[]): void {
  for (const tool of tools) {
    const isNetByName = NETWORK_NAME_PATTERN.test(tool.name);
    const isNetByDesc = NETWORK_DESC_PATTERN.test(tool.description);
    if (!isNetByName && !isNetByDesc) continue;

    const props = getSchemaProperties(tool.inputSchema);
    const urlField = URL_FIELD_NAMES.map((k) => props[k]).find(Boolean);
    const hasUrlConstraint = fieldHasConstraint(urlField);
    const hasTopLevelConstraint =
      Array.isArray(tool.raw.allowedDomains) ||
      Array.isArray(tool.raw.blockedDomains) ||
      Array.isArray(tool.raw.allowedUrls);

    if (!hasUrlConstraint && !hasTopLevelConstraint) {
      pushFinding(
        out,
        "high",
        "mcp.overbroad_network_access",
        `tools.${tool.name}`,
        `Tool "${tool.name}" can make network requests to any URL with no domain allowlist or blocked-domain list. This enables SSRF attacks, data exfiltration, and access to internal network resources.`,
        "Add an allowedDomains list to restrict which hosts the tool can reach, or replace with a more specific tool that only calls known endpoints."
      );
    }
  }
}

const EMPTY_SCHEMA_THRESHOLD = 1;

function ruleMissingInputValidation(tools: MCPTool[], out: ScanFinding[]): void {
  for (const tool of tools) {
    if (!tool.inputSchema) {
      pushFinding(
        out,
        "review",
        "mcp.missing_input_validation",
        `tools.${tool.name}`,
        `Tool "${tool.name}" has no inputSchema defined. Without a schema, input is unvalidated — agents can pass unexpected types, oversized payloads, or injection strings.`,
        "Add a typed inputSchema with properties, types, and required fields. Use additionalProperties: false to prevent unexpected fields."
      );
      continue;
    }

    const props = getSchemaProperties(tool.inputSchema);
    const propCount = Object.keys(props).length;
    const hasRequired = Array.isArray(tool.inputSchema.required) && tool.inputSchema.required.length > 0;

    if (propCount <= EMPTY_SCHEMA_THRESHOLD && !hasRequired) {
      pushFinding(
        out,
        "review",
        "mcp.missing_input_validation",
        `tools.${tool.name}`,
        `Tool "${tool.name}" has an empty or near-empty inputSchema with no typed properties or required fields. Agents may pass arbitrary data.`,
        "Define typed properties with constraints (minLength, maxLength, pattern, enum) and mark required fields explicitly."
      );
    }
  }
}

const AMBIGUOUS_DESC_PATTERNS = [
  /^(does|do) (anything|everything|tasks|things|stuff)/i,
  /^(runs?|executes?|performs?|handles?|manages?|processes?) (commands?|tasks?|things?|requests?|stuff|anything)/i,
  /^(helper|utility|general|misc|various|multiple) (tool|function|helper)/i,
  /^(accesses?|manages?|controls?) (data|files?|system|resources?|things?)/i,
];
const RISKY_NAMES_WITH_VAGUE_DESC = /^(run_command|exec|shell|deploy|publish|write_file|delete_file|query_database|send_email|drop_table|rm_rf)/i;

function ruleAmbiguousToolDescription(tools: MCPTool[], out: ScanFinding[]): void {
  for (const tool of tools) {
    const isAmbiguous =
      tool.description.length < 20 ||
      AMBIGUOUS_DESC_PATTERNS.some((p) => p.test(tool.description));

    const isRiskyName = RISKY_NAMES_WITH_VAGUE_DESC.test(tool.name);

    if (isAmbiguous && isRiskyName) {
      pushFinding(
        out,
        "high",
        "mcp.ambiguous_tool_description",
        `tools.${tool.name}`,
        `Tool "${tool.name}" has a risky name but a vague description: "${tool.description}". AI agents use descriptions to decide when to call tools — vague descriptions can lead to unintended or over-broad tool use.`,
        "Write a precise description that specifies exactly what the tool does, what data it accesses, and any side effects. Avoid generic phrases like 'manages things' or 'handles tasks'."
      );
    } else if (isAmbiguous) {
      pushFinding(
        out,
        "review",
        "mcp.ambiguous_tool_description",
        `tools.${tool.name}`,
        `Tool "${tool.name}" has a vague description: "${tool.description}". Agents may call this tool incorrectly or unnecessarily.`,
        "Provide a clear description of the tool's purpose, inputs, outputs, and any side effects."
      );
    }
  }
}

const DEPLOY_NAME_PATTERN = /^(deploy|release|publish|rollout|promote|ship|push_to_prod|push_production)/i;
const DEPLOY_DESC_PATTERN = /(deploy[s]? to production|push to prod|release to production|promote to prod)/i;

function ruleProductionDeployWithoutConfirmation(tools: MCPTool[], out: ScanFinding[]): void {
  for (const tool of tools) {
    const isDeployByName = DEPLOY_NAME_PATTERN.test(tool.name);
    const isDeployByDesc = DEPLOY_DESC_PATTERN.test(tool.description);
    if (!isDeployByName && !isDeployByDesc) continue;

    const hasConfirmation =
      tool.raw.requireConfirmation === true ||
      tool.raw.requiresConfirmation === true ||
      tool.raw.requireApproval === true ||
      tool.raw.confirmation_required === true ||
      typeof tool.raw.approval_webhook === "string";

    if (!hasConfirmation) {
      pushFinding(
        out,
        "critical",
        "mcp.production_deploy_without_confirmation",
        `tools.${tool.name}`,
        `Tool "${tool.name}" deploys to production with no confirmation gate or approval step. An agent acting autonomously could trigger an unintended production deployment.`,
        "Add requireConfirmation: true to the tool config, implement a human-in-the-loop approval webhook, or restrict this tool to supervised governance mode only."
      );
    }
  }
}

const DB_WRITE_NAME_PATTERN = /^(query|sql|exec_sql|run_query|database|db[_-]?(write|update|delete|insert|drop))/i;
const DB_WRITE_DESC_PATTERN = /(insert|update|delete|drop|truncate|execute[s]? sql|write[s]? to (db|database))/i;

function ruleDatabaseWriteWithoutScope(tools: MCPTool[], out: ScanFinding[]): void {
  for (const tool of tools) {
    const isDbByName = DB_WRITE_NAME_PATTERN.test(tool.name);
    const isDbByDesc = DB_WRITE_DESC_PATTERN.test(tool.description);
    if (!isDbByName && !isDbByDesc) continue;

    const props = getSchemaProperties(tool.inputSchema);
    const queryField = props.query ?? props.sql ?? props.statement;
    const hasQueryConstraint = fieldHasConstraint(queryField);
    const hasTopLevelScope =
      Array.isArray(tool.raw.allowedTables) ||
      Array.isArray(tool.raw.allowedOperations) ||
      tool.raw.readOnly === true;

    if (!hasQueryConstraint && !hasTopLevelScope) {
      pushFinding(
        out,
        "high",
        "mcp.database_write_without_scope",
        `tools.${tool.name}`,
        `Tool "${tool.name}" can execute arbitrary SQL (including writes, deletes, and schema changes) with no table allowlist or operation scope. An agent could run destructive queries like DROP TABLE or DELETE FROM.`,
        "Add allowedTables and allowedOperations lists to restrict what the tool can query. Consider readOnly: true for read-only agents, or split into separate read and write tools."
      );
    }
  }
}

// ─── Top-level detector and analyzer ─────────────────────────────────────────

export function isLikelyMcp(content: unknown): boolean {
  if (!isRecord(content)) return false;
  if (isRecord(content.serverInfo) && Array.isArray(content.tools)) return true;
  if (typeof content.mcpServers !== "undefined") return true;
  if (Array.isArray(content.tools) && content.tools.length > 0) {
    const first = content.tools[0];
    if (isRecord(first) && typeof first.name === "string" && isRecord(first.inputSchema)) return true;
  }
  return false;
}

export function analyzeMcp(content: unknown): ScanFinding[] {
  const out: ScanFinding[] = [];
  if (!isRecord(content)) {
    pushFinding(
      out,
      "critical",
      "mcp.shape_mismatch",
      "manifest",
      "Source is MCP but the JSON does not match an expected MCP server config or tool manifest shape.",
      "Provide a valid MCP server config with a tools array or serverInfo block."
    );
    return out;
  }

  const rawTools = Array.isArray(content.tools) ? content.tools : [];
  const tools: MCPTool[] = rawTools.map(normalizeTool).filter((t): t is MCPTool => t !== null);

  if (tools.length === 0 && !isRecord(content.serverInfo)) {
    pushFinding(
      out,
      "review",
      "mcp.no_tools_found",
      "manifest",
      "No tools were found in this MCP server config. Torqa requires a tools array to analyze tool-level risk.",
      "Ensure the manifest includes a tools array with at least one tool definition."
    );
    return out;
  }

  // Rule A: shell execution without allowlist
  ruleExecWithoutAllowlist(tools, out);

  // Rule B: unrestricted filesystem access
  ruleUnrestrictedFilesystemAccess(tools, out);

  // Rule C: hardcoded secrets in config or tool metadata
  ruleHardcodedSecret(content, out);

  // Rule D: overbroad network access
  ruleOverbroadNetworkAccess(tools, out);

  // Rule E: missing input validation
  ruleMissingInputValidation(tools, out);

  // Rule F: ambiguous tool descriptions
  ruleAmbiguousToolDescription(tools, out);

  // Rule G: production deploy without confirmation
  ruleProductionDeployWithoutConfirmation(tools, out);

  // Rule H: database write without scope
  ruleDatabaseWriteWithoutScope(tools, out);

  if (out.filter((f) => f.severity === "critical" || f.severity === "high").length === 0 && out.length === 0) {
    pushFinding(
      out,
      "info",
      "mcp.no_critical_risk",
      "manifest",
      "No high-signal security risks detected in this MCP server config.",
      "Continue reviewing tool descriptions, permission scopes, and secret handling as capabilities expand."
    );
  }

  return out;
}

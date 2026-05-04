/**
 * Make.com (formerly Integromat) adapter — deterministic detector + analyzer.
 *
 * Make exports a "blueprint" / scenario JSON. Each scenario has a `flow` array
 * of modules (steps). Modules have `id`, `module` (e.g. `http:ActionSendData`),
 * `mapper` (parameter map, may contain secrets / URLs), and an optional
 * `parameters` block. Routes/IFs split flow into branches.
 *
 * The analyzer emits the same rule_id family as n8n (`v1.http.*`,
 * `v1.secret.*`, `v1.webhook.*`) so the policy engine and Fix Engine work
 * across sources.
 */

import type { ScanFinding, ScanSeverity } from "@/lib/scan-engine";

const SECRET_KEY_PATTERN = /(api[-_]?key|token|secret|password|bearer|authorization)/i;
const MASKED_VALUE_PATTERN = /(\*{3,}|<redacted>|<hidden>|xxxxx|your[_-]?(token|key|secret)|changeme)/i;
const EXPR_VALUE_PATTERN = /(\{\{.+\}\}|\$\{.+\}|<%.*%>)/;
const HTTP_MODULE_PATTERN = /^http(?::|$)|http(?:_|\.)?action|http(?:_|\.)?request|web(?:_|hook)/i;
const WEBHOOK_MODULE_PATTERN = /webhook|gateway:webhook|gateway:CustomWebHook|hook(?:_|\.)?listen/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function looksPlaintextSecret(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 6) return false;
  if (MASKED_VALUE_PATTERN.test(v)) return false;
  if (EXPR_VALUE_PATTERN.test(v)) return false;
  if (/^(true|false|null|undefined)$/i.test(v)) return false;
  if (/^[a-z]+:\/\/\S+$/i.test(v)) return false;
  return true;
}

type FlowModule = {
  id: string | number;
  moduleId: string;
  mapper: Record<string, unknown> | null;
  parameters: Record<string, unknown> | null;
};

function normalizeModule(raw: unknown): FlowModule | null {
  if (!isRecord(raw)) return null;
  const id =
    typeof raw.id === "string" || typeof raw.id === "number" ? raw.id : "?";
  const moduleId = typeof raw.module === "string" ? raw.module : "unknown";
  const mapper = isRecord(raw.mapper) ? raw.mapper : null;
  const parameters = isRecord(raw.parameters) ? raw.parameters : null;
  return { id, moduleId, mapper, parameters };
}

/** True when an array entry looks like Make's `{name, value}` pair shape. */
function isHeaderPair(value: unknown): value is { name: string; value: unknown } {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    Object.prototype.hasOwnProperty.call(value, "value")
  );
}

function flatten(value: unknown, base: string, out: { keyPath: string; value: string }[], depth = 0) {
  if (depth > 8) return;
  if (Array.isArray(value)) {
    // Make commonly stores headers/query as `[{name, value}, ...]` pairs.
    // Treat each pair as a key-value entry rather than indexing into the array,
    // so secret-key detection (Authorization, X-Api-Key, …) actually fires.
    if (value.length > 0 && value.every(isHeaderPair)) {
      for (const pair of value as { name: string; value: unknown }[]) {
        const keyName = pair.name;
        const valueStr =
          typeof pair.value === "string"
            ? pair.value
            : typeof pair.value === "number" || typeof pair.value === "boolean"
              ? String(pair.value)
              : null;
        if (valueStr !== null) {
          const next = base ? `${base}.${keyName}` : keyName;
          out.push({ keyPath: next, value: valueStr });
        }
      }
      return;
    }
    for (let i = 0; i < value.length; i += 1) flatten(value[i], `${base}[${i}]`, out, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const [k, v] of Object.entries(value)) {
    const next = base ? `${base}.${k}` : k;
    if (typeof v === "string") out.push({ keyPath: next, value: v });
    else if (typeof v === "number" || typeof v === "boolean") out.push({ keyPath: next, value: String(v) });
    else flatten(v, next, out, depth + 1);
  }
}

function detectSecrets(out: ScanFinding[], scope: string, mapper: Record<string, unknown>) {
  const pairs: { keyPath: string; value: string }[] = [];
  flatten(mapper, "", pairs);
  const seen = new Set<string>();
  for (const pair of pairs) {
    const keyName = pair.keyPath.split(".").pop() ?? pair.keyPath;
    if (!SECRET_KEY_PATTERN.test(keyName)) continue;
    if (!looksPlaintextSecret(pair.value)) continue;
    const dedupe = `${pair.keyPath}:${pair.value.slice(0, 20)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    pushFinding(
      out,
      "critical",
      "v1.secret.plaintext_detected",
      `${scope}.${pair.keyPath}`,
      `Plaintext secret-like value detected in Make.com mapper at "${pair.keyPath}".`,
      "Move the value to a Make.com Connection (vault) and reference it via the connection picker."
    );
  }
}

function getModuleUrl(mod: FlowModule): string | null {
  const m = mod.mapper;
  if (!m) return null;
  const keys = ["url", "URL", "webhookUrl", "endpoint", "uri"];
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function moduleHasAuth(mod: FlowModule): boolean {
  const m = mod.mapper ?? {};
  const p = mod.parameters ?? {};
  const candidates = ["authentication", "auth", "credentials", "headers", "oauth", "apiKey", "bearer"];
  for (const k of candidates) {
    const mv = m[k];
    const pv = p[k];
    if (typeof mv === "string" && mv.trim() && mv.trim().toLowerCase() !== "none") return true;
    if (isRecord(mv)) return true;
    if (typeof pv === "string" && pv.trim() && pv.trim().toLowerCase() !== "none") return true;
    if (isRecord(pv)) return true;
  }
  return false;
}

function analyzeModule(out: ScanFinding[], mod: FlowModule) {
  const target = `module:${mod.id} (${mod.moduleId})`;
  if (mod.mapper) detectSecrets(out, target, mod.mapper);
  if (mod.parameters) detectSecrets(out, `${target}.parameters`, mod.parameters);

  const isHttp = HTTP_MODULE_PATTERN.test(mod.moduleId);
  const isWebhook = WEBHOOK_MODULE_PATTERN.test(mod.moduleId);

  const url = getModuleUrl(mod);
  if (isHttp) {
    if (url && /^http:\/\//i.test(url)) {
      pushFinding(
        out,
        "critical",
        "v1.http.plaintext_transport",
        target,
        "HTTP module uses plaintext transport (http://) — credentials and payload data can leak in transit.",
        "Use HTTPS only and enforce TLS for all outbound calls from Make scenarios."
      );
    }
    const m = mod.mapper ?? {};
    if (m.rejectUnauthorized === false || m.allowUnauthorizedCerts === true) {
      pushFinding(
        out,
        "critical",
        "v1.http.tls_verification_disabled",
        target,
        "HTTP module disables TLS certificate validation.",
        "Re-enable TLS verification (`rejectUnauthorized=true`) and remove insecure SSL bypass flags."
      );
    }
    const errorHandler =
      m.errorHandler !== undefined ||
      m.continueOnFail === true ||
      (mod.parameters && mod.parameters.errorHandler !== undefined);
    if (!errorHandler) {
      pushFinding(
        out,
        "review",
        "v1.http.missing_error_handling",
        target,
        "HTTP module has no error handler / fallback route configured.",
        "Attach an error handler route (right-click module → Add error handler) to prevent silent failures."
      );
    }
  }

  if (isWebhook) {
    if (!moduleHasAuth(mod)) {
      pushFinding(
        out,
        "critical",
        "v1.webhook.public_no_auth",
        target,
        "Webhook listener has no authentication / signature validation configured.",
        "Add a shared secret, signature header check, or IP allow-list to the Make webhook."
      );
    }
  }
}

export function isLikelyMake(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const flow = value.flow;
  if (!Array.isArray(flow) || flow.length === 0) return false;
  const first = flow[0];
  if (!isRecord(first)) return false;
  const hasModule = typeof first.module === "string";
  const hasMapper = isRecord(first.mapper) || isRecord(first.parameters);
  const hasMakeMeta =
    typeof value.name === "string" || isRecord(value.metadata) || isRecord(value.scheduling);
  return hasModule && (hasMapper || hasMakeMeta);
}

export function analyzeMake(content: unknown): ScanFinding[] {
  const out: ScanFinding[] = [];
  if (!isRecord(content) || !Array.isArray(content.flow)) {
    pushFinding(
      out,
      "critical",
      "v1.make.shape_mismatch",
      "scenario",
      "Source is make but JSON does not match a Make.com scenario blueprint shape.",
      "Export the scenario via Make.com → Scenario settings → Export blueprint."
    );
    return out;
  }
  const modules: FlowModule[] = [];
  for (const raw of content.flow) {
    const m = normalizeModule(raw);
    if (m) modules.push(m);
  }
  if (modules.length === 0) {
    pushFinding(
      out,
      "critical",
      "v1.make.empty_flow",
      "scenario",
      "Make scenario has no modules.",
      "Add at least one module before exporting the scenario."
    );
    return out;
  }
  for (const m of modules) analyzeModule(out, m);

  // Scenario-level: scheduling check.
  if (isRecord(content.scheduling)) {
    const type = typeof content.scheduling.type === "string" ? content.scheduling.type : "";
    if (type === "indefinitely" || type === "every-x-minutes") {
      pushFinding(
        out,
        "info",
        "v1.make.aggressive_scheduling",
        "scenario.scheduling",
        `Scenario is scheduled with type "${type}" which can amplify cost and rate-limit risk under failure scenarios.`,
        "Pair aggressive schedules with explicit error handling and operational alerts."
      );
    }
  }
  return out;
}

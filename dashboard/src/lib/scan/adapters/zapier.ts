/**
 * Zapier adapter — deterministic detector + analyzer.
 *
 * Zapier "zap" exports look roughly like:
 *   {
 *     "zap": { "title": "...", "live": true, ... },
 *     "steps": [
 *       { "id": "...", "type_of": "trigger" | "action", "selected_api": "WebhookV2",
 *         "params": { "url": "...", "method": "POST", "auth": ... } }
 *     ]
 *   }
 *
 * We honour a few common shapes (top-level `steps`, `zap.steps`, or just a
 * `nodes` array) so that exports from internal Zapier admin tools or unofficial
 * dumps also work.
 */

import type { ScanFinding, ScanSeverity } from "@/lib/scan-engine";

const SECRET_KEY_PATTERN = /(api[-_]?key|token|secret|password|bearer|authorization)/i;
const MASKED_VALUE_PATTERN = /(\*{3,}|<redacted>|<hidden>|xxxxx|your[_-]?(token|key|secret)|changeme)/i;
const EXPR_VALUE_PATTERN = /(\{\{.+\}\}|\$\{.+\}|<%.*%>)/;
const HTTP_API_PATTERN = /(WebhookV2|WebHooksByZapier|HTTPRequest|CustomHTTPRequest)/i;
const WEBHOOK_API_PATTERN = /(WebhookV2|WebHooksByZapier|CatchHookV2|CatchRawHook)/i;

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

type ZapStep = {
  id: string;
  title: string;
  typeOf: string;
  selectedApi: string;
  params: Record<string, unknown>;
};

function normalizeStep(raw: unknown): ZapStep | null {
  if (!isRecord(raw)) return null;
  const id =
    typeof raw.id === "string"
      ? raw.id
      : typeof raw.step_id === "string"
        ? raw.step_id
        : typeof raw.action_id === "string"
          ? raw.action_id
          : "?";
  const title = typeof raw.title === "string" ? raw.title : typeof raw.label === "string" ? raw.label : id;
  const typeOf = typeof raw.type_of === "string" ? raw.type_of : typeof raw.type === "string" ? raw.type : "action";
  const selectedApi =
    typeof raw.selected_api === "string"
      ? raw.selected_api
      : typeof raw.app === "string"
        ? raw.app
        : typeof raw.api === "string"
          ? raw.api
          : "unknown";
  const params = isRecord(raw.params) ? raw.params : isRecord(raw.parameters) ? raw.parameters : {};
  return { id, title, typeOf, selectedApi, params };
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

function flatten(value: unknown, base: string, out: { keyPath: string; value: string }[], depth = 0) {
  if (depth > 8) return;
  if (Array.isArray(value)) {
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

function detectSecrets(out: ScanFinding[], scope: string, params: Record<string, unknown>) {
  const pairs: { keyPath: string; value: string }[] = [];
  flatten(params, "", pairs);
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
      `Plaintext secret-like value detected in Zapier step at "${pair.keyPath}".`,
      "Move the value to a Zapier-managed connection or the Storage by Zapier vault."
    );
  }
}

function findStepsArray(content: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(content.steps)) return content.steps;
  if (isRecord(content.zap) && Array.isArray(content.zap.steps)) return content.zap.steps;
  if (Array.isArray(content.nodes)) return content.nodes;
  if (Array.isArray(content.actions)) return content.actions;
  return null;
}

export function isLikelyZapier(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const top = value;
  if (isRecord(top.zap) && Array.isArray(top.zap.steps)) return true;
  if (Array.isArray(top.steps)) {
    const first = top.steps[0];
    if (
      isRecord(first) &&
      (typeof first.selected_api === "string" || typeof first.type_of === "string" || typeof first.app === "string")
    ) {
      return true;
    }
  }
  return false;
}

function stepHasAuth(step: ZapStep): boolean {
  const candidates = ["auth", "authentication", "credentials", "headers", "api_key", "apiKey"];
  for (const k of candidates) {
    const v = step.params[k];
    if (typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "none") return true;
    if (isRecord(v)) return true;
  }
  return false;
}

function getStepUrl(step: ZapStep): string | null {
  const v = step.params.url;
  if (typeof v === "string" && v.trim()) return v.trim();
  const u2 = step.params.endpoint;
  if (typeof u2 === "string" && u2.trim()) return u2.trim();
  return null;
}

export function analyzeZapier(content: unknown): ScanFinding[] {
  const out: ScanFinding[] = [];
  if (!isRecord(content)) {
    pushFinding(
      out,
      "critical",
      "v1.zapier.shape_mismatch",
      "zap",
      "Source is zapier but JSON does not match a Zap export shape.",
      "Export the Zap from Zapier admin / partner API or paste a JSON containing `steps`."
    );
    return out;
  }
  const stepsRaw = findStepsArray(content);
  if (!stepsRaw || stepsRaw.length === 0) {
    pushFinding(
      out,
      "critical",
      "v1.zapier.empty_zap",
      "zap",
      "Zap export contains no steps.",
      "Re-export the Zap including all steps (trigger + actions)."
    );
    return out;
  }

  const steps: ZapStep[] = [];
  for (const r of stepsRaw) {
    const s = normalizeStep(r);
    if (s) steps.push(s);
  }

  const triggerCount = steps.filter((s) => s.typeOf === "trigger").length;
  if (triggerCount === 0) {
    pushFinding(
      out,
      "review",
      "v1.zapier.missing_trigger",
      "zap",
      "Zap has no trigger step — automation will never fire.",
      "Add a trigger step before re-publishing the Zap."
    );
  }

  for (const step of steps) {
    const target = `step:${step.id} (${step.selectedApi})`;
    detectSecrets(out, target, step.params);

    const isHttp = HTTP_API_PATTERN.test(step.selectedApi);
    const isWebhook = WEBHOOK_API_PATTERN.test(step.selectedApi);

    if (isHttp) {
      const url = getStepUrl(step);
      if (url && /^http:\/\//i.test(url)) {
        pushFinding(
          out,
          "critical",
          "v1.http.plaintext_transport",
          target,
          "Zap HTTP step uses plaintext transport (http://).",
          "Use HTTPS for any outbound webhooks or HTTP requests."
        );
      }
      if (step.params.skip_throttle === true) {
        pushFinding(
          out,
          "review",
          "v1.zapier.throttle_disabled",
          target,
          "Throttling is explicitly disabled for this Zap step.",
          "Leave Zapier throttling enabled to avoid runaway costs and downstream rate-limit incidents."
        );
      }
    }

    if (isWebhook) {
      if (!stepHasAuth(step)) {
        pushFinding(
          out,
          "critical",
          "v1.webhook.public_no_auth",
          target,
          "Catch-hook step has no authentication / signature validation.",
          "Add a static auth header (e.g. shared secret) and validate it before processing payloads."
        );
      }
    }

    if (step.typeOf === "action" && step.params.continue_on_error === true) {
      pushFinding(
        out,
        "review",
        "v1.zapier.swallow_errors",
        target,
        "Step is configured to continue on error, which can silently swallow failures.",
        "Either remove `continue_on_error` or pair it with a downstream notification step."
      );
    }
  }

  return out;
}

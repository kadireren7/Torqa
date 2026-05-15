/**
 * Real-time governance signals (Block 6).
 *
 * Bridges the immutable `governance_decisions` log into the existing alert
 * subsystem so external systems (Slack, Pagerduty, Datadog, custom CRM)
 * receive a notification the moment a fix is applied, a risk accepted, an
 * approval decided, or the workspace mode changed.
 *
 * Pure helpers (filter evaluation, HMAC signing, payload building) live
 * here so they can be unit-tested in isolation. The Supabase-flavoured
 * dispatcher at the bottom is a thin orchestration layer over those
 * helpers + the existing `deliverToDestination`.
 */

import { createHmac, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AlertRuleFilters,
  AlertRuleTrigger,
} from "@/lib/alerts";
import type {
  GovernanceDecisionRow,
  GovernanceDecisionType,
  GovernanceMode,
} from "@/lib/governance/types";
import type { ScanSeverity } from "@/lib/scan-engine";
import { describeDecision } from "@/lib/audit/decision-format";
import { validateGenericWebhookUrlForOutbound } from "@/lib/webhook-ssrf";

// ---------------------------------------------------------------
// 1. Filter evaluation — pure, testable
// ---------------------------------------------------------------

export type GovernanceSignalContext = {
  decisionType: GovernanceDecisionType;
  severity?: ScanSeverity | null;
  source?: string | null;
  target?: string | null;
};

/**
 * Returns true when the rule's filter spec matches the signal context.
 *
 * Match semantics:
 *   - missing/empty filter array  => wildcard (match any value)
 *   - present array               => OR among items
 *   - multiple keys               => AND across keys
 *
 * `targetPatterns` is a case-insensitive substring match against the target.
 */
export function ruleFilterMatches(
  filters: AlertRuleFilters | null | undefined,
  ctx: GovernanceSignalContext
): boolean {
  if (!filters) return true;
  if (filters.severities && filters.severities.length > 0) {
    if (!ctx.severity || !filters.severities.includes(ctx.severity)) return false;
  }
  if (filters.sources && filters.sources.length > 0) {
    if (!ctx.source || !filters.sources.includes(ctx.source)) return false;
  }
  if (filters.decisionTypes && filters.decisionTypes.length > 0) {
    if (!filters.decisionTypes.includes(ctx.decisionType)) return false;
  }
  if (filters.targetPatterns && filters.targetPatterns.length > 0) {
    const target = (ctx.target ?? "").toLowerCase();
    const ok = filters.targetPatterns.some((p) => target.includes(p.toLowerCase()));
    if (!ok) return false;
  }
  return true;
}

// ---------------------------------------------------------------
// 2. Decision → trigger bag
// ---------------------------------------------------------------

/**
 * Returns the set of `alert_rules.rule_trigger` values that should fire
 * for the given decision type. Always includes the catch-all
 * `governance_decision` so subscribers can listen to "everything".
 */
export function triggersForDecisionType(t: GovernanceDecisionType): Set<AlertRuleTrigger> {
  const out = new Set<AlertRuleTrigger>(["governance_decision"]);
  switch (t) {
    case "apply_fix":
      out.add("fix_applied");
      break;
    case "accept_risk":
      out.add("risk_accepted");
      break;
    case "revoke_risk":
      out.add("risk_revoked");
      break;
    case "approve_fix":
    case "reject_fix":
      out.add("approval_decided");
      break;
    case "mode_change":
      out.add("mode_changed");
      break;
    case "interactive_response":
      // Catch-all only.
      break;
  }
  return out;
}

// ---------------------------------------------------------------
// 3. HMAC signing for outbound webhooks
// ---------------------------------------------------------------

export type SignedWebhookHeaders = {
  "x-torqa-event": string;
  "x-torqa-timestamp": string;
  "x-torqa-signature": string;
  "x-torqa-id": string;
};

/**
 * Compute the HMAC-SHA256 hex digest of `<timestamp>.<body>` using `secret`.
 * The format matches Slack's signing convention (so wide library support).
 */
export function signWebhookPayload(secret: string, body: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Build the headers we attach to every outbound webhook delivery so the
 * receiver can verify authenticity and dedupe by event id.
 */
export function buildSignedHeaders(opts: {
  event: AlertRuleTrigger;
  body: string;
  secret: string | null | undefined;
  eventId?: string;
  now?: number;
}): SignedWebhookHeaders {
  const ts = String(Math.floor((opts.now ?? Date.now()) / 1000));
  const id = opts.eventId ?? randomUUID();
  const signature = opts.secret
    ? `t=${ts},v1=${signWebhookPayload(opts.secret, opts.body, ts)}`
    : "";
  return {
    "x-torqa-event": opts.event,
    "x-torqa-timestamp": ts,
    "x-torqa-signature": signature,
    "x-torqa-id": id,
  };
}

// ---------------------------------------------------------------
// 4. Webhook payload builder
// ---------------------------------------------------------------

export type GovernanceWebhookPayload = {
  schema: "torqa.governance.v1";
  eventId: string;
  occurredAt: string;
  trigger: AlertRuleTrigger;
  workspace: { organizationId: string | null };
  decision: {
    id: string;
    type: GovernanceDecisionType;
    actorUserId: string;
    rationale: string | null;
    mode: GovernanceMode | null;
    scanId: string | null;
    findingSignature: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
    title: string;
    summary: string;
  };
  context: GovernanceSignalContext;
};

export function buildGovernanceWebhookPayload(opts: {
  decision: GovernanceDecisionRow & { organization_id: string | null };
  trigger: AlertRuleTrigger;
  context: GovernanceSignalContext;
  eventId?: string;
  occurredAt?: string;
}): GovernanceWebhookPayload {
  const desc = describeDecision(opts.decision);
  return {
    schema: "torqa.governance.v1",
    eventId: opts.eventId ?? randomUUID(),
    occurredAt: opts.occurredAt ?? opts.decision.created_at,
    trigger: opts.trigger,
    workspace: { organizationId: opts.decision.organization_id },
    decision: {
      id: opts.decision.id,
      type: opts.decision.decision_type,
      actorUserId: opts.decision.actor_user_id,
      rationale: opts.decision.rationale,
      mode: opts.decision.mode,
      scanId: opts.decision.scan_id,
      findingSignature: opts.decision.finding_signature,
      payload: opts.decision.payload,
      createdAt: opts.decision.created_at,
      title: desc.title,
      summary: desc.summary,
    },
    context: opts.context,
  };
}

// ---------------------------------------------------------------
// 5. Outbound webhook adapter (with HMAC + SSRF guard)
// ---------------------------------------------------------------

export type WebhookDeliveryOutcome =
  | { ok: true; status: number; signature: string }
  | { ok: false; error: string };

export async function postSignedGovernanceWebhook(opts: {
  url: string;
  body: string;
  secret: string | null | undefined;
  event: AlertRuleTrigger;
  eventId?: string;
  extraHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /**
   * Skip SSRF + URL validation. ONLY for unit tests; production code paths
   * always validate.
   */
  skipUrlValidation?: boolean;
}): Promise<WebhookDeliveryOutcome> {
  if (!opts.skipUrlValidation) {
    const v = validateGenericWebhookUrlForOutbound(opts.url);
    if (!v.ok) return { ok: false, error: v.message };
  }
  const headers = buildSignedHeaders({
    event: opts.event,
    body: opts.body,
    secret: opts.secret ?? null,
    eventId: opts.eventId,
  });
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetchImpl(opts.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "torqa-governance-webhook/0.3.0",
        ...headers,
        ...(opts.extraHeaders ?? {}),
      },
      body: opts.body,
      signal: ac.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `Webhook HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, signature: headers["x-torqa-signature"] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "webhook request failed" };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------
// 6. Supabase-flavoured dispatcher
// ---------------------------------------------------------------

type AlertRuleRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  enabled: boolean;
  rule_trigger: AlertRuleTrigger;
  destination_ids: string[];
  filters: unknown;
};

type DestinationRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: "in_app" | "slack" | "discord" | "email" | "webhook";
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

function rowToRule(raw: Record<string, unknown>): AlertRuleRow | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.user_id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.enabled !== "boolean" ||
    typeof raw.rule_trigger !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    user_id: raw.user_id,
    organization_id: typeof raw.organization_id === "string" ? raw.organization_id : null,
    name: raw.name,
    enabled: raw.enabled,
    rule_trigger: raw.rule_trigger as AlertRuleTrigger,
    destination_ids: Array.isArray(raw.destination_ids)
      ? (raw.destination_ids as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    filters: raw.filters ?? {},
  };
}

function rowToDestination(raw: Record<string, unknown>): DestinationRow | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.user_id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.enabled !== "boolean" ||
    typeof raw.type !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    user_id: raw.user_id,
    organization_id: typeof raw.organization_id === "string" ? raw.organization_id : null,
    type: raw.type as DestinationRow["type"],
    name: raw.name,
    enabled: raw.enabled,
    config:
      raw.config && typeof raw.config === "object" && !Array.isArray(raw.config)
        ? (raw.config as Record<string, unknown>)
        : {},
  };
}

function buildContext(decision: GovernanceDecisionRow): GovernanceSignalContext {
  const payload = decision.payload ?? {};
  const sev = typeof payload.severity === "string" ? (payload.severity as ScanSeverity) : null;
  const src = typeof payload.source === "string" ? payload.source : null;
  const target = typeof payload.target === "string" ? payload.target : null;
  return {
    decisionType: decision.decision_type,
    severity: sev,
    source: src,
    target,
  };
}

async function logSignalDelivery(
  admin: Pick<SupabaseClient, "from"> | null,
  opts: {
    userId: string;
    organizationId: string | null;
    decisionId: string;
    ruleId: string;
    ruleTrigger: AlertRuleTrigger;
    destination: DestinationRow;
    outcome: WebhookDeliveryOutcome | { ok: boolean; error?: string };
    signature?: string | null;
  }
): Promise<void> {
  if (!admin) return;
  try {
    await admin.from("alert_deliveries").insert({
      user_id: opts.userId,
      organization_id: opts.organizationId,
      decision_id: opts.decisionId,
      rule_id: opts.ruleId,
      destination_id: opts.destination.id,
      destination_type: opts.destination.type,
      rule_trigger: opts.ruleTrigger,
      status: opts.outcome.ok ? "ok" : "error",
      error_message: opts.outcome.ok ? null : ("error" in opts.outcome ? opts.outcome.error ?? null : null),
      signature_payload: opts.signature ?? null,
    });
  } catch {
    /* never break dispatch on telemetry failures */
  }
}

export type DispatcherDeps = {
  supabase: Pick<SupabaseClient, "from">;
  /** Same client may be used for telemetry; passed separately in case of admin/user split. */
  telemetry?: Pick<SupabaseClient, "from"> | null;
  /** Optional fetch override for unit tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Fan a freshly-recorded `governance_decisions` row out to all matching
 * alert rules and their destinations. Never throws; failures are logged
 * to `alert_deliveries` and silently swallowed.
 */
export async function dispatchGovernanceDecisionSignal(
  deps: DispatcherDeps,
  decision: GovernanceDecisionRow & { organization_id: string | null }
): Promise<void> {
  try {
    const triggers = triggersForDecisionType(decision.decision_type);
    const ctx = buildContext(decision);

    let rulesQuery = deps.supabase
      .from("alert_rules")
      .select("id, user_id, organization_id, name, enabled, rule_trigger, destination_ids, filters")
      .eq("enabled", true)
      .in("rule_trigger", Array.from(triggers));

    if (decision.organization_id) {
      rulesQuery = rulesQuery.eq("organization_id", decision.organization_id);
    } else {
      rulesQuery = rulesQuery.is("organization_id", null).eq("user_id", decision.actor_user_id);
    }

    const { data: ruleRows } = await rulesQuery;
    const rules: AlertRuleRow[] = (ruleRows ?? [])
      .map((r) => rowToRule(r as Record<string, unknown>))
      .filter((r): r is AlertRuleRow => r !== null);

    if (rules.length === 0) return;

    const destIdSet = new Set<string>();
    for (const r of rules) for (const id of r.destination_ids) destIdSet.add(id);
    if (destIdSet.size === 0) return;

    const { data: destRows } = await deps.supabase
      .from("alert_destinations")
      .select("id, user_id, organization_id, type, name, enabled, config")
      .in("id", Array.from(destIdSet))
      .eq("enabled", true);

    const destinationsById = new Map<string, DestinationRow>();
    for (const d of destRows ?? []) {
      const row = rowToDestination(d as Record<string, unknown>);
      if (row) destinationsById.set(row.id, row);
    }

    const delivered = new Set<string>(); // dedupe per-destination per-decision
    for (const rule of rules) {
      if (!ruleFilterMatches(normalizeFilters(rule.filters), ctx)) continue;
      for (const destId of rule.destination_ids) {
        if (delivered.has(destId)) continue;
        const dest = destinationsById.get(destId);
        if (!dest || !dest.enabled) continue;
        if (dest.type !== "webhook") continue; // Block 6 ships webhook only; future patches add slack/email rendering for governance events.

        const url = typeof dest.config.url === "string" ? dest.config.url.trim() : "";
        const secret = typeof dest.config.secret === "string" ? dest.config.secret : "";
        if (!url) continue;

        const payload = buildGovernanceWebhookPayload({
          decision,
          trigger: rule.rule_trigger,
          context: ctx,
        });
        const body = JSON.stringify(payload);
        const outcome = await postSignedGovernanceWebhook({
          url,
          body,
          secret,
          event: rule.rule_trigger,
          eventId: payload.eventId,
          fetchImpl: deps.fetchImpl,
        });

        await logSignalDelivery(deps.telemetry ?? deps.supabase, {
          userId: decision.actor_user_id,
          organizationId: decision.organization_id,
          decisionId: decision.id,
          ruleId: rule.id,
          ruleTrigger: rule.rule_trigger,
          destination: dest,
          outcome,
          signature: outcome.ok ? outcome.signature : null,
        });

        delivered.add(destId);
      }
    }
  } catch {
    /* swallow — telemetry-only path */
  }
}

function normalizeFilters(raw: unknown): AlertRuleFilters {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const v = raw as Record<string, unknown>;
  const out: AlertRuleFilters = {};
  for (const k of ["severities", "sources", "decisionTypes", "targetPatterns"] as const) {
    const arr = v[k];
    if (Array.isArray(arr)) {
      const list = arr.filter((x): x is string => typeof x === "string");
      if (list.length > 0) out[k] = list;
    }
  }
  return out;
}

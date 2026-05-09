/**
 * Governance Playbooks — v0.4.1
 * Deterministic trigger → condition → action pipeline.
 * No ML, no probabilistic logic. Pure rule evaluation.
 */

// ── Trigger types ─────────────────────────────────────────────────────────────

export type TriggerType =
  | "scan.fail"
  | "scan.review"
  | "scan.pass"
  | "trust_score.below"
  | "policy.violation"
  | "manual";

export type PlaybookTrigger =
  | { type: "scan.fail" }
  | { type: "scan.review" }
  | { type: "scan.pass" }
  | { type: "trust_score.below"; config: { threshold: number } }
  | { type: "policy.violation"; config: { rule_id: string } }
  | { type: "manual" };

// ── Conditions (optional filters) ─────────────────────────────────────────────

export type PlaybookCondition =
  | { field: "source"; op: "eq" | "neq"; value: string }
  | { field: "trust_score"; op: "lt" | "lte" | "gt" | "gte"; value: number }
  | { field: "findings_count"; op: "gt" | "gte"; value: number }
  | { field: "workflow_name"; op: "contains"; value: string };

// ── Action types ──────────────────────────────────────────────────────────────

export type ActionType =
  | "notify.slack"
  | "notify.email"
  | "notify.webhook"
  | "github.create_pr"
  | "scan.rescan"
  | "governance.accept_risk"
  | "governance.block";

export type PlaybookAction =
  | { type: "notify.slack";         config: { message: string; webhook_url?: string } }
  | { type: "notify.email";         config: { to: string; subject?: string; message: string } }
  | { type: "notify.webhook";       config: { url: string; method?: "POST" | "PUT"; headers?: Record<string, string> } }
  | { type: "github.create_pr";     config: { draft?: boolean; label?: string } }
  | { type: "scan.rescan";          config: { delay_minutes?: number } }
  | { type: "governance.accept_risk"; config: { rationale: string } }
  | { type: "governance.block";     config: { reason?: string } };

// ── Playbook ──────────────────────────────────────────────────────────────────

export type Playbook = {
  id: string;
  name: string;
  description: string | null;
  trigger: PlaybookTrigger;
  conditions: PlaybookCondition[];
  actions: PlaybookAction[];
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: "success" | "partial" | "failed" | null;
  run_count: number;
  created_at: string;
};

// ── Run result ────────────────────────────────────────────────────────────────

export type PlaybookRunLog = {
  action_type: ActionType;
  status: "ok" | "failed" | "skipped";
  message: string;
  ts: string;
};

export type PlaybookRun = {
  id: string;
  playbook_id: string;
  playbook_name?: string;
  triggered_by: "manual" | "scan" | "schedule" | "webhook";
  trigger_ref: string | null;
  status: "pending" | "running" | "success" | "partial" | "failed";
  actions_total: number;
  actions_ok: number;
  log: PlaybookRunLog[];
  started_at: string;
  finished_at: string | null;
};

// ── Context passed to each run ────────────────────────────────────────────────

export type PlaybookRunContext = {
  scan_id?: string;
  workflow_name?: string;
  trust_score?: number;
  decision?: string;
  source?: string;
  findings_count?: number;
  rule_id?: string;
};

// ── Trigger evaluation ────────────────────────────────────────────────────────

export function shouldTrigger(
  trigger: PlaybookTrigger,
  ctx: PlaybookRunContext
): boolean {
  switch (trigger.type) {
    case "scan.fail":
      return ctx.decision === "FAIL";
    case "scan.review":
      return ctx.decision === "NEEDS REVIEW";
    case "scan.pass":
      return ctx.decision === "PASS";
    case "trust_score.below":
      return typeof ctx.trust_score === "number" && ctx.trust_score < trigger.config.threshold;
    case "policy.violation":
      return ctx.rule_id === trigger.config.rule_id;
    case "manual":
      return true;
    default:
      return false;
  }
}

// ── Condition evaluation ──────────────────────────────────────────────────────

export function passesConditions(
  conditions: PlaybookCondition[],
  ctx: PlaybookRunContext
): boolean {
  if (conditions.length === 0) return true;
  for (const c of conditions) {
    if (!evaluateCondition(c, ctx)) return false;
  }
  return true;
}

function evaluateCondition(c: PlaybookCondition, ctx: PlaybookRunContext): boolean {
  switch (c.field) {
    case "source": {
      const v = ctx.source ?? "";
      return c.op === "eq" ? v === c.value : v !== c.value;
    }
    case "trust_score": {
      const v = ctx.trust_score ?? 0;
      if (c.op === "lt")  return v < c.value;
      if (c.op === "lte") return v <= c.value;
      if (c.op === "gt")  return v > c.value;
      if (c.op === "gte") return v >= c.value;
      return false;
    }
    case "findings_count": {
      const v = ctx.findings_count ?? 0;
      if (c.op === "gt")  return v > c.value;
      if (c.op === "gte") return v >= c.value;
      return false;
    }
    case "workflow_name": {
      return (ctx.workflow_name ?? "").toLowerCase().includes(c.value.toLowerCase());
    }
    default:
      return true;
  }
}

// ── Template interpolation ────────────────────────────────────────────────────

export function interpolate(template: string, ctx: PlaybookRunContext): string {
  return template
    .replace(/\{\{workflow_name\}\}/g, ctx.workflow_name ?? "unknown")
    .replace(/\{\{trust_score\}\}/g,   String(ctx.trust_score ?? "—"))
    .replace(/\{\{decision\}\}/g,      ctx.decision ?? "—")
    .replace(/\{\{source\}\}/g,        ctx.source ?? "unknown")
    .replace(/\{\{scan_id\}\}/g,       ctx.scan_id ?? "—");
}

// ── Action metadata (for UI rendering) ───────────────────────────────────────

export const ACTION_META: Record<ActionType, { label: string; color: string; description: string }> = {
  "notify.slack":          { label: "Slack",       color: "var(--amber)",   description: "Post a message to a Slack channel" },
  "notify.email":          { label: "Email",       color: "var(--accent)",  description: "Send an email notification" },
  "notify.webhook":        { label: "Webhook",     color: "var(--fg-3)",    description: "POST to a custom endpoint" },
  "github.create_pr":      { label: "GitHub PR",   color: "var(--emerald)", description: "Open a draft fix PR on GitHub" },
  "scan.rescan":           { label: "Re-scan",     color: "var(--cyan)",    description: "Queue a re-scan after a delay" },
  "governance.accept_risk":{ label: "Accept risk", color: "var(--amber)",   description: "Auto-accept risk with a rationale" },
  "governance.block":      { label: "Block",       color: "var(--rose)",    description: "Block the workflow from proceeding" },
};

export const TRIGGER_META: Record<TriggerType, { label: string; color: string; description: string }> = {
  "scan.fail":          { label: "Scan FAIL",      color: "var(--rose)",    description: "Fires when a scan decision is FAIL" },
  "scan.review":        { label: "Needs review",   color: "var(--amber)",   description: "Fires when a scan needs review" },
  "scan.pass":          { label: "Scan PASS",      color: "var(--emerald)", description: "Fires when a scan passes" },
  "trust_score.below":  { label: "Low trust",      color: "var(--amber)",   description: "Fires when trust score drops below threshold" },
  "policy.violation":   { label: "Rule violation", color: "var(--rose)",    description: "Fires when a specific rule is violated" },
  "manual":             { label: "Manual",         color: "var(--fg-3)",    description: "Triggered manually from the dashboard" },
};

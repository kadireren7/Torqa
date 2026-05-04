/**
 * Decision formatter — renders a `governance_decisions` row into a stable,
 * human-readable shape used by the audit timeline UI and the CSV/JSON export.
 *
 * Pure: same input → same output, no IO. Imported from API routes (CSV
 * builder), the audit page client, and tests.
 */

import type {
  GovernanceDecisionRow,
  GovernanceDecisionType,
} from "@/lib/governance/types";

export type DecisionTone = "info" | "warning" | "success" | "danger" | "muted";

export type DecisionDescriptor = {
  type: GovernanceDecisionType;
  label: string;
  shortLabel: string;
  tone: DecisionTone;
  /** Title that summarises *what happened* in the row, including target/signature when available. */
  title: string;
  /** One-liner describing the outcome (what changed, what was queued, etc.). */
  summary: string;
  /** Stable list of `{ key, value }` for the evidence panel. */
  details: { key: string; value: string }[];
};

const TYPE_META: Record<
  GovernanceDecisionType,
  { label: string; shortLabel: string; tone: DecisionTone }
> = {
  apply_fix: { label: "Fix applied", shortLabel: "fix", tone: "success" },
  accept_risk: { label: "Risk accepted", shortLabel: "accept", tone: "warning" },
  revoke_risk: { label: "Accepted risk revoked", shortLabel: "revoke", tone: "info" },
  approve_fix: { label: "Approval granted", shortLabel: "approve", tone: "success" },
  reject_fix: { label: "Approval rejected", shortLabel: "reject", tone: "danger" },
  mode_change: { label: "Governance mode changed", shortLabel: "mode", tone: "info" },
  interactive_response: {
    label: "Interactive response recorded",
    shortLabel: "response",
    tone: "muted",
  },
};

function safeString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function getPayloadField(row: GovernanceDecisionRow, key: string): string | null {
  const v = row.payload?.[key];
  return safeString(v);
}

function shortenSignature(sig: string | null): string {
  if (!sig) return "—";
  if (sig.length > 16) return `${sig.slice(0, 8)}…${sig.slice(-6)}`;
  return sig;
}

function buildTitle(row: GovernanceDecisionRow): string {
  const target = getPayloadField(row, "target");
  const ruleId = getPayloadField(row, "rule_id");
  const fromMode = getPayloadField(row, "from_mode");
  const toMode = getPayloadField(row, "to_mode");

  switch (row.decision_type) {
    case "apply_fix":
      return target
        ? `Applied fix on ${target}${ruleId ? ` (${ruleId})` : ""}`
        : "Applied fix";
    case "accept_risk":
      return target ? `Accepted risk on ${target}` : "Accepted a risk";
    case "revoke_risk":
      return target ? `Revoked accepted risk on ${target}` : "Revoked accepted risk";
    case "approve_fix":
      return target ? `Approved fix for ${target}` : "Approved a queued fix";
    case "reject_fix":
      return target ? `Rejected fix for ${target}` : "Rejected a queued fix";
    case "mode_change":
      return fromMode && toMode ? `Mode: ${fromMode} → ${toMode}` : "Governance mode changed";
    case "interactive_response":
      return target ? `Interactive response on ${target}` : "Recorded an interactive response";
    default:
      return "Governance decision";
  }
}

function buildSummary(row: GovernanceDecisionRow): string {
  const fixType = getPayloadField(row, "fix_type");
  const status = getPayloadField(row, "status");
  const expires = getPayloadField(row, "expires_at");
  const fromMode = getPayloadField(row, "from_mode");
  const toMode = getPayloadField(row, "to_mode");
  const response = getPayloadField(row, "response");
  const rationale = row.rationale ?? null;

  switch (row.decision_type) {
    case "apply_fix": {
      const parts: string[] = [];
      if (fixType) parts.push(`type ${fixType}`);
      if (row.mode) parts.push(`mode ${row.mode}`);
      return parts.length ? `Fix ${parts.join(" · ")}` : "Fix applied to workflow content.";
    }
    case "accept_risk": {
      const parts: string[] = [];
      if (rationale) parts.push(`reason: ${rationale}`);
      if (expires) parts.push(`expires ${expires}`);
      return parts.length ? parts.join(" · ") : "Risk accepted with no rationale.";
    }
    case "revoke_risk":
      return rationale ? `Revoked: ${rationale}` : "Accepted risk revoked.";
    case "approve_fix":
      return rationale ? `Approved: ${rationale}` : "Pending approval marked approved.";
    case "reject_fix":
      return rationale ? `Rejected: ${rationale}` : "Pending approval rejected.";
    case "mode_change":
      return fromMode && toMode
        ? `Switched workspace governance mode from ${fromMode} to ${toMode}.`
        : "Workspace governance mode changed.";
    case "interactive_response":
      if (response && rationale) return `Response: ${response} · ${rationale}`;
      if (response) return `Response: ${response}`;
      return rationale ?? "Interactive context captured.";
    default: {
      if (status) return `Status: ${status}`;
      return "Decision recorded.";
    }
  }
}

function buildDetails(row: GovernanceDecisionRow): { key: string; value: string }[] {
  const details: { key: string; value: string }[] = [];
  details.push({ key: "decision_type", value: row.decision_type });
  details.push({ key: "decision_id", value: row.id });
  details.push({ key: "actor_user_id", value: row.actor_user_id });
  details.push({ key: "created_at", value: row.created_at });
  if (row.mode) details.push({ key: "mode", value: row.mode });
  if (row.scan_id) details.push({ key: "scan_id", value: row.scan_id });
  if (row.finding_signature) details.push({ key: "signature", value: row.finding_signature });
  if (row.rationale) details.push({ key: "rationale", value: row.rationale });
  // Surface known payload fields so the evidence drawer is consistent.
  const interesting = [
    "target",
    "rule_id",
    "source",
    "severity",
    "fix_type",
    "from_mode",
    "to_mode",
    "expires_at",
    "approval_id",
    "response",
    "status",
  ];
  for (const k of interesting) {
    const v = getPayloadField(row, k);
    if (v !== null) details.push({ key: `payload.${k}`, value: v });
  }
  return details;
}

export function describeDecision(row: GovernanceDecisionRow): DecisionDescriptor {
  const meta = TYPE_META[row.decision_type] ?? {
    label: row.decision_type,
    shortLabel: row.decision_type,
    tone: "muted" as DecisionTone,
  };
  return {
    type: row.decision_type,
    label: meta.label,
    shortLabel: meta.shortLabel,
    tone: meta.tone,
    title: buildTitle(row),
    summary: buildSummary(row),
    details: buildDetails(row),
  };
}

export function shortSignature(sig: string | null | undefined): string {
  return shortenSignature(sig ?? null);
}

export const DECISION_TYPES_FOR_FILTERS: GovernanceDecisionType[] = [
  "apply_fix",
  "accept_risk",
  "revoke_risk",
  "approve_fix",
  "reject_fix",
  "mode_change",
  "interactive_response",
];

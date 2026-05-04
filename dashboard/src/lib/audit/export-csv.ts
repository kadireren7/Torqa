/**
 * Audit CSV serializer — converts a list of governance_decisions rows into a
 * stable, RFC-4180-friendly CSV string.
 *
 * Pure: server-only, no IO. Used by the audit export endpoint and tests.
 */

import { describeDecision } from "@/lib/audit/decision-format";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

const HEADERS = [
  "decision_id",
  "created_at",
  "decision_type",
  "label",
  "title",
  "summary",
  "scope_organization_id",
  "actor_user_id",
  "actor_display_name",
  "scan_id",
  "finding_signature",
  "mode",
  "rationale",
  "payload_json",
];

export type ExportRowInput = {
  row: GovernanceDecisionRow & { organization_id?: string | null };
  actorDisplayName?: string | null;
};

function escape(value: string): string {
  if (value === "") return "";
  // Always wrap in double quotes when value contains a delimiter, quote, or newline.
  const needsQuoting = /[",\n\r]/.test(value);
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

export function buildAuditCsv(items: ExportRowInput[]): string {
  const lines: string[] = [];
  lines.push(HEADERS.map(escape).join(","));
  for (const { row, actorDisplayName } of items) {
    const desc = describeDecision(row);
    const orgId = row.organization_id ?? "";
    const cells = [
      row.id ?? "",
      row.created_at ?? "",
      row.decision_type ?? "",
      desc.label ?? "",
      desc.title ?? "",
      desc.summary ?? "",
      orgId,
      row.actor_user_id ?? "",
      actorDisplayName ?? "",
      row.scan_id ?? "",
      row.finding_signature ?? "",
      row.mode ?? "",
      row.rationale ?? "",
      safeJson(row.payload),
    ].map((v) => escape(typeof v === "string" ? v : String(v ?? "")));
    lines.push(cells.join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

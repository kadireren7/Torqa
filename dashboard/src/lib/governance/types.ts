/**
 * Torqa v0.2.1 — Governance Engine shared types.
 *
 * Drives the Fix Engine + Operation Mode Engine + Accepted Risk Registry.
 * Kept dependency-free so it can be imported from API routes, server libs, and client UI.
 */

import type { ScanSeverity } from "@/lib/scan-engine";

/**
 * Operation modes for the governance engine. Selected per workspace (or per-run override later).
 *
 * - autonomous:   Safe-auto fixes apply immediately; manual/structural still queue.
 * - supervised:   Every fix proposal queues for human approval (default).
 * - interactive:  Each finding asks for user response (rationale / accept / fix); response is
 *                 remembered as context so the same prompt is not asked again on re-scan.
 */
export type GovernanceMode = "autonomous" | "supervised" | "interactive";

export type GovernanceModeScope = "org" | "personal";

export type GovernanceModeView = {
  mode: GovernanceMode;
  scope: GovernanceModeScope;
  /** Whether the current actor can change the mode (org admin, or always for personal). */
  canChange: boolean;
  organizationId: string | null;
};

/**
 * Fix categories — surfaced by the dashboard fix-engine for every finding.
 *
 * - safe_auto:        Deterministic, reversible patch the engine can apply with no judgment.
 * - structural:       Mechanical change but with non-trivial side effects (node move, key rename).
 * - manual_required:  Engine cannot mutate safely; humans must intervene.
 */
export type FixType = "safe_auto" | "structural" | "manual_required";

/**
 * Minimal RFC6902-inspired patch op. We only support `add`, `replace`, `remove`
 * because the deterministic fixer never needs `move/copy/test`.
 *
 * `path` is a JSON pointer (e.g. "/parameters/rejectUnauthorized") rooted at the
 * workflow content object the user submitted to /api/scan.
 */
export type JsonPatchOp =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };

export type FixProposal = {
  /** Stable signature of the finding this fix targets (sha256 of rule_id|target|source). */
  signature: string;
  /** Severity carried over from the finding so UI can colour the dialog correctly. */
  severity: ScanSeverity;
  rule_id: string;
  target: string;
  type: FixType;
  /** Human-readable explanation of what the fix does and why. */
  explanation: string;
  /** RFC6902-lite patch ops to apply onto the workflow content. Empty for manual_required. */
  patch: JsonPatchOp[];
  /** Optional preview of just the diffed sub-tree (before/after) to render quickly. */
  preview?: {
    before: unknown;
    after: unknown;
  } | null;
};

/**
 * Marker attached to findings already covered by an active accepted-risk row.
 * UI can dim the finding and skip gate deductions for it.
 */
export type AcceptedRiskMarker = {
  id: string;
  acceptedAt: string;
  expiresAt: string | null;
  rationale: string;
};

export type AcceptedRiskRow = {
  id: string;
  finding_signature: string;
  rule_id: string;
  source: string;
  target: string;
  severity: ScanSeverity;
  rationale: string;
  organization_id: string | null;
  accepted_by: string;
  accepted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type AcceptedRiskInput = {
  signature: string;
  rule_id: string;
  source: string;
  target: string;
  severity: ScanSeverity;
  rationale: string;
  /** ISO 8601 datetime, or null for no expiry. */
  expires_at: string | null;
};

export type PendingApprovalRow = {
  id: string;
  scan_id: string | null;
  finding_signature: string;
  rule_id: string;
  source: string;
  target: string;
  severity: ScanSeverity;
  fix_type: FixType;
  fix_patch: JsonPatchOp[];
  before_value: unknown;
  after_value: unknown;
  explanation: string | null;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decided_rationale: string | null;
};

export type GovernanceDecisionType =
  | "apply_fix"
  | "accept_risk"
  | "revoke_risk"
  | "approve_fix"
  | "reject_fix"
  | "mode_change"
  | "interactive_response";

export type GovernanceDecisionRow = {
  id: string;
  scan_id: string | null;
  finding_signature: string | null;
  decision_type: GovernanceDecisionType;
  mode: GovernanceMode | null;
  actor_user_id: string;
  rationale: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

/** Validates a string is one of the recognized governance modes. */
export function isGovernanceMode(value: unknown): value is GovernanceMode {
  return value === "autonomous" || value === "supervised" || value === "interactive";
}

/** Validates a string is one of the recognized fix types. */
export function isFixType(value: unknown): value is FixType {
  return value === "safe_auto" || value === "structural" || value === "manual_required";
}

export const DEFAULT_GOVERNANCE_MODE: GovernanceMode = "supervised";

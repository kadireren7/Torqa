/**
 * Torqa SDK — public types.
 *
 * These intentionally mirror the wire format of the dashboard's public API
 * (`/api/public/...`). The dashboard owns the source of truth for the inner
 * types; this file is a stable, dependency-free subset that consumers can
 * import without pulling in Next.js or Supabase.
 */

export type ScanSeverity = "info" | "review" | "high" | "critical";

export type ScanSource =
  | "n8n"
  | "github"
  | "generic"
  | "webhook"
  | "pipedream"
  | "ai-agent"
  | "make"
  | "zapier"
  | "lambda";

export type PolicyVerdict = "pass" | "review" | "block";

export type GovernanceDecisionType =
  | "apply_fix"
  | "accept_risk"
  | "revoke_risk"
  | "approve_fix"
  | "reject_fix"
  | "mode_change"
  | "interactive_response";

export type ScanFinding = {
  severity: ScanSeverity;
  rule_id: string;
  target: string;
  explanation?: string;
  suggested_fix?: string;
  signature?: string;
  accepted_risk?: boolean;
};

export type RuleHit = {
  ruleId: string;
  ruleName: string;
  scope: "finding" | "scan";
  verdict: PolicyVerdict;
  message: string | null;
  findingSignature: string | null;
  findingRuleId: string | null;
  findingTarget: string | null;
};

export type PolicyEvaluation = {
  verdict: PolicyVerdict;
  gateStatus: "PASS" | "NEEDS REVIEW" | "FAIL";
  packName: string;
  packId: string | null;
  hits: RuleHit[];
  reasons: string[];
};

export type GovernanceDecision = {
  id: string;
  scan_id: string | null;
  finding_signature: string | null;
  decision_type: GovernanceDecisionType;
  mode: "autonomous" | "supervised" | "interactive" | null;
  actor_user_id: string;
  rationale: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  organization_id?: string | null;
  user_id?: string;
};

export type PolicyPackSummary = {
  id: string;
  organizationId: string | null;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  level: "workspace" | "source";
  sourceType: ScanSource | null;
  parentPackId: string | null;
  parentTemplateSlug: string | null;
  defaultVerdict: PolicyVerdict;
  enabled: boolean;
  rules: unknown[];
  createdAt: string;
  updatedAt: string;
};

export type SimulationSummary = {
  range: "last-7-days" | "last-30-days" | "last-90-days";
  totalScans: number;
  evaluated: number;
  outcomes: { pass: number; review: number; block: number };
  newlyBlocked: number;
  newlyPassed: number;
  newlyReview: number;
  outcomesPreview?: unknown[];
};

export type AcceptedRiskRow = {
  id: string;
  finding_signature: string;
  rule_id: string;
  source: string;
  target: string;
  severity: ScanSeverity;
  rationale: string;
  accepted_at: string;
  expires_at: string | null;
};

export type PublicApiSuccess<T> = {
  ok: true;
  data: T;
  meta: { requestId: string; apiVersion: "v1" };
};

export type PublicApiError = {
  ok: false;
  error: { code: string; message: string };
  meta: { requestId: string; apiVersion: "v1" };
};

export type PublicApiResponse<T> = PublicApiSuccess<T> | PublicApiError;

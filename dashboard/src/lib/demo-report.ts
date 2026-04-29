import type { ScanApiSuccess } from "@/lib/scan-engine";

export const demoScanReport: ScanApiSuccess = {
  status: "NEEDS REVIEW",
  riskScore: 62,
  source: "n8n",
  engine: "server-v1",
  engine_mode: "hosted_python",
  analysis_kind: "real_engine",
  fallback: {
    fallback_used: false,
    fallback_from: null,
    fallback_to: null,
    fallback_reason: null,
  },
  totals: {
    high: 1,
    review: 2,
    info: 1,
    all: 4,
  },
  findings: [
    {
      severity: "critical",
      rule_id: "n8n_plaintext_secret",
      target: "Node: Slack Notify",
      explanation: "Credential-like token appears in workflow JSON.",
      suggested_fix: "Move token to n8n credentials and rotate the exposed value.",
    },
    {
      severity: "review",
      rule_id: "n8n_webhook_auth_missing",
      target: "Trigger: /support-webhook",
      explanation: "Incoming webhook endpoint does not declare authentication controls.",
      suggested_fix: "Require HMAC or API key validation before processing webhook payloads.",
    },
    {
      severity: "review",
      rule_id: "n8n_error_path_missing",
      target: "Node: Create Ticket",
      explanation: "Node has no explicit retry/error branch for failed API calls.",
      suggested_fix: "Add retry limits and a dead-letter/alert path for failed requests.",
    },
    {
      severity: "info",
      rule_id: "workflow_metadata_owner_missing",
      target: "workflow.metadata.owner",
      explanation: "Workflow metadata does not include a clear owner value.",
      suggested_fix: "Set an owner/team alias so alerts and follow-up actions route correctly.",
    },
  ],
  policyEvaluation: {
    policyStatus: "WARN",
    appliedPolicyName: "Team baseline",
    violations: [
      {
        code: "policy.secret.plaintext",
        message: "Plaintext secret detected in workflow payload.",
        severity: "warning",
      },
    ],
    recommendations: [
      "Block release when plaintext credentials are present.",
      "Enable webhook auth checks for all internet-facing triggers.",
    ],
  },
};

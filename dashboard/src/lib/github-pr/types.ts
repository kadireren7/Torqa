import type { ScanDecision, ScanFinding, ScanSource } from "@/lib/scan-engine";

export type PullRequestWebhookContext = {
  action: string;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  installationId: number | null;
};

export type PrFileScanRow = {
  path: string;
  skipped?: string;
  source?: ScanSource;
  decision?: ScanDecision;
  riskScore?: number;
  findings?: ScanFinding[];
  error?: string;
};

export type PrScanAggregate = {
  files: PrFileScanRow[];
  overallStatus: ScanDecision;
  overallRisk: number;
  criticalHighCount: number;
  topFindings: ScanFinding[];
};

export type PullRequestWebhookResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  pr?: { owner: string; repo: string; number: number };
  aggregate?: PrScanAggregate;
  comment?: { posted: boolean; updated?: boolean; mode?: "app" | "pat"; detail?: string };
};

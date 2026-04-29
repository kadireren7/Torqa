import { describe, expect, it } from "vitest";
import { TORQA_PR_COMMENT_MARKER } from "@/lib/github-pr/constants";
import { buildPrScanCommentMarkdown } from "@/lib/github-pr/pr-comment-markdown";
import type { PrScanAggregate } from "@/lib/github-pr/types";

function sampleAggregate(): PrScanAggregate {
  return {
    files: [
      {
        path: "w.json",
        source: "generic",
        decision: "NEEDS REVIEW",
        riskScore: 80,
        findings: [
          {
            severity: "high",
            rule_id: "v1.generic.http_plaintext_url",
            target: "json",
            explanation: "HTTP URL in JSON.",
            suggested_fix: "Use HTTPS.",
          },
        ],
      },
    ],
    overallStatus: "NEEDS REVIEW",
    overallRisk: 80,
    criticalHighCount: 1,
    topFindings: [
      {
        severity: "high",
        rule_id: "w.json: v1.generic.http_plaintext_url",
        target: "json",
        explanation: "HTTP URL in JSON.",
        suggested_fix: "Use HTTPS.",
      },
    ],
  };
}

describe("buildPrScanCommentMarkdown", () => {
  it("includes marker, table, findings, and optional dashboard link", () => {
    const md = buildPrScanCommentMarkdown(sampleAggregate(), {
      owner: "acme",
      repo: "r",
      prNumber: 3,
      dashboardBaseUrl: "https://dash.example.com",
    });
    expect(md.startsWith(TORQA_PR_COMMENT_MARKER)).toBe(true);
    expect(md).toContain("| **Status** | **NEEDS REVIEW** |");
    expect(md).toContain("| **Risk score** | 80 / 100 |");
    expect(md).toContain("| **Critical + high findings** | 1 |");
    expect(md).toContain("https://dash.example.com/scan");
    expect(md).toContain("**HIGH**");
  });

  it("omits dashboard link when base url null", () => {
    const md = buildPrScanCommentMarkdown(sampleAggregate(), {
      owner: "acme",
      repo: "r",
      prNumber: 3,
      dashboardBaseUrl: null,
    });
    expect(md).not.toContain("Open scan workspace");
  });
});

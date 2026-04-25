/** Example CLI-shaped payloads for run detail UI (mock). */

export function getMockResultJson(runId: string): object | null {
  if (runId === "run_001") {
    return {
      schema: "torqa.cli.scan.v1",
      ok: true,
      path: "/repo/specs",
      profile: "default",
      summary: { total_files: 24, safe: 18, needs_review: 4, blocked: 2 },
      rows: [
        {
          file: "handoff/login.tq",
          decision: "SAFE_TO_HANDOFF",
          risk: "low",
          trust_profile: "default",
          reason: "Within current heuristics.",
        },
        {
          file: "handoff/payout.json",
          decision: "BLOCKED",
          risk: "high",
          trust_profile: "default",
          reason: "Policy: elevated external access without compensating controls.",
        },
      ],
    };
  }
  if (runId === "run_002") {
    return {
      schema: "torqa.cli.scan.v1",
      ok: false,
      path: "/repo/ai-out",
      profile: "strict",
      summary: { total_files: 12, safe: 4, needs_review: 3, blocked: 5 },
      rows: [],
    };
  }
  if (runId === "run_003") {
    return {
      schema: "torqa.cli.validate.v1",
      ok: true,
      path: "/repo/specs/core.bundle.json",
      profile: "enterprise",
      input_type: "json",
      bundles: [
        {
          suffix: "",
          load: "ok",
          result: "pass",
          policy: { trust_profile: "enterprise", policy_ok: true, risk_level: "low" },
        },
      ],
    };
  }
  return null;
}

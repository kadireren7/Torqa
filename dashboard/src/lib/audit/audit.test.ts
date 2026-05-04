import { describe, expect, it } from "vitest";
import { describeDecision, shortSignature } from "./decision-format";
import { buildAuditCsv } from "./export-csv";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

function makeDecision(partial: Partial<GovernanceDecisionRow>): GovernanceDecisionRow {
  return {
    id: partial.id ?? "00000000-0000-0000-0000-000000000001",
    scan_id: partial.scan_id ?? null,
    finding_signature: partial.finding_signature ?? null,
    decision_type: partial.decision_type ?? "apply_fix",
    mode: partial.mode ?? "supervised",
    actor_user_id: partial.actor_user_id ?? "user-1",
    rationale: partial.rationale ?? null,
    payload: partial.payload ?? {},
    created_at: partial.created_at ?? "2026-05-04T10:00:00.000Z",
  };
}

describe("describeDecision", () => {
  it("renders apply_fix with target + rule_id", () => {
    const desc = describeDecision(
      makeDecision({
        decision_type: "apply_fix",
        payload: { target: "node:http", rule_id: "v1.http.tls_off", fix_type: "safe_auto" },
        mode: "autonomous",
      })
    );
    expect(desc.label).toBe("Fix applied");
    expect(desc.tone).toBe("success");
    expect(desc.title).toContain("node:http");
    expect(desc.title).toContain("v1.http.tls_off");
    expect(desc.summary.toLowerCase()).toContain("safe_auto");
    expect(desc.summary.toLowerCase()).toContain("autonomous");
  });

  it("renders accept_risk with rationale and expiry", () => {
    const desc = describeDecision(
      makeDecision({
        decision_type: "accept_risk",
        rationale: "Vendor approved exception",
        payload: { target: "wf:root", expires_at: "2026-12-01T00:00:00.000Z" },
      })
    );
    expect(desc.label).toBe("Risk accepted");
    expect(desc.tone).toBe("warning");
    expect(desc.summary).toContain("Vendor approved exception");
    expect(desc.summary).toContain("2026-12-01");
  });

  it("renders mode_change with from → to", () => {
    const desc = describeDecision(
      makeDecision({
        decision_type: "mode_change",
        payload: { from_mode: "supervised", to_mode: "autonomous" },
      })
    );
    expect(desc.title).toBe("Mode: supervised → autonomous");
    expect(desc.summary).toContain("supervised");
    expect(desc.summary).toContain("autonomous");
  });

  it("includes signature in details when present", () => {
    const desc = describeDecision(
      makeDecision({
        finding_signature: "abcd1234ef567890",
        decision_type: "approve_fix",
      })
    );
    const sigDetail = desc.details.find((d) => d.key === "signature");
    expect(sigDetail?.value).toBe("abcd1234ef567890");
  });

  it("falls back to muted descriptor for unknown decision types", () => {
    const desc = describeDecision(
      makeDecision({
        decision_type: "interactive_response",
        payload: { response: "fix", target: "node:agent" },
      })
    );
    expect(desc.shortLabel).toBe("response");
    expect(desc.summary.toLowerCase()).toContain("fix");
  });
});

describe("shortSignature", () => {
  it("ellipses long signatures", () => {
    expect(shortSignature("abcdef0123456789abcdef0123456789")).toMatch(/…/);
  });
  it("returns dash for null", () => {
    expect(shortSignature(null)).toBe("—");
  });
  it("preserves short signatures", () => {
    expect(shortSignature("abc123")).toBe("abc123");
  });
});

describe("buildAuditCsv", () => {
  it("emits a header and one row per input", () => {
    const csv = buildAuditCsv([
      {
        row: makeDecision({
          id: "00000000-0000-0000-0000-000000000010",
          decision_type: "apply_fix",
          payload: { target: "node:fetch", fix_type: "safe_auto" },
        }),
        actorDisplayName: "Alice",
      },
    ]);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("decision_id");
    expect(lines[1]).toContain("apply_fix");
    expect(lines[1]).toContain("Alice");
  });

  it("escapes quotes and commas", () => {
    const csv = buildAuditCsv([
      {
        row: makeDecision({
          rationale: 'comma, "quoted"',
          payload: { target: "wf,with,comma" },
          decision_type: "accept_risk",
        }),
      },
    ]);
    expect(csv).toContain('"comma, ""quoted"""');
    expect(csv).toContain('"wf,with,comma"');
  });

  it("includes JSON-encoded payload for downstream tooling", () => {
    const payload = { target: "x", level: 7 };
    const csv = buildAuditCsv([
      {
        row: makeDecision({ decision_type: "apply_fix", payload }),
      },
    ]);
    expect(csv).toContain(JSON.stringify(payload).replace(/"/g, '""'));
  });
});

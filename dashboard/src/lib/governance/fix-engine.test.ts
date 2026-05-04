import { describe, expect, it } from "vitest";
import type { ScanFinding } from "@/lib/scan-engine";
import { buildFindingSignature } from "@/lib/governance/finding-signature";
import { buildFixProposalForFinding } from "@/lib/governance/fix-engine";
import { applyJsonPatch } from "@/lib/governance/json-patch";

const N8N_TLS_BYPASS = {
  name: "demo",
  nodes: [
    {
      id: "n1",
      name: "HTTP",
      type: "n8n-nodes-base.httpRequest",
      parameters: {
        url: "https://example.com/api",
        rejectUnauthorized: false,
        allowUnauthorizedCerts: true,
      },
    },
  ],
  connections: {},
};

const TLS_FINDING: ScanFinding = {
  severity: "critical",
  rule_id: "v1.http.tls_verification_disabled",
  target: "HTTP (n1)",
  explanation: "x",
  suggested_fix: "x",
};

describe("governance/fix-engine", () => {
  it("produces deterministic finding signatures", () => {
    const a = buildFindingSignature({ source: "n8n", rule_id: "r", target: "t" });
    const b = buildFindingSignature({ source: "n8n", rule_id: "r", target: "t" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    const different = buildFindingSignature({ source: "n8n", rule_id: "r", target: "T" });
    expect(different).not.toBe(a);
  });

  it("builds a safe_auto fix for tls_verification_disabled and applies cleanly", () => {
    const proposal = buildFixProposalForFinding(TLS_FINDING, "n8n", N8N_TLS_BYPASS);
    expect(proposal.type).toBe("safe_auto");
    expect(proposal.patch.length).toBeGreaterThan(0);
    expect(proposal.signature).toMatch(/^[0-9a-f]{64}$/);

    const after = applyJsonPatch(N8N_TLS_BYPASS, proposal.patch) as typeof N8N_TLS_BYPASS;
    expect(after.nodes[0].parameters.rejectUnauthorized).toBe(true);
    expect(after.nodes[0].parameters.allowUnauthorizedCerts).toBe(false);
    // Original untouched.
    expect(N8N_TLS_BYPASS.nodes[0].parameters.rejectUnauthorized).toBe(false);
  });

  it("falls back to manual_required when no rule-specific builder exists", () => {
    const f: ScanFinding = {
      severity: "review",
      rule_id: "v1.unknown.rule",
      target: "workflow",
      explanation: "x",
      suggested_fix: "do something manual",
    };
    const proposal = buildFixProposalForFinding(f, "generic", {});
    expect(proposal.type).toBe("manual_required");
    expect(proposal.patch).toEqual([]);
  });

  it("never mutates the original document via applyJsonPatch", () => {
    const before = { a: { b: 1 } };
    const after = applyJsonPatch(before, [{ op: "replace", path: "/a/b", value: 2 }]);
    expect(after).toEqual({ a: { b: 2 } });
    expect(before).toEqual({ a: { b: 1 } });
  });

  it("rejects prototype pollution attempts", () => {
    expect(() =>
      applyJsonPatch({ x: 1 }, [{ op: "add", path: "/__proto__/polluted", value: true } as never])
    ).toThrow();
  });
});

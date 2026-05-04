import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildGovernanceWebhookPayload,
  buildSignedHeaders,
  dispatchGovernanceDecisionSignal,
  postSignedGovernanceWebhook,
  ruleFilterMatches,
  signWebhookPayload,
  triggersForDecisionType,
} from "./governance-signals";
import type { GovernanceDecisionRow } from "@/lib/governance/types";

function makeDecision(
  partial: Partial<GovernanceDecisionRow & { organization_id: string | null }> = {}
): GovernanceDecisionRow & { organization_id: string | null } {
  return {
    id: partial.id ?? "00000000-0000-0000-0000-000000000111",
    scan_id: partial.scan_id ?? null,
    finding_signature: partial.finding_signature ?? null,
    decision_type: partial.decision_type ?? "apply_fix",
    mode: partial.mode ?? "supervised",
    actor_user_id: partial.actor_user_id ?? "u1",
    rationale: partial.rationale ?? null,
    payload: partial.payload ?? {},
    created_at: partial.created_at ?? "2026-05-04T10:00:00.000Z",
    organization_id: partial.organization_id ?? null,
  };
}

describe("triggersForDecisionType", () => {
  it("always includes the catch-all governance_decision", () => {
    expect(triggersForDecisionType("apply_fix").has("governance_decision")).toBe(true);
    expect(triggersForDecisionType("interactive_response").has("governance_decision")).toBe(true);
  });

  it("maps decision types to specific triggers", () => {
    expect(triggersForDecisionType("apply_fix").has("fix_applied")).toBe(true);
    expect(triggersForDecisionType("accept_risk").has("risk_accepted")).toBe(true);
    expect(triggersForDecisionType("revoke_risk").has("risk_revoked")).toBe(true);
    expect(triggersForDecisionType("approve_fix").has("approval_decided")).toBe(true);
    expect(triggersForDecisionType("reject_fix").has("approval_decided")).toBe(true);
    expect(triggersForDecisionType("mode_change").has("mode_changed")).toBe(true);
  });
});

describe("ruleFilterMatches", () => {
  const ctx = {
    decisionType: "apply_fix" as const,
    severity: "high" as const,
    source: "n8n",
    target: "node:http_request_1",
  };

  it("treats null/empty filters as a wildcard", () => {
    expect(ruleFilterMatches(null, ctx)).toBe(true);
    expect(ruleFilterMatches({}, ctx)).toBe(true);
  });

  it("AND-s across keys, OR-s within arrays", () => {
    expect(ruleFilterMatches({ severities: ["high", "critical"] }, ctx)).toBe(true);
    expect(ruleFilterMatches({ severities: ["info"] }, ctx)).toBe(false);
    expect(ruleFilterMatches({ sources: ["n8n", "github"] }, ctx)).toBe(true);
    expect(ruleFilterMatches({ sources: ["github"] }, ctx)).toBe(false);
    expect(
      ruleFilterMatches(
        { severities: ["high"], sources: ["github"] }, // AND fails on source
        ctx
      )
    ).toBe(false);
  });

  it("matches decision types and target substrings (case insensitive)", () => {
    expect(ruleFilterMatches({ decisionTypes: ["apply_fix"] }, ctx)).toBe(true);
    expect(ruleFilterMatches({ decisionTypes: ["accept_risk"] }, ctx)).toBe(false);
    expect(ruleFilterMatches({ targetPatterns: ["HTTP"] }, ctx)).toBe(true);
    expect(ruleFilterMatches({ targetPatterns: ["payment"] }, ctx)).toBe(false);
  });

  it("rejects when context is missing a filtered field", () => {
    expect(
      ruleFilterMatches({ severities: ["high"] }, { ...ctx, severity: null })
    ).toBe(false);
    expect(
      ruleFilterMatches({ sources: ["n8n"] }, { ...ctx, source: null })
    ).toBe(false);
  });
});

describe("signWebhookPayload + buildSignedHeaders", () => {
  it("matches a manual HMAC-SHA256 of `${ts}.${body}`", () => {
    const sig = signWebhookPayload("supersecretkey", "hello", "1234567890");
    const expected = createHmac("sha256", "supersecretkey")
      .update("1234567890.hello")
      .digest("hex");
    expect(sig).toBe(expected);
  });

  it("emits all four headers and a Slack-style v1 signature when secret is set", () => {
    const headers = buildSignedHeaders({
      event: "fix_applied",
      body: "{}",
      secret: "secret123secret123",
      eventId: "evt-1",
      now: 1_700_000_000_000,
    });
    expect(headers["x-torqa-event"]).toBe("fix_applied");
    expect(headers["x-torqa-id"]).toBe("evt-1");
    expect(headers["x-torqa-timestamp"]).toBe("1700000000");
    expect(headers["x-torqa-signature"]).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
  });

  it("emits an empty signature header when no secret is configured", () => {
    const headers = buildSignedHeaders({
      event: "governance_decision",
      body: "{}",
      secret: null,
      eventId: "evt-2",
      now: 1_700_000_000_000,
    });
    expect(headers["x-torqa-signature"]).toBe("");
  });
});

describe("buildGovernanceWebhookPayload", () => {
  it("renders the governance.v1 envelope with title + summary derived from describeDecision", () => {
    const payload = buildGovernanceWebhookPayload({
      decision: makeDecision({
        decision_type: "apply_fix",
        payload: { target: "node:http_request_1", rule_id: "v1.http.tls", fix_type: "safe_auto" },
      }),
      trigger: "fix_applied",
      context: {
        decisionType: "apply_fix",
        severity: "high",
        source: "n8n",
        target: "node:http_request_1",
      },
      eventId: "evt-test",
      occurredAt: "2026-05-04T10:00:00.000Z",
    });
    expect(payload.schema).toBe("torqa.governance.v1");
    expect(payload.eventId).toBe("evt-test");
    expect(payload.trigger).toBe("fix_applied");
    expect(payload.decision.title).toContain("node:http_request_1");
    expect(payload.decision.summary.toLowerCase()).toContain("safe_auto");
    expect(payload.context.severity).toBe("high");
  });
});

describe("postSignedGovernanceWebhook", () => {
  it("posts JSON with signature headers and resolves on 2xx", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));
    const out = await postSignedGovernanceWebhook({
      url: "https://hooks.example.com/x",
      body: '{"a":1}',
      secret: "secret123secret123",
      event: "fix_applied",
      eventId: "evt-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const args = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = (args?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-torqa-event"]).toBe("fix_applied");
    expect(headers["x-torqa-id"]).toBe("evt-1");
  });

  it("rejects loopback URLs via SSRF guard", async () => {
    const fetchImpl = vi.fn();
    const out = await postSignedGovernanceWebhook({
      url: "https://127.0.0.1/x",
      body: "{}",
      secret: null,
      event: "fix_applied",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns ok:false on non-2xx HTTP", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 502 }));
    const out = await postSignedGovernanceWebhook({
      url: "https://hooks.example.com/x",
      body: "{}",
      secret: null,
      event: "fix_applied",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("502");
  });
});

describe("dispatchGovernanceDecisionSignal", () => {
  type MockTable = {
    select?: (...args: unknown[]) => MockTable;
    eq?: (...args: unknown[]) => MockTable;
    is?: (...args: unknown[]) => MockTable;
    in?: (...args: unknown[]) => MockTable;
    insert?: (row: unknown) => Promise<{ error: null }>;
    then?: (cb: (r: { data: unknown[]; error: null }) => unknown) => Promise<unknown>;
  };

  function thenable(rows: unknown[]): MockTable {
    return {
      then(cb) {
        return Promise.resolve(cb({ data: rows, error: null }));
      },
    };
  }

  it("queries rules + destinations and calls fetch once for matching webhook destination", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));
    const usageInsert = vi.fn(async () => ({ error: null }));

    const ruleQuery: MockTable = {
      select() {
        return {
          eq() {
            return {
              in() {
                return {
                  is() {
                    return {
                      eq() {
                        return thenable([
                          {
                            id: "r1",
                            user_id: "u1",
                            organization_id: null,
                            name: "Rule",
                            enabled: true,
                            rule_trigger: "fix_applied",
                            destination_ids: ["d1"],
                            filters: { sources: ["n8n"] },
                          },
                        ]);
                      },
                    } as MockTable;
                  },
                  eq() {
                    return thenable([
                      {
                        id: "r1",
                        user_id: "u1",
                        organization_id: "org-1",
                        name: "Rule",
                        enabled: true,
                        rule_trigger: "fix_applied",
                        destination_ids: ["d1"],
                        filters: {},
                      },
                    ]);
                  },
                } as MockTable;
              },
            } as MockTable;
          },
        } as MockTable;
      },
    };

    const destQuery: MockTable = {
      select() {
        return {
          in() {
            return {
              eq() {
                return thenable([
                  {
                    id: "d1",
                    user_id: "u1",
                    organization_id: null,
                    type: "webhook",
                    name: "Slack relay",
                    enabled: true,
                    config: { url: "https://hooks.example.com/x", secret: "supersecretpadding" },
                  },
                ]);
              },
            } as MockTable;
          },
        } as MockTable;
      },
    };

    const handlers: Record<string, MockTable> = {
      alert_rules: ruleQuery,
      alert_destinations: destQuery,
      alert_deliveries: { insert: usageInsert as MockTable["insert"] },
    };

    const supabase = { from: (t: string) => handlers[t] ?? ({} as MockTable) };

    await dispatchGovernanceDecisionSignal(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: supabase as any, fetchImpl: fetchImpl as unknown as typeof fetch },
      makeDecision({
        decision_type: "apply_fix",
        payload: { source: "n8n", target: "node:http", rule_id: "v1.http.tls" },
      })
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(usageInsert).toHaveBeenCalled();
  });

  it("does not call fetch when no rules exist for this trigger", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));

    const ruleQuery: MockTable = {
      select() {
        return {
          eq() {
            return {
              in() {
                return {
                  is() {
                    return { eq: () => thenable([]) } as MockTable;
                  },
                  eq() {
                    return thenable([]);
                  },
                } as MockTable;
              },
            } as MockTable;
          },
        } as MockTable;
      },
    };

    const handlers: Record<string, MockTable> = {
      alert_rules: ruleQuery,
      alert_destinations: { select: () => ({ in: () => ({ eq: () => thenable([]) } as MockTable) } as MockTable) },
      alert_deliveries: { insert: (async () => ({ error: null })) as MockTable["insert"] },
    };

    const supabase = { from: (t: string) => handlers[t] ?? ({} as MockTable) };

    await dispatchGovernanceDecisionSignal(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: supabase as any, fetchImpl: fetchImpl as unknown as typeof fetch },
      makeDecision({ decision_type: "interactive_response" })
    );

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

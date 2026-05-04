import { describe, expect, it, vi } from "vitest";
import { TorqaApiError, TorqaClient } from "./client";

type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

function mockFetch(handler: (url: string, init: FetchInit) => Response | Promise<Response>) {
  return vi.fn(async (url: string | URL, init: FetchInit = {}) => {
    return handler(typeof url === "string" ? url : url.toString(), init);
  });
}

function jsonResponse(body: unknown, init: { status?: number; requestId?: string } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.requestId ? { "x-request-id": init.requestId } : {}),
    },
  });
}

const SUCCESS = (data: unknown, requestId = "req_1") => ({
  ok: true,
  data,
  meta: { requestId, apiVersion: "v1" },
});

const FAILURE = (code: string, message: string, requestId = "req_err") => ({
  ok: false,
  error: { code, message },
  meta: { requestId, apiVersion: "v1" },
});

describe("TorqaClient construction", () => {
  it("requires baseUrl and apiKey", () => {
    expect(() => new TorqaClient({ baseUrl: "", apiKey: "k", fetch: globalThis.fetch })).toThrow(/baseUrl/);
    expect(() => new TorqaClient({ baseUrl: "x", apiKey: "", fetch: globalThis.fetch })).toThrow(/apiKey/);
  });

  it("strips trailing slashes from baseUrl", async () => {
    const fetchImpl = mockFetch(() => jsonResponse(SUCCESS({ items: [] })));
    const client = new TorqaClient({
      baseUrl: "https://x.test///",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await client.listPolicyPacks();
    const callUrl = String(fetchImpl.mock.calls[0]?.[0] ?? "");
    expect(callUrl).toBe("https://x.test/api/public/policy-packs");
  });
});

describe("TorqaClient request shaping", () => {
  it("sends API key on every request", async () => {
    const fetchImpl = mockFetch(() => jsonResponse(SUCCESS({ items: [] })));
    const client = new TorqaClient({
      baseUrl: "https://x.test",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await client.listPolicyPacks();
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers ?? {};
    expect((headers as Record<string, string>)["x-api-key"]).toBe("torqa_live_abc");
    expect(String((headers as Record<string, string>)["user-agent"])).toMatch(/torqa-sdk/);
  });

  it("posts JSON body for evaluatePolicy", async () => {
    const fetchImpl = mockFetch((_, init) => {
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body ?? "{}");
      expect(body).toEqual({
        policyPackId: "pack-1",
        source: "n8n",
        findings: [],
        riskScore: 12,
      });
      return jsonResponse(
        SUCCESS({ verdict: "pass", gateStatus: "PASS", packName: "X", packId: "pack-1", hits: [], reasons: [] })
      );
    });
    const client = new TorqaClient({
      baseUrl: "https://x.test",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const r = await client.evaluatePolicy({
      policyPackId: "pack-1",
      source: "n8n",
      findings: [],
      riskScore: 12,
    });
    expect(r.result.verdict).toBe("pass");
    expect(r.meta.requestId).toBe("req_1");
  });

  it("encodes ISO and pagination parameters for listDecisions", async () => {
    const fetchImpl = mockFetch((url) => {
      const u = new URL(url);
      expect(u.pathname).toBe("/api/public/audit/decisions");
      expect(u.searchParams.get("type")).toBe("apply_fix");
      expect(u.searchParams.get("since")).toBe("2026-05-01T00:00:00.000Z");
      expect(u.searchParams.get("until")).toBe("2026-05-04T00:00:00.000Z");
      expect(u.searchParams.get("limit")).toBe("25");
      expect(u.searchParams.get("offset")).toBe("100");
      return jsonResponse(
        SUCCESS({ items: [], total: 0, limit: 25, offset: 100 })
      );
    });
    const client = new TorqaClient({
      baseUrl: "https://x.test",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const r = await client.listDecisions({
      type: "apply_fix",
      since: new Date("2026-05-01T00:00:00.000Z"),
      until: "2026-05-04T00:00:00.000Z",
      limit: 25,
      offset: 100,
    });
    expect(r.items).toEqual([]);
    expect(r.limit).toBe(25);
  });

  it("normalizes acceptRisk shape with default expires_at", async () => {
    const fetchImpl = mockFetch((_, init) => {
      const body = JSON.parse(init.body ?? "{}");
      expect(body.expires_at).toBeNull();
      expect(body.organizationId).toBeNull();
      expect(body.signature).toBe("sig-1");
      return jsonResponse(
        SUCCESS({
          item: {
            id: "id-1",
            finding_signature: "sig-1",
            rule_id: "v1.x",
            source: "n8n",
            target: "node:x",
            severity: "high",
            rationale: "...",
            accepted_at: "2026-05-04T00:00:00.000Z",
            expires_at: null,
          },
        }),
        { status: 201 }
      );
    });
    const client = new TorqaClient({
      baseUrl: "https://x.test",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const r = await client.acceptRisk({
      signature: "sig-1",
      rule_id: "v1.x",
      source: "n8n",
      target: "node:x",
      severity: "high",
      rationale: "vendor approved",
    });
    expect(r.item.id).toBe("id-1");
  });
});

describe("TorqaClient error handling", () => {
  it("throws TorqaApiError with code/status/requestId on API failure", async () => {
    const fetchImpl = mockFetch(() =>
      jsonResponse(FAILURE("forbidden", "Nope", "req_403"), { status: 403, requestId: "req_403" })
    );
    const client = new TorqaClient({
      baseUrl: "https://x.test",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    let caught: unknown;
    try {
      await client.listPolicyPacks();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TorqaApiError);
    const err = caught as TorqaApiError;
    expect(err.code).toBe("forbidden");
    expect(err.status).toBe(403);
    expect(err.requestId).toBe("req_403");
  });

  it("wraps network errors as TorqaApiError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connection reset");
    });
    const client = new TorqaClient({
      baseUrl: "https://x.test",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    let caught: unknown;
    try {
      await client.listPolicyPacks();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TorqaApiError);
    const err = caught as TorqaApiError;
    expect(err.code).toBe("network_error");
    expect(err.status).toBe(0);
  });

  it("returns raw body for exportAudit", async () => {
    const fetchImpl = mockFetch(() =>
      new Response("decision_id,created_at\nabc,2026-05-04T00:00:00Z\n", {
        status: 200,
        headers: { "content-type": "text/csv" },
      })
    );
    const client = new TorqaClient({
      baseUrl: "https://x.test",
      apiKey: "torqa_live_abc",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const out = await client.exportAudit({ format: "csv" });
    expect(out.body).toContain("decision_id");
    expect(out.contentType).toContain("text/csv");
  });
});

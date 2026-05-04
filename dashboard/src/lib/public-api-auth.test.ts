import { describe, expect, it, vi } from "vitest";
import {
  authenticatePublicApiRequest,
  getRequestIp,
  logPublicApiUsage,
  type AdminLikeClient,
} from "./public-api-auth";

type MockTable = {
  select?: () => MockTable;
  eq?: (...args: unknown[]) => MockTable;
  maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
  insert?: (row: unknown) => Promise<{ error: unknown }>;
  update?: (patch: unknown) => MockTable;
  is?: (...args: unknown[]) => MockTable;
};

function buildAdmin(handlers: Record<string, MockTable>): AdminLikeClient {
  return {
    from: ((name: string) => handlers[name] ?? ({} as MockTable)) as unknown as AdminLikeClient["from"],
  };
}

function makeRequest(headers: Record<string, string>, url = "https://app.test/x"): Request {
  return new Request(url, { headers });
}

describe("authenticatePublicApiRequest", () => {
  it("rejects when no API key is sent", async () => {
    const admin = buildAdmin({});
    const req = makeRequest({});
    const result = await authenticatePublicApiRequest(admin, req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.code).toBe("unauthorized");
    }
  });

  it("rejects when API key has wrong prefix", async () => {
    const admin = buildAdmin({});
    const req = makeRequest({ "x-api-key": "wrong-prefix-xxxx" });
    const result = await authenticatePublicApiRequest(admin, req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized");
  });

  it("rejects revoked keys", async () => {
    const admin = buildAdmin({
      api_keys: {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: { id: "k1", user_id: "u1", revoked_at: "2026-01-01T00:00:00Z" },
                  error: null,
                }),
              } as MockTable;
            },
          } as MockTable;
        },
      },
    });
    const req = makeRequest({ "x-api-key": "torqa_live_abcdefghijklmn" });
    const result = await authenticatePublicApiRequest(admin, req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized");
  });

  it("returns scope with org IDs when key is valid", async () => {
    const admin = buildAdmin({
      api_keys: {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: { id: "k1", user_id: "u1", revoked_at: null },
                  error: null,
                }),
              } as MockTable;
            },
          } as MockTable;
        },
      },
      organization_members: {
        select() {
          return {
            eq: async () => ({
              data: [
                { organization_id: "org-1", role: "admin" },
                { organization_id: "org-2", role: "member" },
              ],
              error: null,
            }),
          } as unknown as MockTable;
        },
      },
    });
    const req = makeRequest({ authorization: "Bearer torqa_live_abcdefghij" });
    const result = await authenticatePublicApiRequest(admin, req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope.userId).toBe("u1");
      expect(result.scope.apiKeyId).toBe("k1");
      expect(result.scope.organizationIds.sort()).toEqual(["org-1", "org-2"]);
    }
  });

  it("filters memberships to admin/owner when requireAdmin", async () => {
    const admin = buildAdmin({
      api_keys: {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: { id: "k1", user_id: "u1", revoked_at: null },
                  error: null,
                }),
              } as MockTable;
            },
          } as MockTable;
        },
      },
      organization_members: {
        select() {
          return {
            eq: async () => ({
              data: [
                { organization_id: "org-1", role: "owner" },
                { organization_id: "org-2", role: "member" },
                { organization_id: "org-3", role: "admin" },
              ],
              error: null,
            }),
          } as unknown as MockTable;
        },
      },
    });
    const req = makeRequest({ "x-api-key": "torqa_live_abcdefghij" });
    const result = await authenticatePublicApiRequest(admin, req, { requireAdmin: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope.organizationIds.sort()).toEqual(["org-1", "org-3"]);
    }
  });
});

describe("logPublicApiUsage", () => {
  it("inserts a usage row with success=true on 2xx", async () => {
    const usageInsert = vi.fn(async () => ({ error: null }));
    const apiKeyUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({ is: vi.fn(async () => ({ error: null })) })),
    }));
    const admin = buildAdmin({
      api_key_usage_logs: { insert: usageInsert as unknown as MockTable["insert"] },
      api_keys: { update: apiKeyUpdate as unknown as MockTable["update"] },
    });
    await logPublicApiUsage(admin, { apiKeyId: "k1", userId: "u1" }, {
      endpoint: "/api/public/x",
      statusCode: 200,
      requestIp: "1.2.3.4",
    });
    expect(usageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        api_key_id: "k1",
        user_id: "u1",
        endpoint: "/api/public/x",
        status_code: 200,
        success: true,
        request_ip: "1.2.3.4",
      })
    );
  });

  it("marks success=false on 4xx/5xx", async () => {
    const usageInsert = vi.fn(async () => ({ error: null }));
    const apiKeyUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({ is: vi.fn(async () => ({ error: null })) })),
    }));
    const admin = buildAdmin({
      api_key_usage_logs: { insert: usageInsert as unknown as MockTable["insert"] },
      api_keys: { update: apiKeyUpdate as unknown as MockTable["update"] },
    });
    await logPublicApiUsage(admin, { apiKeyId: "k1", userId: "u1" }, {
      endpoint: "/api/public/x",
      statusCode: 403,
      errorCode: "forbidden",
    });
    expect(usageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status_code: 403,
        success: false,
        error_code: "forbidden",
      })
    );
  });

  it("never throws when telemetry insert fails", async () => {
    const admin = buildAdmin({
      api_key_usage_logs: {
        insert: (async () => {
          throw new Error("db down");
        }) as unknown as MockTable["insert"],
      },
      api_keys: {
        update: () => ({
          eq: () => ({ is: async () => ({ error: null }) }),
        }) as unknown as MockTable,
      },
    });
    await expect(
      logPublicApiUsage(admin, { apiKeyId: "k1", userId: "u1" }, {
        endpoint: "/api/public/x",
        statusCode: 200,
      })
    ).resolves.toBeUndefined();
  });
});

describe("getRequestIp", () => {
  it("prefers x-forwarded-for first hop", () => {
    const r = makeRequest({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
    expect(getRequestIp(r)).toBe("1.1.1.1");
  });
  it("falls back to x-real-ip", () => {
    const r = makeRequest({ "x-real-ip": "9.9.9.9" });
    expect(getRequestIp(r)).toBe("9.9.9.9");
  });
  it("returns null when no header", () => {
    expect(getRequestIp(makeRequest({}))).toBeNull();
  });
});

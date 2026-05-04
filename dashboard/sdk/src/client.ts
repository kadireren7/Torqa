/**
 * Torqa SDK — HTTP client.
 *
 * Thin, dependency-free wrapper around the public API at
 * `/api/public/...`. Exposes one method per public endpoint, returns
 * typed payloads, and surfaces request IDs on every error so users can
 * cross-reference logs with the dashboard's audit log.
 */

import type {
  AcceptedRiskRow,
  GovernanceDecision,
  GovernanceDecisionType,
  PolicyEvaluation,
  PolicyPackSummary,
  PublicApiResponse,
  ScanFinding,
  ScanSeverity,
  ScanSource,
  SimulationSummary,
} from "./types";

export type TorqaClientOptions = {
  /**
   * Base URL of the Torqa dashboard. Should NOT include a trailing slash or
   * the `/api/public` segment. Example: `https://dashboard.torqa.dev`.
   */
  baseUrl: string;
  /** API key issued from /settings/api-keys (starts with `torqa_live_…`). */
  apiKey: string;
  /** Optional fetch override for tests / serverless polyfills. */
  fetch?: typeof fetch;
  /** Request timeout in ms (default 30s). */
  timeoutMs?: number;
  /** Extra default headers (user agent, traceparent, etc.). */
  headers?: Record<string, string>;
};

export type RequestMeta = { requestId: string };

export class TorqaApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;
  constructor(message: string, init: { code: string; status: number; requestId: string | null }) {
    super(message);
    this.name = "TorqaApiError";
    this.code = init.code;
    this.status = init.status;
    this.requestId = init.requestId;
  }
}

export type AcceptRiskInput = {
  signature: string;
  rule_id: string;
  source: ScanSource;
  target: string;
  severity: ScanSeverity;
  rationale: string;
  /** ISO 8601 string, days from now (number), or null for never. Default null. */
  expires_at?: string | number | null;
  /** When the API key has multiple orgs, choose one explicitly. */
  organizationId?: string | null;
};

export type EvaluatePolicyInput = {
  policyPackId: string;
  source: ScanSource;
  findings: ScanFinding[];
  /** Optional pre-computed risk score (0-100). Defaults to 0 when omitted. */
  riskScore?: number;
};

export type ListDecisionsInput = {
  type?: GovernanceDecisionType;
  signature?: string;
  since?: string | Date;
  until?: string | Date;
  limit?: number;
  offset?: number;
  organizationId?: string;
};

export type ExportAuditInput = {
  format?: "csv" | "json";
  type?: GovernanceDecisionType;
  since?: string | Date;
  until?: string | Date;
  organizationId?: string;
};

export type SimulateInput = {
  policyPackId: string;
  range?: "last-7-days" | "last-30-days" | "last-90-days";
};

export class TorqaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: TorqaClientOptions) {
    if (!options?.baseUrl) throw new Error("TorqaClient: baseUrl is required");
    if (!options?.apiKey) throw new Error("TorqaClient: apiKey is required");
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new Error("TorqaClient: a fetch implementation is required (Node 20+ or polyfill)");
    }
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.extraHeaders = { ...(options.headers ?? {}) };
  }

  // ---- Public, programmatic surface --------------------------------------

  /** Run a scan against the public scan endpoint. */
  async scan(input: {
    source: ScanSource;
    content: Record<string, unknown>;
    workspacePolicyId?: string;
    policyTemplateSlug?: string;
  }): Promise<{ result: unknown; meta: RequestMeta }> {
    const body = {
      source: input.source,
      content: input.content,
      workspacePolicyId: input.workspacePolicyId,
      policyTemplateSlug: input.policyTemplateSlug,
    };
    return this.request<unknown>("POST", "/api/public/scan", { body }).then((r) => ({
      result: r.data,
      meta: r.meta,
    }));
  }

  /** Evaluate findings against a policy pack and get a verdict. */
  async evaluatePolicy(
    input: EvaluatePolicyInput
  ): Promise<{ result: PolicyEvaluation; meta: RequestMeta }> {
    const body = {
      policyPackId: input.policyPackId,
      source: input.source,
      findings: input.findings,
      riskScore: input.riskScore ?? 0,
    };
    const r = await this.request<PolicyEvaluation>("POST", "/api/public/policy/evaluate", { body });
    return { result: r.data, meta: r.meta };
  }

  /** Dry-run a policy pack against historical scans for its scope. */
  async simulatePolicy(input: SimulateInput): Promise<{
    result: { summary: SimulationSummary; pack: { id: string | null; name: string } };
    meta: RequestMeta;
  }> {
    const body = {
      policyPackId: input.policyPackId,
      range: input.range ?? "last-30-days",
    };
    const r = await this.request<{
      summary: SimulationSummary;
      pack: { id: string | null; name: string };
    }>("POST", "/api/public/policy/simulate", { body });
    return { result: r.data, meta: r.meta };
  }

  /** List policy packs visible to the API key. */
  async listPolicyPacks(): Promise<{ items: PolicyPackSummary[]; meta: RequestMeta }> {
    const r = await this.request<{ items: PolicyPackSummary[] }>(
      "GET",
      "/api/public/policy-packs",
      {}
    );
    return { items: r.data.items, meta: r.meta };
  }

  /** Page through governance decisions for compliance reporting. */
  async listDecisions(input: ListDecisionsInput = {}): Promise<{
    items: GovernanceDecision[];
    total: number | null;
    limit: number;
    offset: number;
    meta: RequestMeta;
  }> {
    const search = new URLSearchParams();
    if (input.type) search.set("type", input.type);
    if (input.signature) search.set("signature", input.signature);
    if (input.since) search.set("since", asIso(input.since));
    if (input.until) search.set("until", asIso(input.until));
    if (typeof input.limit === "number") search.set("limit", String(input.limit));
    if (typeof input.offset === "number") search.set("offset", String(input.offset));
    if (input.organizationId) search.set("organizationId", input.organizationId);
    const qs = search.toString();
    const r = await this.request<{
      items: GovernanceDecision[];
      total: number | null;
      limit: number;
      offset: number;
    }>("GET", `/api/public/audit/decisions${qs ? `?${qs}` : ""}`, {});
    return { ...r.data, meta: r.meta };
  }

  /** Download the audit log as a string (CSV by default, raw JSON if requested). */
  async exportAudit(input: ExportAuditInput = {}): Promise<{ body: string; contentType: string }> {
    const search = new URLSearchParams();
    search.set("format", input.format ?? "csv");
    if (input.type) search.set("type", input.type);
    if (input.since) search.set("since", asIso(input.since));
    if (input.until) search.set("until", asIso(input.until));
    if (input.organizationId) search.set("organizationId", input.organizationId);
    const url = `${this.baseUrl}/api/public/audit/export?${search.toString()}`;
    const res = await this.fetchWithTimeout(url, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      const requestId = res.headers.get("x-request-id");
      throw new TorqaApiError(`Audit export failed: ${res.status}`, {
        status: res.status,
        code: "export_failed",
        requestId,
      });
    }
    const body = await res.text();
    return { body, contentType: res.headers.get("content-type") ?? "text/plain" };
  }

  /** Programmatically accept a risk for the given finding signature. */
  async acceptRisk(
    input: AcceptRiskInput
  ): Promise<{ item: AcceptedRiskRow; meta: RequestMeta }> {
    const body = {
      signature: input.signature,
      rule_id: input.rule_id,
      source: input.source,
      target: input.target,
      severity: input.severity,
      rationale: input.rationale,
      expires_at: input.expires_at ?? null,
      organizationId: input.organizationId ?? null,
    };
    const r = await this.request<{ item: AcceptedRiskRow }>(
      "POST",
      "/api/public/risks/accept",
      { body }
    );
    return { item: r.data.item, meta: r.meta };
  }

  // ---- Internals ---------------------------------------------------------

  private headers(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      accept: "application/json",
      "user-agent": this.extraHeaders["user-agent"] ?? "torqa-sdk/0.2.1",
      ...this.extraHeaders,
    };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    options: { body?: unknown }
  ): Promise<{ data: T; meta: RequestMeta }> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        ...this.headers(),
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    };
    let res: Response;
    try {
      res = await this.fetchWithTimeout(url, init);
    } catch (e) {
      throw new TorqaApiError(
        e instanceof Error && e.name === "AbortError"
          ? `Request to ${path} timed out after ${this.timeoutMs}ms`
          : `Network error contacting ${path}`,
        { status: 0, code: "network_error", requestId: null }
      );
    }

    const requestId = res.headers.get("x-request-id");
    let payload: PublicApiResponse<T> | null = null;
    try {
      payload = (await res.json()) as PublicApiResponse<T>;
    } catch {
      // Some endpoints (audit/export CSV) don't return JSON — but those use
      // exportAudit() above. If JSON fails here, throw with raw status.
      throw new TorqaApiError(`Non-JSON response from ${path}`, {
        status: res.status,
        code: "invalid_response",
        requestId,
      });
    }

    if (!res.ok || !payload?.ok) {
      const code = !payload?.ok && payload?.error?.code ? payload.error.code : `http_${res.status}`;
      const message = !payload?.ok && payload?.error?.message ? payload.error.message : res.statusText;
      throw new TorqaApiError(message, {
        status: res.status,
        code,
        requestId: payload?.meta?.requestId ?? requestId,
      });
    }
    return { data: payload.data, meta: { requestId: payload.meta.requestId } };
  }
}

function asIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

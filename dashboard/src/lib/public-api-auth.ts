/**
 * Public API authentication helper.
 *
 * Resolves the calling API key, returns the scope the request runs in, and
 * exposes a `logUsage` callback that the route handler should invoke from
 * its `finally` block. The shape is deliberately framework-agnostic so the
 * route can shape its own error responses (envelope vs. legacy).
 *
 * The Block 5 public surface uses this so every endpoint shares one auth
 * pipeline (lookup, revoke check, usage log, last_used_at bump).
 */

import { extractApiKeyFromRequest, hashApiKey } from "@/lib/api-keys";
import { logStructured } from "@/lib/structured-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicApiKeyScope = {
  apiKeyId: string;
  userId: string;
  /** Org IDs the key holder belongs to (empty array if personal-only). */
  organizationIds: string[];
};

export type AuthFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type AuthSuccess = {
  ok: true;
  scope: PublicApiKeyScope;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type UsageLogEntry = {
  endpoint: string;
  source?: string | null;
  statusCode: number;
  errorCode?: string | null;
  requestIp?: string | null;
  metadata?: Record<string, unknown>;
};

export type AdminLikeClient = Pick<SupabaseClient, "from">;

/**
 * Resolve and validate the API key on the given request. Returns either
 * `{ ok: true, scope }` or `{ ok: false, ... }` describing the auth failure
 * the caller should turn into a JSON error response.
 *
 * Side effects: none (telemetry happens via `logPublicApiUsage`).
 */
export async function authenticatePublicApiRequest(
  admin: AdminLikeClient,
  request: Request,
  options?: { requireAdmin?: boolean }
): Promise<AuthResult> {
  const rawKey = extractApiKeyFromRequest(request);
  if (!rawKey) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Missing API key. Send x-api-key or Authorization: Bearer <key>",
    };
  }
  const keyHash = hashApiKey(rawKey);
  const { data: keyRow, error } = await admin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error) {
    logStructured("warn", "public_api_key_lookup_failed", {});
    return { ok: false, status: 500, code: "database_error", message: "A database error occurred" };
  }
  if (!keyRow || keyRow.revoked_at) {
    return { ok: false, status: 401, code: "unauthorized", message: "Invalid or revoked API key" };
  }

  // Resolve org memberships if a downstream endpoint needs to filter cross-org.
  const userId = keyRow.user_id as string;
  let organizationIds: string[] = [];
  const { data: memberships } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);
  if (Array.isArray(memberships)) {
    if (options?.requireAdmin) {
      organizationIds = memberships
        .filter((m) => ["owner", "admin"].includes(m.role as string))
        .map((m) => m.organization_id as string);
    } else {
      organizationIds = memberships.map((m) => m.organization_id as string);
    }
  }
  return {
    ok: true,
    scope: {
      apiKeyId: keyRow.id as string,
      userId,
      organizationIds,
    },
  };
}

/**
 * Append a usage row to `api_key_usage_logs` and bump `last_used_at`. Best
 * effort: errors are swallowed because the route response must not depend
 * on telemetry success.
 */
export async function logPublicApiUsage(
  admin: AdminLikeClient,
  scope: { apiKeyId: string; userId: string },
  entry: UsageLogEntry
): Promise<void> {
  try {
    await admin.from("api_key_usage_logs").insert({
      api_key_id: scope.apiKeyId,
      user_id: scope.userId,
      endpoint: entry.endpoint,
      source: entry.source ?? null,
      status_code: entry.statusCode,
      success: entry.statusCode >= 200 && entry.statusCode < 300,
      error_code: entry.errorCode ?? null,
      request_ip: entry.requestIp ?? null,
      metadata: entry.metadata ?? {},
    });
    await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", scope.apiKeyId)
      .is("revoked_at", null);
  } catch {
    /* telemetry-only path */
  }
}

export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded?.trim()) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip")?.trim() ?? null;
}

import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "torqa_live_";
const MAX_RAW_KEY_LENGTH = 256;

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const secret = randomBytes(24).toString("base64url");
  const rawKey = `${API_KEY_PREFIX}${secret}`;
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, Math.min(18, rawKey.length)),
    keyHash: hashApiKey(rawKey),
  };
}

export function hashApiKey(rawKey: string): string {
  const pepper = process.env.TORQA_API_KEY_PEPPER?.trim() ?? "";
  return createHash("sha256").update(`${pepper}:${rawKey}`).digest("hex");
}

export function extractApiKeyFromRequest(request: Request): string | null {
  const header = request.headers.get("x-api-key")?.trim();
  if (header) return sanitizeRawApiKey(header);

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return sanitizeRawApiKey(token);
}

function sanitizeRawApiKey(value: string): string | null {
  const key = value.trim();
  if (!key) return null;
  if (key.length > MAX_RAW_KEY_LENGTH) return null;
  if (!key.startsWith("torqa_")) return null;
  return key;
}

export function toApiKeyPreview(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

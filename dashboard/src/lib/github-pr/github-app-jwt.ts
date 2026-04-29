import { createSign } from "crypto";

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/**
 * GitHub App JWT (RS256), valid for a short window. Used to request installation access tokens.
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */
export function createGitHubAppJwt(appId: string, privateKeyPem: string, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 300,
    iss: appId,
  };
  const data = `${b64url(header)}.${b64url(payload)}`;
  const sign = createSign("RSA-SHA256");
  sign.update(data);
  sign.end();
  const sig = sign.sign(privateKeyPem, "base64url");
  return `${data}.${sig}`;
}

/** Normalize PEM from env (single line with `\n` escapes). */
export function normalizeGithubPrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN") && trimmed.includes("END")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  return trimmed.replace(/\\n/g, "\n");
}

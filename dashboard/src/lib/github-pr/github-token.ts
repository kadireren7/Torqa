import { GITHUB_API } from "@/lib/github-pr/constants";
import { createGitHubAppJwt, normalizeGithubPrivateKey } from "@/lib/github-pr/github-app-jwt";

export type GithubAuthMode = "app" | "pat";

export type ResolvedGithubToken = {
  token: string;
  mode: GithubAuthMode;
};

export type GithubTokenEnv = {
  appId: string | null;
  privateKeyPem: string | null;
  pat: string | null;
};

export function readGithubTokenEnv(): GithubTokenEnv {
  const appId = process.env.GITHUB_APP_ID?.trim() || null;
  const rawKey = process.env.GITHUB_PRIVATE_KEY?.trim() || null;
  const privateKeyPem = rawKey ? normalizeGithubPrivateKey(rawKey) : null;
  const pat = process.env.GITHUB_BOT_TOKEN?.trim() || null;
  return { appId, privateKeyPem, pat };
}

async function fetchInstallationToken(jwt: string, installationId: number): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "User-Agent": "Torqa-PR-Automation/1.0",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(
      `[torqa-github] installation token failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
    );
    return null;
  }
  const body = (await res.json()) as { token?: string };
  return typeof body.token === "string" ? body.token : null;
}

/**
 * Prefer GitHub App installation token when installation id + app credentials exist; else PAT.
 */
export async function resolveGithubApiToken(
  installationId: number | null,
  env: GithubTokenEnv = readGithubTokenEnv()
): Promise<ResolvedGithubToken | null> {
  const { appId, privateKeyPem, pat } = env;
  if (installationId !== null && appId && privateKeyPem) {
    try {
      const jwt = createGitHubAppJwt(appId, privateKeyPem);
      const token = await fetchInstallationToken(jwt, installationId);
      if (token) return { token, mode: "app" };
    } catch (e) {
      console.warn("[torqa-github] app JWT or installation token error:", e);
    }
  }
  if (pat) return { token: pat, mode: "pat" };
  return null;
}

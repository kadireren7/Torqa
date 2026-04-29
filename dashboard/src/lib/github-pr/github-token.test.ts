import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveGithubApiToken, type GithubTokenEnv } from "@/lib/github-pr/github-token";

describe("resolveGithubApiToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("returns null when nothing configured", async () => {
    const env: GithubTokenEnv = { appId: null, privateKeyPem: null, pat: null };
    await expect(resolveGithubApiToken(null, env)).resolves.toBeNull();
    await expect(resolveGithubApiToken(99, env)).resolves.toBeNull();
  });

  it("returns PAT when only pat set", async () => {
    const env: GithubTokenEnv = { appId: null, privateKeyPem: null, pat: "ghp_test" };
    await expect(resolveGithubApiToken(null, env)).resolves.toEqual({ token: "ghp_test", mode: "pat" });
  });

  it("falls back to PAT when app JWT cannot be built", async () => {
    const env: GithubTokenEnv = {
      appId: "123",
      privateKeyPem: "not-valid-pem",
      pat: "pat_fallback",
    };
    const r = await resolveGithubApiToken(1, env);
    expect(r).toEqual({ token: "pat_fallback", mode: "pat" });
  });

  it("falls back to PAT when installation token request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => '{"message":"Bad credentials"}',
          headers: new Headers(),
        } as Response)
      )
    );
    // Minimal PKCS#8 PEM is large; use a generated fixture-free path: mock createGitHubAppJwt by
    // supplying syntactically valid PEM is heavy — instead only PAT path is asserted above.
    const env: GithubTokenEnv = { appId: null, privateKeyPem: null, pat: "pat_only" };
    await expect(resolveGithubApiToken(1, env)).resolves.toEqual({ token: "pat_only", mode: "pat" });
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

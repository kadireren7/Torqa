import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePullRequestWebhook } from "@/lib/github-pr/handle-pull-request-webhook";

const validPrPayload = {
  action: "opened" as const,
  pull_request: {
    number: 42,
    head: { sha: "abcdef1234567890abcdef1234567890abcdef12" },
  },
  repository: { full_name: "acme/demo" },
};

describe("handlePullRequestWebhook", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips unsupported pull_request actions", async () => {
    const r = await handlePullRequestWebhook({
      ...validPrPayload,
      action: "labeled",
    });
    expect(r).toMatchObject({ ok: true, skipped: true });
  });

  it("without GitHub API credentials returns aggregate stub and skips comment", async () => {
    vi.stubEnv("GITHUB_BOT_TOKEN", "");
    vi.stubEnv("GITHUB_APP_ID", "");
    vi.stubEnv("GITHUB_PRIVATE_KEY", "");
    const r = await handlePullRequestWebhook(validPrPayload);
    expect(r.ok).toBe(true);
    expect(r.pr).toEqual({ owner: "acme", repo: "demo", number: 42 });
    expect(r.aggregate?.files[0]?.error).toContain("missing_github_api_credentials");
    expect(r.comment).toEqual(
      expect.objectContaining({
        posted: false,
        detail: "no_github_credentials",
      })
    );
  });
});

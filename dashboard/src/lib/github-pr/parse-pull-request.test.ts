import { describe, expect, it } from "vitest";
import { parsePullRequestContext } from "@/lib/github-pr/parse-pull-request";

const basePr = {
  action: "opened",
  pull_request: {
    number: 7,
    head: { sha: "abcdef1234567890abcdef1234567890abcdef12" },
  },
  repository: { full_name: "acme/widget" },
};

describe("parsePullRequestContext", () => {
  it("parses opened with installation id", () => {
    const ctx = parsePullRequestContext({
      ...basePr,
      installation: { id: 12345 },
    });
    expect(ctx).toEqual({
      action: "opened",
      owner: "acme",
      repo: "widget",
      prNumber: 7,
      headSha: "abcdef1234567890abcdef1234567890abcdef12",
      installationId: 12345,
    });
  });

  it("parses synchronize without installation", () => {
    const ctx = parsePullRequestContext({ ...basePr, action: "synchronize" });
    expect(ctx?.installationId).toBeNull();
    expect(ctx?.action).toBe("synchronize");
  });

  it("returns null for closed", () => {
    expect(parsePullRequestContext({ ...basePr, action: "closed" })).toBeNull();
  });

  it("returns null for invalid payload", () => {
    expect(parsePullRequestContext(null)).toBeNull();
    expect(parsePullRequestContext({})).toBeNull();
  });
});

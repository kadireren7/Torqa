import {
  TORQA_PR_MAX_FILE_BYTES,
  TORQA_PR_MAX_FILES,
} from "@/lib/github-pr/constants";
import { filterScanPaths } from "@/lib/github-pr/filter-scan-paths";
import { parsePullRequestContext } from "@/lib/github-pr/parse-pull-request";
import { readGithubTokenEnv, resolveGithubApiToken } from "@/lib/github-pr/github-token";
import { githubListPrFiles, GithubRestError } from "@/lib/github-pr/github-rest-client";
import { aggregateRows, scanPrFilesFromGithub } from "@/lib/github-pr/scan-pr-contents";
import { buildPrScanCommentMarkdown } from "@/lib/github-pr/pr-comment-markdown";
import { upsertTorqaPrComment } from "@/lib/github-pr/pr-comment-upsert";
import type { PullRequestWebhookResult } from "@/lib/github-pr/types";

function dashboardBaseUrlFromEnv(): string | null {
  const u = process.env.TORQA_DASHBOARD_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!u) return null;
  try {
    new URL(u);
    return u;
  } catch {
    return null;
  }
}

/**
 * Run Torqa PR scan + optional GitHub comment for `pull_request` payloads.
 * Without API credentials, returns a placeholder aggregate and skips commenting (logged).
 */
export async function handlePullRequestWebhook(payload: unknown): Promise<PullRequestWebhookResult> {
  const ctx = parsePullRequestContext(payload);
  if (!ctx) {
    return { ok: true, skipped: true, reason: "unsupported_pull_request_action_or_payload" };
  }

  const pr = { owner: ctx.owner, repo: ctx.repo, number: ctx.prNumber };
  const env = readGithubTokenEnv();
  const tokenInfo = await resolveGithubApiToken(ctx.installationId, env);

  if (!tokenInfo) {
    console.warn(
      "[torqa-github] no GITHUB_APP_ID+GITHUB_PRIVATE_KEY (with installation) or GITHUB_BOT_TOKEN — cannot list/fetch PR files via GitHub API"
    );
    const aggregate = aggregateRows([
      {
        path: "(github-api)",
        error: "missing_github_api_credentials_list_files_requires_token",
      },
    ]);
    return {
      ok: true,
      pr,
      aggregate,
      comment: { posted: false, detail: "no_github_credentials" },
    };
  }

  let allPaths: string[] = [];
  try {
    allPaths = await githubListPrFiles(tokenInfo.token, ctx.owner, ctx.repo, ctx.prNumber);
  } catch (e) {
    const status = e instanceof GithubRestError ? e.status : 0;
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[torqa-github] list PR files failed (${status}):`, msg);
    return {
      ok: false,
      pr,
      reason: "list_pr_files_failed",
    };
  }

  const filtered = filterScanPaths(allPaths);
  const rows =
    filtered.length === 0
      ? []
      : await scanPrFilesFromGithub(
          tokenInfo.token,
          ctx.owner,
          ctx.repo,
          ctx.headSha,
          filtered,
          TORQA_PR_MAX_FILES,
          TORQA_PR_MAX_FILE_BYTES
        );

  const aggregate = aggregateRows(
    rows.length > 0
      ? rows
      : [
          {
            path: "(diff)",
            skipped: "no_matching_paths",
          },
        ]
  );

  const dashboardBase = dashboardBaseUrlFromEnv();
  const markdown = buildPrScanCommentMarkdown(aggregate, {
    owner: ctx.owner,
    repo: ctx.repo,
    prNumber: ctx.prNumber,
    dashboardBaseUrl: dashboardBase,
  });

  try {
    const { created, commentId } = await upsertTorqaPrComment(
      tokenInfo.token,
      ctx.owner,
      ctx.repo,
      ctx.prNumber,
      markdown
    );
    return {
      ok: true,
      pr,
      aggregate,
      comment: { posted: true, updated: !created, mode: tokenInfo.mode, detail: `comment_id=${commentId}` },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[torqa-github] upsert PR comment failed:", msg);
    return {
      ok: true,
      pr,
      aggregate,
      comment: { posted: false, detail: msg.slice(0, 300) },
    };
  }
}

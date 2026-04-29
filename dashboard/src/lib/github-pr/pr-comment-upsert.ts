import { TORQA_PR_COMMENT_MARKER } from "@/lib/github-pr/constants";
import type { IssueComment } from "@/lib/github-pr/github-rest-client";
import {
  githubCreateIssueComment,
  githubListIssueComments,
  githubUpdateIssueComment,
} from "@/lib/github-pr/github-rest-client";

/**
 * Returns the comment id to update, preferring the most recently updated Torqa marker comment.
 */
export function findLatestTorqaCommentId(comments: IssueComment[], marker: string = TORQA_PR_COMMENT_MARKER): number | null {
  const matches = comments.filter((c) => c.body.includes(marker));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const ta = Date.parse(a.updated_at ?? "") || 0;
    const tb = Date.parse(b.updated_at ?? "") || 0;
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
  });
  return matches[0]?.id ?? null;
}

export async function upsertTorqaPrComment(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<{ created: boolean; commentId: number }> {
  const existing = await githubListIssueComments(token, owner, repo, prNumber);
  const id = findLatestTorqaCommentId(existing);
  if (id !== null) {
    await githubUpdateIssueComment(token, owner, repo, id, body);
    return { created: false, commentId: id };
  }
  const created = await githubCreateIssueComment(token, owner, repo, prNumber, body);
  return { created: true, commentId: created.id };
}

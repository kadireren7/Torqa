import { describe, expect, it } from "vitest";
import { TORQA_PR_COMMENT_MARKER } from "@/lib/github-pr/constants";
import { findLatestTorqaCommentId } from "@/lib/github-pr/pr-comment-upsert";
import type { IssueComment } from "@/lib/github-pr/github-rest-client";

describe("findLatestTorqaCommentId", () => {
  it("returns null when no marker", () => {
    const comments: IssueComment[] = [{ id: 1, body: "hello" }];
    expect(findLatestTorqaCommentId(comments)).toBeNull();
  });

  it("returns id of most recently updated marker comment", () => {
    const comments: IssueComment[] = [
      { id: 10, body: `${TORQA_PR_COMMENT_MARKER}\nold`, updated_at: "2020-01-01T00:00:00Z" },
      { id: 20, body: `${TORQA_PR_COMMENT_MARKER}\nnew`, updated_at: "2024-06-01T12:00:00Z" },
      { id: 30, body: "other", updated_at: "2025-01-01T00:00:00Z" },
    ];
    expect(findLatestTorqaCommentId(comments)).toBe(20);
  });

  it("breaks ties by higher id", () => {
    const comments: IssueComment[] = [
      { id: 1, body: `${TORQA_PR_COMMENT_MARKER}\na`, updated_at: "2024-01-01T00:00:00Z" },
      { id: 2, body: `${TORQA_PR_COMMENT_MARKER}\nb`, updated_at: "2024-01-01T00:00:00Z" },
    ];
    expect(findLatestTorqaCommentId(comments)).toBe(2);
  });
});

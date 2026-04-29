/** Embedded in every Torqa PR automation comment; used to find/update instead of spamming. */
export const TORQA_PR_COMMENT_MARKER = "<!-- torqa-pr-automation:v1 -->";

/** Max files scanned per PR (rate limits + latency). */
export const TORQA_PR_MAX_FILES = 28;

/** Max decoded bytes per file; larger files are skipped with a note. */
export const TORQA_PR_MAX_FILE_BYTES = 400_000;

export const GITHUB_API = "https://api.github.com";

export const TORQA_PR_SUPPORTED_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

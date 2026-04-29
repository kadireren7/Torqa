import { GITHUB_API } from "@/lib/github-pr/constants";

export class GithubRestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodySnippet?: string
  ) {
    super(message);
    this.name = "GithubRestError";
  }
}

export async function githubJson<T>(
  token: string,
  path: string,
  init?: RequestInit & { method?: string }
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Torqa-PR-Automation/1.0",
      ...(init?.headers as Record<string, string>),
    },
  });
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining && Number(remaining) < 20) {
    console.warn(`[torqa-github] low rate limit remaining: ${remaining}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new GithubRestError(`GitHub API ${res.status} ${res.statusText} for ${path}`, res.status, text.slice(0, 400));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GithubRestError(`GitHub API returned non-JSON for ${path}`, res.status, text.slice(0, 200));
  }
}

export async function githubListPrFiles(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  maxPages = 5
): Promise<string[]> {
  const paths: string[] = [];
  let page = 1;
  let url: string | null = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/files?per_page=100&page=${page}`;

  while (url && page <= maxPages) {
    const pathOrUrl = url;
    const res: Response = await fetch(pathOrUrl.startsWith("http") ? pathOrUrl : `${GITHUB_API}${pathOrUrl}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Torqa-PR-Automation/1.0",
      },
    });
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining && Number(remaining) < 20) {
      console.warn(`[torqa-github] low rate limit remaining: ${remaining}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GithubRestError(
        `list PR files failed ${res.status}`,
        res.status,
        text.slice(0, 400)
      );
    }
    const chunk = (await res.json()) as { filename?: string }[];
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const row of chunk) {
      if (typeof row.filename === "string") paths.push(row.filename);
    }
    const link = res.headers.get("link");
    let next: string | null = null;
    if (link) {
      for (const part of link.split(",")) {
        const m = part.match(/<([^>]+)>;\s*rel="next"/);
        if (m) {
          try {
            const u = new URL(m[1]);
            next = `${u.pathname}${u.search}`;
          } catch {
            next = null;
          }
          break;
        }
      }
    }
    url = next;
    page += 1;
  }
  return paths;
}

export type RepoContentFile = {
  type: string;
  encoding?: string;
  content?: string;
  size?: number;
};

function encodeRepoPath(path: string): string {
  return path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export async function githubFetchRepoFileUtf8(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
  maxBytes: number
): Promise<{ text: string; skipped?: string }> {
  const q = new URLSearchParams({ ref });
  const data = await githubJson<RepoContentFile>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPath(path)}?${q}`,
    { method: "GET" }
  );
  if (data.type !== "file") {
    return { text: "", skipped: "not_a_file" };
  }
  const size = typeof data.size === "number" ? data.size : null;
  if (size !== null && size > maxBytes) {
    return { text: "", skipped: `file_too_large_${size}_bytes` };
  }
  if (data.encoding !== "base64" || typeof data.content !== "string") {
    return { text: "", skipped: "missing_base64_content" };
  }
  const buf = Buffer.from(data.content.replace(/\n/g, ""), "base64");
  if (buf.length > maxBytes) {
    return { text: "", skipped: `decoded_too_large_${buf.length}_bytes` };
  }
  return { text: buf.toString("utf8") };
}

export type IssueComment = {
  id: number;
  body: string;
  updated_at?: string;
};

export async function githubListIssueComments(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<IssueComment[]> {
  const out: IssueComment[] = [];
  let page = 1;
  const maxPages = 10;
  while (page <= maxPages) {
    const chunk = await githubJson<IssueComment[]>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
      { method: "GET" }
    );
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const c of chunk) {
      if (typeof c.id === "number" && typeof c.body === "string") {
        out.push({ id: c.id, body: c.body, updated_at: typeof c.updated_at === "string" ? c.updated_at : undefined });
      }
    }
    if (chunk.length < 100) break;
    page += 1;
  }
  return out;
}

export async function githubCreateIssueComment(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ id: number }> {
  return githubJson<{ id: number }>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function githubUpdateIssueComment(
  token: string,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<void> {
  await githubJson(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${commentId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ body }),
      headers: { "Content-Type": "application/json" },
    }
  );
}

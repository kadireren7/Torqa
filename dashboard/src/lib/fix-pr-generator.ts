/**
 * Fix PR Generator — v0.4.0
 * Converts Torqa FixProposal patches into GitHub-compatible diffs and creates PRs.
 */

import type { FixProposal, JsonPatchOp } from "@/lib/governance/types";

export type FixPrRequest = {
  repo: string;         // "owner/repo"
  githubToken: string;
  scanId: string;
  workflowName: string;
  finding: {
    rule_id: string;
    target: string;
    signature: string;
    severity: string;
    suggested_fix: string;
  };
  fix: FixProposal;
  workflowContent: unknown; // original workflow JSON
};

export type FixPrResult =
  | { ok: true; prUrl: string; prNumber: number; branch: string }
  | { ok: false; error: string };

/** Apply JSON patch ops to an object (immutable, returns new value). */
export function applyJsonPatch(obj: unknown, ops: JsonPatchOp[]): unknown {
  let current = structuredClone(obj);
  for (const op of ops) {
    current = applySingleOp(current, op);
  }
  return current;
}

function applySingleOp(obj: unknown, op: JsonPatchOp): unknown {
  const parts = op.path.replace(/^\//, "").split("/").map(decodeJsonPointerSegment);
  if (op.op === "remove") {
    return removeAt(obj, parts);
  }
  return setAt(obj, parts, op.op === "add" || op.op === "replace" ? op.value : undefined);
}

function decodeJsonPointerSegment(s: string): string {
  return s.replace(/~1/g, "/").replace(/~0/g, "~");
}

function setAt(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  const key = head!;
  if (Array.isArray(obj)) {
    const idx = parseInt(key, 10);
    const next = [...obj];
    next[idx] = setAt(obj[idx], tail, value);
    return next;
  }
  if (obj !== null && typeof obj === "object") {
    return { ...(obj as Record<string, unknown>), [key]: setAt((obj as Record<string, unknown>)[key], tail, value) };
  }
  return obj;
}

function removeAt(obj: unknown, path: string[]): unknown {
  if (path.length === 0) return undefined;
  const [head, ...tail] = path;
  const key = head!;
  if (Array.isArray(obj)) {
    const idx = parseInt(key, 10);
    if (tail.length === 0) {
      return obj.filter((_, i) => i !== idx);
    }
    const next = [...obj];
    next[idx] = removeAt(obj[idx], tail);
    return next;
  }
  if (obj !== null && typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    if (tail.length === 0) {
      const { [key]: _, ...rest } = record;
      return rest;
    }
    return { ...record, [key]: removeAt(record[key], tail) };
  }
  return obj;
}

/** Generate a unified-diff-like summary for PR description. */
export function generatePatchSummary(ops: JsonPatchOp[]): string {
  return ops.map(op => {
    if (op.op === "replace") return `~ ${op.path}: → ${JSON.stringify(op.value)}`;
    if (op.op === "add")     return `+ ${op.path}: ${JSON.stringify(op.value)}`;
    if (op.op === "remove")  return `- ${op.path}`;
    return "";
  }).join("\n");
}

/** Create a GitHub PR for the given fix. Requires a GitHub token with repo scope. */
export async function createFixPr(req: FixPrRequest): Promise<FixPrResult> {
  const { repo, githubToken, fix, workflowContent, workflowName, finding, scanId } = req;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    Accept: "application/vnd.github+json",
  };

  try {
    // 1. Get default branch
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!repoRes.ok) return { ok: false, error: `GitHub repo fetch failed: ${repoRes.status}` };
    const repoData = await repoRes.json() as { default_branch: string };
    const base = repoData.default_branch;

    // 2. Get base SHA
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${base}`, { headers });
    if (!refRes.ok) return { ok: false, error: `GitHub ref fetch failed: ${refRes.status}` };
    const refData = await refRes.json() as { object: { sha: string } };
    const baseSha = refData.object.sha;

    // 3. Apply patch to workflow content
    const patched = applyJsonPatch(workflowContent, fix.patch);

    // 4. Create branch
    const ts = Date.now();
    const branch = `torqa/fix/${finding.rule_id.replace(/\./g, "-")}-${ts}`;
    const branchRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
    if (!branchRes.ok) return { ok: false, error: `Branch creation failed: ${branchRes.status}` };

    // 5. Find the file to update (best-effort by workflow name)
    const searchRes = await fetch(
      `https://api.github.com/search/code?q=${encodeURIComponent(workflowName)}+repo:${repo}`,
      { headers }
    );
    let filePath = `workflows/${workflowName.replace(/\s+/g, "_")}.json`;
    let existingFileSha: string | undefined;

    if (searchRes.ok) {
      const searchData = await searchRes.json() as { items?: Array<{ path: string; sha: string }> };
      const match = searchData.items?.[0];
      if (match) {
        filePath = match.path;
        existingFileSha = match.sha;
      }
    }

    // 6. Create/update file with patched content
    const fileContent = Buffer.from(JSON.stringify(patched, null, 2)).toString("base64");
    const fileBody: Record<string, unknown> = {
      message: `fix(torqa): ${finding.rule_id} in ${workflowName}`,
      content: fileContent,
      branch,
    };
    if (existingFileSha) fileBody.sha = existingFileSha;

    const fileRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(fileBody),
    });
    if (!fileRes.ok) return { ok: false, error: `File update failed: ${fileRes.status}` };

    // 7. Create PR
    const patchSummary = generatePatchSummary(fix.patch);
    const prBody = `## Torqa Fix: \`${finding.rule_id}\`

**Finding:** ${finding.target}
**Severity:** ${finding.severity.toUpperCase()}
**Fix type:** ${fix.type}
**Scan ID:** \`${scanId}\`

### What this fixes
${fix.explanation}

### Changes applied
\`\`\`
${patchSummary}
\`\`\`

---
*Generated by [Torqa](https://torqa.dev) governance engine. Review before merging.*`;

    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `[Torqa Fix] ${finding.rule_id}: ${workflowName}`,
        body: prBody,
        head: branch,
        base,
        draft: true,
      }),
    });

    if (!prRes.ok) {
      const errText = await prRes.text();
      return { ok: false, error: `PR creation failed: ${prRes.status} ${errText}` };
    }

    const prData = await prRes.json() as { html_url: string; number: number };
    return { ok: true, prUrl: prData.html_url, prNumber: prData.number, branch };

  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { handlePullRequestWebhook } from "@/lib/github-pr/handle-pull-request-webhook";

export const runtime = "nodejs";

function verifyGitHubSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const actualHex = signature.slice("sha256=".length).trim();
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(actualHex, "hex");
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * GitHub repository webhook receiver. Configure `GITHUB_WEBHOOK_SECRET` on the server.
 *
 * - **ping**: health check
 * - **push**: lightweight path summary (legacy)
 * - **pull_request** (`opened`, `synchronize`, `reopened`): Torqa scan + PR comment (requires GitHub API token)
 */
export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "GITHUB_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubSignature(rawBody, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = request.headers.get("x-github-event") ?? "unknown";
  const zen = typeof payload.zen === "string" ? payload.zen : null;
  if (event === "ping") {
    return NextResponse.json({ ok: true, received: "ping", zen });
  }

  if (event === "pull_request") {
    const prResult = await handlePullRequestWebhook(payload);
    return NextResponse.json({
      received: "pull_request",
      ...prResult,
    });
  }

  const repo =
    payload.repository && typeof payload.repository === "object"
      ? (payload.repository as { name?: string })
      : null;
  const ref = typeof payload.ref === "string" ? payload.ref : null;
  const commits = Array.isArray(payload.commits) ? payload.commits.length : 0;

  const files = new Set<string>();
  if (Array.isArray(payload.commits)) {
    for (const c of payload.commits) {
      if (!c || typeof c !== "object") continue;
      const added = (c as { added?: string[] }).added;
      const modified = (c as { modified?: string[] }).modified;
      for (const p of added ?? []) files.add(p);
      for (const p of modified ?? []) files.add(p);
    }
  }

  const workflowLike = [...files].some(
    (p) => p.endsWith(".json") || p.endsWith(".tq") || p.includes("workflows/")
  );

  return NextResponse.json({
    ok: true,
    received: event,
    repository: repo?.name ?? null,
    ref,
    commits,
    workflowRelatedPaths: workflowLike,
    hint:
      "For PR automation, subscribe to pull_request (opened, synchronize, reopened) and configure GITHUB_BOT_TOKEN or a GitHub App — see docs/github-pr-automation.md",
  });
}

import type { PullRequestWebhookContext } from "@/lib/github-pr/types";
import { TORQA_PR_SUPPORTED_ACTIONS } from "@/lib/github-pr/constants";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Extract PR scan context from a GitHub `pull_request` webhook JSON body.
 * Returns null if the event should be ignored (unsupported action or missing fields).
 */
export function parsePullRequestContext(payload: unknown): PullRequestWebhookContext | null {
  if (!isRecord(payload)) return null;
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!TORQA_PR_SUPPORTED_ACTIONS.has(action)) return null;

  const pr = payload.pull_request;
  if (!isRecord(pr)) return null;
  const num = pr.number;
  if (typeof num !== "number" || !Number.isFinite(num) || num < 1) return null;

  const head = pr.head;
  if (!isRecord(head)) return null;
  const headSha = typeof head.sha === "string" && head.sha.length >= 7 ? head.sha : null;
  if (!headSha) return null;

  const repo = payload.repository;
  if (!isRecord(repo)) return null;
  const fullName = typeof repo.full_name === "string" ? repo.full_name : null;
  if (!fullName || !fullName.includes("/")) return null;
  const [owner, repoName] = fullName.split("/", 2);
  if (!owner || !repoName) return null;

  let installationId: number | null = null;
  const inst = payload.installation;
  if (isRecord(inst) && typeof inst.id === "number" && Number.isFinite(inst.id)) {
    installationId = inst.id;
  }

  return {
    action,
    owner,
    repo: repoName,
    prNumber: num,
    headSha,
    installationId,
  };
}

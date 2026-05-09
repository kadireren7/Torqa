import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createFixPr } from "@/lib/fix-pr-generator";
import type { FixProposal } from "@/lib/governance/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    scan_id,
    repo,
    workflow_name,
    workflow_content,
    finding,
    fix,
  } = body as Record<string, unknown>;

  if (typeof repo !== "string" || !repo.includes("/")) {
    return NextResponse.json({ error: "repo must be 'owner/repo'" }, { status: 400 });
  }
  if (!finding || !fix) {
    return NextResponse.json({ error: "finding and fix are required" }, { status: 400 });
  }

  // Get GitHub token from connected integration
  const { data: integration } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("provider", "github")
    .eq("user_id", user.id)
    .maybeSingle();

  let githubToken: string | undefined;
  if (integration?.credentials && typeof integration.credentials === "object") {
    const creds = integration.credentials as Record<string, unknown>;
    githubToken = typeof creds.api_key === "string" ? creds.api_key : undefined;
  }

  if (!githubToken) {
    return NextResponse.json(
      { error: "GitHub integration not connected. Connect GitHub in Sources first." },
      { status: 422 }
    );
  }

  const result = await createFixPr({
    repo,
    githubToken,
    scanId: typeof scan_id === "string" ? scan_id : "unknown",
    workflowName: typeof workflow_name === "string" ? workflow_name : "workflow",
    finding: finding as Parameters<typeof createFixPr>[0]["finding"],
    fix: fix as FixProposal,
    workflowContent: workflow_content ?? {},
  });

  if (!result.ok) {
    // Save failed attempt
    await supabase.from("fix_prs").insert({
      scan_id: typeof scan_id === "string" ? scan_id : null,
      finding_signature: (finding as Record<string, unknown>).signature as string ?? "",
      rule_id: (finding as Record<string, unknown>).rule_id as string ?? "",
      github_repo: repo,
      status: "failed",
      patch: (fix as FixProposal).patch ?? [],
      error_message: result.error,
      user_id: user.id,
    });
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // Persist PR record
  await supabase.from("fix_prs").insert({
    scan_id: typeof scan_id === "string" ? scan_id : null,
    finding_signature: (finding as Record<string, unknown>).signature as string ?? "",
    rule_id: (finding as Record<string, unknown>).rule_id as string ?? "",
    github_repo: repo,
    github_pr_number: result.prNumber,
    github_pr_url: result.prUrl,
    status: "opened",
    patch: (fix as FixProposal).patch ?? [],
    user_id: user.id,
  });

  // Record governance decision
  await supabase.from("governance_decisions").insert({
    scan_id: typeof scan_id === "string" ? scan_id : null,
    finding_signature: (finding as Record<string, unknown>).signature as string ?? null,
    decision_type: "apply_fix",
    rationale: `Fix PR opened: ${result.prUrl}`,
    actor_user_id: user.id,
    payload: { pr_url: result.prUrl, pr_number: result.prNumber, repo },
  });

  return NextResponse.json({
    ok: true,
    pr_url: result.prUrl,
    pr_number: result.prNumber,
    branch: result.branch,
  });
}

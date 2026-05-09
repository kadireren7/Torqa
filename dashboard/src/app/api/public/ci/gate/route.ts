/**
 * POST /api/public/ci/gate
 * CI-optimized governance gate endpoint.
 * Returns exit_code: 0 (pass) or 1 (fail) based on policy + fail_on setting.
 * Designed to be called from GitHub Actions, GitLab CI, etc.
 */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { scanWorkflow } from "@/lib/scan-engine-server";
import { validateTorqaConfig, resolveExitCode } from "@/lib/torqa-config";
import type { TorqaConfig } from "@/lib/torqa-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Auth: Bearer API key
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  let userId: string | null = null;
  let orgId: string | null = null;

  if (apiKey && isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data: keyRow } = await supabase
        .from("api_keys")
        .select("user_id, organization_id")
        .eq("key_hash", await hashApiKey(apiKey))
        .eq("revoked", false)
        .maybeSingle();
      if (keyRow) {
        userId = keyRow.user_id as string;
        orgId = keyRow.organization_id as string ?? null;
      }
    }
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return ciResponse(400, { error: "Invalid JSON", exit_code: 2 });
  }

  const b = body as Record<string, unknown>;
  const workflow = b.workflow;
  const source = typeof b.source === "string" ? b.source : "generic";
  const workflowName = typeof b.workflow_name === "string" ? b.workflow_name : "ci-workflow";
  const ref = typeof b.ref === "string" ? b.ref : undefined;

  // Parse config (can be inline or just policy slug)
  let config: TorqaConfig = { version: "1", policy: "torqa-baseline", fail_on: "fail" };
  if (b.config) {
    const validation = validateTorqaConfig(b.config);
    if (!validation.valid) {
      return ciResponse(400, { error: `Invalid config: ${validation.errors.join(", ")}`, exit_code: 2 });
    }
    config = validation.config;
  } else if (typeof b.policy === "string") {
    config.policy = b.policy;
  }
  if (typeof b.fail_on === "string") {
    config.fail_on = b.fail_on as TorqaConfig["fail_on"];
  }

  if (!workflow) {
    return ciResponse(400, { error: "workflow is required", exit_code: 2 });
  }

  // Run scan
  const scanResult = await scanWorkflow(workflow, source, workflowName);
  const exitCode = resolveExitCode(
    scanResult.status as "PASS" | "NEEDS REVIEW" | "FAIL",
    config.fail_on
  );

  // Persist CI run if Supabase available
  if (isSupabaseConfigured() && userId) {
    const supabase = await createClient();
    if (supabase) {
      await supabase.from("ci_gate_runs").insert({
        workflow_name: workflowName,
        source,
        policy_slug: config.policy,
        status: exitCode === 0 ? "pass" : scanResult.status === "NEEDS REVIEW" ? "review" : "fail",
        trust_score: scanResult.riskScore,
        findings_count: scanResult.findings.length,
        exit_code: exitCode,
        caller_ref: ref,
        organization_id: orgId,
        user_id: userId,
      });
    }
  }

  return ciResponse(200, {
    exit_code: exitCode,
    decision: scanResult.status,
    trust_score: scanResult.riskScore,
    findings: scanResult.findings.length,
    high_severity: scanResult.totals.high,
    policy: config.policy,
    fail_on: config.fail_on ?? "fail",
    workflow_name: workflowName,
    source,
    ref,
  });
}

function ciResponse(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

async function hashApiKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

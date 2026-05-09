/**
 * POST /api/public/config-run
 * Run a governance scan driven by a torqa.config.json.
 * Compliance-as-Code endpoint.
 */
import { NextResponse } from "next/server";
import { validateTorqaConfig, resolveExitCode, generateConfigTemplate } from "@/lib/torqa-config";
import { scanWorkflow } from "@/lib/scan-engine-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Validate config
  const validation = validateTorqaConfig(b.config);
  if (!validation.valid) {
    return NextResponse.json({
      error: "Invalid torqa.config",
      errors: validation.errors,
      template: JSON.parse(generateConfigTemplate()),
    }, { status: 400 });
  }

  const { config } = validation;

  if (!b.workflow) {
    return NextResponse.json({ error: "workflow is required" }, { status: 400 });
  }

  const source = typeof b.source === "string" ? b.source : "generic";
  const workflowName = typeof b.workflow_name === "string" ? b.workflow_name : "config-run";

  const scanResult = await scanWorkflow(b.workflow, source, workflowName);
  const exitCode = resolveExitCode(
    scanResult.status as "PASS" | "NEEDS REVIEW" | "FAIL",
    config.fail_on
  );

  return NextResponse.json({
    exit_code: exitCode,
    decision: scanResult.status,
    trust_score: scanResult.riskScore,
    findings: scanResult.findings,
    totals: scanResult.totals,
    policy: config.policy,
    fail_on: config.fail_on ?? "fail",
    config_version: config.version,
    workflow_name: workflowName,
    source,
  });
}

export async function GET() {
  return NextResponse.json({
    description: "Compliance-as-Code endpoint. POST with { config, workflow, source? }.",
    template: JSON.parse(generateConfigTemplate()),
    docs: "https://torqa.dev/docs/compliance-as-code",
  });
}

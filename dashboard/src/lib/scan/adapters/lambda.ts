/**
 * AWS Lambda adapter — deterministic detector + analyzer.
 *
 * Accepts three common payload shapes:
 *   1. Function configuration (output of `aws lambda get-function-configuration`).
 *   2. CloudFormation / SAM template (Resources of `AWS::Lambda::Function`).
 *   3. SAM `serverless.yml` JSON dump with `functions` map.
 *
 * Findings emit the v1 rule_id family so policies and the Fix Engine can
 * cross-correlate with n8n / Make / Zapier findings.
 */

import type { ScanFinding, ScanSeverity } from "@/lib/scan-engine";

const SECRET_KEY_PATTERN = /(api[-_]?key|token|secret|password|bearer|authorization|aws[_-]?(access|secret)[_-]?key)/i;
const MASKED_VALUE_PATTERN = /(\*{3,}|<redacted>|<hidden>|xxxxx|your[_-]?(token|key|secret)|changeme)/i;
const EXPR_VALUE_PATTERN = /(\{\{.+\}\}|\$\{.+\}|<%.*%>)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushFinding(
  out: ScanFinding[],
  severity: ScanSeverity,
  rule_id: string,
  target: string,
  explanation: string,
  suggested_fix: string
) {
  out.push({ severity, rule_id, target, explanation, suggested_fix });
}

type LambdaFunctionView = {
  name: string;
  runtime: string | null;
  handler: string | null;
  timeout: number | null;
  role: string | null;
  vpcAttached: boolean;
  envVars: Record<string, unknown> | null;
  policy: Record<string, unknown> | null;
  tracingMode: string | null;
};

function looksPlaintextSecret(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 6) return false;
  if (MASKED_VALUE_PATTERN.test(v)) return false;
  if (EXPR_VALUE_PATTERN.test(v)) return false;
  if (/^(true|false|null|undefined)$/i.test(v)) return false;
  if (/^arn:/i.test(v)) return false;
  return true;
}

function fromGetFunction(content: Record<string, unknown>): LambdaFunctionView | null {
  // Output of get-function-configuration / get-function.
  // get-function returns { Configuration: {...}, Code: {...} }
  const cfg = isRecord(content.Configuration) ? content.Configuration : content;
  if (!isRecord(cfg)) return null;
  const fn = cfg as Record<string, unknown>;
  if (typeof fn.FunctionName !== "string") return null;
  const env = isRecord(fn.Environment) && isRecord(fn.Environment.Variables) ? fn.Environment.Variables : null;
  return {
    name: fn.FunctionName,
    runtime: typeof fn.Runtime === "string" ? fn.Runtime : null,
    handler: typeof fn.Handler === "string" ? fn.Handler : null,
    timeout: typeof fn.Timeout === "number" ? fn.Timeout : null,
    role: typeof fn.Role === "string" ? fn.Role : null,
    vpcAttached: isRecord(fn.VpcConfig) && Array.isArray(fn.VpcConfig.SubnetIds) && fn.VpcConfig.SubnetIds.length > 0,
    envVars: env,
    policy: isRecord(fn.Policy) ? fn.Policy : null,
    tracingMode: isRecord(fn.TracingConfig) && typeof fn.TracingConfig.Mode === "string" ? fn.TracingConfig.Mode : null,
  };
}

function fromCloudFormation(resources: Record<string, unknown>): LambdaFunctionView[] {
  const out: LambdaFunctionView[] = [];
  for (const [logicalId, raw] of Object.entries(resources)) {
    if (!isRecord(raw)) continue;
    const type = typeof raw.Type === "string" ? raw.Type : null;
    if (type !== "AWS::Lambda::Function" && type !== "AWS::Serverless::Function") continue;
    const props = isRecord(raw.Properties) ? raw.Properties : {};
    const env =
      isRecord(props.Environment) && isRecord(props.Environment.Variables)
        ? props.Environment.Variables
        : null;
    out.push({
      name: typeof props.FunctionName === "string" ? props.FunctionName : logicalId,
      runtime: typeof props.Runtime === "string" ? props.Runtime : null,
      handler: typeof props.Handler === "string" ? props.Handler : null,
      timeout: typeof props.Timeout === "number" ? props.Timeout : null,
      role: typeof props.Role === "string" ? props.Role : null,
      vpcAttached: isRecord(props.VpcConfig),
      envVars: env,
      policy: null,
      tracingMode:
        isRecord(props.TracingConfig) && typeof props.TracingConfig.Mode === "string"
          ? props.TracingConfig.Mode
          : null,
    });
  }
  return out;
}

function fromServerlessYaml(functions: Record<string, unknown>): LambdaFunctionView[] {
  const out: LambdaFunctionView[] = [];
  for (const [logicalId, raw] of Object.entries(functions)) {
    if (!isRecord(raw)) continue;
    const env = isRecord(raw.environment) ? raw.environment : null;
    out.push({
      name: typeof raw.name === "string" ? raw.name : logicalId,
      runtime: typeof raw.runtime === "string" ? raw.runtime : null,
      handler: typeof raw.handler === "string" ? raw.handler : null,
      timeout: typeof raw.timeout === "number" ? raw.timeout : null,
      role: typeof raw.role === "string" ? raw.role : null,
      vpcAttached: isRecord(raw.vpc),
      envVars: env,
      policy: null,
      tracingMode: typeof raw.tracing === "string" ? raw.tracing : null,
    });
  }
  return out;
}

function detectFunctions(content: Record<string, unknown>): LambdaFunctionView[] {
  // Shape 1: get-function/get-function-configuration.
  const single = fromGetFunction(content);
  if (single) return [single];

  // Shape 2: CloudFormation / SAM template.
  if (isRecord(content.Resources)) {
    const cfn = fromCloudFormation(content.Resources);
    if (cfn.length > 0) return cfn;
  }

  // Shape 3: serverless.yml JSON dump.
  if (isRecord(content.functions)) {
    const sls = fromServerlessYaml(content.functions);
    if (sls.length > 0) return sls;
  }
  return [];
}

const DEPRECATED_RUNTIMES = new Set([
  "nodejs8.10",
  "nodejs10.x",
  "nodejs12.x",
  "nodejs14.x",
  "python2.7",
  "python3.6",
  "python3.7",
  "ruby2.5",
  "ruby2.7",
  "dotnetcore2.1",
  "dotnetcore3.1",
  "go1.x",
]);

function analyzeFunction(out: ScanFinding[], fn: LambdaFunctionView) {
  const target = `function:${fn.name}`;

  if (fn.runtime && DEPRECATED_RUNTIMES.has(fn.runtime.toLowerCase())) {
    pushFinding(
      out,
      "high",
      "v1.lambda.deprecated_runtime",
      target,
      `Function uses deprecated/unsupported runtime "${fn.runtime}".`,
      "Upgrade to a currently-supported AWS Lambda runtime (see AWS Lambda runtime support policy)."
    );
  }

  if (fn.tracingMode && fn.tracingMode.toLowerCase() === "passthrough") {
    pushFinding(
      out,
      "info",
      "v1.lambda.tracing_passthrough",
      target,
      "X-Ray tracing is set to PassThrough — function will only sample when called by a traced upstream.",
      "Set TracingConfig.Mode=Active to ensure consistent observability across direct invocations."
    );
  } else if (!fn.tracingMode) {
    pushFinding(
      out,
      "info",
      "v1.lambda.tracing_disabled",
      target,
      "X-Ray tracing is not configured.",
      "Enable X-Ray tracing (TracingConfig.Mode=Active) for production functions to ease incident debugging."
    );
  }

  if (typeof fn.timeout === "number") {
    if (fn.timeout > 60) {
      pushFinding(
        out,
        "review",
        "v1.lambda.long_timeout",
        target,
        `Timeout is ${fn.timeout}s — long timeouts often hide upstream issues and amplify cost on retries.`,
        "Aim for timeouts ≤ 60s for synchronous workloads; queue long jobs via SQS/Step Functions."
      );
    }
    if (fn.timeout < 3) {
      pushFinding(
        out,
        "info",
        "v1.lambda.short_timeout",
        target,
        `Timeout is only ${fn.timeout}s — cold-start init can exceed this and cause spurious failures.`,
        "Increase the timeout to at least 3–5s to absorb cold-start latency."
      );
    }
  }

  if (fn.role) {
    if (/AdministratorAccess|\*Power\*|FullAccess/i.test(fn.role)) {
      pushFinding(
        out,
        "critical",
        "v1.lambda.over_permissioned_role",
        target,
        `Function role looks over-permissioned: "${fn.role}".`,
        "Replace administrator roles with least-privilege custom IAM roles scoped to the resources actually used."
      );
    }
  } else {
    pushFinding(
      out,
      "review",
      "v1.lambda.missing_role",
      target,
      "Function has no IAM role attached.",
      "Attach a least-privilege IAM role before deploying to production."
    );
  }

  if (fn.envVars) {
    for (const [k, v] of Object.entries(fn.envVars)) {
      const stringValue = typeof v === "string" ? v : null;
      if (!stringValue) continue;
      if (!SECRET_KEY_PATTERN.test(k)) continue;
      if (!looksPlaintextSecret(stringValue)) continue;
      pushFinding(
        out,
        "critical",
        "v1.secret.plaintext_detected",
        `${target}.env.${k}`,
        `Plaintext secret-like value detected in Lambda environment variable "${k}".`,
        "Use AWS Secrets Manager or SSM Parameter Store; reference values at runtime instead of baking them into config."
      );
    }
  }
}

export function isLikelyLambda(value: unknown): boolean {
  if (!isRecord(value)) return false;
  // get-function shape
  if (typeof value.FunctionName === "string" && typeof value.Runtime === "string") return true;
  if (isRecord(value.Configuration) && typeof value.Configuration.FunctionName === "string") return true;

  // CFN/SAM
  if (
    typeof value.AWSTemplateFormatVersion === "string" ||
    (isRecord(value.Resources) &&
      Object.values(value.Resources).some(
        (r) =>
          isRecord(r) &&
          (r.Type === "AWS::Lambda::Function" || r.Type === "AWS::Serverless::Function")
      ))
  ) {
    return true;
  }

  // serverless.yml-style
  if (typeof value.service === "string" && isRecord(value.functions)) return true;

  return false;
}

export function analyzeLambda(content: unknown): ScanFinding[] {
  const out: ScanFinding[] = [];
  if (!isRecord(content)) {
    pushFinding(
      out,
      "critical",
      "v1.lambda.shape_mismatch",
      "lambda",
      "Source is lambda but JSON does not match a recognised AWS Lambda config or template shape.",
      "Provide the output of `aws lambda get-function-configuration`, a CloudFormation/SAM template, or a serverless.yml JSON dump."
    );
    return out;
  }

  const fns = detectFunctions(content);
  if (fns.length === 0) {
    pushFinding(
      out,
      "critical",
      "v1.lambda.no_functions",
      "lambda",
      "No Lambda function definitions were found in the input.",
      "Include at least one AWS::Lambda::Function (or serverless `functions:` entry)."
    );
    return out;
  }
  for (const fn of fns) analyzeFunction(out, fn);
  return out;
}

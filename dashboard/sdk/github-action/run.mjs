#!/usr/bin/env node
/**
 * Torqa GitHub Action runner.
 *
 * Reads inputs from environment (mirrors action.yml), runs a public scan,
 * optionally evaluates the result against a Policy Pack v2, and exits
 * non-zero when the verdict matches `TORQA_FAIL_ON`.
 *
 * Self-contained on purpose: no SDK dependency so the action can run
 * inside ephemeral CI without `npm install`.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const env = process.env;
const required = ["TORQA_API_KEY", "TORQA_BASE_URL", "TORQA_SOURCE", "TORQA_WORKFLOW_FILE"];
for (const key of required) {
  if (!env[key]) {
    console.error(`::error::Missing required env ${key}`);
    process.exit(2);
  }
}

const baseUrl = env.TORQA_BASE_URL.replace(/\/+$/, "");
const failOn = (env.TORQA_FAIL_ON ?? "block").toLowerCase();
if (!["pass", "review", "block"].includes(failOn)) {
  console.error(`::error::TORQA_FAIL_ON must be pass | review | block`);
  process.exit(2);
}

async function callJson(path, init) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "x-api-key": env.TORQA_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "torqa-github-action/0.2.1",
      ...(init?.headers ?? {}),
    },
  });
  const requestId = res.headers.get("x-request-id");
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* swallow */
  }
  if (!res.ok || !body?.ok) {
    const code = body?.error?.code ?? `http_${res.status}`;
    const message = body?.error?.message ?? res.statusText;
    console.error(`::error::Torqa ${path} failed (${code}): ${message}${requestId ? ` (requestId=${requestId})` : ""}`);
    process.exit(2);
  }
  return { data: body.data, requestId: body.meta?.requestId ?? requestId };
}

async function main() {
  const filePath = resolve(env.TORQA_WORKFLOW_FILE);
  const raw = await readFile(filePath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`::error::Workflow file is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }

  const scan = await callJson("/api/public/scan", {
    method: "POST",
    body: JSON.stringify({
      source: env.TORQA_SOURCE,
      content: parsed,
    }),
  });

  const findings = Array.isArray(scan.data?.findings) ? scan.data.findings : [];
  const riskScore = typeof scan.data?.risk_score === "number" ? scan.data.risk_score : 0;
  const engineGate = typeof scan.data?.gate_status === "string" ? scan.data.gate_status : null;

  let verdict = "pass";
  if (env.TORQA_PACK_ID) {
    const evaluation = await callJson("/api/public/policy/evaluate", {
      method: "POST",
      body: JSON.stringify({
        policyPackId: env.TORQA_PACK_ID,
        source: env.TORQA_SOURCE,
        findings,
        riskScore,
      }),
    });
    verdict = evaluation.data.verdict;
    console.log(`::notice::Torqa pack=${env.TORQA_PACK_ID} verdict=${verdict} (requestId=${evaluation.requestId})`);
    for (const reason of evaluation.data.reasons ?? []) {
      console.log(`::notice::reason: ${reason}`);
    }
  } else {
    if (engineGate === "FAIL") verdict = "block";
    else if (engineGate === "NEEDS REVIEW") verdict = "review";
    else verdict = "pass";
    console.log(`::notice::Torqa engineGate=${engineGate} verdict=${verdict} (requestId=${scan.requestId})`);
  }

  // GitHub Actions outputs.
  if (env.GITHUB_OUTPUT) {
    const out = `verdict=${verdict}\nrequest-id=${scan.requestId ?? ""}\n`;
    await (await import("node:fs")).promises.appendFile(env.GITHUB_OUTPUT, out);
  }

  const order = { pass: 0, review: 1, block: 2 };
  if (order[verdict] >= order[failOn]) {
    console.error(`::error::Torqa governance gate triggered: verdict=${verdict} >= fail-on=${failOn}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`::error::Torqa action crashed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(2);
});

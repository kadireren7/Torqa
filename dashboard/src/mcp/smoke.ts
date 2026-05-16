#!/usr/bin/env node
/**
 * Torqa MCP smoke test — runs the workflow planning tools end-to-end
 * without standing up the stdio transport. Used to verify that builds
 * still produce a working planning engine.
 */
import {
  createWorkflowFromPrompt,
  exportWorkflow,
  listWorkflowTemplates,
  validateWorkflow,
} from "@/lib/mcp/workflow-tools/handlers";

type Status = "ok" | "fail";

function line(label: string, status: Status, detail: string): string {
  const mark = status === "ok" ? "✓" : "✗";
  return `${mark} ${label.padEnd(28)} ${detail}`;
}

async function main(): Promise<void> {
  const results: string[] = [];
  let failures = 0;

  // 1. templates load
  const { templates } = listWorkflowTemplates();
  if (templates.length === 0) {
    failures += 1;
    results.push(line("templates", "fail", "no templates returned"));
  } else {
    results.push(line("templates", "ok", `${templates.length} templates`));
  }

  // 2. create from prompt
  const prompt =
    "Create a workflow that reads urgent Gmail emails, notifies Slack, and drafts replies.";
  const plan = createWorkflowFromPrompt({ prompt });
  const steps = plan.workflow.steps ?? [];
  if (steps.length === 0) {
    failures += 1;
    results.push(line("create_workflow", "fail", "0 steps generated"));
  } else {
    results.push(line("create_workflow", "ok", `${steps.length} steps`));
  }

  // 3. validate
  const validation = validateWorkflow({ workflow: { steps } });
  if (!validation.valid) {
    failures += 1;
    results.push(
      line("validate_workflow", "fail", `errors=${validation.errors.length}`),
    );
  } else {
    results.push(
      line(
        "validate_workflow",
        "ok",
        `warnings=${validation.warnings.length} approvals=${validation.approvalRequired.length}`,
      ),
    );
  }

  // 4. export JSON
  const jsonExport = exportWorkflow({
    workflow: { ...plan.workflow, prompt, goal: plan.goal, intent: plan.intent },
    format: "json",
  });
  if (!jsonExport.content || jsonExport.content.length < 32) {
    failures += 1;
    results.push(line("export_workflow:json", "fail", "empty content"));
  } else {
    results.push(
      line("export_workflow:json", "ok", `${jsonExport.content.length} bytes`),
    );
  }

  // 5. export Claude prompt
  const promptExport = exportWorkflow({
    workflow: { ...plan.workflow, prompt, goal: plan.goal, intent: plan.intent },
    format: "claude_prompt",
  });
  if (!promptExport.content || promptExport.content.trim().length < 32) {
    failures += 1;
    results.push(line("export_workflow:prompt", "fail", "empty content"));
  } else {
    results.push(
      line(
        "export_workflow:prompt",
        "ok",
        `${promptExport.content.length} chars`,
      ),
    );
  }

  const tools = Array.from(new Set(steps.map((s) => s.tool)));
  const approvals = (plan.safety?.approvalPoints ?? []).length;

  console.log("Torqa MCP smoke test");
  console.log("--------------------");
  console.log(`goal               : ${plan.goal}`);
  console.log(`steps              : ${steps.length}`);
  console.log(`tools              : ${tools.join(", ") || "(none)"}`);
  console.log(`approval points    : ${approvals}`);
  console.log(`graph nodes        : ${steps.length + 1}`);
  console.log(`export formats     : json, claude_prompt`);
  console.log("");
  for (const r of results) console.log(r);
  console.log("");

  if (failures > 0) {
    console.error(`smoke test failed: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

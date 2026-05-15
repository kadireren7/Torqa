import { describe, expect, it } from "vitest";
import {
  createWorkflowFromPrompt,
  discoverTools,
  exportWorkflow,
  listWorkflowTemplates,
  validateWorkflow,
  WORKFLOW_TEMPLATES,
} from "./handlers";

describe("discoverTools", () => {
  it("normalizes mock config tool list", () => {
    const out = discoverTools({
      mcpConfig: {
        mcpServers: {
          demo: {
            tools: [
              {
                id: "custom.search",
                name: "Custom Search",
                description: "Search records",
                category: "data",
                risk: "low",
              },
            ],
          },
        },
      },
    });
    expect(out.tools.some((t) => t.id === "custom.search")).toBe(true);
    expect(out.missingLiveConnection).toBe(false);
  });

  it("falls back to Torqa catalog when config has no tools", () => {
    const out = discoverTools({ mcpConfig: { mcpServers: { x: { command: "node" } } } });
    expect(out.tools.length).toBeGreaterThan(0);
    expect(out.tools.some((t) => t.id === "gmail.search")).toBe(true);
    expect(out.missingLiveConnection).toBe(true);
    expect(out.notes.length).toBeGreaterThan(0);
  });

  it("normalizes tools array input", () => {
    const out = discoverTools({
      tools: [{ name: "slack.send_message", description: "Send Slack message", risk: "low" }],
    });
    expect(out.tools[0].id).toBe("slack.send_message");
    expect(out.missingLiveConnection).toBe(false);
  });
});

describe("createWorkflowFromPrompt", () => {
  it("returns stable workflow for email triage prompt", () => {
    const a = createWorkflowFromPrompt({
      prompt: "Every morning, read urgent customer emails, notify Slack, and draft replies.",
      mode: "plan_only",
    });
    const b = createWorkflowFromPrompt({
      prompt: "Every morning, read urgent customer emails, notify Slack, and draft replies.",
      mode: "plan_only",
    });
    expect(a.goal).toBe(b.goal);
    expect(a.workflow.steps.map((s) => s.tool)).toEqual(
      b.workflow.steps.map((s) => s.tool)
    );
    expect(a.workflow.steps.some((s) => s.tool === "gmail.search")).toBe(true);
    expect(a.export.format).toBe("torqa.workflow.v1");
    expect(a.export.json).toBeTruthy();
  });
});

describe("validateWorkflow", () => {
  it("catches missing tool", () => {
    const out = validateWorkflow({
      workflow: {
        steps: [
          {
            id: "step_1",
            tool: "not.a.real.tool",
            purpose: "Do something",
            condition: null,
            approvalRequired: false,
            risk: "low",
          },
        ],
      },
    });
    expect(out.valid).toBe(false);
    expect(out.errors.some((e) => e.includes("Unknown tool"))).toBe(true);
  });

  it("passes known tools", () => {
    const plan = createWorkflowFromPrompt({
      prompt: "Every morning, read urgent customer emails, notify Slack, and draft replies.",
    });
    const out = validateWorkflow({ workflow: plan.workflow });
    expect(out.valid).toBe(true);
  });
});

describe("exportWorkflow", () => {
  it("returns JSON export", () => {
    const plan = createWorkflowFromPrompt({
      prompt: "When a GitHub issue mentions billing, create a CRM task and notify support.",
    });
    const out = exportWorkflow({
      workflow: { ...plan, prompt: plan.goal },
      format: "json",
    });
    expect(out.mimeType).toBe("application/json");
    const parsed = JSON.parse(out.content);
    expect(parsed).toBeTruthy();
  });

  it("returns claude prompt export", () => {
    const plan = createWorkflowFromPrompt({
      prompt: "If a Stripe refund request arrives, create a review task before any refund action.",
    });
    const out = exportWorkflow({
      workflow: plan.workflow,
      format: "claude_prompt",
    });
    expect(out.mimeType).toBe("text/plain");
    expect(out.content).toContain("MCP-powered workflow");
  });
});

describe("listWorkflowTemplates", () => {
  it("returns five templates", () => {
    const { templates } = listWorkflowTemplates();
    expect(templates).toHaveLength(5);
    expect(WORKFLOW_TEMPLATES).toHaveLength(5);
    expect(templates.map((t) => t.name)).toContain("Gmail triage to Slack");
    expect(templates.map((t) => t.name)).toContain("Calendar scheduling assistant");
  });
});

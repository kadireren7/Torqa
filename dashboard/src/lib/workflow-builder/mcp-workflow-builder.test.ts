import { describe, expect, it } from "vitest";
import {
  generateWorkflowPlan,
  buildWorkflowExport,
  PROMPT_EXAMPLES,
  MCP_TOOLS,
} from "./mcp-workflow-builder";

describe("PROMPT_EXAMPLES", () => {
  it("exports exactly 4 examples", () => {
    expect(PROMPT_EXAMPLES).toHaveLength(4);
  });

  it("each example has id, label, prompt, tags", () => {
    for (const ex of PROMPT_EXAMPLES) {
      expect(ex.id).toBeTruthy();
      expect(ex.label).toBeTruthy();
      expect(ex.prompt).toBeTruthy();
      expect(Array.isArray(ex.tags)).toBe(true);
    }
  });
});

describe("MCP_TOOLS", () => {
  it("exports exactly 10 tools", () => {
    expect(MCP_TOOLS).toHaveLength(10);
  });

  it("all tools have required fields", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.system).toBeTruthy();
      expect(["low", "medium", "high"]).toContain(tool.riskLevel);
      expect(typeof tool.irreversible).toBe("boolean");
    }
  });
});

describe("generateWorkflowPlan", () => {
  it("generates a plan for email-triage by id", () => {
    const plan = generateWorkflowPlan("email-triage");
    expect(plan.id).toMatch(/^wf-/);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.intent.trigger).toContain("08:00");
    expect(plan.detectedTools.some((t) => t.id === "gmail.search")).toBe(true);
  });

  it("generates a plan for billing-issue-routing by id", () => {
    const plan = generateWorkflowPlan("billing-issue-routing");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.detectedTools.some((t) => t.id === "github.search_issues")).toBe(true);
    expect(plan.risk.level).toBe("low");
  });

  it("generates a plan for stripe-refund-gate with high risk", () => {
    const plan = generateWorkflowPlan("stripe-refund-gate");
    expect(plan.risk.level).toBe("high");
    expect(plan.risk.requiresApproval).toBe(true);
    expect(plan.risk.irreversibleSteps.length).toBeGreaterThan(0);
    const approvalStep = plan.steps.find((s) => s.approvalRequired);
    expect(approvalStep).toBeDefined();
  });

  it("generates a plan for notion-meeting-notes", () => {
    const plan = generateWorkflowPlan("notion-meeting-notes");
    expect(plan.detectedTools.some((t) => t.id === "notion.search_pages")).toBe(true);
    expect(plan.detectedTools.some((t) => t.id === "sheets.append_row")).toBe(true);
    expect(plan.risk.level).toBe("low");
  });

  it("matches by prompt string as well as id", () => {
    const byId = generateWorkflowPlan("email-triage");
    const byPrompt = generateWorkflowPlan(PROMPT_EXAMPLES[0].prompt);
    expect(byId.intent.goal).toBe(byPrompt.intent.goal);
    expect(byId.steps.length).toBe(byPrompt.steps.length);
  });

  it("returns a generic plan for unknown prompts", () => {
    const plan = generateWorkflowPlan("do something with my files");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].tool).toBe("webhook.call");
    expect(plan.risk.missingTools.length).toBeGreaterThan(0);
  });

  it("each generated plan has a unique id", () => {
    const a = generateWorkflowPlan("email-triage");
    const b = generateWorkflowPlan("email-triage");
    expect(a.id).not.toBe(b.id);
  });

  it("all steps have valid riskLevel", () => {
    for (const ex of PROMPT_EXAMPLES) {
      const plan = generateWorkflowPlan(ex.id);
      for (const step of plan.steps) {
        expect(["low", "medium", "high"]).toContain(step.riskLevel);
      }
    }
  });
});

describe("buildWorkflowExport", () => {
  it("returns valid JSON and a claude prompt", () => {
    const plan = generateWorkflowPlan("billing-issue-routing");
    const exp = buildWorkflowExport(plan);
    const parsed = JSON.parse(exp.workflowJson);
    expect(parsed.id).toBe(plan.id);
    expect(parsed.steps).toHaveLength(plan.steps.length);
    expect(exp.claudePrompt).toContain("MCP-powered workflow");
    expect(exp.claudePrompt).toContain(plan.intent.goal);
  });

  it("flags approval requirement in claude prompt", () => {
    const plan = generateWorkflowPlan("stripe-refund-gate");
    const exp = buildWorkflowExport(plan);
    expect(exp.claudePrompt).toContain("human approval");
  });
});

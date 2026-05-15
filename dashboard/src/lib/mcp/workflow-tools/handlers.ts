import {
  generateWorkflowPlan,
  buildWorkflowExport,
  MCP_TOOLS as BUILDER_TOOLS,
} from "@/lib/workflow-builder/mcp-workflow-builder";
import type { WorkflowPlan } from "@/lib/workflow-builder/types";
import type {
  CreateWorkflowInput,
  CreateWorkflowOutput,
  DiscoverToolsInput,
  DiscoverToolsOutput,
  DiscoveredTool,
  ExportWorkflowInput,
  ExportWorkflowOutput,
  ValidateWorkflowInput,
  ValidateWorkflowOutput,
  WorkflowMcp,
  WorkflowStepMcp,
  WorkflowTemplate,
} from "./types";

const KNOWN_TOOL_IDS = new Set(BUILDER_TOOLS.map((t) => t.id));

const SYSTEM_CATEGORY: Record<string, string> = {
  Gmail: "email",
  Slack: "messaging",
  CRM: "crm",
  GitHub: "devtools",
  Notion: "docs",
  "Google Sheets": "spreadsheet",
  Stripe: "payments",
  "Google Calendar": "calendar",
  Webhook: "integration",
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "gmail-triage-slack",
    name: "Gmail triage to Slack",
    description:
      "Every morning, find urgent customer emails, notify Slack, and draft replies for review.",
    prompt:
      "Every morning, read urgent customer emails, notify Slack, and draft replies.",
    exampleId: "email-triage",
    tags: ["gmail", "slack", "scheduled"],
  },
  {
    id: "github-issue-crm",
    name: "GitHub issue to CRM task",
    description:
      "When a GitHub issue mentions billing, create a CRM task and alert support.",
    prompt:
      "When a GitHub issue mentions billing, create a CRM task and notify support.",
    exampleId: "billing-issue-routing",
    tags: ["github", "crm", "event-driven"],
  },
  {
    id: "meeting-notes-sheets",
    name: "Meeting notes to Sheets",
    description:
      "Summarize new Notion meeting notes and append action items to Google Sheets.",
    prompt:
      "Summarize new Notion meeting notes and add action items to Google Sheets.",
    exampleId: "notion-meeting-notes",
    tags: ["notion", "sheets", "scheduled"],
  },
  {
    id: "stripe-refund-gate",
    name: "Stripe refund review gate",
    description:
      "Require human approval before processing any Stripe refund request.",
    prompt:
      "If a Stripe refund request arrives, create a review task before any refund action.",
    exampleId: "stripe-refund-gate",
    tags: ["stripe", "approval", "event-driven"],
  },
  {
    id: "calendar-scheduling",
    name: "Calendar scheduling assistant",
    description:
      "Check calendar availability and propose meeting times with attendee approval before creating events.",
    prompt:
      "When someone requests a meeting, check calendar availability, propose times in Slack, and create calendar events only after approval.",
    tags: ["calendar", "slack", "approval"],
  },
];

function builderToolToDiscovered(
  tool: (typeof BUILDER_TOOLS)[number]
): DiscoveredTool {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    category: SYSTEM_CATEGORY[tool.system] ?? "integration",
    risk: tool.riskLevel,
    requiresApproval: tool.irreversible || tool.riskLevel === "high",
  };
}

function normalizeExternalTool(raw: unknown): DiscoveredTool | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    (typeof o.id === "string" && o.id) ||
    (typeof o.name === "string" && o.name) ||
    null;
  if (!id) return null;
  const riskRaw = typeof o.risk === "string" ? o.risk : typeof o.riskLevel === "string" ? o.riskLevel : "low";
  const risk = ["low", "medium", "high"].includes(riskRaw)
    ? (riskRaw as "low" | "medium" | "high")
    : "medium";
  return {
    id,
    name: typeof o.name === "string" ? o.name : id,
    description:
      typeof o.description === "string"
        ? o.description
        : "Tool from connected MCP server (description not provided).",
    category: typeof o.category === "string" ? o.category : "integration",
    risk,
    requiresApproval:
      o.requiresApproval === true ||
      o.irreversible === true ||
      risk === "high",
  };
}

function extractToolsFromMcpConfig(
  mcpConfig: Record<string, unknown>
): { tools: DiscoveredTool[]; notes: string[] } {
  const notes: string[] = [];
  const tools: DiscoveredTool[] = [];

  const servers = mcpConfig.mcpServers;
  if (servers && typeof servers === "object" && !Array.isArray(servers)) {
    for (const [serverName, cfg] of Object.entries(
      servers as Record<string, unknown>
    )) {
      if (!cfg || typeof cfg !== "object") continue;
      const c = cfg as Record<string, unknown>;
      if (Array.isArray(c.tools)) {
        for (const t of c.tools) {
          const normalized = normalizeExternalTool(t);
          if (normalized) tools.push(normalized);
        }
      } else {
        notes.push(
          `Server "${serverName}" has no inline tool list — live MCP introspection is required for full inventory.`
        );
      }
    }
  }

  if (Array.isArray(mcpConfig.tools)) {
    for (const t of mcpConfig.tools) {
      const normalized = normalizeExternalTool(t);
      if (normalized) tools.push(normalized);
    }
  }

  if (tools.length === 0 && notes.length === 0) {
    notes.push(
      "No tool definitions found in mcpConfig — returning Torqa catalog as planning reference."
    );
  }

  return { tools, notes };
}

export function discoverTools(input: DiscoverToolsInput): DiscoverToolsOutput {
  const notes: string[] = [];
  let tools: DiscoveredTool[] = [];
  let missingLiveConnection = true;

  if (Array.isArray(input.tools) && input.tools.length > 0) {
    tools = input.tools
      .map(normalizeExternalTool)
      .filter((t): t is DiscoveredTool => t !== null);
    missingLiveConnection = false;
    notes.push("Normalized tools from provided tool definitions array.");
  } else if (input.mcpConfig && typeof input.mcpConfig === "object") {
    const extracted = extractToolsFromMcpConfig(input.mcpConfig);
    tools = extracted.tools;
    notes.push(...extracted.notes);
    missingLiveConnection = tools.length === 0;
  }

  if (tools.length === 0) {
    tools = BUILDER_TOOLS.map(builderToolToDiscovered);
    notes.push(
      "Using Torqa planning catalog (simulated). Connect a live MCP server for real tool discovery."
    );
    missingLiveConnection = true;
  }

  return { tools, missingLiveConnection, notes };
}

function planToWorkflowMcp(plan: WorkflowPlan): WorkflowMcp {
  return {
    steps: plan.steps.map(
      (s): WorkflowStepMcp => ({
        id: s.id,
        tool: s.tool,
        purpose: s.description,
        condition: s.condition,
        approvalRequired: s.approvalRequired,
        risk: s.riskLevel,
      })
    ),
  };
}

function planToExportJson(plan: WorkflowPlan): Record<string, unknown> {
  const { workflowJson } = buildWorkflowExport(plan);
  return JSON.parse(workflowJson) as Record<string, unknown>;
}

export function planToCreateWorkflowOutput(plan: WorkflowPlan): CreateWorkflowOutput {
  const workflow = planToWorkflowMcp(plan);
  const approvalPoints = plan.steps
    .filter((s) => s.approvalRequired)
    .map((s) => `${s.id}: ${s.tool}`);

  return {
    goal: plan.intent.goal,
    intent: {
      trigger: plan.intent.trigger,
      systems: plan.intent.requiredSystems,
      entities: plan.intent.entities,
      approvalSensitiveActions: plan.intent.approvalSensitiveActions,
    },
    workflow,
    safety: {
      approvalPoints,
      blockedActions: plan.risk.excludedUnsafeTools,
      missingTools: plan.risk.missingTools,
    },
    export: {
      format: "torqa.workflow.v1",
      json: planToExportJson(plan),
    },
  };
}

export function createWorkflowFromPrompt(
  input: CreateWorkflowInput
): CreateWorkflowOutput {
  const prompt = input.prompt?.trim();
  if (!prompt) {
    throw new Error("prompt is required");
  }
  const plan = generateWorkflowPlan(prompt);
  return planToCreateWorkflowOutput(plan);
}

export function validateWorkflow(
  input: ValidateWorkflowInput
): ValidateWorkflowOutput {
  const steps = input.workflow?.steps;
  const warnings: string[] = [];
  const errors: string[] = [];
  const approvalRequired: string[] = [];

  if (!Array.isArray(steps) || steps.length === 0) {
    return {
      valid: false,
      warnings,
      errors: ["workflow.steps must be a non-empty array"],
      approvalRequired,
    };
  }

  for (const step of steps) {
    if (!step.id) errors.push("Each step must have an id");
    if (!step.tool) {
      errors.push(`Step ${step.id ?? "(unknown)"} is missing tool`);
      continue;
    }
    if (!KNOWN_TOOL_IDS.has(step.tool)) {
      errors.push(`Unknown tool: ${step.tool}`);
    }
    if (step.approvalRequired) {
      approvalRequired.push(`${step.id}: ${step.tool}`);
    }
    if (step.risk === "high" && !step.approvalRequired) {
      warnings.push(
        `Step ${step.id} (${step.tool}) is high risk but approvalRequired is false`
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    approvalRequired,
  };
}

function workflowToPlan(workflow: Record<string, unknown>): WorkflowPlan {
  const stepsRaw = workflow.steps;
  if (!Array.isArray(stepsRaw)) {
    throw new Error("workflow.steps is required for export");
  }

  const prompt =
    typeof workflow.prompt === "string"
      ? workflow.prompt
      : typeof workflow.goal === "string"
        ? workflow.goal
        : "Exported workflow";

  const intentRaw =
    workflow.intent && typeof workflow.intent === "object"
      ? (workflow.intent as Record<string, unknown>)
      : {};

  const steps = stepsRaw.map((s, i) => {
    const step = s as Record<string, unknown>;
    const riskRaw =
      step.risk === "low" || step.risk === "medium" || step.risk === "high"
        ? step.risk
        : step.riskLevel === "low" ||
            step.riskLevel === "medium" ||
            step.riskLevel === "high"
          ? step.riskLevel
          : "low";
    const riskLevel: "low" | "medium" | "high" =
      riskRaw === "medium" || riskRaw === "high" ? riskRaw : "low";
    return {
      id: typeof step.id === "string" ? step.id : `step-${i + 1}`,
      stepNumber: i + 1,
      tool: typeof step.tool === "string" ? step.tool : "webhook.call",
      description:
        typeof step.purpose === "string"
          ? step.purpose
          : typeof step.description === "string"
            ? step.description
            : "Workflow step",
      inputSummary:
        typeof step.inputSummary === "string" ? step.inputSummary : "",
      condition:
        typeof step.condition === "string"
          ? step.condition
          : step.condition === null
            ? null
            : null,
      approvalRequired: step.approvalRequired === true,
      riskLevel,
      fallback: typeof step.fallback === "string" ? step.fallback : "",
    };
  });

  const toolIds = [...new Set(steps.map((s) => s.tool))];
  const detectedTools = BUILDER_TOOLS.filter((t) => toolIds.includes(t.id));

  return {
    id: typeof workflow.id === "string" ? workflow.id : `wf-export-${Date.now()}`,
    prompt,
    generatedAt: new Date().toISOString(),
    intent: {
      goal:
        typeof intentRaw.goal === "string"
          ? intentRaw.goal
          : typeof workflow.goal === "string"
            ? workflow.goal
            : prompt,
      trigger:
        typeof intentRaw.trigger === "string" ? intentRaw.trigger : "Manual",
      entities: Array.isArray(intentRaw.entities)
        ? (intentRaw.entities as string[])
        : [],
      requiredSystems: Array.isArray(intentRaw.systems)
        ? (intentRaw.systems as string[])
        : Array.isArray(intentRaw.requiredSystems)
          ? (intentRaw.requiredSystems as string[])
          : [],
      approvalSensitiveActions: Array.isArray(intentRaw.approvalSensitiveActions)
        ? (intentRaw.approvalSensitiveActions as string[])
        : [],
    },
    detectedTools:
      detectedTools.length > 0 ? detectedTools : [BUILDER_TOOLS.find((t) => t.id === "webhook.call")!],
    steps,
    risk: {
      level: steps.some((s) => s.riskLevel === "high")
        ? "high"
        : steps.some((s) => s.riskLevel === "medium")
          ? "medium"
          : "low",
      reasons: ["Exported from MCP workflow object"],
      requiresApproval: steps.some((s) => s.approvalRequired),
      irreversibleSteps: steps
        .filter((s) => s.riskLevel === "high")
        .map((s) => s.id),
      missingTools: [],
      excludedUnsafeTools: [],
    },
  };
}

export function exportWorkflow(input: ExportWorkflowInput): ExportWorkflowOutput {
  const format = input.format ?? "json";
  const workflow = input.workflow;

  if (format === "json") {
    const content =
      workflow.export &&
      typeof workflow.export === "object" &&
      (workflow.export as Record<string, unknown>).json
        ? JSON.stringify((workflow.export as Record<string, unknown>).json, null, 2)
        : JSON.stringify(workflow, null, 2);
    return { content, mimeType: "application/json" };
  }

  const plan = workflowToPlan(workflow);
  const { claudePrompt } = buildWorkflowExport(plan);
  return { content: claudePrompt, mimeType: "text/plain" };
}

export function listWorkflowTemplates(): { templates: WorkflowTemplate[] } {
  return { templates: WORKFLOW_TEMPLATES };
}

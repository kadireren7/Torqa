import type {
  McpToolDefinition,
  WorkflowPlan,
  WorkflowPromptExample,
  WorkflowExport,
} from "./types";

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    id: "gmail.search",
    name: "gmail.search",
    system: "Gmail",
    description: "Search Gmail inbox using query filters.",
    requiresAuth: true,
    riskLevel: "low",
    irreversible: false,
    capabilities: ["read_email", "filter"],
  },
  {
    id: "gmail.create_draft",
    name: "gmail.create_draft",
    system: "Gmail",
    description: "Create a draft email reply.",
    requiresAuth: true,
    riskLevel: "medium",
    irreversible: false,
    capabilities: ["write_email", "draft"],
  },
  {
    id: "slack.send_message",
    name: "slack.send_message",
    system: "Slack",
    description: "Send a message to a Slack channel or user.",
    requiresAuth: true,
    riskLevel: "low",
    irreversible: false,
    capabilities: ["notify", "message"],
  },
  {
    id: "crm.create_task",
    name: "crm.create_task",
    system: "CRM",
    description: "Create a task or ticket in the connected CRM.",
    requiresAuth: true,
    riskLevel: "low",
    irreversible: false,
    capabilities: ["write_task", "assign"],
  },
  {
    id: "github.search_issues",
    name: "github.search_issues",
    system: "GitHub",
    description: "Search GitHub issues using keyword and label filters.",
    requiresAuth: true,
    riskLevel: "low",
    irreversible: false,
    capabilities: ["read_issues", "filter"],
  },
  {
    id: "notion.search_pages",
    name: "notion.search_pages",
    system: "Notion",
    description: "Search Notion pages by title, tag, or last-modified.",
    requiresAuth: true,
    riskLevel: "low",
    irreversible: false,
    capabilities: ["read_pages", "search"],
  },
  {
    id: "sheets.append_row",
    name: "sheets.append_row",
    system: "Google Sheets",
    description: "Append a row of data to a Google Sheet.",
    requiresAuth: true,
    riskLevel: "low",
    irreversible: false,
    capabilities: ["write_spreadsheet", "append"],
  },
  {
    id: "stripe.create_refund_review",
    name: "stripe.create_refund_review",
    system: "Stripe",
    description: "Create a manual review task before processing a refund.",
    requiresAuth: true,
    riskLevel: "high",
    irreversible: true,
    capabilities: ["financial_write", "approval_gate"],
  },
  {
    id: "calendar.create_event",
    name: "calendar.create_event",
    system: "Google Calendar",
    description: "Create a calendar event and invite attendees.",
    requiresAuth: true,
    riskLevel: "low",
    irreversible: false,
    capabilities: ["write_calendar", "invite"],
  },
  {
    id: "webhook.call",
    name: "webhook.call",
    system: "Webhook",
    description: "Send an HTTP POST to any external webhook endpoint.",
    requiresAuth: false,
    riskLevel: "medium",
    irreversible: false,
    capabilities: ["http_post", "external_call"],
  },
];

export const PROMPT_EXAMPLES: WorkflowPromptExample[] = [
  {
    id: "email-triage",
    label: "Morning email triage",
    prompt:
      "Every morning, read urgent customer emails, notify Slack, and draft replies.",
    tags: ["gmail", "slack", "scheduled"],
  },
  {
    id: "billing-issue-routing",
    label: "Billing issue routing",
    prompt:
      "When a GitHub issue mentions billing, create a CRM task and notify support.",
    tags: ["github", "crm", "slack", "event-driven"],
  },
  {
    id: "notion-meeting-notes",
    label: "Meeting notes to action items",
    prompt:
      "Summarize new Notion meeting notes and add action items to Google Sheets.",
    tags: ["notion", "sheets", "scheduled"],
  },
  {
    id: "stripe-refund-gate",
    label: "Stripe refund approval gate",
    prompt:
      "If a Stripe refund request arrives, create a review task before any refund action.",
    tags: ["stripe", "crm", "approval", "event-driven"],
  },
];

function toolById(id: string): McpToolDefinition {
  const t = MCP_TOOLS.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown tool: ${id}`);
  return t;
}

const PLANS: Record<string, Omit<WorkflowPlan, "id" | "generatedAt">> = {
  "email-triage": {
    prompt: PROMPT_EXAMPLES[0].prompt,
    intent: {
      goal: "Triage urgent customer emails every morning and prepare team for the day.",
      trigger: "Scheduled — every weekday at 08:00",
      entities: ["customer emails", "Slack channel", "email drafts"],
      requiredSystems: ["Gmail", "Slack"],
      approvalSensitiveActions: ["send email reply (draft mode only)"],
    },
    detectedTools: [
      toolById("gmail.search"),
      toolById("slack.send_message"),
      toolById("gmail.create_draft"),
    ],
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        tool: "gmail.search",
        description: "Search inbox for urgent emails",
        inputSummary: 'query: "is:unread label:urgent newer_than:1d"',
        condition: null,
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Skip if Gmail is unreachable; retry at next scheduled run.",
      },
      {
        id: "step-2",
        stepNumber: 2,
        tool: "slack.send_message",
        description: "Notify #support with email count and subjects",
        inputSummary: "channel: #support, message: summary of urgent emails",
        condition: "if step-1 returns > 0 emails",
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Log to Workflow Reports if Slack is unavailable.",
      },
      {
        id: "step-3",
        stepNumber: 3,
        tool: "gmail.create_draft",
        description: "Create draft replies for each urgent email",
        inputSummary: "template: acknowledgement + ETA, one draft per email",
        condition: "for each email in step-1",
        approvalRequired: true,
        riskLevel: "medium",
        fallback: "Skip draft creation; log unsent count to Workflow Reports.",
      },
    ],
    risk: {
      level: "medium",
      reasons: [
        "Draft creation requires human review before sending.",
        "Gmail OAuth token must remain valid.",
      ],
      requiresApproval: true,
      irreversibleSteps: [],
      missingTools: [],
      excludedUnsafeTools: [],
    },
  },

  "billing-issue-routing": {
    prompt: PROMPT_EXAMPLES[1].prompt,
    intent: {
      goal: "Automatically route billing-related GitHub issues to CRM and alert the support team.",
      trigger: 'Event-driven — GitHub issue opened or labelled "billing"',
      entities: ["GitHub issues", "CRM task", "support channel"],
      requiredSystems: ["GitHub", "CRM", "Slack"],
      approvalSensitiveActions: [],
    },
    detectedTools: [
      toolById("github.search_issues"),
      toolById("crm.create_task"),
      toolById("slack.send_message"),
    ],
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        tool: "github.search_issues",
        description: "Search for newly opened issues containing billing keywords",
        inputSummary: 'query: "billing OR refund OR payment is:open created:>now-1h"',
        condition: null,
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Retry after 5 minutes if GitHub API is unavailable.",
      },
      {
        id: "step-2",
        stepNumber: 2,
        tool: "crm.create_task",
        description: "Create a CRM support task for each matched issue",
        inputSummary:
          "title: GitHub issue title, link: issue URL, priority: high",
        condition: "for each issue in step-1",
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Log failed task creation to Workflow Reports.",
      },
      {
        id: "step-3",
        stepNumber: 3,
        tool: "slack.send_message",
        description: "Notify #billing-support with issue details and CRM link",
        inputSummary: "channel: #billing-support, message: issue + crm task link",
        condition: "after step-2 succeeds",
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Skip Slack notification; CRM task still created.",
      },
    ],
    risk: {
      level: "low",
      reasons: ["All actions are read + write-to-internal-systems only."],
      requiresApproval: false,
      irreversibleSteps: [],
      missingTools: [],
      excludedUnsafeTools: [],
    },
  },

  "notion-meeting-notes": {
    prompt: PROMPT_EXAMPLES[2].prompt,
    intent: {
      goal: "Extract action items from Notion meeting notes and log them to Google Sheets.",
      trigger: "Scheduled — daily at 17:00 or on-demand",
      entities: ["Notion pages", "action items", "Google Sheet rows"],
      requiredSystems: ["Notion", "Google Sheets"],
      approvalSensitiveActions: [],
    },
    detectedTools: [
      toolById("notion.search_pages"),
      toolById("sheets.append_row"),
    ],
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        tool: "notion.search_pages",
        description: "Find meeting note pages updated today",
        inputSummary: 'filter: last_edited_time >= today, title contains "meeting"',
        condition: null,
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Skip run if no Notion pages found today.",
      },
      {
        id: "step-2",
        stepNumber: 2,
        tool: "sheets.append_row",
        description: "Append extracted action items to the tracker sheet",
        inputSummary:
          "spreadsheet: Action Items Tracker, columns: date, owner, task, source page",
        condition: "for each action item extracted from step-1 pages",
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Buffer failed rows; retry on next scheduled run.",
      },
    ],
    risk: {
      level: "low",
      reasons: ["Read-only from Notion; append-only to Sheets."],
      requiresApproval: false,
      irreversibleSteps: [],
      missingTools: [],
      excludedUnsafeTools: [],
    },
  },

  "stripe-refund-gate": {
    prompt: PROMPT_EXAMPLES[3].prompt,
    intent: {
      goal: "Enforce a mandatory human review step before any Stripe refund is processed.",
      trigger: "Event-driven — Stripe webhook: charge.dispute.created or refund.request",
      entities: ["Stripe refund request", "review task", "approval decision"],
      requiredSystems: ["Stripe", "CRM"],
      approvalSensitiveActions: [
        "stripe.create_refund_review — irreversible financial action",
      ],
    },
    detectedTools: [
      toolById("crm.create_task"),
      toolById("stripe.create_refund_review"),
    ],
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        tool: "crm.create_task",
        description: "Create a review task in CRM with refund details",
        inputSummary:
          "title: Refund Review Required, amount: from webhook payload, customer: from payload",
        condition: null,
        approvalRequired: false,
        riskLevel: "low",
        fallback: "Alert via webhook.call if CRM is unavailable.",
      },
      {
        id: "step-2",
        stepNumber: 2,
        tool: "stripe.create_refund_review",
        description: "Process the refund only after manual approval is recorded",
        inputSummary: "refund_id: from webhook, approved_by: reviewer from CRM task",
        condition: "only if step-1 task status = approved",
        approvalRequired: true,
        riskLevel: "high",
        fallback: "Block refund and escalate to billing team if approval times out.",
      },
    ],
    risk: {
      level: "high",
      reasons: [
        "Refund processing is irreversible.",
        "Financial data requires strict approval gating.",
        "Stripe webhook must be HMAC-verified before processing.",
      ],
      requiresApproval: true,
      irreversibleSteps: ["step-2 (stripe.create_refund_review)"],
      missingTools: [],
      excludedUnsafeTools: [],
    },
  },
};

function genericPlan(prompt: string): Omit<WorkflowPlan, "id" | "generatedAt"> {
  return {
    prompt,
    intent: {
      goal: "Automate a multi-step task described in plain English.",
      trigger: "Manual trigger or schedule (to be configured)",
      entities: ["input data", "output data"],
      requiredSystems: ["webhook.call"],
      approvalSensitiveActions: [],
    },
    detectedTools: [toolById("webhook.call")],
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        tool: "webhook.call",
        description: "Trigger workflow via webhook and pass context",
        inputSummary: "payload: { prompt, timestamp, context }",
        condition: null,
        approvalRequired: false,
        riskLevel: "medium",
        fallback: "Log failure to Workflow Reports.",
      },
    ],
    risk: {
      level: "medium",
      reasons: [
        "Custom prompt detected — connect your MCP tools to generate a precise plan.",
      ],
      requiresApproval: false,
      irreversibleSteps: [],
      missingTools: ["Connect sources to auto-detect required tools"],
      excludedUnsafeTools: [],
    },
  };
}

let _seq = 0;
function nextId(): string {
  return `wf-${Date.now()}-${++_seq}`;
}

export function generateWorkflowPlan(promptOrId: string): WorkflowPlan {
  const example = PROMPT_EXAMPLES.find(
    (e) => e.id === promptOrId || e.prompt === promptOrId
  );

  const planTemplate = example
    ? PLANS[example.id]
    : genericPlan(promptOrId);

  return {
    ...planTemplate,
    id: nextId(),
    generatedAt: new Date().toISOString(),
  };
}

export function buildWorkflowExport(plan: WorkflowPlan): WorkflowExport {
  const workflowJson = JSON.stringify(
    {
      id: plan.id,
      prompt: plan.prompt,
      generatedAt: plan.generatedAt,
      intent: plan.intent,
      steps: plan.steps.map((s) => ({
        id: s.id,
        tool: s.tool,
        description: s.description,
        inputSummary: s.inputSummary,
        condition: s.condition,
        approvalRequired: s.approvalRequired,
        riskLevel: s.riskLevel,
        fallback: s.fallback,
      })),
      risk: plan.risk,
    },
    null,
    2
  );

  const stepLines = plan.steps
    .map(
      (s) =>
        `  ${s.stepNumber}. [${s.tool}] ${s.description}${s.approvalRequired ? " ⚠ requires approval" : ""}`
    )
    .join("\n");

  const claudePrompt = `You are building an MCP-powered workflow.

Goal: ${plan.intent.goal}
Trigger: ${plan.intent.trigger}

Required tools: ${plan.detectedTools.map((t) => t.name).join(", ")}

Steps:
${stepLines}

Risk level: ${plan.risk.level.toUpperCase()}
${plan.risk.requiresApproval ? "⚠ This workflow requires human approval before sensitive steps." : ""}

Generate the workflow execution logic. Each step should call the named MCP tool with the described inputs.`;

  return { workflowJson, claudePrompt };
}

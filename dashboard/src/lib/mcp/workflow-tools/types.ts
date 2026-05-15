export type DiscoveredTool = {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
};

export type DiscoverToolsInput = {
  mcpConfig?: Record<string, unknown> | null;
  tools?: unknown[] | null;
};

export type DiscoverToolsOutput = {
  tools: DiscoveredTool[];
  missingLiveConnection: boolean;
  notes: string[];
};

export type WorkflowStepMcp = {
  id: string;
  tool: string;
  purpose: string;
  condition: string | null;
  approvalRequired: boolean;
  risk: "low" | "medium" | "high";
};

export type WorkflowMcp = {
  steps: WorkflowStepMcp[];
};

export type CreateWorkflowInput = {
  prompt: string;
  availableTools?: unknown[];
  mode?: "plan_only" | string;
};

export type CreateWorkflowOutput = {
  goal: string;
  intent: {
    trigger: string;
    systems: string[];
    entities: string[];
    approvalSensitiveActions: string[];
  };
  workflow: WorkflowMcp;
  safety: {
    approvalPoints: string[];
    blockedActions: string[];
    missingTools: string[];
  };
  export: {
    format: "torqa.workflow.v1";
    json: Record<string, unknown>;
  };
};

export type ValidateWorkflowInput = {
  workflow: { steps?: WorkflowStepMcp[] };
};

export type ValidateWorkflowOutput = {
  valid: boolean;
  warnings: string[];
  errors: string[];
  approvalRequired: string[];
};

export type ExportWorkflowInput = {
  workflow: Record<string, unknown>;
  format: "json" | "claude_prompt";
};

export type ExportWorkflowOutput = {
  content: string;
  mimeType: string;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  exampleId?: string;
  tags: string[];
};

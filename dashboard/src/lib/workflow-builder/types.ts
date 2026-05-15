export type McpToolDefinition = {
  id: string;
  name: string;
  system: string;
  description: string;
  requiresAuth: boolean;
  riskLevel: "low" | "medium" | "high";
  irreversible: boolean;
  capabilities: string[];
};

export type WorkflowPromptExample = {
  id: string;
  label: string;
  prompt: string;
  tags: string[];
};

export type WorkflowIntent = {
  goal: string;
  trigger: string;
  entities: string[];
  requiredSystems: string[];
  approvalSensitiveActions: string[];
};

export type WorkflowStep = {
  id: string;
  stepNumber: number;
  tool: string;
  description: string;
  inputSummary: string;
  condition: string | null;
  approvalRequired: boolean;
  riskLevel: "low" | "medium" | "high";
  fallback: string;
};

export type WorkflowRisk = {
  level: "low" | "medium" | "high";
  reasons: string[];
  requiresApproval: boolean;
  irreversibleSteps: string[];
  missingTools: string[];
  excludedUnsafeTools: string[];
};

export type WorkflowPlan = {
  id: string;
  prompt: string;
  intent: WorkflowIntent;
  detectedTools: McpToolDefinition[];
  steps: WorkflowStep[];
  risk: WorkflowRisk;
  generatedAt: string;
};

export type WorkflowExport = {
  workflowJson: string;
  claudePrompt: string;
};

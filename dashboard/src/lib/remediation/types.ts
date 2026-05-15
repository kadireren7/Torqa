export type RemediationQuestion = {
  id: string;
  label: string;
  type: "boolean" | "text" | "multiselect" | "select";
  options?: string[];
  placeholder?: string;
  required: boolean;
};

export type RemediationAnswer = {
  questionId: string;
  value: string | boolean | string[];
};

export type RemediationSession = {
  id: string;
  findingId: string;
  ruleId: string;
  target: string;
  questions: RemediationQuestion[];
  answers: RemediationAnswer[];
  status: "in_progress" | "complete";
  createdAt: string;
};

export type RemediationIntent = {
  sessionId: string;
  ruleId: string;
  answers: RemediationAnswer[];
};

export type RemediationPlan = {
  findingId: string;
  ruleId: string;
  target: string;
  summary: string;
  recommendedChanges: string[];
  policyDraft: Record<string, unknown>;
  confidence: "low" | "medium" | "high";
  needsHumanReview: boolean;
  nextStep: "generate_patch_planned" | "manual_review" | "ready_for_policy_generation";
};

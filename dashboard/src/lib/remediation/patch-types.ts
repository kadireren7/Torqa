import type { ScanDecision, ScanFinding } from "@/lib/scan-engine";

export type JsonPatchOperation = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
  reason: string;
  sourceFindingId: string;
  ruleId: string;
  /** Current value at path before patch is applied — populated by the generator for display. */
  before?: unknown;
};

export type GeneratedPatch = {
  id: string;
  findingId: string;
  ruleId: string;
  target: string;
  createdAt: string;
  operations: JsonPatchOperation[];
  policyDraft: Record<string, unknown>;
  summary: string;
  warnings: string[];
  canPreview: boolean;
};

export type PatchPreviewResult = {
  beforeScore: number;
  afterScore: number;
  beforeDecision: ScanDecision;
  afterDecision: ScanDecision;
  /** rule_id::target keys of findings that disappeared after the patch. */
  resolvedFindingIds: string[];
  remainingFindings: ScanFinding[];
  newFindings: ScanFinding[];
  appliedConfig: unknown;
  warnings: string[];
};

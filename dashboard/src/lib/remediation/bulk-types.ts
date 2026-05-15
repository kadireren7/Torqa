import type { ScanFinding } from "@/lib/scan-engine";
import type { RemediationPlan } from "./types";
import type { GeneratedPatch, JsonPatchOperation, PatchPreviewResult } from "./patch-types";

export type BulkHardeningMode = "critical_only" | "critical_and_high" | "all_fixable";

export type SkippedFinding = {
  findingId: string;
  ruleId: string;
  target: string;
  reason: string;
};

export type OperationLabel =
  | "auto-applied safe default"
  | "needs manual refinement"
  | "cannot be safely auto-fixed";

export type BulkOperationGroup = {
  toolOrTarget: string;
  ruleId: string;
  operations: JsonPatchOperation[];
  label: OperationLabel;
  warnings: string[];
};

export type BulkHardeningRequest = {
  originalConfig: unknown;
  findings: ScanFinding[];
  mode: BulkHardeningMode;
  safeDefaults: boolean;
};

export type BulkHardeningResult = {
  id: string;
  createdAt: string;
  mode: BulkHardeningMode;
  selectedFindings: ScanFinding[];
  skippedFindings: SkippedFinding[];
  generatedPlans: RemediationPlan[];
  generatedPatches: GeneratedPatch[];
  combinedOperations: JsonPatchOperation[];
  operationGroups: BulkOperationGroup[];
  hardenedConfig: unknown;
  previewResult: PatchPreviewResult;
  warnings: string[];
  manualReviewRequired: string[];
};

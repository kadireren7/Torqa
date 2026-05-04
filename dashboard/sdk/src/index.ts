/**
 * @torqa/sdk — public entry point.
 *
 * Re-exports the typed client and shared wire types so consumers only need
 * one import:
 *
 *     import { TorqaClient, type ScanFinding } from "@torqa/sdk";
 */

export {
  TorqaClient,
  TorqaApiError,
  type AcceptRiskInput,
  type EvaluatePolicyInput,
  type ExportAuditInput,
  type ListDecisionsInput,
  type RequestMeta,
  type SimulateInput,
  type TorqaClientOptions,
} from "./client";

export type {
  AcceptedRiskRow,
  GovernanceDecision,
  GovernanceDecisionType,
  PolicyEvaluation,
  PolicyPackSummary,
  PolicyVerdict,
  PublicApiError,
  PublicApiResponse,
  PublicApiSuccess,
  RuleHit,
  ScanFinding,
  ScanSeverity,
  ScanSource,
  SimulationSummary,
} from "./types";

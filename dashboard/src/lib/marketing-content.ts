import type { ComponentType } from "react";
import { FileCheck2, Rocket, Shield, Share2, Users, Workflow } from "lucide-react";

export const githubUrl = "https://github.com/kadireren7/Torqa";

export const docsUrl = `${githubUrl}/tree/main/docs`;

export const socialProof = [
  { title: "MCP + AI agent security", value: "Tool manifests, prompts, permissions, secrets" },
  { title: "Deterministic scanning", value: "Rule-based, no black-box AI scoring" },
  { title: "Fix guidance included", value: "Ask → Fix → Patch → Verify" },
  { title: "Developer-first API", value: "HTTP, MCP, CI gate, webhook" },
];

export const featureItems: Array<{ title: string; copy: string; icon: ComponentType<{ className?: string }> }> = [
  {
    title: "Scan MCP server configs",
    copy: "Parse tool manifests and surface risky permissions, exposed secrets, and unsafe capabilities.",
    icon: Workflow,
  },
  {
    title: "Detect over-permissioned tools",
    copy: "Flags tools with write access where read would suffice, unconstrained exec, and missing scope limits.",
    icon: Shield,
  },
  {
    title: "Share scan reports",
    copy: "Create public links for non-sensitive snapshots with clear controls.",
    icon: Share2,
  },
  {
    title: "Team collaboration",
    copy: "Workspace scope, shared history, and invite-driven collaboration.",
    icon: Users,
  },
  {
    title: "API-first access",
    copy: "Use API keys with the public scan endpoint for CI gates and automation pipelines.",
    icon: Rocket,
  },
  {
    title: "Audit trail",
    copy: "Every scan, decision, and fix is recorded with full export support.",
    icon: FileCheck2,
  },
];

export const trustItems = [
  {
    title: "Deterministic engine",
    copy: "Same MCP config input always yields the same findings and risk score.",
  },
  {
    title: "No black-box scoring",
    copy: "Weighted deduction model is explicit, inspectable, and rule-traceable.",
  },
  {
    title: "Explainable findings",
    copy: "Each finding includes the rule ID, affected tool, and concrete remediation guidance.",
  },
  {
    title: "MCP-native analysis",
    copy: "Built to parse MCP tool manifests, agent definitions, and JSON-based configs.",
  },
];

export const useCases = [
  "Teams building MCP servers who need to catch risks before deployment",
  "AI agent developers who want to know which tools are over-permissioned",
  "Platform engineers who want a CI gate on agent config changes",
  "Security teams reviewing MCP manifests for secrets and unsafe capabilities",
  "Developers who want to verify fixes did not introduce new risks",
];

export const heroStats = [
  { label: "Scans analyzed", value: 2840, suffix: "+" },
  { label: "Findings surfaced", value: 128, suffix: "" },
  { label: "Deterministic", value: 100, suffix: "%" },
];

export const trustBadges = ["MCP-native", "Deterministic", "API-first", "Audit trail"];

export const demoFindings = [
  { label: "Tool has unrestricted filesystem write access", severity: "critical" as const },
  { label: "Hardcoded API key in tool env config", severity: "critical" as const },
  { label: "No input validation on shell exec tool", severity: "critical" as const },
  { label: "Tool scope broader than declared intent", severity: "review" as const },
];

/**
 * Source registry — single source of truth for supported scan adapters.
 *
 * Each entry exposes:
 *   * `id`        — canonical ScanSource value used everywhere downstream.
 *   * `label`     — human-readable name for UI dropdowns.
 *   * `detector`  — given parsed JSON, returns confidence in [0..1].
 *   * `analyzer`  — given parsed JSON, returns deterministic ScanFinding[].
 *   * `sample`    — optional URL to a static sample under `/scan-samples`.
 *   * `since`     — Torqa version that introduced the adapter.
 *
 * Auto-detection picks the adapter with the highest confidence (≥ 0.5);
 * the route layer falls back to "generic" when no detector is confident.
 */

import type { ScanFinding, ScanSource } from "@/lib/scan-engine";
import { analyzeMake, isLikelyMake } from "@/lib/scan/adapters/make";
import { analyzeZapier, isLikelyZapier } from "@/lib/scan/adapters/zapier";
import { analyzeLambda, isLikelyLambda } from "@/lib/scan/adapters/lambda";
import { analyzeMcp, isLikelyMcp } from "@/lib/scan/adapters/mcp";

export type SourceRegistryEntry = {
  id: ScanSource;
  label: string;
  /** Returns a confidence score in [0..1]. */
  detect: (content: unknown) => number;
  /** Deterministic analyzer (only used by registry consumers; the legacy
   *  scan-engine still owns n8n/generic/github/ai-agent for backwards-compat). */
  analyze: ((content: unknown) => ScanFinding[]) | null;
  sample: string | null;
  since: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function detectN8n(content: unknown): number {
  if (!isRecord(content)) return 0;
  const doc = isRecord(content.data) && Array.isArray((content.data as Record<string, unknown>).nodes)
    ? (content.data as Record<string, unknown>)
    : content;
  if (!Array.isArray(doc.nodes)) return 0;
  if (!isRecord(doc.connections)) return doc.nodes.length > 0 ? 0.6 : 0;
  return 0.95;
}

function detectGitHub(content: unknown): number {
  if (!isRecord(content)) return 0;
  if (isRecord(content.on) || typeof content.on === "string") {
    if (isRecord(content.jobs)) return 0.95;
  }
  if (Array.isArray(content.runs) && typeof content.name === "string" && isRecord(content.workflow)) {
    return 0.6;
  }
  return 0;
}

function detectAiAgent(content: unknown): number {
  if (!isRecord(content)) return 0;
  const hasAgentMarker =
    typeof content.agent === "string" ||
    isRecord(content.agent) ||
    typeof content.system_prompt === "string" ||
    typeof content.system === "string" ||
    Array.isArray(content.tools);
  if (!hasAgentMarker) return 0;
  if (Array.isArray(content.tools) || Array.isArray(content.functions)) return 0.9;
  return 0.6;
}

function detectMake(content: unknown): number {
  return isLikelyMake(content) ? 0.9 : 0;
}

function detectZapier(content: unknown): number {
  return isLikelyZapier(content) ? 0.9 : 0;
}

function detectLambda(content: unknown): number {
  return isLikelyLambda(content) ? 0.9 : 0;
}

function detectMcp(content: unknown): number {
  return isLikelyMcp(content) ? 0.95 : 0;
}

export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
  {
    id: "n8n",
    label: "n8n workflow export",
    detect: detectN8n,
    analyze: null,
    sample: "/scan-samples/minimal_n8n.json",
    since: "0.1.0",
  },
  {
    id: "github",
    label: "GitHub Actions workflow",
    detect: detectGitHub,
    analyze: null,
    sample: null,
    since: "0.1.0",
  },
  {
    id: "ai-agent",
    label: "AI Agent JSON",
    detect: detectAiAgent,
    analyze: null,
    sample: null,
    since: "0.1.0",
  },
  {
    id: "make",
    label: "Make.com scenario blueprint",
    detect: detectMake,
    analyze: analyzeMake,
    sample: "/scan-samples/make_scenario.json",
    since: "0.2.1",
  },
  {
    id: "zapier",
    label: "Zapier zap export",
    detect: detectZapier,
    analyze: analyzeZapier,
    sample: "/scan-samples/zapier_zap.json",
    since: "0.2.1",
  },
  {
    id: "lambda",
    label: "AWS Lambda configuration / SAM",
    detect: detectLambda,
    analyze: analyzeLambda,
    sample: "/scan-samples/lambda_function.json",
    since: "0.2.1",
  },
  {
    id: "mcp",
    label: "MCP server config / tool manifest",
    detect: detectMcp,
    analyze: analyzeMcp,
    sample: "/scan-samples/unsafe_mcp.json",
    since: "0.4.2",
  },
  {
    id: "generic",
    label: "Generic JSON (fallback)",
    detect: () => 0.05,
    analyze: null,
    sample: null,
    since: "0.1.0",
  },
];

export type DetectionResult = {
  source: ScanSource;
  confidence: number;
  candidates: { source: ScanSource; confidence: number }[];
};

const DEFAULT_THRESHOLD = 0.4;

/**
 * Auto-detect the most likely source for a parsed JSON payload.
 * Falls back to "generic" when no detector is confident enough.
 */
export function detectSource(
  content: unknown,
  options: { threshold?: number } = {}
): DetectionResult {
  const threshold = typeof options.threshold === "number" ? options.threshold : DEFAULT_THRESHOLD;
  const candidates: { source: ScanSource; confidence: number }[] = [];
  for (const entry of SOURCE_REGISTRY) {
    const confidence = clamp01(entry.detect(content));
    if (confidence > 0) candidates.push({ source: entry.id, confidence });
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const top = candidates[0];
  if (!top || top.confidence < threshold) {
    return { source: "generic", confidence: top?.confidence ?? 0, candidates };
  }
  return { source: top.source, confidence: top.confidence, candidates };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Get a registry entry by id, or null. */
export function getSourceEntry(id: ScanSource): SourceRegistryEntry | null {
  return SOURCE_REGISTRY.find((s) => s.id === id) ?? null;
}

/** Convenience list of canonical source ids (in registry order). */
export function listSourceIds(): ScanSource[] {
  return SOURCE_REGISTRY.map((s) => s.id);
}

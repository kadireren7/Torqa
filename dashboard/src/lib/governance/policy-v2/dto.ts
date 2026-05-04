/**
 * Shared DB ↔ JSON serialization helpers for policy_packs rows.
 * Kept in a separate module so API + UI can both import without bundle bloat.
 */

import type { ScanSource } from "@/lib/scan-engine";
import type { PolicyPack, PolicyPackInput, PolicyVerdict } from "@/lib/governance/policy-v2/types";

export function rowToPolicyPackDto(row: Record<string, unknown>): PolicyPack {
  return {
    id: String(row.id ?? ""),
    organizationId: typeof row.organization_id === "string" ? row.organization_id : null,
    userId: typeof row.user_id === "string" ? row.user_id : "",
    name: typeof row.name === "string" ? row.name : "",
    slug: typeof row.slug === "string" ? row.slug : "",
    description: typeof row.description === "string" ? row.description : null,
    level: row.level === "source" ? "source" : "workspace",
    sourceType:
      typeof row.source_type === "string" && row.source_type
        ? (row.source_type as ScanSource)
        : null,
    parentPackId: typeof row.parent_pack_id === "string" ? row.parent_pack_id : null,
    parentTemplateSlug:
      typeof row.parent_template_slug === "string" ? row.parent_template_slug : null,
    defaultVerdict:
      row.default_verdict === "block"
        ? "block"
        : row.default_verdict === "review"
          ? "review"
          : "pass",
    rules: Array.isArray(row.rules) ? (row.rules as PolicyPack["rules"]) : [],
    enabled: row.enabled !== false,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$|^[a-z0-9]$/;

export function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pack";
}

export function isReasonableSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export const VALID_VERDICTS_FOR_DTO: PolicyVerdict[] = ["pass", "review", "block"];

export type SanitizedInput = Omit<PolicyPackInput, "slug"> & {
  name: string;
  slug: string;
  description: string | null;
  defaultVerdict: PolicyVerdict;
  enabled: boolean;
  rules: PolicyPack["rules"];
};

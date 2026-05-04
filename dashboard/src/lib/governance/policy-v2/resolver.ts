/**
 * Policy Pack v2 — inheritance resolver.
 *
 * Walks a pack's parent chain and produces an effective rule list ready for
 * the evaluator. Inheritance order (parent first, child last):
 *
 *     parent_template_slug  (legacy thresholds → derived rules)
 *       ↓
 *     parent_pack_id chain  (depth-limited, cycle-detected)
 *       ↓
 *     this pack's rules
 *       ↓
 *     run override          (rules passed at /api/scan time, optional)
 *
 * Children replace earlier rules with the same `id` (last-write-wins). The
 * combined `default_verdict` is the strongest among all packs in the chain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanSource } from "@/lib/scan-engine";
import { strongerVerdict, type PolicyPack, type PolicyRule, type PolicyVerdict } from "@/lib/governance/policy-v2/types";
import { validatePolicyRules } from "@/lib/governance/policy-v2/validate";
import {
  BUILT_IN_POLICY_TEMPLATES,
  getBuiltInTemplateBySlug,
} from "@/lib/built-in-policy-templates";
import type { PolicyThresholdConfig } from "@/lib/policy-types";

export type ResolvedPolicyPack = {
  packId: string | null;
  name: string;
  defaultVerdict: PolicyVerdict;
  rules: PolicyRule[];
  /** Slug of the deepest parent template (legacy threshold), if any. */
  templateSlug: string | null;
  /** Parent template config when applicable — surfaced for the legacy threshold gate. */
  templateConfig: PolicyThresholdConfig | null;
};

const MAX_PARENT_DEPTH = 5;

function rowToPack(row: Record<string, unknown>): PolicyPack | null {
  if (!row || typeof row !== "object") return null;
  const id = typeof row.id === "string" ? row.id : null;
  const name = typeof row.name === "string" ? row.name : null;
  const slug = typeof row.slug === "string" ? row.slug : null;
  if (!id || !name || !slug) return null;
  const rules = Array.isArray(row.rules) ? row.rules : [];
  const cleaned = validatePolicyRules(rules);
  return {
    id,
    organizationId: typeof row.organization_id === "string" ? row.organization_id : null,
    userId: typeof row.user_id === "string" ? row.user_id : "",
    name,
    slug,
    description: typeof row.description === "string" ? row.description : null,
    level: row.level === "source" ? "source" : "workspace",
    sourceType: typeof row.source_type === "string" ? (row.source_type as ScanSource) : null,
    parentPackId: typeof row.parent_pack_id === "string" ? row.parent_pack_id : null,
    parentTemplateSlug: typeof row.parent_template_slug === "string" ? row.parent_template_slug : null,
    defaultVerdict:
      row.default_verdict === "block"
        ? "block"
        : row.default_verdict === "review"
          ? "review"
          : "pass",
    rules: cleaned.ok ? cleaned.rules : [],
    enabled: row.enabled !== false,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

/**
 * Map a legacy threshold template into v2 rules so packs can inherit them
 * cleanly. Each non-trivial threshold becomes one rule. Mapping is best-effort
 * and intentionally conservative.
 */
function thresholdToRules(slug: string, cfg: PolicyThresholdConfig): PolicyRule[] {
  const out: PolicyRule[] = [];
  out.push({
    id: `template:${slug}:trust-floor`,
    name: `Block when trust score < ${cfg.minimumTrustScore}`,
    scope: "scan",
    when: { field: "risk_score", op: "lt", value: cfg.minimumTrustScore },
    then: "block",
    message: `Trust score below the policy minimum (${cfg.minimumTrustScore}).`,
    enabled: true,
  });
  if (cfg.failOnCritical) {
    out.push({
      id: `template:${slug}:no-critical`,
      name: "Block any critical finding",
      scope: "finding",
      when: { field: "severity", op: "in", value: ["critical", "high"] },
      then: "block",
      message: "Critical/high finding present.",
      enabled: true,
    });
  }
  if (cfg.requireNoPlaintextSecrets) {
    out.push({
      id: `template:${slug}:no-plaintext-secrets`,
      name: "Block plaintext secrets",
      scope: "finding",
      when: { field: "rule_id", op: "eq", value: "v1.secret.plaintext_detected" },
      then: "block",
      message: "Plaintext secret detected.",
      enabled: true,
    });
  }
  if (cfg.requireWebhookAuth) {
    out.push({
      id: `template:${slug}:webhook-auth`,
      name: "Require explicit webhook auth",
      scope: "finding",
      when: {
        field: "rule_id",
        op: "in",
        value: ["v1.webhook.public_no_auth", "v1.webhook.auth_not_explicit"],
      },
      then: "block",
      message: "Webhook lacks explicit authentication.",
      enabled: true,
    });
  }
  if (cfg.blockTlsBypass) {
    out.push({
      id: `template:${slug}:tls`,
      name: "Block TLS bypass / plaintext transport",
      scope: "finding",
      when: {
        field: "rule_id",
        op: "in",
        value: [
          "v1.http.tls_verification_disabled",
          "v1.http.plaintext_transport",
          "v1.generic.http_plaintext_url",
        ],
      },
      then: "block",
      message: "Insecure transport detected.",
      enabled: true,
    });
  }
  if (cfg.requireErrorHandling) {
    out.push({
      id: `template:${slug}:error-handling`,
      name: "Require error handling",
      scope: "finding",
      when: {
        field: "rule_id",
        op: "in",
        value: ["v1.http.missing_error_handling", "v1.flow.error_strategy_missing"],
      },
      then: "review",
      message: "Workflow missing explicit error handling.",
      enabled: true,
    });
  }
  if (cfg.maxReviewFindings >= 0) {
    out.push({
      id: `template:${slug}:review-cap`,
      name: `Cap review findings at ${cfg.maxReviewFindings}`,
      scope: "scan",
      when: { field: "review_count", op: "gt", value: cfg.maxReviewFindings },
      then: cfg.reviewOverflowMode === "fail" ? "block" : "review",
      message: `Review-tier findings exceed the cap (${cfg.maxReviewFindings}).`,
      enabled: true,
    });
  }
  return out;
}

async function loadPackById(
  supabase: SupabaseClient,
  id: string
): Promise<PolicyPack | null> {
  const { data } = await supabase
    .from("policy_packs")
    .select(
      "id, user_id, organization_id, name, slug, description, level, source_type, parent_pack_id, parent_template_slug, default_verdict, rules, enabled, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return rowToPack(data as Record<string, unknown>);
}

async function loadTemplateConfig(
  supabase: SupabaseClient | null,
  slug: string
): Promise<PolicyThresholdConfig | null> {
  const built = getBuiltInTemplateBySlug(slug);
  if (built) return { ...built.config };
  if (!supabase) return null;
  const { data } = await supabase
    .from("policy_templates")
    .select("config")
    .eq("slug", slug)
    .maybeSingle();
  if (!data?.config || typeof data.config !== "object" || Array.isArray(data.config)) return null;
  return data.config as PolicyThresholdConfig;
}

function mergeRules(parent: PolicyRule[], child: PolicyRule[]): PolicyRule[] {
  // Remove any parent rule whose id is overridden by a child.
  const childIds = new Set(child.map((r) => r.id));
  const filteredParent = parent.filter((r) => !childIds.has(r.id));
  return [...filteredParent, ...child];
}

export async function resolvePolicyPack(
  supabase: SupabaseClient | null,
  packId: string,
  runOverrideRules?: PolicyRule[] | null
): Promise<ResolvedPolicyPack | null> {
  if (!supabase) return null;

  const seen = new Set<string>();
  const chain: PolicyPack[] = [];
  let nextId: string | null = packId;
  let depth = 0;
  while (nextId && depth < MAX_PARENT_DEPTH) {
    if (seen.has(nextId)) break; // cycle guard
    seen.add(nextId);
    const pack: PolicyPack | null = await loadPackById(supabase, nextId);
    if (!pack) break;
    chain.push(pack);
    nextId = pack.parentPackId;
    depth += 1;
  }
  if (chain.length === 0) return null;

  // Walk parent → child (reverse the chain).
  const ordered = chain.slice().reverse();
  const root = ordered[0];

  let templateSlug: string | null = null;
  let templateConfig: PolicyThresholdConfig | null = null;
  let mergedRules: PolicyRule[] = [];
  let combinedDefault: PolicyVerdict = "pass";

  if (root.parentTemplateSlug) {
    const tplCfg = await loadTemplateConfig(supabase, root.parentTemplateSlug);
    if (tplCfg) {
      templateSlug = root.parentTemplateSlug;
      templateConfig = tplCfg;
      mergedRules = thresholdToRules(root.parentTemplateSlug, tplCfg);
    }
  }

  for (const pack of ordered) {
    mergedRules = mergeRules(mergedRules, pack.rules);
    combinedDefault = strongerVerdict(combinedDefault, pack.defaultVerdict);
  }

  if (runOverrideRules && runOverrideRules.length > 0) {
    mergedRules = mergeRules(mergedRules, runOverrideRules);
  }

  // The "effective" pack is identified by the leaf (the actual selected pack).
  const leaf = chain[0];
  return {
    packId: leaf.id,
    name: leaf.name,
    defaultVerdict: combinedDefault,
    rules: mergedRules,
    templateSlug,
    templateConfig,
  };
}

/** Resolve a v2 pack from raw rules (ad-hoc / run override only). */
export function resolveAdHocPack(
  rules: PolicyRule[],
  defaultVerdict: PolicyVerdict
): ResolvedPolicyPack {
  return {
    packId: null,
    name: "Ad-hoc rules",
    defaultVerdict,
    rules,
    templateSlug: null,
    templateConfig: null,
  };
}

/** Convenience: list of built-in template slugs available as parent for editor UI. */
export function listBuiltInTemplateSlugs(): string[] {
  return BUILT_IN_POLICY_TEMPLATES.map((t) => t.slug);
}

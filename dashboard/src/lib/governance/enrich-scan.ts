/**
 * Enrich a successful /api/scan response with v0.2.1 governance metadata:
 *  - finding signature
 *  - structured fix proposal (Fix Engine)
 *  - accepted_risk marker (filtered pre-gate)
 *  - governance_mode + scope
 *
 * Pure server-side. Does not mutate the input.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanApiSuccess, ScanFinding, ScanSource } from "@/lib/scan-engine";
import { decisionFrom, riskScoreFromFindings } from "@/lib/scan-engine";
import { buildFindingSignatureForScan } from "@/lib/governance/finding-signature";
import { buildFixProposalForFinding } from "@/lib/governance/fix-engine";
import {
  asGovernanceModeView,
  resolveGovernanceScope,
  type GovernanceScope,
} from "@/lib/governance/scope";
import type { AcceptedRiskMarker } from "@/lib/governance/types";

type AcceptedRiskRow = {
  id: string;
  finding_signature: string;
  rationale: string;
  accepted_at: string;
  expires_at: string | null;
};

async function loadAcceptedRiskMap(
  supabase: SupabaseClient | null,
  scope: GovernanceScope,
  signatures: string[]
): Promise<Map<string, AcceptedRiskMarker>> {
  const out = new Map<string, AcceptedRiskMarker>();
  if (!supabase || !scope.userId || signatures.length === 0) return out;

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("accepted_risks")
    .select("id, finding_signature, rationale, accepted_at, expires_at, organization_id, revoked_at")
    .is("revoked_at", null)
    .in("finding_signature", signatures);

  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  } else {
    query = query.is("organization_id", null).eq("user_id", scope.userId);
  }

  const { data } = await query;
  if (!Array.isArray(data)) return out;

  for (const row of data as AcceptedRiskRow[]) {
    if (row.expires_at && row.expires_at < nowIso) continue;
    if (out.has(row.finding_signature)) continue;
    out.set(row.finding_signature, {
      id: row.id,
      acceptedAt: row.accepted_at,
      expiresAt: row.expires_at,
      rationale: row.rationale,
    });
  }
  return out;
}

export type EnrichedScan = {
  payload: ScanApiSuccess;
  scope: GovernanceScope;
};

export async function enrichScanWithGovernance(
  payload: ScanApiSuccess,
  source: ScanSource,
  rawContent: unknown,
  supabase: SupabaseClient | null
): Promise<EnrichedScan> {
  const scope = await resolveGovernanceScope(supabase);

  // 1. Compute signatures + fix proposals deterministically.
  const enriched: ScanFinding[] = payload.findings.map((f) => {
    const signature = buildFindingSignatureForScan(f, source);
    return {
      ...f,
      signature,
      fix: buildFixProposalForFinding({ ...f, signature }, source, rawContent),
      accepted_risk: null,
    };
  });

  // 2. Load active accepted-risk rows for these signatures.
  const signatures = enriched.map((f) => f.signature!).filter(Boolean) as string[];
  const acceptedMap = await loadAcceptedRiskMap(supabase, scope, signatures);

  let acceptedRiskCount = 0;
  const annotated: ScanFinding[] = enriched.map((f) => {
    const marker = f.signature ? acceptedMap.get(f.signature) ?? null : null;
    if (marker) acceptedRiskCount += 1;
    return { ...f, accepted_risk: marker };
  });

  // 3. Re-evaluate gate decision *excluding* accepted-risk findings so the
  //    posture isn't stuck on intentionally-ignored issues.
  const activeFindings = annotated.filter((f) => !f.accepted_risk);
  const recomputedRisk = riskScoreFromFindings(activeFindings);
  const recomputedDecision = decisionFrom(activeFindings);

  // Policy evaluation, if present, should also reflect the active findings.
  // We keep the original `policyEvaluation` shape (it was computed against
  // the unfiltered findings) — the dashboard surfaces both with a clear note.
  const next: ScanApiSuccess = {
    ...payload,
    findings: annotated,
    riskScore: recomputedRisk,
    status: recomputedDecision,
    governance: asGovernanceModeView(scope),
    acceptedRiskCount,
  };

  return { payload: next, scope };
}

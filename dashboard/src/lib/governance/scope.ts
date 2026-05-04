/**
 * Resolve the active governance mode + actor permissions for the current request.
 *
 * Cloud mode (Supabase configured + signed-in user):
 *   - Active organization → reads `organizations.governance_mode`.
 *   - Personal scope → returns DEFAULT_GOVERNANCE_MODE; mode is read-only.
 *
 * Local/offline mode (no Supabase):
 *   - Returns DEFAULT_GOVERNANCE_MODE with `canChange: false`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveScopedOrganizationId } from "@/lib/workspace-scope";
import {
  DEFAULT_GOVERNANCE_MODE,
  isGovernanceMode,
  type GovernanceMode,
  type GovernanceModeView,
} from "@/lib/governance/types";

export type GovernanceScope = {
  userId: string | null;
  organizationId: string | null;
  mode: GovernanceMode;
  /** True when actor is org owner/admin (or always for personal scope). */
  isAdmin: boolean;
};

/** Resolve role for a user inside an organization. */
async function resolveOrgRole(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<"owner" | "admin" | "member" | "viewer" | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || typeof data.role !== "string") return null;
  if (data.role === "owner" || data.role === "admin" || data.role === "member" || data.role === "viewer") {
    return data.role;
  }
  return null;
}

export async function resolveGovernanceScope(
  supabase: SupabaseClient | null
): Promise<GovernanceScope> {
  if (!supabase) {
    return {
      userId: null,
      organizationId: null,
      mode: DEFAULT_GOVERNANCE_MODE,
      isAdmin: true,
    };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      userId: null,
      organizationId: null,
      mode: DEFAULT_GOVERNANCE_MODE,
      isAdmin: false,
    };
  }

  const organizationId = await resolveScopedOrganizationId(supabase, user.id);
  if (!organizationId) {
    return {
      userId: user.id,
      organizationId: null,
      mode: DEFAULT_GOVERNANCE_MODE,
      isAdmin: true,
    };
  }

  const [{ data: orgRow }, role] = await Promise.all([
    supabase
      .from("organizations")
      .select("governance_mode")
      .eq("id", organizationId)
      .maybeSingle(),
    resolveOrgRole(supabase, organizationId, user.id),
  ]);

  const raw = orgRow && typeof orgRow.governance_mode === "string" ? orgRow.governance_mode : null;
  const mode: GovernanceMode = isGovernanceMode(raw) ? raw : DEFAULT_GOVERNANCE_MODE;

  return {
    userId: user.id,
    organizationId,
    mode,
    isAdmin: role === "owner" || role === "admin",
  };
}

export function asGovernanceModeView(scope: GovernanceScope): GovernanceModeView {
  return {
    mode: scope.mode,
    scope: scope.organizationId ? "org" : "personal",
    canChange: scope.organizationId ? scope.isAdmin : false,
    organizationId: scope.organizationId,
  };
}

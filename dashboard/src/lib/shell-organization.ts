import type { Organization } from "@/data/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/workspace-scope";

const FALLBACK: Organization = {
  id: "local",
  name: "Torqa",
  slug: "torqa",
};

/**
 * Label for the app chrome (sidebar + header): active workspace name when cloud + cookie + membership,
 * otherwise "Personal" when signed in without an active org, or "Torqa" when offline / anonymous.
 */
export async function getShellOrganization(): Promise<Organization> {
  const supabase = await createClient();
  if (!supabase) return FALLBACK;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return FALLBACK;

  const activeOrgId = await getActiveOrganizationId();
  if (!activeOrgId) {
    return { id: "personal", name: "Personal", slug: "personal" };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", activeOrgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { id: "personal", name: "Personal", slug: "personal" };
  }

  const { data: row, error } = await supabase
    .from("organizations")
    .select("id,name,slug")
    .eq("id", activeOrgId)
    .maybeSingle();

  if (error || !row || typeof row.name !== "string" || typeof row.slug !== "string") {
    return { id: activeOrgId, name: "Workspace", slug: "workspace" };
  }

  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
  };
}

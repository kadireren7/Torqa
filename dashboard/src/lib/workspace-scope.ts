import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE, isUuid } from "@/lib/workspace-cookie";

/** Active workspace id from cookie, or null (personal scope). */
export async function getActiveOrganizationId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(ACTIVE_ORG_COOKIE)?.value;
  if (!raw || !isUuid(raw)) return null;
  return raw;
}

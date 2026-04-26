/** HttpOnly cookie set by POST /api/workspaces/active — scopes scans/templates/history to one org. */
export const ACTIVE_ORG_COOKIE = "torqa_active_org";

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

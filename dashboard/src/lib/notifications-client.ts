/** Client-side helpers for in-app notifications (shared by bell + notifications page). */

export type InAppNotificationSeverity = "info" | "warning" | "critical";

export type InAppNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  severity: InAppNotificationSeverity;
  read_at: string | null;
  created_at: string;
};

export function normalizeNotificationSeverity(raw: string): InAppNotificationSeverity {
  if (raw === "warning" || raw === "critical" || raw === "info") return raw;
  return "info";
}

export async function fetchInAppNotifications(limit: number): Promise<
  | { ok: true; notifications: InAppNotificationRow[]; unreadCount: number }
  | { ok: false; notifications: []; unreadCount: 0; error: string; status: number }
> {
  const res = await fetch(`/api/notifications?limit=${limit}`, { credentials: "include" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  const j = body as { notifications?: unknown[]; unreadCount?: unknown; error?: string };
  if (!res.ok) {
    return {
      ok: false,
      notifications: [],
      unreadCount: 0,
      error: typeof j.error === "string" ? j.error : `Could not load (${res.status})`,
      status: res.status,
    };
  }
  const rawList = Array.isArray(j.notifications) ? j.notifications : [];
  const notifications: InAppNotificationRow[] = rawList
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      body: row.body === null || typeof row.body === "string" ? (row.body as string | null) : null,
      severity: normalizeNotificationSeverity(String(row.severity ?? "info")),
      read_at: row.read_at === null || typeof row.read_at === "string" ? (row.read_at as string | null) : null,
      created_at: String(row.created_at ?? ""),
    }))
    .filter((row) => row.id.length > 0);

  const unreadCount =
    typeof j.unreadCount === "number" && Number.isFinite(j.unreadCount) ? Math.max(0, Math.floor(j.unreadCount)) : 0;

  return { ok: true, notifications, unreadCount };
}

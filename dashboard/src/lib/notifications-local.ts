/**
 * Browser-only notifications when Supabase is not configured.
 */

import type { ScanApiSuccess } from "@/lib/scan-engine";
import {
  buildScanNotificationPayloads,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefsShape,
} from "@/lib/scan-notification-rules";

const NOTIF_KEY = "torqa_in_app_notifications_v1";
const PREFS_KEY = "torqa_notification_prefs_v1";
const MAX_ITEMS = 80;

export type LocalNotification = {
  id: string;
  title: string;
  body: string | null;
  severity: "info" | "warning" | "critical";
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

function readNotifs(): LocalNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x === "object") as LocalNotification[];
  } catch {
    return [];
  }
}

function writeNotifs(items: LocalNotification[]) {
  window.localStorage.setItem(NOTIF_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function readLocalNotificationPrefs(): NotificationPrefsShape {
  if (typeof window === "undefined") return { ...DEFAULT_NOTIFICATION_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      emailAlerts: Boolean(o.emailAlerts),
      slackWebhookUrl: typeof o.slackWebhookUrl === "string" && o.slackWebhookUrl.trim() ? o.slackWebhookUrl : null,
      alertOnFail: o.alertOnFail !== false,
      alertOnHighRisk: o.alertOnHighRisk !== false,
      highRiskThreshold:
        typeof o.highRiskThreshold === "number" && Number.isFinite(o.highRiskThreshold)
          ? Math.max(0, Math.min(100, Math.round(o.highRiskThreshold)))
          : DEFAULT_NOTIFICATION_PREFS.highRiskThreshold,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export function writeLocalNotificationPrefs(prefs: NotificationPrefsShape) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function appendLocalScanNotifications(result: ScanApiSuccess, source: string): void {
  const prefs = readLocalNotificationPrefs();
  const payloads = buildScanNotificationPayloads(result, prefs);
  if (payloads.length === 0) return;

  const now = new Date().toISOString();
  const meta = { source, status: result.status, riskScore: result.riskScore, engine: result.engine };
  const next = payloads.map((p) => ({
    id: crypto.randomUUID(),
    title: p.title,
    body: p.body,
    severity: p.severity,
    readAt: null as string | null,
    createdAt: now,
    metadata: { ...meta, kind: p.kind },
  }));

  const merged = [...next, ...readNotifs()];
  writeNotifs(merged);
  window.dispatchEvent(new CustomEvent("torqa-notifications-changed"));
}

export function listLocalNotifications(): LocalNotification[] {
  return readNotifs().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function countUnreadLocal(): number {
  return readNotifs().filter((n) => !n.readAt).length;
}

export function markLocalNotificationRead(id: string): void {
  const items = readNotifs().map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  writeNotifs(items);
  window.dispatchEvent(new CustomEvent("torqa-notifications-changed"));
}

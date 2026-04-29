"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listLocalNotifications, markLocalNotificationRead } from "@/lib/notifications-local";
import { hasPublicSupabaseUrl } from "@/lib/env";
import { fetchInAppNotifications, type InAppNotificationRow } from "@/lib/notifications-client";

const useCloud = hasPublicSupabaseUrl();

function isLikelyScanUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default function NotificationsPage() {
  const [items, setItems] = useState<InAppNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inboxTab, setInboxTab] = useState<"all" | "unread">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "info">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    if (!useCloud) {
      setItems(
        listLocalNotifications().map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          severity: n.severity,
          read_at: n.readAt,
          created_at: n.createdAt,
          metadata: n.metadata,
          scanId:
            typeof n.metadata?.scanId === "string" && n.metadata.scanId.trim()
              ? n.metadata.scanId.trim()
              : typeof n.metadata?.scan_id === "string" && n.metadata.scan_id.trim()
                ? n.metadata.scan_id.trim()
                : null,
        }))
      );
      setLoading(false);
      return;
    }
    try {
      const out = await fetchInAppNotifications(50);
      if (!out.ok) {
        setItems([]);
        setLoadError(out.error);
        return;
      }
      setItems(out.notifications);
    } catch {
      setItems([]);
      setLoadError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = items;
    if (inboxTab === "unread") list = list.filter((n) => !n.read_at);
    if (severityFilter !== "all") list = list.filter((n) => n.severity === severityFilter);
    return list;
  }, [items, inboxTab, severityFilter]);

  const mark = async (id: string) => {
    if (!useCloud) {
      markLocalNotificationRead(id);
      await load();
      return;
    }
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    await load();
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Inbox</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Scan-driven alerts. Configure rules under{" "}
            <Link href="/settings/notifications" className="text-primary underline-offset-2 hover:underline">
              Scan alerts settings
            </Link>{" "}
            or team routes on{" "}
            <Link href="/alerts" className="text-primary underline-offset-2 hover:underline">
              Alerts
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/notifications">Scan alert settings</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/api">User API</Link>
          </Button>
        </div>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["all", "critical", "warning", "info"] as const).map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={severityFilter === s ? "default" : "outline"}
            onClick={() => setSeverityFilter(s)}
          >
            {s === "all" ? "All severities" : s}
          </Button>
        ))}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-4 w-4" aria-hidden />
            Inbox
          </CardTitle>
          <CardDescription>Open a scan report when Torqa stored a scan id on the notification (e.g. scheduled runs).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={inboxTab === "all" ? "default" : "outline"}
              onClick={() => setInboxTab("all")}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={inboxTab === "unread" ? "default" : "outline"}
              onClick={() => setInboxTab("unread")}
            >
              Unread only
            </Button>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {items.length === 0 ? "No notifications yet." : "Nothing in this view — try another filter."}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((n) => {
                const scanHref = n.scanId && isLikelyScanUuid(n.scanId) ? `/scan/${n.scanId}` : null;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between",
                      !n.read_at && "bg-muted/15 -mx-2 rounded-lg px-2 sm:mx-0 sm:px-0 sm:bg-transparent"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {scanHref ? (
                        <Link
                          href={scanHref}
                          className={cn(
                            "inline-flex items-center gap-1 font-medium hover:text-primary hover:underline",
                            n.severity === "critical" && "text-destructive",
                            n.severity === "warning" && "text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {n.title}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        </Link>
                      ) : (
                        <p
                          className={cn(
                            "font-medium",
                            n.severity === "critical" && "text-destructive",
                            n.severity === "warning" && "text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {n.title}
                        </p>
                      )}
                      {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                      <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {scanHref ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={scanHref}>Open report</Link>
                        </Button>
                      ) : null}
                      {!n.read_at ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => void mark(n.id)}>
                          Mark read
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Read</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

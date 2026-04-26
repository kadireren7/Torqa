"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listLocalNotifications, markLocalNotificationRead } from "@/lib/notifications-local";
import { hasPublicSupabaseUrl } from "@/lib/env";
import { fetchInAppNotifications, type InAppNotificationRow } from "@/lib/notifications-client";

const useCloud = hasPublicSupabaseUrl();

export default function NotificationsPage() {
  const [items, setItems] = useState<InAppNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/notifications">Alert settings</Link>
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

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-4 w-4" aria-hidden />
            All alerts
          </CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li key={n.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p
                      className={cn(
                        "font-medium",
                        n.severity === "critical" && "text-destructive",
                        n.severity === "warning" && "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                    <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.read_at && (
                    <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => void mark(n.id)}>
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

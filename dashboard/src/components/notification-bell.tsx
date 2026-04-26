"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { countUnreadLocal, listLocalNotifications, markLocalNotificationRead } from "@/lib/notifications-local";
import { hasPublicSupabaseUrl } from "@/lib/env";
import { fetchInAppNotifications, type InAppNotificationRow } from "@/lib/notifications-client";

const useCloud = hasPublicSupabaseUrl();

/** When Supabase is off, bell stays available for browser-local alerts without auth. */
export function NotificationBell({ enabled }: { enabled: boolean }) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<InAppNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnread(0);
      setItems([]);
      setLoadError(null);
      return;
    }
    if (!useCloud) {
      setLoadError(null);
      setUnread(countUnreadLocal());
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
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const out = await fetchInAppNotifications(8);
      if (!out.ok) {
        setItems([]);
        setUnread(0);
        setLoadError(out.error);
        return;
      }
      setItems(out.notifications);
      setUnread(out.unreadCount);
    } catch {
      setItems([]);
      setUnread(0);
      setLoadError("Network error");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener("torqa-notifications-changed", onChange);
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.removeEventListener("torqa-notifications-changed", onChange);
      window.clearInterval(id);
    };
  }, [refresh]);

  const markRead = async (id: string) => {
    if (!useCloud) {
      markLocalNotificationRead(id);
      await refresh();
      return;
    }
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    await refresh();
  };

  if (!enabled) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 shrink-0" aria-label="Notifications">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Bell className="h-4 w-4" />}
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between font-semibold">
          <span>Notifications</span>
          <Link href="/notifications" className="text-xs font-normal text-primary hover:underline" onClick={() => setOpen(false)}>
            View all
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loadError ? (
          <p className="px-3 py-4 text-center text-xs text-destructive">{loadError}</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No alerts yet.</p>
        ) : (
          items.slice(0, 8).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex cursor-default flex-col items-start gap-1 whitespace-normal px-3 py-2"
              onSelect={(e) => e.preventDefault()}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-medium leading-snug",
                    n.severity === "critical" && "text-destructive",
                    n.severity === "warning" && "text-amber-700 dark:text-amber-400"
                  )}
                >
                  {n.title}
                </span>
                {!n.read_at && (
                  <button
                    type="button"
                    className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary hover:underline"
                    onClick={() => void markRead(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
              {n.body ? <p className="text-xs leading-relaxed text-muted-foreground">{n.body}</p> : null}
              <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings/notifications" onClick={() => setOpen(false)}>
            Alert settings…
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings/api" onClick={() => setOpen(false)}>
            User API keys…
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

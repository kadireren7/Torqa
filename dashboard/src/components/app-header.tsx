"use client";

import { usePathname, useRouter } from "next/navigation";
import { titleForPath } from "@/lib/nav";
import { AppMobileNav } from "@/components/app-mobile-nav";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasPublicSupabaseUrl } from "@/lib/env";

export type AppHeaderUser = {
  email: string;
  displayName: string | null;
} | null;

type AppHeaderProps = {
  orgName: string;
  user: AppHeaderUser;
};

function initialsFrom(email: string, displayName: string | null): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase();
}

const hasSupabaseEnv = hasPublicSupabaseUrl();

export function AppHeader({ orgName, user }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = titleForPath(pathname);
  const notificationsEnabled = !hasSupabaseEnv || Boolean(user);

  const scanDetailMatch = pathname.match(/^\/scan\/([^/]+)$/);
  const scanDetailId = scanDetailMatch && scanDetailMatch[1] !== "history" ? scanDetailMatch[1] : null;

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase?.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const pageLabel = scanDetailId ? "Scan report" : title;
  const initials = user ? initialsFrom(user.email, user.displayName) : "?";
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Guest";

  return (
    <header
      className="sticky top-0 z-30 flex h-[56px] shrink-0 items-center gap-4 px-5 torqa-glass"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <AppMobileNav orgName={orgName} />

      {/* Breadcrumb / page title */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {scanDetailId ? (
          <div className="flex items-center gap-2 text-[13px]">
            <Link
              href="/scan"
              className="transition-colors duration-150"
              style={{ color: "var(--fg-3)" }}
            >
              Scan
            </Link>
            <span style={{ color: "var(--fg-4)" }}>/</span>
            <span className="font-mono text-[11px]" style={{ color: "var(--fg-2)" }}>
              {scanDetailId.slice(0, 8)}…
            </span>
          </div>
        ) : (
          <h1 className="text-[13px] font-medium" style={{ color: "var(--fg-2)" }}>
            {pageLabel}
          </h1>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <NotificationBell enabled={notificationsEnabled} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold transition-all duration-150 hover:opacity-80 focus:outline-none"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid color-mix(in srgb, var(--accent) 24%, transparent)",
              }}
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--line-2)",
            }}
          >
            <div className="px-3 py-2">
              <p className="text-[13px] font-medium" style={{ color: "var(--fg-1)" }}>
                {displayName}
              </p>
              {user?.email && (
                <p className="truncate text-[11px]" style={{ color: "var(--fg-3)" }}>
                  {user.email}
                </p>
              )}
            </div>
            <DropdownMenuSeparator style={{ background: "var(--line)" }} />
            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                className="cursor-pointer text-[13px]"
                style={{ color: "var(--fg-2)" }}
              >
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: "var(--line)" }} />
            {user ? (
              <DropdownMenuItem
                onClick={() => void signOut()}
                className="cursor-pointer text-[13px]"
                style={{ color: "var(--fg-3)" }}
              >
                Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href="/login" className="cursor-pointer text-[13px]">
                  Sign in
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNavItems } from "@/lib/nav";
import { TorqaLogoMark } from "@/components/torqa-logo";
import { GovernanceModeBadge } from "@/components/governance/mode-badge";

type AppSidebarProps = {
  orgName: string;
};

export function AppSidebar({ orgName }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex w-[220px] shrink-0 flex-col"
      style={{
        background: "var(--surface-0)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {/* Logo */}
      <div className="flex h-[56px] shrink-0 items-center gap-3 px-5">
        <div
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "rgba(34,211,238,0.08)",
            border: "1px solid rgba(34,211,238,0.18)",
          }}
        >
          <TorqaLogoMark size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">Torqa</p>
          {orgName !== "Personal" && (
            <p className="truncate text-[11px] text-[var(--fg-3)]">{orgName}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-[2px]">
          {mainNavItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/overview" && pathname.startsWith(item.href)) ||
              (item.href === "/overview" && pathname === "/overview");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-100",
                  active
                    ? "text-[var(--fg-1)]"
                    : "text-[var(--fg-3)] hover:text-[var(--fg-2)]"
                )}
                style={
                  active
                    ? { background: "rgba(255,255,255,0.06)" }
                    : undefined
                }
              >
                <Icon
                  className={cn(
                    "h-[15px] w-[15px] shrink-0 transition-colors",
                    active ? "text-[var(--cyan)]" : "text-[var(--fg-4)] group-hover:text-[var(--fg-3)]"
                  )}
                  aria-hidden
                />
                <span className="flex-1 leading-none">{item.title}</span>
                {item.badge && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide"
                    style={{
                      background: "rgba(34,211,238,0.1)",
                      border: "1px solid rgba(34,211,238,0.2)",
                      color: "var(--cyan)",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="mb-3">
          <GovernanceModeBadge />
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[12px] text-[var(--fg-3)] transition-colors hover:text-[var(--fg-2)]"
        >
          <span>←</span>
          <span>Home</span>
        </Link>
      </div>
    </aside>
  );
}

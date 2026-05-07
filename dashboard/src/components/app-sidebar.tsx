"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNavItems } from "@/lib/nav";
import { TorqaLogoAnimated } from "@/components/torqa-logo";
import { GovernanceModeBadge } from "@/components/governance/mode-badge";

type AppSidebarProps = {
  orgName: string;
};

export function AppSidebar({ orgName }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex w-[216px] shrink-0 flex-col"
      style={{
        background: "var(--surface-0)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {/* Logo */}
      <div className="flex h-[56px] shrink-0 items-center gap-2.5 px-4">
        <div
          className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid rgba(249,115,22,0.18)",
          }}
        >
          <TorqaLogoAnimated size={20} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[14px] font-semibold leading-none"
            style={{ color: "var(--fg-1)", letterSpacing: "-0.01em" }}
          >
            Torqa
          </p>
          {orgName && orgName !== "Personal" && (
            <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--fg-4)" }}>
              {orgName}
            </p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-[1px]">
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
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] font-medium transition-all duration-100"
                )}
                style={{
                  color: active ? "var(--fg-1)" : "var(--fg-3)",
                  background: active ? "rgba(255,255,255,0.05)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "var(--fg-2)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "var(--fg-3)";
                }}
              >
                <Icon
                  className="h-[15px] w-[15px] shrink-0"
                  style={{ color: active ? "var(--accent)" : "inherit" }}
                  aria-hidden
                />
                <span className="flex-1 leading-none">{item.title}</span>
                {item.badge && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide"
                    style={{
                      background: "var(--accent-soft)",
                      border: "1px solid rgba(249,115,22,0.2)",
                      color: "var(--accent)",
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
          className="flex items-center gap-1.5 text-[12px] transition-colors"
          style={{ color: "var(--fg-4)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-3)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-4)"; }}
        >
          ← Home
        </Link>
      </div>
    </aside>
  );
}

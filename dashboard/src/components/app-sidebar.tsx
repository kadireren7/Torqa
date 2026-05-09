"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
    <motion.aside
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex w-[220px] shrink-0 flex-col"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {/* Logo */}
      <div className="flex h-[56px] shrink-0 items-center gap-3 px-4">
        <div
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
          }}
        >
          <TorqaLogoAnimated size={18} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[14px] font-semibold leading-none tracking-[-0.02em]"
            style={{ color: "var(--fg-1)" }}
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
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-[2px]">
          {mainNavItems.map((item, i) => {
            const active =
              pathname === item.href ||
              (item.href !== "/overview" && pathname.startsWith(item.href)) ||
              (item.href === "/overview" && pathname === "/overview");
            const Icon = item.icon;

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150",
                    !active && "hover:opacity-80"
                  )}
                  style={{
                    color: active ? "var(--fg-1)" : "var(--fg-3)",
                    background: active ? "var(--overlay-md)" : "transparent",
                  }}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                  <Icon
                    className="h-[15px] w-[15px] shrink-0 transition-colors duration-150"
                    style={{ color: active ? "var(--accent)" : "var(--fg-4)" }}
                    aria-hidden
                  />
                  <span className="flex-1 leading-none">{item.title}</span>
                  {item.badge && (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="mb-3">
          <GovernanceModeBadge />
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] transition-opacity duration-150 hover:opacity-60"
          style={{ color: "var(--fg-4)" }}
        >
          ← Home
        </Link>
      </div>
    </motion.aside>
  );
}

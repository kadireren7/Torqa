"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNavSections } from "@/lib/nav";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

type AppSidebarProps = {
  orgName: string;
};

export function AppSidebar({ orgName }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
          T
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">Torqa</p>
          <p className="truncate text-xs text-muted-foreground">{orgName}</p>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-4 px-2">
          {mainNavSections.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {section.title}
                </p>
                {section.subtitle ? (
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/60">{section.subtitle}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      <span className="flex-1">{item.title}</span>
                      {item.badge ? (
                        <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Governance dashboard
        </p>
      </div>
    </aside>
  );
}

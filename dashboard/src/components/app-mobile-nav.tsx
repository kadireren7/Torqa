"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { mainNav } from "@/lib/nav";
import { Separator } from "@/components/ui/separator";

type AppMobileNavProps = {
  orgName: string;
};

export function AppMobileNav({ orgName }: AppMobileNavProps) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-border bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              T
            </span>
            <span className="truncate font-semibold">Torqa</span>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{orgName}</p>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 p-2">
          {mainNav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.title}
              </Link>
            );
          })}
        </nav>
        <Separator className="bg-sidebar-border" />
        <p className="p-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          MVP · mock data
        </p>
      </SheetContent>
    </Sheet>
  );
}

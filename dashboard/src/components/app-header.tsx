"use client";

import { usePathname } from "next/navigation";
import { titleForPath } from "@/lib/nav";
import { AppMobileNav } from "@/components/app-mobile-nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  orgName: string;
};

export function AppHeader({ orgName }: AppHeaderProps) {
  const pathname = usePathname();
  const title = titleForPath(pathname);
  const runMatch = pathname.match(/^\/validation\/([^/]+)$/);
  const runId = runMatch?.[1];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <AppMobileNav orgName={orgName} />
      <Breadcrumb className="hidden min-w-0 sm:flex">
        <BreadcrumbList className="flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {pathname !== "/" && (
            <>
              <BreadcrumbSeparator />
              {runId ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        href="/validation"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Validation
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="max-w-[160px] truncate font-medium">
                      {runId}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium">{title}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="min-w-0 flex-1 sm:hidden">
        <h1 className="truncate text-sm font-semibold">
          {runId ? `Run ${runId}` : title}
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 gap-2 rounded-full pl-2 pr-1">
              <span className="hidden text-xs text-muted-foreground sm:inline">Alex</span>
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  AR
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">Alex Rivera</p>
              <p className="text-xs text-muted-foreground">alex@northwind.dev</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Account (soon)</DropdownMenuItem>
            <DropdownMenuItem disabled>Sign out (soon)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

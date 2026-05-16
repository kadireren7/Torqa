import {
  LayoutDashboard,
  Plug,
  Workflow,
  Coins,
  Tag,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: "beta" | "new" | "planned";
};

export type NavSection = {
  items: NavItem[];
};

export const mainNavItems: NavItem[] = [
  { title: "Console",     href: "/overview",                  icon: LayoutDashboard },
  { title: "MCP Server",  href: "/mcp-server",                icon: Plug },
  { title: "Web Builder", href: "/demo/mcp-workflow-builder", icon: Workflow },
  { title: "Credits",     href: "/credits",                   icon: Coins, badge: "planned" },
  { title: "Pricing",     href: "/pricing",                   icon: Tag },
  { title: "Settings",    href: "/settings",                  icon: Settings },
];

/** @deprecated use mainNavItems */
export const mainNavSections = [
  { title: "Navigation", items: mainNavItems },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/overview") return "Console";
  if (pathname.startsWith("/mcp-server")) return "MCP Server";
  if (pathname.startsWith("/demo/mcp-workflow-builder")) return "Web Builder";
  if (pathname.startsWith("/workflows")) return "Web Builder";
  if (pathname.startsWith("/credits")) return "Credits";
  if (pathname.startsWith("/pricing")) return "Pricing";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Torqa";
}

import {
  LayoutDashboard,
  FileJson2,
  History,
  ShieldCheck,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: "beta" | "new";
};

export type NavSection = {
  items: NavItem[];
};

export const mainNavItems: NavItem[] = [
  { title: "Console",            href: "/overview",  icon: LayoutDashboard },
  { title: "Scan MCP Config",    href: "/scan",      icon: FileJson2 },
  { title: "Scan History",       href: "/runs",      icon: History },
  { title: "Hardening Policies", href: "/policies",  icon: ShieldCheck },
  { title: "Local Reports",      href: "/reports",   icon: FileText },
  { title: "Settings",           href: "/settings",  icon: Settings },
];

/** @deprecated use mainNavItems */
export const mainNavSections = [
  { title: "Navigation", items: mainNavItems },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/overview") return "Console";
  if (pathname.startsWith("/sources")) return "MCP Configs";
  if (pathname.startsWith("/workflows")) return "Workflows";
  if (pathname.startsWith("/runs")) return "Scan History";
  if (pathname.startsWith("/policies") || pathname.startsWith("/policy")) return "Hardening Policies";
  if (pathname.startsWith("/audit")) return "Audit";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.startsWith("/reports")) return "Local Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/approvals")) return "Settings";
  if (pathname.startsWith("/advanced")) return "Settings";
  if (pathname.startsWith("/scan/")) return "Scan report";
  if (pathname.startsWith("/scan")) return "Scan MCP Config";
  if (pathname.startsWith("/insights")) return "Local Reports";
  if (pathname.startsWith("/integrations")) return "MCP Configs";
  if (pathname.startsWith("/schedules")) return "Automations";
  if (pathname.startsWith("/alerts")) return "Automations";
  if (pathname.startsWith("/workspace/activity")) return "Settings";
  if (pathname.startsWith("/workspace")) return "Settings";
  if (pathname.startsWith("/projects")) return "Workflows";
  if (pathname.startsWith("/workflow-library")) return "Workflows";
  if (pathname.startsWith("/validation")) return "Workflows";
  if (pathname.startsWith("/notifications")) return "Settings";
  if (pathname.startsWith("/developer")) return "Settings";
  if (pathname.startsWith("/marketplace")) return "Hardening Policies";
  if (pathname.startsWith("/agent-runtime")) return "Settings";
  if (pathname.startsWith("/mcp")) return "Settings";
  return "Torqa";
}

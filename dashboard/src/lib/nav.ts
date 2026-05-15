import {
  LayoutDashboard,
  FileJson2,
  History,
  ShieldCheck,
  FileText,
  Settings,
  Workflow,
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
  { title: "Console",              href: "/overview",                    icon: LayoutDashboard },
  { title: "Build Workflow",       href: "/demo/mcp-workflow-builder",   icon: Workflow,   badge: "new" },
  { title: "Scan MCP Tools",       href: "/scan",                        icon: FileJson2 },
  { title: "Tool Scan History",    href: "/runs",                        icon: History },
  { title: "Tool Safety Policies", href: "/policies",                    icon: ShieldCheck },
  { title: "Workflow Reports",     href: "/reports",                     icon: FileText },
  { title: "Settings",             href: "/settings",                    icon: Settings },
];

/** @deprecated use mainNavItems */
export const mainNavSections = [
  { title: "Navigation", items: mainNavItems },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/overview") return "Console";
  if (pathname.startsWith("/demo/mcp-workflow-builder")) return "Build Workflow";
  if (pathname.startsWith("/sources")) return "MCP Configs";
  if (pathname.startsWith("/workflows")) return "Workflows";
  if (pathname.startsWith("/runs")) return "Tool Scan History";
  if (pathname.startsWith("/policies") || pathname.startsWith("/policy")) return "Tool Safety Policies";
  if (pathname.startsWith("/audit")) return "Audit";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.startsWith("/reports")) return "Workflow Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/approvals")) return "Settings";
  if (pathname.startsWith("/advanced")) return "Settings";
  if (pathname.startsWith("/scan/")) return "Scan report";
  if (pathname.startsWith("/scan")) return "Scan MCP Tools";
  if (pathname.startsWith("/insights")) return "Workflow Reports";
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
  if (pathname.startsWith("/marketplace")) return "Tool Safety Policies";
  if (pathname.startsWith("/agent-runtime")) return "Settings";
  if (pathname.startsWith("/mcp")) return "Settings";
  return "Torqa";
}

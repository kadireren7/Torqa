import {
  Home,
  GitBranch,
  Workflow,
  Play,
  Shield,
  Zap,
  BarChart3,
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
  { title: "Home",        href: "/overview",    icon: Home },
  { title: "Sources",     href: "/sources",     icon: GitBranch },
  { title: "Workflows",   href: "/workflows",   icon: Workflow },
  { title: "Runs",        href: "/runs",        icon: Play },
  { title: "Policies",    href: "/policies",    icon: Shield },
  { title: "Automations", href: "/automations", icon: Zap },
  { title: "Reports",     href: "/reports",     icon: BarChart3 },
  { title: "Settings",    href: "/settings",    icon: Settings },
];

/** @deprecated use mainNavItems */
export const mainNavSections = [
  { title: "Navigation", items: mainNavItems },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/overview") return "Home";
  if (pathname.startsWith("/sources")) return "Sources";
  if (pathname.startsWith("/workflows")) return "Workflows";
  if (pathname.startsWith("/runs")) return "Runs";
  if (pathname.startsWith("/policies") || pathname.startsWith("/policy")) return "Policies";
  if (pathname.startsWith("/audit")) return "Audit";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/approvals")) return "Settings";
  if (pathname.startsWith("/advanced")) return "Settings";
  if (pathname.startsWith("/scan/")) return "Scan report";
  if (pathname.startsWith("/scan")) return "Scan";
  if (pathname.startsWith("/insights")) return "Reports";
  if (pathname.startsWith("/integrations")) return "Sources";
  if (pathname.startsWith("/schedules")) return "Automations";
  if (pathname.startsWith("/alerts")) return "Automations";
  if (pathname.startsWith("/workspace/activity")) return "Settings";
  if (pathname.startsWith("/workspace")) return "Settings";
  if (pathname.startsWith("/projects")) return "Workflows";
  if (pathname.startsWith("/workflow-library")) return "Workflows";
  if (pathname.startsWith("/validation")) return "Workflows";
  if (pathname.startsWith("/notifications")) return "Settings";
  if (pathname.startsWith("/developer")) return "Settings";
  if (pathname.startsWith("/marketplace")) return "Policies";
  if (pathname.startsWith("/agent-runtime")) return "Settings";
  if (pathname.startsWith("/mcp")) return "Settings";
  return "Torqa";
}

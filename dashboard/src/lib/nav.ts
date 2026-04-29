import {
  LayoutDashboard,
  Shield,
  Users,
  FolderKanban,
  Radar,
  Plug,
  ClipboardList,
  Library,
  Bell,
  KeyRound,
  CalendarClock,
  Megaphone,
  LineChart,
  History,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: "beta";
};

export type NavSection = {
  title: string;
  subtitle?: string;
  items: NavItem[];
};

/**
 * Process-oriented navigation: prepare workflows → gate (scan/review/policy) → monitor → team → alarms → API.
 * Mirrors the journey Upload → Scan → Review → Schedule.
 */
export const mainNavSections: NavSection[] = [
  {
    title: "Start",
    subtitle: "Home & onboarding",
    items: [{ title: "Overview", href: "/overview", icon: LayoutDashboard }],
  },
  {
    title: "Workflows",
    subtitle: "Repos, bundles, templates",
    items: [
      { title: "Projects", href: "/projects", icon: FolderKanban },
      { title: "Workflow library", href: "/workflow-library", icon: Library },
    ],
  },
  {
    title: "Gate",
    subtitle: "Scan → review → policy → schedule",
    items: [
      { title: "Scan", href: "/scan", icon: Radar },
      { title: "Scan results", href: "/scan/history", icon: ClipboardList },
      { title: "Policies", href: "/policies", icon: Shield },
      { title: "Schedules", href: "/schedules", icon: CalendarClock, badge: "beta" },
    ],
  },
  {
    title: "Monitor",
    subtitle: "Trends & connectors",
    items: [
      { title: "Insights", href: "/insights", icon: LineChart },
      { title: "Integrations", href: "/integrations", icon: Plug, badge: "beta" },
    ],
  },
  {
    title: "Workspace",
    subtitle: "Team & audit",
    items: [
      { title: "Workspace", href: "/workspace", icon: Users },
      { title: "Workspace activity", href: "/workspace/activity", icon: History },
    ],
  },
  {
    title: "Alarms",
    subtitle: "Inbox, routes, personal toggles",
    items: [
      { title: "Notifications", href: "/notifications", icon: Bell },
      { title: "Team alerts", href: "/alerts", icon: Megaphone, badge: "beta" },
      { title: "Scan alert prefs", href: "/settings/notifications", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Developers",
    subtitle: "API keys & automation",
    items: [{ title: "User API", href: "/settings/api", icon: KeyRound, badge: "beta" }],
  },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname === "/overview") return "Overview";
  if (pathname.startsWith("/insights")) return "Insights";
  if (pathname.match(/^\/projects\/[^/]+$/)) return "Project";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/scan/history")) return "Scan results";
  if (pathname.startsWith("/scan/")) return "Scan report";
  if (pathname.startsWith("/scan")) return "Scan";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/schedules")) return "Scheduled scans";
  if (pathname.startsWith("/workflow-library")) return "Workflow library";
  if (pathname.startsWith("/validation")) return "Validation";
  if (pathname.startsWith("/policies")) return "Policy templates";
  if (pathname.startsWith("/policy")) return "Policy settings";
  if (pathname.startsWith("/workspace/activity")) return "Workspace activity";
  if (pathname.startsWith("/workspace")) return "Workspace";
  if (pathname.startsWith("/settings/api")) return "User API";
  if (pathname.startsWith("/settings/notifications")) return "Scan alert prefs";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/alerts")) return "Team alerts";
  return "Torqa";
}

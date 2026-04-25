import {
  LayoutDashboard,
  Shield,
  Users,
  FolderKanban,
  History,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const mainNav: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Validation", href: "/validation", icon: History },
  { title: "Policies", href: "/policy", icon: Shield },
  { title: "Team", href: "/team", icon: Users },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/validation")) return "Validation";
  if (pathname.startsWith("/policy")) return "Policies";
  if (pathname.startsWith("/team")) return "Team";
  return "Torqa";
}

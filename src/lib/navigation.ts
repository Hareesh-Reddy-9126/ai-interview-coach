import {
  LayoutDashboard,
  Mic,
  Target,
  FileText,
  BarChart3,
  Map,
  Gauge,
  Settings,
  History,
  Code2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
  shortcut?: string;
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        to: "/dashboard",
        icon: LayoutDashboard,
        label: "Overview",
        description: "Your preparation at a glance",
        shortcut: "G O",
        keywords: ["dashboard", "home", "progress"],
      },
      {
        to: "/interview",
        icon: Mic,
        label: "Interview",
        description: "Live AI mock interview",
        shortcut: "G I",
        keywords: ["mock", "practice", "behavioral", "system design"],
      },
      {
        to: "/coding",
        icon: Code2,
        label: "Coding Lab",
        description: "Problems with AI review",
        shortcut: "G C",
        keywords: ["algorithms", "leetcode", "editor"],
      },
      {
        to: "/practice",
        icon: Target,
        label: "Practice",
        description: "Focused, role-specific drills",
        keywords: ["drills", "company"],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        to: "/analytics",
        icon: BarChart3,
        label: "Analytics",
        description: "Score trends and skill gaps",
        keywords: ["charts", "performance", "progress"],
      },
      {
        to: "/history",
        icon: History,
        label: "History",
        description: "Every past session",
        keywords: ["sessions", "archive"],
      },
      {
        to: "/roadmap",
        icon: Map,
        label: "Roadmap",
        description: "Your personalised 4-week plan",
        keywords: ["learning", "plan"],
      },
      {
        to: "/resume",
        icon: FileText,
        label: "Resume",
        description: "AI analysis and tailored questions",
        keywords: ["cv", "upload", "analysis"],
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        to: "/usage",
        icon: Gauge,
        label: "Plan & Usage",
        description: "Fair-use limits",
        keywords: ["limits", "quota", "billing"],
      },
      {
        to: "/settings",
        icon: Settings,
        label: "Settings",
        description: "Profile and preferences",
        keywords: ["account", "profile"],
      },
    ],
  },
];

export const allNavItems = navGroups.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return allNavItems.find((item) => pathname.startsWith(item.to));
}

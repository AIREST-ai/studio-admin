import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  CheckSquare,
  Contact,
  Fingerprint,
  Kanban,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  Phone,
  ReceiptText,
  Settings,
  ShoppingBag,
  SquareArrowUpRight,
  UserRound,
  Users,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        id: "default",
        title: "Overview",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        id: "ecommerce",
        title: "E-commerce",
        url: "/dashboard/ecommerce",
        icon: ShoppingBag,
      },
    ],
  },
  {
    id: 2,
    label: "Pages",
    items: [
      {
        id: "chat",
        title: "Chat",
        url: "/dashboard/chat",
        icon: MessageSquare,
      },
      {
        id: "contacts",
        title: "Contacts",
        url: "/dashboard/contacts",
        icon: Contact,
      },
      {
        id: "calendar",
        title: "Calendar",
        url: "/dashboard/calendar",
        icon: Calendar,
      },
      {
        id: "kanban",
        title: "Kanban",
        url: "/dashboard/kanban",
        icon: Kanban,
      },
      {
        id: "tasks",
        title: "Tasks",
        url: "/dashboard/tasks",
        icon: CheckSquare,
      },
      {
        id: "invoice",
        title: "Invoice",
        url: "/dashboard/invoice",
        icon: ReceiptText,
      },
      {
        id: "users",
        title: "Users & Roles",
        url: "/dashboard/users",
        icon: Users,
      },
      {
        id: "authentication",
        title: "Authentication",
        icon: Fingerprint,
        subItems: [
          { id: "auth-login-v1", title: "Login v1", url: "/auth/v1/login", newTab: true },
          { id: "auth-login-v2", title: "Login v2", url: "/auth/v2/login", newTab: true },
          { id: "auth-register-v1", title: "Register v1", url: "/auth/v1/register", newTab: true },
          { id: "auth-register-v2", title: "Register v2", url: "/auth/v2/register", newTab: true },
        ],
      },
    ],
  },
  {
    id: 3,
    label: "Chatwoot",
    items: [
      { id: "cw-reports", title: "Reports", url: "/dashboard/reports/overview", icon: BarChart3 },
      { id: "cw-campaigns", title: "Campaigns", url: "/dashboard/campaigns", icon: Megaphone },
      { id: "cw-calls", title: "Calls", url: "/dashboard/calls", icon: Phone },
      { id: "cw-help-center", title: "Help Center", url: "/dashboard/help-center", icon: BookOpen },
      { id: "cw-captain", title: "Captain", url: "/dashboard/captain", icon: Bot },
      { id: "cw-companies", title: "Companies", url: "/dashboard/companies", icon: Building2 },
      { id: "cw-notifications", title: "Notifications", url: "/dashboard/notifications", icon: Bell },
      {
        id: "cw-settings",
        title: "Settings",
        icon: Settings,
        subItems: [
          { id: "s-account", title: "Account Settings", url: "/dashboard/settings/account" },
          { id: "s-inboxes", title: "Inboxes", url: "/dashboard/settings/inboxes" },
          { id: "s-teams", title: "Teams", url: "/dashboard/settings/teams" },
          { id: "s-bots", title: "Bots", url: "/dashboard/settings/bots" },
          { id: "s-assignment", title: "Assignment Policy", url: "/dashboard/settings/assignment-policy" },
          { id: "s-labels", title: "Labels", url: "/dashboard/settings/labels" },
          { id: "s-attributes", title: "Custom Attributes", url: "/dashboard/settings/attributes" },
          { id: "s-automation", title: "Automation", url: "/dashboard/settings/automation" },
          { id: "s-macros", title: "Macros", url: "/dashboard/settings/macros" },
          { id: "s-canned", title: "Canned Responses", url: "/dashboard/settings/canned-responses" },
          { id: "s-workflow", title: "Conversation Workflow", url: "/dashboard/settings/conversation-workflow" },
          { id: "s-templates", title: "Templates", url: "/dashboard/settings/templates" },
          { id: "s-sla", title: "SLA", url: "/dashboard/settings/sla" },
          { id: "s-integrations", title: "Integrations", url: "/dashboard/settings/integrations" },
          { id: "s-audit", title: "Audit Logs", url: "/dashboard/settings/audit-logs" },
          { id: "s-billing", title: "Billing", url: "/dashboard/settings/billing" },
          { id: "s-security", title: "Security", url: "/dashboard/settings/security" },
          { id: "s-data", title: "Data", url: "/dashboard/settings/data" },
          { id: "s-profile", title: "Profile Settings", url: "/dashboard/settings/profile" },
        ],
      },
    ],
  },
  {
    id: 4,
    label: "Misc",
    items: [
      {
        id: "others",
        title: "Others",
        url: "/dashboard/coming-soon",
        icon: SquareArrowUpRight,
        badge: "soon",
        disabled: true,
      },
    ],
  },
];

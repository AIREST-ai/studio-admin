import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  CheckSquare,
  Contact,
  Fingerprint,
  Folder,
  Inbox,
  Kanban,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  Phone,
  ReceiptText,
  Search,
  Settings,
  ShoppingBag,
  SquareArrowUpRight,
  Tag,
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
  // F159: Chatwoot conversation views, at the top like Chatwoot's own sidebar.
  {
    id: 0,
    label: "Conversations",
    items: [
      // Chatwoot v4.18 Sidebar.vue: a "Search..." link to the search page sits at the top of the sidebar.
      { id: "cv-search", title: "Search", url: "/dashboard/chat/search", icon: Search },
      {
        id: "chat",
        title: "Conversations",
        icon: MessageSquare,
        subItems: [
          { id: "cv-all", title: "All Conversations", url: "/dashboard/chat" },
          { id: "cv-mentions", title: "Mentions", url: "/dashboard/chat/mentions" },
          { id: "cv-participating", title: "Participating", url: "/dashboard/chat/participating" },
          { id: "cv-unattended", title: "Unattended", url: "/dashboard/chat/unattended" },
        ],
      },
      {
        id: "cv-folders",
        title: "Folders",
        icon: Folder,
        // Starting folders only: nav-main.tsx replaces these with the saved folders from the conversations store.
        subItems: [
          { id: "cv-f-vip", title: "VIP Customers", url: "/dashboard/chat/folders/vip" },
          { id: "cv-f-orders", title: "Orders & Returns", url: "/dashboard/chat/folders/orders" },
          { id: "cv-f-feedback", title: "Product Feedback", url: "/dashboard/chat/folders/feedback" },
        ],
      },
      {
        id: "cv-teams",
        title: "Teams",
        icon: Users,
        subItems: [
          { id: "cv-t-sales", title: "Sales", url: "/dashboard/chat/teams/sales" },
          { id: "cv-t-support", title: "Support", url: "/dashboard/chat/teams/support" },
          { id: "cv-t-billing", title: "Billing", url: "/dashboard/chat/teams/billing" },
          { id: "cv-t-technical", title: "Technical", url: "/dashboard/chat/teams/technical" },
        ],
      },
      {
        id: "cv-channels",
        title: "Channels",
        icon: Inbox,
        subItems: [
          { id: "cv-c-email", title: "Support Email", url: "/dashboard/chat/channels/email" },
          { id: "cv-c-chat", title: "Website Chat", url: "/dashboard/chat/channels/chat" },
          { id: "cv-c-whatsapp", title: "WhatsApp Business", url: "/dashboard/chat/channels/whatsapp" },
          { id: "cv-c-instagram", title: "Instagram", url: "/dashboard/chat/channels/instagram" },
          { id: "cv-c-facebook", title: "Facebook Page", url: "/dashboard/chat/channels/facebook" },
          { id: "cv-c-phone", title: "Phone", url: "/dashboard/chat/channels/phone" },
        ],
      },
      {
        id: "cv-labels",
        title: "Labels",
        icon: Tag,
        // Starting labels only (the Contacts page ones): nav-main.tsx replaces these with the labels of chat-tags-store.
        subItems: [
          { id: "cv-l-vip", title: "vip", url: "/dashboard/chat/labels/vip" },
          { id: "cv-l-billing", title: "billing", url: "/dashboard/chat/labels/billing" },
          { id: "cv-l-lead", title: "lead", url: "/dashboard/chat/labels/lead" },
          { id: "cv-l-partner", title: "partner", url: "/dashboard/chat/labels/partner" },
          { id: "cv-l-support", title: "support", url: "/dashboard/chat/labels/support" },
        ],
      },
    ],
  },
  // F159: the rest of the helpdesk in the standard order (Contacts, Reports, Campaigns, Help Center,
  // Captain, Notifications, Settings). Calls sits next to Captain as in Chatwoot's sidebar.
  // Companies removed by Fahad's order (final pass): no data backend behind it.
  {
    id: 1,
    label: "Helpdesk",
    items: [
      { id: "contacts", title: "Contacts", url: "/dashboard/contacts", icon: Contact },
      { id: "cw-reports", title: "Reports", url: "/dashboard/reports/overview", icon: BarChart3 },
      { id: "cw-campaigns", title: "Campaigns", url: "/dashboard/campaigns", icon: Megaphone },
      { id: "cw-help-center", title: "Help Center", url: "/dashboard/help-center", icon: BookOpen },
      { id: "cw-captain", title: "Captain", url: "/dashboard/captain", icon: Bot },
      { id: "cw-calls", title: "Calls", url: "/dashboard/calls", icon: Phone },
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
  // Studio's own pages after the helpdesk.
  {
    id: 2,
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
    id: 3,
    label: "Pages",
    items: [
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

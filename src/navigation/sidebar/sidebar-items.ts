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
      // F161: Chatwoot's first sidebar item (Sidebar.vue:366-370), the notifications page, named "My Inbox" as there.
      { id: "cw-notifications", title: "My Inbox", url: "/dashboard/notifications", icon: Bell },
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
        // Starting teams only: nav-main.tsx replaces these with the shared teams (Settings > Teams).
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
        // Starting inboxes only: nav-main.tsx replaces these with every shared inbox (Settings > Inboxes).
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
        // Starting labels only: nav-main.tsx replaces these with the shared labels shown on the sidebar (src/lib/cw).
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
  // F161: the rest of the helpdesk in Chatwoot's sidebar order (Sidebar.vue): Captain, Calls, Contacts, Reports,
  // Campaigns, Help Center, Settings, each with its Chatwoot children. Companies removed by Fahad's order.
  {
    id: 1,
    label: "Helpdesk",
    items: [
      {
        id: "cw-captain",
        title: "Captain",
        icon: Bot,
        subItems: [
          { id: "cp-overview", title: "Overview", url: "/dashboard/captain" },
          { id: "cp-faqs", title: "FAQs", url: "/dashboard/captain/faqs" },
          { id: "cp-documents", title: "Documents", url: "/dashboard/captain/documents" },
          { id: "cp-scenarios", title: "Scenarios", url: "/dashboard/captain/scenarios" },
          { id: "cp-playground", title: "Playground", url: "/dashboard/captain/playground" },
          { id: "cp-inboxes", title: "Inboxes", url: "/dashboard/captain/inboxes" },
          { id: "cp-tools", title: "Tools", url: "/dashboard/captain/tools" },
          { id: "cp-settings", title: "Settings", url: "/dashboard/captain/settings" },
        ],
      },
      { id: "cw-calls", title: "Calls", url: "/dashboard/calls", icon: Phone },
      {
        id: "contacts",
        title: "Contacts",
        icon: Contact,
        subItems: [
          { id: "ct-all", title: "All Contacts", url: "/dashboard/contacts" },
          { id: "ct-active", title: "Active", url: "/dashboard/contacts/active" },
        ],
      },
      {
        id: "cw-reports",
        title: "Reports",
        icon: BarChart3,
        subItems: [
          { id: "r-overview", title: "Overview", url: "/dashboard/reports/overview" },
          { id: "r-conversations", title: "Conversations", url: "/dashboard/reports/conversations" },
          { id: "r-agents", title: "Agents", url: "/dashboard/reports/agents" },
          { id: "r-labels", title: "Labels", url: "/dashboard/reports/labels" },
          { id: "r-inboxes", title: "Inbox", url: "/dashboard/reports/inboxes" },
          { id: "r-teams", title: "Team", url: "/dashboard/reports/teams" },
          { id: "r-csat", title: "CSAT", url: "/dashboard/reports/csat" },
          { id: "r-sla", title: "SLA", url: "/dashboard/reports/sla" },
          { id: "r-bot", title: "Bot", url: "/dashboard/reports/bot" },
        ],
      },
      {
        id: "cw-campaigns",
        title: "Campaigns",
        icon: Megaphone,
        subItems: [
          { id: "cm-live-chat", title: "Live chat", url: "/dashboard/campaigns/live-chat" },
          { id: "cm-sms", title: "SMS", url: "/dashboard/campaigns/sms" },
          { id: "cm-whatsapp", title: "WhatsApp", url: "/dashboard/campaigns/whatsapp" },
        ],
      },
      {
        id: "cw-help-center",
        title: "Help Center",
        icon: BookOpen,
        subItems: [
          { id: "hc-articles", title: "Articles", url: "/dashboard/help-center" },
          { id: "hc-categories", title: "Categories", url: "/dashboard/help-center/categories" },
          { id: "hc-locales", title: "Locales", url: "/dashboard/help-center/locales" },
          { id: "hc-settings", title: "Settings", url: "/dashboard/help-center/settings" },
        ],
      },
      {
        id: "cw-settings",
        title: "Settings",
        icon: Settings,
        subItems: [
          { id: "s-index", title: "All Settings", url: "/dashboard/settings" },
          { id: "s-account", title: "Account Settings", url: "/dashboard/settings/account" },
          { id: "s-agents", title: "Agents", url: "/dashboard/users" },
          { id: "s-teams", title: "Teams", url: "/dashboard/settings/teams" },
          { id: "s-assignment", title: "Agent Assignment", url: "/dashboard/settings/assignment-policy" },
          { id: "s-inboxes", title: "Inboxes", url: "/dashboard/settings/inboxes" },
          { id: "s-templates", title: "Templates", url: "/dashboard/settings/templates" },
          { id: "s-labels", title: "Labels", url: "/dashboard/settings/labels" },
          { id: "s-attributes", title: "Custom Attributes", url: "/dashboard/settings/attributes" },
          { id: "s-automation", title: "Automation", url: "/dashboard/settings/automation" },
          { id: "s-bots", title: "Bots", url: "/dashboard/settings/bots" },
          { id: "s-macros", title: "Macros", url: "/dashboard/settings/macros" },
          { id: "s-canned", title: "Canned Responses", url: "/dashboard/settings/canned-responses" },
          { id: "s-integrations", title: "Integrations", url: "/dashboard/settings/integrations" },
          { id: "s-data", title: "Data", url: "/dashboard/settings/data" },
          { id: "s-audit", title: "Audit Logs", url: "/dashboard/settings/audit-logs" },
          { id: "s-custom-roles", title: "Custom Roles", url: "/dashboard/users?tab=roles" },
          { id: "s-sla", title: "SLA", url: "/dashboard/settings/sla" },
          { id: "s-captain", title: "Captain", url: "/dashboard/captain/captain-settings" },
          { id: "s-workflow", title: "Conversation Workflow", url: "/dashboard/settings/conversation-workflow" },
          { id: "s-security", title: "Security", url: "/dashboard/settings/security" },
          { id: "s-billing", title: "Billing", url: "/dashboard/settings/billing" },
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

import {
  AtSign,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  CheckSquare,
  Contact,
  Ellipsis,
  Fingerprint,
  Folder,
  Inbox,
  Kanban,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Phone,
  ReceiptText,
  Repeat,
  Search,
  Settings,
  ShoppingBag,
  Tag,
  Users,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  // T-284 (item 125.2): small marks shown right after the icon (My Inbox: message and @mention beside its bell).
  marks?: LucideIcon[];
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  // م137 (Fahad 137): the heading of the part of a section's inner bar this link sits in (Settings: Workspace, Team,
  // Channels, ...). Links with no group come first, under no heading.
  group?: string;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  marks?: LucideIcon[];
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  // T-58: shown as its icon alone, with its name in a tooltip and for screen readers (Help Center in the footer).
  iconOnly?: boolean;
  // م137: a section's link keeps its sub item's group when the inner bar lists it (section-subnav.tsx).
  group?: string;
  // T-89: the ids of the few fixed links its hover preview in the rail shows (Fahad: a short summary, not everything);
  // the rest stay in the section's inner bar. Unset: all its links.
  preview?: string[];
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
  // T-54: when set, the main sidebar shows this item as one link to its first sub item, and the sub items are listed
  // in the inner bar beside it on the section's pages (_components/sidebar/section-subnav.tsx), not under it.
  subnav?: boolean;
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  // T-66: not shown in the sidebar (Fahad: no English group headings there); the header search still groups by it.
  label?: string;
  // T-53: when set, the main sidebar shows this one link for the group, and the group's items are listed in the inner
  // bar of its pages (chat/_components/inbox-subnav.tsx). The items stay here, so the header search still finds them.
  entry?: NavMainLinkItem;
  // T-73: when set, the main sidebar shows the group as this one button, always the last of the list (Fahad: a section
  // added later goes above it); clicking it lists the group's items for a moment.
  more?: { id: string; title: string; icon?: LucideIcon };
  // T-89: with an entry, the ids of the fixed links its hover preview shows (NavItemBase.preview).
  preview?: string[];
  // T-58: listed at the bottom of the main sidebar, above the account menu, not in the scrolling list.
  footer?: boolean;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  // T-142 / T-146: Home is the verified logo link; keep the home page, remove only its duplicate entry.
  // F159: Chatwoot conversation views, at the top like Chatwoot's own sidebar.
  // T-53: the whole group is one Inbox entry in the main sidebar; its pages show the group in an inner bar. Fixed ways
  // of work (Search, the views, Calls) come before the lists that grow (Folders, Teams, Channels, Labels).
  {
    id: 0,
    label: "Inbox",
    entry: { id: "inbox", title: "Inbox", url: "/dashboard/chat", icon: MessageSquare },
    // T-142: daily conversation views and every shared channel are visible; secondary filters open in Show more.
    // T-284 (item 125.1): My Inbox is no longer its own rail link, so the preview starts with it, then Conversations.
    preview: [
      "cw-notifications",
      "cv-all",
      "cv-unattended",
      "cv-participating",
      "cv-search",
      "cw-comments",
      "cw-calls",
      "cv-channels",
    ],
    items: [
      // Chatwoot v4.18 Sidebar.vue: a "Search..." link sits at the top of the sidebar. T-259 (item 30): it opens the
      // Inbox bar's message search (section-subnav.tsx reads ?search=), not the full page; that page stays for old links.
      { id: "cv-search", title: "Search", url: "/dashboard/chat?search=", icon: Search },
      // F161: Chatwoot's first sidebar item (Sidebar.vue:366-370), the notifications page, named "My Inbox" as there.
      // T-49 / F-17: shown or hidden by the owner in the Owner console (/super_admin, src/lib/owner/site-sections.ts),
      // its default from src/config/features.ts; nav-main.tsx withLiveLists drops it while hidden.
      // T-284 (item 125.1): the one place of My Inbox, first inside Inbox (its own rail link is gone). Item 125.2: a
      // message and an @ mark beside the bell set the personal notifications (mentions, assignments) apart from the
      // team's conversations; a look only, the page's data and permissions are unchanged.
      {
        id: "cw-notifications",
        title: "My Inbox",
        url: "/dashboard/notifications",
        icon: Bell,
        marks: [MessageSquare, AtSign],
      },
      {
        id: "chat",
        // T-57: Fahad approved Conversations internally; group.entry stays Inbox.
        title: "Conversations",
        icon: MessageSquare,
        subItems: [
          { id: "cv-all", title: "All Conversations", url: "/dashboard/chat" },
          { id: "cv-mentions", title: "Mentions", url: "/dashboard/chat/mentions" },
          { id: "cv-participating", title: "Participating", url: "/dashboard/chat/participating" },
          { id: "cv-unattended", title: "Unattended", url: "/dashboard/chat/unattended" },
        ],
      },
      // V-6 (item 160.8): Comments sits inside the Inbox between Conversations and Calls.
      { id: "cw-comments", title: "Comments", url: "/dashboard/comments", icon: MessagesSquare },
      // T-53: Calls moved here from Helpdesk, inside the Inbox.
      { id: "cw-calls", title: "Calls", url: "/dashboard/calls", icon: Phone },
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
  // T-58: Help Center and Settings moved to the footer group below.
  {
    id: 1,
    label: "Helpdesk",
    items: [
      {
        id: "cw-captain",
        subnav: true,
        title: "Captain",
        icon: Bot,
        preview: ["cp-overview", "cp-inboxes", "cp-documents", "cp-faqs", "cp-scenarios", "cp-playground"],
        // T-284 (item 125.6): Inboxes second in the bar (Fahad). FAQs are the assistant's knowledge, made from the
        // documents (faqs.tsx and documents.tsx subtitles), so they stay right after Documents; the rest keep their order.
        subItems: [
          { id: "cp-overview", title: "Overview", url: "/dashboard/captain" },
          { id: "cp-inboxes", title: "Inboxes", url: "/dashboard/captain/inboxes" },
          { id: "cp-documents", title: "Documents", url: "/dashboard/captain/documents" },
          { id: "cp-faqs", title: "FAQs", url: "/dashboard/captain/faqs" },
          { id: "cp-scenarios", title: "Scenarios", url: "/dashboard/captain/scenarios" },
          { id: "cp-playground", title: "Playground", url: "/dashboard/captain/playground" },
          { id: "cp-tools", title: "Tools", url: "/dashboard/captain/tools" },
          // T-89: the assistant's own settings (name, messages, audience, schedule), not the account Settings, whose
          // Captain page (models and features) is listed there.
          { id: "cp-settings", title: "Assistant settings", url: "/dashboard/captain/settings" },
        ],
      },
      {
        id: "contacts",
        subnav: true,
        title: "Contacts",
        icon: Contact,
        // T-122: no preview list, so the hover preview shows the fixed links below only (All Contacts), not the
        // segments and labels nav-main.tsx adds.
        subItems: [{ id: "ct-all", title: "All Contacts", url: "/dashboard/contacts" }],
      },
      {
        id: "cw-reports",
        subnav: true,
        title: "Reports",
        icon: BarChart3,
        preview: ["r-customer-path", "r-overview", "r-conversations", "r-inboxes", "r-teams", "r-agents", "r-csat"],
        subItems: [
          // T-101 (Fahad 21:21): the reports start with «مسار العميل». F-1 (Fahad 124.8, UI in English first): named
          // Customer Path, as everywhere else in the UI (chat/_components/customer-path.tsx CUSTOMER_PATH).
          { id: "r-customer-path", title: "Customer Path", url: "/dashboard/reports/customer-path" },
          { id: "r-overview", title: "Conversations overview", url: "/dashboard/reports/overview" },
          { id: "r-conversations", title: "Conversations", url: "/dashboard/reports/conversations" },
          { id: "r-inboxes", title: "Inbox", url: "/dashboard/reports/inboxes" },
          { id: "r-teams", title: "Team", url: "/dashboard/reports/teams" },
          { id: "r-agents", title: "Agents", url: "/dashboard/reports/agents" },
          { id: "r-labels", title: "Labels", url: "/dashboard/reports/labels" },
          { id: "r-csat", title: "CSAT", url: "/dashboard/reports/csat" },
          { id: "r-sla", title: "SLA", url: "/dashboard/reports/sla" },
          { id: "r-bot", title: "Bot", url: "/dashboard/reports/bot" },
        ],
      },
      // T-234 (item 88, Fahad: «Automation ... زر على شكل ايقونه تكون تحت التقارير»): its own icon right under Reports,
      // no longer in Settings. The list and the visual editor (/dashboard/automation/flow/<id>) both belong to it.
      // F-10 (Fahad 125.3: the lightning icon is replaced by one tied to its function): Chatwoot's own Automation icon,
      // i-lucide-repeat (components-next/sidebar/Sidebar.vue "Settings Automation", and automations in
      // app/helpers/super_admin/account_feature_icons.yml).
      { id: "cw-automation", title: "Automation", url: "/dashboard/automation", icon: Repeat },
      {
        id: "cw-campaigns",
        subnav: true,
        title: "Campaigns",
        icon: Megaphone,
        subItems: [
          { id: "cm-live-chat", title: "Live chat", url: "/dashboard/campaigns/live-chat" },
          { id: "cm-sms", title: "SMS", url: "/dashboard/campaigns/sms" },
          { id: "cm-whatsapp", title: "WhatsApp", url: "/dashboard/campaigns/whatsapp" },
          // M129-C (Fahad 129.3): every channel with its conditions; TikTok and Email say why they have no campaigns.
          { id: "cm-instagram", title: "Instagram", url: "/dashboard/campaigns/instagram" },
          { id: "cm-messenger", title: "Messenger", url: "/dashboard/campaigns/messenger" },
          { id: "cm-tiktok", title: "TikTok", url: "/dashboard/campaigns/tiktok" },
          { id: "cm-email", title: "Email", url: "/dashboard/campaigns/email" },
        ],
      },
    ],
  },
  // Studio's own pages after the helpdesk.
  // T-53 / F-17: shown or hidden by the owner in the Owner console (/super_admin), its default from
  // src/config/features.ts (off); nav-main.tsx withLiveLists drops the group while it is hidden.
  // T-58: Overview moved to the top, so the Dashboards heading shows only with E-commerce under it.
  {
    id: 2,
    label: "Dashboards",
    items: [{ id: "ecommerce", title: "E-commerce", url: "/dashboard/ecommerce", icon: ShoppingBag }],
  },
  // T-58: at the bottom of the main sidebar above the account menu, Settings above Help Center. Their sub items stay
  // in their inner bars (T-54).
  {
    id: 6,
    footer: true,
    items: [
      {
        id: "cw-settings",
        subnav: true,
        title: "Settings",
        icon: Settings,
        // T-102: keep account AI settings reachable here; assistant settings stay under Captain.
        preview: [
          "s-index",
          "s-account",
          "s-captain",
          "s-agents",
          "s-teams",
          "s-assignment",
          "s-inboxes",
          "s-templates",
          "s-labels",
          "s-attributes",
          "s-bots",
          "s-macros",
          "s-canned",
          "s-integrations",
        ],
        // م137 (Fahad 137, «ترتيب الاعدادات والاقسام … وفق القياس العالمي»): the same 22 links in seven headed parts,
        // as Front, Zendesk, Intercom and HubSpot group their settings. Chatwoot's order (Sidebar.vue v4.18.0, T-149)
        // is kept inside and between the parts; three links move to the part three or more of those products put
        // them in: Custom Roles to Team, Conversation Workflow and SLA to Conversations, Audit Logs to Security &
        // billing. All Settings stays first with no heading (item 123). The plan and its links: monitor-workers/
        // m137-settings/خطة.md. The index page (settings/_components/settings-nav.ts) lists the same parts.
        subItems: [
          { id: "s-index", title: "All Settings", url: "/dashboard/settings" },
          // Workspace settings; the personal Account menu opens /dashboard/settings/profile.
          { id: "s-account", title: "General Settings", url: "/dashboard/settings/account", group: "Workspace" },
          { id: "s-captain", title: "Captain", url: "/dashboard/captain/captain-settings", group: "Workspace" },
          // Agents and Custom Roles keep their distinct users/roles tab destinations.
          { id: "s-agents", title: "Agents", url: "/dashboard/users", group: "Team" },
          { id: "s-teams", title: "Teams", url: "/dashboard/settings/teams", group: "Team" },
          {
            id: "s-assignment",
            title: "Agent Assignment",
            url: "/dashboard/settings/assignment-policy",
            group: "Team",
          },
          { id: "s-custom-roles", title: "Custom Roles", url: "/dashboard/users?tab=roles", group: "Team" },
          { id: "s-inboxes", title: "Inboxes", url: "/dashboard/settings/inboxes", group: "Channels" },
          { id: "s-templates", title: "Templates", url: "/dashboard/settings/templates", group: "Channels" },
          { id: "s-labels", title: "Labels", url: "/dashboard/settings/labels", group: "Conversations" },
          // T-96: the stages of «مسار العميل». T-290 (Fahad 124.8): in English, as the conversation panel.
          {
            id: "s-customer-path",
            title: "Customer Path",
            url: "/dashboard/settings/customer-path",
            group: "Conversations",
          },
          {
            id: "s-attributes",
            title: "Custom Attributes",
            url: "/dashboard/settings/attributes",
            group: "Conversations",
          },
          {
            id: "s-workflow",
            title: "Conversation Workflow",
            url: "/dashboard/settings/conversation-workflow",
            group: "Conversations",
          },
          { id: "s-sla", title: "SLA", url: "/dashboard/settings/sla", group: "Conversations" },
          { id: "s-bots", title: "Bots", url: "/dashboard/settings/bots", group: "Agent tools" },
          { id: "s-macros", title: "Macros", url: "/dashboard/settings/macros", group: "Agent tools" },
          {
            id: "s-canned",
            title: "Canned Responses",
            url: "/dashboard/settings/canned-responses",
            group: "Agent tools",
          },
          {
            id: "s-integrations",
            title: "Integrations",
            url: "/dashboard/settings/integrations",
            group: "Apps & data",
          },
          // T-290 (Fahad 128.5, 128.6): imports and downloads in one place (HubSpot: Import & Export).
          { id: "s-data", title: "Import & Export", url: "/dashboard/settings/data", group: "Apps & data" },
          { id: "s-security", title: "Security", url: "/dashboard/settings/security", group: "Security & billing" },
          { id: "s-audit", title: "Audit Logs", url: "/dashboard/settings/audit-logs", group: "Security & billing" },
          { id: "s-billing", title: "Billing", url: "/dashboard/settings/billing", group: "Security & billing" },
        ],
      },
      {
        id: "cw-help-center",
        subnav: true,
        iconOnly: true,
        title: "Help Center",
        icon: BookOpen,
        subItems: [
          { id: "hc-articles", title: "Articles", url: "/dashboard/help-center" },
          { id: "hc-categories", title: "Categories", url: "/dashboard/help-center/categories" },
          { id: "hc-locales", title: "Locales", url: "/dashboard/help-center/locales" },
          { id: "hc-settings", title: "Help Center Settings", url: "/dashboard/help-center/settings" },
        ],
      },
    ],
  },
  // T-73: Fahad's «أخرى»: the last button of the main list, its pages listed when it is clicked. T-289 (item 124.8, UI
  // text in English first): named "More", as Slack names the same entry at the end of its left rail that lists the
  // pages not shown there ("Items you leave unchecked will appear when you hover over More in the sidebar",
  // https://slack.com/help/articles/212596808).
  {
    id: 3,
    label: "Pages",
    more: { id: "more", title: "More", icon: Ellipsis },
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
  // T-73: the Misc group (a disabled "Others" link to /dashboard/coming-soon) removed by Fahad's order; the page stays.
];

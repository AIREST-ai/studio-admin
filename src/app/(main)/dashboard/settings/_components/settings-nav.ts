import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Bot,
  Building2,
  CircleUser,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  Inbox,
  KeyRound,
  KeySquare,
  ListChecks,
  LockKeyhole,
  MessageSquareQuote,
  Palette,
  Puzzle,
  Repeat,
  Route,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Timer,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";

export interface SettingsLink {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
  // م137 round 2 item 8 (simulation: the search found only page names): what the page holds, so the Settings search
  // finds a page by its content (password, working hours, api, translate...).
  keywords?: string;
  // م137 round 2 item 8: a page that lives elsewhere, listed so it can be found from here (Automation, item 88).
  elsewhere?: string;
}

export interface SettingsGroup {
  label: string;
  // م137: one line under the part's title on the Settings index.
  description: string;
  items: SettingsLink[];
}

// م137 (Fahad 137, «ترتيب الاعدادات والاقسام … وفق القياس العالمي»): the same seven parts, in the same order, as the
// Settings inner bar (navigation/sidebar/sidebar-items.ts, each link's group). Chatwoot's order (Sidebar.vue v4.18.0,
// T-149) inside and between the parts; Custom Roles in Team, Conversation Workflow and SLA in Conversations, and Audit
// Logs in Security & billing, where three or more of Front, Zendesk, Intercom and HubSpot put them. Each part has a
// one-line description (Polaris annotated sections: short, not repeating the title). Plan: monitor-workers/
// m137-settings/خطة.md. Personal Profile Settings is reached from the verified Account menu, outside workspace
// settings. T-234 (item 88): Automation left Settings for its own icon under Reports in the main sidebar.
export const settingsGroups: SettingsGroup[] = [
  {
    label: "Workspace",
    description: "Your workspace's name, language, ID and AI.",
    items: [
      {
        title: "General Settings",
        url: "/dashboard/settings/account",
        icon: Building2,
        description: "Workspace name, language, email domain and account ID. Your own profile is in the account menu.",
        keywords:
          "account name, workspace name, site language, incoming email domain, support email, audio transcription, transcribe, account id, delete account, build",
      },
      {
        title: "Captain",
        url: "/dashboard/captain/captain-settings",
        icon: Sparkles,
        description: "Workspace-wide AI models and features.",
        keywords:
          "ai, models, editor features, assistant, co-pilot, copilot, audio transcription, help center search indexing, label suggestion, credits",
      },
    ],
  },
  {
    label: "Team",
    description: "Who works here, how they are grouped, how conversations reach them and what each may do.",
    items: [
      {
        title: "Agents",
        url: "/dashboard/users",
        icon: UserCog,
        description: "Invite agents and administrators and manage their access.",
        keywords: "users, people, teammates, invite, administrator, admin, role, availability, export",
      },
      {
        title: "Teams",
        url: "/dashboard/settings/teams",
        icon: Users,
        description: "Group agents by responsibility and assign conversations to them.",
        keywords: "groups, members, auto assign",
      },
      {
        title: "Agent Assignment",
        url: "/dashboard/settings/assignment-policy",
        icon: Shuffle,
        description: "How conversations get assigned, and how much each agent can take.",
        keywords: "assignment policy, round robin, balanced, capacity, fair distribution, trial assignment, routing",
      },
      {
        title: "Custom Roles",
        url: "/dashboard/users?tab=roles",
        icon: ShieldCheck,
        description: "Roles with exactly the permissions each person needs.",
        keywords: "roles, permissions, access, access reviews, import json",
      },
    ],
  },
  {
    label: "Channels",
    description: "The inboxes your customers write to, and the templates you send through them.",
    items: [
      {
        title: "Inboxes",
        url: "/dashboard/settings/inboxes",
        icon: Inbox,
        description: "Website, email, WhatsApp and every other channel you answer.",
        keywords:
          "channels, website, live chat, widget, email, whatsapp, instagram, facebook, messenger, sms, phone, api channel, business hours, working hours, availability, csat, satisfaction survey, pre chat form, greeting, collaborators, bot configuration, imap, smtp",
      },
      {
        title: "Templates",
        url: "/dashboard/settings/templates",
        icon: FileText,
        description: "WhatsApp and other message templates approved for outreach.",
        keywords: "whatsapp templates, message templates, meta approval, template library, sync templates",
      },
    ],
  },
  {
    label: "Conversations",
    description: "How conversations are labelled, staged and described, and the rules and targets they follow.",
    items: [
      {
        title: "Labels",
        url: "/dashboard/settings/labels",
        icon: Tag,
        description: "Categorize and prioritize conversations and leads.",
        keywords: "tags, tag, colors, sidebar",
      },
      // T-96: the stages of «مسار العميل», each with a colour dot. T-290 (Fahad 124.8, UI in English first): named
      // Customer Path, as in the conversation panel (chat/_components/customer-path.tsx CUSTOMER_PATH).
      {
        title: "Customer Path",
        url: "/dashboard/settings/customer-path",
        icon: Route,
        description: "The stages a customer moves through, in order, and adding more.",
        keywords: "stages, lifecycle, pipeline, funnel",
      },
      {
        title: "Custom Attributes",
        url: "/dashboard/settings/attributes",
        icon: SlidersHorizontal,
        description: "Extra details you track on contacts and conversations.",
        keywords: "fields, contact fields, conversation fields, properties",
      },
      {
        title: "Conversation Workflow",
        url: "/dashboard/settings/conversation-workflow",
        icon: Workflow,
        description: "Required attributes before resolving, and other workflow rules.",
        keywords: "auto-resolve, auto resolve, inactivity, required attributes, resolution, close conversations",
      },
      {
        title: "SLA",
        url: "/dashboard/settings/sla",
        icon: Timer,
        description: "Response and resolution time targets for your team.",
        keywords: "service level agreement, first response time, next response time, resolution time, business hours",
      },
    ],
  },
  {
    label: "Agent tools",
    description: "Bots, macros and saved replies that answer or act for your agents.",
    items: [
      {
        title: "Bots",
        url: "/dashboard/settings/bots",
        icon: Bot,
        description: "Agent bots that answer conversations before a human does.",
        keywords: "agent bots, webhook bot, chatbot",
      },
      {
        title: "Macros",
        url: "/dashboard/settings/macros",
        icon: ListChecks,
        description: "A set of actions an agent runs on a conversation in one click.",
        keywords: "actions, one click, quick actions",
      },
      {
        title: "Canned Responses",
        url: "/dashboard/settings/canned-responses",
        icon: MessageSquareQuote,
        description: "Saved reply templates agents insert with a short code.",
        keywords: "saved replies, snippets, quick replies, shortcode, shortcuts",
      },
      // م137 round 2 item 8: Automation stays in the main sidebar under Reports (Fahad, item 88: «Automation هذه توضع في
      // الاقونات الجانبيه … تحت التقارير»); Chatwoot lists it in Settings between Custom Attributes and Bots, so it is
      // listed here as a pointer to its own place, not as a Settings page. Not in the Settings bar.
      {
        title: "Automation",
        url: "/dashboard/automation",
        // F-10 (Fahad 125.3): Chatwoot's Automation icon, i-lucide-repeat (Sidebar.vue), not the lightning.
        icon: Repeat,
        description: "Rules and flows that act on conversations. Opens Automation in the main sidebar.",
        keywords: "automation, rules, triggers, workflows, flows, automation templates, dry run",
        elsewhere: "Main sidebar",
      },
    ],
  },
  {
    label: "Apps & data",
    description: "Connected apps, and the data you bring in or download.",
    items: [
      {
        title: "Integrations",
        url: "/dashboard/settings/integrations",
        icon: Puzzle,
        description: "Slack, webhooks, dashboard apps and other connected tools.",
        keywords:
          "apps, slack, webhooks, dashboard apps, linear, notion, shopify, openai, dialogflow, google translate, translate, leadsquared",
      },
      // T-290 (Fahad 128.5, 128.6): the one place for what is imported and downloaded, named as HubSpot's settings
      // page (Data Management > Import & Export); the contacts page no longer has its own Export or Import.
      {
        title: "Import & Export",
        url: "/dashboard/settings/data",
        icon: Database,
        description: "Import contacts and download your account data as CSV files.",
        keywords: "csv, import contacts, export, download, data, backup",
      },
    ],
  },
  {
    label: "Security & billing",
    description: "Sign-in security, the record of changes, and your plan.",
    items: [
      {
        title: "Security",
        url: "/dashboard/settings/security",
        icon: KeyRound,
        description: "Single sign-on and two-factor authentication.",
        keywords: "saml, sso, single sign-on, identity provider, login",
      },
      {
        title: "Audit Logs",
        url: "/dashboard/settings/audit-logs",
        icon: ClipboardList,
        description: "Who changed what in this account, and when.",
        keywords: "activity, history, changes, who changed, log",
      },
      {
        title: "Billing",
        url: "/dashboard/settings/billing",
        icon: CreditCard,
        description: "Plan, seats, invoices and payment method.",
        keywords: "subscription, plan, seats, invoices, payment, credits, buy credits, pricing, currency",
      },
    ],
  },
];

// م137 round 2 item 8 (simulation: password, notifications, signature and api found nothing): the signed-in person's
// own settings, found by the Settings search only. They are not a Settings page or a part of the bar: Fahad, item 54,
// «لا داعي … أن تكرر إعدادات الحساب … موجود زر البروفايل»; their place is the account menu (Account), as in Chatwoot
// (SidebarProfileMenu: Profile Settings). Each opens its tab of Profile Settings.
export const personalLinks: SettingsLink[] = [
  {
    title: "Profile",
    url: "/dashboard/settings/profile",
    icon: CircleUser,
    description: "Your name, display name, email and picture.",
    keywords: "profile, my profile, name, display name, email, avatar, picture, photo, account",
  },
  {
    title: "Preferences",
    url: "/dashboard/settings/profile?tab=preferences",
    icon: Palette,
    description: "Font size, interface language, message signature and the send-message key.",
    keywords: "preferences, font size, interface language, signature, message signature, hotkey, enter to send",
  },
  {
    title: "Password and two-factor authentication",
    url: "/dashboard/settings/profile?tab=security",
    icon: LockKeyhole,
    description: "Change your password, turn on two-factor authentication and sign out other sessions.",
    keywords: "password, change password, two-factor, 2fa, mfa, sessions, sign out, security",
  },
  {
    title: "Notifications",
    url: "/dashboard/settings/profile?tab=notifications",
    icon: BellRing,
    description: "Email and push notifications and audio alerts for your conversations.",
    keywords: "notifications, notification, email notifications, push notifications, audio alerts, sound",
  },
  {
    title: "Access Token",
    url: "/dashboard/settings/profile?tab=token",
    icon: KeySquare,
    description: "Your API access token for building an integration.",
    keywords: "api, api token, access token, token, developer, integration",
  },
];

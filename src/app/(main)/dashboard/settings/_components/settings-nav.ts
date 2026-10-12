import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  Inbox,
  KeyRound,
  ListChecks,
  MessageSquareQuote,
  Puzzle,
  ShieldCheck,
  Shuffle,
  Sparkles,
  SlidersHorizontal,
  Tag,
  Timer,
  UserCog,
  UserRound,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

export interface SettingsLink {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
}

export interface SettingsGroup {
  label: string;
  items: SettingsLink[];
}

// Same order as Chatwoot's settings sidebar (components-next/sidebar/Sidebar.vue); every link is an existing route.
// Profile Settings (Chatwoot opens it from the profile menu) is kept last because the Studio sidebar lists it here.
export const settingsGroups: SettingsGroup[] = [
  {
    label: "Account",
    items: [
      { title: "Account Settings", url: "/dashboard/settings/account", icon: Building2, description: "Name, language, email domain, auto-resolve and account ID." },
      { title: "Captain AI", url: "/dashboard/captain", icon: Sparkles, description: "Assistants, documents and FAQs that answer for your team." },
      { title: "Agents", url: "/dashboard/users", icon: UserCog, description: "Invite agents and administrators and manage their access." },
      { title: "Teams", url: "/dashboard/settings/teams", icon: Users, description: "Group agents by responsibility and assign conversations to them." },
      { title: "Agent Assignment", url: "/dashboard/settings/assignment-policy", icon: Shuffle, description: "How conversations get assigned, and how much each agent can take." },
      { title: "Inboxes", url: "/dashboard/settings/inboxes", icon: Inbox, description: "Website, email, WhatsApp and every other channel you answer." },
      { title: "WhatsApp Templates", url: "/dashboard/settings/templates", icon: FileText, description: "WhatsApp and other message templates approved for outreach." },
    ],
  },
  {
    label: "Conversations",
    items: [
      { title: "Labels", url: "/dashboard/settings/labels", icon: Tag, description: "Categorize and prioritize conversations and leads." },
      { title: "Custom Attributes", url: "/dashboard/settings/attributes", icon: SlidersHorizontal, description: "Extra details you track on contacts and conversations." },
      { title: "Automation", url: "/dashboard/settings/automation", icon: Zap, description: "Rules that act on conversations when events happen." },
      { title: "Agent Bots", url: "/dashboard/settings/bots", icon: Bot, description: "Agent bots that answer conversations before a human does." },
      { title: "Macros", url: "/dashboard/settings/macros", icon: ListChecks, description: "A set of actions an agent runs on a conversation in one click." },
      { title: "Canned Responses", url: "/dashboard/settings/canned-responses", icon: MessageSquareQuote, description: "Saved reply templates agents insert with a short code." },
    ],
  },
  {
    label: "Apps & data",
    items: [
      { title: "Integrations", url: "/dashboard/settings/integrations", icon: Puzzle, description: "Slack, webhooks, dashboard apps and other connected tools." },
      { title: "Data", url: "/dashboard/settings/data", icon: Database, description: "Import contacts and export your account data." },
      { title: "Audit Logs", url: "/dashboard/settings/audit-logs", icon: ClipboardList, description: "Who changed what in this account, and when." },
      { title: "Custom Roles", url: "/dashboard/users?tab=roles", icon: ShieldCheck, description: "Roles with exactly the permissions each person needs." },
      { title: "SLA", url: "/dashboard/settings/sla", icon: Timer, description: "Response and resolution time targets for your team." },
      { title: "Conversation Workflow", url: "/dashboard/settings/conversation-workflow", icon: Workflow, description: "Required attributes before resolving, and other workflow rules." },
    ],
  },
  {
    label: "Account security",
    items: [
      { title: "Security", url: "/dashboard/settings/security", icon: KeyRound, description: "Single sign-on and two-factor authentication." },
      { title: "Billing", url: "/dashboard/settings/billing", icon: CreditCard, description: "Plan, seats, invoices and payment method." },
      { title: "Profile Settings", url: "/dashboard/settings/profile", icon: UserRound, description: "Your name, avatar, signature, password and notifications." },
    ],
  },
];

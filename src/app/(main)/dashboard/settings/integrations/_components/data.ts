export interface Integration {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  href: string;
  mark: string;
  tone: string;
}

export const integrations: Integration[] = [
  {
    id: "webhook",
    name: "Webhooks",
    description:
      "Webhook events provide you the realtime information about what's happening in your account. You can make use of the webhooks to communicate the events to your favourite apps like Slack or Github. Click on Configure to set up your webhooks.",
    enabled: true,
    href: "/dashboard/settings/integrations/webhooks",
    mark: "WH",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    id: "dashboard_apps",
    name: "Dashboard Apps",
    description:
      "Dashboard Apps allow organizations to embed an application inside the dashboard to provide the context for customer support agents. This feature allows you to create an application independently and embed that to provide user information, their orders, or their previous payment history.",
    enabled: true,
    href: "/dashboard/settings/integrations/dashboard-apps",
    mark: "DA",
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    id: "openai",
    name: "OpenAI",
    description:
      "Leverage the power of large language models from OpenAI with the features such as reply suggestions, summarization, message rephrasing, spell-checking, and label classification.",
    enabled: true,
    href: "/dashboard/settings/integrations",
    mark: "AI",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Slack is a chat tool that brings all your communication together in one place. By integrating Slack, you can get notified of all the new conversations in your account right inside your Slack.",
    enabled: true,
    href: "/dashboard/settings/integrations/slack",
    mark: "SL",
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    id: "dialogflow",
    name: "Dialogflow",
    description:
      "Build chatbots using Dialogflow and connect them to your inbox quickly. Let the bots handle the queries before handing them off to a customer service agent.",
    enabled: false,
    href: "/dashboard/settings/integrations",
    mark: "DF",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    id: "google_translate",
    name: "Google Translate",
    description:
      "Make it easier for agents to translate messages by adding a Google Translate Integration. Google translate helps to identify the language automatically and convert it to the language chosen by the agent/account admin.",
    enabled: false,
    href: "/dashboard/settings/integrations",
    mark: "GT",
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    id: "linear",
    name: "Linear",
    description:
      "Create issues in Linear directly from your conversation window. Alternatively, link existing Linear issues for a more streamlined and efficient issue tracking process.",
    enabled: false,
    href: "/dashboard/settings/integrations",
    mark: "LN",
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    id: "notion",
    name: "Notion",
    description:
      "Integrate databases, documents and pages directly with Captain. Your agents can reference Notion content while replying to customers.",
    enabled: false,
    href: "/dashboard/settings/integrations",
    mark: "NO",
    tone: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
  },
  {
    id: "shopify",
    name: "Shopify",
    description:
      "Connect your Shopify store to access order details, customer information, and product data directly within your conversations and helps your support team provide faster, more contextual assistance to your customers.",
    enabled: true,
    href: "/dashboard/settings/integrations",
    mark: "SH",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "dyte",
    name: "Dyte",
    description:
      "Dyte is a product that integrates audio and video functionalities into your application. With this integration, your agents can start video/voice calls with your customers directly from Chatwoot.",
    enabled: false,
    href: "/dashboard/settings/integrations",
    mark: "DY",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    id: "leadsquared",
    name: "LeadSquared",
    description:
      "Sync your contacts and conversations with LeadSquared CRM. This integration automatically creates leads in LeadSquared when new contacts are added, and logs conversation activity to provide your sales team with complete context.",
    enabled: false,
    href: "/dashboard/settings/integrations",
    mark: "LS",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
];

export const webhookEvents = [
  { value: "conversation_created", label: "Conversation Created" },
  { value: "conversation_status_changed", label: "Conversation Status Changed" },
  { value: "conversation_updated", label: "Conversation Updated" },
  { value: "message_created", label: "Message created" },
  { value: "message_updated", label: "Message updated" },
  { value: "webwidget_triggered", label: "Live chat widget opened by the user" },
  { value: "contact_created", label: "Contact created" },
  { value: "contact_updated", label: "Contact updated" },
  { value: "conversation_typing_on", label: "Conversation Typing On" },
  { value: "conversation_typing_off", label: "Conversation Typing Off" },
  { value: "inbox_updated", label: "Inbox updated" },
];

export interface Webhook {
  id: number;
  name: string;
  url: string;
  events: string[];
}

export const webhooks: Webhook[] = [
  {
    id: 1,
    name: "Order desk sync",
    url: "https://hooks.qatarcart.qa/chatwoot/orders",
    events: ["conversation_created", "message_created", "contact_created"],
  },
  {
    id: 2,
    name: "CRM leads",
    url: "https://crm.alnoordental.ae/api/webhooks/leads",
    events: ["contact_created", "contact_updated"],
  },
  {
    id: 3,
    name: "Delivery status bot",
    url: "https://api.riyadhexpress.sa/v2/inbound/chat",
    events: ["message_created", "message_updated", "conversation_status_changed", "conversation_updated"],
  },
  {
    id: 4,
    name: "",
    url: "https://n8n.dohafit.qa/webhook/7c1e-support",
    events: ["conversation_created", "conversation_status_changed", "webwidget_triggered", "inbox_updated"],
  },
];

export interface DashboardApp {
  id: number;
  title: string;
  url: string;
}

export const dashboardApps: DashboardApp[] = [
  { id: 1, title: "Order history", url: "https://admin.qatarcart.qa/embed/orders" },
  { id: 2, title: "Loyalty points", url: "https://loyalty.alnoordental.ae/agent-view" },
  { id: 3, title: "Shipment tracker", url: "https://track.riyadhexpress.sa/embed" },
];

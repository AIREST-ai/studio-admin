// T-139: made-up conversations for the editor's dry run. They are not customers and nothing is sent: the dry run only
// reads them. Values are in Chatwoot's own form (keys, ids by position in the Settings lists, ISO country codes), with
// some fields left empty on purpose, because empty values are where Chatwoot's conditions surprise people.
import type { SampleConversation } from "./chatwoot";

export interface DrySample extends SampleConversation {
  /** One line for the dry-run list. */
  summary: string;
}

const contact = (fields: Partial<SampleConversation["contact"]> = {}): SampleConversation["contact"] => ({
  email: null,
  phone_number: null,
  additional_attributes: {},
  custom_attributes: {},
  ...fields,
});

// Inbox ids follow settings-data inboxNames: 1 Support Email, 2 Website Chat, 3 WhatsApp Business, 4 Instagram,
// 5 Facebook Page, 6 Phone, 7 SMS Alerts, 8 Mobile App API. Agent ids follow agentNames: 1 Arham Khan, 2 Priya Nair.
export const drySamples: DrySample[] = [
  {
    id: 9001,
    title: "Website chat in Arabic, nobody assigned",
    summary: "Open · Website Chat · browser Arabic · no labels",
    status: "open",
    inbox_id: 2,
    assignee_id: null,
    assignee_agent_bot_id: null,
    team_id: null,
    priority: null,
    labels: [],
    additional_attributes: {
      browser_language: "ar",
      conversation_language: "ar",
      referer: "https://airest.ai/pricing",
    },
    custom_attributes: { order_number: "A-1042" },
    contact: contact({
      email: "noura@example.com",
      phone_number: "+97455012345",
      additional_attributes: { country_code: "QA", company_name: "Noura Trading" },
      custom_attributes: { subscription_plan: "Basic" },
    }),
    messages: [{ message_type: "incoming", private: false, content: "السلام عليكم، أريد معرفة الأسعار" }],
  },
  {
    id: 9002,
    title: "Refund request by email",
    summary: "Open · Support Email · billing · High · Priya Nair",
    status: "open",
    inbox_id: 1,
    assignee_id: 2,
    assignee_agent_bot_id: null,
    team_id: null,
    priority: "high",
    labels: ["billing"],
    additional_attributes: { mail_subject: "Invoice 2291 refund" },
    custom_attributes: {},
    contact: contact({ email: "m.rahman@example.com", additional_attributes: { country_code: "AE" } }),
    messages: [{ message_type: "incoming", private: false, content: "I need a refund for invoice 2291" }],
  },
  {
    id: 9003,
    title: "VIP on WhatsApp, waiting for us",
    summary: "Pending · WhatsApp Business · vip · Urgent · Arham Khan",
    status: "pending",
    inbox_id: 3,
    assignee_id: 1,
    assignee_agent_bot_id: null,
    team_id: null,
    priority: "urgent",
    labels: ["vip"],
    additional_attributes: {},
    custom_attributes: {},
    contact: contact({
      phone_number: "+97433112233",
      additional_attributes: { country_code: "QA" },
      custom_attributes: { subscription_plan: "Family" },
    }),
    messages: [
      { message_type: "outgoing", private: false, content: "We are checking your order now." },
      { message_type: "incoming", private: false, content: "Any update?" },
    ],
  },
  {
    id: 9004,
    title: "Resolved, photo only, no contact details",
    summary: "Resolved · Instagram · no labels · no priority · empty email",
    status: "resolved",
    inbox_id: 4,
    assignee_id: null,
    assignee_agent_bot_id: null,
    team_id: null,
    priority: null,
    labels: [],
    additional_attributes: {},
    custom_attributes: {},
    contact: contact(),
    messages: [{ message_type: "incoming", private: false, content: null }],
  },
  {
    id: 9005,
    title: "Snoozed lead from the UAE",
    summary: "Snoozed · Facebook Page · lead · Medium · private note last",
    status: "snoozed",
    inbox_id: 5,
    assignee_id: null,
    assignee_agent_bot_id: null,
    team_id: null,
    priority: "medium",
    labels: ["lead"],
    additional_attributes: { browser_language: "en" },
    custom_attributes: {},
    contact: contact({
      email: "sales@gulf-example.ae",
      additional_attributes: { country_code: "AE", company_name: "Gulf Example" },
    }),
    messages: [
      { message_type: "incoming", private: false, content: "Please call me on Sunday" },
      { message_type: "outgoing", private: true, content: "Call back Sunday" },
    ],
  },
  {
    id: 9006,
    title: "App user handled by a bot",
    summary: "Open · Mobile App API · support, متابعة · bot assigned",
    status: "open",
    inbox_id: 8,
    assignee_id: null,
    assignee_agent_bot_id: 1,
    team_id: null,
    priority: "low",
    labels: ["support", "متابعة"],
    additional_attributes: { conversation_language: "en" },
    custom_attributes: {},
    contact: contact({ email: "user42@example.com" }),
    messages: [{ message_type: "incoming", private: false, content: "The app crashes on login" }],
  },
];

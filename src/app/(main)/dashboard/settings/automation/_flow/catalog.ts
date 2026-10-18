// T-139: the Automation catalog (events, condition fields, operators, actions, wait triggers and the form's checks),
// moved here unchanged from _components/rule-form.tsx so the text form and the visual editor read ONE copy.
// Plain data and functions only (no React), so the converter tests can load it outside the browser.
// F-6B: agents, teams, inboxes, labels and SLAs are read through pickerNames() each time a field's options are read
// (getters below), so the editor and the text form offer the live lists (labels/_shared/live-picker-names.ts), and
// the checks that compare a value with the options accept a team or label added since the page loaded.
import {
  countryNames,
  languageNames,
  pickerNames,
  priorityNames,
  statusNames,
} from "../../labels/_shared/settings-data";
import { CALENDAR_ACTION, specError } from "./calendar-event";
import { kindOfAction, workError } from "./work-actions";

export type RunType = "instant" | "delayed";
export type EventKey =
  | "conversation_created"
  | "conversation_updated"
  | "conversation_resolved"
  | "message_created"
  | "conversation_opened";
export type Trigger = "conversation_status" | "customer_unresponsive" | "agent_unresponsive";
export type InputType = "search_select" | "multi_select" | "plain_text" | "multi_text" | "key_value" | "none";

export interface Condition {
  attribute: string;
  operator: string;
  values: string[];
  join: "and" | "or";
}

/** M129-B: a file uploaded to this preview (files/route.ts), as the action keeps it. */
export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export type MediaType = "image" | "video" | "voice" | "document" | "contact" | "location";

/** M129-B: what "Send Attachment" sends. A file type keeps the uploaded file (and, for an image too large or in a
 * format a channel refuses, the copy the browser compressed); a contact card or a location keeps its fields. */
export interface MediaSpec {
  type: MediaType;
  file?: StoredFile;
  compressed?: StoredFile & { width: number; height: number; quality: number };
  caption?: string;
  contact?: { name: string; phone: string };
  location?: { latitude: string; longitude: string; name: string; address: string };
}

export interface Action {
  action: string;
  values: string[];
  message?: string;
  media?: MediaSpec;
}

export interface Rule {
  id: number;
  name: string;
  description: string;
  active: boolean;
  createdOn: string;
  runType: RunType;
  event: EventKey;
  conditions: Condition[];
  actions: Action[];
  wait?: { trigger: Trigger; status: string; amount: number; unit: "minutes" | "hours" | "days"; inboxes: string[] };
}

export const eventLabels: Record<EventKey, string> = {
  conversation_created: "Conversation Created",
  conversation_updated: "Conversation Updated",
  conversation_resolved: "Conversation Resolved",
  message_created: "Message Created",
  conversation_opened: "Conversation Opened",
};

export const OP1 = ["Equal to", "Not equal to"];
export const OP2 = ["Equal to", "Not equal to", "Contains", "Does not contain"];
export const OP3 = ["Equal to", "Not equal to", "Is present", "Is not present"];
export const OP6 = ["Equal to", "Not equal to", "Contains", "Does not contain", "Starts With"];

export const attributeDefs: Record<
  string,
  { label: string; input: InputType; ops: string[]; options?: string[]; sim?: true; hint?: string }
> = {
  message_type: {
    label: "Message Type",
    input: "search_select",
    ops: OP1,
    options: ["Incoming Message", "Outgoing Message"],
  },
  private_note: { label: "Private Note", input: "search_select", ops: OP1, options: ["True", "False"] },
  content: { label: "Message Content", input: "multi_text", ops: OP2 },
  email: { label: "Email", input: "plain_text", ops: OP2 },
  inbox_id: {
    label: "Inbox",
    input: "multi_select",
    ops: OP1,
    get options() {
      return pickerNames().inboxes;
    },
  },
  status: { label: "Status", input: "multi_select", ops: OP1, options: statusNames },
  assignee_id: {
    label: "Assignee",
    input: "search_select",
    ops: OP3,
    get options() {
      return pickerNames().agents;
    },
  },
  team_id: {
    label: "Team",
    input: "search_select",
    ops: OP3,
    get options() {
      return pickerNames().teams;
    },
  },
  priority: { label: "Priority", input: "multi_select", ops: OP1, options: priorityNames },
  conversation_language: { label: "Conversation Language", input: "multi_select", ops: OP1, options: languageNames },
  phone_number: { label: "Phone Number", input: "plain_text", ops: OP6 },
  company_name: { label: "Company", input: "plain_text", ops: OP2 },
  labels: {
    label: "Labels",
    input: "multi_select",
    ops: OP3,
    get options() {
      return pickerNames().labels;
    },
  },
  browser_language: { label: "Browser Language", input: "search_select", ops: OP1, options: languageNames },
  mail_subject: { label: "Email Subject", input: "plain_text", ops: OP2 },
  country_code: { label: "Country", input: "search_select", ops: OP1, options: countryNames },
  referer: { label: "Referrer Link", input: "plain_text", ops: OP2 },
  // Custom attributes are appended by Chatwoot under their own group (Settings > Custom Attributes).
  "conversation.order_number": { label: "Order number", input: "plain_text", ops: OP2 },
  "conversation.delivery_city": {
    label: "Delivery city",
    input: "search_select",
    ops: OP1,
    options: ["Doha", "Al Wakrah", "Lusail", "Dubai", "Riyadh"],
  },
  "contact.subscription_plan": {
    label: "Subscription plan",
    input: "search_select",
    ops: OP1,
    options: ["Basic", "Plus", "Family"],
  },
  "contact.preferred_language": {
    label: "Preferred language",
    input: "search_select",
    ops: OP1,
    options: ["Arabic", "English"],
  },
  // M129-B: fields only the Studio simulator reads (Chatwoot v4.18 has none of them: bahth-129 section 2). A flow that
  // checks one of them runs in the simulator. sim-engine.ts evaluates them.
  contact_type: {
    label: "Contact is",
    input: "search_select",
    ops: OP1,
    options: ["New contact", "Returning contact"],
    sim: true,
    hint: "New = this contact never wrote to us before; returning = they did (ManyChat's “New contact” rule).",
  },
  business_hours: {
    label: "Business hours",
    input: "search_select",
    ops: ["Within business hours of", "Outside business hours of"],
    get options() {
      return pickerNames().inboxes;
    },
    sim: true,
    hint: "Uses the Business Hours saved for that inbox in Settings > Inboxes, as the engine keeps hours per inbox.",
  },
  message_intent: {
    label: "Marketing message (keywords)",
    input: "multi_text",
    ops: ["Has a marketing keyword", "Has no marketing keyword"],
    sim: true,
    hint: "In this preview a message counts as marketing when it contains one of these keywords (keyword classification, not AI).",
  },
  channel_type: {
    label: "Channel",
    input: "multi_select",
    ops: OP1,
    options: ["WhatsApp", "Instagram", "Messenger", "TikTok", "Telegram", "Email", "Website chat"],
    sim: true,
  },
  folder: {
    label: "Folder",
    input: "search_select",
    ops: ["Is in folder", "Is not in folder"],
    options: [],
    sim: true,
    hint: "Folders are the saved filters of Conversations; the simulator checks the conversation against the folder's filters.",
  },
  reply_window: {
    label: "Reply window",
    input: "none",
    ops: ["Is open", "Is closed"],
    sim: true,
    hint: "WhatsApp, Instagram and Messenger: 24 hours after the customer's last message; TikTok: 48 hours. Email, website chat and Telegram have none.",
  },
  event_detail: {
    label: "Event detail",
    input: "plain_text",
    ops: ["Equal to", "Not equal to", "Contains"],
    sim: true,
  },
  contact_attr: {
    label: "Contact field",
    input: "key_value",
    ops: ["Equal to", "Not equal to", "Is present", "Is not present"],
    sim: true,
  },
};

/** M129-B: the simulator's fields, offered in their own group after Chatwoot's. */
export const simConditionKeys = Object.keys(attributeDefs).filter((key) => attributeDefs[key].sim);

// constants.js AUTOMATIONS[event].conditions
export const eventConditions: Record<EventKey, string[]> = {
  message_created: [
    "message_type",
    "private_note",
    "content",
    "email",
    "inbox_id",
    "status",
    "assignee_id",
    "team_id",
    "priority",
    "conversation_language",
    "phone_number",
    "company_name",
    "labels",
  ],
  conversation_created: [
    "status",
    "browser_language",
    "mail_subject",
    "country_code",
    "phone_number",
    "company_name",
    "referer",
    "email",
    "inbox_id",
    "conversation_language",
    "priority",
    "labels",
  ],
  conversation_updated: [
    "status",
    "browser_language",
    "mail_subject",
    "country_code",
    "referer",
    "phone_number",
    "company_name",
    "assignee_id",
    "team_id",
    "email",
    "inbox_id",
    "conversation_language",
    "priority",
    "labels",
  ],
  conversation_opened: [
    "browser_language",
    "email",
    "mail_subject",
    "country_code",
    "referer",
    "assignee_id",
    "phone_number",
    "company_name",
    "team_id",
    "inbox_id",
    "conversation_language",
    "priority",
    "labels",
  ],
  conversation_resolved: [
    "browser_language",
    "email",
    "mail_subject",
    "country_code",
    "referer",
    "assignee_id",
    "phone_number",
    "company_name",
    "team_id",
    "inbox_id",
    "conversation_language",
    "priority",
  ],
};
export const customConditions = {
  conversation: ["conversation.order_number", "conversation.delivery_city"],
  contact: ["contact.subscription_plan", "contact.preferred_language"],
};

export type ActionInput =
  | "search_select"
  | "multi_select"
  | "team_message"
  | "email"
  | "url"
  | "attachment"
  | "textarea"
  | "key_value"
  | "calendar_event"
  | "twenty_task"
  | "invoice_draft"
  | "teammate_notify"
  | null;

// constants.js AUTOMATION_ACTION_TYPES (labels from automation.json ACTIONS)
export const actionDefs: Record<string, { label: string; input: ActionInput; options?: string[]; sim?: true }> = {
  assign_agent: {
    label: "Assign to Agent",
    input: "search_select",
    get options() {
      return ["None", "Last Responding Agent", ...pickerNames().agents];
    },
  },
  assign_team: {
    label: "Assign a Team",
    input: "search_select",
    get options() {
      return ["None", ...pickerNames().teams];
    },
  },
  remove_assigned_agent: { label: "Remove Assigned Agent", input: null },
  remove_assigned_team: { label: "Remove Assigned Team", input: null },
  add_label: {
    label: "Add a Label",
    input: "multi_select",
    get options() {
      return pickerNames().labels;
    },
  },
  remove_label: {
    label: "Remove a Label",
    input: "multi_select",
    get options() {
      return pickerNames().labels;
    },
  },
  send_email_to_team: {
    label: "Send an Email to Team",
    input: "team_message",
    get options() {
      return pickerNames().teams;
    },
  },
  send_email_transcript: { label: "Send an Email Transcript", input: "email" },
  mute_conversation: { label: "Mute Conversation", input: null },
  snooze_conversation: { label: "Snooze Conversation", input: null },
  resolve_conversation: { label: "Resolve Conversation", input: null },
  open_conversation: { label: "Open conversation", input: null },
  pending_conversation: { label: "Mark conversation as pending", input: null },
  send_webhook_event: { label: "Send Webhook Event", input: "url" },
  send_attachment: { label: "Send Attachment", input: "attachment" },
  send_message: { label: "Send a Message", input: "textarea" },
  add_private_note: { label: "Add a Private Note", input: "textarea" },
  change_priority: { label: "Change Priority", input: "search_select", options: priorityNames },
  add_sla: {
    label: "Add SLA",
    input: "search_select",
    get options() {
      return pickerNames().slas;
    },
  },
  // M129-B: actions only the Studio simulator runs (bahth-129 section 2: not among Chatwoot's 19).
  update_contact_field: { label: "Update a contact field", input: "key_value", sim: true },
  send_template: { label: "Send an approved message template", input: "search_select", options: [], sim: true },
  assign_strategy: {
    label: "Assign by strategy",
    input: "search_select",
    options: [
      "Round robin",
      "Round robin, online teammates only",
      "Fewest open conversations",
      "Fewest open conversations, online teammates only",
    ],
    sim: true,
  },
  // M129-G (item 129.8): makes an event in the Calendar page's calendar server, Davis (calendar-event.ts).
  create_calendar_event: { label: "Create calendar event", input: "calendar_event", sim: true },
  // F-11 (Fahad L6, item 91): a task on the Tasks page (Twenty), a draft on Invoices (Bigcapital), a notification in the
  // bell (the activity log). Fields and checks in work-actions.ts; standards and sources in sim-catalog.ts.
  create_twenty_task: { label: "Create task", input: "twenty_task", sim: true },
  create_invoice_draft: { label: "Create draft invoice", input: "invoice_draft", sim: true },
  notify_teammate: { label: "Notify a teammate", input: "teammate_notify", sim: true },
};

/** M129-B: the contact fields the simulator's "Update a contact field" and "Contact field" offer first. */
export const contactFieldKeys = ["name", "email", "phone_number", "preferred_language", "subscription_plan"];

export const triggerLabels: Record<Trigger, string> = {
  conversation_status: "Conversation stays in a status",
  customer_unresponsive: "Customer hasn't replied",
  agent_unresponsive: "No teammate has replied",
};

export function explanation(trigger: Trigger, duration: string) {
  if (trigger === "conversation_status")
    return `The clock starts when a conversation moves into this status. If it is still there ${duration} later, the actions below run. If the status changes before then, nothing happens.`;
  if (trigger === "customer_unresponsive")
    return `The clock starts when a teammate replies. If the customer hasn't written back ${duration} later, the actions below run. If they do reply, nothing happens, and the next teammate reply starts the clock again.`;
  return `The clock starts when a customer sends a message. If no teammate has replied ${duration} later, the actions below run. If someone replies before then, nothing happens.`;
}

export function durationText(amount: number, unit: string) {
  const one = unit.replace(/s$/, "");
  return `${amount} ${amount === 1 ? one : unit}`;
}

export const minutesPer = { minutes: 1, hours: 60, days: 1440 } as const;

export function blankCondition(event: EventKey): Condition {
  const attribute = eventConditions[event][0];
  return { attribute, operator: attributeDefs[attribute].ops[0], values: [], join: "and" };
}
export const blankAction = (): Action => ({ action: "assign_agent", values: [] });

export const noValueOps = ["Is present", "Is not present", "Is open", "Is closed"];

export function conditionError(c: Condition) {
  if (!c.attribute) return "Attribute key is required";
  if (!c.operator) return "Filter operator is required";
  // M129-B: "Contact field" needs the field's name, and a value unless it only checks presence
  if (attributeDefs[c.attribute]?.input === "key_value") {
    if (!c.values[0]?.trim()) return "Choose the contact field";
    if (!noValueOps.includes(c.operator) && !c.values[1]?.trim()) return "Value is required";
    return "";
  }
  if (!noValueOps.includes(c.operator) && !c.values.filter(Boolean).length) return "Value is required";
  return "";
}
export function actionError(a: Action) {
  // M129-B: the attachment is uploaded to this preview (files/route.ts) and checked per channel (media.ts)
  if (a.action === "send_attachment") return mediaError(a.media);
  // M129-G: title, calendar, day and time of the event (calendar-event.ts)
  if (a.action === CALENDAR_ACTION) return specError(a.values);
  // F-11: task, draft invoice and notification (work-actions.ts)
  if (kindOfAction(a.action)) return workError(a.action, a.values);
  const input = actionDefs[a.action]?.input;
  if (!input) return "";
  if (input === "team_message") return a.values.length && a.message?.trim() ? "" : "Action parameters are required";
  if (input === "key_value") {
    if (!a.values[0]?.trim()) return "Choose the contact field";
    return a.values[1]?.trim() ? "" : "Enter the new value";
  }
  return a.values.filter(Boolean).length ? "" : "Action parameters are required";
}

/** What is missing before an attachment can be sent ("" when nothing is). */
export function mediaError(media: MediaSpec | undefined) {
  if (!media) return "Choose what to send: image, video, voice note, document, contact card or location";
  if (media.type === "contact")
    return media.contact?.name.trim() && media.contact.phone.trim() ? "" : "Enter the contact's name and phone number";
  if (media.type === "location") {
    const lat = Number(media.location?.latitude);
    const lng = Number(media.location?.longitude);
    if (!media.location?.latitude.trim() || !media.location.longitude.trim()) return "Enter the latitude and longitude";
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return "Latitude must be between -90 and 90";
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return "Longitude must be between -180 and 180";
    return "";
  }
  return media.file ? "" : "Upload the file to send";
}

// F-10 (Fahad, item 51b, 14 Oct 01:23:54: «الاشعارات تكون للنظام التسجيل التغيير الموافقات اشعارات عامه بكل شيئ»):
// the bell also shows System, Sign-ups, Changes and Approvals notifications. They are made from real events only: the
// preview's activity log (Retraced, M129-E: every saved change and every failed request is an event there) and the
// preview server's checks of the services it uses. Nothing here is invented: no event, no notification.
//
// The model is Chatwoot's (app/models/notification.rb: one notification per event, a notification_type shown as its
// label, INBOX.TYPES_NEXT, and a primary actor it links to; read_at = read / unread). Chatwoot has no type for these
// kinds, so the four categories are Fahad's own words, and each row carries its category and type label.
//
// Pure functions only (no server imports): the route (app/api/notifications-feed) and the tests use them.

/** Notifications start when this feature went live: older log events never raised one (as in Chatwoot, a type
 *  added later does not notify about the past). */
export const FEED_START = "2026-10-15T11:00:00Z";

/** Feed ids sit above the My Inbox seed ids (1, 2, …), so both live in the same saved "notifications" section. */
export const FEED_ID_BASE = 1_000_000_000;

/** How many feed notifications the bell keeps (newest first). */
export const FEED_LIMIT = 60;

// F-11 (Fahad L6, item 91): "automation" holds the notifications an automation flow sends to a teammate ("Notify a
// teammate", app/api/automation-notify). They are messages for a person, not settings changes, so they get their own.
export type FeedCategory = "system" | "signup" | "change" | "approval" | "automation";

export const CATEGORY_LABELS: Record<FeedCategory, string> = {
  system: "System",
  signup: "Sign-ups",
  change: "Changes",
  approval: "Approvals",
  automation: "Automation",
};

export interface FeedNotification {
  id: number;
  eventId: string;
  category: FeedCategory;
  /** Like Chatwoot's TYPES_NEXT label: "Service down", "New agent", "Automation rule created"… */
  type: string;
  /** The log's own sentence, e.g. 'Arham Khan added the agent "zzf Agent"'. */
  text: string;
  /** ISO time of the event. */
  time: string;
  /** Where it happened. */
  href: string;
  /** F-10b: true for good news, a service answering again ("Service back up"). It is drawn with the success icon
   *  (Chatwoot's healthy mark), not the warning one. Absent otherwise. */
  ok?: true;
}

/** The fields of a Retraced event this file reads (lib/audit/retraced.ts RetracedEvent). */
export interface FeedEvent {
  id: string;
  action: string;
  created: string;
  description: string | null;
  is_failure: boolean | null;
  target: { id: string; name: string | null; type: string | null } | null;
  fields: { key: string; value: string }[] | null;
}

// ---- services the preview server uses -----------------------------------------------------------------------

export interface ServiceInfo {
  id: "retraced" | "bigcapital" | "twenty" | "davis";
  name: string;
  /** The page that needs it. */
  href: string;
}

// F-16 (Fahad 15 Oct 15:05): the bell's "Service down" / "Service back up" lines name each service by what it does,
// never the ready-made system behind it. Lines recorded earlier with the old names are shown the same way
// (lib/own-names.ts, applied by /api/notifications-feed).
export const SERVICES: ServiceInfo[] = [
  { id: "retraced", name: "Audit log", href: "/dashboard/settings/audit-logs" },
  { id: "bigcapital", name: "Invoices", href: "/dashboard/invoice" },
  { id: "twenty", name: "Tasks", href: "/dashboard/tasks" },
  { id: "davis", name: "Calendar", href: "/dashboard/calendar" },
];

export interface ServiceCheck {
  id: ServiceInfo["id"];
  ok: boolean;
  error: string | null;
}

/**
 * What to record after a check: a service that is down and was not already recorded down gets "service.down"; one
 * that answers again after a recorded "service.down" gets "service.up". `last` is the newest recorded state per
 * service (from the log); a service never recorded is taken as up.
 */
export function serviceTransitions(
  last: Map<string, "down" | "up">,
  checks: ServiceCheck[],
): { id: ServiceInfo["id"]; to: "down" | "up"; error: string | null }[] {
  const out: { id: ServiceInfo["id"]; to: "down" | "up"; error: string | null }[] = [];
  for (const check of checks) {
    const before = last.get(check.id) ?? "up";
    if (!check.ok && before !== "down") out.push({ id: check.id, to: "down", error: check.error });
    if (check.ok && before === "down") out.push({ id: check.id, to: "up", error: null });
  }
  return out;
}

// ---- which log events notify, and where they link --------------------------------------------------------------

/** Settings objects whose create / update / delete is a "Changes" notification, with the page that holds them and
 *  the name shown in the type label. */
const OBJECTS: Record<string, { name: string; href: string }> = {
  account: { name: "Account settings", href: "/dashboard/settings/account" },
  agent: { name: "Agent", href: "/dashboard/users" },
  agent_bot: { name: "Bot", href: "/dashboard/settings/bots" },
  assignment_policy: { name: "Assignment policy", href: "/dashboard/settings/assignment-policy" },
  automation_flow: { name: "Automation flow", href: "/dashboard/automation" },
  automation_rule: { name: "Automation rule", href: "/dashboard/automation" },
  billing: { name: "Billing", href: "/dashboard/settings/billing" },
  canned_response: { name: "Canned response", href: "/dashboard/settings/canned-responses" },
  capacity_policy: { name: "Capacity policy", href: "/dashboard/settings/assignment-policy" },
  captain_settings: { name: "Captain settings", href: "/dashboard/captain/captain-settings" },
  conversation_workflow: { name: "Conversation workflow", href: "/dashboard/settings/conversation-workflow" },
  customer_path_stage: { name: "Customer Path stage", href: "/dashboard/settings/customer-path" },
  dashboard_app: { name: "Dashboard app", href: "/dashboard/settings/integrations" },
  inbox: { name: "Inbox", href: "/dashboard/settings/inboxes" },
  integration: { name: "Integration", href: "/dashboard/settings/integrations" },
  integration_hook: { name: "Integration", href: "/dashboard/settings/integrations" },
  label: { name: "Label", href: "/dashboard/settings/labels" },
  macro: { name: "Macro", href: "/dashboard/settings/macros" },
  mfa: { name: "Two-factor authentication", href: "/dashboard/settings/profile/mfa" },
  profile: { name: "Profile", href: "/dashboard/settings/profile" },
  saml: { name: "SAML", href: "/dashboard/settings/security" },
  // F-17 (T-91): the owner shows or hides a section for the whole site in the Owner console (app/api/owner-console):
  // "Site section turned on" / "Site section turned off".
  site_section: { name: "Site section", href: "/super_admin" },
  sla_policy: { name: "SLA policy", href: "/dashboard/settings/sla" },
  slack_integration: { name: "Slack integration", href: "/dashboard/settings/integrations" },
  team: { name: "Team", href: "/dashboard/settings/teams" },
  webhook: { name: "Webhook", href: "/dashboard/settings/integrations" },
  whatsapp_template: { name: "WhatsApp template", href: "/dashboard/settings/templates" },
};

/** Pages of other actions, for failures (a failed request links to where it was made). */
const FAILURE_PAGES: Record<string, string> = {
  settings_preview_mfa: "/dashboard/settings/profile/mfa",
  conversation: "/dashboard/chat",
  conversation_panel: "/dashboard/chat",
  contact: "/dashboard/contacts",
  campaign: "/dashboard/campaigns/live-chat",
  invoice: "/dashboard/invoice",
  invoice_customer: "/dashboard/invoice",
  invoice_business: "/dashboard/invoice",
  task: "/dashboard/tasks",
};

/** Retraced structured search (action:a.*,b.* is an OR of prefixes; src/models/event/filter.ts). */
export const FEED_ACTION_QUERY = `action:${["service", "automation_notify", ...Object.keys(OBJECTS)].map((p) => `${p}.*`).join(",")}`;

const VERBS: Record<string, string> = {
  create: "created",
  delete: "deleted",
  update: "updated",
  save: "updated",
  settings_update: "updated",
  member_add: "member added",
  member_remove: "member removed",
  role_change: "role changed",
  enable: "turned on",
  disable: "turned off",
  restore: "restored",
  upload: "uploaded",
};

const field = (event: FeedEvent, key: string) => event.fields?.find((f) => f.key === key)?.value ?? null;

/** First value of a top-level key in a logged JSON value (the log keeps them as text, sometimes cut at 3000 chars). */
function jsonValue(text: string | null, key: string): string | null {
  if (!text) return null;
  const match = new RegExp(`"${key}":("([^"\\\\]*)"|true|false)`).exec(text);
  if (!match) return null;
  return match[2] ?? match[1];
}

/** A whole number from the event id, above FEED_ID_BASE and below 2^53 (Retraced ids are 32 hex characters). */
export function feedId(eventId: string): number {
  const hex = eventId.replace(/[^0-9a-f]/gi, "").slice(0, 12);
  if (hex.length === 12) return FEED_ID_BASE + Number.parseInt(hex, 16);
  let hash = 2166136261; // FNV-1a, for an id that is not hex
  for (let i = 0; i < eventId.length; i++) hash = Math.imul(hash ^ eventId.charCodeAt(i), 16777619) >>> 0;
  return FEED_ID_BASE + hash;
}

const failureStatus = (event: FeedEvent) => /^failed: (\d{3})/.exec(field(event, "result") ?? "")?.[1] ?? null;

/** The notification an event raises, or null when it raises none. */
export function toFeedNotification(event: FeedEvent): FeedNotification | null {
  const [prefix, ...rest] = event.action.split(".");
  const verb = rest.join(".");
  const text = (event.description ?? event.action).trim();
  const base = { id: feedId(event.id), eventId: event.id, time: event.created, text };

  if (prefix === "service") {
    const service = SERVICES.find((s) => s.id === event.target?.id);
    return {
      ...base,
      category: "system",
      type: verb === "down" ? "Service down" : "Service back up",
      href: service?.href ?? "/dashboard/settings/audit-logs",
      ...(verb === "down" ? {} : { ok: true as const }),
    };
  }

  // Any request the preview refused or could not finish (409 changed elsewhere, 4xx, 5xx): the simulation failed.
  if (event.is_failure) {
    const status = failureStatus(event);
    const reason = (field(event, "result") ?? "").replace(/^failed: \d{3}\s*/, "");
    return {
      ...base,
      category: "system",
      type: "Simulation failed",
      text: `${text}${status ? ` (${status}${reason ? `: ${reason}` : ""})` : ""}`.replace(/^Failed \(\d{3}\): /, ""),
      href: OBJECTS[prefix]?.href ?? FAILURE_PAGES[prefix] ?? "/dashboard/settings/audit-logs",
    };
  }

  // F-11: "Notify a teammate" of an automation flow, sent from its dry run: the notification itself ('Arham Khan sent
  // the notification of the automation flow "…" to the agent "…": "…"'), linked to that flow when it is saved.
  if (prefix === "automation_notify") {
    const flowId = jsonValue(field(event, "after"), "flowId");
    return {
      ...base,
      category: "automation",
      type: "Automation notification",
      href: flowId ? `/dashboard/automation/flow/${encodeURIComponent(flowId)}` : "/dashboard/automation",
    };
  }

  const object = OBJECTS[prefix];
  if (!object) return null;
  // A contact moved between Customer Path stages is work on a contact, not a settings change.
  if (prefix === "customer_path_stage" && event.target?.id?.startsWith("assignment:")) return null;

  const after = field(event, "after");
  if (prefix === "agent" && verb === "create") {
    const pending = jsonValue(after, "confirmed") === "false";
    return {
      ...base,
      category: "signup",
      type: "New agent",
      text: pending ? `${text}. Invitation not accepted yet; this preview sends no email.` : text,
      href: object.href,
    };
  }

  // F-10b: "Resend invite" on a pending agent (app/api/agent-invite). Like the first invitation it is a sign-up
  // notification; it says plainly that this preview sends no email.
  if (prefix === "agent" && verb === "resend_invite")
    return { ...base, category: "signup", type: "Invite resend requested", href: object.href };

  if (prefix === "whatsapp_template" && (verb === "create" || verb === "update")) {
    const status = jsonValue(after, "status");
    const approval: Record<string, string> = {
      PENDING: "Template submitted for approval",
      APPROVED: "Template approved",
      REJECTED: "Template rejected",
    };
    if (status && approval[status]) return { ...base, category: "approval", type: approval[status], href: object.href };
  }

  let href = object.href;
  const flowId = /^flow:(.+)$/.exec(event.target?.id ?? "")?.[1];
  if (prefix === "automation_flow" && flowId && verb !== "delete")
    href = `/dashboard/automation/flow/${encodeURIComponent(flowId)}`;
  return {
    ...base,
    category: "change",
    type: `${object.name} ${VERBS[verb] ?? verb.replace(/_/g, " ")}`,
    href,
  };
}

/** Newest first, one per event, at most FEED_LIMIT. */
export function feedFromEvents(events: FeedEvent[], limit = FEED_LIMIT): FeedNotification[] {
  const seen = new Set<string>();
  const out: FeedNotification[] = [];
  for (const event of [...events].sort((a, b) => Date.parse(b.created) - Date.parse(a.created))) {
    if (seen.has(event.id) || Date.parse(event.created) < Date.parse(FEED_START)) continue;
    seen.add(event.id);
    const item = toFeedNotification(event);
    if (item) out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

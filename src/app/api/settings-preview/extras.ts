// F-6A (sim2 problems 1, 2, 6, 8-11, 13; Fahad 99 «no fake success» and 129.2 «make a simulation, do not stop the
// buttons»): the Settings parts that said "saved" / "updated" and kept nothing, checked here before
// ./route.ts writes them to .preview-state/settings-preview.json. Preview only: nothing here reaches Chatwoot, a payment
// provider, Meta or any other outside service.
//
// Two kinds of data:
// - sections (profile, billing, integrations; account gets more fields): one object each, a save merges the fields it
//   sends, last write wins, like the sections م137 added.
// - lists (assignment policies, agent bots, webhooks, dashboard apps, integration hooks): rows with an id, created and
//   deleted from more than one tab. They follow the save-safety rule of F-3 (monitor-workers/f3-fixes/result.md, item
//   1): every save carries the revision the page read (baseRev); when the list changed on the server since, the save
//   is refused with 409 and the saved list, and nothing is written, so an old tab never brings back a deleted row.
import type { AuditChange } from "@/lib/audit/with-audit";

export const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A host name: labels of letters, digits and hyphens, at least one dot (RFC 1123 host names).
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const URL_HTTP = (value: string) => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max;

// ---- General Settings (the "account" section) ------------------------------------------------------------------

export interface AccountExtras {
  transcribeAudio?: boolean;
  supportEmail?: string;
  incomingEmailDomain?: string;
  /** ISO date the account would be deleted on (Chatwoot AccountDelete.vue marks it; nothing is deleted here). */
  deletionScheduledFor?: string | null;
  savedAt: string;
}

export function checkAccount(value: Record<string, unknown>): Omit<AccountExtras, "savedAt"> | string {
  const out: Omit<AccountExtras, "savedAt"> = {};
  if ("transcribeAudio" in value) {
    if (typeof value.transcribeAudio !== "boolean") return "transcribeAudio must be true or false";
    out.transcribeAudio = value.transcribeAudio;
  }
  if ("supportEmail" in value) {
    const email = typeof value.supportEmail === "string" ? value.supportEmail.trim() : null;
    // Chatwoot account/Index.vue: the support email may be empty; when given it must be an email.
    if (email === null || email.length > 255 || (email && !EMAIL.test(email)))
      return "Please enter a valid email address";
    out.supportEmail = email;
  }
  if ("incomingEmailDomain" in value) {
    const domain = typeof value.incomingEmailDomain === "string" ? value.incomingEmailDomain.trim() : null;
    if (domain === null || (domain && !DOMAIN.test(domain)))
      return "Please enter a valid domain (eg: mail.example.com)";
    out.incomingEmailDomain = domain;
  }
  if ("deletionScheduledFor" in value) {
    const date = value.deletionScheduledFor;
    if (date !== null && (typeof date !== "string" || Number.isNaN(Date.parse(date))))
      return "deletionScheduledFor must be a date or null";
    out.deletionScheduledFor = date as string | null;
  }
  if (!Object.keys(out).length) return "nothing to save";
  return out;
}

// ---- Profile Settings ------------------------------------------------------------------------------------------

export const FONT_SIZES = ["Smaller", "Small", "Default", "Large", "Larger", "Extra Large"] as const;
export const PROFILE_LANGUAGES = ["default", "en", "ar", "fr", "hi", "ur"] as const;
export const ALERT_EVENTS = ["assigned", "unassigned", "notme"] as const;
export const ALERT_TONES = ["ding", "bell", "chime", "magic", "ping"] as const;

export interface NotificationChoice {
  email: boolean;
  push: boolean;
}

export interface ProfileSettings {
  name?: string;
  displayName?: string;
  email?: string;
  /** A small data: URL picture (128 px), or null for the initials. */
  avatar?: string | null;
  fontSize?: (typeof FONT_SIZES)[number];
  language?: (typeof PROFILE_LANGUAGES)[number];
  signature?: string;
  hotkey?: "enter" | "cmd_enter";
  audioAlerts?: string[];
  alertTone?: (typeof ALERT_TONES)[number];
  alertOnlyWhenInactive?: boolean;
  alertRepeat?: boolean;
  notifications?: Record<string, NotificationChoice>;
  /** A token made by this preview. No API accepts it (the page says so). */
  accessToken?: string;
  savedAt: string;
}

const NOTIFICATION_KEY = /^[a-z_]{3,60}$/;
const AVATAR = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

export function checkProfile(value: Record<string, unknown>): Omit<ProfileSettings, "savedAt"> | string {
  const out: Omit<ProfileSettings, "savedAt"> = {};
  for (const key of ["name", "displayName"] as const) {
    if (!(key in value)) continue;
    const given = typeof value[key] === "string" ? (value[key] as string).trim() : "";
    if (!given || given.length > 255)
      return key === "name" ? "Please enter a valid full name" : "Please enter a valid display name";
    out[key] = given;
  }
  if ("email" in value) {
    const email = typeof value.email === "string" ? value.email.trim() : "";
    if (!EMAIL.test(email) || email.length > 255) return "Please enter a valid email address";
    out.email = email;
  }
  if ("avatar" in value) {
    const avatar = value.avatar;
    if (avatar !== null && (typeof avatar !== "string" || avatar.length > 150_000 || !AVATAR.test(avatar)))
      return "avatar must be a small PNG, JPEG, GIF or WebP picture";
    out.avatar = avatar as string | null;
  }
  if ("fontSize" in value) {
    if (!FONT_SIZES.includes(value.fontSize as never)) return "font size is unknown";
    out.fontSize = value.fontSize as ProfileSettings["fontSize"];
  }
  if ("language" in value) {
    if (!PROFILE_LANGUAGES.includes(value.language as never)) return "language is unknown";
    out.language = value.language as ProfileSettings["language"];
  }
  if ("signature" in value) {
    if (typeof value.signature !== "string" || !value.signature.trim() || value.signature.length > 5_000)
      return "Message Signature cannot be empty";
    out.signature = value.signature;
  }
  if ("hotkey" in value) {
    if (value.hotkey !== "enter" && value.hotkey !== "cmd_enter") return "hotkey is unknown";
    out.hotkey = value.hotkey;
  }
  if ("audioAlerts" in value) {
    const alerts = value.audioAlerts;
    if (!Array.isArray(alerts) || !alerts.every((a) => ALERT_EVENTS.includes(a as never)))
      return "audioAlerts holds alert events only";
    out.audioAlerts = [...new Set(alerts as string[])];
  }
  if ("alertTone" in value) {
    if (!ALERT_TONES.includes(value.alertTone as never)) return "alert tone is unknown";
    out.alertTone = value.alertTone as ProfileSettings["alertTone"];
  }
  for (const key of ["alertOnlyWhenInactive", "alertRepeat"] as const) {
    if (!(key in value)) continue;
    if (typeof value[key] !== "boolean") return `${key} must be true or false`;
    out[key] = value[key] as boolean;
  }
  if ("notifications" in value) {
    const prefs = value.notifications;
    if (!isObject(prefs) || Object.keys(prefs).length > 40) return "notifications must be an object";
    for (const [key, choice] of Object.entries(prefs)) {
      if (!NOTIFICATION_KEY.test(key) || !isObject(choice)) return "notifications are keys with email and push";
      if (typeof choice.email !== "boolean" || typeof choice.push !== "boolean")
        return "notifications are keys with email and push";
    }
    out.notifications = prefs as Record<string, NotificationChoice>;
  }
  if ("accessToken" in value) {
    if (typeof value.accessToken !== "string" || !/^[A-Za-z0-9]{24}$/.test(value.accessToken))
      return "accessToken must be 24 letters and digits";
    out.accessToken = value.accessToken;
  }
  if (!Object.keys(out).length) return "nothing to save";
  return out;
}

// ---- Billing ---------------------------------------------------------------------------------------------------

/** The credit packs of Chatwoot's Buy AI Credits dialog, with their prices. */
export const CREDIT_PACKS = [
  { credits: 1000, price: "$20" },
  { credits: 2500, price: "$45" },
  { credits: 6000, price: "$100" },
  { credits: 12000, price: "$180" },
] as const;

export interface CreditPurchase {
  id: string;
  credits: number;
  price: string;
  at: string;
}

export interface BillingSettings {
  currency?: "USD" | "BRL";
  /** Simulated purchases: nothing was paid. Added on the server, one at a time, so two tabs never drop one. */
  purchases?: CreditPurchase[];
  savedAt: string;
}

/**
 * `{ currency }`, `{ addPurchase: credits }` (the server adds the purchase to the saved ones) or
 * `{ removePurchase: id }` (takes one simulated purchase back out; the checks use it to leave no test purchase behind).
 */
export function checkBilling(
  value: Record<string, unknown>,
): { currency?: "USD" | "BRL"; addPurchase?: number; removePurchase?: string } | string {
  const out: { currency?: "USD" | "BRL"; addPurchase?: number; removePurchase?: string } = {};
  if ("currency" in value) {
    if (value.currency !== "USD" && value.currency !== "BRL") return "currency is unknown";
    out.currency = value.currency;
  }
  if ("addPurchase" in value) {
    if (!CREDIT_PACKS.some((pack) => pack.credits === value.addPurchase)) return "that credit pack does not exist";
    out.addPurchase = value.addPurchase as number;
  }
  if ("removePurchase" in value) {
    if (typeof value.removePurchase !== "string" || !/^p[a-z0-9]{1,20}$/.test(value.removePurchase))
      return "removePurchase must be a purchase id";
    out.removePurchase = value.removePurchase;
  }
  if (!Object.keys(out).length) return "nothing to save";
  return out;
}

// ---- Integrations that connect with OAuth (Linear, Notion, Shopify) -------------------------------------------

export const OAUTH_APPS = ["linear", "notion", "shopify"] as const;
export type OAuthApp = (typeof OAUTH_APPS)[number];

export interface OAuthConnection {
  connected: boolean;
  /** What the page shows it is connected to: the Shopify store the user typed, or "(preview)" for Linear/Notion. */
  account?: string;
  at?: string;
}

export type IntegrationsSettings = Partial<Record<OAuthApp, OAuthConnection>> & { savedAt: string };

const SHOPIFY_STORE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function checkIntegrations(value: Record<string, unknown>): Partial<Record<OAuthApp, OAuthConnection>> | string {
  const out: Partial<Record<OAuthApp, OAuthConnection>> = {};
  for (const [app, connection] of Object.entries(value)) {
    if (!OAUTH_APPS.includes(app as OAuthApp)) return `unknown integration ${app}`;
    if (!isObject(connection) || typeof connection.connected !== "boolean")
      return `${app}: connected must be true or false`;
    const account = connection.account;
    if (account !== undefined && !text(account, 200)) return `${app}: account must be text`;
    if (app === "shopify" && connection.connected && !SHOPIFY_STORE.test(String(account ?? "")))
      return "Please enter a valid Shopify store URL (e.g., your-store.myshopify.com)";
    out[app as OAuthApp] = {
      connected: connection.connected,
      ...(connection.connected && typeof account === "string" ? { account } : {}),
      at: new Date().toISOString(),
    };
  }
  if (!Object.keys(out).length) return "nothing to save";
  return out;
}

// ---- lists -----------------------------------------------------------------------------------------------------

export const LISTS = [
  "assignmentPolicies",
  "bots",
  "webhooks",
  "dashboardApps",
  "integrationHooks",
  "customAttributes",
  "customRoles",
  "dataImports",
] as const;
export type ListName = (typeof LISTS)[number];

export interface SavedList<T = Record<string, unknown>> {
  rev: number;
  items: T[];
}

const MAX_ITEMS = 200;
const ids = (items: unknown[]) => items.map((item) => (isObject(item) ? item.id : undefined));

function checkRow(list: ListName, row: Record<string, unknown>): string | null {
  const id = row.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) return "every row needs a whole-number id";
  switch (list) {
    case "assignmentPolicies": {
      if (!text(row.name, 255) || !(row.name as string).trim()) return "Please enter a name";
      if (!text(row.description, 1_000)) return "description must be text";
      if (typeof row.active !== "boolean") return "active must be true or false";
      if (row.order !== "round_robin" && row.order !== "balanced") return "assignment order is unknown";
      if (row.priority !== "earliest_created" && row.priority !== "longest_waiting") return "priority is unknown";
      for (const key of ["maxPerAgent", "window", "staleDays"])
        if (typeof row[key] !== "number" || !Number.isInteger(row[key]) || (row[key] as number) < 1)
          return `${key} must be a whole number above 0`;
      if (!Array.isArray(row.inboxes) || !row.inboxes.every((n) => Number.isInteger(n))) return "inboxes must be ids";
      return null;
    }
    case "bots": {
      if (!text(row.name, 255) || !(row.name as string).trim()) return "Bot name is required";
      if (!text(row.description, 1_000)) return "description must be text";
      if (typeof row.url !== "string" || !URL_HTTP(row.url))
        return "Please enter a valid URL starting with http:// or https://";
      if (
        row.avatar !== null &&
        row.avatar !== undefined &&
        (!text(row.avatar, 150_000) || !AVATAR.test(String(row.avatar)))
      )
        return "avatar must be a small picture";
      if (row.system !== undefined && typeof row.system !== "boolean") return "system must be true or false";
      if (!text(row.accessToken, 64) || !text(row.secret, 64)) return "access token and secret must be text";
      return null;
    }
    case "webhooks": {
      if (typeof row.url !== "string" || !URL_HTTP(row.url)) return "Please enter a valid URL";
      if (!text(row.name, 255)) return "name must be text";
      if (!Array.isArray(row.events) || !row.events.length || !row.events.every((e) => typeof e === "string"))
        return "Please select at least one event";
      return null;
    }
    case "dashboardApps": {
      if (!text(row.title, 255) || !(row.title as string).trim()) return "Please enter a name";
      if (typeof row.url !== "string" || !URL_HTTP(row.url)) return "Please enter a valid URL";
      return null;
    }
    case "integrationHooks": {
      if (typeof row.app !== "string" || !/^[a-z_]{2,40}$/.test(row.app)) return "app must be an integration id";
      if (row.inbox !== undefined && !text(row.inbox, 255)) return "inbox must be text";
      if (!Array.isArray(row.properties) || !row.properties.every((p) => text(p, 500)))
        return "properties must be text";
      return null;
    }
    case "customAttributes": {
      if (!text(row.name, 255) || !(row.name as string).trim()) return "Name is required";
      if (typeof row.attrKey !== "string" || !/^[a-zA-Z0-9_]{1,100}$/.test(row.attrKey)) return "Invalid key";
      if (!text(row.description, 1_000) || !(row.description as string).trim()) return "Description is required";
      if (!["Text", "Number", "Link", "Date", "List", "Checkbox"].includes(String(row.type))) return "Type is required";
      if (row.model !== "conversation" && row.model !== "contact") return "Model is required";
      if (row.values !== undefined && (!Array.isArray(row.values) || !row.values.every((v) => text(v, 255))))
        return "values must be text";
      return null;
    }
    case "customRoles": {
      if (!text(row.name, 255) || (row.name as string).trim().length < 2) return "Name is required.";
      if (!text(row.description, 1_000) || !(row.description as string).trim()) return "Description is required.";
      if (
        !Array.isArray(row.permissions) ||
        !row.permissions.length ||
        !row.permissions.every((p) => typeof p === "string")
      )
        return "Permissions are required.";
      return null;
    }
    case "dataImports": {
      if (!text(row.name, 255)) return "name must be text";
      if (!["intercom", "freshdesk", "file"].includes(String(row.source))) return "source is unknown";
      if (
        !["pending", "in_progress", "completed", "completed_with_errors", "failed", "abandoned"].includes(
          String(row.status),
        )
      )
        return "status is unknown";
      if (typeof row.stage !== "string") return "stage must be text";
      return null;
    }
  }
}

/** The list as it may be saved, or the reason it may not. */
export function checkList(list: ListName, items: unknown): Record<string, unknown>[] | string {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return `items must be a list of ${MAX_ITEMS} rows at most`;
  for (const row of items) {
    if (!isObject(row)) return "every row must be an object";
    const problem = checkRow(list, row);
    if (problem) return problem;
  }
  const seen = ids(items);
  if (new Set(seen).size !== seen.length) return "two rows have the same id";
  return items as Record<string, unknown>[];
}

// ---- audit -----------------------------------------------------------------------------------------------------

const LIST_LABELS: Record<ListName, { type: string; label: string; name: (row: Record<string, unknown>) => string }> = {
  assignmentPolicies: { type: "assignment_policy", label: "assignment policy", name: (r) => String(r.name ?? "") },
  bots: { type: "agent_bot", label: "agent bot", name: (r) => String(r.name ?? "") },
  webhooks: { type: "webhook", label: "webhook", name: (r) => String(r.name || r.url || "") },
  dashboardApps: { type: "dashboard_app", label: "dashboard app", name: (r) => String(r.title ?? "") },
  integrationHooks: {
    type: "integration_hook",
    label: "integration hook",
    name: (r) => `${r.app}${r.inbox ? ` (${r.inbox})` : ""}`,
  },
  customAttributes: {
    type: "custom_attribute",
    label: "custom attribute",
    name: (r) => String(r.name ?? r.attrKey ?? ""),
  },
  customRoles: { type: "custom_role", label: "custom role", name: (r) => String(r.name ?? "") },
  dataImports: { type: "data_import", label: "data import", name: (r) => String(r.name ?? "") },
};

/** One change per created, edited or deleted row, as the other list routes report them. */
export function describeListChange(list: ListName, before: unknown[], after: unknown[]): AuditChange[] {
  const { type, label, name } = LIST_LABELS[list];
  const rows = (items: unknown[]) => new Map(items.filter(isObject).map((row) => [row.id as number, row]));
  const was = rows(before);
  const now = rows(after);
  const changes: AuditChange[] = [];
  for (const [id, row] of now) {
    const old = was.get(id);
    if (!old)
      changes.push({
        action: `${type}.create`,
        crud: "c",
        summary: `created the ${label} "${name(row)}"`,
        target: { id, name: name(row), type },
        after: row,
      });
    else if (JSON.stringify(old) !== JSON.stringify(row))
      changes.push({
        action: `${type}.update`,
        crud: "u",
        summary: `changed the ${label} "${name(row)}"`,
        target: { id, name: name(row), type },
        before: old,
        after: row,
      });
  }
  for (const [id, row] of was)
    if (!now.has(id))
      changes.push({
        action: `${type}.delete`,
        crud: "d",
        summary: `deleted the ${label} "${name(row)}"`,
        target: { id, name: name(row), type },
        before: row,
      });
  return changes;
}

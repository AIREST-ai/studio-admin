import { NextResponse } from "next/server";

import { type AuditChange, type AuditContext, withAudit } from "@/lib/audit/with-audit";

import {
  type AccountExtras,
  type BillingSettings,
  CREDIT_PACKS,
  checkAccount,
  checkBilling,
  checkIntegrations,
  checkList,
  checkProfile,
  describeListChange,
  type IntegrationsSettings,
  LISTS,
  type ListName,
  type ProfileSettings,
  type SavedList,
} from "./extras";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// م137 round 2 (Fahad 137 and item 99; judge M137: Conversation Workflow and SAML said "updated successfully" and kept
// nothing): the Settings pages that had no saved copy keep one on the preview machine's disk, the way
// api/account-general-settings does: one small file beside studio-preview-state.json (that file and its sections
// belong to lib/cw/persistence/file-store.ts and are not touched here), written atomically, last write wins, and every
// change logged through the one audit wrapper. Preview only: nothing reaches Chatwoot.
// Slack (its connection, channel and thread behaviour) is kept the same way; ?state= on its page still shows a state
// for a check without changing what is saved.
// GET -> { settings: { conversationWorkflow, saml, slack } } (null when never saved).
// PUT { section, value } -> merges the given part of that section, answers { section, value } as saved.
// F-6A: more sections (profile, billing, integrations; more General Settings fields) and rows lists (./extras.ts):
// GET -> also { lists: { <name>: { rev, items } | null } }.
// PUT { list, baseRev, items } -> the saved { list, rev, items }, or 409 { error, current } when the list was saved
// after baseRev (nothing written), the F-3 rule.
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), ".preview-state", "settings-preview.json");
const headers = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

const UNITS = ["minutes", "hours", "days"] as const;
const MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;

export interface AutoResolve {
  enabled: boolean;
  amount: number;
  unit: (typeof UNITS)[number];
  message: string;
  ignoreWaiting: boolean;
  label: string;
}

export interface ConversationWorkflow {
  autoResolve?: AutoResolve;
  requiredAttributes?: string[];
  savedAt: string;
}

export interface Saml {
  enabled?: boolean;
  ssoUrl?: string;
  idpEntityId?: string;
  certificate?: string;
  savedAt: string;
}

const SLACK_STATES = ["disconnected", "select", "expired", "active"] as const;
const SLACK_MODES = ["two_way", "alert"] as const;

export interface SlackSettings {
  connection?: (typeof SLACK_STATES)[number];
  channelId?: string;
  mode?: (typeof SLACK_MODES)[number];
  savedAt: string;
}

// Captain's feature switches and model choices, and General Settings' audio transcription switch: switches that said
// "updated successfully" at once and kept nothing.
export interface CaptainSettings {
  features?: Record<string, boolean>;
  models?: Record<string, string>;
  savedAt: string;
}

export type { AccountExtras, BillingSettings, IntegrationsSettings, ProfileSettings, SavedList } from "./extras";

export interface SettingsPreview {
  conversationWorkflow: ConversationWorkflow | null;
  saml: Saml | null;
  slack: SlackSettings | null;
  captain: CaptainSettings | null;
  account: AccountExtras | null;
  profile: ProfileSettings | null;
  billing: BillingSettings | null;
  integrations: IntegrationsSettings | null;
  lists: Record<ListName, SavedList | null>;
}

const SECTIONS = [
  "conversationWorkflow",
  "saml",
  "slack",
  "captain",
  "account",
  "profile",
  "billing",
  "integrations",
] as const;
type Section = (typeof SECTIONS)[number];

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const noLists = (): Record<ListName, SavedList | null> =>
  Object.fromEntries(LISTS.map((name) => [name, null])) as Record<ListName, SavedList | null>;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** Nothing saved yet reads as both sections null. A damaged file throws instead of silently resetting. */
async function read(): Promise<SettingsPreview> {
  let text: string;
  try {
    text = await readFile(FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return {
        conversationWorkflow: null,
        saml: null,
        slack: null,
        captain: null,
        account: null,
        profile: null,
        billing: null,
        integrations: null,
        lists: noLists(),
      };
    throw error;
  }
  const saved = JSON.parse(text) as Partial<SettingsPreview>;
  if (!isObject(saved)) throw new Error("settings preview file is damaged");
  return {
    conversationWorkflow: isObject(saved.conversationWorkflow)
      ? (saved.conversationWorkflow as ConversationWorkflow)
      : null,
    saml: isObject(saved.saml) ? (saved.saml as Saml) : null,
    slack: isObject(saved.slack) ? (saved.slack as SlackSettings) : null,
    captain: isObject(saved.captain) ? (saved.captain as CaptainSettings) : null,
    account: isObject(saved.account) ? (saved.account as AccountExtras) : null,
    profile: isObject(saved.profile) ? (saved.profile as ProfileSettings) : null,
    billing: isObject(saved.billing) ? (saved.billing as BillingSettings) : null,
    integrations: isObject(saved.integrations) ? (saved.integrations as IntegrationsSettings) : null,
    lists: Object.fromEntries(
      LISTS.map((name) => {
        const list = isObject(saved.lists) ? saved.lists[name] : null;
        return [
          name,
          isObject(list) && Number.isInteger(list.rev) && Array.isArray(list.items)
            ? (list as unknown as SavedList)
            : null,
        ];
      }),
    ) as Record<ListName, SavedList | null>,
  };
}

// ---- checks (the same rules the pages show, so a bad value is refused here too) --------------------------------

function checkAutoResolve(value: unknown): AutoResolve | string {
  if (!isObject(value)) return "autoResolve must be an object";
  const { enabled, amount, unit, message, ignoreWaiting, label } = value;
  if (typeof enabled !== "boolean") return "autoResolve.enabled must be true or false";
  if (typeof unit !== "string" || !UNITS.includes(unit as AutoResolve["unit"])) return "autoResolve.unit is unknown";
  const minutes = Number(amount) * MINUTES[unit as AutoResolve["unit"]];
  if (typeof amount !== "number" || !Number.isFinite(minutes) || minutes < 10 || minutes > 999 * 1440)
    return "Auto resolve duration should be between 10 minutes and 999 days";
  if (typeof message !== "string" || message.length > 2_000)
    return "autoResolve.message must be text (2000 characters at most)";
  if (typeof ignoreWaiting !== "boolean") return "autoResolve.ignoreWaiting must be true or false";
  if (typeof label !== "string" || label.length > 255) return "autoResolve.label must be text";
  return { enabled, amount, unit: unit as AutoResolve["unit"], message, ignoreWaiting, label };
}

function checkRequired(value: unknown): string[] | string {
  if (!Array.isArray(value) || value.length > 100) return "requiredAttributes must be a list";
  if (!value.every((key) => typeof key === "string" && /^[a-z0-9_]{1,100}$/.test(key)))
    return "requiredAttributes holds attribute keys only";
  return [...new Set(value as string[])];
}

function checkSaml(value: Record<string, unknown>): Omit<Saml, "savedAt"> | string {
  const out: Omit<Saml, "savedAt"> = {};
  if ("enabled" in value) {
    if (typeof value.enabled !== "boolean") return "enabled must be true or false";
    out.enabled = value.enabled;
  }
  const fields = ["ssoUrl", "idpEntityId", "certificate"] as const;
  const given = fields.filter((key) => key in value);
  if (given.length && given.length !== fields.length)
    return "SSO URL, Identity Provider Entity ID, and Certificate are saved together";
  if (given.length) {
    for (const key of fields) {
      const text = value[key];
      if (typeof text !== "string" || !text.trim() || text.length > 20_000)
        return "SSO URL, Identity Provider Entity ID, and Certificate are required fields";
    }
    try {
      if (!/^https?:$/.test(new URL(String(value.ssoUrl)).protocol)) return "Please enter a valid SSO URL";
    } catch {
      return "SSO URL is not a valid URL";
    }
    out.ssoUrl = String(value.ssoUrl).trim();
    out.idpEntityId = String(value.idpEntityId).trim();
    out.certificate = String(value.certificate).trim();
  }
  if (!Object.keys(out).length) return "nothing to save";
  return out;
}

const NAME = /^[\w &().,-]{1,100}$/;

function checkCaptain(value: Record<string, unknown>): Omit<CaptainSettings, "savedAt"> | string {
  const out: Omit<CaptainSettings, "savedAt"> = {};
  if ("features" in value) {
    const features = value.features;
    if (!isObject(features) || Object.keys(features).length > 30) return "features must be an object";
    if (!Object.entries(features).every(([key, on]) => NAME.test(key) && typeof on === "boolean"))
      return "features are names with true or false";
    out.features = features as Record<string, boolean>;
  }
  if ("models" in value) {
    const models = value.models;
    if (!isObject(models) || Object.keys(models).length > 30) return "models must be an object";
    if (
      !Object.entries(models).every(
        ([key, id]) => NAME.test(key) && typeof id === "string" && /^[\w.-]{1,80}$/.test(id),
      )
    )
      return "models are names with a model id";
    out.models = models as Record<string, string>;
  }
  if (!Object.keys(out).length) return "nothing to save";
  return out;
}

function checkSlack(value: Record<string, unknown>): Omit<SlackSettings, "savedAt"> | string {
  const out: Omit<SlackSettings, "savedAt"> = {};
  if ("connection" in value) {
    if (!SLACK_STATES.includes(value.connection as SlackSettings["connection"] & string))
      return "connection is unknown";
    out.connection = value.connection as SlackSettings["connection"];
  }
  if ("channelId" in value) {
    if (typeof value.channelId !== "string" || value.channelId.length > 100) return "channelId must be text";
    out.channelId = value.channelId;
  }
  if ("mode" in value) {
    if (!SLACK_MODES.includes(value.mode as SlackSettings["mode"] & string)) return "mode is unknown";
    out.mode = value.mode as SlackSettings["mode"];
  }
  if (!Object.keys(out).length) return "nothing to save";
  return out;
}

export async function GET() {
  try {
    return NextResponse.json({ settings: await read() }, { headers });
  } catch (error) {
    return fail(500, `saved settings unreadable: ${(error as Error).message}`);
  }
}

let writing: Promise<unknown> = Promise.resolve();

/** One write at a time, so two quick saves never drop each other's part: read, change, write a temp file, rename. */
function queueWrite<T>(
  change: (
    saved: SettingsPreview,
  ) => { all: SettingsPreview; result: T } | Promise<{ all: SettingsPreview; result: T }>,
) {
  const run = writing.then(async () => {
    const { all, result } = await change(await read());
    await mkdir(path.dirname(FILE), { recursive: true });
    const temp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(all, null, 2));
    await rename(temp, FILE);
    return result;
  });
  writing = run.catch(() => undefined);
  return run;
}

class ListConflict extends Error {
  constructor(readonly current: SavedList) {
    super("Not saved: this list was changed in another tab or device. Reload to see the saved version.");
  }
}

async function putList(list: ListName, baseRev: unknown, items: unknown) {
  if (typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 0)
    return fail(400, "baseRev must be a whole number");
  const checked = checkList(list, items);
  if (typeof checked === "string") return fail(400, checked);
  try {
    const saved = await queueWrite((all) => {
      const current = all.lists[list] ?? { rev: 0, items: [] };
      // F-3 rule: a page that read an older revision may not write, so a deleted row never comes back.
      if (current.rev !== baseRev) throw new ListConflict(current);
      const next: SavedList = { rev: current.rev + 1, items: checked };
      return { all: { ...all, lists: { ...all.lists, [list]: next } }, result: next };
    });
    return NextResponse.json({ list, ...saved }, { headers });
  } catch (error) {
    if (error instanceof ListConflict)
      return NextResponse.json({ error: error.message, current: error.current }, { status: 409, headers });
    return fail(500, `not saved: ${(error as Error).message}`);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  let body: { section?: unknown; value?: unknown; list?: unknown; baseRev?: unknown; items?: unknown } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "body is not JSON");
  }
  if (body && "list" in body) {
    if (typeof body.list !== "string" || !LISTS.includes(body.list as ListName)) return fail(400, "unknown list");
    return putList(body.list as ListName, body.baseRev, body.items);
  }
  const section = body?.section;
  if (typeof section !== "string" || !SECTIONS.includes(section as Section)) return fail(400, "unknown section");
  if (!isObject(body?.value)) return fail(400, "value must be an object");
  const value = body.value;

  let part: Record<string, unknown>;
  if (section === "conversationWorkflow") {
    part = {};
    if ("autoResolve" in value) {
      const checked = checkAutoResolve(value.autoResolve);
      if (typeof checked === "string") return fail(400, checked);
      part.autoResolve = checked;
    }
    if ("requiredAttributes" in value) {
      const checked = checkRequired(value.requiredAttributes);
      if (typeof checked === "string") return fail(400, checked);
      part.requiredAttributes = checked;
    }
    if (!Object.keys(part).length) return fail(400, "nothing to save");
  } else {
    const checks: Record<Exclude<Section, "conversationWorkflow">, (v: Record<string, unknown>) => object | string> = {
      saml: checkSaml,
      slack: checkSlack,
      captain: checkCaptain,
      account: checkAccount,
      profile: checkProfile,
      billing: checkBilling,
      integrations: checkIntegrations,
    };
    const checked = checks[section as Exclude<Section, "conversationWorkflow">](value);
    if (typeof checked === "string") return fail(400, checked);
    part = checked as Record<string, unknown>;
  }

  try {
    const next = await queueWrite((saved) => {
      const before = (saved[section as Section] ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...before, ...part, savedAt: new Date().toISOString() };
      // Captain keeps one entry per feature and per model: a change to one leaves the others as saved.
      if (section === "captain")
        for (const key of ["features", "models"])
          if (isObject(part[key])) merged[key] = { ...(isObject(before[key]) ? before[key] : {}), ...part[key] };
      // Profile notification choices: one entry per notification type.
      if (section === "profile" && isObject(part.notifications))
        merged.notifications = {
          ...(isObject(before.notifications) ? before.notifications : {}),
          ...part.notifications,
        };
      // Billing: a purchase is added to the saved ones here, never sent as the whole list (two tabs keep both).
      if (section === "billing" && typeof part.addPurchase === "number") {
        const pack = CREDIT_PACKS.find((p) => p.credits === part.addPurchase);
        const purchases = Array.isArray(before.purchases) ? before.purchases : [];
        merged.purchases = [
          ...purchases,
          {
            id: `p${Date.now().toString(36)}`,
            credits: pack?.credits,
            price: pack?.price,
            at: new Date().toISOString(),
          },
        ];
        delete merged.addPurchase;
      }
      if (section === "billing" && typeof part.removePurchase === "string") {
        const purchases = Array.isArray(merged.purchases) ? (merged.purchases as { id?: string }[]) : [];
        merged.purchases = purchases.filter((p) => p.id !== part.removePurchase);
        delete merged.removePurchase;
      }
      return { all: { ...saved, [section]: merged }, result: merged };
    });
    return NextResponse.json({ section, value: next }, { headers });
  } catch (error) {
    return fail(500, `not saved: ${(error as Error).message}`);
  }
}

// ---- audit (the describer lives here; lib/audit/describe.ts is another worker's file) ---------------------------

const NAMES: Record<Section, string> = {
  conversationWorkflow: "Conversation Workflow",
  saml: "SAML SSO",
  slack: "Slack integration",
  captain: "Captain",
  account: "General Settings",
  profile: "Profile Settings",
  billing: "Billing",
  integrations: "Integrations",
};
const ACTIONS: Record<Section, string> = {
  conversationWorkflow: "conversation_workflow.update",
  saml: "saml.update",
  slack: "slack_integration.update",
  captain: "captain_settings.update",
  account: "account.settings_update",
  profile: "profile.update",
  billing: "billing.update",
  integrations: "integration.update",
};

function describeSettingsPreview(context: AuditContext<SettingsPreview>): AuditChange[] {
  const body = isObject(context.json) ? context.json : {};
  // F-6A lists: one change per row created, edited or deleted.
  if (typeof body.list === "string" && LISTS.includes(body.list as ListName)) {
    if (context.status >= 400) return [];
    const list = body.list as ListName;
    return describeListChange(
      list,
      context.before?.lists?.[list]?.items ?? [],
      Array.isArray(body.items) ? body.items : [],
    );
  }
  const section =
    typeof body.section === "string" && SECTIONS.includes(body.section as Section) ? (body.section as Section) : null;
  if (!section || !isObject(body.value) || context.status >= 400) return [];
  const before = (context.before?.[section] ?? {}) as Record<string, unknown>;
  const keys = Object.keys(body.value).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(body.value?.[key as never]),
  );
  if (!keys.length) return [];
  const pick = (from: Record<string, unknown>) => Object.fromEntries(keys.map((key) => [key, from[key]]));
  return [
    {
      action: ACTIONS[section],
      crud: "u",
      summary: `changed ${NAMES[section]} (${keys.join(", ")})`,
      target: { id: section, name: NAMES[section], type: "settings" },
      before: pick(before),
      after: pick(body.value as Record<string, unknown>),
    },
  ];
}

export const PUT = withAudit<SettingsPreview>(
  { area: "settings_preview", snapshot: () => read(), describe: describeSettingsPreview },
  put,
);

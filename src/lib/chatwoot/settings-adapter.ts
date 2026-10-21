"use client";

// U-3 (`u3-cw-settings-adapter`, item 159): Unified Settings & Reports adapter.
// Connects Settings lists, Automation rules, Custom Attributes, Custom Filters, the 4 write-locked admin resources,
// the 10 CE-unavailable (501) areas, and Reports exclusively through `src/lib/chatwoot/unified-client.ts` (`/api/cw/...`).
// In preview mode, nothing here runs and `.preview-state/*` files remain untouched.

import * as React from "react";

import { toast } from "sonner";
import { create } from "zustand";

import type { SummaryRow } from "@/app/(main)/dashboard/reports/_components/data";
import type { GroupBy, PeriodState } from "@/app/(main)/dashboard/reports/_components/report-period";
import type { MetricValues } from "@/app/(main)/dashboard/reports/_components/report-ui";
import { formatDuration } from "@/app/(main)/dashboard/reports/_components/report-ui";
import type { SavedGeneralSettings } from "@/app/(main)/dashboard/settings/account/_components/general-settings-client";
import type {
  Action as AutomationAction,
  Condition as AutomationCondition,
  EventKey as AutomationEventKey,
  Rule as AutomationRule,
} from "@/app/(main)/dashboard/settings/automation/_flow/catalog";
import { type IdDirectory, toChatwootRule } from "@/app/(main)/dashboard/settings/automation/_flow/chatwoot";
import { type AutomationItem, rulesOf, withRules } from "@/app/(main)/dashboard/settings/automation/_flow/model";
import type { LoadedAutomation } from "@/app/(main)/dashboard/settings/automation/_flow/storage";
import type { Macro, MacroAction } from "@/app/(main)/dashboard/settings/macros/_components/data";
import type { ListName, SavedList } from "@/app/api/settings-preview/extras";
import type { AccountExtras, ProfileSettings, SettingsPreview } from "@/app/api/settings-preview/route";
import type { Agent, CannedResponse, Inbox, Label, Team } from "@/lib/cw/data";
import { channelName, withCleanChannelName } from "@/lib/cw/map";
import { linkedSession } from "@/lib/cw/persistence/client";
import { type CwListKey, type CwLists, showLinkedLists, useCwShared } from "@/lib/cw/store";

import { toSharedInboxes } from "./map";
import {
  type CeUnavailableArea,
  type CeUnavailableBody,
  ceUnavailable,
  isCeUnavailable,
  cw as rawUnifiedCw,
} from "./unified-client";

const unifiedCw = rawUnifiedCw as typeof rawUnifiedCw & {
  POST(
    path: "/inboxes",
    init: { body: Record<string, unknown> },
  ): Promise<{ data?: unknown; error?: unknown; response: Response }>;
};

/* ------------------------------------------------------------------ Error & Status Helpers ---------------------- */

export function extractGatewayError(error: unknown, status?: number): string {
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (typeof rec.detail === "string" && rec.detail.trim()) return rec.detail;
    if (typeof rec.error === "string" && rec.error.trim()) return rec.error;
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
    if (Array.isArray(rec.errors) && rec.errors.length > 0) return String(rec.errors[0]);
  }
  if (status === 403) return "Refused by Studio gateway (403): insufficient permissions or write-locked resource";
  if (status === 501) return "Unavailable in Chatwoot CE 4.18.0 (501): Enterprise edition required";
  return status ? `Gateway HTTP ${status}` : "Request failed";
}

/** Performs a direct gateway write to one of the 4 forbidden admin endpoints so the 403 is logged & verified live. */
export async function attemptForbiddenGatewayWrite(
  segment: "profile" | "webhooks" | "agents" | "accounts/1",
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  payload: Record<string, unknown> = {},
): Promise<never> {
  let status = 403;
  let detail = `writes to /${segment} are refused by the Studio gateway`;
  try {
    const res = await fetch(`/api/cw/${segment}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    status = res.status;
    const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (body?.error) detail = body.error;
    else if (body?.message) detail = body.message;
  } catch (err) {
    detail = err instanceof Error ? err.message : detail;
  }
  throw new Error(`Refused by Studio gateway (${status}): ${detail}`);
}

/* ------------------------------------------------------------------ 10 CE-Unavailable (501) Areas --------------- */

const ceCache = new Map<CeUnavailableArea, CeUnavailableBody>();
const ceInflight = new Map<CeUnavailableArea, Promise<CeUnavailableBody>>();
const ceListeners = new Set<() => void>();

function notifyCeListeners() {
  for (const listener of ceListeners) listener();
}

/** Calls `/api/cw/<area>` in linked mode to record the real 501 response from the unified gateway. */
export function probeCeArea(area: CeUnavailableArea): Promise<CeUnavailableBody> {
  const existing = ceCache.get(area);
  if (existing) return Promise.resolve(existing);
  const pending = ceInflight.get(area);
  if (pending) return pending;

  const run = fetch(`/api/cw/${area}`, { cache: "no-store", credentials: "same-origin" })
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (isCeUnavailable(res.status, body)) {
        ceCache.set(area, body);
        notifyCeListeners();
        return body;
      }
      const fallback = ceUnavailable(area);
      ceCache.set(area, fallback);
      notifyCeListeners();
      return fallback;
    })
    .catch(() => {
      const fallback = ceUnavailable(area);
      ceCache.set(area, fallback);
      notifyCeListeners();
      return fallback;
    })
    .finally(() => {
      ceInflight.delete(area);
    });

  ceInflight.set(area, run);
  return run;
}

export function rejectCeWrite(area: CeUnavailableArea): Promise<never> {
  return probeCeArea(area).then((info) => {
    throw new Error(`Unavailable in Chatwoot ${info.edition.toUpperCase()} ${info.version} (501): ${info.detail}`);
  });
}

/** Reactive hook returning the 501 `CeUnavailableBody` when in linked mode, or `null` in preview mode. */
export function useCeUnavailable(area: CeUnavailableArea): CeUnavailableBody | null {
  const isLinked = linkedSession();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!isLinked) return;
    const onUpdate = () => setTick((t) => t + 1);
    ceListeners.add(onUpdate);
    void probeCeArea(area);
    return () => {
      ceListeners.delete(onUpdate);
    };
  }, [area, isLinked]);

  if (!isLinked) return null;
  return ceCache.get(area) ?? ceUnavailable(area);
}

/** Consistent visual banner shown on any of the 10 CE-unavailable pages when linked to Chatwoot CE 4.18.0. */
export function CeUnavailableNotice({
  area,
  title,
  className,
}: {
  area: CeUnavailableArea;
  title?: string;
  className?: string;
}): React.ReactElement | null {
  const info = useCeUnavailable(area);
  if (!info) return null;

  return React.createElement(
    "div",
    {
      "data-testid": "ce-unavailable-banner",
      "data-ce-area": info.area,
      role: "status",
      className: `rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-sm text-foreground ${className ?? ""}`,
    },
    React.createElement(
      "div",
      { className: "flex flex-wrap items-center gap-2 font-medium" },
      React.createElement(
        "span",
        {
          className:
            "inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-amber-800 dark:text-amber-300",
        },
        `HTTP 501 · Chatwoot ${info.edition.toUpperCase()} ${info.version}`,
      ),
      React.createElement("span", null, title ?? `Unavailable in Chatwoot Community Edition (${info.area})`),
    ),
    React.createElement(
      "p",
      { className: "mt-1.5 text-xs text-muted-foreground" },
      `Gateway /api/cw/${info.area} returned 501 (${info.error}): ${info.detail}. In linked mode, local preview data is hidden and writes are disabled so preview state is never mixed with live server state.`,
    ),
  );
}

/* ------------------------------------------------------------------ Label ID Registry & Mappers ----------------- */

const labelIdByTitle = new Map<string, number>();

export function registerLabelIds(rawLabels: unknown) {
  labelIdByTitle.clear();
  const list = Array.isArray(rawLabels)
    ? rawLabels
    : rawLabels && typeof rawLabels === "object" && Array.isArray((rawLabels as { payload?: unknown[] }).payload)
      ? (rawLabels as { payload: unknown[] }).payload
      : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { id?: unknown; title?: unknown };
    if (typeof rec.id === "number" && typeof rec.title === "string") {
      labelIdByTitle.set(rec.title.trim(), rec.id);
    }
  }
}

const MACRO_ACTION_TO_CW: Record<string, string> = {
  "Assign a Team": "assign_team",
  "Assign an Agent": "assign_agent",
  "Add a Label": "add_label",
  "Remove a Label": "remove_label",
  "Remove Assigned Agent": "remove_assigned_agent",
  "Remove Assigned Team": "remove_assigned_team",
  "Send an Email Transcript": "send_email_transcript",
  "Mute Conversation": "mute_conversation",
  "Snooze Conversation": "snooze_conversation",
  "Resolve Conversation": "resolve_conversation",
  "Send Attachment": "send_attachment",
  "Send a Message": "send_message",
  "Add a Private Note": "add_private_note",
  "Change Priority": "change_priority",
  "Send Webhook Event": "send_webhook_event",
};

const CW_TO_MACRO_ACTION: Record<string, string> = Object.fromEntries(
  Object.entries(MACRO_ACTION_TO_CW).map(([label, key]) => [key, label]),
);

export function mapRawMacros(raw: unknown, agentsList?: Agent[], teamsList?: Team[]): Macro[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { payload?: unknown[] }).payload)
      ? (raw as { payload: unknown[] }).payload
      : [];
  const agents = agentsList ?? useCwShared.getState().agents;
  const teams = teamsList ?? useCwShared.getState().teams;

  return list.flatMap((item): Macro[] => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0) return [];
    const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : `Macro #${id}`;
    const visibility = r.visibility === "global" ? "Public" : "Private";
    const createdByObj = (r.created_by ?? {}) as { id?: unknown; name?: unknown; available_name?: unknown };
    const updatedByObj = (r.updated_by ?? {}) as { id?: unknown; name?: unknown; available_name?: unknown };
    const createdBy =
      (typeof createdByObj.available_name === "string" && createdByObj.available_name) ||
      (typeof createdByObj.name === "string" && createdByObj.name) ||
      agents[0]?.name ||
      "Fahad";
    const updatedBy =
      (typeof updatedByObj.available_name === "string" && updatedByObj.available_name) ||
      (typeof updatedByObj.name === "string" && updatedByObj.name) ||
      createdBy;

    const rawActions = Array.isArray(r.actions) ? r.actions : [];
    const actions: MacroAction[] = rawActions.map((act) => {
      const a = (act && typeof act === "object" ? act : {}) as { action_name?: unknown; action_params?: unknown };
      const actionKey = typeof a.action_name === "string" ? a.action_name : "resolve_conversation";
      const label = CW_TO_MACRO_ACTION[actionKey] ?? "Resolve Conversation";
      const params = Array.isArray(a.action_params) ? a.action_params : [];
      let value = "";
      if (actionKey === "assign_team" && params.length > 0) {
        const team = teams.find((t) => t.id === Number(params[0]));
        value = team?.name ?? String(params[0]);
      } else if (actionKey === "assign_agent" && params.length > 0) {
        if (params[0] === "self") value = "Self";
        else {
          const ag = agents.find((x) => x.id === Number(params[0]));
          value = ag?.name ?? String(params[0]);
        }
      } else if (params.length > 0) {
        value = params.map((p) => String(p)).join(", ");
      }
      return { action: label, value };
    });

    return [
      {
        id,
        name,
        visibility,
        createdBy,
        ...(typeof createdByObj.id === "number" ? { createdById: createdByObj.id } : {}),
        updatedBy,
        actions: actions.length > 0 ? actions : [{ action: "Resolve Conversation", value: "" }],
      },
    ];
  });
}

function toCwMacroPayload(macro: Macro): Record<string, unknown> {
  const agents = useCwShared.getState().agents;
  const teams = useCwShared.getState().teams;
  const actions = macro.actions.map((a) => {
    const action_name = MACRO_ACTION_TO_CW[a.action] ?? "resolve_conversation";
    let action_params: unknown[] = [];
    if (a.value) {
      if (action_name === "assign_team") {
        const team = teams.find((t) => t.name.toLowerCase() === a.value.trim().toLowerCase());
        action_params = team ? [team.id] : [1];
      } else if (action_name === "assign_agent") {
        if (a.value === "Self") action_params = ["self"];
        else {
          const ag = agents.find((x) => x.name.toLowerCase() === a.value.trim().toLowerCase());
          action_params = ag ? [ag.id] : [1];
        }
      } else if (action_name === "add_label" || action_name === "remove_label") {
        action_params = a.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (action_name === "change_priority") {
        action_params = [a.value.toLowerCase()];
      } else {
        action_params = [a.value];
      }
    }
    return { action_name, action_params };
  });

  return {
    name: macro.name,
    visibility: macro.visibility === "Public" ? "global" : "personal",
    actions,
  };
}

/* ------------------------------------------------------------------ Shared Lists Sync & Diff Writer ------------- */

let syncingFromServer = false;
let lastSyncedShared: Pick<CwLists, "agents" | "teams" | "inboxes" | "labels" | "cannedResponses" | "macros"> | null =
  null;

export function setLastSyncedShared(
  snapshot: Pick<CwLists, "agents" | "teams" | "inboxes" | "labels" | "cannedResponses" | "macros">,
) {
  lastSyncedShared = {
    agents: structuredClone(snapshot.agents),
    teams: structuredClone(snapshot.teams),
    inboxes: structuredClone(snapshot.inboxes).map((ib) => {
      delete (ib as InboxWithConfig).channelParams;
      return ib;
    }),
    labels: structuredClone(snapshot.labels),
    cannedResponses: structuredClone(snapshot.cannedResponses),
    macros: structuredClone(snapshot.macros),
  };
}

export function isSyncingFromServer(): boolean {
  return syncingFromServer;
}

export function applyServerSharedState(patch: Partial<CwLists>) {
  syncingFromServer = true;
  try {
    const next = patch.inboxes ? { ...patch, inboxes: patch.inboxes.map(withCleanChannelName) } : patch;
    useCwShared.setState(next);
    const s = useCwShared.getState();
    setLastSyncedShared({
      agents: s.agents,
      teams: s.teams,
      inboxes: s.inboxes,
      labels: s.labels,
      cannedResponses: s.cannedResponses,
      macros: s.macros,
    });
  } finally {
    syncingFromServer = false;
  }
}

async function syncCannedResponsesDiff(before: CannedResponse[], after: CannedResponse[]): Promise<CannedResponse[]> {
  const beforeMap = new Map(before.map((item) => [item.id, item]));
  const afterMap = new Map(after.map((item) => [item.id, item]));
  const updatedList = [...after];

  for (const item of after) {
    const prev = beforeMap.get(item.id);
    if (!prev) {
      const res = await unifiedCw.POST("/canned_responses", {
        body: {
          canned_response: { short_code: item.shortCode, content: item.content },
          short_code: item.shortCode,
          content: item.content,
        } as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
      const created = (res.data ?? {}) as { id?: unknown };
      if (typeof created.id === "number" && created.id > 0) {
        const idx = updatedList.findIndex((x) => x.id === item.id);
        if (idx >= 0) updatedList[idx] = { ...updatedList[idx], id: created.id };
      }
    } else if (prev.shortCode !== item.shortCode || prev.content !== item.content) {
      const res = await unifiedCw.PATCH("/canned_responses/{id}", {
        params: { path: { id: item.id } },
        body: {
          canned_response: { short_code: item.shortCode, content: item.content },
          short_code: item.shortCode,
          content: item.content,
        } as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  for (const prev of before) {
    if (!afterMap.has(prev.id)) {
      const res = await unifiedCw.DELETE("/canned_responses/{id}", {
        params: { path: { id: prev.id } },
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  return updatedList;
}

async function syncLabelsDiff(before: Label[], after: Label[]): Promise<Label[]> {
  if (before.length === after.length) {
    for (let i = 0; i < before.length; i++) {
      const prev = before[i];
      const curr = after[i];
      if (
        prev.title !== curr.title ||
        prev.description !== curr.description ||
        prev.color !== curr.color ||
        prev.showOnSidebar !== curr.showOnSidebar
      ) {
        const id = labelIdByTitle.get(prev.title);
        if (!id) {
          throw new Error(`Label "${prev.title}" has no server ID in Chatwoot`);
        }
        const res = await unifiedCw.PATCH("/labels/{id}", {
          params: { path: { id } },
          body: {
            label: {
              title: curr.title,
              description: curr.description,
              color: curr.color,
              show_on_sidebar: curr.showOnSidebar,
            },
            title: curr.title,
            description: curr.description,
            color: curr.color,
            show_on_sidebar: curr.showOnSidebar,
          } as never,
        });
        if (res.error || !res.response.ok) {
          throw new Error(extractGatewayError(res.error, res.response.status));
        }
        labelIdByTitle.delete(prev.title);
        labelIdByTitle.set(curr.title, id);
      }
    }
    return after;
  }

  const beforeMap = new Map(before.map((l) => [l.title, l]));
  const afterMap = new Map(after.map((l) => [l.title, l]));

  for (const item of after) {
    if (!beforeMap.has(item.title)) {
      const res = await unifiedCw.POST("/labels", {
        body: {
          label: {
            title: item.title,
            description: item.description,
            color: item.color,
            show_on_sidebar: item.showOnSidebar,
          },
          title: item.title,
          description: item.description,
          color: item.color,
          show_on_sidebar: item.showOnSidebar,
        } as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
      const created = (res.data ?? {}) as { id?: unknown; title?: unknown };
      if (typeof created.id === "number") {
        labelIdByTitle.set(typeof created.title === "string" ? created.title : item.title, created.id);
      }
    }
  }

  for (const prev of before) {
    if (!afterMap.has(prev.title)) {
      const id = labelIdByTitle.get(prev.title);
      if (!id) {
        throw new Error(`Label "${prev.title}" has no server ID in Chatwoot`);
      }
      const res = await unifiedCw.DELETE("/labels/{id}", {
        params: { path: { id } },
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
      labelIdByTitle.delete(prev.title);
    }
  }

  return after;
}

async function syncTeamsDiff(before: Team[], after: Team[]): Promise<Team[]> {
  const beforeMap = new Map(before.map((t) => [t.id, t]));
  const afterMap = new Map(after.map((t) => [t.id, t]));
  const updatedList = [...after];

  for (const item of after) {
    const prev = beforeMap.get(item.id);
    if (!prev) {
      const res = await unifiedCw.POST("/teams", {
        body: {
          team: {
            name: item.name,
            description: item.description,
            allow_auto_assign: item.autoAssign,
          },
          name: item.name,
          description: item.description,
          allow_auto_assign: item.autoAssign,
        } as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
      const created = (res.data ?? {}) as { id?: unknown };
      const teamId = typeof created.id === "number" && created.id > 0 ? created.id : item.id;
      const idx = updatedList.findIndex((x) => x.id === item.id);
      if (idx >= 0) updatedList[idx] = { ...updatedList[idx], id: teamId };

      if (item.members.length > 0) {
        const mRes = await unifiedCw.POST("/teams/{team_id}/team_members", {
          params: { path: { team_id: teamId } },
          body: { user_ids: item.members } as never,
        });
        if (mRes.error || !mRes.response.ok) {
          throw new Error(extractGatewayError(mRes.error, mRes.response.status));
        }
      }
    } else {
      if (prev.name !== item.name || prev.description !== item.description || prev.autoAssign !== item.autoAssign) {
        const res = await unifiedCw.PATCH("/teams/{team_id}", {
          params: { path: { team_id: item.id } },
          body: {
            team: {
              name: item.name,
              description: item.description,
              allow_auto_assign: item.autoAssign,
            },
            name: item.name,
            description: item.description,
            allow_auto_assign: item.autoAssign,
          } as never,
        });
        if (res.error || !res.response.ok) {
          throw new Error(extractGatewayError(res.error, res.response.status));
        }
      }
      if (JSON.stringify([...prev.members].sort()) !== JSON.stringify([...item.members].sort())) {
        const mRes = await unifiedCw.PATCH("/teams/{team_id}/team_members", {
          params: { path: { team_id: item.id } },
          body: { user_ids: item.members } as never,
        });
        if (mRes.error || !mRes.response.ok) {
          throw new Error(extractGatewayError(mRes.error, mRes.response.status));
        }
      }
    }
  }

  for (const prev of before) {
    if (!afterMap.has(prev.id)) {
      const res = await unifiedCw.DELETE("/teams/{team_id}", {
        params: { path: { team_id: prev.id } },
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  return updatedList;
}

type InboxWithConfig = Inbox & {
  channelParams?: Record<string, unknown>;
  config?: {
    profile?: {
      greetingEnabled?: boolean;
      greetingMessage?: string;
      emailCollect?: boolean;
      allowMessagesAfterResolved?: boolean;
    };
    csat?: {
      enabled?: boolean;
    };
    businessHours?: {
      enabled?: boolean;
      message?: string;
      timezone?: string;
    };
  };
};

function buildCreateInboxPayload(item: InboxWithConfig, params: Record<string, unknown>): Record<string, unknown> {
  switch (item.channel) {
    case "telegram":
      return {
        name: item.name,
        channel: {
          type: "telegram",
          bot_token: params.botToken,
        },
      };
    case "website":
      return {
        name: item.name,
        greeting_enabled: params.greetingEnabled,
        greeting_message: params.greetingMessage,
        channel: {
          type: "web_widget",
          website_url: params.websiteUrl,
          widget_color: params.widgetColor,
          welcome_title: params.welcomeTitle,
          welcome_tagline: params.welcomeTagline,
        },
      };
    case "api":
      return {
        name: item.name,
        channel: {
          type: "api",
          webhook_url: params.webhookUrl ?? "",
        },
      };
    case "email":
      return {
        name: item.name,
        channel: {
          type: "email",
          email: params.email,
        },
      };
    case "line":
      return {
        name: item.name,
        channel: {
          type: "line",
          line_channel_id: params.lineChannelId,
          line_channel_secret: params.lineChannelSecret,
          line_channel_token: params.lineChannelToken,
        },
      };
    default:
      return {
        name: item.name,
        channel: {
          type: item.channel,
          ...params,
        },
      };
  }
}

async function syncInboxesDiff(before: Inbox[], after: Inbox[]): Promise<Inbox[]> {
  if (after.length < before.length) {
    throw new Error("Deleting inboxes is not enabled on the Studio gateway (DELETE /inboxes/{id})");
  }

  const beforeMap = new Map(before.map((i) => [i.id, i as InboxWithConfig]));
  const updatedList = [...after] as InboxWithConfig[];

  for (const rawItem of after) {
    const item = rawItem as InboxWithConfig;
    const prev = beforeMap.get(item.id);
    if (!prev) {
      const params = (item.channelParams ?? {}) as Record<string, unknown>;
      // 2026-10-19: Facebook, Instagram and WhatsApp Cloud inboxes are made by Chatwoot's own callbacks; a second
      // POST /inboxes with that channel type failed with "Channel must exist". Adopt the id Chatwoot gave instead.
      const existingId = Number(params.existingInboxId);
      if (Number.isInteger(existingId) && existingId > 0) {
        delete item.channelParams;
        const idx = updatedList.findIndex((x) => x === item);
        if (updatedList.some((x) => x !== item && x.id === existingId)) {
          if (idx >= 0) updatedList.splice(idx, 1);
        } else if (idx >= 0) {
          updatedList[idx] = { ...item, id: existingId, slug: `inbox-${existingId}` };
        }
        continue;
      }
      try {
        const body = buildCreateInboxPayload(item, params);
        const res = await unifiedCw.POST("/inboxes", { body });
        if (res.error || !res.response.ok) {
          throw new Error(extractGatewayError(res.error, res.response.status));
        }
        const created = ((res.data as { payload?: Record<string, unknown> } | null)?.payload ??
          res.data ??
          {}) as Record<string, unknown>;
        const createdId = typeof created.id === "number" && created.id > 0 ? created.id : item.id;
        const createdName = typeof created.name === "string" && created.name.trim() ? created.name.trim() : item.name;
        const idx = updatedList.findIndex((x) => x.id === item.id);
        if (idx >= 0) {
          const cleanItem: InboxWithConfig = {
            ...updatedList[idx],
            id: createdId,
            slug: `inbox-${createdId}`,
            name: createdName,
          };
          delete cleanItem.channelParams;
          updatedList[idx] = cleanItem;
        }
        if (item.agents.length > 0) {
          const mRes = await unifiedCw.POST("/inbox_members", {
            body: { inbox_id: createdId, user_ids: item.agents } as never,
          });
          if (mRes.error || !mRes.response.ok) {
            throw new Error(extractGatewayError(mRes.error, mRes.response.status));
          }
        }
      } finally {
        delete item.channelParams;
        const idx = updatedList.findIndex((x) => x.id === item.id);
        if (idx >= 0 && updatedList[idx]) {
          delete updatedList[idx].channelParams;
        }
      }
      continue;
    }
    const generalChanged =
      prev.name !== item.name ||
      prev.autoAssign !== item.autoAssign ||
      JSON.stringify(prev.config) !== JSON.stringify(item.config);
    if (generalChanged) {
      const cfg = item.config;
      const body: Record<string, unknown> = {
        name: item.name,
        enable_auto_assignment: item.autoAssign,
      };
      if (cfg?.profile) {
        body.greeting_enabled = cfg.profile.greetingEnabled;
        body.greeting_message = cfg.profile.greetingMessage;
        body.enable_email_collect = cfg.profile.emailCollect;
        body.allow_messages_after_resolved = cfg.profile.allowMessagesAfterResolved;
      }
      if (cfg?.csat) {
        body.csat_survey_enabled = cfg.csat.enabled;
      }
      if (cfg?.businessHours) {
        body.working_hours_enabled = cfg.businessHours.enabled;
        body.out_of_office_message = cfg.businessHours.message;
        body.timezone = cfg.businessHours.timezone;
      }
      const res = await unifiedCw.PATCH("/inboxes/{id}", {
        params: { path: { id: item.id } },
        body: body as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }

    if (JSON.stringify([...prev.agents].sort()) !== JSON.stringify([...item.agents].sort())) {
      const mRes = await unifiedCw.PATCH("/inbox_members", {
        body: { inbox_id: item.id, user_ids: item.agents } as never,
      });
      if (mRes.error || !mRes.response.ok) {
        throw new Error(extractGatewayError(mRes.error, mRes.response.status));
      }
    }
  }

  return updatedList;
}

async function syncMacrosDiff(before: Macro[], after: Macro[]): Promise<Macro[]> {
  const beforeMap = new Map(before.map((m) => [m.id, m]));
  const afterMap = new Map(after.map((m) => [m.id, m]));
  const updatedList = [...after];

  for (const item of after) {
    const prev = beforeMap.get(item.id);
    if (!prev) {
      const res = await unifiedCw.POST("/macros", {
        body: toCwMacroPayload(item),
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
      const payload = ((res.data as { payload?: { id?: unknown } } | null)?.payload ?? res.data ?? {}) as {
        id?: unknown;
      };
      if (typeof payload.id === "number" && payload.id > 0) {
        const idx = updatedList.findIndex((x) => x.id === item.id);
        if (idx >= 0) updatedList[idx] = { ...updatedList[idx], id: payload.id };
      }
    } else if (JSON.stringify(prev) !== JSON.stringify(item)) {
      const res = await unifiedCw.PATCH("/macros/{id}", {
        params: { path: { id: item.id } },
        body: toCwMacroPayload(item),
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  for (const prev of before) {
    if (!afterMap.has(prev.id)) {
      const res = await unifiedCw.DELETE("/macros/{id}", {
        params: { path: { id: prev.id } },
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  return updatedList;
}

/**
 * Invoked by `src/lib/cw/store.ts` whenever `useCwShared` lists change while `linkedSession()` is active.
 * Performs the real gateway calls via `unifiedCw`, updates server-assigned IDs, or rolls back on error.
 */
export async function handleLinkedSharedWrite(
  changedKeys: CwListKey[],
  current: CwLists,
  hasWaitingCaller: boolean,
): Promise<{ error?: string }> {
  if (!lastSyncedShared) {
    setLastSyncedShared(current);
    return {};
  }

  const base = lastSyncedShared;
  try {
    if (changedKeys.includes("agents") && JSON.stringify(base.agents) !== JSON.stringify(current.agents)) {
      await attemptForbiddenGatewayWrite("agents", "POST", {
        count: current.agents.length,
      });
    }

    const nextPatch: Partial<CwLists> = {};

    if (
      changedKeys.includes("cannedResponses") &&
      JSON.stringify(base.cannedResponses) !== JSON.stringify(current.cannedResponses)
    ) {
      nextPatch.cannedResponses = await syncCannedResponsesDiff(base.cannedResponses, current.cannedResponses);
    }

    if (changedKeys.includes("labels") && JSON.stringify(base.labels) !== JSON.stringify(current.labels)) {
      nextPatch.labels = await syncLabelsDiff(base.labels, current.labels);
    }

    if (changedKeys.includes("teams") && JSON.stringify(base.teams) !== JSON.stringify(current.teams)) {
      nextPatch.teams = await syncTeamsDiff(base.teams, current.teams);
    }

    if (changedKeys.includes("inboxes") && JSON.stringify(base.inboxes) !== JSON.stringify(current.inboxes)) {
      nextPatch.inboxes = await syncInboxesDiff(base.inboxes, current.inboxes);
    }

    if (changedKeys.includes("macros") && JSON.stringify(base.macros) !== JSON.stringify(current.macros)) {
      nextPatch.macros = await syncMacrosDiff(base.macros, current.macros);
    }

    applyServerSharedState({
      agents: current.agents,
      teams: nextPatch.teams ?? current.teams,
      inboxes: nextPatch.inboxes ?? current.inboxes,
      labels: nextPatch.labels ?? current.labels,
      cannedResponses: nextPatch.cannedResponses ?? current.cannedResponses,
      macros: nextPatch.macros ?? current.macros,
    });
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Roll back optimistic state immediately to lastSyncedShared
    applyServerSharedState({
      agents: base.agents,
      teams: base.teams,
      inboxes: base.inboxes,
      labels: base.labels,
      cannedResponses: base.cannedResponses,
      macros: base.macros,
    });
    if (!hasWaitingCaller) {
      toast.error(message);
    }
    return { error: message };
  }
}

/* ------------------------------------------------------------------ Custom Attributes & Webhooks & Profile ------ */

export interface CustomAttributeRow {
  id: number;
  name: string;
  attrKey: string;
  description: string;
  type: "Text" | "Number" | "Link" | "Date" | "List" | "Checkbox";
  model: "conversation" | "contact";
  badges?: ("Pre-chat" | "Resolution")[];
  values?: string[];
  regexPattern?: string;
  regexCue?: string;
}

export interface WebhookRow {
  id: number;
  url: string;
  name: string;
  events: string[];
}

const DISPLAY_TYPE_FROM_CW: Record<string, CustomAttributeRow["type"]> = {
  text: "Text",
  number: "Number",
  link: "Link",
  date: "Date",
  list: "List",
  checkbox: "Checkbox",
  "0": "Text",
  "1": "Number",
  "2": "Number",
  "3": "Number",
  "4": "Link",
  "5": "Date",
  "6": "List",
  "7": "Checkbox",
};

const DISPLAY_TYPE_TO_CW: Record<CustomAttributeRow["type"], string> = {
  Text: "text",
  Number: "number",
  Link: "link",
  Date: "date",
  List: "list",
  Checkbox: "checkbox",
};

export function mapRawCustomAttributes(raw: unknown): CustomAttributeRow[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { payload?: unknown[] }).payload)
      ? (raw as { payload: unknown[] }).payload
      : [];
  return list.flatMap((item): CustomAttributeRow[] => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0) return [];
    const modelStr = String(r.attribute_model ?? "conversation_attribute");
    const model: CustomAttributeRow["model"] = modelStr.includes("contact") ? "contact" : "conversation";
    const typeStr = String(r.attribute_display_type ?? "text").toLowerCase();
    const type: CustomAttributeRow["type"] = DISPLAY_TYPE_FROM_CW[typeStr] ?? "Text";
    const values = Array.isArray(r.attribute_values) ? r.attribute_values.map((v) => String(v)) : undefined;
    return [
      {
        id,
        name: typeof r.attribute_display_name === "string" ? r.attribute_display_name : `Attribute #${id}`,
        attrKey: typeof r.attribute_key === "string" ? r.attribute_key : `attr_${id}`,
        description:
          typeof r.attribute_description === "string" && r.attribute_description.trim()
            ? r.attribute_description
            : typeof r.attribute_display_name === "string"
              ? r.attribute_display_name
              : `Attribute #${id}`,
        model,
        type,
        values,
        regexPattern: typeof r.regex_pattern === "string" ? r.regex_pattern : undefined,
        regexCue: typeof r.regex_cue === "string" ? r.regex_cue : undefined,
      },
    ];
  });
}

function toCwAttributePayload(attr: CustomAttributeRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    attribute_display_name: attr.name,
    attribute_description: attr.description || attr.name,
    attribute_display_type: DISPLAY_TYPE_TO_CW[attr.type] ?? "text",
    attribute_key: attr.attrKey,
    attribute_model: attr.model === "contact" ? "contact_attribute" : "conversation_attribute",
    attribute_values: attr.type === "List" ? (attr.values ?? []) : [],
  };
  if (attr.regexPattern) {
    payload.regex_pattern = attr.regexPattern;
    payload.regex_cue = attr.regexCue ?? "";
  }
  return {
    custom_attribute_definition: payload,
    ...payload,
  };
}

export async function syncCustomAttributesDiff(
  before: CustomAttributeRow[],
  after: CustomAttributeRow[],
): Promise<CustomAttributeRow[]> {
  const beforeMap = new Map(before.map((a) => [a.id, a]));
  const afterMap = new Map(after.map((a) => [a.id, a]));
  const updated = [...after];

  for (const item of after) {
    const prev = beforeMap.get(item.id);
    if (!prev) {
      const res = await unifiedCw.POST("/custom_attribute_definitions", {
        body: toCwAttributePayload(item) as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
      const created = (res.data ?? {}) as { id?: unknown };
      if (typeof created.id === "number" && created.id > 0) {
        const idx = updated.findIndex((x) => x.id === item.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], id: created.id };
      }
    } else if (JSON.stringify(prev) !== JSON.stringify(item)) {
      const res = await unifiedCw.PATCH("/custom_attribute_definitions/{id}", {
        params: { path: { id: item.id } },
        body: toCwAttributePayload(item) as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  for (const prev of before) {
    if (!afterMap.has(prev.id)) {
      const res = await unifiedCw.DELETE("/custom_attribute_definitions/{id}", {
        params: { path: { id: prev.id } },
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  return updated;
}

export function mapRawWebhooks(raw: unknown): WebhookRow[] {
  const payload =
    raw && typeof raw === "object" && "payload" in raw ? (raw as { payload?: { webhooks?: unknown[] } }).payload : raw;
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { webhooks?: unknown[] }).webhooks)
      ? (payload as { webhooks: unknown[] }).webhooks
      : [];

  return list.flatMap((item): WebhookRow[] => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0) return [];
    const events = Array.isArray(r.subscriptions) ? r.subscriptions.map((s) => String(s)) : [];
    return [
      {
        id,
        name: typeof r.name === "string" ? r.name : "",
        url: typeof r.url === "string" ? r.url : "",
        events,
      },
    ];
  });
}

export async function fetchLinkedSettingsPreview(): Promise<SettingsPreview> {
  const [attrRes, whRes, profRes, acctRes] = await Promise.all([
    unifiedCw.GET("/custom_attribute_definitions", { params: { query: {} as never } }),
    unifiedCw.GET("/webhooks"),
    unifiedCw.GET("/profile"),
    unifiedCw.GET("/accounts/{id}", { params: { path: { id: 1 } } }),
  ]);

  // Also probe CE-unavailable areas backed by settings-preview-client stores
  void probeCeArea("custom_roles");
  void probeCeArea("agent_capacity_policies");
  void probeCeArea("saml_settings");
  void probeCeArea("captain/assistants");

  const customAttributes = attrRes.data ? mapRawCustomAttributes(attrRes.data) : [];
  const webhooks = whRes.data ? mapRawWebhooks(whRes.data) : [];
  const nowIso = new Date().toISOString();

  const prof = (profRes.data ?? {}) as Record<string, unknown>;
  const profile: ProfileSettings = {
    name: typeof prof.name === "string" ? prof.name : "Fahad",
    displayName: typeof prof.display_name === "string" ? prof.display_name : "Fahad",
    email: typeof prof.email === "string" ? prof.email : "admin@chatwoot-copy.local",
    signature: typeof prof.message_signature === "string" ? prof.message_signature : "",
    savedAt: nowIso,
  };

  const acct = (acctRes.data ?? {}) as Record<string, unknown>;
  const account: AccountExtras = {
    supportEmail: typeof acct.support_email === "string" ? acct.support_email : "",
    incomingEmailDomain: typeof acct.domain === "string" ? acct.domain : "",
    transcribeAudio: false,
    savedAt: nowIso,
  };

  const autoResolveMins = typeof acct.auto_resolve_after === "number" ? acct.auto_resolve_after : 0;
  const lists: Record<ListName, SavedList | null> = {
    assignmentPolicies: { rev: 1, items: [] },
    bots: { rev: 1, items: [] },
    webhooks: { rev: 1, items: webhooks as unknown as Record<string, unknown>[] },
    dashboardApps: { rev: 1, items: [] },
    integrationHooks: { rev: 1, items: [] },
    customAttributes: { rev: 1, items: customAttributes as unknown as Record<string, unknown>[] },
    customRoles: { rev: 1, items: [] },
    dataImports: { rev: 1, items: [] },
  };

  return {
    conversationWorkflow: {
      autoResolve: {
        enabled: autoResolveMins > 0,
        amount: autoResolveMins > 0 ? autoResolveMins : 40,
        unit: "minutes",
        message: typeof acct.auto_resolve_message === "string" ? acct.auto_resolve_message : "",
        ignoreWaiting: Boolean(acct.auto_resolve_ignore_waiting),
        label: "",
      },
      requiredAttributes: [],
      savedAt: nowIso,
    },
    saml: null,
    slack: null,
    captain: null,
    account,
    profile,
    billing: null,
    integrations: null,
    lists,
  };
}

export async function syncLinkedListSave<T extends { id: number }>(
  name: ListName,
  before: T[],
  after: T[],
): Promise<T[]> {
  if (name === "customAttributes") {
    const synced = await syncCustomAttributesDiff(
      before as unknown as CustomAttributeRow[],
      after as unknown as CustomAttributeRow[],
    );
    return synced as unknown as T[];
  }
  if (name === "webhooks") {
    await attemptForbiddenGatewayWrite("webhooks", "POST", { count: after.length });
  }
  if (name === "customRoles") {
    await rejectCeWrite("custom_roles");
  }
  if (name === "assignmentPolicies") {
    await rejectCeWrite("agent_capacity_policies");
  }
  throw new Error(`Refused by Studio gateway: ${name} write endpoint is not enabled in linked mode`);
}

export async function syncLinkedSectionSave(
  section: keyof SettingsPreview,
  value: Record<string, unknown>,
): Promise<unknown> {
  if (section === "profile") {
    await attemptForbiddenGatewayWrite("profile", "PUT", value);
  }
  if (section === "account" || section === "conversationWorkflow") {
    await attemptForbiddenGatewayWrite("accounts/1", "PATCH", value);
  }
  if (section === "saml") {
    await rejectCeWrite("saml_settings");
  }
  if (section === "captain") {
    await rejectCeWrite("captain/assistants");
  }
  throw new Error(`Refused by Studio gateway: ${String(section)} is not writable in linked mode`);
}

export async function fetchLinkedGeneralSettings(): Promise<SavedGeneralSettings> {
  const [acctRes, profRes] = await Promise.all([
    unifiedCw.GET("/accounts/{id}", { params: { path: { id: 1 } } }),
    unifiedCw.GET("/profile"),
  ]);
  const acct = (acctRes.data ?? {}) as Record<string, unknown>;
  const prof = (profRes.data ?? {}) as Record<string, unknown>;
  const accountsList = Array.isArray(prof.accounts) ? (prof.accounts as Record<string, unknown>[]) : [];
  const fallbackAcct = accountsList[0] ?? {};

  const name =
    (typeof acct.name === "string" && acct.name) ||
    (typeof fallbackAcct.name === "string" && fallbackAcct.name) ||
    "AIREST Copy";
  const language =
    (typeof acct.locale === "string" && acct.locale) ||
    (typeof fallbackAcct.locale === "string" && fallbackAcct.locale) ||
    "en";

  return {
    name,
    language,
    savedAt: new Date().toISOString(),
  };
}

export async function saveLinkedGeneralSettings(name: string, language: string): Promise<SavedGeneralSettings> {
  return attemptForbiddenGatewayWrite("accounts/1", "PATCH", { name, locale: language });
}

/* ------------------------------------------------------------------ Automation Rules (`/automation_rules`) ------ */

const VALID_EVENTS = new Set<AutomationEventKey>([
  "conversation_created",
  "conversation_updated",
  "conversation_resolved",
  "message_created",
  "conversation_opened",
]);

const OP_FROM_CW: Record<string, string> = {
  equal_to: "Equal to",
  not_equal_to: "Not equal to",
  contains: "Contains",
  does_not_contain: "Does not contain",
  is_present: "Is present",
  is_not_present: "Is not present",
  starts_with: "Starts With",
  is_greater_than: "Is greater than",
  is_less_than: "Is less than",
  days_before: "Days before",
};

const STATUS_FROM_CW: Record<string, string> = {
  open: "Open",
  pending: "Pending",
  snoozed: "Snoozed",
  resolved: "Resolved",
  "0": "Open",
  "1": "Resolved",
  "2": "Pending",
  "3": "Snoozed",
};

const PRIORITY_FROM_CW: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const MESSAGE_TYPE_FROM_CW: Record<string, string> = {
  incoming: "Incoming Message",
  outgoing: "Outgoing Message",
  "0": "Incoming Message",
  "1": "Outgoing Message",
};

export function mapRawAutomationRules(raw: unknown): AutomationRule[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { payload?: unknown[] }).payload)
      ? (raw as { payload: unknown[] }).payload
      : [];
  const { inboxes, agents, teams } = useCwShared.getState();

  return list.flatMap((item): AutomationRule[] => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0) return [];
    const rawEvent = typeof r.event_name === "string" ? (r.event_name as AutomationEventKey) : "conversation_created";
    const event: AutomationEventKey = VALID_EVENTS.has(rawEvent) ? rawEvent : "conversation_created";

    const rawConds = Array.isArray(r.conditions) ? r.conditions : [];
    const conditions: AutomationCondition[] = rawConds.map((c, idx) => {
      const cond = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const attrKey = typeof cond.attribute_key === "string" ? cond.attribute_key : "status";
      const opKey = typeof cond.filter_operator === "string" ? cond.filter_operator : "equal_to";
      const rawVals = Array.isArray(cond.values) ? cond.values : [];
      const values = rawVals.map((v) => {
        const s = String(v);
        if (attrKey === "status") return STATUS_FROM_CW[s.toLowerCase()] ?? s;
        if (attrKey === "priority") return PRIORITY_FROM_CW[s.toLowerCase()] ?? s;
        if (attrKey === "message_type") return MESSAGE_TYPE_FROM_CW[s.toLowerCase()] ?? s;
        if (attrKey === "inbox_id") return inboxes.find((i) => i.id === Number(v))?.name ?? s;
        if (attrKey === "team_id") return teams.find((t) => t.id === Number(v))?.name ?? s;
        if (attrKey === "assignee_id") return agents.find((a) => a.id === Number(v))?.name ?? s;
        return s;
      });
      const prevCond = idx > 0 ? (rawConds[idx - 1] as Record<string, unknown> | undefined) : undefined;
      const join = String(prevCond?.query_operator ?? "AND").toLowerCase() === "or" ? "or" : "and";
      return {
        attribute: attrKey,
        operator: OP_FROM_CW[opKey] ?? "Equal to",
        values: values.length ? values : ["Open"],
        join,
      };
    });

    const rawActs = Array.isArray(r.actions) ? r.actions : [];
    const actions: AutomationAction[] = rawActs.map((a) => {
      const act = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
      const actName = typeof act.action_name === "string" ? act.action_name : "resolve_conversation";
      const params = Array.isArray(act.action_params) ? act.action_params : [];
      const values = params.map((p) => {
        if (actName === "assign_team") {
          if (p === "nil") return "None";
          return teams.find((t) => t.id === Number(p))?.name ?? String(p);
        }
        if (actName === "assign_agent") {
          if (p === "nil") return "None";
          if (p === "last_responding_agent") return "Last Responding Agent";
          return agents.find((ag) => ag.id === Number(p))?.name ?? String(p);
        }
        return String(p);
      });
      return {
        action: actName,
        values,
      };
    });

    const createdOn =
      typeof r.created_on === "number"
        ? new Date(r.created_on * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          })
        : new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

    return [
      {
        id,
        name: typeof r.name === "string" ? r.name : `Rule #${id}`,
        description: typeof r.description === "string" ? r.description : "",
        active: r.active !== false,
        createdOn,
        runType: "instant",
        event,
        conditions: conditions.length
          ? conditions
          : [{ attribute: "status", operator: "Equal to", values: ["Open"], join: "and" }],
        actions: actions.length ? actions : [{ action: "resolve_conversation", values: [] }],
      },
    ];
  });
}

function buildLiveIdDirectory(): IdDirectory {
  const { inboxes, agents, teams } = useCwShared.getState();
  return {
    inbox: (name: string) => inboxes.find((i) => i.name === name)?.id ?? (Number(name) || 1),
    agent: (name: string) => agents.find((a) => a.name === name)?.id ?? (Number(name) || 1),
    team: (name: string) => teams.find((t) => t.name === name)?.id ?? (Number(name) || 1),
  };
}

let lastSyncedAutomationRules: AutomationRule[] = [];
let linkedAutomationRev = 1;

export async function loadLinkedAutomation(): Promise<LoadedAutomation> {
  const res = await unifiedCw.GET("/automation_rules");
  if (res.error || !res.response.ok) {
    throw new Error(extractGatewayError(res.error, res.response.status));
  }
  const rules = mapRawAutomationRules(res.data);
  lastSyncedAutomationRules = structuredClone(rules);
  return {
    rev: linkedAutomationRev,
    savedAt: new Date().toISOString(),
    items: rules.map((rule): AutomationItem => ({ kind: "rule", rule })),
    sample: false,
  };
}

export async function saveLinkedAutomation(
  items: AutomationItem[],
  baseRev: number,
): Promise<{ rev: number; savedAt: string; items: AutomationItem[] }> {
  const before = lastSyncedAutomationRules;
  const after = rulesOf(items);
  const beforeMap = new Map(before.map((r) => [r.id, r]));
  const afterMap = new Map(after.map((r) => [r.id, r]));
  const ids = buildLiveIdDirectory();
  const updatedRules = [...after];

  for (const rule of after) {
    const prev = beforeMap.get(rule.id);
    const payload = toChatwootRule(rule, ids);
    if (!prev) {
      const res = await unifiedCw.POST("/automation_rules", {
        body: payload as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
      const created = ((res.data as { payload?: { id?: unknown } } | null)?.payload ?? res.data ?? {}) as {
        id?: unknown;
      };
      if (typeof created.id === "number" && created.id > 0) {
        const idx = updatedRules.findIndex((r) => r.id === rule.id);
        if (idx >= 0) updatedRules[idx] = { ...updatedRules[idx], id: created.id };
      }
    } else if (JSON.stringify(prev) !== JSON.stringify(rule)) {
      const res = await unifiedCw.PATCH("/automation_rules/{id}", {
        params: { path: { id: rule.id } },
        body: payload as never,
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  for (const prev of before) {
    if (!afterMap.has(prev.id)) {
      const res = await unifiedCw.DELETE("/automation_rules/{id}", {
        params: { path: { id: prev.id } },
      });
      if (res.error || !res.response.ok) {
        throw new Error(extractGatewayError(res.error, res.response.status));
      }
    }
  }

  lastSyncedAutomationRules = structuredClone(updatedRules);
  linkedAutomationRev = Math.max(linkedAutomationRev, baseRev) + 1;
  const nextItems = withRules(items, updatedRules);
  return {
    rev: linkedAutomationRev,
    savedAt: new Date().toISOString(),
    items: nextItems,
  };
}

/* ------------------------------------------------------------------ Custom Filters (`/custom_filters`) ---------- */

export interface CwCustomFilter {
  id: number;
  name: string;
  filter_type: "conversation" | "contact";
  query: Record<string, unknown>;
}

export async function fetchLinkedCustomFilters(
  filterType: "conversation" | "contact" = "conversation",
): Promise<CwCustomFilter[]> {
  const res = await unifiedCw.GET("/custom_filters", {
    params: { query: { filter_type: filterType } },
  });
  if (res.error || !res.response.ok) {
    throw new Error(extractGatewayError(res.error, res.response.status));
  }
  return Array.isArray(res.data) ? (res.data as unknown as CwCustomFilter[]) : [];
}

export async function createLinkedCustomFilter(
  name: string,
  query: Record<string, unknown>,
  filterType: "conversation" | "contact" = "conversation",
): Promise<CwCustomFilter> {
  const res = await unifiedCw.POST("/custom_filters", {
    body: {
      custom_filter: { name, filter_type: filterType, query },
      name,
      filter_type: filterType,
      query,
    } as never,
  });
  if (res.error || !res.response.ok) {
    throw new Error(extractGatewayError(res.error, res.response.status));
  }
  return res.data as unknown as CwCustomFilter;
}

export async function deleteLinkedCustomFilter(id: number): Promise<void> {
  const res = await unifiedCw.DELETE("/custom_filters/{custom_filter_id}", {
    params: { path: { custom_filter_id: id } },
  });
  if (res.error || !res.response.ok) {
    throw new Error(extractGatewayError(res.error, res.response.status));
  }
}

/* ------------------------------------------------------------------ Live Reports Store (`/api/cw/reports/...`) -- */

export interface LinkedLiveMetrics {
  open: number;
  unattended: number;
  unassigned: number;
  pending: number;
}

export interface LinkedReportSummary {
  conversations_count: number;
  incoming_messages_count: number;
  outgoing_messages_count: number;
  avg_first_response_time: number;
  avg_resolution_time: number;
  resolutions_count: number;
  reply_time: number;
  bot_resolutions_count?: number;
  bot_handoffs_count?: number;
  previous?: Partial<Record<string, number>>;
}

export interface LinkedCsatRow {
  id: number;
  contact: string;
  email: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback: string;
  agent: string;
  inbox: string;
  conversation: number;
  createdAt: Date;
}

export interface LinkedCsatMetrics {
  totalResponseCount: number;
  totalSentMessagesCount: number;
  ratingsCount: Record<string, number>;
}

interface LinkedReportsState {
  loading: boolean;
  error: string | null;
  liveMetrics: LinkedLiveMetrics | null;
  summaryByKey: Record<string, LinkedReportSummary>;
  timeseriesByKey: Record<string, { timestamp: number; value: number }[]>;
  entityRowsByKey: Record<string, Record<number | string, SummaryRow>>;
  channelStats: Record<string, { open: number; resolved: number; pending: number; snoozed: number; total: number }>;
  csatRows: LinkedCsatRow[];
  csatMetrics: LinkedCsatMetrics | null;
  lastUpdatedAt: number | null;
}

export const useLinkedReportsStore = create<LinkedReportsState>(() => ({
  loading: false,
  error: null,
  liveMetrics: null,
  summaryByKey: {},
  timeseriesByKey: {},
  entityRowsByKey: {},
  channelStats: {},
  csatRows: [],
  csatMetrics: null,
  lastUpdatedAt: null,
}));

const METRIC_KEY_TO_CW: Record<string, string> = {
  conversations: "conversations_count",
  incoming: "incoming_messages_count",
  outgoing: "outgoing_messages_count",
  firstResponse: "avg_first_response_time",
  resolutionTime: "avg_resolution_time",
  resolutionCount: "resolutions_count",
  replyTime: "reply_time",
  botResolutionCount: "bot_resolutions_count",
  botHandoffCount: "bot_handoffs_count",
};

const GROUP_BY_TO_CW: Record<GroupBy, "day" | "week" | "month" | "year"> = {
  Day: "day",
  Week: "week",
  Month: "month",
  Year: "year",
};

const inflightReportKeys = new Set<string>();

export async function ensureLinkedOverviewLoaded(): Promise<void> {
  if (!linkedSession()) return;
  const key = "overview:live";
  if (inflightReportKeys.has(key)) return;
  inflightReportKeys.add(key);

  try {
    const [liveRes, chRes] = await Promise.all([
      unifiedCw.GET("/live_reports/conversation_metrics"),
      unifiedCw.GET("/summary_reports/channel"),
    ]);

    if (liveRes.error || !liveRes.response.ok) {
      useLinkedReportsStore.setState({
        error: extractGatewayError(liveRes.error, liveRes.response.status),
      });
      return;
    }

    const rawLive = (liveRes.data ?? {}) as Record<string, unknown>;
    const liveMetrics: LinkedLiveMetrics = {
      open: Number(rawLive.open ?? 0),
      unattended: Number(rawLive.unattended ?? 0),
      unassigned: Number(rawLive.unassigned ?? 0),
      pending: Number(rawLive.pending ?? 0),
    };

    const rawCh = (chRes.data && typeof chRes.data === "object" ? chRes.data : {}) as Record<
      string,
      { open?: number; resolved?: number; pending?: number; snoozed?: number; total?: number }
    >;
    const channelStats: LinkedReportsState["channelStats"] = {};
    for (const [k, v] of Object.entries(rawCh)) {
      if (v && typeof v === "object") {
        channelStats[channelName(k) || k] = {
          open: Number(v.open ?? 0),
          resolved: Number(v.resolved ?? 0),
          pending: Number(v.pending ?? 0),
          snoozed: Number(v.snoozed ?? 0),
          total: Number(v.total ?? 0),
        };
      }
    }

    useLinkedReportsStore.setState({
      liveMetrics,
      channelStats,
      error: null,
      lastUpdatedAt: Date.now(),
    });
  } finally {
    inflightReportKeys.delete(key);
  }
}

export async function ensureLinkedPeriodReportLoaded(
  period: PeriodState,
  metricKeys: string[],
  scope?: { type?: "account" | "agent" | "inbox" | "label" | "team"; id?: string },
): Promise<void> {
  if (!linkedSession()) return;
  const since = String(Math.floor(period.from.getTime() / 1000));
  const until = String(Math.floor(period.to.getTime() / 1000) + 86399);
  const groupBy = GROUP_BY_TO_CW[period.group] ?? "day";
  const type = scope?.type ?? "account";
  const id = scope?.id;
  const summaryKey = `${type}:${id ?? "all"}:${since}:${until}:${period.businessHours}`;

  if (!useLinkedReportsStore.getState().summaryByKey[summaryKey] && !inflightReportKeys.has(summaryKey)) {
    inflightReportKeys.add(summaryKey);
    void unifiedCw
      .GET("/reports/summary", {
        params: {
          query: {
            since,
            until,
            type,
            ...(id ? { id } : {}),
            business_hours: period.businessHours,
          },
        },
      })
      .then((res) => {
        if (res.error || !res.response.ok) {
          useLinkedReportsStore.setState({
            error: extractGatewayError(res.error, res.response.status),
          });
          return;
        }
        const d = (res.data ?? {}) as Record<string, unknown>;
        const summary: LinkedReportSummary = {
          conversations_count: Number(d.conversations_count ?? 0),
          incoming_messages_count: Number(d.incoming_messages_count ?? 0),
          outgoing_messages_count: Number(d.outgoing_messages_count ?? 0),
          avg_first_response_time: Number(d.avg_first_response_time ?? 0),
          avg_resolution_time: Number(d.avg_resolution_time ?? 0),
          resolutions_count: Number(d.resolutions_count ?? 0),
          reply_time: Number(d.reply_time ?? 0),
          bot_resolutions_count: Number(d.bot_resolutions_count ?? 0),
          bot_handoffs_count: Number(d.bot_handoffs_count ?? 0),
          previous: (d.previous as Partial<Record<string, number>> | undefined) ?? {},
        };
        useLinkedReportsStore.setState((s) => ({
          summaryByKey: { ...s.summaryByKey, [summaryKey]: summary },
          error: null,
          lastUpdatedAt: Date.now(),
        }));
      })
      .finally(() => {
        inflightReportKeys.delete(summaryKey);
      });
  }

  for (const mKey of metricKeys) {
    const cwMetric = METRIC_KEY_TO_CW[mKey];
    if (!cwMetric) continue;
    const tsKey = `${cwMetric}:${type}:${id ?? "all"}:${since}:${until}:${groupBy}:${period.businessHours}`;
    if (useLinkedReportsStore.getState().timeseriesByKey[tsKey] || inflightReportKeys.has(tsKey)) continue;
    inflightReportKeys.add(tsKey);
    void unifiedCw
      .GET("/reports", {
        params: {
          query: {
            metric: cwMetric as never,
            type: type as never,
            ...(id ? { id } : {}),
            since,
            until,
            group_by: groupBy,
            business_hours: period.businessHours,
          },
        },
      })
      .then((res) => {
        if (res.error || !res.response.ok) return;
        const rawList = Array.isArray(res.data) ? res.data : [];
        const points = rawList.map((pt) => {
          const r = (pt && typeof pt === "object" ? pt : {}) as { timestamp?: unknown; value?: unknown };
          return {
            timestamp: Number(r.timestamp ?? 0),
            value: Number(r.value ?? 0),
          };
        });
        useLinkedReportsStore.setState((s) => ({
          timeseriesByKey: { ...s.timeseriesByKey, [tsKey]: points },
          lastUpdatedAt: Date.now(),
        }));
      })
      .finally(() => {
        inflightReportKeys.delete(tsKey);
      });
  }
}

export function computeLinkedMetric(
  metric: { key: string; unit?: "count" | "min" },
  period: PeriodState,
  scope?: { type?: "account" | "agent" | "inbox" | "label" | "team"; id?: string },
): MetricValues {
  const since = String(Math.floor(period.from.getTime() / 1000));
  const until = String(Math.floor(period.to.getTime() / 1000) + 86399);
  const groupBy = GROUP_BY_TO_CW[period.group] ?? "day";
  const type = scope?.type ?? "account";
  const id = scope?.id;
  const cwMetric = METRIC_KEY_TO_CW[metric.key] ?? "conversations_count";
  const summaryKey = `${type}:${id ?? "all"}:${since}:${until}:${period.businessHours}`;
  const tsKey = `${cwMetric}:${type}:${id ?? "all"}:${since}:${until}:${groupBy}:${period.businessHours}`;

  const state = useLinkedReportsStore.getState();
  const summary = state.summaryByKey[summaryKey];
  const ts = state.timeseriesByKey[tsKey] ?? [];
  const avg = metric.unit === "min";

  const data = period.buckets.map((b) => {
    const startSec = Math.floor(b.start.getTime() / 1000);
    const endSec = startSec + b.days * 86400;
    const matching = ts.filter((pt) => pt.timestamp >= startSec - 43200 && pt.timestamp < endSec + 43200);
    const rawVal = matching.reduce((acc, pt) => acc + pt.value, 0);
    const val = avg ? Math.round((rawVal / 60) * 10) / 10 : Math.round(rawVal);
    return {
      day: b.label,
      long: b.long,
      start: b.start,
      days: b.days,
      value: val,
    };
  });

  const summaryRec = (summary ?? {}) as unknown as Record<string, unknown>;
  const rawTotal = summary ? Number(summaryRec[cwMetric] ?? 0) : 0;
  const total = avg ? Math.round((rawTotal / 60) * 10) / 10 : Math.round(rawTotal);
  const prevRaw = summary?.previous ? Number(summary.previous[cwMetric] ?? 0) : 0;
  const trend = prevRaw > 0 ? Math.round(((rawTotal - prevRaw) / prevRaw) * 100) : 0;

  return {
    data,
    total,
    totalText: avg ? (total > 0 ? formatDuration(total) : "--") : total.toLocaleString("en-US"),
    trend,
  };
}

export async function ensureLinkedEntitySummaryLoaded(
  kind: "agents" | "inboxes" | "teams" | "labels",
  period: PeriodState,
): Promise<void> {
  if (!linkedSession()) return;
  const since = String(Math.floor(period.from.getTime() / 1000));
  const until = String(Math.floor(period.to.getTime() / 1000) + 86399);
  const key = `${kind}:${since}:${until}:${period.businessHours}`;
  if (useLinkedReportsStore.getState().entityRowsByKey[key] || inflightReportKeys.has(key)) return;
  inflightReportKeys.add(key);

  const path =
    kind === "agents"
      ? "/summary_reports/agent"
      : kind === "inboxes"
        ? "/summary_reports/inbox"
        : kind === "teams"
          ? "/summary_reports/team"
          : "/summary_reports/label";

  try {
    const res = await unifiedCw.GET(path, {
      params: {
        query: {
          since,
          until,
          business_hours: period.businessHours,
        },
      },
    });
    if (res.error || !res.response.ok) {
      useLinkedReportsStore.setState({
        error: extractGatewayError(res.error, res.response.status),
      });
      return;
    }

    const rawList = Array.isArray(res.data) ? res.data : [];
    const map: Record<string | number, SummaryRow> = {};
    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const id = r.id !== undefined ? String(r.id) : "";
      const name = typeof r.name === "string" ? r.name : id;
      const firstMin = Math.round((Number(r.avg_first_response_time ?? 0) / 60) * 10) / 10;
      const resMin = Math.round((Number(r.avg_resolution_time ?? 0) / 60) * 10) / 10;
      const replyMin = Math.round((Number(r.avg_reply_time ?? 0) / 60) * 10) / 10;
      const row: SummaryRow = {
        id,
        name,
        conversations: Number(r.conversations_count ?? 0),
        resolutionCount: Number(r.resolved_conversations_count ?? r.resolutions_count ?? 0),
        avgFirstResponse: firstMin > 0 ? formatDuration(firstMin) : "--",
        avgResolution: resMin > 0 ? formatDuration(resMin) : "--",
        avgReply: replyMin > 0 ? formatDuration(replyMin) : "--",
      };
      if (id) map[id] = row;
      if (name) map[name] = row;
    }

    useLinkedReportsStore.setState((s) => ({
      entityRowsByKey: { ...s.entityRowsByKey, [key]: map },
      error: null,
      lastUpdatedAt: Date.now(),
    }));
  } finally {
    inflightReportKeys.delete(key);
  }
}

export async function ensureLinkedCsatLoaded(period: PeriodState): Promise<void> {
  if (!linkedSession()) return;
  const since = String(Math.floor(period.from.getTime() / 1000));
  const until = String(Math.floor(period.to.getTime() / 1000) + 86399);
  const key = `csat:${since}:${until}`;
  if (inflightReportKeys.has(key)) return;
  inflightReportKeys.add(key);

  try {
    const [listRes, metricsRes] = await Promise.all([
      unifiedCw.GET("/csat_survey_responses", { params: { query: { since, until, page: 1 } } }),
      unifiedCw.GET("/csat_survey_responses/metrics", { params: { query: { since, until } } }),
    ]);

    if (listRes.error || !listRes.response.ok) {
      useLinkedReportsStore.setState({
        error: extractGatewayError(listRes.error, listRes.response.status),
      });
      return;
    }

    const rawRows = Array.isArray(listRes.data) ? listRes.data : [];
    const csatRows: LinkedCsatRow[] = rawRows.flatMap((item): LinkedCsatRow[] => {
      if (!item || typeof item !== "object") return [];
      const r = item as Record<string, unknown>;
      const id = Number(r.id ?? 0);
      const rating = Math.min(5, Math.max(1, Number(r.rating ?? 5))) as 1 | 2 | 3 | 4 | 5;
      const contactObj = (r.contact ?? {}) as Record<string, unknown>;
      const agentObj = (r.assigned_agent ?? {}) as Record<string, unknown>;
      const convObj = (r.conversation ?? {}) as Record<string, unknown>;
      const inboxes = useCwShared.getState().inboxes;
      const inbox = inboxes.find((i) => i.id === Number(convObj.inbox_id))?.name ?? "Website";
      return [
        {
          id,
          contact: typeof contactObj.name === "string" ? contactObj.name : "Visitor",
          email: typeof contactObj.email === "string" ? contactObj.email : "",
          rating,
          feedback: typeof r.feedback_message === "string" ? r.feedback_message : "",
          agent: typeof agentObj.name === "string" ? agentObj.name : "Unassigned",
          inbox,
          conversation: Number(convObj.display_id ?? convObj.id ?? 1),
          createdAt: r.created_at ? new Date(Number(r.created_at) * 1000) : new Date(),
        },
      ];
    });

    const rawM = (metricsRes.data && typeof metricsRes.data === "object" ? metricsRes.data : {}) as Record<
      string,
      unknown
    >;
    const csatMetrics: LinkedCsatMetrics = {
      totalResponseCount: Number(rawM.total_count ?? csatRows.length),
      totalSentMessagesCount: Number(rawM.total_sent_messages_count ?? csatRows.length),
      ratingsCount: (rawM.ratings_count as Record<string, number> | undefined) ?? {},
    };

    useLinkedReportsStore.setState({
      csatRows,
      csatMetrics,
      error: null,
      lastUpdatedAt: Date.now(),
    });
  } finally {
    inflightReportKeys.delete(key);
  }
}

/* ------------------------------------------------------------------ U-4: Realtime Settings & Reports Sync ------ */

export function handleRealtimeSettingsEvent(eventName: string, payload: Record<string, unknown>): void {
  if (!linkedSession()) return;

  if (eventName === "inbox_created" || eventName === "inbox_updated") {
    const shared = useCwShared.getState();
    const realAgentIds = shared.agents.map((a) => a.id);
    const mapped = toSharedInboxes([payload], realAgentIds);
    const updatedInbox = mapped[0];
    if (updatedInbox) {
      const exists = shared.inboxes.some((i) => i.id === updatedInbox.id);
      const nextInboxes = exists
        ? shared.inboxes.map((i) => (i.id === updatedInbox.id ? { ...i, ...updatedInbox, agents: i.agents } : i))
        : [...shared.inboxes, updatedInbox];
      showLinkedLists({
        agents: shared.agents,
        inboxes: nextInboxes,
        teams: shared.teams,
        labels: shared.labels,
        cannedResponses: shared.cannedResponses,
        macros: shared.macros,
      });
    }
    return;
  }

  if (
    eventName === "conversation_created" ||
    eventName === "conversation_updated" ||
    eventName === "conversation_status_changed"
  ) {
    const rawLabels = Array.isArray(payload.labels)
      ? payload.labels.filter((l): l is string => typeof l === "string" && Boolean(l.trim()))
      : [];
    if (rawLabels.length > 0) {
      const shared = useCwShared.getState();
      const missing = rawLabels.filter((title) => !shared.labels.some((l) => l.id === title || l.title === title));
      if (missing.length > 0) {
        const added: Label[] = missing.map((title) => ({
          id: title,
          title,
          description: "",
          color: "#6366f1",
          showOnSidebar: true,
        }));
        showLinkedLists({
          agents: shared.agents,
          inboxes: shared.inboxes,
          teams: shared.teams,
          labels: [...shared.labels, ...added],
          cannedResponses: shared.cannedResponses,
          macros: shared.macros,
        });
      }
    }

    if (useLinkedReportsStore.getState().liveMetrics !== null) {
      void ensureLinkedOverviewLoaded();
    }
  } else if (eventName === "message_created") {
    if (useLinkedReportsStore.getState().liveMetrics !== null) {
      void ensureLinkedOverviewLoaded();
    }
  }
}

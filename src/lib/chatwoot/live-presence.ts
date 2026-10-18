// V-18: linked-mode staff presence + typing, fed by the Chatwoot realtime bus
// (`conversation_typing_on` / `conversation_typing_off`, also ActionCable's `conversation.typing_on` /
// `conversation.typing_off`) plus Studio tab heartbeats. Preview keeps `/api/preview-sim/presence`.
// TTL 20 s sits inside the required 15–30 s window (Chatwoot PRESENCE_DURATION) so a dropped agent
// cannot leave the bar stuck. The reply box is never locked.
// biome-ignore lint/correctness/noUndeclaredDependencies: Next.js resolves "server-only" itself
import "server-only";

import { type RealtimeEventEnvelope, subscribeRealtimeEvents } from "@/lib/chatwoot/realtime-bus";

export const LIVE_PRESENCE_TTL_MS = 20_000;
export const LIVE_TYPING_TTL_MS = 20_000;

export interface PresenceOther {
  agentId: number;
  name: string;
  typing: boolean;
}

interface TabEntry {
  tab: string;
  conv: number;
  agentId: number;
  name: string;
  typing: boolean;
  typingAt: number;
  seenAt: number;
}

interface LiveAgentEntry {
  conv: number;
  agentId: number;
  name: string;
  typing: boolean;
  typingAt: number;
  seenAt: number;
}

interface LivePresenceState {
  tabs: Map<string, TabEntry>;
  live: Map<string, LiveAgentEntry>;
  subscribed: boolean;
}

const holder = globalThis as typeof globalThis & {
  __studioLinkedPresence?: LivePresenceState;
};

function state(): LivePresenceState {
  if (!holder.__studioLinkedPresence) {
    holder.__studioLinkedPresence = { tabs: new Map(), live: new Map(), subscribed: false };
  }
  return holder.__studioLinkedPresence;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function liveKey(conv: number, agentId: number): string {
  return `${conv}:${agentId}`;
}

export function typingEventKind(event: string): "on" | "off" | null {
  const normalized = event.trim().replace(/\./g, "_");
  if (normalized === "conversation_typing_on") return "on";
  if (normalized === "conversation_typing_off") return "off";
  return null;
}

function conversationIdOf(envelope: RealtimeEventEnvelope): number | null {
  if (envelope.conversationId !== null) return envelope.conversationId;
  const payload = obj(envelope.payload);
  const nested = obj(payload.conversation);
  return (
    num(nested.id) ??
    num(nested.display_id) ??
    num(payload.id) ??
    num(payload.display_id) ??
    num(payload.conversation_id)
  );
}

/** Staff only (Chatwoot `user.webhook_data` has `type: "user"`; contacts are `"contact"`). */
function staffFromPayload(payload: Record<string, unknown>): { agentId: number; name: string } | null {
  const user = obj(payload.user);
  const type = str(user.type);
  if (type && type !== "user") return null;
  const id = num(user.id);
  const name = str(user.name);
  if (id === null || !Number.isInteger(id) || id <= 0 || !name) return null;
  return { agentId: id, name };
}

function prune(now: number): void {
  const s = state();
  for (const [tab, entry] of s.tabs) {
    if (now - entry.seenAt > LIVE_PRESENCE_TTL_MS) s.tabs.delete(tab);
    else if (entry.typing && now - entry.typingAt > LIVE_TYPING_TTL_MS) entry.typing = false;
  }
  for (const [key, entry] of s.live) {
    if (now - entry.seenAt > LIVE_PRESENCE_TTL_MS) s.live.delete(key);
    else if (entry.typing && now - entry.typingAt > LIVE_TYPING_TTL_MS) entry.typing = false;
  }
}

export function applyRealtimePresenceEnvelope(envelope: RealtimeEventEnvelope): void {
  const kind = typingEventKind(envelope.event) ?? typingEventKind(str(obj(envelope.payload).event) ?? "");
  if (!kind) return;
  const conv = conversationIdOf(envelope);
  if (conv === null) return;
  const staff = staffFromPayload(obj(envelope.payload));
  if (!staff) return;
  const now = Date.now();
  const s = state();
  const key = liveKey(conv, staff.agentId);
  const prev = s.live.get(key);
  if (kind === "on") {
    s.live.set(key, {
      conv,
      agentId: staff.agentId,
      name: staff.name,
      typing: true,
      typingAt: prev?.typing ? prev.typingAt : now,
      seenAt: now,
    });
    return;
  }
  s.live.set(key, {
    conv,
    agentId: staff.agentId,
    name: staff.name,
    typing: false,
    typingAt: 0,
    seenAt: now,
  });
}

export function ensureLivePresenceSubscription(): void {
  const s = state();
  if (s.subscribed) return;
  s.subscribed = true;
  subscribeRealtimeEvents((envelope) => {
    applyRealtimePresenceEnvelope(envelope);
  });
}

export function upsertStudioPresence(input: {
  tab: string;
  conv: number;
  agentId: number;
  name: string;
  typing: boolean;
}): PresenceOther[] {
  ensureLivePresenceSubscription();
  const now = Date.now();
  prune(now);
  const s = state();
  const before = s.tabs.get(input.tab);
  let typingAt = 0;
  if (input.typing) typingAt = before?.typing && before.conv === input.conv ? before.typingAt : now;
  s.tabs.set(input.tab, {
    tab: input.tab,
    conv: input.conv,
    agentId: input.agentId,
    name: input.name,
    typing: input.typing,
    typingAt,
    seenAt: now,
  });
  return othersFor(input.conv, input.agentId, input.tab);
}

export function leaveStudioPresence(tab: string, conv: number): void {
  const s = state();
  if (s.tabs.get(tab)?.conv === conv) s.tabs.delete(tab);
}

export function othersFor(conv: number, excludeAgentId: number, excludeTab?: string): PresenceOther[] {
  const now = Date.now();
  prune(now);
  const s = state();
  const others = new Map<number, PresenceOther>();
  const add = (agentId: number, name: string, typing: boolean) => {
    if (agentId === excludeAgentId) return;
    const seen = others.get(agentId);
    others.set(agentId, {
      agentId,
      name,
      typing: (seen?.typing ?? false) || typing,
    });
  };
  for (const entry of s.tabs.values()) {
    if (entry.conv !== conv) continue;
    if (excludeTab && entry.tab === excludeTab) continue;
    add(entry.agentId, entry.name, entry.typing);
  }
  for (const entry of s.live.values()) {
    if (entry.conv !== conv) continue;
    add(entry.agentId, entry.name, entry.typing);
  }
  return [...others.values()];
}

ensureLivePresenceSubscription();

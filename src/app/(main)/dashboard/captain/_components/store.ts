"use client";
// V-9 (F208 / item 160.3): Captain store backed by server-side `/api/captain-state` (`.studio-data/captain-state.json`),
// indexed per isolated client (`client_test_a` / `client_test_b`). Preserves all existing exports so every Captain
// page continues to work seamlessly, while persisting edits across page reloads (F5).
import * as React from "react";

import {
  assistants,
  type CaptainDocument,
  connectedInboxes,
  documents,
  faqs,
  guardrails,
  guidelines,
  scenarios,
  suggestions,
  tools,
} from "./data";

export type StoredDocument = CaptainDocument & { content?: string };

const initial = {
  assistants,
  connectedInboxes,
  documents: documents as StoredDocument[],
  faqs,
  guardrails,
  guidelines,
  scenarios,
  suggestions,
  tools,
};
type CaptainState = typeof initial;
type Key = keyof CaptainState;

const state: CaptainState = { ...initial };
const listeners = new Set<() => void>();

const ACTIVE_CLIENT_STORAGE_KEY = "studio_active_captain_client_id";
let activeClientId: "client_test_a" | "client_test_b" = "client_test_a";

function readStoredCaptainClient(): "client_test_a" | "client_test_b" {
  if (typeof window === "undefined") return activeClientId;
  try {
    const raw = window.localStorage.getItem(ACTIVE_CLIENT_STORAGE_KEY)?.trim();
    if (raw === "client_test_a" || raw === "client_test_b") {
      activeClientId = raw;
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return activeClientId;
}
const clientListeners = new Set<() => void>();

function notifyListeners() {
  for (const cb of listeners) cb();
}

function notifyClientListeners() {
  for (const cb of clientListeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function subscribeClient(cb: () => void) {
  clientListeners.add(cb);
  return () => clientListeners.delete(cb);
}

export function getActiveCaptainClient(): "client_test_a" | "client_test_b" {
  return readStoredCaptainClient();
}

export async function reloadCaptainClientState(clientId: "client_test_a" | "client_test_b" = activeClientId) {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`/api/captain-state?clientId=${encodeURIComponent(clientId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-studio-client-id": clientId,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      ok?: boolean;
      state?: Partial<CaptainState>;
      budget?: unknown;
    };
    if (payload?.ok && payload.state) {
      const s = payload.state;
      if (Array.isArray(s.assistants)) state.assistants = s.assistants;
      if (Array.isArray(s.connectedInboxes)) state.connectedInboxes = s.connectedInboxes;
      if (Array.isArray(s.documents)) state.documents = s.documents;
      if (Array.isArray(s.faqs)) state.faqs = s.faqs;
      if (Array.isArray(s.guardrails)) state.guardrails = s.guardrails;
      if (Array.isArray(s.guidelines)) state.guidelines = s.guidelines;
      if (Array.isArray(s.scenarios)) state.scenarios = s.scenarios;
      if (Array.isArray(s.suggestions)) state.suggestions = s.suggestions;
      if (Array.isArray(s.tools)) state.tools = s.tools;
      notifyListeners();
    }
    return payload;
  } catch {
    return null;
  }
}

export function setActiveCaptainClient(nextClientId: "client_test_a" | "client_test_b") {
  if (activeClientId === nextClientId) return;
  activeClientId = nextClientId;
  notifyClientListeners();
  void reloadCaptainClientState(nextClientId);
}

export function useActiveCaptainClient() {
  const clientId = React.useSyncExternalStore(
    subscribeClient,
    () => activeClientId,
    () => "client_test_a" as const,
  );
  return [clientId, setActiveCaptainClient] as const;
}

let hydratedOnce = false;
if (typeof window !== "undefined" && !hydratedOnce) {
  hydratedOnce = true;
  void reloadCaptainClientState(activeClientId);
}

async function persistCaptainListToServer<K extends Key>(key: K, value: CaptainState[K]) {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/captain-state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-studio-client-id": activeClientId,
      },
      body: JSON.stringify({
        clientId: activeClientId,
        key,
        value,
      }),
    });
  } catch {
    // non-fatal network fallback
  }
}

export function setCaptainList<K extends Key>(
  key: K,
  next: CaptainState[K] | ((prev: CaptainState[K]) => CaptainState[K]),
) {
  const updated = typeof next === "function" ? (next as (prev: CaptainState[K]) => CaptainState[K])(state[key]) : next;
  state[key] = updated;
  notifyListeners();
  void persistCaptainListToServer(key, updated);
}

export function useCaptainList<K extends Key>(key: K) {
  return React.useSyncExternalStore(
    subscribe,
    () => state[key],
    () => initial[key],
  );
}

// Same shape as React.useState, so a page keeps its `[items, setItems]` code.
export function useCaptainState<K extends Key>(key: K) {
  const items = useCaptainList(key);
  const set = React.useCallback(
    (next: CaptainState[K] | ((prev: CaptainState[K]) => CaptainState[K])) => setCaptainList(key, next),
    [key],
  );
  return [items, set] as const;
}

export const nextId = (list: { id: number }[]) => list.reduce((max, item) => Math.max(max, item.id), 0) + 1;

// Playground "Add … permanently": a temporary scenario or rule becomes a saved one.
export function addPermanently(group: "scenarios" | "guidelines" | "guardrails", text: string) {
  if (group === "scenarios")
    setCaptainList("scenarios", (l) => [
      ...l,
      { id: nextId(l), title: text.split("\n")[0], description: "", instruction: text, tools: [], enabled: true },
    ]);
  else setCaptainList(group, (l) => [...l, text]);
}

// Playground "Add document permanently": the pasted reference text becomes a document named by its first line.
export function addKnowledgeDocument(text: string) {
  const name = text.trim().split("\n")[0].slice(0, 80);
  setCaptainList("documents", (l) => [
    {
      id: nextId(l),
      name,
      content: text,
      source: "pdf",
      url: "Playground reference text",
      status: "Updated",
      syncedAgo: "Just now",
      faqs: 0,
      conversations: 0,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    },
    ...l,
  ]);
}

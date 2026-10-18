"use client";

// L-2 (plan r1-chatwoot-link/خطة.md 4, phase 1): the parallel read path; L-3 (phase 2) adds postLinked for the
// conversation writes, which go to /api/chatwoot/* only. These hooks read /api/chatwoot/* only, and
// only when their section is linked; they never touch the preview stores (cw-store, contacts-store, preview-sim) or
// .preview-state. Keys are "cw:<id>", so nothing of the preview can stick to a Chatwoot record (plan 5, risk 2).
// A failure is kept as its words ("not linked: no token", "refused: not the test copy", "unreachable", ...): the page
// shows it, and never falls back to preview data.
import * as React from "react";

import type {
  LinkErrorBody,
  LinkedContactBody,
  LinkedContactsBody,
  LinkedConversationsBody,
  LinkedMessagesBody,
  LinkedOptionsBody,
  LinkSection,
  LinkStatus,
} from "@/lib/chatwoot-link-types";

import { useSectionLinked } from "./link-context";

export interface Linked<T> {
  /** The section reads the test copy (false: preview mode, nothing is requested). */
  active: boolean;
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  /** L-3: ask again but keep showing the current data until the answer comes (after a write). */
  refresh: () => void;
}

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = (await response.json().catch(() => null)) as (T & Partial<LinkErrorBody>) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? `the preview server answered ${response.status}`);
  return body;
}

function useLinkedRead<T>(section: LinkSection, url: string | null): Linked<T> {
  const active = useSectionLinked(section);
  const [tick, setTick] = React.useState(0);
  const [result, setResult] = React.useState<{ url: string; data: T | null; error: string | null } | null>(null);
  React.useEffect(() => {
    if (!active || !url) return;
    void tick; // a reload asks again
    const controller = new AbortController();
    readJson<T>(url, controller.signal)
      .then((data) => setResult({ url, data, error: null }))
      .catch((error: Error) => {
        if (!controller.signal.aborted) setResult({ url, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [active, url, tick]);
  const reload = React.useCallback(() => {
    setResult(null);
    setTick((n) => n + 1);
  }, []);
  const refresh = React.useCallback(() => setTick((n) => n + 1), []);
  const current = active && url && result?.url === url ? result : null;
  return {
    active,
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: active && Boolean(url) && !current,
    reload,
    refresh,
  };
}

export function useLinkedConversations() {
  return useLinkedRead<LinkedConversationsBody>("conversations", "/api/chatwoot/conversations");
}

export function useLinkedMessages(conversationId: number | null) {
  return useLinkedRead<LinkedMessagesBody>(
    "conversations",
    conversationId ? `/api/chatwoot/conversations/${conversationId}/messages` : null,
  );
}

export function useLinkedContacts() {
  return useLinkedRead<LinkedContactsBody>("contacts", "/api/chatwoot/contacts");
}

export function useLinkedContact(contactId: number | null) {
  return useLinkedRead<LinkedContactBody>("contacts", contactId ? `/api/chatwoot/contacts/${contactId}` : null);
}

/** L-3: the agents, teams and labels of the test copy, for the pickers of a linked conversation. */
export function useLinkedOptions() {
  return useLinkedRead<LinkedOptionsBody>("conversations", "/api/chatwoot/options");
}

/**
 * L-3: one write to /api/chatwoot/*. Resolves with Chatwoot's answer as the server mapped it, or throws its words
 * ("not found in the test copy", "the test copy answered 422: ...", "preview mode", ...): the caller shows a result
 * only after this resolves, so nothing says it worked before the test copy did it.
 */
export async function postLinked<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await response.json().catch(() => null)) as (T & Partial<LinkErrorBody>) | null;
  if (!response.ok || !answer) throw new Error(answer?.error ?? `the preview server answered ${response.status}`);
  return answer;
}

/** GET /api/chatwoot/status, for the card (any mode). */
export function useLinkStatus(enabled = true) {
  const [tick, setTick] = React.useState(0);
  const [status, setStatus] = React.useState<{ data: LinkStatus | null; error: string | null } | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    void tick;
    const controller = new AbortController();
    readJson<LinkStatus>("/api/chatwoot/status", controller.signal)
      .then((data) => setStatus({ data, error: null }))
      .catch((error: Error) => {
        if (!controller.signal.aborted) setStatus({ data: null, error: error.message });
      });
    return () => controller.abort();
  }, [enabled, tick]);
  const reload = React.useCallback(() => {
    setStatus(null);
    setTick((n) => n + 1);
  }, []);
  return { status: status?.data ?? null, error: status?.error ?? null, loading: enabled && !status, reload };
}

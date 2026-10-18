"use client";

// F-19 (Fahad 82b: "the conversation does not open for two"; his decision: a notice, not a lock): while a conversation
// is open, the other agents who have it open are named above the reply box, "Priya Nair is viewing this conversation",
// and "Priya Nair is typing" while they type. Nothing is locked: everyone can still reply (Zendesk, Freshdesk, Help
// Scout and Intercom warn the same way; Chatwoot itself shows only "is typing").
// V-18: in linked mode the same bar is fed by Chatwoot live events on the realtime bus
// (`conversation_typing_on` / `conversation_typing_off` and `conversation.typing_on` / `conversation.typing_off`)
// plus Studio tab heartbeats at `/api/cw/presence`. Preview still uses `/api/preview-sim/presence` only.
// A dropped agent expires after 20 s (inside the required 15–30 s window) so the bar cannot stick.
import { useEffect, useState } from "react";

import { Eye, PenLine } from "lucide-react";

import { linkedSession, useLinkedAdapterStatus, useLivePresenceStore } from "@/lib/chatwoot/store-adapter";
import { SimBadge } from "@/lib/cw/preview-sim-ui";
import { useViewer } from "@/lib/cw/view-as";

const PREVIEW_ENDPOINT = "/api/preview-sim/presence";
const LINKED_ENDPOINT = "/api/cw/presence";
const POLL_MS = 2000;
const HIDDEN_POLL_MS = 10_000;
const TYPING_IDLE_MS = 4000;

// One id per page load (crypto.randomUUID needs https, which the preview address is not).
const TAB = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface PresenceOther {
  agentId: number;
  name: string;
  typing: boolean;
}

const EMPTY_OTHERS: PresenceOther[] = [];

// ---- typing (called by the reply box) ----------------------------------------------------------------------------

let typingConv: number | null = null;
let typingTimer: ReturnType<typeof setTimeout> | undefined;
// Posts this tab's state now (set by the open conversation's usePresence), so "typing" does not wait for the next 2 s.
let postNow: (() => void) | null = null;

/** A key was typed in conversation `conv`'s reply box (Chatwoot: keyup -> typingIndicator.start()). */
export function noteTyping(conv: number) {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, TYPING_IDLE_MS);
  if (typingConv === conv) return;
  typingConv = conv;
  postNow?.();
}

/** The reply box lost focus, its message was sent, or 4 s passed without a key (Chatwoot typingIndicator.stop()). */
export function stopTyping() {
  clearTimeout(typingTimer);
  if (typingConv === null) return;
  typingConv = null;
  postNow?.();
}

function isLinkedNow(linkedActive: boolean): boolean {
  return linkedActive || linkedSession();
}

function presenceEndpoint(linked: boolean): string {
  return linked ? LINKED_ENDPOINT : PREVIEW_ENDPOINT;
}

function mergeOthers(fromApi: PresenceOther[], fromBus: PresenceOther[], selfId: number): PresenceOther[] {
  const merged = new Map<number, PresenceOther>();
  for (const row of fromApi) {
    if (row.agentId === selfId) continue;
    merged.set(row.agentId, { agentId: row.agentId, name: row.name, typing: row.typing === true });
  }
  for (const row of fromBus) {
    if (row.agentId === selfId) continue;
    const seen = merged.get(row.agentId);
    merged.set(row.agentId, {
      agentId: row.agentId,
      name: row.name || seen?.name || "Agent",
      typing: (seen?.typing ?? false) || row.typing === true,
    });
  }
  return [...merged.values()];
}

// ---- who else is here --------------------------------------------------------------------------------------------

function leave(conv: number, beacon: boolean, linked: boolean) {
  const endpoint = presenceEndpoint(linked);
  const body = JSON.stringify({ tab: TAB, conv, leave: true });
  // sendBeacon is the request a closing page is allowed to finish; its body goes as text, which the route reads.
  if (beacon && navigator.sendBeacon?.(endpoint, body)) return;
  void fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function usePresence(conv: number): { others: PresenceOther[]; error: string | null; linked: boolean } {
  const viewer = useViewer();
  const linkedActive = useLinkedAdapterStatus((s) => s.active);
  const linked = isLinkedNow(linkedActive);
  const fromBus = useLivePresenceStore((s) => s.byConv[conv] ?? EMPTY_OTHERS);
  const [state, setState] = useState<{
    conv: number;
    others: PresenceOther[];
    error: string | null;
    linked: boolean;
  }>({
    conv,
    others: [],
    error: null,
    linked,
  });
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const endpoint = presenceEndpoint(linked);
    const post = async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ tab: TAB, conv, agentId: viewer.id, name: viewer.name, typing: typingConv === conv }),
        });
        const body = (await response.json().catch(() => null)) as { others?: PresenceOther[]; error?: string } | null;
        if (!response.ok) throw new Error(`${response.status} ${body?.error ?? response.statusText}`);
        if (!stopped)
          setState({
            conv,
            others: Array.isArray(body?.others) ? body.others : [],
            error: null,
            linked,
          });
      } catch (error) {
        if (!stopped)
          setState((previous) => ({
            ...previous,
            conv,
            linked,
            error: error instanceof Error ? error.message : String(error),
          }));
      }
    };
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };
    const tick = async () => {
      await post();
      if (!stopped) schedule(document.hidden ? HIDDEN_POLL_MS : POLL_MS);
    };
    const onVisibility = () => {
      if (!document.hidden) schedule(0);
    };
    const onPageHide = () => leave(conv, true, linked);
    postNow = () => void post();
    schedule(0);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (typingConv === conv) {
        typingConv = null;
        clearTimeout(typingTimer);
      }
      postNow = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      leave(conv, false, linked);
    };
  }, [conv, viewer.id, viewer.name, linked]);
  const apiOthers = state.conv === conv ? state.others : [];
  const others = linked ? mergeOthers(apiOthers, fromBus, viewer.id) : apiOthers;
  const error = state.conv === conv ? state.error : null;
  return { others, error, linked };
}

// Chatwoot's wording for typing (i18n/locale/en/conversation.json TYPING: ONE, TWO, MULTIPLE); "viewing" follows it.
function names(list: PresenceOther[], one: string, many: string) {
  const [first, second] = list;
  if (list.length === 1) return `${first.name} ${one}`;
  if (list.length === 2) return `${first.name} and ${second.name} ${many}`;
  return `${first.name} and ${list.length - 1} others ${many}`;
}

/**
 * Above the reply box: who else has this conversation open, and who of them is typing.
 * F-25 (F-19's note: on a 768 px tall window at 1024 wide the bars left the messages 39 px): one line, 22 px, not a
 * bordered block that wraps. The names truncate before the badge does; the badge is one line at every width: the whole
 * sentence when the bar is wide, "Preview" when it is narrow (the sentence is then in its tooltip and read by screen
 * readers). The spacing around it is the notices wrapper's (conversation-pane.tsx).
 * V-18 / Fahad 82أ: a notice, never a lock — the reply box stays writable.
 */
const SHARED_ONLY = "Preview: shared only by browsers open on this computer's preview";
const LIVE_BADGE = "Live: another agent is viewing or typing — reply is not locked";

export function PresenceBar({ conversationId }: { conversationId: number }) {
  const { others, error, linked } = usePresence(conversationId);
  const typing = others.filter((other) => other.typing);
  const viewing = others.filter((other) => !other.typing);
  if (!others.length && !error) return null;
  const typingText = typing.length ? names(typing, "is typing", "are typing") : "";
  const viewingText = viewing.length
    ? names(viewing, "is viewing this conversation", "are viewing this conversation")
    : "";
  const errorText = error && !others.length ? `Could not check who else has this conversation open (${error}).` : "";
  const badge = linked ? LIVE_BADGE : SHARED_ONLY;
  const shortBadge = linked ? "Live" : "Preview";
  return (
    <div
      role="status"
      aria-live="polite"
      data-presence-bar=""
      data-presence-mode={linked ? "linked" : "preview"}
      data-presence-locked="false"
      title={[typingText, viewingText, errorText].filter(Boolean).join(" · ")}
      className="@container flex h-[22px] shrink-0 items-center gap-2 overflow-hidden rounded-md border border-sky-500/30 bg-sky-500/10 px-2 text-xs"
    >
      <div className="flex min-w-0 flex-1 items-center gap-x-3 whitespace-nowrap">
        {typing.length > 0 && (
          <span className="flex min-w-0 items-center gap-1" data-presence-typing="">
            <PenLine className="size-3.5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            <span className="truncate">{typingText}</span>
          </span>
        )}
        {viewing.length > 0 && (
          <span className="flex min-w-0 items-center gap-1" data-presence-viewing="">
            <Eye className="size-3.5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            <span className="truncate">{viewingText}</span>
          </span>
        )}
        {errorText && <span className="truncate text-muted-foreground">{errorText}</span>}
      </div>
      <span className="@md:hidden shrink-0" title={badge}>
        <SimBadge className="h-4 py-0 leading-3" label={shortBadge} />
      </span>
      <SimBadge className="@md:inline-flex hidden h-4 py-0 leading-3" label={badge} />
      <span className="sr-only @md:hidden">{badge}.</span>
      <span className="sr-only">
        Nothing is locked: everyone can still reply.
        {linked
          ? " Live presence comes from Chatwoot typing events and other open Studio tabs."
          : " The engine is not told who is viewing or typing."}
      </span>
    </div>
  );
}

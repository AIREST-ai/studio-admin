"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConversationStatus = "open" | "snoozed" | "resolved" | "closed";
export type DeliveryState = "sent" | "delivered" | "read";
export type ExtraMessage = { id: string; kind: "reply" | "note"; text: string; resolve?: boolean };

export const conversationStatuses: { value: ConversationStatus; label: string; dot: string }[] = [
  { value: "open", label: "Open", dot: "bg-emerald-500" },
  { value: "snoozed", label: "Snoozed", dot: "bg-amber-500" },
  { value: "resolved", label: "Resolved", dot: "bg-sky-500" },
  { value: "closed", label: "Closed", dot: "bg-zinc-400" },
];

export const noteSendButtonClass =
  "bg-amber-500 text-amber-950 hover:bg-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400";

const NO_MESSAGES: ExtraMessage[] = [];

// Local-only state for one thread: status, messages sent here, and fake delivery ticks (sent -> delivered -> read).
export function useThreadExtras(threadKey: string, externalMessages?: ExtraMessage[]) {
  const external = externalMessages ?? NO_MESSAGES;
  const [statusByThread, setStatusByThread] = useState<Record<string, ConversationStatus>>({});
  const [localByThread, setLocalByThread] = useState<Record<string, ExtraMessage[]>>({});
  const [delivery, setDelivery] = useState<Record<string, DeliveryState>>({});
  const timers = useRef<number[]>([]);
  const tracked = useRef(new Set<string>());
  const resolved = useRef(new Set<string>());
  const nextId = useRef(0);

  const track = useCallback((id: string) => {
    if (tracked.current.has(id)) return;
    tracked.current.add(id);
    setDelivery((prev) => ({ ...prev, [id]: "sent" }));
    timers.current.push(
      window.setTimeout(() => setDelivery((prev) => ({ ...prev, [id]: "delivered" })), 2000),
      window.setTimeout(() => setDelivery((prev) => ({ ...prev, [id]: "read" })), 6000),
    );
  }, []);

  useEffect(() => {
    for (const item of external) {
      if (item.kind === "reply") track(`ext:${item.id}`);
      // "Send and resolve" from outside (builder B's phone sheet): resolve once per item.
      const key = `${threadKey}:${item.id}`;
      if (item.resolve && !resolved.current.has(key)) {
        resolved.current.add(key);
        setStatus("resolved");
      }
    }
  }, [external, track]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
      tracked.current.clear();
    },
    [],
  );

  const setStatus = (value: ConversationStatus) => setStatusByThread((prev) => ({ ...prev, [threadKey]: value }));

  const sendMessage = (text: string, kind: ExtraMessage["kind"]) => {
    const body = text.trim();
    if (!body) return;
    nextId.current += 1;
    const id = `local-${nextId.current}`;
    setLocalByThread((prev) => ({ ...prev, [threadKey]: [...(prev[threadKey] ?? []), { id, kind, text: body }] }));
    if (kind === "reply") track(id);
  };

  return {
    status: statusByThread[threadKey] ?? "open",
    setStatus,
    sendMessage,
    sendAndResolve: (text: string, kind: ExtraMessage["kind"]) => {
      sendMessage(text, kind);
      setStatus("resolved");
    },
    items: [...(localByThread[threadKey] ?? []), ...external.map((item) => ({ ...item, id: `ext:${item.id}` }))],
    deliveryOf: (id: string): DeliveryState => delivery[id] ?? "sent",
  };
}

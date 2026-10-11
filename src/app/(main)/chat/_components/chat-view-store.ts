"use client";

import { useSyncExternalStore } from "react";

// F146: which view the chat screen shows. "email" = Studio's Email UI inside the chat screen
// (opened from "Email" under Channels in the chat sidebar). Local only, resets on reload.

export type ChatView = "chat" | "email";

let view: ChatView = "chat";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => view;
const getServerSnapshot = (): ChatView => "chat";

export function useChatView(): "chat" | "email" {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setChatView(v: "chat" | "email"): void {
  if (v === view) return;
  view = v;
  for (const listener of listeners) listener();
}

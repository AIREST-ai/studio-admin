"use client";

import { useSyncExternalStore } from "react";

import { conversations } from "./data";
import { keepSelectionIn } from "./use-chat";

// F145: conversation tags (Fahad 2026-10-11). Local module state shared by the thread header,
// the conversation list and the inbox sidebar. No backend: resets on page reload.

export type ChatTag = { id: string; label: string; color: string };

type ChatTagsState = { tags: ChatTag[]; byConv: Record<string, string[]>; filter: string | null };

// Soft colours for tags created with "Add tag…", used in turn.
const extraColors = ["#14b8a6", "#ec4899", "#6366f1", "#84cc16", "#f97316", "#06b6d4"];

let state: ChatTagsState = {
  tags: [
    { id: "buyer", label: "مشتري", color: "#10b981" },
    { id: "interested", label: "مهتم", color: "#0ea5e9" },
    { id: "seller", label: "بائع", color: "#8b5cf6" },
    { id: "follow-up", label: "متابعة", color: "#f59e0b" },
    { id: "maintenance", label: "صيانة", color: "#f43f5e" },
  ],
  // Sample tags so the feature is visible at once (conversation ids from data.ts).
  byConv: {
    "1": ["buyer", "follow-up"],
    "2": ["maintenance"],
    "3": ["interested"],
    "5": ["seller", "follow-up"],
    "6": ["buyer"],
    "7": ["maintenance", "follow-up"],
  },
  filter: null,
};

const listeners = new Set<() => void>();

function emit(next: ChatTagsState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

// With a filter on, keep the open conversation inside the filtered list (same order as the list).
function syncSelection() {
  const tagId = state.filter;
  if (!tagId) return;
  keepSelectionIn(
    conversations.filter((item) => (state.byConv[String(item.id)] ?? []).includes(tagId)).map((item) => item.id),
  );
}

export function useChatTags(): { tags: ChatTag[]; byConv: Record<string, string[]>; filter: string | null } {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function toggleTag(convId: string, tagId: string): void {
  const current = state.byConv[convId] ?? [];
  const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
  emit({ ...state, byConv: { ...state.byConv, [convId]: next } });
  syncSelection();
}

// Returns the existing tag when the label is already used (case-insensitive).
export function addTag(label: string): ChatTag {
  const name = label.trim() || "New tag";
  const existing = state.tags.find((tag) => tag.label.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const used = state.tags.length - 5;
  const tag: ChatTag = {
    id: `tag-${Date.now().toString(36)}-${state.tags.length}`,
    label: name,
    color: extraColors[((used % extraColors.length) + extraColors.length) % extraColors.length],
  };
  emit({ ...state, tags: [...state.tags, tag] });
  return tag;
}

export function setTagFilter(tagId: string | null): void {
  emit({ ...state, filter: tagId });
  syncSelection();
}

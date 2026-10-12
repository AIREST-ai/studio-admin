"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { Label } from "@/lib/cw/data";
import { setCwList, useCwShared } from "@/lib/cw/store";

import { conversations } from "./data";
import { keepSelectionIn } from "./use-chat";

// F145: conversation tags (Fahad 2026-10-11). Local module state shared by the thread header,
// the conversation list and the inbox sidebar. No backend: resets on page reload.

export type ChatTag = { id: string; label: string; color: string };

type ChatTagsState = { byConv: Record<string, string[]>; filter: string | null };

// Soft colours for tags created with "Add tag…", used in turn.
const extraColors = ["#f43f5e", "#84cc16", "#10b981", "#f97316", "#06b6d4", "#6366f1"];

// F161: the tags are the account labels of the shared store (src/lib/cw): the five English labels, Fahad's five
// Arabic labels (مشتري، مهتم، بائع، متابعة، صيانة, restored from Studio before F159) and any label added in
// Settings > Labels or with "Add tag…" here. Only labels shown on the sidebar are offered as tags.
let state: ChatTagsState = {
  // Sample labels so the feature is visible at once (conversation ids from data.ts, people from Contacts).
  // The Arabic ones are the samples Studio had before F159 (conversations 1, 2, 3, 5, 6, 7).
  byConv: {
    "1": ["vip", "support", "buyer", "follow-up"],
    "2": ["vip", "billing", "maintenance"],
    "3": ["support", "interested"],
    "5": ["partner", "seller", "follow-up"],
    "6": ["support", "buyer"],
    "7": ["billing", "maintenance", "follow-up"],
    "9": ["billing"],
    "12": ["lead", "billing"],
    "16": ["support"],
    "17": ["partner"],
    "19": ["partner"],
    "20": ["vip"],
    "22": ["lead"],
  },
  filter: null,
};

function toTag(label: Label): ChatTag {
  return { id: label.id, label: label.title, color: label.color };
}

function sidebarTags(labels: Label[]): ChatTag[] {
  return labels.filter((label) => label.showOnSidebar).map(toTag);
}

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
  const { byConv, filter } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const labels = useCwShared((shared) => shared.labels);
  const tags = useMemo(() => sidebarTags(labels), [labels]);
  return { tags, byConv, filter };
}

export function toggleTag(convId: string, tagId: string): void {
  const current = state.byConv[convId] ?? [];
  const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
  emit({ ...state, byConv: { ...state.byConv, [convId]: next } });
  syncSelection();
}

// Returns the existing tag when the label is already used (case-insensitive). A new tag is a new account label
// (Settings > Labels lists it too).
export function addTag(label: string): ChatTag {
  const name = label.trim() || "New tag";
  const labels = useCwShared.getState().labels;
  const existing = labels.find((item) => item.title.toLowerCase() === name.toLowerCase());
  if (existing) return toTag(existing);
  const added = labels.length - 13;
  const created: Label = {
    id: `tag-${Date.now().toString(36)}-${labels.length}`,
    title: name,
    description: "",
    color: extraColors[((added % extraColors.length) + extraColors.length) % extraColors.length],
    showOnSidebar: true,
  };
  setCwList("labels", (previous) => [...previous, created]);
  return toTag(created);
}

export function setTagFilter(tagId: string | null): void {
  emit({ ...state, filter: tagId });
  syncSelection();
}

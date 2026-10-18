"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { Label } from "@/lib/cw/data";
import { setCwList, useCwShared } from "@/lib/cw/store";

import { conversations } from "./data";
import { keepSelectionIn } from "./use-chat";

// F145: conversation tags (Fahad 2026-10-11). Local module state shared by the thread header,
// the conversation list and the inbox sidebar. No backend; M129-A: kept in the preview (see the end of this file).

export type ChatTag = { id: string; label: string; color: string };

type ChatTagsState = { byConv: Record<string, string[]>; filter: string | null };

// Soft colours for tags created with "Add tag…", used in turn.
const extraColors = ["#f43f5e", "#84cc16", "#10b981", "#f97316", "#06b6d4", "#6366f1"];

// T-95: tags are account labels from the shared store. Do not preassign demo labels.
// Labels created in Settings or here remain available through the existing shared store.
let state: ChatTagsState = { byConv: {}, filter: null };

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
// M129-A round 2: hydration renders the server's view (no labels yet); the saved labels restored from the preview
// (restoreConversationTags) show right after, instead of making the first client render differ from the server's.
const serverState: ChatTagsState = { byConv: {}, filter: null };
const getServerSnapshot = () => serverState;

// With a filter on, keep the open conversation inside the filtered list (same order as the list).
function syncSelection() {
  const tagId = state.filter;
  if (!tagId) return;
  keepSelectionIn(
    conversations.filter((item) => (state.byConv[String(item.id)] ?? []).includes(tagId)).map((item) => item.id),
  );
}

export function useChatTags(): { tags: ChatTag[]; byConv: Record<string, string[]>; filter: string | null } {
  const { byConv, filter } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const labels = useCwShared((shared) => shared.labels);
  const tags = useMemo(() => sidebarTags(labels), [labels]);
  return { tags, byConv, filter };
}

// U-2 (task u2-cw-store-adapter-chat-contacts): in linked mode a conversation's labels are Chatwoot's. The store adapter
// (src/lib/chatwoot/store-adapter.ts) registers here how to write them (POST /api/cw/conversations/{id}/labels through
// the unified client) and puts Chatwoot's labels in with replaceConversationTags; nothing is changed here until
// Chatwoot took the change.
export interface LinkedTagWriter {
  /** The conversation's whole new label list (label ids = Chatwoot label titles). */
  setLabels(convId: string, labels: string[]): void;
  /** A new account label: no gateway route in linked mode; says so and returns null. */
  addLabel(title: string): null;
}
let linkedTags: LinkedTagWriter | null = null;
export function setLinkedTagWriter(writer: LinkedTagWriter | null): void {
  linkedTags = writer;
}

/** U-2: the labels of the given conversations, replacing all others (linked data in, preview data out). */
export function replaceConversationTags(byConv: Record<string, string[]>): void {
  emit({ ...state, byConv: { ...byConv } });
  syncSelection();
}

export function toggleTag(convId: string, tagId: string): void {
  const current = state.byConv[convId] ?? [];
  const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
  if (linkedTags) {
    linkedTags.setLabels(convId, next);
    return;
  }
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
  // U-2: no new account label in linked mode (the gateway has no route for it); the tag returned is not kept anywhere.
  if (linkedTags) {
    linkedTags.addLabel(name);
    return { id: name, label: name, color: extraColors[0] };
  }
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

// M129-A round 2: the labels put on conversations are part of the panel edits kept in the preview's saved copy
// (dashboard/chat/_components/sim-panel-persist.ts), so they come back after a reload.
export function getConversationTags(): Record<string, string[]> {
  return state.byConv;
}

export function restoreConversationTags(byConv: Record<string, string[]>): void {
  emit({ ...state, byConv: { ...state.byConv, ...byConv } });
}

export const subscribeConversationTags = subscribe;

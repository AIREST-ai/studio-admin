"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { Conversation } from "./data";
import { keepSelectionIn } from "./use-chat";

// F149 (Fahad 2026-10-11): inside a tag view, the list title (the tag's name) opens a narrow strip with every channel;
// choosing one narrows the tag's conversations to that channel. Local only, resets on reload.
// The channel choice belongs to the tag it was made in; clearing the tag filter resets it and closes the strip.

type ChannelFilterState = { tag: string | null; channel: string | null; open: boolean };

let state: ChannelFilterState = { tag: null, channel: null, open: false };
const listeners = new Set<() => void>();

function emit(next: ChannelFilterState) {
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

/** Channel filter and strip state for the current tag filter (none when no tag is chosen). */
export function useChannelFilter(tagId: string | null): { channel: string | null; open: boolean } {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (tagId === null && (state.channel !== null || state.open)) emit({ tag: null, channel: null, open: false });
  }, [tagId]);
  if (tagId === null) return { channel: null, open: false };
  return { channel: s.tag === tagId ? s.channel : null, open: s.open };
}

/** Click on the tag title: open the channel strip, click again to close it. */
export function toggleChannelStrip(tagId: string): void {
  emit({ tag: tagId, channel: state.tag === tagId ? state.channel : null, open: !state.open });
}

/** Choose a channel (null = all channels) and keep the open conversation inside the narrowed list. */
export function setChannelFilter(tagId: string, channel: string | null, tagConversations: Conversation[]): void {
  emit({ ...state, tag: tagId, channel });
  keepSelectionIn(onChannel(tagConversations, channel).map((item) => item.id));
}

/** Conversations on one channel (all of them when channel is null). */
export function onChannel(list: Conversation[], channel: string | null): Conversation[] {
  return channel === null ? list : list.filter((item) => item.channel === channel);
}

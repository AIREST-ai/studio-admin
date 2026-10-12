"use client";

// F161 foundation: the shared, editable copies of ./data.ts. Every page reads and writes the same lists, so a label,
// team, inbox, macro or canned response added in Settings shows up in Conversations, the sidebar and Reports.
// Module state (zustand): survives moving between pages, resets on reload (no backend).
import { create } from "zustand";

import { type Macro, macros } from "@/app/(main)/dashboard/settings/macros/_components/data";

import {
  type Agent,
  agents,
  type CannedResponse,
  cannedResponses,
  type Inbox,
  inboxes,
  type Label,
  labels,
  type Team,
  teams,
  type WhatsAppTemplate,
  whatsappTemplates,
} from "./data";

export interface CwLists {
  agents: Agent[];
  inboxes: Inbox[];
  teams: Team[];
  labels: Label[];
  cannedResponses: CannedResponse[];
  macros: Macro[];
  whatsappTemplates: WhatsAppTemplate[];
}

export const useCwShared = create<CwLists>(() => ({
  agents,
  inboxes,
  teams,
  labels,
  cannedResponses,
  macros,
  whatsappTemplates,
}));

type Updater<T> = T | ((previous: T) => T);

/** Replace (or update with a function) one shared list. Works outside React too. */
export function setCwList<K extends keyof CwLists>(key: K, next: Updater<CwLists[K]>): void {
  useCwShared.setState((state) => ({
    [key]: typeof next === "function" ? (next as (previous: CwLists[K]) => CwLists[K])(state[key]) : next,
  }));
}

/** Drop-in replacement for `React.useState(initialList)`: `const [teams, setTeams] = useCwList("teams")`. */
export function useCwList<K extends keyof CwLists>(key: K): [CwLists[K], (next: Updater<CwLists[K]>) => void] {
  const list = useCwShared((state) => state[key]);
  return [list, (next) => setCwList(key, next)];
}

type ListKey = "agents" | "inboxes" | "teams" | "cannedResponses" | "macros";
type Row<K extends ListKey> = CwLists[K][number];

/**
 * The same list as an object store (get/find/nextId/save/update/remove/subscribe), shaped like Settings'
 * createListStore, so a settings page can keep its store API and still write to the shared list.
 */
export function cwListStore<K extends ListKey>(key: K) {
  const get = () => useCwShared.getState()[key] as Row<K>[];
  const write = (next: Row<K>[]) => setCwList(key, next as CwLists[K]);
  return {
    get,
    find: (id: number) => get().find((item) => item.id === id),
    nextId: () => Math.max(0, ...get().map((item) => item.id)) + 1,
    save(item: Row<K>) {
      const list = get();
      write(list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
    },
    update(id: number, patch: Partial<Row<K>>) {
      write(get().map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    remove(id: number) {
      write(get().filter((x) => x.id !== id));
    },
    subscribe(listener: () => void) {
      return useCwShared.subscribe((state, previous) => {
        if (state[key] !== previous[key]) listener();
      });
    },
    seed: useCwShared.getInitialState()[key] as Row<K>[],
  };
}

"use client";
// F161 settings-a: tiny in-memory list store shared by a settings list page and its create/edit pages, so a
// created, edited or deleted row shows in the list after navigation. Mock only: resets on a full page reload.
import * as React from "react";

export interface ListStore<T extends { id: number }> {
  get: () => T[];
  find: (id: number) => T | undefined;
  nextId: () => number;
  save: (item: T) => void;
  update: (id: number, patch: Partial<T>) => void;
  remove: (id: number) => void;
  subscribe: (listener: () => void) => () => void;
  seed: T[];
}

export function createListStore<T extends { id: number }>(seed: T[]): ListStore<T> {
  let current = [...seed];
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  const store: ListStore<T> = {
    get: () => current,
    find: (id) => current.find((item) => item.id === id),
    nextId: () => Math.max(0, ...current.map((item) => item.id)) + 1,
    save(item) {
      current = current.some((x) => x.id === item.id)
        ? current.map((x) => (x.id === item.id ? item : x))
        : [...current, item];
      emit();
    },
    update(id, patch) {
      current = current.map((x) => (x.id === id ? { ...x, ...patch } : x));
      emit();
    },
    remove(id) {
      current = current.filter((x) => x.id !== id);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    seed,
  };
  return store;
}

export function useListStore<T extends { id: number }>(store: ListStore<T>) {
  return React.useSyncExternalStore(store.subscribe, store.get, () => store.seed);
}

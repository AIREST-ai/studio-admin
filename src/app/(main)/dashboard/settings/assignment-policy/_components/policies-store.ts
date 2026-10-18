"use client";
// F161 settings-a: one list of assignment policies and one of capacity policies, shared by the policy tables, the
// create/edit forms and the inbox Collaborators tab, so created/edited/deleted/linked policies show everywhere.
import * as React from "react";

import { toast } from "sonner";

import { probeCeArea, rejectCeWrite } from "@/lib/chatwoot/settings-adapter";
import { linkedSession } from "@/lib/cw/persistence/client";

import { type ListStore, useListStore } from "../../_components/list-store";
import { createSavedList, useSavedListLoaded } from "../../_components/settings-preview-client";
import { type AssignmentPolicy, assignmentPolicies, type CapacityPolicy, capacityPolicies } from "./data";

// T-232 (item 78.1): capacity policies are saved on the preview server (/api/capacity-policies, its own file), so
// they stay after a reload. The whole list is sent with the revision it was loaded at; an older tab's save is refused
// (409) and the page shows the saved list instead of overwriting it.
const CAPACITY_URL = "/api/capacity-policies?space=main";

type SavedCapacityStore = {
  get: () => CapacityPolicy[];
  find: (id: number) => CapacityPolicy | undefined;
  nextId: () => number;
  save: (item: CapacityPolicy) => Promise<void>;
  update: (id: number, patch: Partial<CapacityPolicy>) => Promise<void>;
  remove: (id: number) => Promise<void>;
  apply: (next: (items: CapacityPolicy[]) => CapacityPolicy[]) => Promise<void>;
  subscribe: ListStore<CapacityPolicy>["subscribe"];
  isLoaded: () => boolean;
  seed: CapacityPolicy[];
};

function createSavedCapacityStore(seed: CapacityPolicy[]): SavedCapacityStore {
  let current = [...seed];
  let rev = 0;
  let loaded = false;
  let loadedMode: "preview" | "linked" | null = null;
  let queue: Promise<unknown> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  const adopt = (saved: { rev: number; policies: CapacityPolicy[] }) => {
    current = saved.policies;
    rev = saved.rev;
    loaded = true;
    emit();
  };
  const load = () => {
    if (linkedSession()) {
      return probeCeArea("agent_capacity_policies").then(() => {
        adopt({ rev: 0, policies: [] });
      });
    }
    return fetch(CAPACITY_URL, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(adopt)
      .catch(() => {
        loaded = true;
        emit();
        toast.error("Capacity policies could not be loaded. Changes will not be saved.");
      });
  };
  const ensureLoaded = () => {
    const modeNow: "preview" | "linked" = linkedSession() ? "linked" : "preview";
    if (loadedMode !== modeNow) {
      loadedMode = modeNow;
      queue = null;
      loaded = false;
    }
    if (!queue && typeof window !== "undefined") queue = load();
    return queue;
  };
  // Saves run one after another, each from the revision the previous one returned.
  const persist = (change: (items: CapacityPolicy[]) => CapacityPolicy[]): Promise<void> => {
    const run = (ensureLoaded() ?? Promise.resolve()).then(async () => {
      const before = current;
      const next = change(before);
      current = next;
      emit();
      if (linkedSession()) {
        try {
          await rejectCeWrite("agent_capacity_policies");
        } catch (error) {
          current = before;
          emit();
          throw error;
        }
      }
      try {
        const res = await fetch(CAPACITY_URL, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ baseRev: rev, policies: next }),
        });
        const body = await res.json().catch(() => null);
        if (res.status === 409 && body?.current) {
          adopt(body.current);
          throw new Error(
            "Capacity policies were changed in another tab. Showing the saved version; your change was not saved.",
          );
        }
        if (!res.ok) {
          current = before;
          emit();
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        rev = body.rev;
      } catch (error) {
        if (current === next) {
          current = before;
          emit();
        }
        throw error instanceof Error ? error : new Error("the preview server did not answer");
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    get: () => current,
    find: (id) => current.find((item) => item.id === id),
    nextId: () => Math.max(0, ...current.map((item) => item.id)) + 1,
    save(item) {
      return persist((items) =>
        items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item],
      );
    },
    update(id, patch) {
      return persist((items) => items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    remove(id) {
      return persist((items) => items.filter((x) => x.id !== id));
    },
    apply: persist,
    subscribe(listener) {
      ensureLoaded();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isLoaded: () => loaded,
    seed,
  };
}

// F-6A (sim2 problem 1: "Assignment policy created successfully" and gone after a reload, with no request): the
// assignment policies are saved in this preview (api/settings-preview, list "assignmentPolicies"), with the revision
// rule of F-3 (an old tab's save is refused, never written over). Each change returns a promise that settles after
// the save, so the pages say "created / updated / deleted / linked" only then.
export const assignmentPoliciesStore = createSavedList<AssignmentPolicy>("assignmentPolicies", assignmentPolicies);
export const capacityPoliciesStore = createSavedCapacityStore(capacityPolicies);
export const useAssignmentPolicies = () => useListStore(assignmentPoliciesStore);
export const useCapacityPolicies = () => useListStore(capacityPoliciesStore);
/** False until the saved assignment policies have come back from the preview server. */
export const useAssignmentPoliciesLoaded = () => useSavedListLoaded(assignmentPoliciesStore);
/** False until the saved capacity policies have come back from the preview server. */
export const useCapacityPoliciesLoaded = () =>
  React.useSyncExternalStore(capacityPoliciesStore.subscribe, capacityPoliciesStore.isLoaded, () => false);

/** The policies with these inboxes linked to `policyId` only (an inbox belongs to one policy at most). */
export function withInboxesLinked(items: AssignmentPolicy[], policyId: number | null, inboxIds: number[]) {
  return items.map((p) => {
    const kept = p.inboxes.filter((x) => !inboxIds.includes(x));
    return { ...p, inboxes: p.id === policyId ? [...kept, ...inboxIds] : kept };
  });
}

/** Links an inbox to one policy, or unlinks it when policyId is null, in one save; settles after the save. */
export function linkInboxToPolicy(inboxId: number, policyId: number | null): Promise<void> {
  return assignmentPoliciesStore.apply((items) => withInboxesLinked(items, policyId, [inboxId]));
}

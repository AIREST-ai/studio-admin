// م137 round 2 (item 99): browser side of /api/settings-preview, the saved copy of Conversation Workflow and SAML SSO
// on the preview machine (see that route). Every failure throws with the server's reason, so a page never says
// "saved" when nothing was kept.
import * as React from "react";

import type { ListName } from "@/app/api/settings-preview/extras";
import type {
  AccountExtras,
  BillingSettings,
  CaptainSettings,
  ConversationWorkflow,
  IntegrationsSettings,
  ProfileSettings,
  Saml,
  SavedList,
  SettingsPreview,
  SlackSettings,
} from "@/app/api/settings-preview/route";
import { fetchLinkedSettingsPreview, syncLinkedListSave, syncLinkedSectionSave } from "@/lib/chatwoot/settings-adapter";
import { linkedSession } from "@/lib/cw/persistence/client";
import { SIMULATED } from "@/lib/cw/preview-sim";

export type {
  AutoResolve,
  BillingSettings,
  ConversationWorkflow,
  IntegrationsSettings,
  ProfileSettings,
  Saml,
  SlackSettings,
} from "@/app/api/settings-preview/route";

const ENDPOINT = "/api/settings-preview";

/** The line under a "saved" message: true to what happened (kept in this preview, not sent to Chatwoot). */
export const SAVED_IN_PREVIEW = `${SIMULATED}: saved in this preview, not in the engine. It stays after a reload.`;

async function reason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${response.status} ${response.statusText}`;
}

export async function loadSettingsPreview(): Promise<SettingsPreview> {
  if (linkedSession()) {
    return fetchLinkedSettingsPreview();
  }
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(await reason(response));
  return ((await response.json()) as { settings: SettingsPreview }).settings;
}

export async function saveConversationWorkflow(
  value: Partial<Omit<ConversationWorkflow, "savedAt">>,
): Promise<ConversationWorkflow> {
  return save("conversationWorkflow", value) as Promise<ConversationWorkflow>;
}

export async function saveSaml(value: Partial<Omit<Saml, "savedAt">>): Promise<Saml> {
  return save("saml", value) as Promise<Saml>;
}

export async function saveSlack(value: Partial<Omit<SlackSettings, "savedAt">>): Promise<SlackSettings> {
  return save("slack", value) as Promise<SlackSettings>;
}

export async function saveCaptain(value: Partial<Omit<CaptainSettings, "savedAt">>): Promise<CaptainSettings> {
  return save("captain", value) as Promise<CaptainSettings>;
}

export async function saveAccountExtras(value: Partial<Omit<AccountExtras, "savedAt">>): Promise<AccountExtras> {
  return save("account", value) as Promise<AccountExtras>;
}

// F-6A: Profile Settings, Billing and the OAuth integrations (Linear, Notion, Shopify) are kept the same way.
export async function saveProfile(value: Partial<Omit<ProfileSettings, "savedAt">>): Promise<ProfileSettings> {
  return save("profile", value) as Promise<ProfileSettings>;
}

export async function saveBilling(value: { currency?: "USD" | "BRL"; addPurchase?: number }): Promise<BillingSettings> {
  return save("billing", value) as Promise<BillingSettings>;
}

export async function saveIntegrations(
  value: Partial<Record<"linear" | "notion" | "shopify", { connected: boolean; account?: string }>>,
): Promise<IntegrationsSettings> {
  return save("integrations", value) as Promise<IntegrationsSettings>;
}

async function save(section: keyof SettingsPreview, value: object): Promise<unknown> {
  if (linkedSession()) {
    return syncLinkedSectionSave(section, value as Record<string, unknown>);
  }
  const response = await fetch(ENDPOINT, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ section, value }),
  });
  if (!response.ok) throw new Error(await reason(response));
  return ((await response.json()) as { value: unknown }).value;
}

// ---- F-6A: saved lists (assignment policies, agent bots, webhooks, dashboard apps, integration hooks) -------------
// A list store with the list-store API (get / find / nextId / save / update / remove / subscribe / seed), backed by
// PUT { list, baseRev, items }. Changes wait for the saved list to load, then go one after another, each from the
// revision the previous one returned. Each change returns a promise: resolved once the preview server has the list,
// rejected with the reason otherwise, so a page says "saved" only after the save. When another tab saved the list
// first (409) the page takes the saved list (an old copy is never written back, F-3) and the promise is rejected.

export const CHANGED_IN_ANOTHER_TAB = "Not saved: changed in another tab or device. Showing the saved version.";

export interface SavedListStore<T extends { id: number }> {
  get: () => T[];
  find: (id: number) => T | undefined;
  nextId: () => number;
  save: (item: T) => Promise<void>;
  update: (id: number, patch: Partial<T>) => Promise<void>;
  remove: (id: number) => Promise<void>;
  /** One change to the whole list in one save (for example a policy and the inboxes it takes from other policies). */
  apply: (next: (items: T[]) => T[]) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  isLoaded: () => boolean;
  seed: T[];
}

export function createSavedList<T extends { id: number }>(name: ListName, seed: T[]): SavedListStore<T> {
  let current: T[] = [...seed];
  let rev = 0;
  let loaded = false;
  let loadedMode: "preview" | "linked" | null = null;
  let loading: Promise<void> | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const adopt = (saved: SavedList | null) => {
    current = saved ? (saved.items as unknown as T[]) : [...seed];
    rev = saved ? saved.rev : 0;
    loaded = true;
    emit();
  };
  const ensureLoaded = () => {
    const modeNow: "preview" | "linked" = linkedSession() ? "linked" : "preview";
    if (loadedMode !== modeNow) {
      loadedMode = modeNow;
      loading = null;
      loaded = false;
    }
    if (!loading && typeof window !== "undefined")
      loading = loadSettingsPreview().then(
        (settings) => adopt(settings.lists?.[name] ?? null),
        (error: Error) => {
          loading = null;
          throw error;
        },
      );
    return loading ?? Promise.resolve();
  };
  const change = (next: (items: T[]) => T[]) => {
    const run = chain.then(async () => {
      await ensureLoaded();
      const before = current;
      const items = next(current);
      current = items;
      emit();
      if (linkedSession()) {
        try {
          const synced = await syncLinkedListSave(name, before, items);
          rev += 1;
          current = synced;
          emit();
          return;
        } catch (err) {
          current = before;
          emit();
          throw new Error(`Not saved: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ list: name, baseRev: rev, items }),
        });
      } catch {
        current = before;
        emit();
        throw new Error("Not saved: the preview server did not answer.");
      }
      const body = (await response.json().catch(() => null)) as
        | (SavedList & { error?: string; current?: SavedList })
        | null;
      if (response.status === 409 && body?.current) {
        adopt(body.current);
        throw new Error(CHANGED_IN_ANOTHER_TAB);
      }
      if (!response.ok || !body) {
        current = before;
        emit();
        throw new Error(`Not saved: ${body?.error ?? `${response.status} ${response.statusText}`}`);
      }
      rev = body.rev;
      current = body.items as unknown as T[];
      emit();
    });
    chain = run.catch(() => undefined);
    return run;
  };
  return {
    get: () => current,
    find: (id) => current.find((item) => item.id === id),
    nextId: () => Math.max(0, ...current.map((item) => item.id)) + 1,
    save: (item) =>
      change((items) =>
        items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item],
      ),
    update: (id, patch) => change((items) => items.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    remove: (id) => change((items) => items.filter((x) => x.id !== id)),
    apply: (next) => change(next),
    subscribe(listener) {
      ensureLoaded().catch(() => undefined);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isLoaded: () => loaded,
    seed,
  };
}

export function useSavedList<T extends { id: number }>(store: SavedListStore<T>): T[] {
  return React.useSyncExternalStore(store.subscribe, store.get, () => store.seed);
}

/** False until the saved list has come back from the preview server. */
export function useSavedListLoaded<T extends { id: number }>(store: SavedListStore<T>): boolean {
  return React.useSyncExternalStore(store.subscribe, store.isLoaded, () => false);
}

/** The saved settings, loaded once per page; `null` until they arrive. A failure is shown by the caller. */
export function useSettingsPreview(): { settings: SettingsPreview | null; error: string | null; reload: () => void } {
  const [settings, setSettings] = React.useState<SettingsPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick reloads on purpose.
  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview().then(
      (saved) => alive && setSettings(saved),
      (failure: Error) => alive && setError(failure.message),
    );
    return () => {
      alive = false;
    };
  }, [tick]);
  return { settings, error, reload: () => setTick((n) => n + 1) };
}

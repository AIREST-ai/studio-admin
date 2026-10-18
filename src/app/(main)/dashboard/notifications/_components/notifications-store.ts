"use client";

// F161: My Inbox notifications in module state (no backend), same rule as the Contacts store
// (contacts/_components/contacts-store.ts) and the inbox store (chat/_components/cw-store.ts): read / unread, snooze
// and delete survive leaving the page and coming back. The unread count is exported as a hook so the sidebar can show
// it next to "My Inbox" (Chatwoot Sidebar.vue:370-372, notifications/getUnreadCount).
//
// T-286 (Fahad, item 125.5): a snooze ends at its return time. useSnoozeWake (mounted once, in the header bell) checks
// every second; a notification whose time has come goes back to Unread, on top, with the "Returned from snooze" mark,
// and an in-app toast says so.
//
// T-289 (Fahad 129.2: the simulation is kept in the preview state): read / unread, the snooze and its return time, and
// "Returned from snooze" are also saved in the shared preview save (lib/cw/persistence, section "notifications",
// file-store.ts validateNotifications), so they stay after a reload; a snooze whose time came while the page was
// closed returns at the next check, with its toast. Delete still resets on reload (not part of that order).
//
// F-10 (Fahad item 51b: «الاشعارات تكون للنظام التسجيل التغيير الموافقات اشعارات عامه بكل شيئ»): the bell also lists
// the System, Sign-ups, Changes and Approvals notifications made from the activity log (`feed`, read from
// /api/notifications-feed, lib/notifications/feed.ts). Their read / unread is saved in the same section, under ids from
// FEED_ID_BASE up; a feed notification with nothing saved is unread. F-10b: only the read ones are saved (see saveNow).
import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";
import { create } from "zustand";

import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { loadPreviewSection, SectionConflict, savePreviewSection } from "@/lib/cw/persistence/client";
import { FEED_ID_BASE, type FeedNotification } from "@/lib/notifications/feed";

import { dueSnoozes, type InboxTab, returned } from "./my-inbox-filters";
import { buildNotification, type InboxNotification, notificationSeeds } from "./notification-data";

export const seedNotifications: InboxNotification[] = notificationSeeds
  .map((s, i) => buildNotification(s, i))
  .filter((n): n is InboxNotification => n !== null);

export interface FeedEntry extends FeedNotification {
  unread: boolean;
}

interface NotificationsState {
  items: InboxNotification[];
  // F-10: the activity-log notifications (newest first) and whether the log could be read.
  feed: FeedEntry[];
  feedStatus: "idle" | "ready" | "error";
  feedError: string | null;
  readFeed(id: number, unread?: boolean): void;
  tab: InboxTab; // the My Inbox tab, kept while moving between pages
  setTab(tab: InboxTab): void;
  update(id: number, patch: Partial<InboxNotification>): void;
  snooze(id: number, until: number): void;
  // Brings back every snooze whose time is `now` or earlier; returns those that came back.
  wake(now: number): InboxNotification[];
  remove(id: number): void;
  markAllRead(): void;
  deleteAll(): void;
  deleteAllRead(): void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: seedNotifications,
  feed: [],
  feedStatus: "idle",
  feedError: null,
  readFeed(id, unread = false) {
    set((s) => ({ feed: s.feed.map((f) => (f.id === id ? { ...f, unread } : f)) }));
  },
  tab: "unread",
  setTab(tab) {
    set({ tab });
  },
  update(id, patch) {
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  },
  snooze(id, until) {
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, snoozedUntil: until, returnedAt: undefined } : n)),
    }));
  },
  wake(now) {
    const due = dueSnoozes(get().items, now);
    if (!due.length) return [];
    const back = due.map(returned);
    const byId = new Map(back.map((n) => [n.id, n]));
    set((s) => ({ items: s.items.map((n) => byId.get(n.id) ?? n) }));
    return back;
  },
  remove(id) {
    set((s) => ({ items: s.items.filter((n) => n.id !== id) }));
  },
  markAllRead() {
    set((s) => ({
      items: s.items.map((n) => ({ ...n, unread: false })),
      feed: s.feed.some((f) => f.unread) ? s.feed.map((f) => ({ ...f, unread: false })) : s.feed,
    }));
  },
  deleteAll() {
    set({ items: [] });
  },
  deleteAllRead() {
    set((s) => ({ items: s.items.filter((n) => n.unread) }));
  },
}));

// T-289: the saved copy. It is read once per page load, before anything is written; a change made before it arrives
// stays on top of it. Every change of read state, snooze or return is then saved whole (keepalive, so a reload right
// after a click still sends it). A save refused because another tab or device saved first (409) reads the saved copy
// again, keeps this tab's own changes and saves again. A failed load or save says so; nothing claims a save that failed.
const SECTION = "notifications";

interface SavedState {
  id: number;
  unread: boolean;
  snoozedUntil?: number;
  returnedAt?: number;
}

const stateOf = (n: Pick<InboxNotification, "id" | "unread" | "snoozedUntil" | "returnedAt">): SavedState => ({
  id: n.id,
  unread: n.unread,
  ...(typeof n.snoozedUntil === "number" ? { snoozedUntil: n.snoozedUntil } : {}),
  ...(typeof n.returnedAt === "number" ? { returnedAt: n.returnedAt } : {}),
});
const sameState = (a?: SavedState, b?: SavedState) => JSON.stringify(a) === JSON.stringify(b);

const seedStates = new Map(seedNotifications.map((n) => [n.id, stateOf(n)]));
// F-10: a feed notification starts unread.
const startState = (id: number): SavedState | undefined =>
  seedStates.get(id) ?? (id >= FEED_ID_BASE ? { id, unread: true } : undefined);
const isFeedId = (id: number) => id >= FEED_ID_BASE;
// What the server holds, by id; a notification it does not list keeps its starting state.
let saved = new Map<number, SavedState>();
let rev = 0;
let phase: "idle" | "loading" | "ready" | "failed" = "idle";
let saving = false;
let again = false;
let applying = false;

function fromItems(items: unknown[] | null): Map<number, SavedState> {
  const map = new Map<number, SavedState>();
  for (const raw of items ?? []) {
    const item = raw as Partial<SavedState> | null;
    if (typeof item?.id === "number" && typeof item.unread === "boolean") map.set(item.id, stateOf(item as SavedState));
  }
  return map;
}

/** Reads the saved copy and shows it, except the notifications this tab changed since its last read or save. */
async function reloadKeepingOwn(): Promise<boolean> {
  const before = saved;
  const section = await loadPreviewSection<unknown>(SECTION);
  rev = section.rev;
  saved = fromItems(section.items);
  const { items, feed } = useNotificationsStore.getState();
  const own = new Set(
    [...items.map(stateOf), ...feed.map(stateOf)]
      .filter((state) => !sameState(state, before.get(state.id) ?? startState(state.id)))
      .map((state) => state.id),
  );
  applying = true;
  try {
    useNotificationsStore.setState((s) => ({
      items: s.items.map((n) => {
        const state = own.has(n.id) ? undefined : (saved.get(n.id) ?? seedStates.get(n.id));
        return state
          ? { ...n, unread: state.unread, snoozedUntil: state.snoozedUntil, returnedAt: state.returnedAt }
          : n;
      }),
      feed: s.feed.map((f) =>
        own.has(f.id) ? f : { ...f, unread: (saved.get(f.id) ?? startState(f.id))?.unread ?? true },
      ),
    }));
  } finally {
    applying = false;
  }
  return own.size > 0;
}

// F-10b: how many read activity-log notifications are kept saved (the whole section may hold 1000 items).
const MAX_SAVED_FEED = 500;

async function saveNow() {
  for (let conflicts = 0; ; conflicts++) {
    const { items: list, feed, feedStatus } = useNotificationsStore.getState();
    // F-10b: only a READ activity-log notification is saved: unread is what one with nothing saved starts as
    // (startState), so saving every listed one only filled the log with "added / deleted notification" events as the
    // newest-60 window moved. Saved read ones this tab's feed does not list are KEPT, not dropped: another tab may
    // list, and have read, a newer event than this tab fetched, and dropping it lost that tab's read state (a
    // conflict then read it back as unread). They are pruned only above MAX_SAVED_FEED, and only after the feed
    // loaded; a failed load drops nothing.
    const listed = new Set(feed.map((f) => f.id));
    const readNow = feed.filter((f) => !f.unread).map((f) => stateOf(f));
    let keptOld = [...saved.values()].filter((state) => isFeedId(state.id) && !state.unread && !listed.has(state.id));
    if (feedStatus === "ready") keptOld = keptOld.slice(0, Math.max(0, MAX_SAVED_FEED - readNow.length));
    const items = [...list.map(stateOf), ...readNow, ...keptOld];
    try {
      const result = await savePreviewSection(SECTION, items, rev, true);
      rev = result.rev;
      saved = new Map(items.map((state) => [state.id, state]));
      return;
    } catch (error) {
      if (!(error instanceof SectionConflict) || conflicts >= 3) throw error;
      await reloadKeepingOwn();
    }
  }
}

function save() {
  if (phase !== "ready") return;
  if (saving) {
    again = true;
    return;
  }
  saving = true;
  saveNow()
    .catch((error: Error) => {
      console.error(`[my inbox] not saved: ${error.message}`);
      toast.error("Notification changes not saved", {
        id: "my-inbox-not-saved",
        description: `${error.message}. They show here until the page is reloaded.`,
      });
    })
    .finally(() => {
      saving = false;
      if (again) {
        again = false;
        save();
      }
    });
}

function startSaving() {
  if (phase !== "idle" || typeof window === "undefined") return;
  phase = "loading";
  useNotificationsStore.subscribe((state, before) => {
    if ((state.items !== before.items || state.feed !== before.feed) && !applying) save();
  });
  reloadKeepingOwn()
    .then((own) => {
      phase = "ready";
      if (own) save();
    })
    // Without the saved copy it must not be overwritten: nothing is saved on this page load.
    .catch((error: Error) => {
      phase = "failed";
      console.error(`[my inbox] saved notifications not loaded: ${error.message}`);
      toast.error("Saved notifications could not be loaded", {
        id: "my-inbox-not-loaded",
        description: `${error.message}. Changes on this page are not saved.`,
      });
    });
}

// ---- F-10: the activity-log notifications ------------------------------------------------------------------

const FEED_EVERY_MS = 30_000;
let feedLoading: Promise<void> | null = null;

/** Reads /api/notifications-feed. Known ids keep the read state shown here; new ones take the saved one, or unread. */
export function loadFeed(): Promise<void> {
  feedLoading ??= (async () => {
    try {
      const response = await fetch("/api/notifications-feed", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { items?: FeedNotification[]; error?: string } | null;
      if (!response.ok || !Array.isArray(body?.items))
        throw new Error(body?.error ?? `the activity log answered ${response.status}`);
      const shown = new Map(useNotificationsStore.getState().feed.map((f) => [f.id, f]));
      const feed: FeedEntry[] = body.items.map((item) => ({
        ...item,
        unread: shown.get(item.id)?.unread ?? (saved.get(item.id) ?? startState(item.id))?.unread ?? true,
      }));
      applying = true;
      try {
        useNotificationsStore.setState({ feed, feedStatus: "ready", feedError: null });
      } finally {
        applying = false;
      }
    } catch (error) {
      useNotificationsStore.setState({ feedStatus: "error", feedError: (error as Error).message });
    } finally {
      feedLoading = null;
    }
  })();
  return feedLoading;
}

/** Mounted once, in the header bell: reads the feed now, every 30 s, and when the tab is shown again. */
export function useFeedPolling() {
  React.useEffect(() => {
    startSaving();
    void loadFeed();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadFeed();
    }, FEED_EVERY_MS);
    const onShow = () => {
      if (document.visibilityState === "visible") void loadFeed();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
}

// Notifications of conversations deleted in the inbox (cw-store "deleted") are gone with them.
export function useNotifications(): InboxNotification[] {
  React.useEffect(() => startSaving(), []);
  const items = useNotificationsStore((s) => s.items);
  const deleted = useCwStore((s) => s.deleted);
  return deleted.length ? items.filter((n) => !deleted.includes(n.conversationId)) : items;
}

// Unread notifications for the sidebar badge. Counts the same list the page shows (deleted conversations left out).
export function useUnreadNotificationsCount(): number {
  return useNotifications().filter((n) => n.unread).length;
}

// The in-app alert of a return; "View" opens My Inbox on Unread, where it now sits on top.
export function useSnoozeWake() {
  const router = useRouter();
  React.useEffect(() => {
    const check = () => {
      for (const n of useNotificationsStore.getState().wake(Date.now())) {
        toast("Returned from snooze", {
          id: `snooze-return-${n.id}`,
          description: `${n.actor}: ${n.message}`,
          action: {
            label: "View",
            onClick: () => {
              useNotificationsStore.getState().setTab("unread");
              router.push("/dashboard/notifications");
            },
          },
        });
      }
    };
    check();
    const timer = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);
}

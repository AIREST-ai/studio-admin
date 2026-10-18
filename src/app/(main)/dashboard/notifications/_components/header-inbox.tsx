"use client";

// T-98: the Notifications and Messages buttons of the header, side by side like Facebook's (Fahad 2026-10-13 20:01,
// items 15 and 16). The lists are short summaries, never whole conversations; the data and filtering rules are in
// header-summary.ts. Sizes are taken from Facebook's dropdowns loosely (a ~360px panel, a round avatar with the
// channel mark on its corner, one line of message, a blue unread dot), not from any published standard.
import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Bell, CircleCheck, type LucideIcon, MessageCircle, Settings, TriangleAlert, UserPlus } from "lucide-react";

import { useChat } from "@/app/(main)/chat/_components/use-chat";
import { useSectionLinked } from "@/app/(main)/dashboard/_components/chatwoot-link/link-context";
import { LinkedMessagesButton } from "@/app/(main)/dashboard/_components/chatwoot-link/linked-rail";
import { baseConversations, CURRENT_AGENT_ID } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { cw, useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { ChannelIcon, PersonAvatar } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORY_LABELS, type FeedCategory } from "@/lib/notifications/feed";
import { useSectionShown } from "@/lib/owner/site-sections-context";

import { personalLinks, settingsGroups } from "../../settings/_components/settings-nav";
import {
  type BellEntry,
  bellEntries,
  bellUnreadCount,
  conversationHref,
  messageRows,
  snippetOf,
  unreadConversations,
} from "./header-summary";
import { relativeTime, typeLabels } from "./notification-data";
import {
  type FeedEntry,
  loadFeed,
  useFeedPolling,
  useNotifications,
  useNotificationsStore,
  useSnoozeWake,
} from "./notifications-store";

// One line in the header layout mounts both. The bell follows the My Inbox switch (config/features.ts, T-49; on since
// T-132).
export function HeaderInbox() {
  // L-2 round 2: while Conversations is linked to the Chatwoot test copy, Messages lists no preview conversations.
  const linked = useSectionLinked("conversations");
  // F-17 (T-91): the bell follows My Inbox, which the owner shows or hides in the Owner console (/super_admin); its
  // default is in config/features.ts.
  const myInboxShown = useSectionShown("my-inbox");
  return (
    <>
      {linked ? <LinkedMessagesButton /> : <MessagesButton />}
      {myInboxShown ? <NotificationsButton /> : null}
    </>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span
      data-slot="header-count"
      className="-top-1 -right-1 pointer-events-none absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-[10px] text-white tabular-nums leading-none"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function UnreadDot({ unread }: { unread: boolean }) {
  return unread ? (
    <span className="size-2.5 shrink-0 rounded-full bg-primary">
      <span className="sr-only">Unread</span>
    </span>
  ) : null;
}

// The contact's avatar with the channel mark on its corner (Facebook puts the notification kind there).
// No online dot: Meta and TikTok do not give a customer's presence (T-94).
function ChannelAvatar({ name, channel }: { name: string; channel: string }) {
  return (
    <span className="relative shrink-0">
      <PersonAvatar name={name} size="lg" />
      <span className="-right-1 -bottom-1 absolute flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground">
        <ChannelIcon channel={channel} className="size-3 [&_svg]:size-3" />
      </span>
    </span>
  );
}

// F-10: the mark of a System / Sign-ups / Changes / Approvals notification, in the avatar's place.
// System: Chatwoot's warning icon (i-lucide-triangle-alert, components/app/LowBackupCodesBanner.vue). F-10b: a
// service that answers again ("Service back up") gets Chatwoot's healthy mark instead, i-lucide-check-circle (lucide
// CircleCheck) in teal, the pair of its i-lucide-alert-triangle in the same health badges
// (routes/dashboard/settings/inbox/components/TwilioHealth.vue lines 245-250 and AccountHealth.vue lines 652-659).
// Sign-ups:
// Chatwoot's "New user" icon (i-lucide-user-plus, super_admin/dashboard/index.html.erb). Changes and Approvals: the
// icon of the page the notification opens, as the Settings bar shows it (settings-nav.ts), so the two always match.
const SETTINGS_LINKS = [...settingsGroups.flatMap((g) => g.items), ...personalLinks];

function pageIcon(href: string): LucideIcon {
  let best: { url: string; icon: LucideIcon } | null = null;
  for (const link of SETTINGS_LINKS) {
    const url = link.url.split("?")[0];
    if (
      (href === url || href.startsWith(`${url}/`) || href.startsWith(`${url}?`)) &&
      url.length > (best?.url.length ?? 0)
    )
      best = { url, icon: link.icon };
  }
  return best?.icon ?? Settings;
}

const CATEGORY_TONE: Record<FeedCategory, string> = {
  system: "bg-destructive/10 text-destructive",
  signup: "bg-primary/10 text-primary",
  change: "bg-muted text-foreground",
  approval: "bg-primary/10 text-primary",
  // F-11: a teammate notification from an automation flow (its icon is the Automation page's, as for other links)
  automation: "bg-primary/10 text-primary",
};

// F-10b: shared with My Inbox (notifications-view.tsx), so a notification has the same mark in both places.
export function FeedAvatar({
  entry,
  size = "md",
}: {
  entry: Pick<FeedEntry, "category" | "href"> & { ok?: boolean };
  size?: "md" | "sm";
}) {
  let Icon = pageIcon(entry.href);
  if (entry.category === "system") Icon = entry.ok ? CircleCheck : TriangleAlert;
  if (entry.category === "signup") Icon = UserPlus;
  const tone = entry.ok ? "bg-teal-500/10 text-teal-700 dark:text-teal-400" : CATEGORY_TONE[entry.category];
  return (
    <span
      data-slot="feed-avatar"
      data-icon={entry.ok ? "ok" : entry.category}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "mt-0.5 size-5" : "size-10",
        tone,
      )}
      aria-hidden
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-5"} />
    </span>
  );
}

// Same opening as the inbox's ?conversation= link (conversations-workspace.tsx): the list moves to the status and
// Mine / Unassigned / All tab that hold the conversation, which opens even if the filters hide it. Done here as well
// because the workspace reads the link only when it mounts, and the header can be used while it is open.
function useOpenConversation() {
  const router = useRouter();
  const [, setChat] = useChat();
  return (id: number) => {
    const { meta, statusFilter } = useCwStore.getState();
    const m = meta[id];
    if (m) {
      const status = m.status === "closed" ? "resolved" : m.status;
      if (statusFilter !== "all" && statusFilter !== status) cw.setStatusFilter(status);
      cw.setAssigneeTab(m.assigneeId === CURRENT_AGENT_ID ? "me" : m.assigneeId === null ? "unassigned" : "all");
    }
    cw.focus(id);
    setChat({ selected: id });
    cw.markRead(id);
    router.push(conversationHref(id));
  };
}

function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
      <h2 className="font-semibold text-lg leading-none">{title}</h2>
      {children}
    </div>
  );
}

function FilterChips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5 px-4 pb-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "secondary" : "ghost"}
          aria-pressed={value === option.value}
          className="rounded-full"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

const panelClass = "w-[360px] max-w-[calc(100vw-1rem)] gap-0 p-0";
const listClass = "max-h-[min(70vh,560px)] overflow-y-auto px-2 pb-2";
const rowClass =
  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted";

function MessagesButton() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = useCwStore((s) => s.unread);
  const sent = useCwStore((s) => s.sent);
  const deleted = useCwStore((s) => s.deleted);
  // New conversations join baseConversations (module state); meta changes with them, so read it to re-render.
  useCwStore((s) => s.meta);
  const openConversation = useOpenConversation();
  const rows = messageRows(baseConversations, { unread, sent, deleted });
  const shown = filter === "unread" ? rows.filter((r) => r.unread > 0) : rows;
  const count = unreadConversations(rows);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" className="relative" aria-label={count ? `Messages, ${count} unread` : "Messages"}>
          <MessageCircle />
          <CountBadge count={count} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={panelClass} data-slot="header-messages">
        <PanelHeader title="Messages" />
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
          ]}
        />
        <div className={listClass}>
          {shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-muted-foreground text-sm">
              {filter === "unread" ? "No unread messages" : "No messages"}
            </p>
          ) : (
            shown.map((row) => (
              <button
                key={row.id}
                type="button"
                data-slot="header-message-row"
                data-conversation={row.id}
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  openConversation(row.id);
                }}
              >
                <ChannelAvatar name={row.name} channel={row.channel} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", row.unread > 0 ? "font-semibold" : "font-medium")}>
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      "flex min-w-0 gap-1 text-[13px]",
                      row.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">
                      {row.fromYou ? "You: " : ""}
                      {row.snippet}
                    </span>
                    <span className="shrink-0">· {row.time}</span>
                  </span>
                </span>
                <UnreadDot unread={row.unread > 0} />
              </button>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/dashboard/chat" onClick={() => setOpen(false)}>
              See all in Inbox
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  // T-286: snoozed My Inbox notifications return at their time on every page (the bell is in the header of all of them).
  useSnoozeWake();
  // F-10: the activity-log notifications, read now, every 30 s and each time the bell opens.
  useFeedPolling();
  const router = useRouter();
  const items = useNotifications();
  const feed = useNotificationsStore((s) => s.feed);
  const feedStatus = useNotificationsStore((s) => s.feedStatus);
  const feedError = useNotificationsStore((s) => s.feedError);
  const readFeed = useNotificationsStore((s) => s.readFeed);
  const update = useNotificationsStore((s) => s.update);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  // T-132: the conversations' live SLA, so a breach shows only while it is really missed.
  const meta = useCwStore((s) => s.meta);
  const openConversation = useOpenConversation();
  const entries = bellEntries(items, meta, feed);
  const shown = filter === "unread" ? entries.filter((e) => e.unread) : entries;
  const count = bellUnreadCount(entries);

  function openEntry(entry: BellEntry) {
    setOpen(false);
    if (entry.kind === "feed") {
      readFeed(entry.feed.id);
      router.push(entry.href);
      return;
    }
    update(entry.item.id, { unread: false });
    openConversation(entry.item.conversationId);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadFeed();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="relative"
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        >
          <Bell />
          <CountBadge count={count} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={panelClass} data-slot="header-notifications">
        <PanelHeader title="Notifications">
          {count > 0 && (
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={markAllRead}>
              Mark all as read
            </Button>
          )}
        </PanelHeader>
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
          ]}
        />
        <div className={listClass}>
          {feedStatus === "error" ? (
            <div data-slot="header-feed-error" className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm">
              <FeedAvatar entry={{ category: "system", href: "/dashboard/settings/audit-logs" }} />
              <span className="min-w-0 flex-1 text-muted-foreground">
                <span className="font-semibold text-foreground">System · Activity log not reachable</span>
                {": "}
                {snippetOf(feedError ?? "", 140)}. System, sign-up, change and approval notifications cannot be shown.
              </span>
            </div>
          ) : null}
          {shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-muted-foreground text-sm">No notifications</p>
          ) : (
            shown.map((entry) =>
              entry.kind === "feed" ? (
                <button
                  key={entry.key}
                  type="button"
                  data-slot="header-notification-row"
                  data-kind="feed"
                  data-category={entry.feed.category}
                  data-href={entry.href}
                  className={rowClass}
                  onClick={() => openEntry(entry)}
                >
                  <FeedAvatar entry={entry.feed} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn("line-clamp-3 text-sm", entry.unread ? "text-foreground" : "text-muted-foreground")}
                    >
                      <span className="font-semibold">{entry.feed.type}</span>
                      {" · "}
                      {snippetOf(entry.feed.text, 160)}
                    </span>
                    <span
                      className={cn(
                        "block text-xs",
                        entry.unread ? "font-semibold text-primary" : "text-muted-foreground",
                      )}
                    >
                      {relativeTime(entry.minutesAgo)} · {CATEGORY_LABELS[entry.feed.category]}
                    </span>
                  </span>
                  <UnreadDot unread={entry.unread} />
                </button>
              ) : (
                <button
                  key={entry.key}
                  type="button"
                  data-slot="header-notification-row"
                  data-kind={entry.kind}
                  data-href={entry.href}
                  className={rowClass}
                  onClick={() => openEntry(entry)}
                >
                  <ChannelAvatar name={entry.item.contactName} channel={entry.item.conversation.channel} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn("line-clamp-3 text-sm", entry.unread ? "text-foreground" : "text-muted-foreground")}
                    >
                      <span className="font-semibold">{typeLabels[entry.item.type]}</span>
                      {" · "}
                      <span className="font-medium">{entry.item.actor}</span>: {snippetOf(entry.item.message, 140)}
                    </span>
                    <span
                      className={cn(
                        "block text-xs",
                        entry.unread ? "font-semibold text-primary" : "text-muted-foreground",
                      )}
                    >
                      {relativeTime(entry.minutesAgo)}
                    </span>
                  </span>
                  <UnreadDot unread={entry.unread} />
                </button>
              ),
            )
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
              See all in My Inbox
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Search, X } from "lucide-react";
import { create } from "zustand";

import { useChat } from "@/app/(main)/chat/_components/use-chat";
import {
  baseConversations,
  buildThread,
  CURRENT_AGENT_ID,
  inboxOf,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import { cw, useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { Button } from "@/components/ui/button";
import { SidebarInput, SidebarMenuItem } from "@/components/ui/sidebar";

// How many rows each kind lists in the bar until "All results" lists them all there.
const ROWS = 5;

// T-259 (item 30): one query for the bar's box, so every way to search messages (Enter and "Open search" in the
// conversation list, the Inbox preview's Search, "All results") opens this box with it instead of the full page.
// `asked` counts the requests; the box on screen takes each one once (the bar on desktop, the sheet on phones).
const useInboxSearch = create<{ draft: string; asked: number }>(() => ({ draft: "", asked: 0 }));
let answered = 0;
export const useInboxSearchAsked = () => useInboxSearch((s) => s.asked);
export function openInboxMessageSearch(query = "") {
  useInboxSearch.setState((s) => ({ draft: query || s.draft, asked: s.asked + 1 }));
}

const markClass = "rounded-sm bg-amber-200/70 px-0 text-foreground dark:bg-amber-500/30";

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
          <mark key={index} className={markClass}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// A phone number is found however it is typed: "30915567", "3091 5567", "+974 3091-5567".
const digitsOf = (value: string) => value.replace(/\D/g, "");
const isPhoneQuery = (value: string) => /^[\d\s()+-]+$/.test(value) && digitsOf(value).length >= 3;

// Opens a conversation the way /dashboard/chat?conversation=<id> does (conversations-workspace.tsx): the list moves to
// the status and tab that hold it, and the thread opens even when the filters hide it. That page reads the query only
// when it mounts, so on the page itself the same steps run here; from another page the link opens it.
function useOpenConversation() {
  const router = useRouter();
  const path = usePathname();
  const [, setChat] = useChat();
  return (id: number) => {
    const { meta, statusFilter } = useCwStore.getState();
    const m = meta[id];
    if (m) {
      const status = m.status === "closed" ? "resolved" : m.status;
      if (statusFilter !== "all" && statusFilter !== status) cw.setStatusFilter(status);
      let tab: "me" | "unassigned" | "all" = "all";
      if (m.assigneeId === CURRENT_AGENT_ID) tab = "me";
      else if (m.assigneeId === null) tab = "unassigned";
      cw.setAssigneeTab(tab);
    }
    cw.focus(id);
    setChat({ selected: id });
    const url = `/dashboard/chat?conversation=${id}`;
    // Same page: only the address changes (no server round trip); Next keeps its router in step with history.replaceState.
    if (path === "/dashboard/chat") window.history.replaceState(null, "", url);
    else router.push(url);
  };
}

// T-117: Fahad 20:41: the message search (a phone number, a message's text) is in the Inbox bar itself, at the bar's
// size, not a page in place of the conversation list; the site search stays at the top (header/search-dialog.tsx).
// Typing lists the matching conversations (id, name, email, phone, subject) and messages under the box, inside the bar;
// a result opens its conversation beside it. T-259: "All results" lists them all here; the full search page
// (/dashboard/chat/search) stays for old links. Same data and matching as that page (search-view.tsx).
export function InboxMessageSearch() {
  const meta = useCwStore((s) => s.meta);
  const deleted = useCwStore((s) => s.deleted);
  const draft = useInboxSearch((s) => s.draft);
  const asked = useInboxSearch((s) => s.asked);
  const setDraft = (value: string) => useInboxSearch.setState({ draft: value });
  const [all, setAll] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const open = useOpenConversation();
  // T-285 (Fahad 125.4): the box is a lens until clicked (or asked for); it stays open while it holds a query, and
  // closing it (×, Escape, or leaving it empty) brings back the lens alone.
  const [expanded, setExpanded] = useState(false);
  const shown = expanded || Boolean(draft) || asked > answered;
  const collapse = () => {
    setDraft("");
    setExpanded(false);
  };

  // A request renders the box at once (shown counts it), and keeps it open once answered.
  useEffect(() => {
    if (asked <= answered) return;
    setExpanded(true);
    // After the phone sheet's own first focus.
    const frame = requestAnimationFrame(() => {
      const box = input.current;
      if (!box || asked <= answered || box.getClientRects().length === 0) return;
      answered = asked;
      box.focus();
      box.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [asked]);

  const query = draft.trim();
  const q = query.toLowerCase();
  const phone = isPhoneQuery(query);
  const ready = q.length >= 3 || /^#?\d+$/.test(q);

  const results = useMemo(() => {
    if (!ready) return { conversations: [], messages: [] };
    const live = baseConversations.filter((c) => !deleted.includes(c.id));
    const conversations = live.filter(
      (c) =>
        [`#${c.id}`, c.name, c.subject, c.preview, c.contact.email, c.contact.phone].some((value) =>
          value.toLowerCase().includes(q),
        ) ||
        (phone && digitsOf(c.contact.phone).includes(digitsOf(query))),
    );
    const messages = live.flatMap((c) =>
      buildThread(c, meta[c.id])
        .filter((m) => m.kind !== "activity" && m.text.toLowerCase().includes(q))
        .map((m) => ({ conversation: c, message: m })),
    );
    return { conversations, messages };
  }, [ready, q, query, phone, meta, deleted]);

  const total = results.conversations.length + results.messages.length;
  const rows = all === query ? total : ROWS;
  const row =
    "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:outline-none";
  const pick = (event: React.MouseEvent, id: number) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    open(id);
  };

  if (!shown) {
    return (
      <SidebarMenuItem data-inbox-message-search className="mb-2 flex flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-inbox-search-trigger
          aria-label="Search messages and phone numbers"
          title="Search messages and phone numbers"
          onClick={() => {
            setExpanded(true);
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <Search />
        </Button>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem data-inbox-message-search className="mb-2 flex flex-col gap-1">
      <form
        ref={form}
        className="relative"
        onBlur={(event) => {
          // Leaving the box (not for its own × button) with nothing typed closes it.
          if (!form.current?.contains(event.relatedTarget as Node | null) && !input.current?.value) setExpanded(false);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const first = results.conversations[0]?.id ?? results.messages[0]?.conversation.id;
          if (first !== undefined) open(first);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
        <SidebarInput
          ref={input}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              collapse();
            }
          }}
          placeholder="Phone or message"
          aria-label="Search messages and phone numbers"
          className="pr-7 pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close search"
          title="Close search"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={collapse}
        >
          <X />
        </Button>
      </form>
      {query && (
        <div
          data-inbox-search-results
          className="flex max-h-[min(28rem,55svh)] flex-col gap-1 overflow-y-auto rounded-md border bg-background p-1"
        >
          {!ready && <p className="px-2 py-1.5 text-muted-foreground text-xs">Type 3 or more characters</p>}
          {ready && total === 0 && <p className="px-2 py-1.5 text-muted-foreground text-xs">No results</p>}
          {results.conversations.length > 0 && (
            <div className="flex flex-col">
              <p className="px-2 pt-1 font-medium text-[11px] text-muted-foreground">Conversations</p>
              {results.conversations.slice(0, rows).map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/chat?conversation=${c.id}`}
                  data-inbox-search-result
                  data-kind="conversation"
                  className={row}
                  onClick={(event) => pick(event, c.id)}
                >
                  <span className="truncate font-medium">
                    <Highlight text={c.name} query={query} /> <span className="text-muted-foreground">#{c.id}</span>
                  </span>
                  <span className="truncate text-muted-foreground">
                    {phone ? c.contact.phone : <Highlight text={c.subject} query={query} />}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {results.messages.length > 0 && (
            <div className="flex flex-col">
              <p className="px-2 pt-1 font-medium text-[11px] text-muted-foreground">Messages</p>
              {results.messages.slice(0, rows).map(({ conversation, message }) => (
                <Link
                  key={`${conversation.id}-${message.id}`}
                  href={`/dashboard/chat?conversation=${conversation.id}`}
                  data-inbox-search-result
                  data-kind="message"
                  className={row}
                  onClick={(event) => pick(event, conversation.id)}
                >
                  <span className="truncate font-medium">
                    {conversation.contact.name}{" "}
                    <span className="font-normal text-muted-foreground">· {inboxOf(conversation).name}</span>
                  </span>
                  <span className="line-clamp-2 text-muted-foreground">
                    {message.sender ? `${message.sender}: ` : ""}
                    <Highlight text={message.text} query={query} />
                  </span>
                </Link>
              ))}
            </div>
          )}
          {ready && (results.conversations.length > rows || results.messages.length > rows) && (
            <button
              type="button"
              className="px-2 py-1.5 text-left text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setAll(query)}
            >
              All results ({total})
            </button>
          )}
        </div>
      )}
    </SidebarMenuItem>
  );
}

"use client";

// Chatwoot SearchView (modules/search): search box, time / sender / inbox filters, tabs All results / Contacts /
// Conversations / Messages / Articles, recent searches. Studio look: big title outside the card, line tabs with
// counts, results inside cards. Mock data: the same people, conversations and articles as the rest of the app.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  BookOpen,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  Eye,
  Info,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import { contacts } from "@/app/(main)/dashboard/contacts/_components/data";
import { ContactAvatar, PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  agents,
  baseConversations,
  buildThread,
  helpArticles,
  inboxes,
  inboxOf,
  isPersonOnline,
  lastPreview,
} from "./cw-data";
import { useCwStore } from "./cw-store";
import { AgentAvatar, ChannelIcon, PersonAvatar, StatusPill } from "./cw-ui";

type Tab = "all" | "contacts" | "conversations" | "messages" | "articles";

const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "All results" },
  { value: "contacts", label: "Contacts" },
  { value: "conversations", label: "Conversations" },
  { value: "messages", label: "Messages" },
  { value: "articles", label: "Articles" },
];

const dateRanges = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

const initialRecent = ["refund", "Noura Al-Thani", "8823", "SSO"];

// How many rows each section shows under "All results" before "View more" (Chatwoot sliceRecordsIfAllTab: 5).
const PREVIEW_ROWS = 5;

// No side padding on the mark: padding opened visible gaps inside matched tokens ("sarah .mitchell", "# 12", "2 0 2 5").
const markClass = "rounded-sm bg-amber-200/70 px-0 text-foreground dark:bg-amber-500/30";

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
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

function Section({
  title,
  show,
  children,
  more,
  onMore,
}: {
  title: string;
  show: boolean;
  children: ReactNode;
  more: boolean;
  onMore: () => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      {show && <h3 className="font-medium text-muted-foreground text-sm">{title}</h3>}
      <Card className="gap-0 overflow-hidden p-0">
        <div className="divide-y">{children}</div>
      </Card>
      {more && (
        <Button variant="outline" size="sm" className="w-fit self-center" onClick={onMore}>
          <Eye /> View more
        </Button>
      )}
    </section>
  );
}

function SenderFilter({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          Sender{value ? `: ${value}` : ""}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Agents</DropdownMenuLabel>
          {agents.map((agent) => (
            <DropdownMenuItem key={agent.id} onSelect={() => onChange(agent.name)}>
              <AgentAvatar id={agent.id} size="sm" className="size-5" />
              {agent.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Contacts</DropdownMenuLabel>
          {contacts.slice(0, 8).map((contact) => (
            <DropdownMenuItem key={contact.id} onSelect={() => onChange(contact.name)}>
              <PersonAvatar name={contact.name} size="sm" className="size-5" />
              {contact.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InboxFilter({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const inbox = inboxes.find((item) => item.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          Inbox{inbox ? `: ${inbox.name}` : ""}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Inboxes</DropdownMenuLabel>
        {inboxes.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => onChange(item.id)}>
            <ChannelIcon channel={item.id} />
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SearchView() {
  const router = useRouter();
  const meta = useCwStore((s) => s.meta);
  const sent = useCwStore((s) => s.sent);
  const deleted = useCwStore((s) => s.deleted);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [recent, setRecent] = useState<string[]>(initialRecent);
  const [range, setRange] = useState<string | null>(null);
  const [sender, setSender] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string | null>(null);

  // Opened from the conversation list search box: /dashboard/chat/search?q=<text>
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q") ?? "";
    if (q) {
      setDraft(q);
      setQuery(q);
      setRecent((list) => [q, ...list.filter((item) => item !== q)].slice(0, 8));
    }
  }, []);

  // "/" focuses the search box (Chatwoot: "/to focus").
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.code !== "Slash" || event.metaKey || event.ctrlKey) return;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const run = (text: string) => {
    const value = text.trim();
    setDraft(value);
    setQuery(value);
    setTab("all");
    if (value) setRecent((list) => [value, ...list.filter((item) => item !== value)].slice(0, 8));
  };

  const q = query.trim().toLowerCase();
  const ready = q.length >= 3 || /^#?\d+$/.test(q);

  const results = useMemo(() => {
    if (!ready) return { contacts: [], conversations: [], messages: [], articles: [] };
    const live = baseConversations.filter((c) => !deleted.includes(c.id));
    const matchContacts = contacts.filter((c) =>
      [c.name, c.email, c.phone, c.company, c.city].some((value) => value.toLowerCase().includes(q)),
    );
    const matchConversations = live.filter(
      (c) =>
        (!inboxId || c.channel === inboxId) &&
        [`#${c.id}`, c.name, c.subject, c.preview, c.contact.email, c.contact.phone].some((value) =>
          value.toLowerCase().includes(q),
        ),
    );
    const matchMessages = live
      .filter((c) => !inboxId || c.channel === inboxId)
      .flatMap((c) =>
        buildThread(c, meta[c.id])
          .filter((m) => m.kind !== "activity" && m.text.toLowerCase().includes(q))
          .filter((m) => !sender || m.sender === sender)
          .map((m) => ({ conversation: c, message: m })),
      );
    const matchArticles = helpArticles.filter((a) => [a.title, a.category].some((v) => v.toLowerCase().includes(q)));
    return {
      contacts: matchContacts,
      conversations: matchConversations,
      messages: matchMessages,
      articles: matchArticles,
    };
  }, [ready, q, inboxId, sender, meta, deleted]);

  const counts: Record<Tab, number> = {
    all: results.contacts.length + results.conversations.length + results.messages.length + results.articles.length,
    contacts: results.contacts.length,
    conversations: results.conversations.length,
    messages: results.messages.length,
    articles: results.articles.length,
  };
  const isAll = tab === "all";
  const limit = <T,>(list: T[]) => (isAll ? list.slice(0, PREVIEW_ROWS) : list);
  const hasFilters = range !== null || sender !== null || inboxId !== null;
  const openConversation = (id: number) => router.push(`/dashboard/chat?conversation=${id}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title="Search"
          subtitle="Search by conversation id, email, phone number, messages for better search results."
        />
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/chat">
            <ChevronLeft /> Back
          </Link>
        </Button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(draft);
        }}
      >
        <InputGroup className="h-10 bg-background">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setQuery(event.target.value);
            }}
            placeholder="Type 3 or more characters to search"
            aria-label="Search"
            className="text-base"
          />
          <InputGroupAddon align="inline-end">
            {draft ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => {
                  setDraft("");
                  setQuery("");
                }}
              >
                <X />
              </Button>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <Kbd>/</Kbd> to focus
              </span>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarRange />
              {dateRanges.find((item) => item.value === range)?.label ?? "Filter by time"}
              <ChevronDown data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup value={range ?? ""} onValueChange={(value) => setRange(value || null)}>
              {dateRanges.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value}>
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <span className="text-muted-foreground text-sm">Filter messages by:</span>
        <SenderFilter value={sender} onChange={setSender} />
        <span className="h-3 w-px bg-border" />
        <InboxFilter value={inboxId} onChange={setInboxId} />
        {hasFilters && (
          <Button
            variant="secondary"
            size="sm"
            className="ms-auto"
            onClick={() => {
              setRange(null);
              setSender(null);
              setInboxId(null);
            }}
          >
            <X /> Clear filter
          </Button>
        )}
      </div>

      {query && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList
            variant="line"
            className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
          >
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
                <Badge variant="secondary" className="ms-1 tabular-nums">
                  {counts[item.value]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {!query && (
        <Card className="gap-0 p-0">
          {recent.length > 0 ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
                  <RotateCcw className="size-4" /> Recent searches
                </h3>
                <Button variant="ghost" size="xs" onClick={() => setRecent([])}>
                  Clear all
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                {recent.map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                    onClick={() => run(item)}
                  >
                    <Search className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{item}</span>
                    {index === 0 && (
                      <span className="text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                        Most recent
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground text-sm">
              <Search className="size-5" />
              Search by conversation id, email, phone number, messages for better search results.
            </div>
          )}
        </Card>
      )}

      {query && !ready && (
        <p className="py-8 text-center text-muted-foreground text-sm">Type 3 or more characters to search</p>
      )}

      {query && ready && counts.all === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground text-sm">
          <Info className="size-4" />
          No results found for query &apos;{query}&apos;
        </div>
      )}

      {query && ready && counts.all > 0 && (
        <div className="flex flex-col gap-5">
          {(isAll || tab === "contacts") &&
            (results.contacts.length > 0 ? (
              <Section
                title="Contacts"
                show={isAll}
                more={isAll && results.contacts.length > PREVIEW_ROWS}
                onMore={() => setTab("contacts")}
              >
                {limit(results.contacts).map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/dashboard/contacts/${contact.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <ContactAvatar contact={contact} size="default" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm">
                        <Highlight text={contact.name} query={query} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" />
                          <span>
                            <Highlight text={contact.email} query={query} />
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" />
                          <span>
                            <Highlight text={contact.phone} query={query} />
                          </span>
                        </span>
                        <span>
                          {contact.company} · {contact.city}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-muted-foreground text-xs">{contact.lastActivity}</span>
                  </Link>
                ))}
              </Section>
            ) : (
              !isAll && <EmptyTab item="contacts" query={query} />
            ))}

          {(isAll || tab === "messages") &&
            (results.messages.length > 0 ? (
              <Section
                title="Messages"
                show={isAll}
                more={isAll && results.messages.length > PREVIEW_ROWS}
                onMore={() => setTab("messages")}
              >
                {limit(results.messages).map(({ conversation, message }) => (
                  <button
                    key={`${conversation.id}-${message.id}`}
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-muted/50"
                  >
                    <div className="flex w-full items-center justify-between gap-2 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* "#2" in one piece, like the conversation header and the list rows. */}
                        <span className="font-medium tabular-nums">#{conversation.id}</span>
                        <span className="h-3 w-px bg-border" />
                        <span className="flex min-w-0 items-center gap-1.5">
                          <ChannelIcon channel={conversation.channel} className="size-3.5" />
                          <span className="truncate">{inboxOf(conversation).name}</span>
                        </span>
                        {message.kind === "note" && (
                          <>
                            <span className="h-3 w-px bg-border" />
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Lock className="size-3.5" /> Private note
                            </span>
                          </>
                        )}
                      </div>
                      <span className="shrink-0 text-muted-foreground text-xs">{message.time}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <PersonAvatar name={message.sender ?? conversation.name} size="sm" className="mt-0.5" />
                      <p className="min-w-0 text-sm">
                        <span className="font-medium">{message.sender ?? conversation.name}</span>{" "}
                        <span className="text-muted-foreground">wrote:</span>{" "}
                        <Highlight text={message.text} query={query} />
                      </p>
                    </div>
                  </button>
                ))}
              </Section>
            ) : (
              !isAll && <EmptyTab item="messages" query={query} />
            ))}

          {(isAll || tab === "conversations") &&
            (results.conversations.length > 0 ? (
              <Section
                title="Conversations"
                show={isAll}
                more={isAll && results.conversations.length > PREVIEW_ROWS}
                onMore={() => setTab("conversations")}
              >
                {limit(results.conversations).map((conversation) => {
                  const status = meta[conversation.id]?.status;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => openConversation(conversation.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    >
                      <PersonAvatar name={conversation.name} online={isPersonOnline(conversation.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <span className="tabular-nums">
                            <Highlight text={`#${conversation.id}`} query={query} />
                          </span>
                          <span className="h-3 w-px bg-border" />
                          <ChannelIcon channel={conversation.channel} className="size-3" />
                          <span className="truncate">{inboxOf(conversation).name}</span>
                        </div>
                        <div className="truncate font-medium text-sm">
                          <Highlight text={conversation.name} query={query} /> ·{" "}
                          <Highlight text={conversation.subject} query={query} />
                        </div>
                        <div className="truncate text-muted-foreground text-xs">
                          {lastPreview(conversation, meta[conversation.id], sent[conversation.id]).text}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-muted-foreground text-xs">{conversation.time}</span>
                        {status && <StatusPill status={status} className="h-4.5 px-1.5 text-[10px]" />}
                      </div>
                    </button>
                  );
                })}
              </Section>
            ) : (
              !isAll && <EmptyTab item="conversations" query={query} />
            ))}

          {(isAll || tab === "articles") &&
            (results.articles.length > 0 ? (
              <Section
                title="Articles"
                show={isAll}
                more={isAll && results.articles.length > PREVIEW_ROWS}
                onMore={() => setTab("articles")}
              >
                {limit(results.articles).map((article) => (
                  <Link
                    key={article.title}
                    href="/dashboard/help-center"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
                      <BookOpen className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm">
                        <Highlight text={article.title} query={query} />
                      </div>
                      <div className="text-muted-foreground text-xs">{article.category}</div>
                    </div>
                    <span className="shrink-0 text-muted-foreground text-xs">{article.views} views</span>
                  </Link>
                ))}
              </Section>
            ) : (
              !isAll && <EmptyTab item="articles" query={query} />
            ))}
        </div>
      )}
    </div>
  );
}

function EmptyTab({ item, query }: { item: string; query: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground text-sm">
      <Info className="size-4" />
      No {item} found for query &apos;{query}&apos;
    </div>
  );
}

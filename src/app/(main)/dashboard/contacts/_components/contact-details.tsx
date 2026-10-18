"use client";
import * as React from "react";

import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";

import {
  Ban,
  Check,
  FileText,
  ImageIcon,
  Inbox,
  MessageSquare,
  MessagesSquare,
  Pencil,
  Search,
  Smile,
  Tag,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import {
  baseConversations,
  buildThread,
  type Conversation,
  type ConversationMeta,
  type CwAttachment,
  contactAttributeDefs,
  contactIdOf,
  lastPreview,
  useLiveInboxes,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import { openDialog } from "@/app/(main)/dashboard/chat/_components/cw-dialog-store";
import { cw, useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { ChannelIcon, StatusPill } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import {
  contactCsat,
  firstResponseMinutes,
  formatMinutes,
  teamFirstResponse,
} from "@/app/(main)/dashboard/reports/_components/data";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
// M129-A round 2: the conversation panel's saved edits (contact attributes) also load on the contact page.
import "@/app/(main)/dashboard/chat/_components/sim-panel-persist";
import { SIMULATED, usePreviewSimSettled } from "@/lib/cw/preview-sim";
import { useCwList } from "@/lib/cw/store";
import { canDeleteContacts, useViewer } from "@/lib/cw/view-as";

import { DeleteContactDialog } from "./contact-dialogs";
import { ContactEditForm } from "./contact-edit";
import { simDeleteContacts, simMergeContacts } from "./contacts-sim";
import { useContactsStore } from "./contacts-store";
import type { Contact } from "./data";
import { ContactAvatar, LabelBadge, StatusBadge } from "./studio-ui";

// The person's conversations in the inbox (/dashboard/chat), newest first, with the live status and last message,
// so this page and "View Profile" in the conversation panel tell the same story.
type ContactConversation = { conversation: Conversation; meta: ConversationMeta | undefined; preview: string };

// F-2 (console errors): the inbox name comes from the hook's list, not from inboxOf() (which reads the store with
// getState()). While the page hydrates, the hook gives the seed list the server rendered; the saved list (a renamed
// inbox) replaces it right after. getState() could already hold the saved list at that moment: "Hydration failed".
function inboxNameIn(list: ReturnType<typeof useLiveInboxes>, conversation: Conversation): string {
  return (list.find((inbox) => inbox.id === conversation.channel) ?? list[0])?.name ?? "";
}

function useContactConversations(contact: Contact): ContactConversation[] {
  const meta = useCwStore((s) => s.meta);
  const sent = useCwStore((s) => s.sent);
  const deleted = useCwStore((s) => s.deleted);
  return baseConversations
    .filter((c) => contactIdOf(c.id) === contact.id && !deleted.includes(c.id))
    .map((c) => ({ conversation: c, meta: meta[c.id], preview: lastPreview(c, meta[c.id], sent[c.id]).text }));
}

// ---- Attributes (Chatwoot ContactCustomAttributes.vue) ----
// Values are the same as the Contact Attributes list of the conversation panel: read from and written to the inbox
// store for every conversation of this person. A person with no conversation keeps them in the contacts store.

type AttributeDef = (typeof contactAttributeDefs)[number];

function useContactAttributes(contact: Contact, own: ContactConversation[]) {
  const firstId = own[0]?.conversation.id;
  const fromInbox = useCwStore((s) => (firstId === undefined ? undefined : s.contactAttrs[firstId]));
  const local = useContactsStore((s) => s.attrs[contact.id]);
  const setLocal = useContactsStore((s) => s.setAttr);
  const values: Record<string, string> =
    firstId === undefined ? { signup_date: contact.createdAt, ...(local ?? {}) } : (fromInbox ?? {});
  function setValue(key: string, value: string | null) {
    if (firstId === undefined) setLocal(contact.id, key, value);
    else for (const { conversation } of own) cw.setContactAttr(conversation.id, key, value);
  }
  return { values, setValue };
}

function displayValue(def: AttributeDef, value: string) {
  if (def.type === "Checkbox") return value === "true" ? "Yes" : "No";
  return value;
}

function AttributeEditor({
  def,
  initial,
  onSave,
  onCancel,
}: {
  def: AttributeDef;
  initial: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  const invalid =
    !value.trim() ||
    (def.type === "Number" && Number.isNaN(Number(value))) ||
    (def.type === "Link" && !/^https?:\/\/\S+$/.test(value.trim()));
  return (
    <div className="flex items-center gap-1.5">
      {def.type === "List" ? (
        <NativeSelect size="sm" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="" disabled>
            Select value
          </option>
          {def.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </NativeSelect>
      ) : def.type === "Checkbox" ? (
        <NativeSelect size="sm" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="" disabled>
            Select value
          </option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </NativeSelect>
      ) : (
        <Input
          className="h-7 w-40"
          placeholder="Enter value"
          value={value}
          aria-invalid={invalid}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <Button size="icon-sm" variant="ghost" aria-label="Save" disabled={invalid} onClick={() => onSave(value.trim())}>
        <Check />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={onCancel}>
        <X />
      </Button>
    </div>
  );
}

function AttributesTab({
  values,
  setValue,
}: {
  values: Record<string, string>;
  setValue: (key: string, value: string | null) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const matches = (def: AttributeDef) => !q || def.label.toLowerCase().includes(q);
  const used = contactAttributeDefs.filter((def) => values[def.key] !== undefined && matches(def));
  const unused = contactAttributeDefs.filter((def) => values[def.key] === undefined && matches(def));

  function row(def: AttributeDef, isUsed: boolean) {
    return (
      <div key={def.key} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm">
        <span className="text-muted-foreground">{def.label}</span>
        {editing === def.key ? (
          <AttributeEditor
            def={def}
            initial={values[def.key] ?? ""}
            onCancel={() => setEditing(null)}
            onSave={(value) => {
              setValue(def.key, value);
              setEditing(null);
              toast.success("Attribute updated successfully");
            }}
          />
        ) : (
          <div className="flex items-center gap-1">
            <span className={isUsed ? "font-medium" : "text-muted-foreground"}>
              {isUsed ? displayValue(def, values[def.key] ?? "") : "---"}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${def.label}`} onClick={() => setEditing(def.key)}>
              <Pencil />
            </Button>
            {isUsed ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${def.label}`}
                onClick={() => {
                  setValue(def.key, null);
                  toast.success("Attribute deleted successfully");
                }}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* T-285 (Fahad 125.4): a lens that opens the box in its place; closing it brings back the lens alone. */}
      <div>
        <ExpandingSearch
          name="attributes"
          label="Search attributes"
          placeholder="Search for attributes"
          size="default"
          className="w-full"
          value={query}
          onChange={setQuery}
        />
      </div>
      {used.length ? <div className="divide-y rounded-lg border">{used.map((def) => row(def, true))}</div> : null}
      {unused.length ? (
        <div className="grid gap-2">
          <span className="text-muted-foreground text-xs">
            {unused.length} {unused.length === 1 ? "Unused attribute" : "Unused attributes"}
          </span>
          <div className="divide-y rounded-lg border border-dashed">{unused.map((def) => row(def, false))}</div>
        </div>
      ) : null}
      {!used.length && !unused.length ? (
        <p className="py-4 text-center text-muted-foreground text-sm">No attributes found</p>
      ) : null}
    </div>
  );
}

function HistoryTab({ contact, own }: { contact: Contact; own: ContactConversation[] }) {
  const inboxList = useLiveInboxes();
  if (own.length === 0) {
    return (
      <p className="rounded-lg border px-3 py-6 text-center text-muted-foreground text-sm">
        There are no previous conversations associated to this contact
      </p>
    );
  }
  return (
    <div className="divide-y rounded-lg border">
      {own.map(({ conversation: c, meta, preview }) => (
        <Link
          key={c.id}
          href={`/dashboard/chat?conversation=${c.id}`}
          className="grid gap-1 px-3 py-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">
              {contact.name} <span className="text-muted-foreground">#{c.id}</span>
            </span>
            <span className="shrink-0 text-muted-foreground text-xs">{c.time}</span>
          </div>
          <span className="truncate">{c.subject}</span>
          <span className="truncate text-muted-foreground">{preview}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 font-normal">
              <ChannelIcon channel={c.channel} className="size-3" />
              {inboxNameIn(inboxList, c)}
            </Badge>
            {meta && <StatusPill status={meta.status} />}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---- Notes (Chatwoot ContactNotes.vue), one list per contact ----

function NotesTab({ contact }: { contact: Contact }) {
  const notes = useContactsStore((s) => s.notes[contact.id]) ?? [];
  const { addNote, deleteNote } = useContactsStore.getState();
  const [draft, setDraft] = React.useState("");
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-lg border p-3">
        <Textarea
          placeholder="Add a note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-20 border-0 p-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim()}
            onClick={() => {
              addNote(contact.id, draft.trim());
              setDraft("");
            }}
          >
            Save note
          </Button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="py-2 text-center text-muted-foreground text-sm">
          There are no notes associated to this contact. You can add a note by typing in the box above.
        </p>
      ) : (
        notes.map((note) => (
          <div key={note.id} className="group grid gap-1.5 border-b pb-3 text-sm last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                <span className="font-medium text-foreground">
                  {note.author === "Arham Khan" ? "You" : note.author}
                </span>{" "}
                wrote {note.time}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Delete note"
                className="text-muted-foreground"
                onClick={() => deleteNote(contact.id, note.id)}
              >
                <Trash2 />
              </Button>
            </div>
            <p className="whitespace-pre-wrap">{note.body}</p>
          </div>
        ))
      )}
    </div>
  );
}

// ---- Media (Chatwoot ContactMedia.vue): the attachments of the person's conversations ----

function MediaTab({ own }: { own: ContactConversation[] }) {
  const items: { attachment: CwAttachment; conversationId: number }[] = own.flatMap(({ conversation, meta }) =>
    buildThread(conversation, meta).flatMap((message) =>
      (message.attachments ?? []).map((attachment) => ({ attachment, conversationId: conversation.id })),
    ),
  );
  const media = items.filter((i) => i.attachment.type === "image" || i.attachment.type === "video");
  const files = items.filter((i) => i.attachment.type === "file" || i.attachment.type === "audio");
  if (!media.length && !files.length) {
    return <p className="rounded-lg border px-3 py-6 text-center text-muted-foreground text-sm">No attachments yet</p>;
  }
  return (
    <div className="grid gap-4">
      {media.length ? (
        <div className="grid gap-2">
          <span className="font-medium text-sm">Media</span>
          <div className="grid grid-cols-3 gap-2">
            {media.map(({ attachment, conversationId }) => (
              <Link
                key={`${conversationId}-${attachment.name}`}
                href={`/dashboard/chat?conversation=${conversationId}`}
                className="grid gap-1.5"
              >
                <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
                <span className="truncate text-muted-foreground text-xs">{attachment.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {files.length ? (
        <div className="grid gap-2">
          <span className="font-medium text-sm">Files</span>
          <div className="divide-y rounded-lg border">
            {files.map(({ attachment, conversationId }) => (
              <Link
                key={`${conversationId}-${attachment.name}`}
                href={`/dashboard/chat?conversation=${conversationId}`}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <FileText className="size-4 text-muted-foreground" />
                <span className="truncate">{attachment.name}</span>
                <span className="ms-auto text-muted-foreground text-xs">{attachment.size ?? attachment.duration}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- Merge (Chatwoot ContactMerge.vue) ----

function MergeTab({ contact, onCancel }: { contact: Contact; onCancel: () => void }) {
  const router = useRouter();
  const list = useContactsStore((s) => s.list);
  const [query, setQuery] = React.useState("");
  const [primaryId, setPrimaryId] = React.useState<number | null>(null);
  const [error, setError] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const q = query.trim().toLowerCase();
  const options = list.filter(
    (c) => c.id !== contact.id && (!q || [c.name, c.email, c.phone].some((v) => v.toLowerCase().includes(q))),
  );
  const primary = list.find((c) => c.id === primaryId);

  return (
    <div className="grid gap-4 text-sm">
      <div className="grid gap-1">
        <span className="font-medium">Merge contact</span>
        <p className="text-muted-foreground">
          Combine two profiles into one, including all attributes and conversations. In case of conflict, the primary
          contact’s attributes will take precedence.
        </p>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Primary contact</Label>
          <span className="text-muted-foreground text-xs">To be saved</span>
        </div>
        <div className="relative">
          <InputGroup className="h-9">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              role="combobox"
              aria-expanded={open}
              placeholder={primary ? primary.name : "Search for primary contact"}
              value={query}
              aria-invalid={error}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
            />
          </InputGroup>
          {open ? (
            <div
              role="listbox"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
            >
              {options.length ? (
                options.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={c.id === primaryId}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPrimaryId(c.id);
                      setQuery("");
                      setError(false);
                      setOpen(false);
                    }}
                  >
                    <ContactAvatar contact={c} size="sm" />
                    <span className="truncate">{c.name}</span>
                    <span className="ms-auto truncate text-muted-foreground text-xs">{c.email}</span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-muted-foreground">No contacts found</div>
              )}
            </div>
          ) : null}
        </div>
        {primary ? (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <ContactAvatar contact={primary} size="sm" />
            <span>{primary.name}</span>
            <span className="truncate text-muted-foreground text-xs">{primary.email}</span>
            <Button
              size="icon-sm"
              variant="ghost"
              className="ms-auto"
              aria-label="Clear primary contact"
              onClick={() => setPrimaryId(null)}
            >
              <X />
            </Button>
          </div>
        ) : null}
        {error ? (
          <span className="text-destructive text-xs">Please select a contact to merge with before proceeding</span>
        ) : null}
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>To be merged</Label>
          <span className="text-muted-foreground text-xs">To be deleted</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <ContactAvatar contact={contact} size="sm" />
          <span>{contact.name}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPrimaryId(null);
            setError(false);
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (!primary) {
              setError(true);
              return;
            }
            // M129-A round 2: recorded in the preview's saved record, so it survives a reload; the toast says
            // it is simulated (contacts-sim.ts).
            simMergeContacts(primary.id, contact.id);
            router.push("/dashboard/contacts");
          }}
        >
          Merge contact
        </Button>
      </div>
    </div>
  );
}

// ---- Labels (Chatwoot ContactLabels.vue) ----

function ContactLabels({ contact }: { contact: Contact }) {
  const [sharedLabels] = useCwList("labels");
  const { addLabels, removeLabels } = useContactsStore.getState();
  const available = sharedLabels.filter((l) => !contact.labels.includes(l.title));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {contact.labels.map((label) => (
        <span key={label} className="inline-flex items-center">
          <LabelBadge label={label} />
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-6 text-muted-foreground"
            aria-label={`Remove label ${label}`}
            onClick={() => removeLabels([contact.id], [label])}
          >
            <X className="size-3" />
          </Button>
        </span>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="xs" className="text-muted-foreground">
            <Tag /> Add labels
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
          {available.length ? (
            available.map((l) => (
              <DropdownMenuItem key={l.id} onSelect={() => addLabels([contact.id], [l.title])}>
                <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.title}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuLabel className="font-normal text-muted-foreground">No labels found</DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type Stat = { icon: typeof Inbox; label: string; value: string; trend?: string; up?: boolean; note: string };

const dash = (v: string) => v?.trim() || "—";

function joinNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

// Conversations and Open are counted from the person's inbox conversations (same ids, inboxes and status).
function contactStats(
  own: ContactConversation[],
  contactId: number,
  inboxList: ReturnType<typeof useLiveInboxes>,
): Stat[] {
  const inboxNames = [...new Set(own.map(({ conversation }) => inboxNameIn(inboxList, conversation)))];
  const open = own.filter(({ meta }) => meta?.status === "open").length;
  return [
    {
      icon: MessagesSquare,
      label: "Conversations",
      value: String(own.length),
      note: own.length ? `Across ${joinNames(inboxNames)}` : "No conversations yet",
    },
    {
      icon: Inbox,
      label: "Open",
      value: String(open),
      note: open ? "Waiting on your team" : "Nothing waiting on your team",
    },
    firstResponseStat(own),
    csatStat(contactId),
  ];
}

// F159: the person's own first response time (customer's first message -> first agent reply in each of their
// conversations), against the team average over every answered conversation (reports data.ts).
function firstResponseStat(own: ContactConversation[]): Stat {
  const times = own
    .map(({ conversation }) => firstResponseMinutes(conversation.id))
    .filter((v): v is number => v !== null);
  if (!times.length) {
    return {
      icon: Timer,
      label: "Avg. first response",
      value: "--",
      note: own.length ? "Still waiting for a first reply" : "No conversations yet",
    };
  }
  const avg = times.reduce((sum, v) => sum + v, 0) / times.length;
  const diff = Math.round(((avg - teamFirstResponse) / teamFirstResponse) * 100);
  const waiting = own.length - times.length;
  return {
    icon: Timer,
    label: "Avg. first response",
    value: formatMinutes(avg),
    trend: diff === 0 ? undefined : `${diff > 0 ? "+" : ""}${diff}%`,
    up: diff > 0,
    note:
      (diff === 0
        ? "Same as team average"
        : `${diff < 0 ? "Faster" : "Slower"} than team average (${formatMinutes(teamFirstResponse)})`) +
      (waiting ? ` · ${waiting} waiting` : ""),
  };
}

// F159: from the person's CSAT responses on the CSAT report (same conversations and ratings).
function csatStat(contactId: number): Stat {
  const { ratings, score } = contactCsat(contactId);
  if (score === null) return { icon: Smile, label: "CSAT", value: "--", note: "No ratings yet" };
  return {
    icon: Smile,
    label: "CSAT",
    value: `${score}%`,
    note: `From ${ratings} ${ratings === 1 ? "rating" : "ratings"}`,
  };
}

function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardTitle>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <stat.icon className="size-4" />
              </div>
            </CardTitle>
            <CardDescription>{stat.label}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{stat.value}</div>
              {stat.trend && (
                <Badge>
                  {stat.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {stat.trend}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{stat.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ContactDetails({ contact: initial }: { contact: Contact }) {
  // F-5A "View as": only administrators delete contacts (Chatwoot ContactDetails.vue <Policy :permissions="['administrator']">).
  const canDelete = canDeleteContacts(useViewer());
  const router = useRouter();
  const params = useSearchParams();
  // The live copy from the contacts store (edits, labels, merges); the prop is the contact the page was opened with.
  const contact = useContactsStore((s) => s.list.find((c) => c.id === initial.id)) ?? initial;
  const blocked = useContactsStore((s) => s.blocked.includes(contact.id));
  const notesCount = useContactsStore((s) => s.notes[contact.id]?.length ?? 0);
  const { toggleBlock } = useContactsStore.getState();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [tab, setTab] = React.useState(params.get("tab") === "merge" ? "merge" : "attributes");
  const own = useContactConversations(contact);
  const inboxList = useLiveInboxes();
  const { values, setValue } = useContactAttributes(contact, own);
  const usedCount = contactAttributeDefs.filter((def) => values[def.key] !== undefined).length;
  const latest = own[0]?.conversation;

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard/contacts">Contacts</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{contact.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-4">
            <ContactAvatar contact={contact} status={blocked ? "Blocked" : undefined} className="size-14 text-lg" />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl leading-none tracking-tight">{contact.name}</h1>
                {blocked ? <StatusBadge status="Blocked" /> : null}
              </div>
              <p className="text-muted-foreground text-sm">
                {[contact.email, contact.company, [contact.city, contact.country].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-muted-foreground text-sm">
                Created {dash(contact.createdAt)} • Last activity {dash(contact.lastActivity)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // F-3: kept in the preview's saved record; said only once saved (a failed save says so itself).
                const { blocked: nowBlocked, saved } = toggleBlock(contact.id);
                void saved.then((ok) => {
                  if (ok)
                    toast.success(
                      nowBlocked ? "This contact is blocked successfully" : "This contact is unblocked successfully",
                      { description: `${SIMULATED}: saved in this preview's data. Nothing was changed in the engine.` },
                    );
                });
              }}
            >
              <Ban /> {blocked ? "Unblock contact" : "Block contact"}
            </Button>
            {latest ? (
              <Button size="sm" asChild>
                <Link href={`/dashboard/chat?conversation=${latest.id}`}>
                  <MessageSquare /> Send message
                </Link>
              </Button>
            ) : (
              // F-3: no conversation yet: "New conversation" to this contact (it used to open the first conversation
              // in the inbox, someone else's). The dialog lives in Conversations, like the sidebar's Quick Create.
              <Button
                size="sm"
                onClick={() => {
                  openDialog({ type: "new-conversation", contact: contact.name, contactId: contact.id });
                  router.push("/dashboard/chat");
                }}
              >
                <MessageSquare /> Send message
              </Button>
            )}
          </div>
        </div>
      </div>

      <StatCards stats={contactStats(own, contact.id, inboxList)} />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_480px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl leading-none">Edit contact details</CardTitle>
            <CardDescription className="leading-snug">Profile, labels and social links.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <span className="text-muted-foreground text-sm">Labels</span>
              <ContactLabels contact={contact} />
            </div>

            <ContactEditForm contact={contact} />

            {canDelete && <Separator />}

            <div
              className={`flex flex-wrap items-center justify-between gap-3${canDelete ? "" : " hidden"}`}
              data-delete-contact={canDelete ? "shown" : "hidden"}
            >
              <div className="grid gap-1">
                <span className="font-medium text-sm">Delete contact</span>
                <span className="text-muted-foreground text-sm">
                  Permanently delete this contact. This action is irreversible
                </span>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete contact
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl leading-none">Activity</CardTitle>
            <CardDescription className="leading-snug">Attributes, history, notes, media and merge.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="gap-4">
              <TabsList
                variant="line"
                className="w-full justify-start gap-2 overflow-x-auto border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
              >
                <TabsTrigger value="attributes">
                  Attributes
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {usedCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="history">
                  History
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {own.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="notes">
                  Notes
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {notesCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="merge">Merge</TabsTrigger>
              </TabsList>
              <TabsContent value="attributes">
                <AttributesTab values={values} setValue={setValue} />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab contact={contact} own={own} />
              </TabsContent>
              <TabsContent value="notes">
                <NotesTab contact={contact} />
              </TabsContent>
              <TabsContent value="media">
                <MediaTab own={own} />
              </TabsContent>
              <TabsContent value="merge">
                <MergeTab contact={contact} onCancel={() => setTab("attributes")} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <DeleteContactDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          router.push("/dashboard/contacts");
          // M129-A round 2: recorded in the preview's saved record with the contact's conversations (contacts-sim.ts).
          simDeleteContacts([contact.id]);
        }}
      />
    </div>
  );
}

// F161: the contact page reads the contacts store, so contacts added on the list (or imported) open too.
// M129-A: it decides "not found" only after the preview's saved record is replayed (contacts-store.ts), so a contact
// added by Save Contact opens after a reload, and one deleted or merged from a conversation does not.
export function ContactDetailsPage({ id }: { id: number }) {
  const contact = useContactsStore((s) => s.list.find((c) => c.id === id));
  const settled = usePreviewSimSettled();
  const linkedStatus = useLinkedAdapterStatus();
  const ready = linkedStatus.active ? !linkedStatus.loading : settled;
  const [gone, setGone] = React.useState<boolean | null>(null);
  if (ready && gone === null && !contact) {
    setGone(!useContactsStore.getState().list.some((c) => c.id === id));
  }
  if (gone && !contact) notFound();
  // Deleted or merged while open, or still loading linked contacts:
  if (!contact) return null;
  return <ContactDetails contact={contact} />;
}

"use client";
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  Ban,
  ImageIcon,
  Inbox,
  MessageSquare,
  MessagesSquare,
  Search,
  Smile,
  Tag,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";

import {
  baseConversations,
  type Conversation,
  type ConversationMeta,
  contactAttributeDefs,
  contactIdOf,
  inboxOf,
  initialContactAttributes,
  lastPreview,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { ChannelIcon, StatusPill } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import {
  contactCsat,
  firstResponseMinutes,
  formatMinutes,
  teamFirstResponse,
} from "@/app/(main)/dashboard/reports/_components/data";

import { ContactFormFields, DeleteContactDialog, SocialLinksFields } from "./contact-dialogs";
import { type Contact, contacts, notes, toneFor } from "./data";
import { ContactAvatar, contactStatus, LabelBadge, StatusBadge } from "./studio-ui";

// The person's conversations in the inbox (/dashboard/chat), newest first, with the live status and last message,
// so this page and "View Profile" in the conversation panel tell the same story.
type ContactConversation = { conversation: Conversation; meta: ConversationMeta | undefined; preview: string };

function useContactConversations(contact: Contact): ContactConversation[] {
  const meta = useCwStore((s) => s.meta);
  const sent = useCwStore((s) => s.sent);
  const deleted = useCwStore((s) => s.deleted);
  return baseConversations
    .filter((c) => contactIdOf(c.id) === contact.id && !deleted.includes(c.id))
    .map((c) => ({ conversation: c, meta: meta[c.id], preview: lastPreview(c, meta[c.id], sent[c.id]).text }));
}

// Same values as the Contact Attributes list in the conversation panel (cw-data initialContactAttributes).
function contactAttributes(contact: Contact, own: ContactConversation[]) {
  const values: Record<string, string> = own[0]
    ? initialContactAttributes(own[0].conversation)
    : { signup_date: contact.createdAt };
  const used = contactAttributeDefs.filter((def) => values[def.key] !== undefined);
  const shown = used.map((def) => {
    const value = values[def.key] ?? "";
    return { label: def.label, value: def.type === "Checkbox" ? (value === "true" ? "True" : "False") : value };
  });
  return { shown, unused: contactAttributeDefs.length - used.length };
}

function AttributesTab({ attributes, unused }: { attributes: { label: string; value: string }[]; unused: number }) {
  return (
    <div className="grid gap-3">
      <InputGroup className="h-8">
        <InputGroupAddon align="inline-start">
          <Search className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search for attributes" />
      </InputGroup>
      <div className="divide-y rounded-lg border">
        {attributes.map((attr) => (
          <div key={attr.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">{attr.label}</span>
            <span className="font-medium">{attr.value}</span>
          </div>
        ))}
      </div>
      {unused > 0 && <span className="text-muted-foreground text-xs">{unused} Unused attributes</span>}
    </div>
  );
}

function HistoryTab({ contact, own }: { contact: Contact; own: ContactConversation[] }) {
  if (own.length === 0) {
    return (
      <p className="rounded-lg border px-3 py-6 text-center text-muted-foreground text-sm">
        There are no previous conversations associated to this contact.
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
              {inboxOf(c).name}
            </Badge>
            {meta && <StatusPill status={meta.status} />}
          </div>
        </Link>
      ))}
    </div>
  );
}

function NotesTab() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-lg border p-3">
        <Textarea placeholder="Add a note" className="min-h-20 border-0 p-0 shadow-none focus-visible:ring-0" />
        <div className="flex justify-end">
          <Button size="sm">Save note</Button>
        </div>
      </div>
      {notes.map((note) => (
        <div key={note.body} className="grid gap-1.5 border-b pb-3 text-sm last:border-0">
          <span className="text-muted-foreground text-xs">
            <span className="font-medium text-foreground">{note.author}</span> wrote {note.time}
          </span>
          <p>{note.body}</p>
        </div>
      ))}
    </div>
  );
}

function MediaTab() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {["Receipt.jpg", "ID card.png", "Voice note"].map((name) => (
        <div key={name} className="grid gap-1.5">
          <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
          <span className="truncate text-muted-foreground text-xs">{name}</span>
        </div>
      ))}
    </div>
  );
}

function MergeTab({ contact }: { contact: Contact }) {
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
        <NativeSelect className="w-full" defaultValue="">
          <option value="" disabled>
            Search for primary contact
          </option>
          {contacts
            .filter((c) => c.id !== contact.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>To be merged</Label>
          <span className="text-muted-foreground text-xs">To be deleted</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Avatar className="size-6">
            <AvatarFallback className={cn("text-[10px]", toneFor(contact.id))}>
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>
          <span>{contact.name}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm">Merge contact</Button>
      </div>
    </div>
  );
}

type Stat = { icon: typeof Inbox; label: string; value: string; trend?: string; up?: boolean; note: string };

function joinNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

// Conversations and Open are counted from the person's inbox conversations (same ids, inboxes and status).
function contactStats(own: ContactConversation[], contactId: number): Stat[] {
  const inboxNames = [...new Set(own.map(({ conversation }) => inboxOf(conversation).name))];
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

export function ContactDetails({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const own = useContactConversations(contact);
  const { shown: attributes, unused } = contactAttributes(contact, own);

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
              <div className="flex items-center gap-2">
                <h1 className="text-3xl leading-none tracking-tight">{contact.name}</h1>
                <StatusBadge status={blocked ? "Blocked" : contactStatus(contact)} />
              </div>
              <p className="text-muted-foreground text-sm">
                {contact.email} · {contact.company ? `${contact.company} · ` : ""}
                {contact.city}, {contact.country} · Created {contact.createdAt}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBlocked((b) => !b)}>
              <Ban /> {blocked ? "Unblock contact" : "Block contact"}
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/chat">
                <MessageSquare /> Send message
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <StatCards stats={contactStats(own, contact.id)} />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_480px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl leading-none">Contact details</CardTitle>
            <CardDescription className="leading-snug">
              Last active {contact.lastActivity}. Edit profile, labels and social links.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <span className="text-muted-foreground text-sm">Labels</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {contact.labels.map((label) => (
                  <LabelBadge key={label} label={label} />
                ))}
                <Button variant="outline" size="xs" className="text-muted-foreground">
                  <Tag /> Add labels
                </Button>
              </div>
            </div>

            <ContactFormFields contact={contact} />
            <SocialLinksFields />
            <div>
              <Button size="sm">Update contact</Button>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
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
            <CardDescription className="leading-snug">Attributes, history, notes and media.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="attributes" className="gap-4">
              <TabsList
                variant="line"
                className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
              >
                <TabsTrigger value="attributes">
                  Attributes
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {attributes.length}
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
                    {notes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="merge">Merge</TabsTrigger>
              </TabsList>
              <TabsContent value="attributes">
                <AttributesTab attributes={attributes} unused={unused} />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab contact={contact} own={own} />
              </TabsContent>
              <TabsContent value="notes">
                <NotesTab />
              </TabsContent>
              <TabsContent value="media">
                <MediaTab />
              </TabsContent>
              <TabsContent value="merge">
                <MergeTab contact={contact} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <DeleteContactDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => router.push("/dashboard/contacts")}
      />
    </div>
  );
}

"use client";

// L-2 (plan r1-chatwoot-link/خطة.md 4, phase 1): the contacts page when "Contacts" is linked to the Chatwoot test
// copy. Read-only: the list comes from /api/chatwoot/contacts and a contact's "Conversations" from
// /api/chatwoot/contacts/<id> (Chatwoot GET /contacts/{id}/conversations). Write controls are disabled with
// "Read-only link (phase 1)". The preview contacts store and its simulation records are not read.
import * as React from "react";

import { ChevronDown, ChevronRight, Link2, Lock, Plus, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LINK_BADGE_TEXT,
  type LinkedContact,
  type LinkedContactsBody,
  READ_ONLY_TEXT,
} from "@/lib/chatwoot-link-types";

import { LinkedLoading, LinkProblemPanel } from "./linked-conversations";
import { type Linked, useLinkedContact } from "./use-linked";

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ContactConversations({ contact }: { contact: LinkedContact }) {
  const read = useLinkedContact(contact.id);
  if (read.error) return <p className="text-destructive text-xs">{read.error}</p>;
  if (read.loading) return <p className="text-muted-foreground text-xs">Reading the conversations…</p>;
  const rows = read.data?.conversations ?? [];
  return (
    <div className="flex flex-col gap-2" data-linked-contact-conversations={contact.key}>
      <span className="font-medium text-xs">Conversations ({rows.length})</span>
      {rows.length ? (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">#{row.id}</span>
              <span className="text-muted-foreground">{row.inbox.name}</span>
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                {row.status}
              </Badge>
              {row.labels.map((label) => (
                <Badge key={label} variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {label}
                </Badge>
              ))}
              {row.lastMessage && (
                <span className="min-w-0 max-w-full truncate text-muted-foreground">{row.lastMessage.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-muted-foreground text-xs">No conversations.</span>
      )}
    </div>
  );
}

/** `list` is useLinkedContacts() of contacts-list.tsx; `viewName` is set for views showing all contacts. */
export function LinkedContacts({ list, viewName }: { list: Linked<LinkedContactsBody>; viewName?: string }) {
  const [open, setOpen] = React.useState<number | null>(null);
  const rows = list.data?.contacts ?? [];
  return (
    <div className="flex flex-col gap-4" data-chatwoot-linked="contacts">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">Contacts</h1>
        <p className="text-muted-foreground text-sm">Contacts of the live engine.</p>
        {viewName && (
          <p className="text-muted-foreground text-xs">“{viewName}” shows all contacts of the live engine.</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            All contacts
            {list.data && (
              <Badge variant="secondary" className="tabular-nums">
                {list.data.total}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Link2 /> {LINK_BADGE_TEXT}
            </Badge>
            <span className="flex items-center gap-1 text-xs">
              <Lock className="size-3" /> {READ_ONLY_TEXT}
            </span>
          </CardDescription>
          <CardAction className="flex gap-2">
            <Button variant="outline" size="sm" disabled title={READ_ONLY_TEXT}>
              <Upload /> Import
            </Button>
            <Button size="sm" disabled title={READ_ONLY_TEXT}>
              <Plus /> Add contact
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {list.error ? (
            <div className="min-h-64">
              <LinkProblemPanel message={list.error} onRetry={list.reload} />
            </div>
          ) : list.loading ? (
            <div className="min-h-32">
              <LinkedLoading what="the contacts" />
            </div>
          ) : rows.length ? (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-[24%]">Name</TableHead>
                  <TableHead className="w-[28%]">Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((contact) => {
                  const expanded = open === contact.id;
                  return (
                    <React.Fragment key={contact.key}>
                      <TableRow data-linked-contact={contact.key}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`${expanded ? "Hide" : "Show"} the conversations of ${contact.name}`}
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : contact.id)}
                          >
                            {expanded ? <ChevronDown /> : <ChevronRight />}
                          </Button>
                        </TableCell>
                        <TableCell className="truncate font-medium">{contact.name}</TableCell>
                        <TableCell className="truncate">{contact.email ?? "—"}</TableCell>
                        <TableCell className="truncate">{contact.phone ?? "—"}</TableCell>
                        <TableCell className="truncate">
                          {[contact.city, contact.country].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="truncate">{when(contact.lastActivityAt)}</TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell />
                          <TableCell colSpan={5} className="whitespace-normal">
                            <ContactConversations contact={contact} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-center text-muted-foreground text-sm">The live engine lists no contacts.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

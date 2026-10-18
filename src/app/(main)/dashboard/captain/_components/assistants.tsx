"use client";
// Chatwoot: routes/dashboard/captain/assistants/Index.vue + components-next/captain/pageComponents/assistant.
// Studio: heading outside the card, card header with search and sort, table with a "…" menu per row.
import * as React from "react";

import Link from "next/link";

import { Bot, FileText, Inbox, MessageCircleQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CeUnavailableNotice, rejectCeWrite } from "@/lib/chatwoot/settings-adapter";
import { linkedSession, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";

import type { Assistant } from "./data";
import { AssistantDialog, ConfirmDialog } from "./dialogs";
import { CaptainShell, ChipSelect, RowMenuTrigger } from "./shared";
import { useCaptainState } from "./store";

const sortOptions = [
  { value: "updated", label: "Last updated" },
  { value: "name", label: "Name" },
  { value: "faqs", label: "Most FAQs" },
];

export function AssistantsList({ create = false }: { create?: boolean }) {
  const [rawAssistants, setAssistants] = useCaptainState("assistants");
  useLinkedAdapterStatus((s) => s.active);
  const isLinked = linkedSession();
  const assistants = isLinked ? [] : rawAssistants;
  const [creating, setCreating] = React.useState(create);
  const [editing, setEditing] = React.useState<Assistant | null>(null);
  const [deleting, setDeleting] = React.useState<Assistant | null>(null);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState("updated");

  const openCreate = () => {
    if (linkedSession()) {
      void rejectCeWrite("captain/assistants").catch((err: Error) => toast.error(err.message));
      return;
    }
    setCreating(true);
  };

  const q = query.trim().toLowerCase();
  const rows = [...assistants]
    .filter((a) => !q || [a.name, a.productName, a.description].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "faqs") return b.faqs - a.faqs;
      return a.id - b.id;
    });

  return (
    <CaptainShell
      title="Assistants"
      switcher={false}
      nav={false}
      subtitle="Create an assistant to provide quick and accurate responses to your users. It can learn from your help articles and past conversations."
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus /> Create a new assistant
        </Button>
      }
    >
      <CeUnavailableNotice
        area="captain/assistants"
        title="Captain AI assistants are unavailable in Chatwoot Community Edition (501)"
      />
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">All assistants</CardTitle>
          <CardDescription>Switch between assistants from the selector on every Captain page.</CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end">
            <ExpandingSearch
              name="assistants"
              label="Search assistants"
              placeholder="Search assistants..."
              className="w-full md:w-64"
              value={query}
              onChange={setQuery}
            />
            <ChipSelect label="Sort" value={sort} options={sortOptions} onChange={setSort} align="end" />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 font-normal">Assistant</TableHead>
                  <TableHead className="py-4 font-normal">Product</TableHead>
                  <TableHead className="py-4 font-normal">Knowledge</TableHead>
                  <TableHead className="py-4 font-normal">Inboxes</TableHead>
                  <TableHead className="py-4 font-normal">Last updated</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} className="border-border/60">
                    <TableCell className="py-4">
                      <Link href="/dashboard/captain" className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Bot className="size-4" />
                        </div>
                        <div className="grid max-w-md gap-0.5">
                          <span className="font-medium text-sm">{a.name}</span>
                          <span className="line-clamp-1 whitespace-normal text-muted-foreground text-sm">
                            {a.description}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="border-border bg-muted/50 px-2 py-1 font-medium">
                        {a.productName}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3 text-muted-foreground text-sm">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <FileText className="size-3.5" /> {a.documents} documents
                        </span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <MessageCircleQuestion className="size-3.5" /> {a.faqs} FAQs
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Inbox className="size-3.5 text-muted-foreground" /> {a.inboxes}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-4 text-muted-foreground text-sm">
                      {a.updatedAt}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <RowMenuTrigger label={`Open actions for ${a.name}`} />
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onSelect={() => setEditing(a)}>
                            <Pencil /> Edit Assistant
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/dashboard/captain/inboxes">
                              <Inbox /> View connected inboxes
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(a)}>
                            <Trash2 /> Delete Assistant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <>
              {assistants.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bot />
                    </EmptyMedia>
                    <EmptyTitle>No assistants available</EmptyTitle>
                    <EmptyDescription>
                      Create an assistant to provide quick and accurate responses to your users. It can learn from your
                      help articles and past conversations.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" onClick={openCreate}>
                      <Plus /> Create a new assistant
                    </Button>
                    <p className="max-w-md text-muted-foreground text-xs">
                      <span className="font-medium text-foreground">Captain Assistant: </span>Captain Assistant engages
                      directly with customers, learns from your help docs and past conversations, and delivers instant,
                      accurate responses. It handles the initial queries, providing quick resolutions before
                      transferring to an agent when needed.
                    </p>
                  </EmptyContent>
                </Empty>
              )}
              {assistants.length > 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bot />
                    </EmptyMedia>
                    <EmptyTitle>No assistants available</EmptyTitle>
                    <EmptyDescription>Try a different search term.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AssistantDialog open={creating} onOpenChange={setCreating} />
      <AssistantDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        assistant={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Are you sure to delete the assistant?"
        description="This action is permanent. Deleting this assistant will remove it from all connected inboxes and permanently erase all generated knowledge."
        success="The assistant has been successfully deleted"
        onConfirm={() => {
          const target = deleting;
          if (target) setAssistants((list) => list.filter((a) => a.id !== target.id));
        }}
      />
    </CaptainShell>
  );
}

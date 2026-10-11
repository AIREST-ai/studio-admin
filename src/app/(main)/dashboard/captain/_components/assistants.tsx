"use client";
import * as React from "react";

import Link from "next/link";

import { Bot, EllipsisVertical, FileText, Inbox, MessageCircleQuestion, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { type Assistant, assistants } from "./data";
import { AssistantDialog, ConfirmDialog } from "./dialogs";
import { CaptainCardHeader } from "./shared";

export function AssistantsList() {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Assistant | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  return (
    <>
      <Card>
        <CaptainCardHeader
          title="Assistants"
          switcher={false}
          description="Create an assistant to provide quick and accurate responses to your users. It can learn from your help articles and past conversations."
        >
          <Button size="sm" onClick={() => setCreating(true)}>
            Create a new assistant
          </Button>
        </CaptainCardHeader>
        <CardContent className="grid gap-3">
          {assistants.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center"
            >
              <div className="flex flex-1 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href="/dashboard/captain" className="font-medium hover:underline">
                      {a.name}
                    </Link>
                    <Badge variant="secondary" className="font-normal">
                      {a.productName}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{a.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground text-xs md:gap-6">
                <span className="inline-flex items-center gap-1.5">
                  <Inbox className="size-3.5" /> {a.inboxes} inboxes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="size-3.5" /> {a.documents} documents
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircleQuestion className="size-3.5" /> {a.faqs} FAQs
                </span>
                <span className="hidden whitespace-nowrap lg:inline">Updated {a.updatedAt}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Assistant options">
                      <EllipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
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
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                      <Trash2 /> Delete Assistant
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
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
        open={deleting}
        onOpenChange={setDeleting}
        title="Are you sure to delete the assistant?"
        description="This action is permanent. Deleting this assistant will remove it from all connected inboxes and permanently erase all generated knowledge."
      />
    </>
  );
}

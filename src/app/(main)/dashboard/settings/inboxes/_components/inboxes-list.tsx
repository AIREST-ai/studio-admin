"use client";
import * as React from "react";

import Link from "next/link";

import { Settings, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { channelFor, type Inbox, inboxes } from "./data";
import { ConfirmDeleteDialog, SettingsHeader } from "./settings-ui";

export function InboxesList() {
  const [query, setQuery] = React.useState("");
  const [toDelete, setToDelete] = React.useState<Inbox | null>(null);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inboxes;
    return inboxes.filter((inbox) =>
      [inbox.name, channelFor(inbox.channel).name, inbox.identifier].some((v) => v.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <>
      <Card className="gap-0 py-0">
        <SettingsHeader
          title="Inboxes"
          description="A channel is the mode of communication your customer chooses to interact with you. An inbox is where you manage interactions for a specific channel. It can include communications from various sources such as email, live chat, and social media."
          linkText="Learn more about inboxes"
          search={query}
          onSearch={setQuery}
          searchPlaceholder="Search inbox name, channel, or identifier..."
          count={`${inboxes.length} inboxes`}
          actions={
            <Button size="sm" asChild>
              <Link href="/dashboard/settings/inboxes/new">Add Inbox</Link>
            </Button>
          }
        />
        {rows.length ? (
          <div className="divide-y px-6">
            {rows.map((inbox) => {
              const channel = channelFor(inbox.channel);
              const Icon = channel.icon;
              return (
                <div key={inbox.id} className="flex items-center justify-between gap-4 py-4">
                  <Link href={`/dashboard/settings/inboxes/${inbox.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-muted/50 shadow-xs">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="grid min-w-0 gap-1">
                      <span className="truncate font-medium">{inbox.name}</span>
                      <span className="flex min-w-0 items-center gap-1 text-muted-foreground text-sm">
                        <span className="shrink-0">{channel.name}</span>
                        {inbox.identifier ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <bdi dir="auto" className="truncate">
                              {inbox.identifier}
                            </bdi>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon-sm" aria-label="Settings" asChild>
                          <Link href={`/dashboard/settings/inboxes/${inbox.id}`}>
                            <Settings />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Settings</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Delete"
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setToDelete(inbox)}
                        >
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-muted-foreground">No inboxes found matching your search</div>
        )}
      </Card>

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Confirm Deletion"
        message={`Are you sure to delete ${toDelete?.name ?? ""}?`}
        confirmValue={toDelete?.name ?? ""}
        placeholder={`Please type ${toDelete?.name ?? ""} to confirm`}
        confirmText={`Yes, Delete ${toDelete?.name ?? ""}`}
        rejectText={`No, Keep ${toDelete?.name ?? ""}`}
      />
    </>
  );
}

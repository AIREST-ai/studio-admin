"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { MessageSquare, MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { NoResults, SettingsShell } from "../../labels/_shared/settings-shell";
import { channelFor, type Inbox, inboxChannelName } from "./data";
import { toastInboxSaved } from "./inbox-extras";
import { inboxesStore, useAgentRoster, useInboxes, whenSaved } from "./inboxes-store";
import { AgentAvatar, ConfirmDeleteDialog } from "./settings-ui";

// Tabs from Chatwoot's per-inbox "Enable auto assignment" setting.
type InboxView = "all" | "auto" | "manual";
const inboxViews: Record<InboxView, { label: string; match: (inbox: Inbox) => boolean }> = {
  all: { label: "All inboxes", match: () => true },
  auto: { label: "Auto assignment on", match: (inbox) => inbox.autoAssign },
  manual: { label: "Auto assignment off", match: (inbox) => !inbox.autoAssign },
};

export function InboxesList() {
  const agents = useAgentRoster(); // F-6B: an inbox's agents count an invited agent too
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<InboxView>("all");
  const [toDelete, setToDelete] = React.useState<Inbox | null>(null);
  const inboxes = useInboxes();

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return inboxes.filter(
      (inbox) =>
        inboxViews[view].match(inbox) &&
        (!q || [inbox.name, inboxChannelName(inbox), inbox.identifier].some((v) => v.toLowerCase().includes(q))),
    );
  }, [query, view, inboxes]);

  return (
    <>
      <SettingsShell
        title="Inboxes"
        description="A channel is the mode of communication your customer chooses to interact with you. An inbox is where you manage interactions for a specific channel. It can include communications from various sources such as email, live chat, and social media."
        learnMore="Learn more about inboxes"
        count={`${rows.length} ${rows.length === 1 ? "inbox" : "inboxes"}`}
        search={{ placeholder: "Search inbox name, channel, or identifier...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard/settings/inboxes/new">
              <Plus /> Add Inbox
            </Link>
          </Button>
        }
        tabs={{
          value: view,
          onValueChange: (v) => setView(v as InboxView),
          items: (Object.keys(inboxViews) as InboxView[]).map((key) => ({
            value: key,
            label: inboxViews[key].label,
            count: inboxes.filter(inboxViews[key].match).length,
          })),
        }}
        cardDescription="Each inbox, its channel and the agents who answer it."
      >
        {rows.length ? (
          // F-9: cells keep 1.5rem sides from 1280 px up and 1rem below, so at 1024 the whole table fits its card
          // and needs no sideways scroll.
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4 xl:**:data-[slot='table-cell']:px-6 xl:**:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Inbox</TableHead>
                <TableHead className="py-3 font-normal">Channel</TableHead>
                <TableHead className="py-3 font-normal">Agents</TableHead>
                {/* F-9: the long header may take two lines, so the table fits the 1024 card. */}
                <TableHead className="w-28 whitespace-normal py-3 font-normal leading-tight">Auto assignment</TableHead>
                <TableHead className="sticky right-0 w-16 bg-card py-3 text-right font-normal shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inbox) => {
                const channel = channelFor(inbox.channel);
                const Icon = channel.icon;
                const members = agents.filter((agent) => inbox.agents.includes(agent.id));
                return (
                  <TableRow key={inbox.id} className="border-border/60">
                    {/* F-9 (sim3 step 6.0: "Support…", "WhatsA…" cut at 1024): the name column keeps 12rem and the name
                        wraps instead of being cut; the full name is still in its title. */}
                    <TableCell className="min-w-48 py-3.5">
                      <Link
                        href={`/dashboard/settings/inboxes/${inbox.id}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/50">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="grid min-w-0 gap-0.5">
                          <span className="break-words font-medium" title={inbox.name}>
                            {inbox.name}
                          </span>
                          <bdi dir="auto" title={inbox.identifier} className="truncate text-muted-foreground text-xs">
                            {inbox.identifier}
                          </bdi>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className="gap-1.5 px-2 py-1 font-normal">
                        <Icon className="size-3" />
                        {inboxChannelName(inbox)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        {/* F-9: at most three faces and a "+N" chip (as the Agents table's Inboxes column), so a
                            busy inbox no longer takes the room of the inbox names; every name is in the title. */}
                        <div className="flex -space-x-1.5" title={members.map((m) => m.name).join(", ")}>
                          {members.slice(0, 3).map((m) => (
                            <AgentAvatar key={m.id} id={m.id} name={m.name} className="size-7 ring-2 ring-card" />
                          ))}
                          {members.length > 3 ? (
                            <span className="z-[1] grid size-7 place-items-center rounded-full bg-muted font-medium text-[10px] text-muted-foreground ring-2 ring-card tabular-nums">
                              +{members.length - 3}
                            </span>
                          ) : null}
                        </div>
                        {/* F-9: the count once, beside three faces only when there is no "+N" chip */}
                        {members.length <= 3 ? (
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {members.length} {members.length === 1 ? "agent" : "agents"}
                          </span>
                        ) : (
                          <span className="sr-only">{members.length} agents</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 border px-2 py-1 font-medium",
                          inbox.autoAssign
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-muted/50 text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            inbox.autoAssign ? "bg-emerald-500" : "bg-muted-foreground",
                          )}
                        />
                        {inbox.autoAssign ? "On" : "Off"}
                      </Badge>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card py-3.5 text-right shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Inbox actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/settings/inboxes/${inbox.id}`}>
                              <Settings /> Settings
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={inbox.slug ? `/dashboard/chat/channels/${inbox.slug}` : "/dashboard/chat"}>
                              <MessageSquare /> View conversations
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(inbox)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {inboxes.length
              ? "No inboxes found matching your search"
              : "There are no inboxes attached to this account."}
          </NoResults>
        )}
      </SettingsShell>

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete inbox"
        message="This will permanently delete the inbox."
        confirmValue={toDelete?.name ?? ""}
        onConfirm={() => {
          if (!toDelete) return;
          // F-6A: "deleted" only after the preview server has the change, with the line that says where.
          const saving = whenSaved();
          inboxesStore.remove(toDelete.id);
          void toastInboxSaved(saving, "Inbox deleted successfully");
        }}
      />
    </>
  );
}

"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { agents, channelFor, type Inbox, inboxes as initialInboxes } from "./data";
import { AgentAvatar, ConfirmDeleteDialog } from "./settings-ui";

// Tabs from Chatwoot's per-inbox "Enable auto assignment" setting.
type InboxView = "all" | "auto" | "manual";
const inboxViews: Record<InboxView, { label: string; match: (inbox: Inbox) => boolean }> = {
  all: { label: "All inboxes", match: () => true },
  auto: { label: "Auto assignment on", match: (inbox) => inbox.autoAssign },
  manual: { label: "Auto assignment off", match: (inbox) => !inbox.autoAssign },
};

export function InboxesList() {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<InboxView>("all");
  const [toDelete, setToDelete] = React.useState<Inbox | null>(null);
  const [inboxes, setInboxes] = React.useState(initialInboxes);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return inboxes.filter(
      (inbox) =>
        inboxViews[view].match(inbox) &&
        (!q || [inbox.name, channelFor(inbox.channel).name, inbox.identifier].some((v) => v.toLowerCase().includes(q))),
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
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Inbox</TableHead>
                <TableHead className="py-3 font-normal">Channel</TableHead>
                <TableHead className="py-3 font-normal">Agents</TableHead>
                <TableHead className="py-3 font-normal">Auto assignment</TableHead>
                <TableHead className="w-16 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inbox) => {
                const channel = channelFor(inbox.channel);
                const Icon = channel.icon;
                const members = agents.filter((agent) => inbox.agents.includes(agent.id));
                return (
                  <TableRow key={inbox.id} className="border-border/60">
                    <TableCell className="py-3.5">
                      <Link
                        href={`/dashboard/settings/inboxes/${inbox.id}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/50">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="grid min-w-0 gap-0.5">
                          <span className="truncate font-medium">{inbox.name}</span>
                          <bdi dir="auto" className="truncate text-muted-foreground text-xs">
                            {inbox.identifier}
                          </bdi>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className="gap-1.5 px-2 py-1 font-normal">
                        <Icon className="size-3" />
                        {channel.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {members.map((m) => (
                            <AgentAvatar key={m.id} id={m.id} name={m.name} className="size-7 ring-2 ring-card" />
                          ))}
                        </div>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {members.length} {members.length === 1 ? "agent" : "agents"}
                        </span>
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
                    <TableCell className="py-3.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Inbox actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/settings/inboxes/${inbox.id}`}>
                              <Settings /> Settings
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
          <NoResults>No inboxes found matching your search</NoResults>
        )}
      </SettingsShell>

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Confirm Deletion"
        message={`Are you sure to delete ${toDelete?.name ?? ""}?`}
        confirmValue={toDelete?.name ?? ""}
        placeholder={`Please type ${toDelete?.name ?? ""} to confirm`}
        confirmText={`Yes, Delete ${toDelete?.name ?? ""}`}
        rejectText={`No, Keep ${toDelete?.name ?? ""}`}
        onConfirm={() => {
          if (toDelete) setInboxes((list) => list.filter((i) => i.id !== toDelete.id));
          toast.success("Inbox deleted successfully");
        }}
      />
    </>
  );
}

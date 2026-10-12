"use client";
// Chatwoot AgentAssignmentIndexPage.vue / AgentCapacityIndexPage.vue (+ AssignmentPolicyCard, ConfirmDeletePolicyDialog)
// in the Studio pattern: breadcrumb, big title + "New policy", tabs with counts, a table inside a card, one "…" menu.
import * as React from "react";

import Link from "next/link";

import { Inbox, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { agents, channelFor, inboxes } from "../../inboxes/_components/data";
import { AgentAvatar } from "../../inboxes/_components/settings-ui";
import { NoResults, SettingsShell } from "../../labels/_shared/settings-shell";
import { assignmentPolicies, capacityPolicies, orderLabel, priorityLabel } from "./data";
import { ConfirmDialog, POLICY_HOME, PolicyBreadcrumb } from "./policy-ui";

function CountPopover({ kind, ids }: { kind: "assignment" | "capacity"; ids: number[] }) {
  const isInbox = kind === "assignment";
  const Icon = isInbox ? Inbox : Users;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-muted-foreground text-xs tabular-nums hover:bg-muted"
        >
          <Icon className="size-3.5" />
          {ids.length} {isInbox ? (ids.length === 1 ? "inbox" : "inboxes") : ids.length === 1 ? "agent" : "agents"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="px-2 pt-1 pb-2 font-medium text-muted-foreground text-xs">
          {isInbox ? "Added inboxes" : "Added agents"}
        </div>
        {ids.length === 0 ? (
          <div className="px-2 pb-2 text-muted-foreground text-sm">{isInbox ? "No inboxes" : "No agents added"}</div>
        ) : null}
        <div className="grid gap-0.5">
          {isInbox
            ? inboxes
                .filter((i) => ids.includes(i.id))
                .map((inbox) => {
                  const ChannelIcon = channelFor(inbox.channel).icon;
                  return (
                    <div key={inbox.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                      <ChannelIcon className="size-3.5 text-muted-foreground" />
                      {inbox.name}
                    </div>
                  );
                })
            : agents
                .filter((a) => ids.includes(a.id))
                .map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                    <AgentAvatar id={agent.id} name={agent.name} className="size-5" />
                    {agent.name}
                  </div>
                ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "gap-1.5 border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-medium text-emerald-600 dark:text-emerald-400"
          : "gap-1.5 border-border bg-muted/50 px-2 py-1 font-medium text-muted-foreground"
      }
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

interface Row {
  id: number;
  name: string;
  description: string;
  ids: number[];
  active?: boolean;
  order?: string;
  priority?: string;
  limits?: number;
}

type View = "all" | "active" | "inactive";

export function PoliciesTable({ kind }: { kind: "assignment" | "capacity" }) {
  const isAssignment = kind === "assignment";
  const base = `${POLICY_HOME}/${kind}`;
  const [rows, setRows] = React.useState<Row[]>(() =>
    isAssignment
      ? assignmentPolicies.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          ids: p.inboxes,
          active: p.active,
          order: orderLabel[p.order],
          priority: priorityLabel[p.priority],
        }))
      : capacityPolicies.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          ids: p.agents,
          limits: p.limits.length,
        })),
  );
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<View>("all");
  const [toDelete, setToDelete] = React.useState<Row | null>(null);

  const matchView = (row: Row) =>
    view === "all" || !isAssignment ? true : view === "active" ? row.active : !row.active;
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) => matchView(row) && (!q || `${row.name} ${row.description}`.toLowerCase().includes(q)),
  );
  const title = isAssignment ? "Assignment policy" : "Agent capacity";

  return (
    <div className="flex flex-col gap-4">
      <PolicyBreadcrumb items={[{ label: "Agent assignment", href: POLICY_HOME }, { label: title }]} />
      <SettingsShell
        title={title}
        description={
          isAssignment
            ? "Manage how conversations get assigned in inboxes."
            : "Manage workload for agents."
        }
        count={`${visible.length} ${visible.length === 1 ? "policy" : "policies"}`}
        search={{ placeholder: "Search policies...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" asChild>
            <Link href={`${base}/new`}>
              <Plus /> New policy
            </Link>
          </Button>
        }
        tabs={
          isAssignment
            ? {
                value: view,
                onValueChange: (v) => setView(v as View),
                items: [
                  { value: "all", label: "All policies", count: rows.length },
                  { value: "active", label: "Active", count: rows.filter((r) => r.active).length },
                  { value: "inactive", label: "Inactive", count: rows.filter((r) => !r.active).length },
                ],
              }
            : undefined
        }
        cardTitle={isAssignment ? undefined : "Policies"}
        cardDescription={
          isAssignment
            ? "One policy per inbox. The policy decides who gets the next conversation."
            : "One policy per agent. The policy caps how many open conversations each agent holds."
        }
      >
        {visible.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%] min-w-64 py-3 font-normal">Policy</TableHead>
                {isAssignment ? (
                  <>
                    <TableHead className="py-3 font-normal">Order</TableHead>
                    <TableHead className="py-3 font-normal">Priority</TableHead>
                    <TableHead className="py-3 font-normal">Inboxes</TableHead>
                    <TableHead className="py-3 font-normal">Status</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="py-3 font-normal">Inbox capacity limits</TableHead>
                    <TableHead className="py-3 font-normal">Agents</TableHead>
                  </>
                )}
                <TableHead className="w-20 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id} className="border-border/60">
                  <TableCell className="max-w-0 py-3.5">
                    <Link href={`${base}/${row.id}`} className="grid min-w-0 gap-0.5">
                      <span className="truncate font-medium">{row.name}</span>
                      <span className="truncate text-muted-foreground text-xs">{row.description}</span>
                    </Link>
                  </TableCell>
                  {isAssignment ? (
                    <>
                      <TableCell className="whitespace-nowrap py-3.5">{row.order}</TableCell>
                      <TableCell className="whitespace-nowrap py-3.5">{row.priority}</TableCell>
                      <TableCell className="py-3.5">
                        <CountPopover kind={kind} ids={row.ids} />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <StatusBadge active={Boolean(row.active)} />
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="py-3.5 tabular-nums">
                        {row.limits} {row.limits === 1 ? "inbox" : "inboxes"}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <CountPopover kind={kind} ids={row.ids} />
                      </TableCell>
                    </>
                  )}
                  <TableCell className="py-3.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Policy actions">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem asChild>
                          <Link href={`${base}/${row.id}`}>
                            <Pencil /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {isAssignment ? "No assignment policies found" : "No agent capacity policies found"}
          </NoResults>
        )}
      </SettingsShell>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete policy"
        description="Are you sure you want to delete this policy? This action cannot be undone."
        confirm="Delete"
        destructive
        onConfirm={() => {
          if (toDelete) setRows((list) => list.filter((r) => r.id !== toDelete.id));
          toast.success(
            isAssignment ? "Assignment policy deleted successfully" : "Agent capacity policy deleted successfully",
          );
        }}
      />
    </div>
  );
}

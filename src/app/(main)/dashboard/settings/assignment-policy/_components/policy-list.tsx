"use client";
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Inbox, Trash2, Users } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import { agents, channelFor, inboxes } from "../../inboxes/_components/data";
import { AgentAvatar, SettingsHeader } from "../../inboxes/_components/settings-ui";
import { assignmentPolicies, capacityPolicies, orderLabel, priorityLabel } from "./data";

function CountPopover({ kind, ids }: { kind: "assignment" | "capacity"; ids: number[] }) {
  const isInbox = kind === "assignment";
  const Icon = isInbox ? Inbox : Users;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-muted-foreground text-xs hover:bg-muted"
        >
          <Icon className="size-3" />
          {ids.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="px-2 pt-1 pb-2 font-medium text-muted-foreground text-xs">
          {isInbox ? "Added inboxes" : "Added agents"}
        </div>
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

export function PolicyList({ kind }: { kind: "assignment" | "capacity" }) {
  const [toDelete, setToDelete] = React.useState<string | null>(null);
  const isAssignment = kind === "assignment";
  const base = `/dashboard/settings/assignment-policy/${kind}`;

  const items = isAssignment
    ? assignmentPolicies.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        ids: p.inboxes,
        active: p.active as boolean | undefined,
        order: orderLabel[p.order] as string | undefined,
        priority: priorityLabel[p.priority] as string | undefined,
      }))
    : capacityPolicies.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        ids: p.agents,
        active: undefined,
        order: undefined,
        priority: undefined,
      }));

  return (
    <>
      <Card className="gap-0 py-0">
        <SettingsHeader
          back={
            <Link
              href="/dashboard/settings/assignment-policy"
              className="inline-flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Agent assignment
            </Link>
          }
          title={isAssignment ? "Assignment policy" : "Agent capacity"}
          actions={
            <Button size="sm" asChild>
              <Link href={`${base}/new`}>New policy</Link>
            </Button>
          }
        />
        <div className="grid gap-3 p-6">
          {items.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-xl border px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <h3 className="truncate font-medium">{item.name}</h3>
                  <CountPopover kind={kind} ids={item.ids} />
                  {item.active !== undefined ? (
                    <Badge variant={item.active ? "secondary" : "outline"} className="font-normal">
                      <span
                        className={`size-1.5 rounded-full ${item.active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                      />
                      {item.active ? "Active" : "Inactive"}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="link" size="sm" className="px-2 text-muted-foreground" asChild>
                    <Link href={`${base}/${item.id}`}>Edit</Link>
                  </Button>
                  <Separator orientation="vertical" className="data-[orientation=vertical]:h-3" />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    className="hover:text-destructive"
                    onClick={() => setToDelete(item.name)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <p className="line-clamp-1 text-muted-foreground text-sm">{item.description}</p>
              {item.order ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Order: <span className="text-foreground">{item.order}</span>
                  </span>
                  <Separator orientation="vertical" className="data-[orientation=vertical]:h-3" />
                  <span className="text-muted-foreground">
                    Priority: <span className="text-foreground">{item.priority}</span>
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {toDelete}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

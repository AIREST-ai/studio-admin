"use client";
// Chatwoot: routes/dashboard/captain/assistants/inboxes/Index.vue + assistant/InboxCard.vue, ConnectInboxDialog.vue.
// Studio: heading outside, table in a card, coloured channel badge, one "…" menu per row.
import * as React from "react";

import { Globe, Inbox, Mail, MessageCircle, Plus, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { ConnectedInbox } from "./data";
import { ConfirmDialog, InboxDialog } from "./dialogs";
import { CaptainShell, RowMenuTrigger, type Tone, ToneBadge } from "./shared";
import { useCaptainState } from "./store";

const icons = { Website: Globe, WhatsApp: MessageCircle, Email: Mail } as const;
const channelTone: Record<string, Tone> = { Website: "sky", WhatsApp: "green", Email: "violet" };

export function InboxesList() {
  const [items, setItems] = useCaptainState("connectedInboxes");
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState<ConnectedInbox | null>(null);

  return (
    <CaptainShell
      title="Connected Inboxes"
      subtitle="Connecting an inbox allows the assistant to handle initial questions from your customers before transferring them to you."
      actions={
        <Button size="sm" onClick={() => setConnecting(true)}>
          <Plus /> Connect a new inbox
        </Button>
      }
    >
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl leading-none">Inboxes</CardTitle>
          <CardDescription>
            {items.length} {items.length === 1 ? "inbox" : "inboxes"} answered by Noor
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {items.length ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 font-normal">Inbox</TableHead>
                  <TableHead className="py-4 font-normal">Channel</TableHead>
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const Icon = icons[i.channel as keyof typeof icons] ?? Globe;
                  return (
                    <TableRow key={i.id} className="border-border/60">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                            <Icon className="size-4" />
                          </div>
                          <div className="grid gap-0.5">
                            <span className="font-medium text-sm">{i.name}</span>
                            <span className="text-muted-foreground text-sm">{i.detail}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <ToneBadge tone={channelTone[i.channel] ?? "muted"}>{i.channel}</ToneBadge>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <DropdownMenu>
                          <RowMenuTrigger label={`Open actions for ${i.name}`} />
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem variant="destructive" onSelect={() => setDisconnecting(i)}>
                              <Unplug /> Disconnect
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
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle>No Connected Inboxes</EmptyTitle>
                <EmptyDescription>
                  Connecting an inbox allows the assistant to handle initial questions from your customers before
                  transferring them to you.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setConnecting(true)}>
                  Connect a new inbox
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
      </Card>
      <InboxDialog open={connecting} onOpenChange={setConnecting} />
      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title="Are you sure to disconnect the inbox?"
        confirm="Disconnect"
        success="Inbox disconnected successfully"
        onConfirm={() => {
          const target = disconnecting;
          if (target) setItems((list) => list.filter((i) => i.id !== target.id));
        }}
      />
    </CaptainShell>
  );
}

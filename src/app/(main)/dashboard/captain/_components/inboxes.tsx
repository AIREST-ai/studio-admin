"use client";
import * as React from "react";

import { Globe, Mail, MessageCircle, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { connectedInboxes } from "./data";
import { ConfirmDialog, InboxDialog } from "./dialogs";
import { CaptainCardHeader } from "./shared";

const icons = { Website: Globe, WhatsApp: MessageCircle, Email: Mail } as const;

export function InboxesList() {
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  return (
    <>
      <Card>
        <CaptainCardHeader
          title="Connected Inboxes"
          description="Connecting an inbox allows the assistant to handle initial questions from your customers before transferring them to you."
        >
          <Button size="sm" onClick={() => setConnecting(true)}>
            Connect a new inbox
          </Button>
        </CaptainCardHeader>
        <CardContent className="px-0">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="py-4 font-normal">Inbox</TableHead>
                <TableHead className="py-4 font-normal">Channel</TableHead>
                <TableHead className="py-4 font-normal">Status</TableHead>
                <TableHead className="w-32 py-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {connectedInboxes.map((i) => {
                const Icon = icons[i.channel as keyof typeof icons] ?? Globe;
                return (
                  <TableRow key={i.id} className="border-border/60">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                          <Icon className="size-4" />
                        </div>
                        <div className="grid gap-0.5">
                          <span className="font-medium">{i.name}</span>
                          <span className="text-muted-foreground text-xs">{i.detail}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">{i.channel}</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="secondary" className="gap-1.5 font-normal">
                        <span className="size-1.5 rounded-full bg-emerald-500" /> Captain replying
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => setDisconnecting(true)}>
                        <Unplug /> Disconnect
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <InboxDialog open={connecting} onOpenChange={setConnecting} />
      <ConfirmDialog
        open={disconnecting}
        onOpenChange={setDisconnecting}
        title="Are you sure to disconnect the inbox?"
      />
    </>
  );
}

"use client";
import * as React from "react";

import Link from "next/link";

import { ChevronLeft, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { type Webhook, webhookEvents, webhooks } from "./data";

function eventLabel(value: string) {
  return webhookEvents.find((e) => e.value === value)?.label ?? value;
}

function WebhookDialog({
  webhook,
  open,
  onOpenChange,
}: {
  webhook?: Webhook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = Boolean(webhook);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit webhook" : "Add new webhook"}</DialogTitle>
          <DialogDescription>
            Webhook events provide you the realtime information about what's happening in your Chatwoot account.
            Please enter a valid URL to configure a callback.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Webhook URL</Label>
            <Input placeholder="Example: https://example/api/webhook" defaultValue={webhook?.url} />
          </div>
          <div className="grid gap-2">
            <Label>Webhook Name</Label>
            <Input placeholder="Enter the name of the webhook" defaultValue={webhook?.name} />
          </div>
          <div className="grid gap-2">
            <Label>Events</Label>
            <div className="grid grid-cols-1 gap-2.5 rounded-lg border p-3 sm:grid-cols-2">
              {webhookEvents.map((event) => (
                <Label key={event.value} className="font-normal">
                  <Checkbox defaultChecked={webhook ? webhook.events.includes(event.value) : false} />
                  {event.label}
                </Label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{editing ? "Update webhook" : "Create webhook"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksList() {
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Webhook | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Webhook | null>(null);

  const q = query.trim().toLowerCase();
  const rows = q ? webhooks.filter((w) => `${w.name} ${w.url}`.toLowerCase().includes(q)) : webhooks;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit px-1.5 text-muted-foreground" asChild>
        <Link href="/dashboard/settings/integrations">
          <ChevronLeft /> Integrations
        </Link>
      </Button>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid max-w-2xl gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-xl">Webhooks</h1>
            <Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">
              {webhooks.length} webhooks
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Webhook events provide you the realtime information about what's happening in your Chatwoot account.
            Please enter a valid URL to configure a callback.
          </p>
          <Button variant="link" size="sm" className="h-auto w-fit px-0">
            Learn more about webhooks <ExternalLink />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <InputGroup className="h-8 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search webhooks..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add new webhook
          </Button>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table className="**:data-[slot='table-cell']:px-5">
            <TableBody>
              {rows.length ? (
                rows.map((webhook) => (
                  <TableRow key={webhook.id} className="border-border/60">
                    <TableCell className="py-4 whitespace-normal">
                      <div className="flex flex-wrap gap-2 font-medium">
                        {webhook.name ? (
                          <>
                            {webhook.name}
                            <span className="font-normal text-muted-foreground">{webhook.url}</span>
                          </>
                        ) : (
                          webhook.url
                        )}
                      </div>
                      <div className="mt-1 text-muted-foreground text-sm">
                        <span className="font-medium">Subscribed Events:</span>{" "}
                        {webhook.events.map(eventLabel).join(", ")}
                      </div>
                    </TableCell>
                    <TableCell className="w-24 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(webhook)}>
                              <Pencil />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete"
                              className="hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleting(webhook)}
                            >
                              <Trash2 />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                    No webhooks found matching your search
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <WebhookDialog open={adding} onOpenChange={setAdding} />
      <WebhookDialog webhook={editing} open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>Are you sure to delete the webhook? ({deleting?.url})</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Yes, Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

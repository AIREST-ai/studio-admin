"use client";
import * as React from "react";

import { cn } from "cn";
import { ImageUp, Pencil, Trash2 } from "lucide-react";

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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { toneFor } from "../../inboxes/_components/data";
import { SettingsHeader } from "../../inboxes/_components/settings-ui";

interface Bot {
  id: number;
  name: string;
  description: string;
  url: string;
  system?: boolean;
}

const bots: Bot[] = [
  {
    id: 1,
    name: "Captain",
    description: "System bot",
    url: "https://chat.alrayyan-clinics.qa/captain/webhook",
    system: true,
  },
  {
    id: 2,
    name: "Appointment Assistant",
    description: "Books, moves and cancels clinic appointments before handing off to an agent.",
    url: "https://bots.alrayyan-clinics.qa/appointments",
  },
  {
    id: 3,
    name: "Arabic FAQ Bot",
    description: "Answers common questions in Arabic about opening hours, locations and parking.",
    url: "https://bots.alrayyan-clinics.qa/faq-ar",
  },
  {
    id: 4,
    name: "Insurance Checker",
    description: "Checks QLM, Bupa Arabia and Daman coverage from the policy number.",
    url: "https://bots.alrayyan-clinics.qa/insurance",
  },
];

function BotDialog({ bot, open, onOpenChange }: { bot: Bot | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bot ? "Edit bot" : "Add Bot"}</DialogTitle>
          <DialogDescription>
            Configure a webhook bot to integrate with your custom services. The bot will receive and process events from
            conversations and can respond to them.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel>Bot avatar</FieldLabel>
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className={cn("font-medium", toneFor(bot?.id ?? 0))}>
                  {bot ? getInitials(bot.name) : "B"}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm">
                <ImageUp /> Upload
              </Button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="bot-name">Bot name</FieldLabel>
            <Input id="bot-name" placeholder="Enter bot name" defaultValue={bot?.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bot-desc">Description</FieldLabel>
            <Textarea id="bot-desc" placeholder="What does this bot do?" defaultValue={bot?.description} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bot-url">Webhook URL</FieldLabel>
            <Input id="bot-url" placeholder="https://example.com/webhook" defaultValue={bot?.url} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{bot ? "Update Bot" : "Create Bot"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BotsList() {
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Bot | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Bot | null>(null);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bots.filter((b) => [b.name, b.description, b.url].some((v) => v.toLowerCase().includes(q))) : bots;
  }, [query]);

  return (
    <>
      <Card className="gap-0 py-0">
        <SettingsHeader
          title="Bots"
          description="Agent Bots are like the most fabulous members of your team. They can handle the small stuff, so you can focus on the stuff that matters. Give them a try. You can manage your bots from this page or create new ones using the 'Add Bot' button."
          linkText="Learn about agent bots"
          search={query}
          onSearch={setQuery}
          searchPlaceholder="Search bots..."
          count={`${bots.length} bots`}
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add Bot
            </Button>
          }
        />
        <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
          <TableHeader>
            <TableRow>
              <TableHead className="py-3 font-normal">Bot Details</TableHead>
              <TableHead className="py-3 font-normal">Webhook URL</TableHead>
              <TableHead className="w-28 py-3 text-right font-normal">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((bot) => (
                <TableRow key={bot.id}>
                  <TableCell className="max-w-0 py-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <Avatar className="size-10 shrink-0">
                        <AvatarFallback className={cn("font-medium text-xs", toneFor(bot.id))}>
                          {getInitials(bot.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid min-w-0 gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{bot.name}</span>
                          {bot.system ? <Badge variant="secondary">System</Badge> : null}
                        </div>
                        <span className="truncate text-muted-foreground text-sm">{bot.description}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0 py-4">
                    <span className="block truncate font-mono text-muted-foreground text-xs">{bot.url}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    {bot.system ? null : (
                      <div className="flex justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Edit"
                              onClick={() => {
                                setEditing(bot);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Delete"
                              className="hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setToDelete(bot)}
                            >
                              <Trash2 />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="py-16 text-center text-muted-foreground">
                  No bots found matching your search
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <BotDialog bot={editing} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete {toDelete?.name}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Yes, Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

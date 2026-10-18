"use client";
// Chatwoot Webhooks/Index.vue, WebhookRow.vue, WebhookForm.vue, NewWebHook.vue, EditWebHook.vue in the Studio
// pattern: big title and main button outside the card, table in a card, "…" menu per row.
import * as React from "react";

import Link from "next/link";

import { Copy, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { copyText } from "../../_components/copy-text";
import { NoResults, SettingsShell } from "../../labels/_shared/settings-shell";
import { webhookEvents } from "./data";
import { BackToIntegrations, ConfirmAction } from "./integration-ui";
import { INTEGRATION_NOTE, useWebhooks, useWebhooksLoaded, type WebhookRow, webhooksStore } from "./integrations-store";

// F-6A: the webhooks are saved in this preview (integrations-store.ts); each message shows after the save, and no
// event is sent to their URLs from the preview.
async function saved(saving: Promise<void>, message: string) {
  try {
    await saving;
    toast.success(message, { description: INTEGRATION_NOTE });
    return true;
  } catch (error) {
    toast.error("Not saved", { description: (error as Error).message });
    return false;
  }
}

function makeSecret() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function eventLabel(value: string) {
  return webhookEvents.find((e) => e.value === value)?.label ?? value;
}

// F-12: it said "copied" even when the browser copied nothing (the preview is plain http, where navigator.clipboard
// is missing); copyText says so only when the text was taken.
function copy(text: string, message: string) {
  void copyText(text, message);
}

function SecretField({ secret }: { secret: string }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="grid gap-2">
      <Label>Secret</Label>
      <InputGroup>
        <InputGroupInput readOnly type={visible ? "text" : "password"} value={secret} className="font-mono text-xs" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Toggle secret visibility"
            title="Toggle secret visibility"
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label="Copy secret to clipboard"
            title="Copy secret to clipboard"
            onClick={() => copy(secret, "Secret copied to clipboard")}
          >
            <Copy />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function WebhookDialog({
  webhook,
  open,
  onOpenChange,
  onSubmit,
}: {
  webhook: WebhookRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; url: string; events: string[] }) => void;
}) {
  const editing = Boolean(webhook);
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [events, setEvents] = React.useState<string[]>([]);
  const [urlError, setUrlError] = React.useState("");
  const [eventsError, setEventsError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setUrl(webhook?.url ?? "");
      setName(webhook?.name ?? "");
      setEvents(webhook?.events ?? []);
      setUrlError("");
      setEventsError("");
    }
  }, [open, webhook]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    let ok = true;
    try {
      const parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad");
      setUrlError("");
    } catch {
      setUrlError("Please enter a valid URL");
      ok = false;
    }
    if (!events.length) {
      setEventsError("Select at least one event");
      ok = false;
    }
    if (!ok) return;
    onSubmit({ name: name.trim(), url: url.trim(), events });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit webhook" : "Add new webhook"}</DialogTitle>
            <DialogDescription>
              Webhook events provide you the realtime information about what's happening in your Weblabs Studio account.
              Please enter a valid URL to configure a callback.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder="Example: https://example/api/webhook"
              value={url}
              aria-invalid={Boolean(urlError)}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError("");
              }}
            />
            {urlError ? <p className="text-destructive text-xs">{urlError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="webhook-name">Webhook Name</Label>
            <Input
              id="webhook-name"
              placeholder="Enter the name of the webhook"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {webhook ? <SecretField secret={webhook.secret} /> : null}
          <div className="grid gap-2">
            <Label>Events</Label>
            <div className="grid grid-cols-1 gap-2.5 rounded-lg border p-3 sm:grid-cols-2">
              {webhookEvents.map((ev) => (
                <Label key={ev.value} className="font-normal">
                  <Checkbox
                    checked={events.includes(ev.value)}
                    onCheckedChange={(checked) => {
                      setEventsError("");
                      setEvents((prev) =>
                        checked === true ? [...prev, ev.value] : prev.filter((x) => x !== ev.value),
                      );
                    }}
                  />
                  {ev.label}
                </Label>
              ))}
            </div>
            {eventsError ? <p className="text-destructive text-xs">{eventsError}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{editing ? "Update webhook" : "Create webhook"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksPage() {
  const rows = useWebhooks();
  const loaded = useWebhooksLoaded();
  const [query, setQuery] = React.useState("");
  const [dialog, setDialog] = React.useState<{ open: boolean; webhook: WebhookRow | null }>({
    open: false,
    webhook: null,
  });
  const [deleting, setDeleting] = React.useState<WebhookRow | null>(null);
  const [created, setCreated] = React.useState<WebhookRow | null>(null);

  const q = query.trim().toLowerCase();
  const visible = q ? rows.filter((w) => `${w.name} ${w.url}`.toLowerCase().includes(q)) : rows;

  async function save(values: { name: string; url: string; events: string[] }) {
    const editing = dialog.webhook;
    if (editing) {
      if (await saved(webhooksStore.update(editing.id, values), "Webhook configuration updated successfully"))
        setDialog({ open: false, webhook: null });
      return;
    }
    const next: WebhookRow = { id: webhooksStore.nextId(), secret: makeSecret(), ...values };
    if (await saved(webhooksStore.save(next), "Webhook configuration added successfully")) {
      setCreated(next);
      setDialog({ open: false, webhook: null });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <BackToIntegrations current="Webhooks" />
      <SettingsShell
        title="Webhooks"
        description="Webhook events provide you the realtime information about what's happening in your Weblabs Studio account. Please enter a valid URL to configure a callback."
        learnMore="Learn more about webhooks"
        actions={
          <Button onClick={() => setDialog({ open: true, webhook: null })}>
            <Plus /> Add new webhook
          </Button>
        }
        cardTitle="Manage webhooks"
        cardDescription="Each webhook receives the events it is subscribed to."
        count={`${rows.length} ${rows.length === 1 ? "webhook" : "webhooks"}`}
        search={{ placeholder: "Search webhooks...", value: query, onChange: setQuery }}
      >
        {/* F-12 (Fahad ل4 and 129.2): the page says on itself that no event leaves the preview, and where the API
            token, base URL and docs are (Profile Settings > Access Token, as Chatwoot keeps the token in Profile). */}
        <div className="flex flex-col gap-1 px-6 text-muted-foreground text-xs">
          <p data-preview-note>
            Preview — simulated: webhooks are saved in this preview, not in the engine. No event is sent to these URLs.
          </p>
          <p>
            Building with the API? Your access token, the API base URL and the API documentation are in{" "}
            <Link
              href="/dashboard/settings/profile?tab=token"
              className="text-primary underline-offset-4 hover:underline"
            >
              Profile Settings › Access Token
            </Link>
            .
          </p>
        </div>
        {!loaded ? (
          <NoResults>Loading saved webhooks…</NoResults>
        ) : rows.length === 0 ? (
          <NoResults>There are no webhooks configured for this account.</NoResults>
        ) : (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-4 font-normal">Webhook endpoint</TableHead>
                <TableHead className="py-4 font-normal">Subscribed Events</TableHead>
                <TableHead className="py-4 font-normal">
                  <div className="text-right">Actions</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length ? (
                visible.map((webhook) => (
                  <TableRow key={webhook.id} className="border-border/60">
                    <TableCell className="max-w-sm py-4 whitespace-normal align-top">
                      <div className="font-medium">{webhook.name || webhook.url}</div>
                      {webhook.name ? (
                        <div className="break-all text-muted-foreground text-sm">{webhook.url}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-4 whitespace-normal align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {webhook.events.map((ev) => (
                          <Badge
                            key={ev}
                            variant="outline"
                            className="border-sky-500/20 bg-sky-500/10 font-medium text-sky-600 dark:text-sky-400"
                          >
                            {eventLabel(ev)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right align-top">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={`Open actions for ${webhook.name || webhook.url}`}
                            className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                            size="icon-sm"
                            variant="ghost"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ open: true, webhook })}>
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copy(webhook.secret, "Secret copied to clipboard")}>
                            <Copy /> Copy secret
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(webhook)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3}>
                    <NoResults>No webhooks found matching your search</NoResults>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </SettingsShell>

      <WebhookDialog
        webhook={dialog.webhook}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSubmit={save}
      />

      <Dialog open={Boolean(created)} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Webhook created</DialogTitle>
            <DialogDescription>
              Your webhook has been created. Use the secret below to verify webhook signatures. Please copy it now — you
              can also find it later in the webhook edit form.
            </DialogDescription>
          </DialogHeader>
          {created ? <SecretField secret={created.secret} /> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => {
          if (deleting) void saved(webhooksStore.remove(deleting.id), "Webhook deleted successfully");
        }}
        title="Confirm Deletion"
        message={`Are you sure to delete the webhook? (${deleting?.url ?? ""})`}
        yes="Yes, Delete"
        no="No, Keep it"
      />
    </div>
  );
}

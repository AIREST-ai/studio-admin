"use client";
// Chatwoot routes/dashboard/settings/agentBots/Index.vue + components/AgentBotModal.vue in the Studio pattern
// (Users & Roles): big title, tabs with counts, table inside a card, one "…" menu per row. The list is local state,
// so Add, Edit and Delete change the table.
import * as React from "react";

import { Bot as BotIcon, Check, Copy, Eye, EyeOff, ImageUp, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
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
import {
  Dialog,
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";

import { NoResults, SettingsShell } from "../../labels/_shared/settings-shell";

interface Bot {
  id: number;
  name: string;
  description: string;
  url: string;
  system?: boolean;
  accessToken: string;
  secret: string;
}

function randomToken(length = 24) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const initialBots: Bot[] = [
  {
    id: 1,
    name: "Captain",
    description: "System bot",
    url: "https://chat.weblabs.studio/captain/webhook",
    system: true,
    accessToken: "Fq7vN2kXc9RtLm4bWz8sHy3d",
    secret: "whsec_4f8c2b1e9a7d6c3b",
  },
  {
    id: 2,
    name: "Order Status Bot",
    description: "Looks up an order by its number and answers delivery questions before handing off to an agent.",
    url: "https://bots.weblabs.studio/order-status",
    accessToken: "Mp3sQw8eRt2yUi7oPa5sDf6g",
    secret: "whsec_9b2d7e4a1c8f3e6d",
  },
  {
    id: 3,
    name: "Arabic FAQ Bot",
    description: "Answers common questions in Arabic about pricing, opening hours and the API.",
    url: "https://bots.weblabs.studio/faq-ar",
    accessToken: "Zx4cVb6nMq1wEr9tYu2iOp8a",
    secret: "whsec_1a5e9c3f7b2d8a4e",
  },
  {
    id: 4,
    name: "Lead Qualifier",
    description: "Asks new website visitors about budget and timeline, then labels the conversation as a lead.",
    url: "https://bots.weblabs.studio/lead-qualifier",
    accessToken: "Hj5kLz7xCv3bNm1qWe6rTy9u",
    secret: "whsec_7c3a1f9e5d2b6c8a",
  },
];

type BotView = "all" | "webhook" | "system";
const botViews: Record<BotView, { label: string; match: (bot: Bot) => boolean }> = {
  all: { label: "All bots", match: () => true },
  webhook: { label: "Webhook bot", match: (bot) => !bot.system },
  system: { label: "System", match: (bot) => Boolean(bot.system) },
};

function BotAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={`font-medium ${personToneClass(name)} ${className ?? ""}`}>
      <AvatarFallback>{name.trim() ? getInitials(name) : <BotIcon className="size-4" />}</AvatarFallback>
    </Avatar>
  );
}

/** Access token / webhook secret row: hidden by default, eye toggle, copy and reset (AgentBotModal.vue). */
function SecretField({
  label,
  description,
  value,
  onReset,
  copyMessage,
  resetMessage,
  maskable = true,
}: {
  label: string;
  description?: string;
  value: string;
  onReset: () => void;
  copyMessage: string;
  resetMessage: string;
  maskable?: boolean;
}) {
  const [visible, setVisible] = React.useState(!maskable);
  const [copied, setCopied] = React.useState(false);
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <div className="flex gap-2">
        <InputGroup>
          <InputGroupInput readOnly value={visible ? value : "•".repeat(24)} className="font-mono text-xs" />
          <InputGroupAddon align="inline-end">
            {maskable ? (
              <InputGroupButton
                size="icon-xs"
                aria-label="Toggle secret visibility"
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            ) : null}
            <InputGroupButton
              size="icon-xs"
              aria-label="Copy secret to clipboard"
              onClick={() => {
                void navigator.clipboard?.writeText(value).catch(() => undefined);
                setCopied(true);
                toast.success(copyMessage);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Reset ${label}`}
          onClick={() => {
            onReset();
            toast.success(resetMessage);
          }}
        >
          <RefreshCw />
        </Button>
      </div>
    </Field>
  );
}

function BotDialog({
  bot,
  open,
  onOpenChange,
  onSave,
  onReset,
}: {
  bot: Bot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: { name: string; description: string; url: string }) => void;
  onReset: (field: "accessToken" | "secret") => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(bot?.name ?? "");
      setDescription(bot?.description ?? "");
      setUrl(bot?.url ?? "");
      setSubmitted(false);
    }
  }, [open, bot]);

  const nameError = !name.trim() ? "Bot name is required" : "";
  const urlError = !url.trim()
    ? "Webhook URL is required"
    : !/^https?:\/\/\S+\.\S+/.test(url.trim())
      ? "Please enter a valid URL starting with http:// or https://"
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bot ? "Edit bot" : "Add Bot"}</DialogTitle>
          <DialogDescription>
            Configure a webhook bot to integrate with your custom services. The bot will receive and process events from
            conversations and can respond to them.
          </DialogDescription>
        </DialogHeader>
        <form
          id="bot-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (nameError || urlError) return;
            onSave({ name: name.trim(), description: description.trim(), url: url.trim() });
          }}
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Bot avatar</FieldLabel>
              <div className="flex items-center gap-3">
                <BotAvatar name={name} className="size-12" />
                <Button type="button" variant="outline" size="sm">
                  <ImageUp /> Upload
                </Button>
                {bot ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => toast.success("Bot avatar deleted successfully")}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field data-invalid={(submitted && Boolean(nameError)) || undefined}>
              <FieldLabel htmlFor="bot-name">Bot name</FieldLabel>
              <Input
                id="bot-name"
                placeholder="Enter bot name"
                value={name}
                aria-invalid={(submitted && Boolean(nameError)) || undefined}
                onChange={(event) => setName(event.target.value)}
              />
              {submitted && nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="bot-desc">Description</FieldLabel>
              <Textarea
                id="bot-desc"
                placeholder="What does this bot do?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field data-invalid={(submitted && Boolean(urlError)) || undefined}>
              <FieldLabel htmlFor="bot-url">Webhook URL</FieldLabel>
              <Input
                id="bot-url"
                placeholder="https://example.com/webhook"
                value={url}
                aria-invalid={(submitted && Boolean(urlError)) || undefined}
                onChange={(event) => setUrl(event.target.value)}
              />
              {submitted && urlError ? <FieldError>{urlError}</FieldError> : null}
            </Field>
          </FieldGroup>
          {bot ? (
            <>
              <Separator />
              <SecretField
                label="Access Token"
                description="Copy the access token and save it securely"
                value={bot.accessToken}
                maskable={false}
                onReset={() => onReset("accessToken")}
                copyMessage="Access token copied to clipboard"
                resetMessage="Access token regenerated successfully"
              />
              <SecretField
                label="Webhook Secret"
                value={bot.secret}
                onReset={() => onReset("secret")}
                copyMessage="Secret copied to clipboard"
                resetMessage="Webhook secret regenerated successfully"
              />
            </>
          ) : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="bot-form">
            {bot ? "Update Bot" : "Create Bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BotsPage() {
  const [bots, setBots] = React.useState(initialBots);
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<BotView>("all");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Bot | null>(null);
  const [created, setCreated] = React.useState<Bot | null>(null);

  const editing = bots.find((b) => b.id === editingId) ?? null;

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return bots.filter(
      (b) =>
        botViews[view].match(b) && (!q || [b.name, b.description, b.url].some((v) => v.toLowerCase().includes(q))),
    );
  }, [bots, query, view]);

  return (
    <>
      <SettingsShell
        title="Bots"
        description="Agent Bots are like the most fabulous members of your team. They can handle the small stuff, so you can focus on the stuff that matters. Give them a try. You can manage your bots from this page or create new ones using the 'Add Bot' button."
        learnMore="Learn about agent bots"
        count={`${rows.length} ${rows.length === 1 ? "bot" : "bots"}`}
        search={{ placeholder: "Search bots...", value: query, onChange: setQuery }}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add Bot
          </Button>
        }
        tabs={{
          value: view,
          onValueChange: (v) => setView(v as BotView),
          items: (Object.keys(botViews) as BotView[]).map((key) => ({
            value: key,
            label: botViews[key].label,
            count: bots.filter(botViews[key].match).length,
          })),
        }}
        cardDescription="Bots that answer conversations in your inboxes before a human does."
      >
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Bot Details</TableHead>
                <TableHead className="py-3 font-normal">Webhook URL</TableHead>
                <TableHead className="w-20 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((bot) => {
                return (
                  <TableRow key={bot.id} className="border-border/60">
                    <TableCell className="max-w-0 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <BotAvatar name={bot.name} className="size-9 shrink-0" />
                        <div className="grid min-w-0 gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{bot.name}</span>
                            {bot.system ? (
                              <Badge
                                variant="outline"
                                className="gap-1.5 border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-medium text-violet-600 dark:text-violet-400"
                              >
                                <span className="size-1.5 rounded-full bg-violet-500" />
                                System
                              </Badge>
                            ) : null}
                          </div>
                          <span className="truncate text-muted-foreground text-xs">
                            {bot.description || "Webhook bot"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-0 py-3.5">
                      <span className="block truncate font-mono text-muted-foreground text-xs">{bot.url}</span>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Bot actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            disabled={bot.system}
                            onSelect={() => {
                              setEditingId(bot.id);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={bot.system}
                            onSelect={() => setToDelete(bot)}
                          >
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
            {query ? "No bots found matching your search" : "No bots found. You can create a bot by clicking the 'Add Bot' button."}
          </NoResults>
        )}
      </SettingsShell>

      <BotDialog
        bot={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onReset={(field) => {
          if (!editing) return;
          const next = field === "secret" ? `whsec_${randomToken(16).toLowerCase()}` : randomToken();
          setBots((list) => list.map((b) => (b.id === editing.id ? { ...b, [field]: next } : b)));
        }}
        onSave={(values) => {
          if (editing) {
            setBots((list) => list.map((b) => (b.id === editing.id ? { ...b, ...values } : b)));
            toast.success("Bot updated successfully.");
          } else {
            const bot: Bot = {
              id: Math.max(...bots.map((b) => b.id)) + 1,
              ...values,
                        accessToken: randomToken(),
              secret: `whsec_${randomToken(16).toLowerCase()}`,
            };
            setBots((list) => [...list, bot]);
            setCreated(bot);
            toast.success("Bot added successfully.");
          }
          setFormOpen(false);
        }}
      />

      <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription>
              Use the secret below to verify webhook signatures. Please copy it now, you can also find it later in the
              bot settings.
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <SecretField
              label="Webhook Secret"
              value={created.secret}
              maskable={false}
              onReset={() => undefined}
              copyMessage="Secret copied to clipboard"
              resetMessage="Webhook secret regenerated successfully"
            />
          ) : null}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete {toDelete?.name}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (toDelete) setBots((list) => list.filter((b) => b.id !== toDelete.id));
                toast.success("Bot deleted successfully.");
              }}
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

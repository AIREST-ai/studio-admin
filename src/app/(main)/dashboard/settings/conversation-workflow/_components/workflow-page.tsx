"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Conversation Workflows (conversationWorkflow/index.vue,
// account/components/AutoResolve.vue, components-next/ConversationWorkflow/ConversationRequiredAttributes.vue;
// settings.json CONVERSATION_WORKFLOW, generalSettings.json AUTO_RESOLVE) in the Studio pattern.
import * as React from "react";

import { Calendar, CheckSquare, CircleCheck, CirclePlus, Hash, Link2, List, Search, Type, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  type AutoResolve,
  type ConversationWorkflow,
  loadSettingsPreview,
  SAVED_IN_PREVIEW,
  saveConversationWorkflow,
} from "../../_components/settings-preview-client";
import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import { PageHeader } from "../../labels/_shared/settings-shell";
import { FieldError, ToneBadge } from "../../labels/_shared/settings-ui";

type AttrType = "Text" | "Number" | "Link" | "Date" | "List" | "Checkbox";

interface RequiredAttr {
  name: string;
  attrKey: string;
  type: AttrType;
}

// The conversation attributes of Settings > Custom Attributes.
const conversationAttributes: RequiredAttr[] = [
  { name: "Order number", attrKey: "order_number", type: "Text" },
  { name: "Delivery city", attrKey: "delivery_city", type: "List" },
  { name: "Resolution reason", attrKey: "resolution_reason", type: "List" },
  { name: "Refund amount (QAR)", attrKey: "refund_amount_qar", type: "Number" },
  { name: "Callback requested", attrKey: "callback_requested", type: "Checkbox" },
  { name: "Tracking link", attrKey: "tracking_link", type: "Link" },
];

const typeIcon: Record<AttrType, React.ElementType> = {
  Text: Type,
  Number: Hash,
  Link: Link2,
  Date: Calendar,
  List,
  Checkbox: CheckSquare,
};

const minutesPer = { minutes: 1, hours: 60, days: 1440 } as const;
type Unit = keyof typeof minutesPer;

// The page's first values until something is saved (no default label, as in Chatwoot: auto-closed was removed by T-262).
const AUTO_RESOLVE_DEFAULT: AutoResolve = {
  enabled: true,
  amount: 7,
  unit: "days",
  message: "We have closed this chat after 7 days without a reply. Message us any time and we will be happy to help.",
  ignoreWaiting: true,
  label: "",
};

// م137 round 2 (item 99, judge M137): the switch and the form are saved in this preview (api/settings-preview) and come
// back after a reload; each message says what happened. The switch saves at once (NN/g); the form's fields save with
// its button (Primer), and its yes/no field is a checkbox, not a second switch.
function AutoResolveCard({ saved }: { saved: AutoResolve | null | undefined }) {
  const { labels: labelNames } = useLivePickerNames(); // F-6B: the live labels (Settings > Labels), not the seed
  const [stored, setStored] = React.useState<AutoResolve>(AUTO_RESOLVE_DEFAULT);
  const [enabled, setEnabled] = React.useState(AUTO_RESOLVE_DEFAULT.enabled);
  const [amount, setAmount] = React.useState(String(AUTO_RESOLVE_DEFAULT.amount));
  const [unit, setUnit] = React.useState<Unit>(AUTO_RESOLVE_DEFAULT.unit);
  const [message, setMessage] = React.useState(AUTO_RESOLVE_DEFAULT.message);
  const [label, setLabel] = React.useState(AUTO_RESOLVE_DEFAULT.label);
  const [ignoreWaiting, setIgnoreWaiting] = React.useState(AUTO_RESOLVE_DEFAULT.ignoreWaiting);
  const [submitted, setSubmitted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Show what was saved, once it is read (undefined: still reading).
  React.useEffect(() => {
    if (!saved) return;
    setStored(saved);
    setEnabled(saved.enabled);
    setAmount(String(saved.amount));
    setUnit(saved.unit);
    setMessage(saved.message);
    setLabel(saved.label);
    setIgnoreWaiting(saved.ignoreWaiting);
  }, [saved]);

  async function keep(next: AutoResolve) {
    setBusy(true);
    try {
      const result = await saveConversationWorkflow({ autoResolve: next });
      if (result.autoResolve) setStored(result.autoResolve);
      toast.success("Auto resolve settings updated successfully", { description: SAVED_IN_PREVIEW });
      return true;
    } catch (error) {
      toast.error("Failed to update auto resolve settings", { description: (error as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const minutes = Number(amount) * minutesPer[unit];
  const durationError =
    !amount || !Number.isFinite(minutes) || minutes < 10 || minutes > 999 * 1440
      ? "Auto resolve duration should be between 10 minutes and 999 days"
      : "";

  function save(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (durationError) {
      toast.error("Failed to update auto resolve settings", { description: durationError });
      return;
    }
    void keep({ enabled, amount: Number(amount), unit, message, ignoreWaiting, label });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl leading-none">Auto-resolve conversations</CardTitle>
        <CardDescription>
          This configuration would allow you to automatically resolve the conversation after a certain period of
          inactivity.
        </CardDescription>
        <CardAction className="flex items-center gap-3">
          {enabled ? <ToneBadge tone="green">Enabled</ToneBadge> : <ToneBadge tone="gray">Disabled</ToneBadge>}
          <Switch
            checked={enabled}
            disabled={busy || saved === undefined}
            onCheckedChange={async (c) => {
              // At once, with the last saved fields (unsaved edits in the form stay unsaved).
              setEnabled(c);
              if (!(await keep({ ...stored, enabled: c }))) setEnabled(!c);
            }}
            aria-label="Auto-resolve conversations"
          />
        </CardAction>
      </CardHeader>
      {enabled ? (
        <CardContent className="border-t pt-5">
          <form onSubmit={save} className="grid gap-5" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="ar-duration">Inactivity duration</Label>
              <div className="flex max-w-sm gap-2">
                <Input
                  id="ar-duration"
                  type="number"
                  min={1}
                  placeholder="30"
                  value={amount}
                  aria-invalid={submitted && !!durationError}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <NativeSelect
                  className="w-32"
                  aria-label="Unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </NativeSelect>
              </div>
              {submitted && durationError ? (
                <FieldError>{durationError}</FieldError>
              ) : (
                <span className="text-muted-foreground text-xs">
                  Time period of inactivity after which conversation is auto-resolved
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ar-message">Custom auto-resolution message</Label>
              <Textarea
                id="ar-message"
                rows={3}
                placeholder="Conversation was marked resolved by system due to 15 days of inactivity"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <span className="text-muted-foreground text-xs">
                Message sent to the customer after conversation is auto-resolved
              </span>
            </div>
            <div className="grid gap-2">
              <Label>Preferences</Label>
              <div className="divide-y rounded-lg border">
                <div className="flex items-center gap-3 p-3">
                  <Checkbox
                    id="ar-ignore"
                    checked={ignoreWaiting}
                    onCheckedChange={(c) => setIgnoreWaiting(c === true)}
                  />
                  <Label htmlFor="ar-ignore" className="font-normal">
                    Skip conversations waiting for agent’s reply
                  </Label>
                </div>
                <div className="flex items-center justify-between gap-4 p-3">
                  <Label htmlFor="ar-label" className="font-normal">
                    Add label after auto-resolution
                  </Label>
                  <NativeSelect
                    id="ar-label"
                    size="sm"
                    className="w-44"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  >
                    <option value="">Select a label</option>
                    {labelNames.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </div>
            <Button type="submit" className="w-fit" disabled={busy || saved === undefined}>
              Save Changes
            </Button>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}

function RequiredAttributesCard({ saved }: { saved: string[] | null | undefined }) {
  const [required, setRequired] = React.useState<string[]>(["resolution_reason", "order_number"]);
  React.useEffect(() => {
    if (saved) setRequired(saved);
  }, [saved]);
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const chosen = required
    .map((k) => conversationAttributes.find((a) => a.attrKey === k))
    .filter((a): a is RequiredAttr => !!a);
  const options = conversationAttributes.filter(
    (a) => !required.includes(a.attrKey) && a.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const remaining = conversationAttributes.length - required.length;

  // م137 round 2 (item 99): each add or remove is saved in this preview at once; on a failure the list goes back.
  async function change(next: string[]) {
    const before = required;
    setRequired(next);
    try {
      await saveConversationWorkflow({ requiredAttributes: next });
      toast.success("Required attributes updated", { description: SAVED_IN_PREVIEW });
    } catch (error) {
      setRequired(before);
      toast.error("Required attributes not updated", { description: (error as Error).message });
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="py-5">
        <CardTitle className="text-xl leading-none">Attributes required on resolution</CardTitle>
        <CardDescription>
          When resolving a conversation, agents will be prompted to fill these attributes if they haven&apos;t yet.
        </CardDescription>
        <CardAction>
          <Popover
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setSearch("");
            }}
          >
            <PopoverTrigger asChild>
              <Button size="sm" disabled={!remaining}>
                <CirclePlus /> Add Attributes
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <div className="flex items-center gap-2 border-b px-2 pb-1">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search attributes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="grid max-h-60 overflow-y-auto pt-1">
                {options.length ? (
                  options.map((a) => {
                    const Icon = typeIcon[a.type];
                    return (
                      <button
                        key={a.attrKey}
                        type="button"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          change([...required, a.attrKey]);
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        <Icon className="size-3.5 text-muted-foreground" />
                        {a.name}
                      </button>
                    );
                  })
                ) : (
                  <span className="px-2 py-3 text-center text-muted-foreground text-sm">No attributes found</span>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </CardAction>
      </CardHeader>
      <Separator />
      {chosen.length ? (
        <div className="divide-y">
          {chosen.map((a) => {
            const Icon = typeIcon[a.type];
            return (
              <div key={a.attrKey} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg border bg-muted/40">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="grid gap-0.5">
                    <span className="font-medium text-sm">{a.name}</span>
                    <span className="font-mono text-muted-foreground text-xs">{a.attrKey}</span>
                  </div>
                  <ToneBadge tone="gray" dot={false}>
                    {a.type}
                  </ToneBadge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => change(required.filter((k) => k !== a.attrKey))}
                >
                  <X />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center gap-2 text-muted-foreground text-sm">
          <CircleCheck className="size-4" /> No attributes added yet
        </div>
      )}
    </Card>
  );
}

export function WorkflowPage() {
  // undefined while the saved copy is read; null when nothing was saved yet.
  const [saved, setSaved] = React.useState<ConversationWorkflow | null | undefined>(undefined);
  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview()
      .then((all) => alive && setSaved(all.conversationWorkflow))
      .catch((error) => {
        if (!alive) return;
        setSaved(null);
        toast.error("Saved workflow settings could not be read", { description: (error as Error).message });
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conversation Workflow"
        description="Configure rules and required fields for conversation resolution."
      />
      <AutoResolveCard saved={saved === undefined ? undefined : (saved?.autoResolve ?? null)} />
      <RequiredAttributesCard saved={saved === undefined ? undefined : (saved?.requiredAttributes ?? null)} />
    </div>
  );
}

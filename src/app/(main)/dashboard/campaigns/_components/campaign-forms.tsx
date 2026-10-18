"use client";
// Chatwoot v4.18 campaign dialogs (components-next/Campaigns/Pages/CampaignPage/*): same fields, placeholders,
// required-field errors and success toasts (i18n/locale/en/campaign.json), drawn with Studio's Field + Dialog parts.
import * as React from "react";

import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

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
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { ChannelKey } from "@/lib/cw/data";
import { useCwList } from "@/lib/cw/store";

import { formatSchedule, type LiveChatCampaign, type OneOffCampaign } from "./data";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Errors = Record<string, string | undefined>;

// Chatwoot reads inboxes, inbox members, labels and templates from the account; here that is src/lib/cw.
function useInboxNames(channel: ChannelKey) {
  const [inboxes] = useCwList("inboxes");
  return inboxes.filter((inbox) => inbox.channel === channel).map((inbox) => inbox.name);
}

function useInboxMembers(inboxName: string) {
  const [inboxes] = useCwList("inboxes");
  const [agents] = useCwList("agents");
  const inbox = inboxes.find((i) => i.name === inboxName);
  if (!inbox) return [];
  return inbox.agents.flatMap((id) => agents.find((agent) => agent.id === id)?.name ?? []);
}

// SMSCampaignForm.vue / LiveChatCampaignForm.vue: TextArea with max-length 200 and an "n / 200" counter.
const MESSAGE_MAX = 200;

function templateVariables(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/\{\{([^}]+)\}\}/g), (m) => m[1])));
}

function friendlyName(name: string) {
  return name
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function hasErrors(errors: Errors) {
  return Object.values(errors).some(Boolean);
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined} className="gap-1.5">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function SelectField({
  id,
  placeholder,
  options,
  value,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  placeholder: string;
  options: string[] | { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      id={id}
      className="w-full"
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </NativeSelect>
  );
}

function AudiencePicker({
  value,
  onChange,
  invalid,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  invalid?: boolean;
}) {
  const [accountLabels] = useCwList("labels");
  const labels = accountLabels.map((label) => label.title);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-invalid={invalid || undefined}
          className="flex min-h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
        >
          <span className="flex flex-1 flex-wrap gap-1">
            {value.length ? (
              value.map((label) => (
                <Badge key={label} variant="secondary" className="gap-1 font-normal">
                  {label}
                  <X
                    className="size-3 cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(value.filter((l) => l !== label));
                    }}
                  />
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Select the customer labels</span>
            )}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1">
        {labels.map((label) => {
          const checked = value.includes(label);
          return (
            // biome-ignore lint/a11y/noLabelWithoutControl: checkbox is nested
            <label
              key={label}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => onChange(next ? [...value, label] : value.filter((l) => l !== label))}
              />
              {label}
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function FormFooter({ submitLabel = "Create", onSubmit }: { submitLabel?: string; onSubmit: () => void }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button onClick={onSubmit}>{submitLabel}</Button>
    </DialogFooter>
  );
}

// Chatwoot blocks scheduling in the past: the picker's minimum is the current minute.
function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------- Live chat ----------

function LiveChatForm({
  campaign,
  onDone,
}: {
  campaign?: LiveChatCampaign;
  onDone: (campaign: LiveChatCampaign) => void;
}) {
  const isEdit = Boolean(campaign);
  const [title, setTitle] = React.useState(campaign?.title ?? "");
  const [message, setMessage] = React.useState(campaign?.message ?? "");
  const [inbox, setInbox] = React.useState(campaign?.inbox ?? "");
  // LiveChatCampaignForm.vue:47 senderId 0: "Bot" is preselected.
  const [sender, setSender] = React.useState(campaign?.sender ?? "Bot");
  const [url, setUrl] = React.useState(campaign?.url ?? "");
  const [timeOnPage, setTimeOnPage] = React.useState(campaign ? String(campaign.timeOnPage) : "10");
  const [enabled, setEnabled] = React.useState(campaign?.enabled ?? true);
  const [businessHours, setBusinessHours] = React.useState(campaign?.businessHoursOnly ?? false);
  const [errors, setErrors] = React.useState<Errors>({});
  const websiteInboxes = useInboxNames("website");
  const members = useInboxMembers(inbox);
  const senderOptions = inbox ? ["Bot", ...members] : ["Bot"];

  function submit() {
    const next: Errors = {
      title: title.trim() ? undefined : "Title is required",
      message: message.trim() ? undefined : "Message is required",
      inbox: inbox ? undefined : "Inbox is required",
      sender: sender ? undefined : "Sender is required",
      url: isValidUrl(url.trim()) ? undefined : "Please enter a valid URL",
      timeOnPage: timeOnPage.trim() && Number(timeOnPage) >= 0 ? undefined : "Time on page is required",
    };
    setErrors(next);
    if (hasErrors(next)) return;
    onDone({
      id: campaign?.id ?? Date.now(),
      title: title.trim(),
      message: message.trim(),
      inbox,
      sender: sender === "Bot" ? null : sender,
      url: url.trim(),
      timeOnPage: Number(timeOnPage),
      enabled,
      businessHoursOnly: businessHours,
    });
    toast.success(isEdit ? "Live chat campaign updated successfully" : "Live chat campaign created successfully");
  }

  return (
    <>
      <FieldGroup className="gap-4">
        <FormField label="Title" htmlFor="lc-title" error={errors.title}>
          <Input
            id="lc-title"
            placeholder="Please enter the title of campaign"
            value={title}
            aria-invalid={Boolean(errors.title) || undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
        <FormField label="Message" htmlFor="lc-message" error={errors.message}>
          <Textarea
            id="lc-message"
            className="min-h-20"
            placeholder="Please enter the message of campaign"
            value={message}
            maxLength={MESSAGE_MAX}
            aria-invalid={Boolean(errors.message) || undefined}
            onChange={(e) => setMessage(e.target.value)}
          />
          <span className="text-end text-muted-foreground text-xs tabular-nums">
            {message.length} / {MESSAGE_MAX}
          </span>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Select Inbox" htmlFor="lc-inbox" error={errors.inbox}>
            <SelectField
              id="lc-inbox"
              placeholder="Select Inbox"
              options={websiteInboxes}
              value={inbox}
              invalid={Boolean(errors.inbox)}
              onChange={(value) => {
                setInbox(value);
                setSender("Bot");
              }}
            />
          </FormField>
          <FormField label="Sent by" htmlFor="lc-sender" error={errors.sender}>
            <SelectField
              id="lc-sender"
              placeholder="Please select sender"
              options={senderOptions}
              value={sender}
              disabled={!inbox}
              invalid={Boolean(errors.sender)}
              onChange={setSender}
            />
          </FormField>
        </div>
        <FormField label="URL" htmlFor="lc-url" error={errors.url}>
          <Input
            id="lc-url"
            type="url"
            placeholder="Please enter the URL"
            value={url}
            aria-invalid={Boolean(errors.url) || undefined}
            onChange={(e) => setUrl(e.target.value)}
          />
        </FormField>
        <FormField label="Time on page(Seconds)" htmlFor="lc-time" error={errors.timeOnPage}>
          <Input
            id="lc-time"
            type="number"
            min={0}
            placeholder="Please enter the time"
            value={timeOnPage}
            aria-invalid={Boolean(errors.timeOnPage) || undefined}
            onChange={(e) => setTimeOnPage(e.target.value)}
          />
        </FormField>
        <FieldSet className="gap-2.5">
          <FieldLegend variant="label">Other preferences</FieldLegend>
          <Field orientation="horizontal">
            <Checkbox id="lc-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
            <FieldLabel htmlFor="lc-enabled" className="font-normal">
              Enable campaign
            </FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="lc-hours" checked={businessHours} onCheckedChange={(v) => setBusinessHours(v === true)} />
            <FieldLabel htmlFor="lc-hours" className="font-normal">
              Trigger only during business hours
            </FieldLabel>
          </Field>
        </FieldSet>
      </FieldGroup>
      <FormFooter submitLabel={isEdit ? "Confirm" : "Create"} onSubmit={submit} />
    </>
  );
}

export function LiveChatCampaignDialog({
  open,
  onOpenChange,
  campaign,
  onSave,
}: DialogProps & { campaign?: LiveChatCampaign; onSave: (campaign: LiveChatCampaign) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit live chat campaign" : "Create a live chat campaign"}</DialogTitle>
          <DialogDescription>Proactive message shown to visitors of a Website inbox.</DialogDescription>
        </DialogHeader>
        {open ? (
          <LiveChatForm
            key={campaign?.id ?? "new"}
            campaign={campaign}
            onDone={(saved) => {
              onSave(saved);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------- SMS ----------

function SMSForm({ onDone }: { onDone: (campaign: OneOffCampaign) => void }) {
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [inbox, setInbox] = React.useState("");
  const [audience, setAudience] = React.useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const smsInboxes = useInboxNames("sms");

  function submit() {
    const next: Errors = {
      title: title.trim() ? undefined : "Title is required",
      message: message.trim() ? undefined : "Message is required",
      inbox: inbox ? undefined : "Inbox is required",
      audience: audience.length ? undefined : "Audience is required",
      scheduledAt: scheduledAt ? undefined : "Scheduled time is required",
    };
    setErrors(next);
    if (hasErrors(next)) return;
    onDone({
      id: Date.now(),
      title: title.trim(),
      message: message.trim(),
      inbox,
      audience,
      scheduledAt: formatSchedule(scheduledAt),
      status: "scheduled",
    });
    toast.success("SMS campaign created successfully");
  }

  return (
    <>
      <FieldGroup className="gap-4">
        <FormField label="Title" htmlFor="sms-title" error={errors.title}>
          <Input
            id="sms-title"
            placeholder="Please enter the title of campaign"
            value={title}
            aria-invalid={Boolean(errors.title) || undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
        <FormField label="Message" htmlFor="sms-message" error={errors.message}>
          <Textarea
            id="sms-message"
            className="min-h-20"
            placeholder="Please enter the message of campaign"
            value={message}
            maxLength={MESSAGE_MAX}
            aria-invalid={Boolean(errors.message) || undefined}
            onChange={(e) => setMessage(e.target.value)}
          />
          <span className="text-end text-muted-foreground text-xs tabular-nums">
            {message.length} / {MESSAGE_MAX}
          </span>
        </FormField>
        <FormField label="Select Inbox" htmlFor="sms-inbox" error={errors.inbox}>
          <SelectField
            id="sms-inbox"
            placeholder="Select Inbox"
            options={smsInboxes}
            value={inbox}
            invalid={Boolean(errors.inbox)}
            onChange={setInbox}
          />
        </FormField>
        <FormField label="Audience" error={errors.audience}>
          <AudiencePicker value={audience} onChange={setAudience} invalid={Boolean(errors.audience)} />
        </FormField>
        <FormField label="Scheduled time" htmlFor="sms-time" error={errors.scheduledAt}>
          <Input
            id="sms-time"
            type="datetime-local"
            min={nowLocal()}
            placeholder="Please select the time"
            value={scheduledAt}
            aria-invalid={Boolean(errors.scheduledAt) || undefined}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </FormField>
      </FieldGroup>
      <FormFooter onSubmit={submit} />
    </>
  );
}

export function SMSCampaignDialog({
  open,
  onOpenChange,
  onSave,
}: DialogProps & { onSave: (campaign: OneOffCampaign) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create SMS campaign</DialogTitle>
          <DialogDescription>One-off SMS sent to every contact with the selected labels.</DialogDescription>
        </DialogHeader>
        {open ? (
          <SMSForm
            onDone={(saved) => {
              onSave(saved);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------- WhatsApp ----------

function WhatsAppForm({ onDone }: { onDone: (campaign: OneOffCampaign) => void }) {
  const [title, setTitle] = React.useState("");
  const [inbox, setInbox] = React.useState("");
  const [template, setTemplate] = React.useState("");
  const [variables, setVariables] = React.useState<Record<string, string>>({});
  const [audience, setAudience] = React.useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const whatsappInboxes = useInboxNames("whatsapp");
  const [accountTemplates] = useCwList("whatsappTemplates");
  // getFilteredWhatsAppTemplates: approved templates of the selected WhatsApp inbox.
  const templates = accountTemplates.filter((t) => t.status === "APPROVED" && t.inboxes.includes(inbox));
  const selected = templates.find((t) => t.name === template);
  const selectedVariables = selected ? templateVariables(selected.body) : [];

  function submit() {
    const next: Errors = {
      title: title.trim() ? undefined : "Title is required",
      inbox: inbox ? undefined : "Inbox is required",
      template: template ? undefined : "Template is required",
      // WhatsAppTemplateParser.vue FORM_ERROR_MESSAGE: every {{n}} needs a value.
      variables: selectedVariables.every((v) => variables[v]?.trim())
        ? undefined
        : "Please fill all variables before sending",
      audience: audience.length ? undefined : "Audience is required",
      scheduledAt: scheduledAt ? undefined : "Scheduled time is required",
    };
    setErrors(next);
    if (hasErrors(next) || !selected) return;
    onDone({
      id: Date.now(),
      title: title.trim(),
      message: selected.body.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => variables[key]?.trim() || match),
      inbox,
      audience,
      scheduledAt: formatSchedule(scheduledAt),
      status: "scheduled",
      template: `${selected.name} (${selected.code})`,
    });
    toast.success("WhatsApp campaign created successfully");
  }

  return (
    <>
      <FieldGroup className="gap-4">
        <FormField label="Title" htmlFor="wa-title" error={errors.title}>
          <Input
            id="wa-title"
            placeholder="Please enter the title of campaign"
            value={title}
            aria-invalid={Boolean(errors.title) || undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
        <FormField label="Select Inbox" htmlFor="wa-inbox" error={errors.inbox}>
          <SelectField
            id="wa-inbox"
            placeholder="Select Inbox"
            options={whatsappInboxes}
            value={inbox}
            invalid={Boolean(errors.inbox)}
            onChange={(value) => {
              setInbox(value);
              setTemplate("");
            }}
          />
        </FormField>
        <FormField label="WhatsApp Template" htmlFor="wa-template" error={errors.template}>
          <SelectField
            id="wa-template"
            placeholder="Select a template"
            options={templates.map((t) => ({ value: t.name, label: `${friendlyName(t.name)} (${t.code})` }))}
            value={template}
            disabled={!inbox}
            invalid={Boolean(errors.template)}
            onChange={(value) => {
              setTemplate(value);
              setVariables({});
            }}
          />
          <p className="text-muted-foreground text-xs">Select a template to use for this campaign.</p>
        </FormField>
        {selected ? (
          <div className="grid gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-sm">{selected.name}</span>
              <div className="flex gap-1.5 text-muted-foreground text-xs">
                <span>Language: {selected.code}</span>
                <span>·</span>
                <span>Category: {selected.category}</span>
              </div>
            </div>
            <p className="rounded-md bg-background p-2.5 text-sm" dir="auto">
              {selected.body.replace(/\{\{(\d+)\}\}/g, (match, key: string) => variables[key] || match)}
            </p>
            {selectedVariables.length ? (
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground text-xs">Variables</Label>
                {selectedVariables.map((variable) => (
                  <div key={variable} className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {`{{${variable}}}`}
                    </Badge>
                    <Input
                      className="h-7"
                      placeholder={`Enter ${variable} value`}
                      aria-invalid={(Boolean(errors.variables) && !variables[variable]?.trim()) || undefined}
                      value={variables[variable] ?? ""}
                      onChange={(e) => setVariables((prev) => ({ ...prev, [variable]: e.target.value }))}
                    />
                  </div>
                ))}
                {errors.variables ? <p className="text-destructive text-xs">{errors.variables}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <FormField label="Audience" error={errors.audience}>
          <AudiencePicker value={audience} onChange={setAudience} invalid={Boolean(errors.audience)} />
        </FormField>
        <FormField label="Scheduled time" htmlFor="wa-time" error={errors.scheduledAt}>
          <Input
            id="wa-time"
            type="datetime-local"
            min={nowLocal()}
            placeholder="Please select the time"
            value={scheduledAt}
            aria-invalid={Boolean(errors.scheduledAt) || undefined}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </FormField>
      </FieldGroup>
      <FormFooter onSubmit={submit} />
    </>
  );
}

export function WhatsAppCampaignDialog({
  open,
  onOpenChange,
  onSave,
}: DialogProps & { onSave: (campaign: OneOffCampaign) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create WhatsApp campaign</DialogTitle>
          <DialogDescription>Approved template sent to every contact with the selected labels.</DialogDescription>
        </DialogHeader>
        {open ? (
          <WhatsAppForm
            onDone={(saved) => {
              onSave(saved);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Delete ----------

export function ConfirmDeleteCampaignDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
}: DialogProps & { title?: string; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure to delete?</AlertDialogTitle>
          <AlertDialogDescription>
            {title ? <span className="font-medium text-foreground">{title}. </span> : null}
            The delete action is permanent and cannot be reversed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm();
              toast.success("Campaign deleted successfully");
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

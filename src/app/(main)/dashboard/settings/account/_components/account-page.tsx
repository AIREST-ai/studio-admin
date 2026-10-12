"use client";
// Chatwoot routes/dashboard/settings/account/Index.vue + components/{AutoResolve,AudioTranscription,AccountId,
// BuildInfo,AccountDelete}.vue, drawn in the Studio pattern: big title outside, one card per section.
import * as React from "react";

import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { ConfirmDeleteDialog } from "../../inboxes/_components/settings-ui";
import { PageHeader } from "../../labels/_shared/settings-shell";
import { SettingsCard } from "../../_components/settings-card";

const ACCOUNT_NAME = "Weblabs Studio";
const ACCOUNT_ID = "104729";
const BUILD = { version: "4.18.0", sha: "8f3c2a1" };

const languages = [
  { code: "en", name: "English (en)" },
  { code: "ar", name: "العربية (ar)" },
  { code: "fr", name: "Français (fr)" },
  { code: "hi", name: "हिन्दी (hi)" },
  { code: "ur", name: "اردو (ur)" },
  { code: "es", name: "Español (es)" },
  { code: "de", name: "Deutsch (de)" },
];

const labels = ["vip", "billing", "lead", "partner", "support"];
const units = { minutes: 1, hours: 60, days: 24 * 60 } as const;
type Unit = keyof typeof units;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <InputGroupButton
      size="icon-xs"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).catch(() => undefined);
        setCopied(true);
        toast.success("Copied to clipboard successfully");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
    </InputGroupButton>
  );
}

function GeneralSection() {
  const [name, setName] = React.useState(ACCOUNT_NAME);
  const [language, setLanguage] = React.useState("en");
  const [touched, setTouched] = React.useState(false);
  const nameError = touched && !name.trim();
  return (
    <SettingsCard
      title="General settings"
      footer={
        <Button
          size="sm"
          onClick={() => {
            setTouched(true);
            if (!name.trim()) {
              toast.error("Please fix form errors");
              return;
            }
            toast.success("Successfully updated account settings");
          }}
        >
          Update settings
        </Button>
      }
    >
      <FieldGroup className="max-w-2xl gap-4">
        <Field data-invalid={nameError || undefined}>
          <FieldLabel htmlFor="account-name">Account name</FieldLabel>
          <Input
            id="account-name"
            placeholder="Your account name"
            value={name}
            aria-invalid={nameError || undefined}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          {nameError ? <FieldError>Please enter a valid account name</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="site-language">Site language</FieldLabel>
          <NativeSelect
            id="site-language"
            className="w-full"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languages.map((lang) => (
              <NativeSelectOption key={lang.code} value={lang.code}>
                {lang.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="custom-domain">Incoming Email Domain</FieldLabel>
          <Input
            id="custom-domain"
            placeholder="The domain where you will receive the emails"
            defaultValue="mail.weblabs.studio"
          />
          <FieldDescription>
            Conversation continuity with emails is enabled for your account. You can receive emails in your custom
            domain now.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="support-email">Support Email</FieldLabel>
          <Input id="support-email" placeholder="Your company's support email" defaultValue="support@weblabs.studio" />
        </Field>
      </FieldGroup>
    </SettingsCard>
  );
}

function AutoResolveSection() {
  const [enabled, setEnabled] = React.useState(true);
  const [amount, setAmount] = React.useState("15");
  const [unit, setUnit] = React.useState<Unit>("days");
  const [ignoreWaiting, setIgnoreWaiting] = React.useState(true);
  const [label, setLabel] = React.useState("");
  const minutes = Number(amount) * units[unit];
  const invalid = enabled && (!amount || Number.isNaN(minutes) || minutes < 10 || minutes > 999 * 24 * 60);
  return (
    <SettingsCard
      title="Auto-resolve conversations"
      description="This configuration would allow you to automatically resolve the conversation after a certain period of inactivity."
      action={<Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Auto-resolve conversations" />}
      footer={
        <Button
          size="sm"
          disabled={invalid}
          onClick={() => toast.success("Auto resolve settings updated successfully")}
        >
          Save Changes
        </Button>
      }
    >
      <FieldGroup className="max-w-2xl gap-4" data-disabled={!enabled || undefined}>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="ar-duration">Inactivity duration</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="ar-duration"
              type="number"
              min={1}
              placeholder="30"
              className="w-32"
              value={amount}
              disabled={!enabled}
              aria-invalid={invalid || undefined}
              onChange={(event) => setAmount(event.target.value)}
            />
            <NativeSelect
              aria-label="Unit"
              value={unit}
              disabled={!enabled}
              onChange={(event) => setUnit(event.target.value as Unit)}
            >
              <NativeSelectOption value="minutes">Minutes</NativeSelectOption>
              <NativeSelectOption value="hours">Hours</NativeSelectOption>
              <NativeSelectOption value="days">Days</NativeSelectOption>
            </NativeSelect>
          </div>
          {invalid ? (
            <FieldError>Auto resolve duration should be between 10 minutes and 999 days</FieldError>
          ) : (
            <FieldDescription>Time period of inactivity after which conversation is auto-resolved</FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="ar-message">Custom auto-resolution message</FieldLabel>
          <Textarea
            id="ar-message"
            disabled={!enabled}
            placeholder="Conversation was marked resolved by system due to 15 days of inactivity"
            defaultValue="We have closed this conversation after 15 days without a reply. Write to us any time to reopen it."
          />
          <FieldDescription>Message sent to the customer after conversation is auto-resolved</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Preferences</FieldLabel>
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="ar-ignore" className="text-sm">
                Skip conversations waiting for agent’s reply
              </label>
              <Switch id="ar-ignore" checked={ignoreWaiting} disabled={!enabled} onCheckedChange={setIgnoreWaiting} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <label htmlFor="ar-label" className="text-sm">
                Add label after auto-resolution
              </label>
              <NativeSelect
                id="ar-label"
                size="sm"
                value={label}
                disabled={!enabled}
                onChange={(event) => setLabel(event.target.value)}
              >
                <NativeSelectOption value="">Select a label</NativeSelectOption>
                {labels.map((l) => (
                  <NativeSelectOption key={l} value={l}>
                    {l}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </Field>
      </FieldGroup>
    </SettingsCard>
  );
}

export function AccountPage() {
  const [transcribe, setTranscribe] = React.useState(true);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Account settings" description="General settings, auto-resolve and the ID of this account." />

      <GeneralSection />
      <AutoResolveSection />

      <SettingsCard
        title={
          <span className="flex items-center gap-2">
            Transcribe Audio Messages
            <Badge variant="secondary" className="font-normal">
              Beta
            </Badge>
          </span>
        }
        description="Automatically transcribe audio messages in conversations. Generate a text transcript whenever an audio message is sent or received, and display it alongside the message."
        action={
          <Switch
            checked={transcribe}
            onCheckedChange={(on) => {
              setTranscribe(on);
              toast.success("Audio transcription setting updated successfully");
            }}
            aria-label="Transcribe audio messages"
          />
        }
      />

      <SettingsCard title="Account ID" description="This ID is required if you are building an API based integration">
        <InputGroup className="max-w-xs">
          <InputGroupInput readOnly value={ACCOUNT_ID} className="font-mono tabular-nums" />
          <InputGroupAddon align="inline-end">
            <CopyButton value={ACCOUNT_ID} label="Copy account ID" />
          </InputGroupAddon>
        </InputGroup>
      </SettingsCard>

      <SettingsCard
        tone="danger"
        title="Delete your Account"
        description="Once you delete your account, all your data will be deleted."
        action={
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete Your Account
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-center gap-2 py-2 text-muted-foreground text-xs">
        <span>Build</span>
        <Badge variant="outline" className="font-mono font-normal">
          v{BUILD.version}
        </Badge>
        <span>·</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-mono hover:text-foreground"
          onClick={() => {
            void navigator.clipboard?.writeText(BUILD.sha).catch(() => undefined);
            toast.success("Copied to clipboard successfully");
          }}
        >
          {BUILD.sha}
          <Copy className="size-3" />
        </button>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Account"
        message="Deleting your Account is irreversible. Enter your account name below to confirm you want to permanently delete it."
        confirmValue={ACCOUNT_NAME}
        placeholder={`Please type ${ACCOUNT_NAME} to confirm`}
        confirmText="Delete"
        rejectText="Cancel"
      />
    </div>
  );
}

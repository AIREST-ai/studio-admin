"use client";
import * as React from "react";

import { Check, Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

import { ConfirmDeleteDialog, Section, SettingsHeader } from "../../inboxes/_components/settings-ui";

const ACCOUNT_NAME = "Al Rayyan Clinics";

const languages = [
  { code: "ar", name: "العربية (ar)" },
  { code: "en", name: "English (en)" },
  { code: "fr", name: "Français (fr)" },
  { code: "hi", name: "हिन्दी (hi)" },
  { code: "ur", name: "اردو (ur)" },
];

export function AccountSettings() {
  const [copied, setCopied] = React.useState(false);
  const [transcribe, setTranscribe] = React.useState(true);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card className="gap-0 py-0">
        <SettingsHeader title="Account settings" />

        <Section title="General settings">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="account-name">Account name</FieldLabel>
              <Input id="account-name" placeholder="Your account name" defaultValue={ACCOUNT_NAME} />
            </Field>
            <Field>
              <FieldLabel htmlFor="site-language">Site language</FieldLabel>
              <NativeSelect id="site-language" className="w-full" defaultValue="en">
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="custom-domain">Incoming Email Domain</FieldLabel>
              <Input
                id="custom-domain"
                placeholder="The domain where you will receive the emails"
                defaultValue="mail.alrayyan-clinics.qa"
              />
              <FieldDescription>
                Conversation continuity with emails is enabled for your account. You can receive emails in your custom
                domain now.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="support-email">Support Email</FieldLabel>
              <Input
                id="support-email"
                placeholder="Your company's support email"
                defaultValue="care@alrayyan-clinics.qa"
              />
            </Field>
          </FieldGroup>
          <div>
            <Button size="sm">Update settings</Button>
          </div>
        </Section>

        <Section
          title="Transcribe Audio Messages"
          description="Automatically transcribe audio messages in conversations. Generate a text transcript whenever an audio message is sent or received, and display it alongside the message."
          action={<Switch checked={transcribe} onCheckedChange={setTranscribe} aria-label="Transcribe audio messages" />}
        />

        <Section title="Account ID" description="This ID is required if you are building an API based integration">
          <InputGroup className="max-w-xs">
            <InputGroupInput readOnly value="104729" className="font-mono tabular-nums" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Copy"
                onClick={() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check /> : <Copy />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Section>

        <Section
          title="Delete your Account"
          description="Once you delete your account, all your data will be deleted."
          action={
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete Your Account
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-center gap-2 px-6 py-4 text-muted-foreground text-xs">
          <span>Build</span>
          <Badge variant="outline" className="font-mono font-normal">
            v4.18.0
          </Badge>
          <span>·</span>
          <span className="font-mono">8f3c2a1</span>
        </div>
      </Card>

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

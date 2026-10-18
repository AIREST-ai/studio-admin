"use client";
// Inbox settings parts that depend on the channel, from Chatwoot routes/dashboard/settings/inbox/Settings.vue,
// settingsPage/{CollaboratorsPage,ConfigurationPage,VoiceConfigurationPage,WhatsappCallingPage}.vue,
// components/{AccountHealth,TwilioHealth}.vue, ImapSettings.vue and SmtpSettings.vue. Strings from inboxMgmt.json.
import * as React from "react";

import Link from "next/link";

import { Check, CircleCheck, Copy, Eye, EyeOff, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { copyText } from "../../_components/copy-text";
import { SAVED_IN_PREVIEW } from "../../_components/settings-preview-client";
import { orderLabel, priorityLabel } from "../../assignment-policy/_components/data";
import { linkInboxToPolicy, useAssignmentPolicies } from "../../assignment-policy/_components/policies-store";
import { ConfirmDialog } from "../../assignment-policy/_components/policy-ui";
import type { Inbox } from "./data";
import { inboxExtras, PREVIEW_ADDRESS_NOTE, previewValue, saveInboxExtras, toastInboxSaved } from "./inbox-extras";
import { inboxesStore, whenSaved } from "./inboxes-store";
import { Section } from "./settings-ui";

/** The line under a value the preview made for this inbox (no server answers it). */
function PreviewNote({ children = PREVIEW_ADDRESS_NOTE }: { children?: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs" data-preview-note>
      {children}
    </p>
  );
}

const BASE_URL = "https://chat.weblabs.studio";

export function CopyValue({ value, secret, className }: { value: string; secret?: boolean; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const [visible, setVisible] = React.useState(!secret);
  return (
    <InputGroup className={className ?? "max-w-lg"}>
      <InputGroupInput readOnly value={visible ? value : "•".repeat(24)} className="font-mono text-xs" />
      <InputGroupAddon align="inline-end">
        {secret ? (
          <InputGroupButton size="icon-xs" aria-label="Toggle secret visibility" onClick={() => setVisible((v) => !v)}>
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        ) : null}
        <InputGroupButton
          size="icon-xs"
          aria-label="Copy"
          onClick={async () => {
            if (await copyText(value, "Copied to clipboard successfully")) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

function SwitchRow({
  label,
  help,
  checked,
  onCheckedChange,
  defaultChecked,
}: {
  label: string;
  help?: string;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  defaultChecked?: boolean;
}) {
  const id = React.useId();
  return (
    <Field orientation="horizontal" className="items-start">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange?.(v === true)}
        defaultChecked={defaultChecked}
      />
      <div className="grid gap-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help ? <FieldDescription>{help}</FieldDescription> : null}
      </div>
    </Field>
  );
}

// ---------- Settings tab additions ----------

/** API channel: Webhook URL + Webhook Secret (WEBSITE_CHANNEL.CHANNEL_WEBHOOK_URL / CHANNEL_WEBHOOK_SECRET).
 *  F-6A: the URL is this inbox's own (saved by the Settings tab's Update); the secret is made for this inbox and a
 *  regenerated one is saved at once, as Chatwoot regenerates it at once. */
export function ApiWebhookFields({
  inbox,
  webhookUrl,
  onWebhookUrlChange,
}: {
  inbox: Inbox;
  webhookUrl: string;
  onWebhookUrlChange: (value: string) => void;
}) {
  const [secret, setSecret] = React.useState(
    inboxExtras(inbox).webhookSecret ?? `whsec_${previewValue(inbox, "webhook-secret", 16).toLowerCase()}`,
  );
  return (
    <>
      <Field>
        <FieldLabel htmlFor="api-webhook">Webhook URL</FieldLabel>
        <Input
          id="api-webhook"
          placeholder="Please enter your Webhook URL"
          value={webhookUrl}
          onChange={(event) => onWebhookUrlChange(event.target.value)}
        />
        <FieldDescription>Preview — simulated: no event is sent to this URL from the preview.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Webhook Secret</FieldLabel>
        <div className="flex gap-2">
          <CopyValue value={secret} secret className="max-w-md" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Regenerate webhook secret"
            onClick={async () => {
              const next = `whsec_${Math.random().toString(16).slice(2, 18)}`;
              if (
                await toastInboxSaved(
                  saveInboxExtras(inbox.id, { webhookSecret: next }),
                  "Webhook secret regenerated successfully",
                )
              )
                setSecret(next);
            }}
          >
            <RefreshCw />
          </Button>
        </div>
      </Field>
    </>
  );
}

export interface WidgetBubble {
  position: string;
  type: string;
  launcherTitle: string;
}

/** Website: widget bubble position / type / launcher title. T-223: the Settings tab holds and saves the values. */
export function WidgetBubbleFields({
  value,
  onChange,
}: {
  value: WidgetBubble;
  onChange: (patch: Partial<WidgetBubble>) => void;
}) {
  const { position, type } = value;
  const setPosition = (next: string) => onChange({ position: next });
  const setType = (next: string) => onChange({ type: next });
  return (
    <>
      <Field>
        <FieldLabel>Widget Bubble Position</FieldLabel>
        <RadioGroup value={position} onValueChange={setPosition} className="flex gap-6">
          {["left", "right"].map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm capitalize">
              <RadioGroupItem value={p} /> {p}
            </label>
          ))}
        </RadioGroup>
      </Field>
      <Field>
        <FieldLabel>Widget Bubble Type</FieldLabel>
        <RadioGroup value={type} onValueChange={setType} className="flex gap-6">
          {[
            { v: "standard", l: "Standard" },
            { v: "expanded_bubble", l: "Expanded Bubble" },
          ].map((o) => (
            <label key={o.v} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={o.v} /> {o.l}
            </label>
          ))}
        </RadioGroup>
      </Field>
      {type === "expanded_bubble" ? (
        <Field>
          <FieldLabel htmlFor="launcher-title">Widget Bubble Launcher Title</FieldLabel>
          <Input
            id="launcher-title"
            placeholder="Chat with us"
            value={value.launcherTitle}
            onChange={(event) => onChange({ launcherTitle: event.target.value })}
          />
        </Field>
      ) : null}
    </>
  );
}

export interface SenderName {
  type: string;
  businessName: string;
}

/** Email and website: how the agent's name appears to the customer (SENDER_NAME_SECTION). T-223: saved by the Settings tab. */
export function SenderNameSection({
  value,
  onChange,
}: {
  value: SenderName;
  onChange: (patch: Partial<SenderName>) => void;
}) {
  const { type, businessName: business } = value;
  const setType = (next: string) => onChange({ type: next });
  const setBusiness = (next: string) => onChange({ businessName: next });
  return (
    <Section
      title="Sender name"
      description="Select the name shown to your customer when they receive emails from your agents."
    >
      <RadioGroup value={type} onValueChange={setType} className="grid max-w-2xl gap-3 md:grid-cols-2">
        {[
          {
            v: "friendly",
            l: "Friendly",
            d: "Add the name of the agent who sent the reply in the sender name to make it friendly.",
            ex: `Priya Nair from ${business || "Weblabs Studio"}`,
          },
          {
            v: "professional",
            l: "Professional",
            d: "Use only the configured business name as the sender name in the email header.",
            ex: business || "Weblabs Studio",
          },
        ].map((o) => (
          <label
            key={o.v}
            className="grid cursor-pointer gap-2 rounded-lg border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
          >
            <span className="flex items-center gap-2 font-medium text-sm">
              <RadioGroupItem value={o.v} /> {o.l}
            </span>
            <span className="text-muted-foreground text-xs">{o.d}</span>
            <span className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">From: </span>
              {o.ex} &lt;support@weblabs.studio&gt;
            </span>
          </label>
        ))}
      </RadioGroup>
      <Field className="max-w-md">
        <FieldLabel htmlFor="business-name">Business name</FieldLabel>
        <Input id="business-name" value={business} onChange={(e) => setBusiness(e.target.value)} />
      </Field>
    </Section>
  );
}

// ---------- Collaborators: assignment policy ----------

export function AssignmentSection({ inbox }: { inbox: Inbox }) {
  const assignmentPolicies = useAssignmentPolicies();
  const [auto, setAuto] = React.useState(inbox.autoAssign);
  // F161: the linked policy lives in the shared policies store, so linking here shows on the policy pages too.
  const policyId = assignmentPolicies.find((p) => p.inboxes.includes(inbox.id))?.id ?? null;
  // F-6A: linking, removing and Update say "successfully" only after the save (policies and inboxes are saved lists).
  const setPolicyId = (id: number | null, done: string) =>
    linkInboxToPolicy(inbox.id, id).then(
      () => toast.success(done, { description: SAVED_IN_PREVIEW }),
      (error: Error) => toast.error("Not saved", { description: error.message }),
    );
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [limit, setLimit] = React.useState(String(inboxExtras(inbox).autoAssignLimit ?? 12));
  const policy = assignmentPolicies.find((p) => p.id === policyId);
  const limitError = limit !== "" && Number(limit) <= 0;

  return (
    <Section
      title="Conversation Assignment"
      description="Automatically assign incoming conversations to available agents based on assignment policies"
    >
      <div className="grid max-w-2xl gap-4">
        <SwitchRow label="Enable automatic conversation assignment" checked={auto} onCheckedChange={setAuto} />
        {auto && policy ? (
          <div className="grid gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid gap-0.5">
                <span className="font-medium text-sm">Using custom assignment policy for this inbox</span>
                <span className="text-muted-foreground text-xs">{policy.description}</span>
              </div>
              <Badge
                variant="outline"
                className={
                  policy.active
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {policy.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground text-xs">Assignment policy</dt>
                <dd className="font-medium">{policy.name}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground text-xs">Assignment Order</dt>
                <dd>{priorityLabel[policy.priority]}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground text-xs">Assignment Method</dt>
                <dd>{policy.order === "balanced" ? "Balanced assignment" : orderLabel[policy.order]}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/settings/assignment-policy/assignment/${policy.id}`}>
                  Customize with assignment policy
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                type="button"
                onClick={() => setConfirmRemove(true)}
              >
                Delete policy
              </Button>
            </div>
          </div>
        ) : null}
        {auto && !policy ? (
          <div className="grid gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="grid gap-0.5">
                <span className="font-medium text-sm">Default assignment rules</span>
                <span className="text-muted-foreground text-xs">
                  Using the default assignment behavior for all conversations
                </span>
              </div>
              <Badge variant="secondary">Default policy linked</Badge>
            </div>
            <p className="text-muted-foreground text-sm">Currently using default assignment behavior:</p>
            <ul className="grid gap-1.5 text-sm">
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-primary" /> Earliest created conversations first
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-primary" /> Round robin distribution
              </li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" type="button">
                    Link existing policy
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Assignment policy</DropdownMenuLabel>
                  {assignmentPolicies.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() => setPolicyId(p.id, "Assignment policy linked successfully")}
                    >
                      <span className="flex-1">{p.name}</span>
                      <span className="text-muted-foreground text-xs">{orderLabel[p.order]}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings/assignment-policy/assignment">View all policies</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/settings/assignment-policy/assignment/new?inboxId=${inbox.id}`}>
                  Create new policy
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
        <Field data-invalid={limitError || undefined}>
          <FieldLabel htmlFor="limit">Auto assignment limit</FieldLabel>
          <Input
            id="limit"
            type="number"
            value={limit}
            aria-invalid={limitError || undefined}
            onChange={(e) => setLimit(e.target.value)}
            className="max-w-40"
          />
          {limitError ? (
            <FieldError>Please enter a value greater than 0</FieldError>
          ) : (
            <FieldDescription>
              Limit the maximum number of conversations from this inbox that can be auto assigned to an agent
            </FieldDescription>
          )}
        </Field>
        <div>
          <Button
            size="sm"
            type="button"
            disabled={limitError}
            onClick={() =>
              toastInboxSaved(
                saveInboxExtras(inbox.id, limit === "" ? {} : { autoAssignLimit: Number(limit) }, { autoAssign: auto }),
                "Inbox settings updated successfully",
              )
            }
          >
            Update
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Delete assignment policy?"
        description="Are you sure you want to remove this assignment policy from this inbox? The inbox will revert to the default assignment rules."
        confirm="Delete"
        destructive
        onConfirm={() => setPolicyId(null, "Assignment policy removed successfully")}
      />
    </Section>
  );
}

// ---------- Configuration tab, per channel ----------

export function HmacSection({ inbox, title = "Identity Validation" }: { inbox: Inbox; title?: string }) {
  // Chatwoot ConfigurationPage.vue: website = secret key + "Require identity validation" toggle; API inbox =
  // "User Identity Validation" key + "Enforce User Identity Validation" checkbox.
  // F-6A: the key is this inbox's own (it was one key for every inbox), and the checkbox is saved at once.
  const isApi = title !== "Identity Validation";
  const [required, setRequired] = React.useState(inboxExtras(inbox).identityRequired ?? false);
  const toggle = async (on: boolean) => {
    setRequired(on);
    if (
      !(await toastInboxSaved(
        saveInboxExtras(inbox.id, { identityRequired: on }),
        "Inbox settings updated successfully",
      ))
    )
      setRequired(!on);
  };
  return (
    <Section
      title={isApi ? "User Identity Validation" : title}
      description={
        isApi
          ? "With this key you can generate a secret token that can be used to verify the identity of your users."
          : "Verify user authenticity by generating secure tokens. This prevents unauthorized users from impersonating others in your chat."
      }
    >
      <div className="grid max-w-2xl gap-4">
        <Field>
          <FieldLabel>Secret Key</FieldLabel>
          <CopyValue value={`hmac_${previewValue(inbox, "hmac", 24).toLowerCase()}`} secret />
          {isApi ? null : (
            <FieldDescription>
              With this key you can generate a secret token that can be used to verify the identity of your users.
            </FieldDescription>
          )}
          <PreviewNote>
            Preview — simulated: a key made by this preview for this inbox; nothing checks it yet.
          </PreviewNote>
        </Field>
        {isApi ? (
          <Field>
            <FieldLabel>Enforce User Identity Validation</FieldLabel>
            <FieldDescription>If enabled, requests that cannot be verified will be rejected.</FieldDescription>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={required} onCheckedChange={(v) => toggle(v === true)} /> Enable
            </label>
          </Field>
        ) : (
          <SwitchRow
            label="Require identity validation for all conversations"
            help="When enabled, users must provide a valid identity token to start conversations. Requests without valid tokens will be rejected."
            checked={required}
            onCheckedChange={toggle}
          />
        )}
      </div>
    </Section>
  );
}

export function ApiConfiguration({ inbox }: { inbox: Inbox }) {
  return (
    <>
      <Section
        title="Inbox Identifier"
        description="Use the `inbox_identifier` token shown here to authentication your API clients."
      >
        <div className="grid gap-2">
          <CopyValue value={previewValue(inbox, "inbox-identifier", 20)} />
          <PreviewNote />
        </div>
      </Section>
      <HmacSection inbox={inbox} title="HMAC Token" />
    </>
  );
}

export function CallbackConfiguration({ kind, inbox }: { kind: "twilio" | "line"; inbox: Inbox }) {
  return (
    <Section
      title="Callback URL"
      description={
        kind === "twilio"
          ? "You have to configure the message callback URL in Twilio with the URL mentioned here."
          : "You have to configure the webhook URL in LINE application with the URL mentioned here."
      }
    >
      <div className="grid gap-2">
        <CopyValue
          value={
            kind === "twilio"
              ? `${BASE_URL}/twilio/callback`
              : `${BASE_URL}/webhooks/line/${previewValue(inbox, "line", 6)}`
          }
        />
        <PreviewNote />
      </div>
    </Section>
  );
}

// F-6A: nothing here pretends a link to Meta. Sync templates and Update API key say plainly that the preview is not
// connected to Meta and keeps no keys (a key was shown here as if one were stored).
export function WhatsappConfiguration({ inbox }: { inbox: Inbox }) {
  const [apiKey, setApiKey] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const phone = inbox.identifier.replace(/\s/g, "");
  return (
    <>
      <Section
        title="Callback URL"
        description="You have to configure the webhook URL and the verification token in the Facebook Developer portal with the values shown below."
      >
        <div className="grid max-w-lg gap-3">
          <Field>
            <FieldLabel>Webhook URL</FieldLabel>
            <CopyValue value={`${BASE_URL}/webhooks/whatsapp/${phone}`} />
          </Field>
          <Field>
            <FieldLabel>Webhook Verification Token</FieldLabel>
            <CopyValue value={previewValue(inbox, "wa-verify", 12).toLowerCase()} secret />
          </Field>
          <PreviewNote />
        </div>
      </Section>
      <Section title="Message templates" description="Sync the approved WhatsApp templates of this number from Meta.">
        <div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() =>
              toast.info("Templates not synced: this preview is not connected to Meta", {
                description:
                  "Nothing was fetched from Meta. The templates in Settings › Templates are the ones kept in this preview.",
              })
            }
          >
            <RefreshCw /> Sync templates
          </Button>
        </div>
      </Section>
      <Section title="API key" description="Configure the WhatsApp API key.">
        <div className="grid max-w-md gap-3">
          <PreviewNote>No API key is stored in this preview, so none is shown.</PreviewNote>
          <Field data-invalid={(submitted && !apiKey.trim()) || undefined}>
            <Input
              type="password"
              placeholder="API key"
              value={apiKey}
              aria-invalid={(submitted && !apiKey.trim()) || undefined}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {submitted && !apiKey.trim() ? <FieldError>Please enter a valid value.</FieldError> : null}
          </Field>
          <div>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                setSubmitted(true);
                if (!apiKey.trim()) return;
                setApiKey("");
                setSubmitted(false);
                toast.info("API key not kept: this preview stores no keys", {
                  description: "The key was cleared and was not saved or sent to Meta.",
                });
              }}
            >
              Update API key
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

// F-6A: IMAP / SMTP are saved for this inbox, except the password, which the preview does not keep; the message says
// so, and that the preview does not connect to the mail server. Update shows with the box on or off, so turning a
// server off can be saved too.
function ServerSettings({ kind, inbox }: { kind: "IMAP" | "SMTP"; inbox: Inbox }) {
  const isImap = kind === "IMAP";
  const saved = inboxExtras(inbox);
  const imap = saved.imap ?? {
    enabled: true,
    address: "imap.gmail.com",
    port: 993,
    login: "support@weblabs.studio",
    ssl: true,
  };
  const smtp = saved.smtp ?? {
    enabled: false,
    address: "smtp.gmail.com",
    port: 587,
    login: "support@weblabs.studio",
    domain: "weblabs.studio",
    encryption: "starttls",
    authentication: "login",
  };
  const [enabled, setEnabled] = React.useState(isImap ? imap.enabled : smtp.enabled);
  const [address, setAddress] = React.useState(isImap ? imap.address : smtp.address);
  const [port, setPort] = React.useState(String(isImap ? imap.port : smtp.port));
  const [login, setLogin] = React.useState(isImap ? imap.login : smtp.login);
  const [password, setPassword] = React.useState("");
  const [ssl, setSsl] = React.useState(imap.ssl);
  const [domain, setDomain] = React.useState(smtp.domain);
  const [encryption, setEncryption] = React.useState(smtp.encryption);
  const [authentication, setAuthentication] = React.useState(smtp.authentication);
  const save = async () => {
    const portNumber = Number(port) || (isImap ? 993 : 587);
    const saving = isImap
      ? saveInboxExtras(inbox.id, {
          imap: { enabled, address: address.trim(), port: portNumber, login: login.trim(), ssl },
        })
      : saveInboxExtras(inbox.id, {
          smtp: {
            enabled,
            address: address.trim(),
            port: portNumber,
            login: login.trim(),
            domain: domain.trim(),
            encryption,
            authentication,
          },
        });
    setPassword("");
    await toastInboxSaved(
      saving,
      `${kind} settings updated successfully`,
      `${SAVED_IN_PREVIEW} The password is not kept, and the preview does not connect to the mail server.`,
    );
  };
  return (
    <Section
      title={isImap ? "IMAP" : "SMTP"}
      description={
        isImap
          ? "Set your IMAP details to fetch emails from your mail server."
          : "Set your SMTP details to send emails from your mail server."
      }
      action={
        <label className="flex items-center gap-2 font-normal text-sm">
          <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} aria-label={`Enable ${kind}`} />
          Enabled
        </label>
      }
    >
      <FieldGroup className="grid max-w-2xl gap-4 md:grid-cols-2">
        {enabled ? (
          <>
            <Field>
              <FieldLabel htmlFor={`${kind}-addr`}>Address</FieldLabel>
              <Input id={`${kind}-addr`} value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${kind}-port`}>Port</FieldLabel>
              <Input id={`${kind}-port`} type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${kind}-login`}>Login</FieldLabel>
              <Input id={`${kind}-login`} value={login} onChange={(e) => setLogin(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${kind}-pass`}>Password</FieldLabel>
              <Input
                id={`${kind}-pass`}
                type="password"
                placeholder="Password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <FieldDescription>Not kept in this preview.</FieldDescription>
            </Field>
            {isImap ? (
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <Checkbox checked={ssl} onCheckedChange={(v) => setSsl(v === true)} /> Enable SSL
              </label>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="smtp-domain">Domain</FieldLabel>
                  <Input id="smtp-domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="smtp-enc">Encryption</FieldLabel>
                  <NativeSelect
                    id="smtp-enc"
                    className="w-full"
                    value={encryption}
                    onChange={(e) => setEncryption(e.target.value)}
                  >
                    <NativeSelectOption value="ssl">SSL/TLS</NativeSelectOption>
                    <NativeSelectOption value="starttls">STARTTLS</NativeSelectOption>
                    <NativeSelectOption value="none">None</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="smtp-auth">Authentication</FieldLabel>
                  <NativeSelect
                    id="smtp-auth"
                    className="w-full"
                    value={authentication}
                    onChange={(e) => setAuthentication(e.target.value)}
                  >
                    <NativeSelectOption value="plain">Plain</NativeSelectOption>
                    <NativeSelectOption value="login">Login</NativeSelectOption>
                    <NativeSelectOption value="cram-md5">CRAM-MD5</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </>
            )}
          </>
        ) : null}
        <div className="md:col-span-2">
          <Button size="sm" type="button" onClick={save}>
            Update {kind} settings
          </Button>
        </div>
      </FieldGroup>
    </Section>
  );
}

export function EmailConfiguration({ inbox }: { inbox: Inbox }) {
  return (
    <>
      <Section title="Forward to Email" description="Start forwarding your emails to the following email address.">
        <div className="grid gap-2">
          <CopyValue value={`${previewValue(inbox, "forward", 16).toLowerCase()}@inbound.weblabs.studio`} />
          <PreviewNote>
            Preview — simulated: an address made by this preview for this inbox. No mail server receives at it yet.
          </PreviewNote>
        </div>
      </Section>
      <ServerSettings kind="IMAP" inbox={inbox} />
      <ServerSettings kind="SMTP" inbox={inbox} />
    </>
  );
}

// ---------- Account health ----------

function HealthRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "warn" }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">
        {tone ? (
          <Badge
            variant="outline"
            className={
              tone === "good"
                ? "gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "gap-1.5 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }
          >
            <span className={`size-1.5 rounded-full ${tone === "good" ? "bg-emerald-500" : "bg-amber-500"}`} />
            {value}
          </Badge>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

// F-6A (sim2 problem 13: Connected, Quality High, Verified, Live and "Webhook configured successfully" shown as facts):
// Chatwoot's Account Health tab reads these from Meta (AccountHealth.vue, the WhatsApp Business Management API). This
// preview is not connected to Meta, so the tab says that, shows what it really knows (the number and names kept in
// the preview) and marks every Meta value as not checked.
function NotConnectedBanner({ service }: { service: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 text-sm dark:text-amber-300"
      data-preview-note
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>
        Preview — simulated: this inbox is not connected to {service}, so nothing below was read from {service}. Values
        marked "Not checked" come from {service} once the inbox is connected through the engine.
      </span>
    </div>
  );
}

const NOT_CHECKED = "Not checked (not connected)";

export function WhatsappHealthTab({ inbox }: { inbox: Inbox }) {
  return (
    <>
      <Section
        title="Manage your WhatsApp account"
        description="Review your WhatsApp phone number health, messaging capacity, and linked Meta business details."
      >
        <NotConnectedBanner service="Meta" />
      </Section>
      <Section title="Phone number">
        <dl className="grid gap-4 md:grid-cols-3">
          <HealthRow label="Display phone number" value={inbox.identifier} />
          <HealthRow label="Inbox name" value={inbox.name} />
          <HealthRow label="Display name status" value={NOT_CHECKED} tone="warn" />
        </dl>
      </Section>
      <Section title="Health and capacity">
        <dl className="grid gap-4 md:grid-cols-3">
          <HealthRow label="Phone number status" value="Not connected" tone="warn" />
          <HealthRow label="Quality rating" value={NOT_CHECKED} />
          <HealthRow label="Business messaging limit" value={NOT_CHECKED} />
          <HealthRow label="Account mode" value="Preview (sample data)" />
          <HealthRow label="Code verification" value={NOT_CHECKED} />
          <HealthRow label="Throughput" value={NOT_CHECKED} />
        </dl>
      </Section>
      <Section
        title="Webhook Configuration"
        description="Webhook URL is required for your WhatsApp Business Account to receive messages from customers."
      >
        <div className="grid gap-2">
          <span className="flex items-center gap-2 text-amber-600 text-sm dark:text-amber-400">
            <TriangleAlert className="size-4" /> Webhook not registered: the preview is not connected to Meta
          </span>
          <CopyValue value={`${BASE_URL}/webhooks/whatsapp/${inbox.identifier.replace(/\s/g, "")}`} />
          <PreviewNote />
        </div>
      </Section>
    </>
  );
}

// F-6A: the same for Twilio. "Register webhooks" cannot reach Twilio from the preview, and says so.
export function TwilioHealthTab({ inbox }: { inbox: Inbox }) {
  const hooks = ["Messaging webhook", "Voice webhook", "Voice status callback", "Outbound calling (TwiML app)"];
  return (
    <>
      <Section
        title="Manage your Twilio number"
        description="Review the Twilio account, sender and webhooks backing this inbox."
      >
        <div className="grid gap-4">
          <NotConnectedBanner service="Twilio" />
          <dl className="grid gap-4 md:grid-cols-3">
            <HealthRow label="Sender" value={`Phone number · ${inbox.identifier}`} />
            <HealthRow label="Account status" value={NOT_CHECKED} tone="warn" />
            <HealthRow label="Number capabilities" value={NOT_CHECKED} />
          </dl>
        </div>
      </Section>
      <Section
        title="Webhooks"
        description="Twilio calls these URLs when a message or call arrives. Register them again after changing the number or its settings in Twilio."
        action={
          <Button
            size="sm"
            type="button"
            onClick={() =>
              toast.info("Webhooks not registered: this preview is not connected to Twilio", {
                description: "Nothing was sent to Twilio. The engine registers them once the inbox is connected.",
              })
            }
          >
            Register webhooks
          </Button>
        }
      >
        <div className="divide-y rounded-lg border">
          {hooks.map((label) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>{label}</span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="size-4" /> {NOT_CHECKED}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ---------- Voice (Twilio) and Calls (WhatsApp Cloud) ----------

// F-6A: Voice and WhatsApp Calling are saved for this inbox (they said "updated" and kept nothing). The Twilio API
// key secret is not kept, and the message says so.
export function VoiceTab({ inbox }: { inbox: Inbox }) {
  const saved = inboxExtras(inbox).voice ?? {
    enabled: true,
    apiKeySid: "SK8f2c4e6a1b3d5f7091",
    allowIncoming: true,
    record: true,
    transcribe: false,
  };
  const [enabled, setEnabled] = React.useState(saved.enabled);
  const [apiKeySid, setApiKeySid] = React.useState(saved.apiKeySid);
  const [apiSecret, setApiSecret] = React.useState("");
  const [allowIncoming, setAllowIncoming] = React.useState(saved.allowIncoming);
  const [record, setRecord] = React.useState(saved.record);
  const [transcribe, setTranscribe] = React.useState(saved.transcribe);
  const phone = inbox.identifier.replace(/[\s+]/g, "");
  return (
    <>
      <Section
        title="Enable Voice Calling"
        description="Enable voice calling on this inbox. Agents will be able to make and receive phone calls."
        action={
          <label className="flex items-center gap-2 font-normal text-sm">
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => setEnabled(v === true)}
              aria-label="Enable Voice Calling"
            />
            Enabled
          </label>
        }
      />
      {enabled ? (
        <>
          <Section
            title="Twilio API Key"
            description="Voice calling requires Twilio API Key credentials. These are used to generate tokens for agents' browsers."
          >
            <FieldGroup className="grid max-w-2xl gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="v-key">API Key SID</FieldLabel>
                <Input
                  id="v-key"
                  placeholder="Enter your Twilio API Key SID"
                  value={apiKeySid}
                  onChange={(e) => setApiKeySid(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="v-secret">API Key Secret</FieldLabel>
                <Input
                  id="v-secret"
                  type="password"
                  autoComplete="off"
                  placeholder="Enter your Twilio API Key Secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
                <FieldDescription>Not kept in this preview.</FieldDescription>
              </Field>
            </FieldGroup>
          </Section>
          <Section title="Call settings">
            <div className="grid max-w-2xl gap-4">
              <SwitchRow
                label="Allow incoming calls"
                help="Let customers call this number. When turned off, incoming calls are declined automatically."
                checked={allowIncoming}
                onCheckedChange={setAllowIncoming}
              />
              <SwitchRow
                label="Record calls"
                help="Record calls and attach the recording to the conversation. Turn this off where recording calls needs consent."
                checked={record}
                onCheckedChange={setRecord}
              />
              <SwitchRow
                label="Transcribe recordings"
                help="Turn each recording into a text transcript. Uses Captain and requires audio transcription to be on."
                checked={transcribe}
                onCheckedChange={setTranscribe}
              />
            </div>
          </Section>
          <Section
            title="Twilio Voice URL"
            description="Configure this URL as the Voice URL on your Twilio phone number and TwiML App."
          >
            <CopyValue value={`${BASE_URL}/twilio/voice/call/${phone}`} />
          </Section>
          <Section
            title="Twilio Status Callback URL"
            description="Configure this URL as the Status Callback URL on your Twilio phone number."
          >
            <div className="grid gap-2">
              <CopyValue value={`${BASE_URL}/twilio/voice/status/${phone}`} />
              <PreviewNote />
            </div>
          </Section>
        </>
      ) : null}
      <div className="px-6 py-5">
        <Button
          size="sm"
          type="button"
          onClick={() => {
            setApiSecret("");
            void toastInboxSaved(
              saveInboxExtras(inbox.id, {
                voice: { enabled, apiKeySid: apiKeySid.trim(), allowIncoming, record, transcribe },
              }),
              "Inbox settings updated successfully",
              `${SAVED_IN_PREVIEW} The API Key Secret is not kept, and no call is placed through Twilio from the preview.`,
            );
          }}
        >
          Update
        </Button>
      </div>
    </>
  );
}

export function CallsTab({ inbox }: { inbox: Inbox }) {
  const saved = inboxExtras(inbox).calls ?? { enabled: false, permissionMessage: "" };
  const [enabled, setEnabled] = React.useState(saved.enabled);
  const [message, setMessage] = React.useState(saved.permissionMessage);
  return (
    <>
      <Section
        title="Enable WhatsApp Calling"
        description="Allow agents to receive and place WhatsApp Cloud calls on this inbox. Customers can call the business number from WhatsApp."
        action={
          <label className="flex items-center gap-2 font-normal text-sm">
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => setEnabled(v === true)}
              aria-label="Enable WhatsApp Calling"
            />
            Enabled
          </label>
        }
      />
      <Section title="Business phone number" description="WhatsApp number that customers will call.">
        <Input readOnly value={inbox.identifier} className="max-w-xs" />
      </Section>
      <Section
        title="How it works"
        description="Calls are placed peer-to-peer between the agent's browser and Meta — no extra credentials are needed."
      />
      <Section
        title="Call permission request message"
        description="Shown to the contact when they haven't yet consented to receive calls. Leave blank to use the default message."
      >
        <Textarea
          className="max-w-2xl"
          placeholder="We would like to call you regarding your conversation."
          disabled={!enabled}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Section>
      <div className="px-6 py-5">
        <Button
          size="sm"
          type="button"
          onClick={() =>
            toastInboxSaved(
              saveInboxExtras(inbox.id, { calls: { enabled, permissionMessage: message } }),
              "Inbox settings updated successfully",
              `${SAVED_IN_PREVIEW} No call is placed through Meta from the preview.`,
            )
          }
        >
          Update
        </Button>
      </div>
    </>
  );
}

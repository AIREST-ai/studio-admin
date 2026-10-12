"use client";
// Inbox settings parts that depend on the channel, from Chatwoot routes/dashboard/settings/inbox/Settings.vue,
// settingsPage/{CollaboratorsPage,ConfigurationPage,VoiceConfigurationPage,WhatsappCallingPage}.vue,
// components/{AccountHealth,TwilioHealth}.vue, ImapSettings.vue and SmtpSettings.vue. Strings from inboxMgmt.json.
import * as React from "react";

import Link from "next/link";

import { Check, CircleCheck, Copy, ExternalLink, Eye, EyeOff, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import { assignmentPolicies, orderLabel, priorityLabel } from "../../assignment-policy/_components/data";
import { ConfirmDialog } from "../../assignment-policy/_components/policy-ui";
import type { Inbox } from "./data";
import { Section } from "./settings-ui";

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
          onClick={() => {
            void navigator.clipboard?.writeText(value).catch(() => undefined);
            setCopied(true);
            toast.success("Copied to clipboard successfully");
            setTimeout(() => setCopied(false), 1500);
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
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} defaultChecked={defaultChecked} />
      <div className="grid gap-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help ? <FieldDescription>{help}</FieldDescription> : null}
      </div>
    </Field>
  );
}

// ---------- Settings tab additions ----------

/** API channel: Webhook URL + Webhook Secret (WEBSITE_CHANNEL.CHANNEL_WEBHOOK_URL / CHANNEL_WEBHOOK_SECRET). */
export function ApiWebhookFields() {
  const [secret, setSecret] = React.useState("whsec_7d2f9a41c6e8b305");
  return (
    <>
      <Field>
        <FieldLabel htmlFor="api-webhook">Webhook URL</FieldLabel>
        <Input
          id="api-webhook"
          placeholder="Please enter your Webhook URL"
          defaultValue="https://api.weblabs.studio/chatwoot/events"
        />
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
            onClick={() => {
              setSecret(`whsec_${Math.random().toString(16).slice(2, 18)}`);
              toast.success("Webhook secret regenerated successfully");
            }}
          >
            <RefreshCw />
          </Button>
        </div>
      </Field>
    </>
  );
}

/** Website: widget bubble position / type / launcher title. */
export function WidgetBubbleFields() {
  const [position, setPosition] = React.useState("right");
  const [type, setType] = React.useState("standard");
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
          <Input id="launcher-title" placeholder="Chat with us" defaultValue="Chat with us" />
        </Field>
      ) : null}
    </>
  );
}

/** Email and website: how the agent's name appears to the customer (SENDER_NAME_SECTION). */
export function SenderNameSection({ inboxName }: { inboxName: string }) {
  const [type, setType] = React.useState("friendly");
  const [business, setBusiness] = React.useState(inboxName);
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
  const initial = assignmentPolicies.find((p) => p.inboxes.includes(inbox.id));
  const [auto, setAuto] = React.useState(inbox.autoAssign);
  const [policyId, setPolicyId] = React.useState<number | null>(initial?.id ?? null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [limit, setLimit] = React.useState("12");
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
                      onSelect={() => {
                        setPolicyId(p.id);
                        toast.success("Assignment policy linked successfully");
                      }}
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
                <Link href="/dashboard/settings/assignment-policy/assignment/new">Create new policy</Link>
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
            onClick={() => toast.success("Inbox settings updated successfully")}
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
        onConfirm={() => {
          setPolicyId(null);
          toast.success("Assignment policy removed successfully");
        }}
      />
    </Section>
  );
}

// ---------- Configuration tab, per channel ----------

export function HmacSection({ title = "Identity Validation" }: { title?: string }) {
  return (
    <Section
      title={title}
      description="Verify user authenticity by generating secure tokens. This prevents unauthorized users from impersonating others in your chat."
    >
      <div className="grid max-w-2xl gap-4">
        <Field>
          <FieldLabel>Secret Key</FieldLabel>
          <CopyValue value="hmac_5e1f0c7b9d2a4836e1f0c7b9" secret />
        </Field>
        <SwitchRow
          label="Enable HMAC verification"
          help="When enabled, users must provide a valid identity token to start conversations. Requests without valid tokens will be rejected."
        />
      </div>
    </Section>
  );
}

export function ApiConfiguration() {
  return (
    <>
      <Section
        title="Inbox Identifier"
        description="Use the `inbox_identifier` token shown here to authentication your API clients."
      >
        <CopyValue value="Zp4kQm8RwT2vXy6NbH3c" />
      </Section>
      <HmacSection title="HMAC Token" />
    </>
  );
}

export function CallbackConfiguration({ kind }: { kind: "twilio" | "line" }) {
  return (
    <Section
      title="Callback URL"
      description={
        kind === "twilio"
          ? "You have to configure the message callback URL in Twilio with the URL mentioned here."
          : "You have to configure the webhook URL in LINE application with the URL mentioned here."
      }
    >
      <CopyValue value={kind === "twilio" ? `${BASE_URL}/twilio/callback` : `${BASE_URL}/webhooks/line/Ld82kQ`} />
    </Section>
  );
}

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
            <CopyValue value="wv_8c1d4f7a2e9b" secret />
          </Field>
        </div>
      </Section>
      <Section title="Message templates" description="Sync the approved WhatsApp templates of this number from Meta.">
        <div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => toast.success("Templates are being synced")}
          >
            <RefreshCw /> Sync templates
          </Button>
        </div>
      </Section>
      <Section title="API key" description="Configure the WhatsApp API key.">
        <div className="grid max-w-md gap-3">
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
                if (apiKey.trim()) toast.success("Inbox settings updated successfully");
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

function ServerSettings({ kind }: { kind: "IMAP" | "SMTP" }) {
  const [enabled, setEnabled] = React.useState(kind === "IMAP");
  const isImap = kind === "IMAP";
  return (
    <Section
      title={isImap ? "IMAP" : "SMTP"}
      description={
        isImap
          ? "Set your IMAP details to fetch emails from your mail server."
          : "Set your SMTP details to send emails from your mail server."
      }
      action={<Switch checked={enabled} onCheckedChange={setEnabled} aria-label={`Enable ${kind}`} />}
    >
      {enabled ? (
        <FieldGroup className="grid max-w-2xl gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${kind}-addr`}>Address</FieldLabel>
            <Input id={`${kind}-addr`} defaultValue={isImap ? "imap.gmail.com" : "smtp.gmail.com"} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${kind}-port`}>Port</FieldLabel>
            <Input id={`${kind}-port`} type="number" defaultValue={isImap ? 993 : 587} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${kind}-login`}>Login</FieldLabel>
            <Input id={`${kind}-login`} defaultValue="support@weblabs.studio" />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${kind}-pass`}>Password</FieldLabel>
            <Input id={`${kind}-pass`} type="password" placeholder="Password" />
          </Field>
          {isImap ? (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Switch defaultChecked size="sm" /> Enable SSL
            </label>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="smtp-domain">Domain</FieldLabel>
                <Input id="smtp-domain" defaultValue="weblabs.studio" />
              </Field>
              <Field>
                <FieldLabel htmlFor="smtp-enc">Encryption</FieldLabel>
                <NativeSelect id="smtp-enc" className="w-full" defaultValue="starttls">
                  <NativeSelectOption value="ssl">SSL/TLS</NativeSelectOption>
                  <NativeSelectOption value="starttls">STARTTLS</NativeSelectOption>
                  <NativeSelectOption value="none">None</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="smtp-auth">Authentication</FieldLabel>
                <NativeSelect id="smtp-auth" className="w-full" defaultValue="login">
                  <NativeSelectOption value="plain">Plain</NativeSelectOption>
                  <NativeSelectOption value="login">Login</NativeSelectOption>
                  <NativeSelectOption value="cram-md5">CRAM-MD5</NativeSelectOption>
                </NativeSelect>
              </Field>
            </>
          )}
          <div className="md:col-span-2">
            <Button size="sm" type="button" onClick={() => toast.success(`${kind} settings updated successfully`)}>
              Update {kind} settings
            </Button>
          </div>
        </FieldGroup>
      ) : null}
    </Section>
  );
}

export function EmailConfiguration() {
  return (
    <>
      <Section title="Forward to Email" description="Start forwarding your emails to the following email address.">
        <CopyValue value="d7f3a9c1e2b84f60@inbound.weblabs.studio" />
      </Section>
      <ServerSettings kind="IMAP" />
      <ServerSettings kind="SMTP" />
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

export function WhatsappHealthTab({ inbox }: { inbox: Inbox }) {
  return (
    <>
      <Section
        title="Manage your WhatsApp account"
        description="Review your WhatsApp phone number health, messaging capacity, and linked Meta business details."
        action={
          <Button size="sm" variant="outline" type="button">
            Go to Meta Business Manager <ExternalLink />
          </Button>
        }
      />
      <Section title="Business profile">
        <dl className="grid gap-4 md:grid-cols-2">
          <HealthRow label="Description" value="Design and development studio in Doha. We reply within minutes." />
          <HealthRow label="Address" value="West Bay, Doha, Qatar" />
          <HealthRow label="Email" value="support@weblabs.studio" />
          <HealthRow label="Websites" value="https://weblabs.studio" />
        </dl>
      </Section>
      <Section title="Phone number">
        <dl className="grid gap-4 md:grid-cols-3">
          <HealthRow label="Display phone number" value={inbox.identifier} />
          <HealthRow label="WhatsApp display name" value="Weblabs Studio" />
          <HealthRow label="Phone number ID" value={<span className="font-mono text-xs">109384756201938</span>} />
          <HealthRow label="Display name status" value="Approved" tone="good" />
          <HealthRow label="Coexistence" value="Disabled" />
          <HealthRow label="Last onboarded" value="12 Aug 2026, 10:42 AM" />
        </dl>
      </Section>
      <Section title="Health and capacity">
        <dl className="grid gap-4 md:grid-cols-3">
          <HealthRow label="Phone number status" value="Connected" tone="good" />
          <HealthRow label="Quality rating" value="High" tone="good" />
          <HealthRow label="Business messaging limit" value="1K customers per 24h" />
          <HealthRow label="Account mode" value="Live" />
          <HealthRow label="Code verification" value="Verified" tone="good" />
          <HealthRow label="Throughput" value="Standard" />
        </dl>
      </Section>
      <Section title="Business account">
        <dl className="grid gap-4 md:grid-cols-2">
          <HealthRow label="WhatsApp Business Account name" value="Weblabs Studio" />
          <HealthRow label="WhatsApp Business Account ID" value={<span className="font-mono text-xs">284756109384756</span>} />
          <HealthRow label="Business portfolio name" value="Weblabs Studio W.L.L." />
          <HealthRow label="Business portfolio ID" value={<span className="font-mono text-xs">918273645501928</span>} />
        </dl>
      </Section>
      <Section
        title="Webhook Configuration"
        description="Webhook URL is required for your WhatsApp Business Account to receive messages from customers."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-emerald-600 text-sm dark:text-emerald-400">
            <CircleCheck className="size-4" /> Webhook configured successfully
          </span>
          <CopyValue value={`${BASE_URL}/webhooks/whatsapp/${inbox.identifier.replace(/\s/g, "")}`} />
        </div>
      </Section>
    </>
  );
}

export function TwilioHealthTab({ inbox }: { inbox: Inbox }) {
  const [registered, setRegistered] = React.useState(false);
  const hooks = [
    { label: "Messaging webhook", ok: true },
    { label: "Voice webhook", ok: true },
    { label: "Voice status callback", ok: registered },
    { label: "Outbound calling (TwiML app)", ok: registered },
  ];
  return (
    <>
      <Section
        title="Manage your Twilio number"
        description="Review the Twilio account, sender and webhooks backing this inbox. Anything Chatwoot cannot fix for you is linked to the Twilio Console."
        action={
          <Button size="sm" variant="outline" type="button">
            Go to Twilio Console <ExternalLink />
          </Button>
        }
      >
        <dl className="grid gap-4 md:grid-cols-3">
          <HealthRow label="Twilio account" value="Weblabs Studio" />
          <HealthRow label="Account status" value="Active" tone="good" />
          <HealthRow label="Account type" value="Full" />
          <HealthRow label="Sender" value={`Phone number · ${inbox.identifier}`} />
          <HealthRow label="Number capabilities" value="SMS, Voice" />
          <HealthRow label="Voice calling" value="Enabled" tone="good" />
        </dl>
      </Section>
      <Section
        title="Webhooks"
        description="Twilio calls these URLs when a message or call arrives. Register them again after changing the number or its settings in Twilio."
        action={
          <Button
            size="sm"
            type="button"
            onClick={() => {
              setRegistered(true);
              toast.success("Webhook configured successfully");
            }}
          >
            Register webhooks
          </Button>
        }
      >
        <div className="divide-y rounded-lg border">
          {hooks.map((h) => (
            <div key={h.label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>{h.label}</span>
              {h.ok ? (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CircleCheck className="size-4" /> All checks passed
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-4" /> Webhook not configured
                </span>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ---------- Voice (Twilio) and Calls (WhatsApp Cloud) ----------

export function VoiceTab({ inbox }: { inbox: Inbox }) {
  const [enabled, setEnabled] = React.useState(true);
  const phone = inbox.identifier.replace(/[\s+]/g, "");
  return (
    <>
      <Section
        title="Enable Voice Calling"
        description="Enable voice calling on this inbox. Agents will be able to make and receive phone calls."
        action={<Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable Voice Calling" />}
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
                <Input id="v-key" placeholder="Enter your Twilio API Key SID" defaultValue="SK8f2c4e6a1b3d5f7091" />
              </Field>
              <Field>
                <FieldLabel htmlFor="v-secret">API Key Secret</FieldLabel>
                <Input id="v-secret" type="password" placeholder="Enter your Twilio API Key Secret" />
              </Field>
            </FieldGroup>
          </Section>
          <Section title="Call settings">
            <div className="grid max-w-2xl gap-4">
              <SwitchRow
                label="Allow incoming calls"
                help="Let customers call this number. When turned off, incoming calls are declined automatically."
                defaultChecked
              />
              <SwitchRow
                label="Record calls"
                help="Record calls and attach the recording to the conversation. Turn this off where recording calls needs consent."
                defaultChecked
              />
              <SwitchRow
                label="Transcribe recordings"
                help="Turn each recording into a text transcript. Uses Captain and requires audio transcription to be on."
              />
            </div>
          </Section>
          <Section title="Twilio Voice URL" description="Configure this URL as the Voice URL on your Twilio phone number and TwiML App.">
            <CopyValue value={`${BASE_URL}/twilio/voice/call/${phone}`} />
          </Section>
          <Section
            title="Twilio Status Callback URL"
            description="Configure this URL as the Status Callback URL on your Twilio phone number."
          >
            <CopyValue value={`${BASE_URL}/twilio/voice/status/${phone}`} />
          </Section>
        </>
      ) : null}
      <div className="px-6 py-5">
        <Button size="sm" type="button" onClick={() => toast.success("Inbox settings updated successfully")}>
          Update
        </Button>
      </div>
    </>
  );
}

export function CallsTab({ inbox }: { inbox: Inbox }) {
  const [enabled, setEnabled] = React.useState(false);
  return (
    <>
      <Section
        title="Enable WhatsApp Calling"
        description="Allow agents to receive and place WhatsApp Cloud calls on this inbox. Customers can call the business number from WhatsApp."
        action={<Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable WhatsApp Calling" />}
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
        />
      </Section>
      <div className="px-6 py-5">
        <Button size="sm" type="button" onClick={() => toast.success("Inbox settings updated successfully")}>
          Update
        </Button>
      </div>
    </>
  );
}

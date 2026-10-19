"use client";
// Chatwoot routes/dashboard/settings/inbox/InboxChannels.vue (stepper) + ChannelList.vue + ChannelFactory.vue +
// AddAgents.vue + FinishSetup.vue, in the Studio pattern: breadcrumb, big title, the wizard inside one card.
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Check, ChevronRight, Copy, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { CHANGED_ELSEWHERE } from "@/lib/cw/store";

import { copyText } from "../../_components/copy-text";
import { useAccountName } from "../../account/_components/general-settings-client";
import { PageHeader } from "../../labels/_shared/settings-shell";
import { ChannelForm, type CreatedInbox } from "./channel-forms";
import { type Channel, channels, channelTypeFor, type Inbox } from "./data";
import { PREVIEW_ADDRESS_NOTE, previewValue, widgetScript } from "./inbox-extras";
import { inboxesStore, whenSaved } from "./inboxes-store";
import { AgentMultiSelect, WizardSteps } from "./settings-ui";

// F-9 (sim3 step 3.4b): the account name is the one saved in General Settings, not a fixed "Weblabs Studio".
const stepsFor = (accountName: string) => [
  { title: "Choose Channel", body: `Choose the provider you want to integrate with ${accountName}.` },
  { title: "Create Inbox", body: "Authenticate your account and create an inbox." },
  { title: "Add Agents", body: "Add agents to the created inbox." },
  { title: "Voilà!", body: "You are all set to go!" },
];

function ChannelPicker({ onPick, accountName }: { onPick: (channel: Channel) => void; accountName: string }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="font-medium text-lg">Choose Channel</h2>
        <p className="text-muted-foreground text-sm" data-account-name={accountName}>
          Choose the provider you want to integrate with {accountName}.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <button
              key={channel.key}
              type="button"
              onClick={() => onPick(channel)}
              className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted/50">
                <Icon className="size-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="flex items-center gap-2 font-medium text-sm">
                  {channel.title}
                  {channel.beta ? (
                    <Badge variant="outline" className="px-1.5 py-0 font-normal text-[10px]">
                      Beta
                    </Badge>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs leading-relaxed">{channel.description}</span>
              </div>
              <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// F-6B (sim2 problem 6): a wizard step moves on only after the preview server saved it; a refused save is said here.
function SaveFailed({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm"
    >
      Not saved: {error}
    </p>
  );
}

function AgentsStep({
  onNext,
  saving,
  saveError,
}: {
  onNext: (agents: number[]) => void;
  saving: boolean;
  saveError: string | null;
}) {
  const [value, setValue] = React.useState<number[]>([1]);
  const [submitted, setSubmitted] = React.useState(false);
  const error = submitted && value.length === 0;
  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-2">
        <h2 className="font-medium text-lg">Agents</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Here you can add agents to manage your newly created inbox. Only these selected agents will have access to
          your inbox. Agents which are not part of this inbox will not be able to see or respond to messages in this
          inbox when they login.
        </p>
        <p className="text-muted-foreground text-sm">
          <b className="text-foreground">PS:</b> As an administrator, if you need access to all inboxes, you should add
          yourself as agent to all inboxes that you create.
        </p>
      </div>
      <Field data-invalid={error || undefined}>
        <FieldLabel>Agents</FieldLabel>
        <AgentMultiSelect value={value} onChange={setValue} />
        {error ? <FieldError>Add at least one agent to your new Inbox</FieldError> : null}
      </Field>
      <SaveFailed error={saveError} />
      <div>
        <Button
          disabled={saving}
          onClick={() => {
            setSubmitted(true);
            if (value.length) onNext(value);
          }}
        >
          {saving ? "Saving…" : "Add agents"}
        </Button>
      </div>
    </div>
  );
}

function CopyRow({ label, value, help }: { label: string; value: string; help?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="grid w-full gap-1.5 text-left">
      <span className="font-medium text-sm">{label}</span>
      {help ? <span className="text-muted-foreground text-xs">{help}</span> : null}
      <InputGroup>
        <InputGroupInput readOnly value={value} className="font-mono text-xs" />
        <InputGroupAddon align="inline-end">
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
    </div>
  );
}

const BASE_URL = "https://chat.weblabs.studio";

// F-6A (sim2 problem 14): the finish step showed one fixed widget token for every website inbox and a drawn "QR code"
// that held nothing. Now the script is this inbox's own (the one its Configuration tab shows), the QR code is a real
// one of the link Chatwoot's FinishSetup.vue puts in it (wa.me / sms: for a number), drawn by the preview server, and
// where the link needs the channel's own data (a Messenger page, a Telegram bot name) the page says why there is none.
// Every address made by the preview says so (PREVIEW_ADDRESS_NOTE).
function qrLink(created: CreatedInbox): { link: string | null; caption: string } | null {
  const c = created.channel;
  const digits = created.phone?.replace(/[^\d]/g, "") ?? "";
  if (c === "whatsapp" || c === "whatsapp_call")
    return digits
      ? { link: `https://wa.me/${digits}`, caption: "Scan the QR code above to quickly test your WhatsApp inbox" }
      : { link: null, caption: "No QR code: this WhatsApp inbox has no phone number in the preview." };
  if (c === "sms")
    return digits
      ? { link: `sms:+${digits}`, caption: "Scan the QR code above to quickly test your SMS inbox" }
      : { link: null, caption: "No QR code: this SMS inbox has no phone number in the preview." };
  if (c === "facebook")
    return {
      link: null,
      caption: "No QR code: the Messenger link needs the Facebook page, which the preview does not read from Meta.",
    };
  if (c === "telegram")
    return {
      link: null,
      caption: "No QR code: the Telegram link needs the bot's username, which the preview does not read from Telegram.",
    };
  return null;
}

function FinishStep({ created, inboxId }: { created: CreatedInbox; inboxId: number }) {
  const [copied, setCopied] = React.useState(false);
  const self = { id: inboxId, slug: `inbox-${inboxId}` };
  const script = widgetScript(self);
  const c = created.channel;
  const qr = qrLink(created);
  return (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-5 py-6 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary/10">
        <PartyPopper className="size-7 text-primary" />
      </div>
      <div className="grid gap-2">
        <h2 className="font-semibold text-xl">Your Inbox is ready!</h2>
        {created.phone ? (
          <p className="font-mono text-emerald-500 text-sm" data-testid="finish-phone-number">
            Connected Number: {created.phone}
          </p>
        ) : null}
        <p className="text-muted-foreground text-sm leading-relaxed">
          {c === "website"
            ? "You have successfully finished creating a website channel. Copy the code shown below and paste it on your website. Next time a customer use the live chat, the conversation will automatically appear on your inbox."
            : c === "email" && created.provider === "other"
              ? "Your email inbox has been created successfully! You can start forwarding your emails to the address below, or configure SMTP and IMAP credentials to send and receive emails directly."
              : created.provider === "whatsapp_cloud"
                ? "You can now engage with your customers through your new Channel. Happy supporting. You have to configure the webhook URL and the verification token in the Facebook Developer portal with the values shown below."
                : "You can now engage with your customers through your new Channel. Happy supporting"}
        </p>
        <p className="text-muted-foreground text-xs" data-preview-note>
          Preview — simulated: the inbox is saved in this preview. No message reaches it from the channel until the
          inbox is connected through the engine.
        </p>
      </div>

      {c === "website" ? (
        <div className="relative w-full rounded-lg border bg-muted/40 text-left">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy"
            className="absolute top-2 right-2"
            onClick={async () => {
              if (await copyText(script, "Copied to clipboard successfully")) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed" data-widget-script>
            {script}
          </pre>
          <p className="px-4 pb-3 text-muted-foreground text-xs">{PREVIEW_ADDRESS_NOTE}</p>
        </div>
      ) : null}

      {qr ? (
        <div className="grid justify-items-center gap-2" data-finish-qr={qr.link ? "real" : "none"}>
          {qr.link ? (
            // biome-ignore lint/performance/noImgElement: an SVG drawn by the preview server (api/settings-preview/qr).
            <img
              src={`/api/settings-preview/qr?text=${encodeURIComponent(qr.link)}`}
              alt={`QR code of ${qr.link}`}
              className="size-40 rounded-lg border bg-white p-1"
            />
          ) : null}
          <span className="text-muted-foreground text-xs">{qr.caption}</span>
        </div>
      ) : null}

      {created.provider === "twilio" && c !== "voice" ? (
        <CopyRow
          label="Callback URL"
          help="Webhooks are configured automatically. If incoming messages do not arrive, use this callback URL in Twilio."
          value={`${BASE_URL}/twilio/callback`}
        />
      ) : null}
      {created.provider === "bandwidth" ? (
        <CopyRow
          label="Callback URL"
          help="You have to configure the message callback URL in Bandwidth with the URL mentioned here."
          value={`${BASE_URL}/webhooks/sms/${created.phone?.replace("+", "") ?? "pending-number"}`}
        />
      ) : null}
      {created.provider === "whatsapp_cloud" || (c === "whatsapp" && created.provider === "embedded") ? (
        <>
          <CopyRow label="Webhook URL" value={`${BASE_URL}/webhooks/whatsapp/${created.phone ?? "pending-number"}`} />
          <CopyRow label="Webhook Verification Token" value={previewValue(self, "wa-verify", 12).toLowerCase()} />
          <p className="text-muted-foreground text-xs">{PREVIEW_ADDRESS_NOTE}</p>
          <Button
            variant="outline"
            onClick={() =>
              toast.info("Webhook setup not retried: this preview is not connected to Meta", {
                description: "Nothing was sent to Meta. The engine sets the webhook up once the inbox is connected.",
              })
            }
          >
            Retry webhook setup
          </Button>
        </>
      ) : null}
      {c === "line" ? (
        <CopyRow
          label="Callback URL"
          help="You have to configure the webhook URL in LINE application with the URL mentioned here."
          value={`${BASE_URL}/webhooks/line/${previewValue(self, "line", 6)}`}
        />
      ) : null}
      {c === "email" && created.provider === "other" ? (
        <>
          <CopyRow
            label="Forward emails to this address:"
            value={`${previewValue(self, "forward", 16).toLowerCase()}@inbound.weblabs.studio`}
          />
          <p className="text-muted-foreground text-xs">{PREVIEW_ADDRESS_NOTE}</p>
          <p className="text-muted-foreground text-sm">
            <Link href={`/dashboard/settings/inboxes/${inboxId}?tab=configuration`} className="text-primary underline">
              Click here
            </Link>{" "}
            to configure IMAP and SMTP settings
          </p>
        </>
      ) : null}
      {c === "voice" ? (
        <>
          <CopyRow
            label="Twilio Voice URL"
            help="Configure this URL as the Voice URL on your Twilio phone number and TwiML App."
            value={`${BASE_URL}/twilio/voice/call/${created.phone?.replace("+", "") ?? ""}`}
          />
          <CopyRow
            label="Twilio Status Callback URL"
            help="Configure this URL as the Status Callback URL on your Twilio phone number."
            value={`${BASE_URL}/twilio/voice/status/${created.phone?.replace("+", "") ?? ""}`}
          />
        </>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/settings/inboxes/${inboxId}`}>More settings</Link>
        </Button>
        <Button asChild>
          <Link href={`/dashboard/chat/channels/inbox-${inboxId}`}>Take me there</Link>
        </Button>
      </div>
    </div>
  );
}

export function AddInboxWizard() {
  const accountName = useAccountName();
  const [step, setStep] = React.useState(0);
  const [channel, setChannel] = React.useState<Channel | null>(null);
  const [created, setCreated] = React.useState<CreatedInbox | null>(null);
  const [inboxId, setInboxId] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // F-6B: change the shared inboxes, wait for the preview server to save them, then move on. A refused save keeps the
  // step open and says why; the page then holds the saved inboxes (lib/cw/store.ts), so trying again can work.
  const saveThen = (change: () => void, undo: (error: Error) => void, next: () => void) => {
    setSaving(true);
    setSaveError(null);
    const saved = whenSaved();
    change();
    saved.then(
      () => {
        setSaving(false);
        next();
      },
      (error: Error) => {
        undo(error);
        setSaving(false);
        setSaveError(error.message);
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-muted-foreground text-sm">
        <Link href="/dashboard/settings/inboxes" className="hover:text-foreground">
          Inboxes
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Add Inbox</span>
      </nav>
      <PageHeader
        title="Add Inbox"
        description="A channel is the mode of communication your customer chooses to interact with you. An inbox is where you manage interactions for a specific channel."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings/inboxes">Cancel</Link>
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-b p-4 lg:border-e lg:border-b-0">
            <WizardSteps steps={stepsFor(accountName)} current={step} />
          </aside>
          <div className="min-w-0 p-6">
            {step === 0 ? (
              <ChannelPicker
                accountName={accountName}
                onPick={(c) => {
                  setChannel(c);
                  setStep(1);
                }}
              />
            ) : null}
            {step === 1 && channel ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null);
                    setStep(0);
                  }}
                  className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> Choose Channel
                </button>
                <ChannelForm
                  key={channel.key}
                  channel={channel}
                  onCreate={(result) => {
                    if (saving) return;
                    const id = inboxesStore.nextId();
                    if (
                      result.channel === "facebook" ||
                      result.channel === "instagram" ||
                      (result.channel === "whatsapp" && result.provider === "embedded")
                    ) {
                      setInboxId(id);
                      setCreated({ ...result, channelParams: undefined });
                      setStep(result.channel === "whatsapp" && result.provider === "embedded" ? 3 : 2);
                      return;
                    }
                    // F161: the new inbox goes into the shared inboxes store, so it is listed and "More settings"
                    // opens it.
                    const provider: Inbox["provider"] =
                      result.provider === "twilio" || result.provider === "whatsapp_cloud"
                        ? result.provider
                        : undefined;
                    saveThen(
                      () =>
                        inboxesStore.save({
                          id,
                          slug: `inbox-${id}`,
                          name: result.name,
                          channel: result.channel,
                          channelType: channelTypeFor(result.channel),
                          identifier: result.identifier || result.phone || result.name,
                          agents: [],
                          autoAssign: true,
                          provider,
                          // F-6A: the API channel's Webhook URL as typed (inbox-extras.ts). No bot is chosen.
                          ...(result.webhookUrl ? { config: { extras: { webhookUrl: result.webhookUrl } } } : {}),
                          ...(result.channelParams ? { channelParams: { ...result.channelParams } } : {}),
                        } as Inbox),
                      // Not saved: the inbox is not listed as if it were (a 409 already put the saved inboxes back).
                      (error) => {
                        if (result.channelParams) {
                          delete result.channelParams;
                        }
                        const pending = inboxesStore.find(id) as
                          | (Inbox & { channelParams?: Record<string, unknown> })
                          | undefined;
                        if (pending?.channelParams) {
                          delete pending.channelParams;
                        }
                        if (error.message !== CHANGED_ELSEWHERE && pending?.name === result.name) {
                          inboxesStore.remove(id);
                        }
                      },
                      () => {
                        if (result.channelParams) {
                          delete result.channelParams;
                        }
                        const savedInbox = (inboxesStore.find(id) ??
                          inboxesStore.get().find((x) => x.name === result.name && x.channel === result.channel) ??
                          inboxesStore.get().at(-1)) as
                          | (Inbox & { channelParams?: Record<string, unknown> })
                          | undefined;
                        if (savedInbox?.channelParams) {
                          delete savedInbox.channelParams;
                        }
                        setInboxId(savedInbox?.id ?? id);
                        setCreated({ ...result, channelParams: undefined });
                        setStep(2);
                      },
                    );
                  }}
                />
                {saving ? <p className="mt-4 text-muted-foreground text-sm">Saving the inbox…</p> : null}
                <div className="mt-4">
                  <SaveFailed error={saveError} />
                </div>
              </div>
            ) : null}
            {step === 2 ? (
              <AgentsStep
                saving={saving}
                saveError={saveError}
                onNext={(agents) => {
                  if (inboxId === null || saving) return;
                  if (
                    created &&
                    (created.channel === "facebook" ||
                      created.channel === "instagram" ||
                      (created.channel === "whatsapp" && created.provider === "embedded"))
                  ) {
                    setStep(3);
                    return;
                  }
                  saveThen(
                    () => inboxesStore.update(inboxId, { agents }),
                    () => undefined,
                    () => setStep(3),
                  );
                }}
              />
            ) : null}
            {step === 3 && created && inboxId !== null ? <FinishStep created={created} inboxId={inboxId} /> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

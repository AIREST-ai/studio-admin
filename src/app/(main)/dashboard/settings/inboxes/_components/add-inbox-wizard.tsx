"use client";
// Chatwoot routes/dashboard/settings/inbox/InboxChannels.vue (stepper) + ChannelList.vue + ChannelFactory.vue +
// AddAgents.vue + FinishSetup.vue, in the Studio pattern: breadcrumb, big title, the wizard inside one card.
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Check, ChevronRight, Copy, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

import { PageHeader } from "../../labels/_shared/settings-shell";
import { ChannelForm, type CreatedInbox, FakeQr } from "./channel-forms";
import { type Channel, channelFor, channels } from "./data";
import { AgentMultiSelect, WizardSteps } from "./settings-ui";

const steps = [
  { title: "Choose Channel", body: "Choose the provider you want to integrate with Weblabs Studio." },
  { title: "Create Inbox", body: "Authenticate your account and create an inbox." },
  { title: "Add Agents", body: "Add agents to the created inbox." },
  { title: "Voilà!", body: "You are all set to go!" },
];

function ChannelPicker({ onPick }: { onPick: (channel: Channel) => void }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="font-medium text-lg">Choose Channel</h2>
        <p className="text-muted-foreground text-sm">Choose the provider you want to integrate with Weblabs Studio.</p>
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
                <span className="font-medium text-sm">{channel.title}</span>
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

function AgentsStep({ onNext }: { onNext: () => void }) {
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
        {error ? <FieldError>Please pick at least one agent</FieldError> : null}
      </Field>
      <div>
        <Button
          onClick={() => {
            setSubmitted(true);
            if (value.length) onNext();
          }}
        >
          Add agents
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
    </div>
  );
}

const BASE_URL = "https://chat.weblabs.studio";

function FinishStep({ created }: { created: CreatedInbox }) {
  const [copied, setCopied] = React.useState(false);
  const script = `<script>
  (function(d,t) {
    var BASE_URL="${BASE_URL}";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.weblabsSDK.run({ websiteToken: 'xK9m2TqP4vRw', baseUrl: BASE_URL })
    }
  })(document,"script");
</script>`;
  const c = created.channel;
  const qr =
    c === "whatsapp" || c === "whatsapp_call"
      ? "Scan the QR code above to quickly test your WhatsApp inbox"
      : c === "sms"
        ? "Scan the QR code above to quickly test your SMS inbox"
        : c === "facebook"
          ? "Scan the QR code above to quickly test your Facebook Messenger inbox"
          : c === "telegram"
            ? "Scan the QR code above to quickly test your Telegram inbox"
            : "";
  return (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-5 py-6 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary/10">
        <PartyPopper className="size-7 text-primary" />
      </div>
      <div className="grid gap-2">
        <h2 className="font-semibold text-xl">Your Inbox is ready!</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {c === "website"
            ? "You have successfully finished creating a website channel. Copy the code shown below and paste it on your website. Next time a customer use the live chat, the conversation will automatically appear on your inbox."
            : c === "email" && created.provider === "other"
              ? "Your email inbox has been created successfully! You can start forwarding your emails to the address below, or configure IMAP and SMTP settings."
              : "You can now engage with your customers through your new Channel. Happy supporting"}
        </p>
      </div>

      {c === "website" ? (
        <div className="relative w-full rounded-lg border bg-muted/40 text-left">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy"
            className="absolute top-2 right-2"
            onClick={() => {
              void navigator.clipboard?.writeText(script).catch(() => undefined);
              setCopied(true);
              toast.success("Copied to clipboard successfully");
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">{script}</pre>
        </div>
      ) : null}

      {qr ? (
        <div className="grid justify-items-center gap-2">
          <FakeQr seed={created.name} className="size-40 border p-1" />
          <span className="text-muted-foreground text-xs">{qr}</span>
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
          value={`${BASE_URL}/webhooks/sms/${created.phone?.replace("+", "") ?? "97444001144"}`}
        />
      ) : null}
      {created.provider === "whatsapp_cloud" ? (
        <CopyRow label="Webhook URL" value={`${BASE_URL}/webhooks/whatsapp/${created.phone ?? "+97444001122"}`} />
      ) : null}
      {c === "line" ? (
        <CopyRow
          label="Callback URL"
          help="You have to configure the webhook URL in LINE application with the URL mentioned here."
          value={`${BASE_URL}/webhooks/line/Ld82kQ`}
        />
      ) : null}
      {c === "email" && created.provider === "other" ? (
        <CopyRow label="Forward emails to this address:" value="d7f3a9c1e2b84f60@inbound.weblabs.studio" />
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
          <Link href={`/dashboard/settings/inboxes/${c === "website" ? 2 : c === "whatsapp" ? 3 : 1}`}>More settings</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard/chat">Take me there</Link>
        </Button>
      </div>
    </div>
  );
}

export function AddInboxWizard() {
  const [step, setStep] = React.useState(0);
  const [channel, setChannel] = React.useState<Channel | null>(null);
  const [created, setCreated] = React.useState<CreatedInbox | null>(null);

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
            <WizardSteps steps={steps} current={step} />
          </aside>
          <div className="min-w-0 p-6">
            {step === 0 ? (
              <ChannelPicker
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
                  onClick={() => setStep(0)}
                  className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> Choose Channel
                </button>
                <ChannelForm
                  key={channel.key}
                  channel={channel}
                  onCreate={(result) => {
                    setCreated(result);
                    toast.success(`${channelFor(result.channel).title} inbox created`);
                    setStep(2);
                  }}
                />
              </div>
            ) : null}
            {step === 2 ? <AgentsStep onNext={() => setStep(3)} /> : null}
            {step === 3 && created ? <FinishStep created={created} /> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

"use client";
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Check, Copy, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { type Channel, channels } from "./data";
import { AgentMultiSelect, WizardSteps } from "./settings-ui";

const steps = [
  { title: "Choose Channel", body: "Choose the provider you want to integrate with Chatwoot." },
  { title: "Create Inbox", body: "Authenticate your account and create an inbox." },
  { title: "Add Agents", body: "Add agents to the created inbox." },
  { title: "Voilà!", body: "You are all set to go!" },
];

const widgetColors = ["#1F93FF", "#0F766E", "#7C3AED", "#B91C1C", "#8A1538", "#111827"];

function ChannelPicker({ onPick }: { onPick: (channel: Channel) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {channels.map((channel) => {
        const Icon = channel.icon;
        return (
          <button
            key={channel.key}
            type="button"
            onClick={() => onPick(channel)}
            className="group flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <div className="grid size-10 place-items-center rounded-lg border bg-muted/50">
              <Icon className="size-5 text-muted-foreground group-hover:text-primary" />
            </div>
            <div className="grid gap-1">
              <span className="font-medium text-sm">{channel.title}</span>
              <span className="text-muted-foreground text-xs leading-relaxed">{channel.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function WebsiteForm({ channel, onNext }: { channel: Channel; onNext: () => void }) {
  const [color, setColor] = React.useState(widgetColors[0]);
  const [greeting, setGreeting] = React.useState(true);
  const isWebsite = channel.key === "website";
  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h2 className="font-medium text-lg">{isWebsite ? "Website channel" : `${channel.title} channel`}</h2>
        <p className="text-muted-foreground text-sm">
          {isWebsite
            ? "Create a channel for your website and start supporting your customers via our website widget."
            : channel.description}
        </p>
      </div>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="inbox-name">{isWebsite ? "Website Name" : "Inbox Name"}</FieldLabel>
          <Input
            id="inbox-name"
            placeholder={isWebsite ? "Enter your website name (eg: Acme Inc)" : "Enter your inbox name (eg: Acme Inc)"}
            defaultValue={isWebsite ? "Al Rayyan Clinics" : ""}
          />
        </Field>
        {isWebsite ? (
          <>
            <Field>
              <FieldLabel htmlFor="domain">Website Domain</FieldLabel>
              <Input
                id="domain"
                placeholder="Enter your website domain (eg: acme.com)"
                defaultValue="alrayyan-clinics.qa"
              />
            </Field>
            <Field>
              <FieldLabel>Widget Color</FieldLabel>
              <div className="flex gap-2">
                {widgetColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className="grid size-7 place-items-center rounded-md ring-offset-2 ring-offset-background data-[on=true]:ring-2 data-[on=true]:ring-ring"
                    data-on={color === c}
                    style={{ backgroundColor: c }}
                  >
                    {color === c ? <Check className="size-3.5 text-white" /> : null}
                  </button>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="welcome-title">Welcome Heading</FieldLabel>
              <Input id="welcome-title" placeholder="Hi there !" defaultValue="Marhaba! 👋" />
            </Field>
            <Field>
              <FieldLabel htmlFor="welcome-tagline">Welcome Tagline</FieldLabel>
              <Textarea
                id="welcome-tagline"
                placeholder="We make it simple to connect with us. Ask us anything, or share your feedback."
                defaultValue="Book an appointment, ask about our clinics in Doha, or share your feedback."
              />
            </Field>
            <Field orientation="horizontal" className="items-start">
              <Switch id="greeting" checked={greeting} onCheckedChange={setGreeting} />
              <div className="grid gap-1">
                <FieldLabel htmlFor="greeting">Enable channel greeting</FieldLabel>
                <FieldDescription>
                  Auto-send greeting messages when customers start a conversation and send their first message.
                </FieldDescription>
              </div>
            </Field>
            {greeting ? (
              <Field>
                <FieldLabel htmlFor="greeting-message">Channel greeting message</FieldLabel>
                <Input
                  id="greeting-message"
                  placeholder="Acme Inc typically replies in a few hours."
                  defaultValue="Al Rayyan Clinics typically replies in a few minutes."
                />
              </Field>
            ) : null}
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor="provider">API Provider</FieldLabel>
            <NativeSelect id="provider" className="w-full" defaultValue="cloud">
              <option value="cloud">WhatsApp Cloud</option>
              <option value="twilio">Twilio</option>
            </NativeSelect>
          </Field>
        )}
      </FieldGroup>
      <div>
        <Button onClick={onNext}>Create inbox</Button>
      </div>
    </div>
  );
}

function AgentsStep({ onNext }: { onNext: () => void }) {
  const [value, setValue] = React.useState<number[]>([1, 2]);
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
      <Field>
        <FieldLabel>Agents</FieldLabel>
        <AgentMultiSelect value={value} onChange={setValue} />
      </Field>
      <div>
        <Button onClick={onNext} disabled={!value.length}>
          Add agents
        </Button>
      </div>
    </div>
  );
}

function FinishStep() {
  const [copied, setCopied] = React.useState(false);
  const script = `<script>
  (function(d,t) {
    var BASE_URL="https://chat.alrayyan-clinics.qa";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.chatwootSDK.run({ websiteToken: 'xK9m2TqP4vRw', baseUrl: BASE_URL })
    }
  })(document,"script");
</script>`;
  return (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-5 py-6 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary/10">
        <PartyPopper className="size-7 text-primary" />
      </div>
      <div className="grid gap-2">
        <h2 className="font-semibold text-xl">Your Inbox is ready!</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          You have successfully finished creating a website channel. Copy the code shown below and paste it on your
          website. Next time a customer use the live chat, the conversation will automatically appear on your inbox.
        </p>
      </div>
      <div className="relative w-full rounded-lg border bg-muted/40 text-left">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy"
          className="absolute top-2 right-2"
          onClick={() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">{script}</pre>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/dashboard/settings/inboxes/1">More settings</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard/chat">Take me there</Link>
        </Button>
      </div>
    </div>
  );
}

export function AddInbox() {
  const [step, setStep] = React.useState(0);
  const [channel, setChannel] = React.useState<Channel | null>(null);

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="icon-sm" aria-label="Back" asChild>
          <Link href="/dashboard/settings/inboxes">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="font-semibold text-xl leading-none">Inboxes</h1>
      </div>
      <div className="grid md:grid-cols-[260px_1fr]">
        <aside className="border-b p-4 md:border-r md:border-b-0">
          <WizardSteps steps={steps} current={step} />
        </aside>
        <div className="p-6">
          {step === 0 ? (
            <ChannelPicker
              onPick={(c) => {
                setChannel(c);
                setStep(1);
              }}
            />
          ) : null}
          {step === 1 && channel ? <WebsiteForm channel={channel} onNext={() => setStep(2)} /> : null}
          {step === 2 ? <AgentsStep onNext={() => setStep(3)} /> : null}
          {step === 3 ? <FinishStep /> : null}
        </div>
      </div>
    </Card>
  );
}

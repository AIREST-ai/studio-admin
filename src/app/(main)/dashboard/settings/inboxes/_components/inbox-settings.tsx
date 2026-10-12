"use client";
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Check, ChevronRight, ImageUp, Star, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { StatCard } from "../../_components/settings-card";
import { assignmentPolicies, orderLabel } from "../../assignment-policy/_components/data";
import { channelFor, type Inbox } from "./data";
import {
  ApiConfiguration,
  ApiWebhookFields,
  AssignmentSection,
  CallbackConfiguration,
  CallsTab,
  EmailConfiguration,
  HmacSection,
  SenderNameSection,
  TwilioHealthTab,
  VoiceTab,
  WhatsappConfiguration,
  WhatsappHealthTab,
  WidgetBubbleFields,
} from "./inbox-tabs-extra";
import { AgentMultiSelect, Section } from "./settings-ui";

function ToggleRow({ label, help, defaultChecked }: { label: string; help?: string; defaultChecked?: boolean }) {
  const id = React.useId();
  return (
    <Field orientation="horizontal" className="items-start">
      <Switch id={id} defaultChecked={defaultChecked} />
      <div className="grid gap-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help ? <FieldDescription>{help}</FieldDescription> : null}
      </div>
    </Field>
  );
}

const widgetColors = ["#1F93FF", "#0F766E", "#7C3AED", "#B91C1C", "#8A1538", "#111827"];

function SettingsTab({ inbox }: { inbox: Inbox }) {
  const isWebsite = inbox.channel === "website";
  const [color, setColor] = React.useState(widgetColors[0]);
  const [greeting, setGreeting] = React.useState(true);
  const [name, setName] = React.useState(inbox.name);
  const nameError = !name.trim();
  return (
    <>
      <Section title="Inbox settings" description="Update the name, avatar and widget details for this inbox.">
        <FieldGroup className="max-w-2xl gap-4">
          <Field>
            <FieldLabel>Channel Avatar</FieldLabel>
            <div className="flex items-center gap-3">
              {/* F159: the inbox's own initials ("SE" for Support Email) in a colour, not a grey "AR". */}
              <Avatar className={`size-14 rounded-xl font-medium ${personToneClass(inbox.name)}`}>
                <AvatarFallback className="rounded-xl text-base">{getInitials(inbox.name)}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm">
                <ImageUp /> Upload
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Delete Avatar
              </Button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="inbox-name">{isWebsite ? "Website Name" : "Inbox Name"}</FieldLabel>
            <Input
              id="inbox-name"
              value={name}
              aria-invalid={nameError || undefined}
              onChange={(event) => setName(event.target.value)}
              placeholder={isWebsite ? "Enter your website name (eg: Acme Inc)" : "Enter your inbox name (eg: Acme Inc)"}
            />
            {nameError ? <FieldError>This field is required</FieldError> : null}
          </Field>
          {inbox.channel === "api" ? <ApiWebhookFields /> : null}
          {isWebsite ? (
            <>
              <Field>
                <FieldLabel htmlFor="domain">Website Domain</FieldLabel>
                <Input id="domain" defaultValue={inbox.identifier} placeholder="Enter your website domain (eg: acme.com)" />
              </Field>
              <Field>
                <FieldLabel>Widget Color</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
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
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="ms-2 size-7 cursor-pointer rounded border bg-transparent"
                    aria-label="Update the widget color used in widget"
                  />
                </div>
              </Field>
              <WidgetBubbleFields />
              <Field>
                <FieldLabel htmlFor="welcome">Welcome Heading</FieldLabel>
                <Input id="welcome" defaultValue="Marhaba! 👋" placeholder="Hi there !" />
              </Field>
              <Field>
                <FieldLabel htmlFor="tagline">Welcome Tagline</FieldLabel>
                <Textarea
                  id="tagline"
                  defaultValue="Ask about your project, billing or our API, or share your feedback."
                  placeholder="We make it simple to connect with us. Ask us anything, or share your feedback."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reply-time">Set Reply time</FieldLabel>
                <NativeSelect id="reply-time" className="w-full" defaultValue="minutes">
                  <option value="minutes">In a few minutes</option>
                  <option value="hours">In a few hours</option>
                  <option value="day">In a day</option>
                </NativeSelect>
                <FieldDescription>This reply time will be displayed on the live chat widget</FieldDescription>
              </Field>
            </>
          ) : null}
          <Field>
            <FieldLabel htmlFor="help-center">Help Center</FieldLabel>
            <NativeSelect id="help-center" className="w-full" defaultValue="docs">
              <option value="">None</option>
              <option value="docs">Weblabs Studio Help Center</option>
              <option value="api">Weblabs Developer Docs</option>
            </NativeSelect>
            <FieldDescription>Attach a Help Center with the inbox</FieldDescription>
          </Field>
        </FieldGroup>
      </Section>
      <Section title="Channel Preferences">
        <div className="grid max-w-2xl gap-4">
          <Field orientation="horizontal" className="items-start">
            <Switch id="greeting-toggle" checked={greeting} onCheckedChange={setGreeting} />
            <div className="grid gap-1">
              <FieldLabel htmlFor="greeting-toggle">Enable channel greeting</FieldLabel>
              <FieldDescription>
                Auto-send greeting messages when customers start a conversation and send their first message.
              </FieldDescription>
            </div>
          </Field>
          {greeting ? (
            <Field>
              <FieldLabel htmlFor="greeting-message">Channel greeting message</FieldLabel>
              <Textarea
                id="greeting-message"
                placeholder="Acme Inc typically replies in a few hours."
                defaultValue="Thanks for writing to Weblabs Studio. We typically reply in a few minutes."
              />
            </Field>
          ) : null}
          {isWebsite ? (
            <ToggleRow
              label="Enable email collect box"
              help="Enable or disable email collect box on new conversation"
              defaultChecked
            />
          ) : null}
          <ToggleRow
            label="Allow messages after conversation resolved"
            help="Allow the end-users to send messages even after the conversation is resolved."
            defaultChecked
          />
          <ToggleRow
            label="Enable conversation continuity via email"
            help="Conversations will continue over email if the contact email address is available."
          />
          {isWebsite ? null : (
            <ToggleRow
              label="Lock to single conversation"
              help="Enable or disable multiple conversations for the same contact in this inbox"
            />
          )}
        </div>
      </Section>
      {isWebsite || inbox.channel === "email" ? <SenderNameSection inboxName={inbox.name} /> : null}
      {isWebsite ? (
        <Section title="Widget features">
          <div className="grid gap-3">
            {[
              "Display file picker on the widget",
              "Display emoji picker on the widget",
              "Allow users to end conversation from the widget",
              "Use inbox name and avatar for the bot",
            ].map((label, i) => (
              <label key={label} className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked={i < 3} /> {label}
              </label>
            ))}
          </div>
        </Section>
      ) : null}
      <div className="px-6 py-5">
        <Button
          size="sm"
          disabled={nameError}
          onClick={() => toast.success("Inbox settings updated successfully")}
        >
          Update
        </Button>
      </div>
    </>
  );
}

function CollaboratorsTab({ inbox }: { inbox: Inbox }) {
  const [value, setValue] = React.useState(inbox.agents);
  return (
    <>
      <Section title="Agents" description="Add or remove agents from this inbox">
        <div className="grid max-w-2xl gap-3">
          <AgentMultiSelect value={value} onChange={setValue} />
          {value.length === 0 ? <FieldError>Please pick at least one agent</FieldError> : null}
          <div>
            <Button
              size="sm"
              disabled={value.length === 0}
              onClick={() => toast.success("Agents updated successfully")}
            >
              Update
            </Button>
          </div>
        </div>
      </Section>
      <AssignmentSection inbox={inbox} />
    </>
  );
}

function ConfigurationTab({ inbox }: { inbox: Inbox }) {
  if (inbox.channel === "website") {
    return (
      <>
        <Section title="Messenger Script" description="Place this button inside your body tag">
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">{`<script>
  (function(d,t) {
    var BASE_URL="https://chat.weblabs.studio";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js"; g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){ window.chatwootSDK.run({ websiteToken: 'xK9m2TqP4vRw', baseUrl: BASE_URL }) }
  })(document,"script");
</script>`}</pre>
        </Section>
        <Section
          title="Allowed Domains"
          description="Restrict which websites can embed your chat widget. For security, only add domains you own and trust. Add one or more domains separated by commas. Leave blank to allow all domains (not recommended for production)."
        >
          <div className="grid max-w-2xl gap-4">
            <Input
              placeholder="example.com, www.example.com, app.example.com"
              defaultValue="weblabs.studio, www.weblabs.studio"
            />
            <ToggleRow
              label="Enable widget in mobile apps"
              help="Check this if you embed the widget in iOS or Android apps. Mobile apps don't send domain information, so they would be blocked by domain restrictions unless this is enabled."
            />
            <div>
              <Button size="sm">Update</Button>
            </div>
          </div>
        </Section>
        <HmacSection />
      </>
    );
  }
  if (inbox.channel === "email") return <EmailConfiguration />;
  if (inbox.channel === "api") return <ApiConfiguration />;
  if (inbox.channel === "line") return <CallbackConfiguration kind="line" />;
  if (inbox.provider === "whatsapp_cloud") return <WhatsappConfiguration inbox={inbox} />;
  if (inbox.provider === "twilio") return <CallbackConfiguration kind="twilio" />;
  return null;
}

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function DayRow({ day }: { day: string }) {
  const [on, setOn] = React.useState(day !== "Friday");
  const [allDay, setAllDay] = React.useState(false);
  const short = day === "Saturday";
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      <label className="flex w-36 items-center gap-2 text-sm">
        <Checkbox checked={on} onCheckedChange={(c) => setOn(c === true)} aria-label={`Enable availability for ${day}`} />
        {day}
      </label>
      {!on ? (
        <span className="text-muted-foreground text-sm">Unavailable</span>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {allDay ? (
            <span className="w-[15.5rem] text-muted-foreground">Open all day</span>
          ) : (
            <>
              <Input type="time" aria-label="From" defaultValue={short ? "10:00" : "08:00"} className="h-8 w-28" />
              <span className="text-muted-foreground">-</span>
              <Input type="time" aria-label="To" defaultValue={short ? "18:00" : "21:00"} className="h-8 w-28" />
            </>
          )}
          <label className="ml-2 flex items-center gap-2 text-muted-foreground">
            <Checkbox checked={allDay} onCheckedChange={(c) => setAllDay(c === true)} /> All-Day
          </label>
        </div>
      )}
    </div>
  );
}

function BusinessHoursTab() {
  const [enabled, setEnabled] = React.useState(true);
  return (
    <Section title="Set your availability" description="Set your availability on your livechat widget">
      <div className="grid max-w-3xl gap-5">
        <Field orientation="horizontal" className="items-start">
          <Switch id="bh" checked={enabled} onCheckedChange={setEnabled} />
          <div className="grid gap-1">
            <FieldLabel htmlFor="bh">Enable business availability for this inbox</FieldLabel>
            <FieldDescription>
              Enabling business availability will show the available hours on live chat widget even if all the agents
              are offline. Outside available hours visitors can be warned with a message and a pre-chat form.
            </FieldDescription>
          </div>
        </Field>
        {enabled ? (
          <>
            <Field>
              <FieldLabel htmlFor="unavailable">Unavailable message for visitors</FieldLabel>
              <Textarea
                id="unavailable"
                defaultValue="We are away right now. Our team is online Sunday to Thursday, 8 AM to 9 PM (Doha time)."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tz">Select timezone</FieldLabel>
              <NativeSelect id="tz" className="w-full" defaultValue="Asia/Qatar">
                <option value="Asia/Qatar">(GMT+03:00) Doha</option>
                <option value="Asia/Riyadh">(GMT+03:00) Riyadh</option>
                <option value="Asia/Dubai">(GMT+04:00) Dubai</option>
              </NativeSelect>
            </Field>
            <div className="grid gap-2">
              <span className="font-medium text-sm">Set your weekly hours</span>
              <div className="divide-y rounded-lg border">
                {days.map((day) => (
                  <DayRow key={day} day={day} />
                ))}
              </div>
            </div>
          </>
        ) : null}
        <div>
          <Button size="sm" onClick={() => toast.success("Business hours updated successfully")}>
            Update business hours settings
          </Button>
        </div>
      </div>
    </Section>
  );
}

const csatLabels = ["vip", "billing", "lead", "partner", "support"];

function CsatTab() {
  const [enabled, setEnabled] = React.useState(true);
  const [display, setDisplay] = React.useState("emoji");
  const [message, setMessage] = React.useState("Thank you for contacting Weblabs Studio. How was your experience today?");
  const [buttonText, setButtonText] = React.useState("Rate us");
  const [ruleLabels, setRuleLabels] = React.useState(["support", "billing"]);
  return (
    <Section
      title="Enable CSAT"
      description="Automatically trigger CSAT surveys at the end of conversations to understand how customers feel about their support experience. Track satisfaction trends and identify areas for improvement over time."
      action={<Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable CSAT" />}
    >
      {enabled ? (
        <div className="grid max-w-2xl gap-5">
          <Field>
            <FieldLabel>Display type</FieldLabel>
            <RadioGroup value={display} onValueChange={setDisplay} className="grid grid-cols-2 gap-3">
              {[
                { value: "emoji", label: "😞 😕 😐 🙂 😍" },
                { value: "star", label: "Stars" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary"
                >
                  <RadioGroupItem value={opt.value} />
                  {opt.value === "star" ? (
                    <span className="flex gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className="size-4 fill-current" />
                      ))}
                    </span>
                  ) : (
                    <span className="text-lg">{opt.label}</span>
                  )}
                </label>
              ))}
            </RadioGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="csat-msg">Message</FieldLabel>
            <Textarea
              id="csat-msg"
              placeholder="Please enter a message to show users with the form"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="csat-button">Button text</FieldLabel>
              <Input id="csat-button" value={buttonText} onChange={(event) => setButtonText(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="csat-lang">Language</FieldLabel>
              <NativeSelect id="csat-lang" className="w-full" defaultValue="en">
                <option value="en">English (en)</option>
                <option value="ar">العربية (ar)</option>
                <option value="fr">Français (fr)</option>
              </NativeSelect>
            </Field>
          </div>
          <Field>
            <FieldLabel>Message preview</FieldLabel>
            <div className="grid max-w-sm gap-3 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm">{message || "Please rate the conversation"}</p>
              {display === "emoji" ? (
                <div className="flex gap-2 text-2xl">
                  {["😞", "😕", "😐", "🙂", "😍"].map((e) => (
                    <span key={e}>{e}</span>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1 text-amber-500">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="size-5 fill-current" />
                  ))}
                </div>
              )}
              <Button size="sm" variant="secondary" className="w-fit">
                {buttonText || "Rate us"}
              </Button>
            </div>
          </Field>
          <Field>
            <FieldLabel>Survey rule</FieldLabel>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Send the survey if the conversation</span>
              <NativeSelect size="sm" defaultValue="contains">
                <option value="contains">contains</option>
                <option value="not">does not contain</option>
              </NativeSelect>
              <span>any of the labels</span>
              {ruleLabels.map((l) => (
                <Badge key={l} variant="outline" className="gap-1">
                  {l}
                  <button
                    type="button"
                    aria-label={`Remove ${l}`}
                    onClick={() => setRuleLabels((prev) => prev.filter((x) => x !== l))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <NativeSelect
                size="sm"
                aria-label="Add label"
                value=""
                onChange={(event) => event.target.value && setRuleLabels((prev) => [...prev, event.target.value])}
              >
                <option value="">Add label</option>
                {csatLabels
                  .filter((l) => !ruleLabels.includes(l))
                  .map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          </Field>
          <p className="text-muted-foreground text-xs">Note: CSAT surveys are sent only once per conversation</p>
          <div>
            <Button size="sm" onClick={() => toast.success("CSAT settings updated successfully")}>
              Update
            </Button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function PreChatFormTab() {
  const fields = [
    { key: "emailAddress", label: "Email Id", placeholder: "Please enter your email address", type: "email", on: true, req: true },
    { key: "fullName", label: "Full name", placeholder: "Please enter your full name", type: "text", on: true, req: false },
    { key: "phoneNumber", label: "Phone number", placeholder: "Please enter your phone number", type: "text", on: true, req: false },
    { key: "projectType", label: "Project type", placeholder: "Website, mobile app or API", type: "list", on: false, req: false },
  ];
  return (
    <Section
      title="Pre Chat Form"
      description="Pre chat forms enable you to capture user information before they start conversation with you."
    >
      <div className="grid gap-5">
        <Field className="max-w-xs">
          <FieldLabel htmlFor="pcf">Enable pre chat form</FieldLabel>
          <NativeSelect id="pcf" className="w-full" defaultValue="yes">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </NativeSelect>
        </Field>
        <Field className="max-w-2xl">
          <FieldLabel htmlFor="pcm">Pre chat message</FieldLabel>
          <Textarea
            id="pcm"
            placeholder="This message would be visible to the users along with the form"
            defaultValue="Share a few details so we can route you to the right team."
          />
        </Field>
        <div className="grid gap-2">
          <span className="font-medium text-sm">Pre chat form fields</span>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="font-normal">Key</TableHead>
                  <TableHead className="font-normal">Type</TableHead>
                  <TableHead className="font-normal">Required</TableHead>
                  <TableHead className="font-normal">Label</TableHead>
                  <TableHead className="font-normal">Placeholder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((f) => (
                  <TableRow key={f.key}>
                    <TableCell>
                      <Switch size="sm" defaultChecked={f.on} aria-label={f.key} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.key}</TableCell>
                    <TableCell className="text-muted-foreground">{f.type}</TableCell>
                    <TableCell>
                      <Checkbox defaultChecked={f.req} aria-label="Required" />
                    </TableCell>
                    <TableCell>
                      <Input defaultValue={f.label} className="h-7 text-xs" />
                    </TableCell>
                    <TableCell>
                      <Input defaultValue={f.placeholder} className="h-7 text-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div>
          <Button size="sm">Update</Button>
        </div>
      </div>
    </Section>
  );
}

const inboxBots = [
  { id: "2", name: "Order Status Bot" },
  { id: "3", name: "Arabic FAQ Bot" },
  { id: "4", name: "Lead Qualifier" },
];

function BotConfigurationTab({ inbox }: { inbox: Inbox }) {
  const [connected, setConnected] = React.useState(inbox.channel === "website" || inbox.channel === "whatsapp" ? "2" : "");
  const [selected, setSelected] = React.useState(connected);
  return (
    <Section
      title="Select an agent bot"
      description="Assign an Agent Bot to your inbox. They can handle initial conversations and transfer them to a live agent when necessary."
    >
      <div className="grid max-w-md gap-3">
        <NativeSelect className="w-full" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Select bot</option>
          {inboxBots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!selected || selected === connected}
            onClick={() => {
              setConnected(selected);
              toast.success("Successfully updated the agent bot.");
            }}
          >
            Update
          </Button>
          {connected ? (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                setConnected("");
                setSelected("");
                toast.success("Successfully disconnected the agent bot.");
              }}
            >
              Disconnect bot
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

type TabKey = "settings" | "collaborators" | "hours" | "csat" | "prechat" | "configuration" | "bot" | "health" | "twilio-health" | "voice" | "calls";

// Same tabs, same order and same conditions as Chatwoot Settings.vue tabs().
function tabsFor(inbox: Inbox): { value: TabKey; label: string }[] {
  const isWebsite = inbox.channel === "website";
  const isCloud = inbox.provider === "whatsapp_cloud";
  const isTwilioSms = inbox.provider === "twilio" && inbox.channel === "sms";
  const hasConfiguration =
    isWebsite ||
    inbox.provider === "twilio" ||
    inbox.channel === "line" ||
    inbox.channel === "api" ||
    inbox.channel === "email" ||
    isCloud;
  const tabs: { value: TabKey; label: string }[] = [
    { value: "settings", label: "Settings" },
    { value: "collaborators", label: "Collaborators" },
    { value: "hours", label: "Business Hours" },
    { value: "csat", label: "CSAT" },
  ];
  if (isWebsite) tabs.push({ value: "prechat", label: "Pre Chat Form" });
  if (hasConfiguration) tabs.push({ value: "configuration", label: "Configuration" });
  tabs.push({ value: "bot", label: "Bot Configuration" });
  if (isCloud) tabs.push({ value: "health", label: "Account Health" });
  if (isTwilioSms) tabs.push({ value: "twilio-health", label: "Account Health" });
  if (isTwilioSms || inbox.channel === "voice") tabs.push({ value: "voice", label: "Voice" });
  if (isCloud) tabs.push({ value: "calls", label: "Calls" });
  return tabs;
}

export function InboxSettings({ inbox }: { inbox: Inbox }) {
  const channel = channelFor(inbox.channel);
  const Icon = channel.icon;
  const tabs = tabsFor(inbox);
  const [tab, setTab] = React.useState<TabKey>("settings");
  const policy = assignmentPolicies.find((p) => p.inboxes.includes(inbox.id));

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-muted-foreground text-sm">
        <Link href="/dashboard/settings/inboxes" className="hover:text-foreground">
          Inboxes
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{inbox.name}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <Avatar className={`size-14 rounded-xl font-medium ${personToneClass(inbox.name)}`}>
            <AvatarFallback className="rounded-xl text-base">{getInitials(inbox.name)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <h1 className="text-3xl tracking-tight">{inbox.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              <Badge variant="outline" className="gap-1.5 px-2 py-0.5 font-normal">
                <Icon className="size-3" />
                {channel.name}
              </Badge>
              <bdi dir="auto">{inbox.identifier}</bdi>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/inboxes">
            <ArrowLeft /> All inboxes
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agents" value={inbox.agents.length} hint="Agents who can see and answer this inbox" />
        <StatCard
          label="Auto assignment"
          value={inbox.autoAssign ? "On" : "Off"}
          hint={inbox.autoAssign ? "New conversations are assigned automatically" : "Agents pick conversations themselves"}
        />
        <StatCard label="Assignment policy" value={policy?.name ?? "Default"} hint={policy ? orderLabel[policy.order] : "Round robin distribution"} />
        <StatCard label="Channel" value={channel.title} hint={channel.description} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-4">
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList variant="line" className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Card className="gap-0 py-0">
          <TabsContent value="settings">
            <SettingsTab inbox={inbox} />
          </TabsContent>
          <TabsContent value="collaborators">
            <CollaboratorsTab inbox={inbox} />
          </TabsContent>
          <TabsContent value="hours">
            <BusinessHoursTab />
          </TabsContent>
          <TabsContent value="csat">
            <CsatTab />
          </TabsContent>
          <TabsContent value="prechat">
            <PreChatFormTab />
          </TabsContent>
          <TabsContent value="configuration">
            <ConfigurationTab inbox={inbox} />
          </TabsContent>
          <TabsContent value="bot">
            <BotConfigurationTab inbox={inbox} />
          </TabsContent>
          <TabsContent value="health">
            <WhatsappHealthTab inbox={inbox} />
          </TabsContent>
          <TabsContent value="twilio-health">
            <TwilioHealthTab inbox={inbox} />
          </TabsContent>
          <TabsContent value="voice">
            <VoiceTab inbox={inbox} />
          </TabsContent>
          <TabsContent value="calls">
            <CallsTab inbox={inbox} />
          </TabsContent>
        </Card>
      </Tabs>
    </div>
  );
}

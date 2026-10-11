"use client";
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Check, Copy, ImageUp, Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { channelFor, type Inbox } from "./data";
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

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <InputGroup className="max-w-lg">
      <InputGroupInput readOnly value={value} className="font-mono text-xs" />
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
  );
}

function SettingsTab({ inbox }: { inbox: Inbox }) {
  const isWebsite = inbox.channel === "website";
  return (
    <>
      <Section title="Inbox settings" description="Update the name, avatar and widget details for this inbox.">
        <FieldGroup className="max-w-2xl gap-4">
          <Field>
            <FieldLabel>Channel Avatar</FieldLabel>
            <div className="flex items-center gap-3">
              <Avatar className="size-14 rounded-xl">
                <AvatarFallback className="rounded-xl bg-primary/10 font-medium text-primary">AR</AvatarFallback>
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
              defaultValue={inbox.name}
              placeholder={isWebsite ? "Enter your website name (eg: Acme Inc)" : "Enter your inbox name (eg: Acme Inc)"}
            />
          </Field>
          {isWebsite ? (
            <>
              <Field>
                <FieldLabel htmlFor="domain">Website Domain</FieldLabel>
                <Input id="domain" defaultValue={inbox.identifier} placeholder="Enter your website domain (eg: acme.com)" />
              </Field>
              <Field>
                <FieldLabel htmlFor="welcome">Welcome Heading</FieldLabel>
                <Input id="welcome" defaultValue="Marhaba! 👋" placeholder="Hi there !" />
              </Field>
              <Field>
                <FieldLabel htmlFor="tagline">Welcome Tagline</FieldLabel>
                <Textarea
                  id="tagline"
                  defaultValue="Book an appointment, ask about our clinics in Doha, or share your feedback."
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
            <NativeSelect id="help-center" className="w-full" defaultValue="patients">
              <option value="">None</option>
              <option value="patients">Patient Guide (Doha)</option>
              <option value="insurance">Insurance FAQ</option>
            </NativeSelect>
            <FieldDescription>Attach a Help Center with the inbox</FieldDescription>
          </Field>
        </FieldGroup>
      </Section>
      <Section title="Channel Preferences">
        <div className="grid max-w-2xl gap-4">
          <ToggleRow
            label="Enable channel greeting"
            help="Auto-send greeting messages when customers start a conversation and send their first message."
            defaultChecked
          />
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
        </div>
      </Section>
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
        <Button size="sm">Update</Button>
      </div>
    </>
  );
}

function CollaboratorsTab({ inbox }: { inbox: Inbox }) {
  const [value, setValue] = React.useState(inbox.agents);
  const [auto, setAuto] = React.useState(inbox.autoAssign);
  return (
    <>
      <Section title="Agents" description="Add or remove agents from this inbox">
        <div className="grid max-w-2xl gap-3">
          <AgentMultiSelect value={value} onChange={setValue} />
          <div>
            <Button size="sm">Update</Button>
          </div>
        </div>
      </Section>
      <Section
        title="Conversation Assignment"
        description="Automatically assign incoming conversations to available agents based on assignment policies"
      >
        <div className="grid max-w-2xl gap-4">
          <Field orientation="horizontal" className="items-start">
            <Switch id="auto-assign" checked={auto} onCheckedChange={setAuto} />
            <FieldLabel htmlFor="auto-assign">Enable automatic conversation assignment</FieldLabel>
          </Field>
          {auto ? (
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
                <Button variant="outline" size="sm">
                  Link existing policy
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/settings/assignment-policy/assignment/new">Create new policy</Link>
                </Button>
              </div>
            </div>
          ) : null}
          <Field>
            <FieldLabel htmlFor="limit">Auto assignment limit</FieldLabel>
            <Input id="limit" type="number" defaultValue={12} className="max-w-40" />
            <FieldDescription>
              Limit the maximum number of conversations from this inbox that can be auto assigned to an agent
            </FieldDescription>
          </Field>
        </div>
      </Section>
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
    var BASE_URL="https://chat.alrayyan-clinics.qa";
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
              defaultValue="alrayyan-clinics.qa, www.alrayyan-clinics.qa"
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
        <Section
          title="Identity Validation"
          description="Verify user authenticity by generating secure tokens. This prevents unauthorized users from impersonating others in your chat."
        >
          <div className="grid max-w-2xl gap-4">
            <Field>
              <FieldLabel>Secret Key</FieldLabel>
              <CopyField value="••••••••••••••••••••••••" />
            </Field>
            <ToggleRow
              label="Require identity validation for all conversations"
              help="When enabled, users must provide a valid identity token to start conversations. Requests without valid tokens will be rejected."
            />
          </div>
        </Section>
      </>
    );
  }
  if (inbox.channel === "email") {
    return (
      <Section
        title="Forward to Email"
        description="Start forwarding your emails to the following email address."
      >
        <CopyField value="b7f2c91e4a@inbound.alrayyan-clinics.qa" />
      </Section>
    );
  }
  return (
    <>
      <Section
        title="Inbox Identifier"
        description="Use the `inbox_identifier` token shown here to authentication your API clients."
      >
        <CopyField value="Zp4kQm8RwT2vXy6N" />
      </Section>
      <Section
        title="Webhook Verification Token"
        description="This token is used to verify the authenticity of the webhook endpoint."
      >
        <CopyField value="••••••••••••••••" />
      </Section>
    </>
  );
}

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
                defaultValue="We are closed right now. Our clinics in Doha open Sunday to Thursday, 8 AM to 9 PM."
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
                {days.map((day) => {
                  const off = day === "Friday";
                  const short = day === "Saturday";
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-4 px-4 py-3">
                      <label className="flex w-36 items-center gap-2 text-sm">
                        <Checkbox defaultChecked={!off} aria-label="Enable availability for this day" />
                        {day}
                      </label>
                      {off ? (
                        <span className="text-muted-foreground text-sm">Unavailable</span>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <Input type="time" defaultValue={short ? "10:00" : "08:00"} className="h-8 w-28" />
                          <span className="text-muted-foreground">-</span>
                          <Input type="time" defaultValue={short ? "18:00" : "21:00"} className="h-8 w-28" />
                          <label className="ml-2 flex items-center gap-2 text-muted-foreground">
                            <Checkbox /> All-Day
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
        <div>
          <Button size="sm">Update business hours settings</Button>
        </div>
      </div>
    </Section>
  );
}

function CsatTab() {
  const [enabled, setEnabled] = React.useState(true);
  const [display, setDisplay] = React.useState("emoji");
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
              defaultValue="Thank you for contacting Al Rayyan Clinics. How was your experience today?"
            />
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
              <Badge variant="outline">appointment</Badge>
              <Badge variant="outline">billing</Badge>
            </div>
          </Field>
          <p className="text-muted-foreground text-xs">Note: CSAT surveys are sent only once per conversation</p>
          <div>
            <Button size="sm">Update</Button>
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
    { key: "branch", label: "Preferred branch", placeholder: "Doha, Al Wakrah, or Lusail", type: "list", on: false, req: false },
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
            defaultValue="Share a few details so we can route you to the right clinic."
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

function BotConfigurationTab() {
  return (
    <Section
      title="Select an agent bot"
      description="Assign an Agent Bot to your inbox. They can handle initial conversations and transfer them to a live agent when necessary."
    >
      <div className="grid max-w-md gap-3">
        <NativeSelect className="w-full" defaultValue="2">
          <option value="">Select bot</option>
          <option value="1">Appointment Assistant</option>
          <option value="2">Arabic FAQ Bot</option>
          <option value="3">Insurance Checker</option>
        </NativeSelect>
        <div className="flex gap-2">
          <Button size="sm">Update</Button>
          <Button size="sm" variant="outline" className="text-destructive">
            Disconnect bot
          </Button>
        </div>
      </div>
    </Section>
  );
}

export function InboxSettings({ inbox }: { inbox: Inbox }) {
  const channel = channelFor(inbox.channel);
  const Icon = channel.icon;
  const isWebsite = inbox.channel === "website";

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="icon-sm" aria-label="Back" asChild>
          <Link href="/dashboard/settings/inboxes">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="grid size-9 place-items-center rounded-lg border bg-muted/50">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="grid gap-0.5">
          <h1 className="font-semibold text-lg leading-none">{inbox.name}</h1>
          <span className="text-muted-foreground text-xs">
            {channel.name}
            {inbox.identifier ? ` · ${inbox.identifier}` : ""}
          </span>
        </div>
      </div>
      <Tabs defaultValue="settings" className="gap-0">
        <div className="overflow-x-auto overflow-y-hidden border-b px-6">
          <TabsList variant="line" className="h-11">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            {isWebsite ? <TabsTrigger value="hours">Business Hours</TabsTrigger> : null}
            <TabsTrigger value="csat">CSAT</TabsTrigger>
            {isWebsite ? <TabsTrigger value="prechat">Pre Chat Form</TabsTrigger> : null}
            <TabsTrigger value="bot">Bot Configuration</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="settings">
          <SettingsTab inbox={inbox} />
        </TabsContent>
        <TabsContent value="collaborators">
          <CollaboratorsTab inbox={inbox} />
        </TabsContent>
        <TabsContent value="configuration">
          <ConfigurationTab inbox={inbox} />
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
        <TabsContent value="bot">
          <BotConfigurationTab />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

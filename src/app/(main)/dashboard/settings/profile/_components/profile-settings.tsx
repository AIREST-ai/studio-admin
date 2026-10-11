"use client";
import * as React from "react";

import { cn } from "cn";
import { Copy, Laptop, Play, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="grid gap-6 py-8 first:pt-0 lg:grid-cols-[280px_1fr] lg:gap-10">
        <div className="grid h-fit gap-1.5">
          <h2 className="font-medium text-base">{title}</h2>
          {note && <p className="text-muted-foreground text-sm leading-relaxed">{note}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
      <Separator className="last:hidden" />
    </>
  );
}

const notificationTypes = [
  { label: "A new conversation is created", email: false, push: true },
  { label: "A conversation is assigned to you", email: true, push: true },
  { label: "You are mentioned in a conversation", email: true, push: true },
  { label: "A new message is created in an assigned conversation", email: false, push: true },
  { label: "A new message is created in a participating conversation", email: false, push: false },
  { label: "A conversation misses first response SLA", email: true, push: false },
  { label: "A conversation misses next response SLA", email: true, push: false },
  { label: "A conversation misses resolution SLA", email: true, push: false },
];

const sessions = [
  { device: "Chrome on macOS", icon: Laptop, place: "Doha, Qatar", last: "Active now", current: true },
  { device: "Chatwoot app on iPhone", icon: Smartphone, place: "Doha, Qatar", last: "2 hours ago", current: false },
  { device: "Edge on Windows", icon: Laptop, place: "Dubai, United Arab Emirates", last: "Oct 8, 2026", current: false },
];

export function ProfileSettings() {
  const [hotkey, setHotkey] = React.useState("enter");
  const [fontSize, setFontSize] = React.useState("default");
  const [alerts, setAlerts] = React.useState<string[]>(["assigned", "unassigned"]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-xl">Profile Settings</h1>
      <Card>
        <CardContent>
          <Section title="Profile" note="Your email address is your identity and is used to log in.">
            <div className="grid max-w-xl gap-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="bg-sky-100 font-medium text-lg text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    FK
                  </AvatarFallback>
                </Avatar>
                <div className="grid gap-1.5">
                  <span className="font-medium text-sm">Profile Picture</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Upload image
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      Delete Avatar
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Your full name</Label>
                <Input placeholder="Please enter your full name" defaultValue="Fahad Al-Kuwari" />
              </div>
              <div className="grid gap-2">
                <Label>Display name</Label>
                <Input
                  placeholder="Please enter a display name, this would be displayed in conversations"
                  defaultValue="Fahad"
                />
              </div>
              <div className="grid gap-2">
                <Label>Your email address</Label>
                <Input type="email" defaultValue="fahad@doharetail.qa" />
              </div>
              <Button className="w-fit">Update Profile</Button>
            </div>
          </Section>

          <Section title="Interface" note="Customize the look and feel of your Chatwoot dashboard.">
            <div className="grid max-w-xl gap-6">
              <div className="grid gap-2">
                <div className="grid gap-0.5">
                  <Label>Font size</Label>
                  <p className="text-muted-foreground text-xs">
                    Adjust the text size across the dashboard based on your preference.
                  </p>
                </div>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={fontSize}
                  onValueChange={(v) => v && setFontSize(v)}
                  className="flex-wrap"
                >
                  {["Smaller", "Small", "Default", "Large", "Larger", "Extra Large"].map((s) => (
                    <ToggleGroupItem key={s} value={s.toLowerCase()}>
                      {s}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="grid gap-2">
                <div className="grid gap-0.5">
                  <Label>Preferred Language</Label>
                  <p className="text-muted-foreground text-xs">Choose the language you want to use.</p>
                </div>
                <NativeSelect className="w-64" defaultValue="default">
                  <option value="default">Use account default</option>
                  <option value="en">English</option>
                  <option value="ar">العربية (ar)</option>
                </NativeSelect>
              </div>
            </div>
          </Section>

          <Section
            title="Personal message signature"
            note="Create a unique message signature to appear at the end of every message you send from any inbox. You can also include an inline image, which is supported in live-chat, email, and API inboxes."
          >
            <div className="grid max-w-xl gap-3">
              <Label>Message Signature</Label>
              <Textarea
                className="min-h-28"
                placeholder="Insert your personal message signature here."
                defaultValue={"Best regards,\nFahad Al-Kuwari\nCustomer Care · Doha Retail Group\n+974 4400 1122"}
              />
              <Button className="w-fit">Save message signature</Button>
            </div>
          </Section>

          <Section
            title="Hotkey to send messages"
            note="You can select a hotkey (either Enter or Cmd/Ctrl+Enter) based on your preference of writing."
          >
            <RadioGroup value={hotkey} onValueChange={setHotkey} className="grid max-w-2xl gap-3 sm:grid-cols-2">
              {[
                {
                  value: "enter",
                  heading: "Enter (↵)",
                  content: "Send messages by pressing Enter key instead of clicking the send button.",
                },
                {
                  value: "cmd_enter",
                  heading: "Cmd/Ctrl + Enter (⌘ + ↵)",
                  content: "Send messages by pressing Cmd/Ctrl + enter key instead of clicking the send button.",
                },
              ].map((o) => (
                <Label
                  key={o.value}
                  className={cn(
                    "items-start gap-3 rounded-lg border p-4 font-normal",
                    hotkey === o.value && "border-primary bg-primary/5",
                  )}
                >
                  <RadioGroupItem value={o.value} className="mt-0.5" />
                  <div className="grid gap-1">
                    <span className="font-medium">{o.heading}</span>
                    <span className="text-muted-foreground text-xs leading-relaxed">{o.content}</span>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </Section>

          <Section title="Password" note="Updating your password would reset your logins in multiple devices.">
            <div className="grid max-w-xl gap-4">
              <div className="grid gap-2">
                <Label>Current password</Label>
                <Input type="password" autoComplete="off" placeholder="Please enter the current password" />
              </div>
              <div className="grid gap-2">
                <Label>New password</Label>
                <Input type="password" autoComplete="off" placeholder="Please enter a new password" />
              </div>
              <div className="grid gap-2">
                <Label>Confirm new password</Label>
                <Input type="password" autoComplete="off" placeholder="Please re-enter your new password" />
              </div>
              <Button className="w-fit">Change password</Button>
            </div>
          </Section>

          <Section title="Security" note="Manage additional security features for your account.">
            <div className="flex max-w-xl items-center justify-between gap-4 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-600" />
                <div className="grid gap-0.5">
                  <span className="font-medium text-sm">Two-factor authentication</span>
                  <span className="text-muted-foreground text-xs">Enabled with an authenticator app</span>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Manage Two-Factor Authentication
              </Button>
            </div>
          </Section>

          <Section title="Active Sessions" note="These are the devices currently logged in to your account.">
            <div className="grid max-w-2xl divide-y rounded-lg border">
              {sessions.map((s) => (
                <div key={s.device} className="flex items-center gap-3 p-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                    <s.icon className="size-4" />
                  </div>
                  <div className="grid flex-1 gap-0.5">
                    <span className="flex items-center gap-2 font-medium text-sm">
                      {s.device}
                      {s.current && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 font-normal text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        >
                          Current session
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {s.place} · Last active {s.last}
                    </span>
                  </div>
                  {!s.current && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Audio Alerts" note="Enable audio alerts in dashboard for new messages and conversations.">
            <div className="grid max-w-xl gap-5">
              <div className="grid gap-2">
                <Label>Alert events for conversations</Label>
                <div className="grid gap-2">
                  {[
                    { v: "assigned", l: "My assigned conversations" },
                    { v: "unassigned", l: "Unassigned conversations" },
                    { v: "notme", l: "Open conversations assigned to others" },
                  ].map((o) => (
                    <Label key={o.v} className="font-normal">
                      <Checkbox
                        checked={alerts.includes(o.v)}
                        onCheckedChange={(c) =>
                          setAlerts((prev) => (c ? [...prev, o.v] : prev.filter((x) => x !== o.v)))
                        }
                      />
                      {o.l}
                    </Label>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {alerts.length === 0
                    ? "You haven't selected any options, you won't receive any audio alerts."
                    : alerts.length === 3
                      ? "You'll receive alerts for all conversations."
                      : "You'll receive alerts for your assigned conversations and any unattended ones."}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Alert tone:</Label>
                <div className="flex items-center gap-2">
                  <NativeSelect className="w-48" defaultValue="ding">
                    <option value="ding">Ding</option>
                    <option value="bell">Bell</option>
                    <option value="chime">Chime</option>
                    <option value="magic">Magic</option>
                    <option value="ping">Ping</option>
                  </NativeSelect>
                  <Button variant="outline" size="icon" aria-label="Play sound">
                    <Play />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Alert conditions:</Label>
                <Label className="font-normal">
                  <Checkbox defaultChecked /> Send audio alerts only if the browser window is not active
                </Label>
                <Label className="font-normal">
                  <Checkbox /> Send alerts every 30s until all the assigned conversations are read
                </Label>
              </div>
            </div>
          </Section>

          <Section title="Notification preferences">
            <div className="max-w-3xl overflow-hidden rounded-lg border">
              <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-4 py-3 font-medium text-sm">
                <span className="col-span-8">Notification type</span>
                <span className="col-span-2">Email</span>
                <span className="col-span-2">Push notification</span>
              </div>
              {notificationTypes.map((n) => (
                <div
                  key={n.label}
                  className="grid grid-cols-12 items-center gap-4 border-b px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="col-span-8">{n.label}</span>
                  <span className="col-span-2">
                    <Checkbox defaultChecked={n.email} aria-label={`Email: ${n.label}`} />
                  </span>
                  <span className="col-span-2">
                    <Checkbox defaultChecked={n.push} aria-label={`Push: ${n.label}`} />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                Enable push notifications for your browser so you’re able to receive them
              </span>
              <Button variant="outline" size="sm">
                Enable push notifications
              </Button>
            </div>
          </Section>

          <Section title="Access Token" note="This token can be used if you are building an API based integration">
            <div className="flex max-w-xl items-center gap-2">
              <Input readOnly value="••••••••••••••••••••••••" className="font-mono" />
              <Button variant="outline">
                <Copy /> Copy
              </Button>
              <Button variant="outline">
                <RotateCcw /> Reset
              </Button>
            </div>
          </Section>
        </CardContent>
      </Card>
    </div>
  );
}

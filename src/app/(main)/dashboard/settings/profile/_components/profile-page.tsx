"use client";
// Chatwoot settings/profile/Index.vue and its parts (UserProfilePicture, UserBasicDetails, FontSize,
// UserLanguageSelect, MessageSignature, hotkey RadioCards, ChangePassword, MfaSettingsCard, ActiveSessions,
// AudioNotifications, NotificationPreferences, AccessToken) in the Studio pattern: big title outside, line tabs
// grouping the sections, each group in a card.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { Copy, Eye, EyeOff, Laptop, Play, RotateCcw, ShieldCheck, ShieldOff, Smartphone, Upload } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

import { CountTabs, PageHeader } from "../../labels/_shared/settings-shell";

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
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

function FieldError({ children }: { children?: string }) {
  return children ? <p className="text-destructive text-xs">{children}</p> : null;
}

const notificationTypes = [
  { key: "conversation_creation", label: "A new conversation is created", email: false, push: true },
  { key: "conversation_assignment", label: "A conversation is assigned to you", email: true, push: true },
  { key: "conversation_mention", label: "You are mentioned in a conversation", email: true, push: true },
  {
    key: "assigned_conversation_new_message",
    label: "A new message is created in an assigned conversation",
    email: false,
    push: true,
  },
  {
    key: "participating_conversation_new_message",
    label: "A new message is created in a participating conversation",
    email: false,
    push: false,
  },
  { key: "sla_missed_first_response", label: "A conversation misses first response SLA", email: true, push: false },
  { key: "sla_missed_next_response", label: "A conversation misses next response SLA", email: true, push: false },
  { key: "sla_missed_resolution", label: "A conversation misses resolution SLA", email: true, push: false },
];

const seedSessions = [
  { id: 1, device: "Chrome on macOS", icon: Laptop, place: "Doha, Qatar", last: "Active now", current: true },
  { id: 2, device: "Mobile app on iPhone", icon: Smartphone, place: "Doha, Qatar", last: "2 hours ago", current: false },
  { id: 3, device: "Edge on Windows", icon: Laptop, place: "Dubai, United Arab Emirates", last: "Oct 8, 2026", current: false },
];

const fontSizes = ["Smaller", "Small", "Default", "Large", "Larger", "Extra Large"];
const tones = ["ding", "bell", "chime", "magic", "ping"];

function makeToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function copy(text: string, message = "Copied to clipboard") {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
  toast.success(message);
}

function ProfileTab() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const [name, setName] = React.useState("Arham Khan");
  const [displayName, setDisplayName] = React.useState("Arham");
  const [email, setEmail] = React.useState("arham.khan@weblabs.studio");
  const [errors, setErrors] = React.useState<{ name?: string; displayName?: string; email?: string }>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 1) next.name = "Please enter a valid full name";
    if (displayName.trim().length < 1) next.displayName = "Please enter a valid display name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Please enter a valid email address";
    setErrors(next);
    if (Object.keys(next).length) return;
    toast.success("Your profile has been updated successfully");
  }

  return (
    <Section title="Profile" note="Your email address is your identity and is used to log in.">
      <form className="grid max-w-xl gap-5" onSubmit={submit} noValidate>
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatar ? <AvatarImage src={avatar} alt="Profile picture" /> : null}
            <AvatarFallback className="bg-sky-100 font-medium text-lg text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              AK
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-1.5">
            <span className="font-medium text-sm">Profile Image</span>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png, image/jpeg, image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAvatar(URL.createObjectURL(file));
                    toast.success("Your profile has been updated successfully");
                  }
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload /> {avatar ? "Update image" : "Upload image"}
              </Button>
              {avatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setAvatar(null);
                    toast.success("Avatar has been deleted successfully");
                  }}
                >
                  Delete Avatar
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-name">Your full name</Label>
          <Input
            id="profile-name"
            placeholder="Please enter your full name"
            value={name}
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => setName(e.target.value)}
          />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-display">Display name</Label>
          <Input
            id="profile-display"
            placeholder="Please enter a display name, this would be displayed in conversations"
            value={displayName}
            aria-invalid={Boolean(errors.displayName)}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <FieldError>{errors.displayName}</FieldError>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-email">Your email address</Label>
          <Input
            id="profile-email"
            type="email"
            placeholder="Please enter your email address, this would be displayed in conversations"
            value={email}
            aria-invalid={Boolean(errors.email)}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError>{errors.email}</FieldError>
        </div>
        <Button type="submit" className="w-fit">
          Update Profile
        </Button>
      </form>
    </Section>
  );
}

function PreferencesTab() {
  const [fontSize, setFontSize] = React.useState("Default");
  const [language, setLanguage] = React.useState("default");
  const [signature, setSignature] = React.useState(
    "Best regards,\nArham Khan\nCustomer Support · Weblabs Studio\n+974 4400 1122",
  );
  const [hotkey, setHotkey] = React.useState("enter");
  const [signatureError, setSignatureError] = React.useState("");

  return (
    <>
      <Section title="Interface" note="Customize the look and feel of your dashboard.">
        <div className="grid max-w-xl gap-6">
          <div className="grid gap-2">
            <div className="grid gap-0.5">
              <Label htmlFor="font-size">Font size</Label>
              <p className="text-muted-foreground text-xs">
                Adjust the text size across the dashboard based on your preference.
              </p>
            </div>
            <NativeSelect
              id="font-size"
              className="w-64"
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                toast.success("Font size updated successfully");
              }}
            >
              {fontSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <div className="grid gap-0.5">
              <Label htmlFor="language">Preferred Language</Label>
              <p className="text-muted-foreground text-xs">Choose the language you want to use.</p>
            </div>
            <NativeSelect
              id="language"
              className="w-64"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                toast.success("Language updated successfully");
              }}
            >
              <option value="default">Use account default</option>
              <option value="en">English (en)</option>
              <option value="ar">العربية (ar)</option>
              <option value="fr">Français (fr)</option>
              <option value="hi">हिन्दी (hi)</option>
              <option value="ur">اردو (ur)</option>
            </NativeSelect>
          </div>
        </div>
      </Section>

      <Section
        title="Personal message signature"
        note="Create a unique message signature to appear at the end of every message you send from any inbox. You can also include an inline image, which is supported in live-chat, email, and API inboxes."
      >
        <div className="grid max-w-xl gap-3">
          <Label htmlFor="signature">Message Signature</Label>
          <Textarea
            id="signature"
            className="min-h-28"
            placeholder="Insert your personal message signature here."
            value={signature}
            aria-invalid={Boolean(signatureError)}
            onChange={(e) => {
              setSignature(e.target.value);
              setSignatureError("");
            }}
          />
          {signatureError ? <p className="text-destructive text-xs">{signatureError}</p> : null}
          <Button
            className="w-fit"
            onClick={() => {
              if (!signature.trim()) {
                setSignatureError("Message Signature cannot be empty");
                return;
              }
              toast.success("Your profile has been updated successfully");
            }}
          >
            Save message signature
          </Button>
        </div>
      </Section>

      <Section
        title="Hotkey to send messages"
        note="You can select a hotkey (either Enter or Cmd/Ctrl+Enter) based on your preference of writing."
      >
        <RadioGroup
          value={hotkey}
          onValueChange={(v) => {
            setHotkey(v);
            toast.success("Your profile has been updated successfully");
          }}
          className="grid max-w-2xl gap-3 sm:grid-cols-2"
        >
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
    </>
  );
}

function SecurityTab({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [current, setCurrent] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<{ current?: string; password?: string; confirm?: string }>({});
  const [sessions, setSessions] = React.useState(seedSessions);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!current) next.current = "Please enter the current password";
    if (password.length < 6) next.password = "Please enter a password of length 6 or more";
    if (confirm !== password || !confirm) next.confirm = "Confirm password should match the password";
    setErrors(next);
    if (Object.keys(next).length) return;
    setCurrent("");
    setPassword("");
    setConfirm("");
    toast.success("Your password has been changed successfully");
  }

  return (
    <>
      <Section title="Password" note="Updating your password would reset your logins in multiple devices.">
        <form className="grid max-w-xl gap-4" onSubmit={submit} noValidate>
          <div className="grid gap-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="off"
              placeholder="Please enter the current password"
              value={current}
              aria-invalid={Boolean(errors.current)}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <FieldError>{errors.current}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="off"
              placeholder="Please enter a new password"
              value={password}
              aria-invalid={Boolean(errors.password)}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldError>{errors.password}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="off"
              placeholder="Please re-enter your new password"
              value={confirm}
              aria-invalid={Boolean(errors.confirm)}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <FieldError>{errors.confirm}</FieldError>
          </div>
          <Button type="submit" className="w-fit">
            Change password
          </Button>
        </form>
      </Section>

      <Section title="Security" note="Manage additional security features for your account.">
        <div className="flex max-w-xl flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            {mfaEnabled ? (
              <ShieldCheck className="size-5 text-emerald-600" />
            ) : (
              <ShieldOff className="size-5 text-muted-foreground" />
            )}
            <div className="grid gap-0.5">
              <span className="flex items-center gap-2 font-medium text-sm">
                Two-Factor Authentication
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    mfaEnabled
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  {mfaEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </span>
              <span className="text-muted-foreground text-xs">
                Add an extra layer of security to your account using a time-based one-time password (TOTP)
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings/profile/mfa">Manage Two-Factor Authentication</Link>
          </Button>
        </div>
      </Section>

      <Section title="Active Sessions" note="These are the devices currently logged in to your account.">
        <div className="grid max-w-2xl divide-y rounded-lg border">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <s.icon className="size-4" />
              </div>
              <div className="grid flex-1 gap-0.5">
                <span className="flex items-center gap-2 font-medium text-sm">
                  {s.device}
                  {s.current && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/20 bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400"
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setSessions((prev) => prev.filter((x) => x.id !== s.id));
                    toast.success("Session revoked successfully");
                  }}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function NotificationsTab() {
  const [alerts, setAlerts] = React.useState<string[]>(["assigned", "unassigned"]);
  const [tone, setTone] = React.useState("ding");
  const [prefs, setPrefs] = React.useState(() =>
    Object.fromEntries(notificationTypes.map((n) => [n.key, { email: n.email, push: n.push }])),
  );
  const [permission, setPermission] = React.useState<string>("default");

  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPermission(Notification.permission);
  }, []);

  function setPref(key: string, channel: "email" | "push", value: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: { ...prev[key], [channel]: value } }));
    toast.success("Your notification preferences are updated successfully");
  }

  return (
    <>
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
                    onCheckedChange={(c) => setAlerts((prev) => (c ? [...prev, o.v] : prev.filter((x) => x !== o.v)))}
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
            <Label htmlFor="alert-tone">Alert tone:</Label>
            <div className="flex items-center gap-2">
              <NativeSelect id="alert-tone" className="w-48" value={tone} onChange={(e) => setTone(e.target.value)}>
                {tones.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </NativeSelect>
              <Button
                variant="outline"
                size="icon"
                aria-label="Play sound"
                onClick={() => {
                  try {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    osc.frequency.value = 880 + tones.indexOf(tone) * 110;
                    osc.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.15);
                  } catch {
                    // Audio not available in this browser.
                  }
                }}
              >
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
            <div key={n.key} className="grid grid-cols-12 items-center gap-4 border-b px-4 py-3 text-sm last:border-b-0">
              <span className="col-span-8">{n.label}</span>
              <span className="col-span-2">
                <Checkbox
                  checked={prefs[n.key].email}
                  onCheckedChange={(c) => setPref(n.key, "email", c === true)}
                  aria-label={`Email: ${n.label}`}
                />
              </span>
              <span className="col-span-2">
                <Checkbox
                  checked={prefs[n.key].push}
                  onCheckedChange={(c) => setPref(n.key, "push", c === true)}
                  aria-label={`Push: ${n.label}`}
                />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {permission === "granted"
              ? "Push notifications are enabled for this browser."
              : permission === "denied"
                ? "Push notifications are blocked. Allow them in your browser settings."
                : "Enable push notifications for your browser so you’re able to receive them"}
          </span>
          {permission === "default" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!("Notification" in window)) return;
                setPermission(await Notification.requestPermission());
              }}
            >
              Enable push notifications
            </Button>
          ) : null}
        </div>
      </Section>
    </>
  );
}

function AccessTokenTab() {
  const [token, setToken] = React.useState("xT9vQm2LbR7cKp4WnZ8sHd3J");
  const [visible, setVisible] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  return (
    <Section title="Access Token" note="This token can be used if you are building an API based integration">
      <div className="grid max-w-xl gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input readOnly value={visible ? token : "•".repeat(token.length)} className="pe-9 font-mono" />
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute end-1.5 top-1/2 -translate-y-1/2"
              aria-label={visible ? "Hide token" : "Show token"}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <Button variant="outline" onClick={() => copy(token)}>
            <Copy /> Copy
          </Button>
          <Button
            variant={confirming ? "destructive" : "outline"}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setConfirming(false);
              setToken(makeToken());
              setVisible(true);
              toast.success("Access token regenerated successfully");
            }}
          >
            <RotateCcw /> {confirming ? "Are you sure?" : "Reset"}
          </Button>
        </div>
        {confirming ? <p className="text-muted-foreground text-xs">Click again to confirm</p> : null}
      </div>
    </Section>
  );
}

const tabs = [
  { value: "profile", label: "Profile" },
  { value: "preferences", label: "Preferences" },
  { value: "security", label: "Security" },
  { value: "notifications", label: "Notifications" },
  { value: "token", label: "Access Token" },
];

export function ProfilePage() {
  const [tab, setTab] = React.useState("profile");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Profile Settings"
        description="Manage your profile, interface preferences, password, notifications and API access."
      />
      <CountTabs value={tab} onValueChange={setTab} items={tabs} />
      <Card>
        <CardContent>
          {tab === "profile" ? <ProfileTab /> : null}
          {tab === "preferences" ? <PreferencesTab /> : null}
          {tab === "security" ? <SecurityTab mfaEnabled={false} /> : null}
          {tab === "notifications" ? <NotificationsTab /> : null}
          {tab === "token" ? <AccessTokenTab /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

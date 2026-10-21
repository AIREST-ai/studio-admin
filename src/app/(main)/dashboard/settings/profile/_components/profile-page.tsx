"use client";
// Chatwoot settings/profile/Index.vue and its parts (UserProfilePicture, UserBasicDetails, FontSize,
// UserLanguageSelect, MessageSignature, hotkey RadioCards, ChangePassword, MfaSettingsCard, ActiveSessions,
// AudioNotifications, NotificationPreferences, AccessToken) in the Studio pattern: big title outside, line tabs
// grouping the sections, each group in a card.
import * as React from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "cn";
import { Copy, Eye, EyeOff, Info, Laptop, Play, RotateCcw, ShieldCheck, ShieldOff, Upload } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { setSignedInProfile } from "@/lib/cw/signed-in-profile";

import { copyText } from "../../_components/copy-text";
import { SettingsCard } from "../../_components/settings-card";
import {
  type ProfileSettings,
  SAVED_IN_PREVIEW,
  saveProfile,
  useSettingsPreview,
} from "../../_components/settings-preview-client";
import { CountTabs, PageHeader } from "../../labels/_shared/settings-shell";
import { ApiCard, PREVIEW_TOKEN_LABEL, WebhooksCard } from "./api-access";

// F-6A (sim2 problem 8; Fahad 99 and 129.2): every part of this page said "updated successfully" and kept nothing.
// Now each one is saved in this preview (api/settings-preview, section "profile") and comes back after a reload and
// in another browser, and its message says it was saved in the preview, not in Chatwoot. What cannot be real here
// says so: the password (the preview has no accounts), sessions (only this browser, read from it, no invented
// devices) and the access token (made by the preview, no API takes it). Two-factor is a real TOTP setup
// (mfa-settings.tsx).
type SavedProfile = Partial<ProfileSettings>;

// The page's copy of the saved profile follows every save, so a tab opened again shows what was just saved.
const savedListeners = new Set<(profile: ProfileSettings) => void>();

/** Saves a part of the profile and says so only after the preview server has it; a failure says why. */
async function keep(part: Partial<Omit<ProfileSettings, "savedAt">>, done: string, note = SAVED_IN_PREVIEW) {
  try {
    const saved = await saveProfile(part);
    for (const listener of savedListeners) listener(saved);
    // F-9: the header picture menu and the sidebar's person button show the saved name and picture at once.
    setSignedInProfile({ name: saved.name, email: saved.email, avatar: saved.avatar });
    toast.success(done, { description: note });
    return saved;
  } catch (error) {
    toast.error("Not saved", { description: (error as Error).message });
    return null;
  }
}

/** The picked image as a 128 px square PNG data: URL, small enough to keep with the saved profile. */
async function avatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 128;
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")
    ?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

// م137 round 2 (Fahad 137, judge M137): each section is a card with its title and line on top and its fields below,
// the same card as every other Settings page (SettingsCard), as Chatwoot's profile/Index.vue stacks its SectionLayout
// parts; it was a title column beside the fields inside one card. A section's Save stays at the end of its form.
function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <SettingsCard title={title} description={note}>
      {children}
    </SettingsCard>
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

/** "Chrome on macOS" from this browser's own user agent: the one session that really exists here. */
function thisBrowser(): string {
  if (typeof navigator === "undefined") return "This browser";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua) || /HeadlessChrome/.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const system = /Mac OS X/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return system ? `${browser} on ${system}` : browser;
}

const fontSizes = ["Smaller", "Small", "Default", "Large", "Larger", "Extra Large"];
const tones = ["ding", "bell", "chime", "magic", "ping"];

function makeToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function ProfileTab({ saved }: { saved: SavedProfile }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = React.useState<string | null>(saved.avatar ?? null);
  const [name, setName] = React.useState(saved.name ?? "Arham Khan");
  const [displayName, setDisplayName] = React.useState(saved.displayName ?? "Arham");
  const [email, setEmail] = React.useState(saved.email ?? "arham.khan@weblabs.studio");
  const [errors, setErrors] = React.useState<{ name?: string; displayName?: string; email?: string }>({});
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 1) next.name = "Please enter a valid full name";
    if (displayName.trim().length < 1) next.displayName = "Please enter a valid display name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Please enter a valid email address";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    await keep(
      { name: name.trim(), displayName: displayName.trim(), email: email.trim() },
      "Your profile has been updated successfully",
    );
    setSaving(false);
  }

  return (
    <Section title="Profile" note="Your email address is your identity and is used to log in.">
      <form className="grid max-w-xl gap-5" onSubmit={submit} noValidate>
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatar ? <AvatarImage src={avatar} alt="Profile picture" /> : null}
            <AvatarFallback className="bg-sky-100 font-medium text-lg text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              {name
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
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
                  e.target.value = "";
                  if (!file) return;
                  avatarDataUrl(file).then(
                    async (picture) => {
                      if (await keep({ avatar: picture }, "Your profile has been updated successfully"))
                        setAvatar(picture);
                    },
                    () => toast.error("This image could not be read. Try a PNG or JPEG."),
                  );
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
                  onClick={async () => {
                    if (await keep({ avatar: null }, "Avatar has been deleted successfully")) setAvatar(null);
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
        <Button type="submit" className="w-fit" disabled={saving}>
          {saving ? "Saving…" : "Update Profile"}
        </Button>
      </form>
    </Section>
  );
}

// The preview keeps these choices; it does not yet resize its text or translate its interface (Fahad 124.8: English
// first), and the line under the message says so instead of implying it did.
const NOT_APPLIED_YET = `${SAVED_IN_PREVIEW} The preview does not apply it to its pages yet.`;

function PreferencesTab({ saved }: { saved: SavedProfile }) {
  const [fontSize, setFontSize] = React.useState<string>(saved.fontSize ?? "Default");
  const [language, setLanguage] = React.useState<string>(saved.language ?? "default");
  const [signature, setSignature] = React.useState(
    saved.signature ?? "Best regards,\nArham Khan\nCustomer Support · Weblabs Studio\n+974 4400 1122",
  );
  const [hotkey, setHotkey] = React.useState<string>(saved.hotkey ?? "enter");
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
              onChange={async (e) => {
                const previous = fontSize;
                const next = e.target.value as NonNullable<ProfileSettings["fontSize"]>;
                setFontSize(next);
                if (!(await keep({ fontSize: next }, "Font size updated successfully", NOT_APPLIED_YET)))
                  setFontSize(previous);
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
              onChange={async (e) => {
                const previous = language;
                const next = e.target.value as NonNullable<ProfileSettings["language"]>;
                setLanguage(next);
                if (!(await keep({ language: next }, "Language updated successfully", NOT_APPLIED_YET)))
                  setLanguage(previous);
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
            onClick={async () => {
              if (!signature.trim()) {
                setSignatureError("Message Signature cannot be empty");
                return;
              }
              await keep({ signature }, "Your profile has been updated successfully");
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
          onValueChange={async (v) => {
            const previous = hotkey;
            setHotkey(v);
            if (!(await keep({ hotkey: v as "enter" | "cmd_enter" }, "Your profile has been updated successfully")))
              setHotkey(previous);
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

function SecurityTab() {
  const [current, setCurrent] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<{ current?: string; password?: string; confirm?: string }>({});
  const [browser, setBrowser] = React.useState("This browser");
  const [mfaEnabled, setMfaEnabled] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    setBrowser(thisBrowser());
    fetch("/api/settings-preview/mfa", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((state: { enabled: boolean }) => setMfaEnabled(state.enabled))
      .catch(() => setMfaEnabled(false));
  }, []);

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
    // The preview has no accounts, so there is no password to change; nothing typed is kept or sent.
    toast.info("Password not changed: this preview has no accounts", {
      description:
        "There is no password to change here, so nothing was changed. What you typed was cleared and was not kept or sent.",
    });
  }

  return (
    <>
      <Section title="Password" note="Updating your password would reset your logins in multiple devices.">
        <p
          className="mb-4 flex max-w-xl items-start gap-2 rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm"
          data-preview-note
        >
          <Info className="mt-0.5 size-4 shrink-0" />
          Preview: there are no accounts or passwords in this preview, so a password cannot be changed here.
        </p>
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
                  {mfaEnabled === null ? "Loading…" : mfaEnabled ? "Enabled" : "Disabled"}
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
          <div className="flex items-center gap-3 p-3" data-session-row>
            <div className="flex size-9 items-center justify-center rounded-md bg-muted">
              <Laptop className="size-4" />
            </div>
            <div className="grid flex-1 gap-0.5">
              <span className="flex items-center gap-2 font-medium text-sm">
                {browser}
                <Badge
                  variant="outline"
                  className="border-emerald-500/20 bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400"
                >
                  Current session
                </Badge>
              </span>
              <span className="text-muted-foreground text-xs">Read from this browser</span>
            </div>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground text-xs" data-preview-note>
          Preview: there is no sign-in, so no other devices are logged in and there is nothing to revoke. Only this
          browser is listed.
        </p>
      </Section>
    </>
  );
}

const NOTIFICATIONS_SAVED = "Your notification preferences are updated successfully";

function NotificationsTab({ saved }: { saved: SavedProfile }) {
  // Chatwoot AudioNotifications.vue and NotificationPreferences.vue save each change at once; so does this tab.
  const [alerts, setAlerts] = React.useState<string[]>(saved.audioAlerts ?? ["assigned", "unassigned"]);
  const [tone, setTone] = React.useState<string>(saved.alertTone ?? "ding");
  const [onlyInactive, setOnlyInactive] = React.useState(saved.alertOnlyWhenInactive ?? true);
  const [repeat, setRepeat] = React.useState(saved.alertRepeat ?? false);
  const [prefs, setPrefs] = React.useState(() =>
    Object.fromEntries(
      notificationTypes.map((n) => [n.key, saved.notifications?.[n.key] ?? { email: n.email, push: n.push }]),
    ),
  );
  const [permission, setPermission] = React.useState<string>("default");

  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPermission(Notification.permission);
  }, []);

  async function setPref(key: string, channel: "email" | "push", value: boolean) {
    const choice = { ...prefs[key], [channel]: value };
    setPrefs((prev) => ({ ...prev, [key]: choice }));
    if (!(await keep({ notifications: { [key]: choice } }, NOTIFICATIONS_SAVED)))
      setPrefs((prev) => ({ ...prev, [key]: { ...choice, [channel]: !value } }));
  }

  async function setAlert(event: string, on: boolean) {
    const previous = alerts;
    const next = on ? [...new Set([...alerts, event])] : alerts.filter((x) => x !== event);
    setAlerts(next);
    if (!(await keep({ audioAlerts: next }, NOTIFICATIONS_SAVED))) setAlerts(previous);
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
                  <Checkbox checked={alerts.includes(o.v)} onCheckedChange={(c) => setAlert(o.v, c === true)} />
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
              <NativeSelect
                id="alert-tone"
                className="w-48"
                value={tone}
                onChange={async (e) => {
                  const previous = tone;
                  const next = e.target.value as NonNullable<ProfileSettings["alertTone"]>;
                  setTone(next);
                  if (!(await keep({ alertTone: next }, NOTIFICATIONS_SAVED))) setTone(previous);
                }}
              >
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
              <Checkbox
                checked={onlyInactive}
                onCheckedChange={async (c) => {
                  setOnlyInactive(c === true);
                  if (!(await keep({ alertOnlyWhenInactive: c === true }, NOTIFICATIONS_SAVED)))
                    setOnlyInactive(c !== true);
                }}
              />{" "}
              Send audio alerts only if the browser window is not active
            </Label>
            <Label className="font-normal">
              <Checkbox
                checked={repeat}
                onCheckedChange={async (c) => {
                  setRepeat(c === true);
                  if (!(await keep({ alertRepeat: c === true }, NOTIFICATIONS_SAVED))) setRepeat(c !== true);
                }}
              />{" "}
              Send alerts every 30s until all the assigned conversations are read
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
              key={n.key}
              className="grid grid-cols-12 items-center gap-4 border-b px-4 py-3 text-sm last:border-b-0"
            >
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

const TOKEN_NOTE =
  "Preview — simulated: this token is made and kept by the preview. No API accepts it, because the preview has no API or accounts.";

function AccessTokenTab({ saved }: { saved: SavedProfile }) {
  const [token, setToken] = React.useState(saved.accessToken ?? "xT9vQm2LbR7cKp4WnZ8sHd3J");
  const [visible, setVisible] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  // F-12 (Fahad ل4): the token, then the API base URL and docs, then the webhooks, in one place (api-access.tsx).
  return (
    <>
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
            {/* F-12: says "copied" only when the browser took the token (copy-text.ts). */}
            <Button variant="outline" onClick={() => copyText(token, "Access token copied to clipboard")}>
              <Copy /> Copy
            </Button>
            <Button
              variant={confirming ? "destructive" : "outline"}
              onClick={async () => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setConfirming(false);
                const next = makeToken();
                if (await keep({ accessToken: next }, "Access token regenerated successfully", TOKEN_NOTE)) {
                  setToken(next);
                  setVisible(true);
                }
              }}
            >
              <RotateCcw /> {confirming ? "Are you sure?" : "Reset"}
            </Button>
          </div>
          {confirming ? <p className="text-muted-foreground text-xs">Click again to confirm</p> : null}
          {/* F-12 condition 2: the words on the token itself. */}
          <Badge variant="outline" className="w-fit gap-1.5 font-normal" data-preview-token-label>
            <Info className="size-3.5" />
            {PREVIEW_TOKEN_LABEL}
          </Badge>
          <p className="text-muted-foreground text-xs" data-preview-note>
            {TOKEN_NOTE}
          </p>
        </div>
      </Section>
      <ApiCard />
      <WebhooksCard />
    </>
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
  // This page hydrates inside Suspense; keep DOM translation out until React owns its text nodes.
  const [translationReady, setTranslationReady] = React.useState(false);
  React.useEffect(() => setTranslationReady(true), []);
  // م137 round 2 item 8: ?tab= opens a tab (the Settings search links to Password, Notifications and Access Token).
  const asked = useSearchParams().get("tab");
  const [tab, setTab] = React.useState(tabs.some((t) => t.value === asked) ? (asked as string) : "profile");
  React.useEffect(() => {
    if (asked && tabs.some((t) => t.value === asked)) setTab(asked);
  }, [asked]);

  // F-6A: the tabs start from the saved profile, so they wait for it (a save never writes defaults over it).
  const { settings, error, reload } = useSettingsPreview();
  const [latest, setLatest] = React.useState<ProfileSettings | null>(null);
  React.useEffect(() => {
    savedListeners.add(setLatest);
    return () => {
      savedListeners.delete(setLatest);
    };
  }, []);
  const saved: SavedProfile = latest ?? settings?.profile ?? {};

  return (
    <div data-translation-pending={translationReady ? undefined : ""} className="flex flex-col gap-4">
      <PageHeader
        title="Profile Settings"
        description="Manage your profile, interface preferences, password, notifications and API access."
      />
      <CountTabs value={tab} onValueChange={setTab} items={tabs} />
      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          Saved profile settings could not be read: {error}
          <Button size="sm" variant="outline" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : !settings ? (
        <p className="text-muted-foreground text-sm">Loading saved profile settings…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {tab === "profile" ? <ProfileTab saved={saved} /> : null}
          {tab === "preferences" ? <PreferencesTab saved={saved} /> : null}
          {tab === "security" ? <SecurityTab /> : null}
          {tab === "notifications" ? <NotificationsTab saved={saved} /> : null}
          {tab === "token" ? <AccessTokenTab saved={saved} /> : null}
        </div>
      )}
    </div>
  );
}

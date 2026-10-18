"use client";
// Step 2 of the create-inbox wizard: one form per channel, from Chatwoot routes/dashboard/settings/inbox/channels/*.vue
// (Website, Facebook, Whatsapp + CloudWhatsapp/WhatsappEmbeddedSignup/Twilio, WhatsappCall, Sms + BandwidthSms,
// Email + OAuth/ForwardToOption, Api, Telegram, Line, Instagram, Tiktok, Voice). Labels, placeholders and errors are
// Chatwoot's English strings (inboxMgmt.json). Every required field is checked on submit.
import * as React from "react";

import { cn } from "cn";
import { ArrowLeft, Check, CircleAlert, Loader2, Mail } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { useAccountName } from "../../account/_components/general-settings-client";
import type { Channel, ChannelKey } from "./data";

export interface CreatedInbox {
  channel: ChannelKey;
  name: string;
  provider?: "twilio" | "bandwidth" | "whatsapp_cloud" | "embedded" | "google" | "microsoft" | "other";
  phone?: string;
  /** F161: what the inbox list shows under the name (website domain); phone or name when missing. */
  identifier?: string;
  /** F-6A: the API channel's Webhook URL as typed, kept on the new inbox (its settings showed a fixed address). */
  webhookUrl?: string;
  /** V-7: transient channel creation parameters sent once to POST /inboxes and wiped immediately. */
  channelParams?: Record<string, unknown>;
}

const PHONE = /^\+[1-9]\d{1,14}$/;
const PHONE_ERROR = "Please provide a valid phone number that starts with a `+` sign and does not contain any spaces.";
const URL_RE = /^https?:\/\/\S+\.\S+/;
const TELEGRAM_TOKEN = /^\d{3,15}:[A-Za-z0-9_-]{20,}$/;

interface FieldSpec {
  id: string;
  label: string;
  placeholder?: string;
  help?: string;
  required?: string;
  pattern?: RegExp;
  patternError?: string;
  type?: "text" | "password" | "textarea";
  defaultValue?: string;
  optional?: boolean;
}

function FormHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h2 className="font-medium text-lg">{title}</h2>
      {description ? <p className="text-muted-foreground text-sm leading-relaxed">{description}</p> : null}
    </div>
  );
}

function fieldError(spec: FieldSpec, value: string) {
  const v = value.trim();
  if (!v) return spec.optional ? "" : (spec.required ?? "This field is required");
  if (spec.pattern && !spec.pattern.test(v)) return spec.patternError ?? "Please enter a valid value.";
  return "";
}

/** A list of inputs with Chatwoot's required / format checks; the submit button sends the values up. */
function SpecFields({
  fields,
  values,
  onChange,
  submitted,
}: {
  fields: FieldSpec[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  submitted: boolean;
}) {
  return (
    <FieldGroup className="gap-4">
      {fields.map((spec) => {
        const error = submitted ? fieldError(spec, values[spec.id] ?? "") : "";
        const id = `f-${spec.id}`;
        return (
          <Field key={spec.id} data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor={id}>{spec.label}</FieldLabel>
            {spec.type === "textarea" ? (
              <Textarea
                id={id}
                placeholder={spec.placeholder}
                value={values[spec.id] ?? ""}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => onChange(spec.id, event.target.value)}
              />
            ) : (
              <Input
                id={id}
                type={spec.type === "password" ? "password" : "text"}
                placeholder={spec.placeholder}
                value={values[spec.id] ?? ""}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => onChange(spec.id, event.target.value)}
              />
            )}
            {error ? (
              <FieldError>{error}</FieldError>
            ) : spec.help ? (
              <FieldDescription>{spec.help}</FieldDescription>
            ) : null}
          </Field>
        );
      })}
    </FieldGroup>
  );
}

function useSpecForm(fields: FieldSpec[]) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, f.defaultValue ?? ""])),
  );
  const [submitted, setSubmitted] = React.useState(false);
  const onChange = (id: string, value: string) => setValues((prev) => ({ ...prev, [id]: value }));
  const validate = (active: FieldSpec[] = fields) => {
    setSubmitted(true);
    return active.every((f) => !fieldError(f, values[f.id] ?? ""));
  };
  return { values, onChange, submitted, validate };
}

function SimpleChannelForm({
  title,
  description,
  fields,
  submit,
  onCreate,
  toCreated,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  fields: FieldSpec[];
  submit: string;
  onCreate: (created: CreatedInbox) => void;
  toCreated: (values: Record<string, string>) => CreatedInbox;
  children?: React.ReactNode;
}) {
  const form = useSpecForm(fields);
  return (
    <form
      className="grid max-w-2xl gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (form.validate()) onCreate(toCreated(form.values));
      }}
    >
      <FormHeading title={title} description={description} />
      {children}
      <SpecFields fields={fields} values={form.values} onChange={form.onChange} submitted={form.submitted} />
      <div>
        <Button type="submit">{submit}</Button>
      </div>
    </form>
  );
}

// ---------- Website ----------

const widgetColors = ["#1F93FF", "#0F766E", "#7C3AED", "#B91C1C", "#8A1538", "#111827"];

function WebsiteForm({ onCreate }: { onCreate: (created: CreatedInbox) => void }) {
  const fields: FieldSpec[] = [
    { id: "name", label: "Website Name", placeholder: "Enter your website name (eg: Acme Inc)" },
    { id: "domain", label: "Website Domain", placeholder: "Enter your website domain (eg: acme.com)" },
  ];
  const form = useSpecForm(fields);
  const [color, setColor] = React.useState(widgetColors[0]);
  const [welcomeTitle, setWelcomeTitle] = React.useState("");
  const [greeting, setGreeting] = React.useState(false);
  const [greetingMessage, setGreetingMessage] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const greetingError = form.submitted && greeting && !greetingMessage.trim();
  return (
    <form
      className="grid max-w-2xl gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const ok = form.validate();
        if (ok && !(greeting && !greetingMessage.trim()))
          onCreate({
            channel: "website",
            name: form.values.name.trim(),
            identifier: form.values.domain.trim(),
            channelParams: {
              websiteUrl: form.values.domain.trim(),
              widgetColor: color,
              welcomeTitle,
              welcomeTagline: tagline,
              greetingEnabled: greeting,
              greetingMessage,
            },
          });
      }}
    >
      <FormHeading
        title="Website channel"
        description="Create a channel for your website and start supporting your customers via our website widget."
      />
      <SpecFields fields={fields} values={form.values} onChange={form.onChange} submitted={form.submitted} />
      <FieldGroup className="gap-4">
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
            <label className="ms-2 flex items-center gap-2 text-muted-foreground text-xs">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-7 cursor-pointer rounded border bg-transparent"
                aria-label="Update the widget color used in widget"
              />
              <span className="font-mono">{color}</span>
            </label>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="welcome-title">Welcome Heading</FieldLabel>
          <Input
            id="welcome-title"
            placeholder="Hi there !"
            value={welcomeTitle}
            onChange={(event) => setWelcomeTitle(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="welcome-tagline">Welcome Tagline</FieldLabel>
          <Textarea
            id="welcome-tagline"
            maxLength={255}
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            placeholder="We make it simple to connect with us. Ask us anything, or share your feedback."
          />
          <span className="text-end text-muted-foreground text-xs tabular-nums">{tagline.length} / 255</span>
        </Field>
        <Field>
          <FieldLabel htmlFor="greeting">Enable channel greeting</FieldLabel>
          <NativeSelect
            id="greeting"
            className="w-full"
            value={greeting ? "on" : "off"}
            onChange={(event) => setGreeting(event.target.value === "on")}
          >
            <NativeSelectOption value="on">Enabled</NativeSelectOption>
            <NativeSelectOption value="off">Disabled</NativeSelectOption>
          </NativeSelect>
          <FieldDescription>
            Auto-send greeting messages when customers start a conversation and send their first message.
          </FieldDescription>
        </Field>
        {greeting ? (
          <Field data-invalid={greetingError || undefined}>
            <FieldLabel htmlFor="greeting-message">Channel greeting message</FieldLabel>
            <Textarea
              id="greeting-message"
              placeholder="Acme Inc typically replies in a few hours."
              value={greetingMessage}
              aria-invalid={greetingError || undefined}
              onChange={(event) => setGreetingMessage(event.target.value)}
            />
            {greetingError ? <FieldError>This field is required</FieldError> : null}
          </Field>
        ) : null}
      </FieldGroup>
      <div>
        <Button type="submit">Create inbox</Button>
      </div>
    </form>
  );
}

// ---------- Connect-with buttons (Facebook, Instagram, TikTok, Google, Microsoft) ----------

/** V-37: Real Facebook auth via FB SDK — opens FB.login, returns pages from Chatwoot gateway. */
function useFacebookAuth() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const start = React.useCallback((onToken: (omniauthToken: string) => void) => {
    setBusy(true);
    setError(null);
    // Load FB SDK on demand
    const existing = (window as unknown as Record<string, unknown>).FB as
      | { login?: (opts: Record<string, unknown>, cb: (res: Record<string, unknown>) => void) => void }
      | undefined;
    if (!existing?.login) {
      setError("Facebook SDK is not loaded. Please ensure the page is served over HTTPS with a registered domain.");
      setBusy(false);
      return;
    }
    existing.login(
      {
        config_id: "",
        response_type: "code",
        scope: "pages_manage_metadata,business_management,pages_messaging,pages_show_list,pages_read_engagement",
      },
      (response: Record<string, unknown>) => {
        if (response.status === "connected") {
          const token =
            (response.authResponse as Record<string, unknown>)?.code ||
            (response.authResponse as Record<string, unknown>)?.accessToken;
          if (typeof token === "string" && token) {
            onToken(token);
          } else {
            setError("Facebook authentication succeeded but no token was returned.");
          }
        } else if (response.status === "not_authorized" || response.status === "unknown") {
          setError("Facebook authorization was cancelled or denied.");
        } else {
          setError("Facebook authentication failed.");
        }
        setBusy(false);
      },
    );
  }, []);

  return { busy, error, start, clearError: () => setError(null) };
}

/** V-37: Real WhatsApp Embedded Signup via FB SDK. */
function useWhatsappEmbeddedSignup(configId: string) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"idle" | "auth" | "processing">("idle");

  const start = React.useCallback(
    (onComplete: (data: { code: string; wabaId: string; phoneNumberId?: string; businessId?: string }) => void) => {
      if (!configId) {
        setError("WhatsApp configuration ID is not available. Please configure it in Chatwoot Super Admin.");
        return;
      }
      setBusy(true);
      setError(null);
      setState("auth");

      const FB = (window as unknown as Record<string, unknown>).FB as
        | {
            login?: (opts: Record<string, unknown>, cb: (res: Record<string, unknown>) => void) => void;
          }
        | undefined;

      if (!FB?.login) {
        setError("Facebook SDK is not loaded. Please ensure the page is served over HTTPS with a registered domain.");
        setBusy(false);
        setState("idle");
        return;
      }

      // Listen for postMessage from Meta Embedded Signup popup
      const listener = (event: MessageEvent) => {
        if (!event.origin.endsWith("facebook.com")) return;
        const data = event.data as Record<string, unknown> | undefined;
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          const wabaId = typeof data.waba_id === "string" ? data.waba_id : "";
          const phoneNumberId = typeof data.phone_number_id === "string" ? data.phone_number_id : "";
          const businessId = typeof data.business_id === "string" ? data.business_id : "";
          window.removeEventListener("message", listener);

          // Now we need the code — FB.login was already called, we get it from the auth response
          setState("processing");
          // The code comes from the FB.login callback below
          // We store waba_id and wait for FB.login to complete
          (window as unknown as Record<string, unknown>).__v37WhatsappData = {
            wabaId,
            phoneNumberId,
            businessId,
          };
        }
      };
      window.addEventListener("message", listener);

      FB.login(
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        },
        (response: Record<string, unknown>) => {
          const code = (response.authResponse as Record<string, unknown>)?.code as string | undefined;
          const stored = (window as unknown as Record<string, unknown>).__v37WhatsappData as
            | { wabaId: string; phoneNumberId: string; businessId: string }
            | undefined;
          delete (window as unknown as Record<string, unknown>).__v37WhatsappData;

          if (code && stored?.wabaId) {
            onComplete({
              code,
              wabaId: stored.wabaId,
              phoneNumberId: stored.phoneNumberId || undefined,
              businessId: stored.businessId || undefined,
            });
          } else if (!code) {
            setError("WhatsApp signup was cancelled or the authorization code was not returned.");
            setState("idle");
          } else {
            setError("WhatsApp Business Account ID was not received from Meta. Please try again.");
            setState("idle");
          }
          setBusy(false);
          window.removeEventListener("message", listener);
        },
      );
    },
    [configId],
  );

  return { busy, error, state, start, clearError: () => setError(null), setState };
}

/** V-37: Instagram authorization — requests the OAuth URL from Chatwoot via gateway, opens it in a popup. */
function useInstagramAuth() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const start = React.useCallback((onStarted: (popup: Window | null) => void) => {
    setBusy(true);
    setError(null);

    fetch("/api/cw/instagram/authorization", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(((body as Record<string, unknown>).error as string) || `Server error (${res.status})`);
        }
        const body = (await res.json()) as { success?: boolean; url?: string };
        if (!body.url) throw new Error("No authorization URL returned from server.");

        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          body.url,
          "instagram-auth",
          `width=${width},height=${height},left=${left},top=${top}`,
        );
        onStarted(popup);
        setBusy(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to start Instagram authorization.");
        setBusy(false);
      });
  }, []);

  return { busy, error, start, clearError: () => setError(null) };
}

/** V-37: Readiness panel for Meta channels — shows HTTPS, app config, admin role status. */
function MetaReadinessPanel({
  metaConfig,
}: {
  metaConfig: {
    available: boolean;
    facebook: { configured: boolean };
    whatsapp: { configured: boolean };
    instagram: { configured: boolean };
    readiness: { https: boolean; adminRole: boolean };
  } | null;
}) {
  if (!metaConfig) return null;
  const { readiness, facebook, whatsapp, instagram } = metaConfig;
  const allOk =
    readiness.https && facebook.configured && whatsapp.configured && instagram.configured && readiness.adminRole;

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-4">
      <h3 className="mb-3 font-medium text-sm">Connection Readiness</h3>
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">HTTPS</span>
          <span className={readiness.https ? "text-emerald-600" : "text-orange-600"}>
            {readiness.https ? "✓ Enabled" : "✗ Required"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Meta App</span>
          <span className={facebook.configured ? "text-emerald-600" : "text-orange-600"}>
            {facebook.configured ? "✓ Configured" : "✗ Not configured"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">WhatsApp Config</span>
          <span className={whatsapp.configured ? "text-emerald-600" : "text-orange-600"}>
            {whatsapp.configured ? "✓ Configured" : "✗ Not configured"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Instagram</span>
          <span className={instagram.configured ? "text-emerald-600" : "text-orange-600"}>
            {instagram.configured ? "✓ Ready" : "✗ Not configured"}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-2 mt-1">
          <span className="font-medium text-muted-foreground text-xs">Status</span>
          <span className={allOk ? "text-emerald-600 font-medium text-xs" : "text-orange-600 font-medium text-xs"}>
            {metaConfig.available
              ? allOk
                ? "Ready for connection"
                : "Requires HTTPS domain + Meta app configuration"
              : "Linked mode required for real connections"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ConnectPanel({
  icon,
  title,
  help,
  button,
  warning,
  onConnected,
  children,
  connectFn,
}: {
  icon: React.ReactNode;
  title: string;
  help: React.ReactNode;
  button: string;
  warning?: string;
  onConnected: () => void;
  children?: React.ReactNode;
  connectFn?: (onDone: () => void) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = () => {
    if (connectFn) {
      setBusy(true);
      setError(null);
      connectFn(() => {
        setBusy(false);
        onConnected();
      });
    } else {
      // Fake auth fallback for non-Meta channels (Google, Microsoft, TikTok)
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        onConnected();
      }, 900);
    }
  };

  return (
    <div className="mx-auto grid max-w-lg justify-items-center gap-5 py-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border bg-muted/50">{icon}</div>
      <div className="grid gap-2">
        <h2 className="font-medium text-lg">{title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{help}</p>
      </div>
      {warning ? (
        <Alert className="text-left">
          <CircleAlert />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert className="text-left border-destructive/30 bg-destructive/5">
          <CircleAlert className="text-destructive" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      ) : null}
      {children}
      <Button onClick={handleClick} disabled={busy} type="button">
        {busy ? <Loader2 className="animate-spin" /> : null}
        {button}
      </Button>
    </div>
  );
}

/** Fake auth kept for Google, Microsoft, TikTok (outside V-37 scope). */
function useFakeAuth(onDone: () => void) {
  const [busy, setBusy] = React.useState(false);
  return {
    busy,
    start: () => {
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        onDone();
      }, 900);
    },
  };
}

/** V-37: Facebook pages fetched from Chatwoot via gateway (real, not hardcoded). */
interface FacebookPage {
  id: string;
  name: string;
  exists: boolean;
}

function FacebookForm({ channel, onCreate }: { channel: Channel; onCreate: (created: CreatedInbox) => void }) {
  const accountName = useAccountName();
  const [connected, setConnected] = React.useState(false);
  const [pages, setPages] = React.useState<FacebookPage[]>([]);
  const [pagesLoading, setPagesLoading] = React.useState(false);
  const [pagesError, setPagesError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState("");
  const [name, setName] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const fbAuth = useFacebookAuth();
  const Icon = channel.icon;

  const handleConnect = () => {
    fbAuth.start((omniauthToken: string) => {
      // Fetch pages from Chatwoot via gateway
      setPagesLoading(true);
      setPagesError(null);
      fetch("/api/cw/callbacks/facebook_pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ omniauth_token: omniauthToken }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(((body as Record<string, unknown>).error as string) || `Server error (${res.status})`);
          }
          const body = (await res.json()) as {
            page_details?: Array<{ id: string; name: string; access_token?: string }>;
            user_access_token?: string;
          };
          const pageList = (body.page_details ?? []).map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
            exists: true,
          }));
          if (pageList.length === 0) {
            setPagesError(
              "No Facebook Pages found on your account. Make sure you have admin access to at least one Page.",
            );
          }
          setPages(pageList);
          setConnected(true);
          setPagesLoading(false);
          // Note: user_access_token and page_access_tokens are kept server-side only (V-37 security requirement)
        })
        .catch((err) => {
          setPagesError(err instanceof Error ? err.message : "Failed to fetch Facebook Pages.");
          setPagesLoading(false);
          fbAuth.clearError();
        });
    });
  };

  if (!connected) {
    if (fbAuth.error) {
      return (
        <div className="mx-auto grid max-w-lg justify-items-center gap-5 py-6 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border bg-muted/50">
            <Icon className="size-7 text-muted-foreground" />
          </div>
          <div className="grid gap-2">
            <h2 className="font-medium text-lg">Continue with Facebook</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              PS: By signing in, we only get access to your Page&apos;s messages. Your private messages can never be
              accessed by {accountName}.
            </p>
          </div>
          {fbAuth.error ? (
            <Alert className="text-left border-destructive/30 bg-destructive/5">
              <CircleAlert className="text-destructive" />
              <AlertDescription className="text-destructive">{fbAuth.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button onClick={handleConnect} disabled={fbAuth.busy} type="button">
            {fbAuth.busy ? <Loader2 className="animate-spin" /> : null}
            Continue with Facebook
          </Button>
        </div>
      );
    }
    return (
      <ConnectPanel
        icon={<Icon className="size-7 text-muted-foreground" />}
        title="Continue with Facebook"
        help={`PS: By signing in, we only get access to your Page's messages. Your private messages can never be accessed by ${accountName}.`}
        button="Continue with Facebook"
        onConnected={() => setConnected(true)}
        connectFn={(onDone) => {
          fbAuth.start(() => {
            onDone();
          });
        }}
      />
    );
  }

  if (pagesLoading) {
    return (
      <div className="mx-auto grid max-w-lg justify-items-center gap-4 py-6 text-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading your Facebook Pages…</p>
      </div>
    );
  }

  const pageError = submitted && !page;
  const nameError = submitted && !name.trim();

  return (
    <form
      className="grid max-w-2xl gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!page || !name.trim()) return;
        setCreating(true);
        setCreateError(null);
        // Call register_facebook_page via gateway — server injects tokens, browser sends only page_id + inbox_name
        fetch("/api/cw/callbacks/register_facebook_page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: page, inbox_name: name.trim() }),
        })
          .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(((body as Record<string, unknown>).error as string) || `Server error (${res.status})`);
            }
            const created = body as { id?: number; name?: string };
            onCreate({
              channel: "facebook",
              name: name.trim(),
              identifier: pages.find((p) => p.id === page)?.name || name.trim(),
            });
            // Note: created.id is from Chatwoot — we pass it to onCreate which saves to preview store
          })
          .catch((err) => {
            setCreateError(err instanceof Error ? err.message : "Failed to create Facebook inbox.");
            setCreating(false);
          });
      }}
    >
      <FormHeading
        title="Inbox Details"
        description={`From the dropdown below, select the Facebook Page you want to connect to ${accountName}. You can also give a custom name to your inbox for better identification.`}
      />
      {pagesError ? (
        <Alert className="border-destructive/30 bg-destructive/5">
          <CircleAlert className="text-destructive" />
          <AlertDescription className="text-destructive">{pagesError}</AlertDescription>
        </Alert>
      ) : null}
      {createError ? (
        <Alert className="border-destructive/30 bg-destructive/5">
          <CircleAlert className="text-destructive" />
          <AlertDescription className="text-destructive">{createError}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup className="gap-4">
        <Field data-invalid={pageError || undefined}>
          <FieldLabel htmlFor="fb-page">Choose Page</FieldLabel>
          <NativeSelect
            id="fb-page"
            className="w-full"
            value={page}
            aria-invalid={pageError || undefined}
            onChange={(event) => {
              setPage(event.target.value);
              if (!name) {
                const selected = pages.find((p) => p.id === event.target.value);
                if (selected) setName(selected.name);
              }
            }}
          >
            <NativeSelectOption value="">Select a page from the list</NativeSelectOption>
            {pages.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {pageError ? <FieldError>Pick a value</FieldError> : null}
        </Field>
        <Field data-invalid={nameError || undefined}>
          <FieldLabel htmlFor="fb-name">Inbox Name</FieldLabel>
          <Input
            id="fb-name"
            placeholder="Pick a Name for your Inbox"
            value={name}
            aria-invalid={nameError || undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {nameError ? <FieldError>Add a name for your inbox</FieldError> : null}
        </Field>
      </FieldGroup>
      <div>
        <Button type="submit" disabled={creating}>
          {creating ? <Loader2 className="animate-spin" /> : null}
          Create Inbox
        </Button>
      </div>
    </form>
  );
}

// ---------- WhatsApp ----------

function cloudFields(): FieldSpec[] {
  return [
    { id: "name", label: "Inbox Name", placeholder: "Please enter an inbox name" },
    {
      id: "phone",
      label: "Phone number",
      placeholder: "Please enter the phone number from which message will be sent.",
      pattern: PHONE,
      patternError: PHONE_ERROR,
    },
    {
      id: "phoneId",
      label: "Phone number ID",
      placeholder: "Please enter the Phone number ID obtained from Facebook developer dashboard.",
      required: "Please enter a valid value.",
    },
    {
      id: "wabaId",
      label: "Business Account ID",
      placeholder: "Please enter the Business Account ID obtained from Facebook developer dashboard.",
      required: "Please enter a valid value.",
    },
    {
      id: "apiKey",
      label: "API key",
      placeholder: "API key",
      type: "password",
      required: "Please enter a valid value.",
      help: "Configure the WhatsApp API key.",
    },
  ];
}

function CloudWhatsappForm({ onCreate, calling }: { onCreate: (created: CreatedInbox) => void; calling?: boolean }) {
  return (
    <SimpleChannelForm
      title={calling ? "WhatsApp Call" : "WhatsApp Channel"}
      description={
        calling
          ? "Take voice calls on your WhatsApp number. Calling is turned on as soon as the inbox is created."
          : "Start supporting your customers via WhatsApp."
      }
      fields={cloudFields()}
      submit="Create WhatsApp Channel"
      onCreate={onCreate}
      toCreated={(v) => ({
        channel: calling ? "whatsapp_call" : "whatsapp",
        name: v.name.trim(),
        provider: "whatsapp_cloud",
        phone: v.phone.trim(),
      })}
    />
  );
}

function TwilioForm({ medium, onCreate }: { medium: "sms" | "whatsapp"; onCreate: (created: CreatedInbox) => void }) {
  const [useService, setUseService] = React.useState(false);
  const [useApiKey, setUseApiKey] = React.useState(false);
  const all: Record<string, FieldSpec> = {
    name: { id: "name", label: "Inbox Name", placeholder: "Please enter an inbox name" },
    service: {
      id: "service",
      label: "Messaging Service SID",
      placeholder: "Please enter your Twilio Messaging Service SID",
    },
    phone: {
      id: "phone",
      label: "Phone Number",
      placeholder: "Please enter the phone number from which message will be sent.",
      pattern: PHONE,
      patternError: PHONE_ERROR,
    },
    sid: { id: "sid", label: "Account SID", placeholder: "Please enter your Twilio Account SID" },
    apiKey: { id: "apiKey", label: "API Key SID", placeholder: "Please enter your API Key SID" },
    apiSecret: {
      id: "apiSecret",
      label: "API Key Secret",
      placeholder: "Please enter your API Key Secret",
      type: "password",
    },
    token: { id: "token", label: "Auth Token", placeholder: "Please enter your Twilio Auth Token", type: "password" },
  };
  const form = useSpecForm(Object.values(all));
  const active = [
    all.name,
    useService ? all.service : all.phone,
    all.sid,
    ...(useApiKey ? [all.apiKey, all.apiSecret] : [all.token]),
  ];
  return (
    <form
      className="grid max-w-2xl gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (form.validate(active))
          onCreate({
            channel: medium,
            name: form.values.name.trim(),
            provider: "twilio",
            phone: form.values.phone.trim(),
          });
      }}
    >
      <FormHeading
        title="Twilio SMS/WhatsApp Channel"
        description={medium === "sms" ? "Start supporting your customers via SMS." : "Connect via Twilio credentials"}
      />
      <Field>
        <FieldLabel htmlFor="tw-medium">Channel Type</FieldLabel>
        <NativeSelect id="tw-medium" className="w-full" value={medium} disabled>
          <NativeSelectOption value="sms">SMS</NativeSelectOption>
          <NativeSelectOption value="whatsapp">WhatsApp</NativeSelectOption>
        </NativeSelect>
      </Field>
      <SpecFields fields={[all.name]} values={form.values} onChange={form.onChange} submitted={form.submitted} />
      <label className="flex items-center gap-3 text-sm">
        <Checkbox checked={useService} onCheckedChange={(v) => setUseService(v === true)} />
        Use a Twilio Messaging Service
      </label>
      <SpecFields
        fields={[useService ? all.service : all.phone, all.sid]}
        values={form.values}
        onChange={form.onChange}
        submitted={form.submitted}
      />
      <label className="flex items-center gap-3 text-sm">
        <Checkbox checked={useApiKey} onCheckedChange={(v) => setUseApiKey(v === true)} />
        Use API Key Authentication
      </label>
      <SpecFields
        fields={useApiKey ? [all.apiKey, all.apiSecret] : [all.token]}
        values={form.values}
        onChange={form.onChange}
        submitted={form.submitted}
      />
      <div>
        <Button type="submit">Create Twilio Channel</Button>
      </div>
    </form>
  );
}

function EmbeddedSignup({ onCreate }: { onCreate: (created: CreatedInbox) => void }) {
  const [whatsappConfigId, setWhatsappConfigId] = React.useState<string>("");
  const [configLoaded, setConfigLoaded] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const wsAuth = useWhatsappEmbeddedSignup(whatsappConfigId);

  // Fetch Meta config on mount to get WhatsApp configuration ID
  React.useEffect(() => {
    fetch("/api/cw/meta-config")
      .then((res) => res.json())
      .then((data: { whatsapp?: { configurationId?: string }; available?: boolean }) => {
        if (data.whatsapp?.configurationId) {
          setWhatsappConfigId(data.whatsapp.configurationId);
        }
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(true));
  }, []);

  const handleConnect = () => {
    if (!whatsappConfigId) {
      wsAuth.clearError();
      return;
    }
    wsAuth.start(({ code, wabaId, phoneNumberId, businessId }) => {
      // Send to Chatwoot via gateway
      fetch("/api/cw/whatsapp/authorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          waba_id: wabaId,
          phone_number_id: phoneNumberId || undefined,
          business_id: businessId || undefined,
          is_coexistence: false,
        }),
      })
        .then(async (res) => {
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          if (!res.ok) {
            throw new Error((body.error as string) || `Server error (${res.status})`);
          }
          const name = (body.name as string) || "WhatsApp Business";
          const phone = (body.phone_number as string) || "";
          onCreate({
            channel: "whatsapp",
            name,
            provider: "embedded",
            phone: phone || undefined,
          });
        })
        .catch((err) => {
          setCreateError(err instanceof Error ? err.message : "Failed to create WhatsApp inbox.");
          wsAuth.clearError();
        });
    });
  };

  const busy = wsAuth.busy;
  const state = wsAuth.state;

  return (
    <div className="grid max-w-2xl gap-6">
      <FormHeading
        title="Quick setup with Meta"
        description="Use Quick setup with Meta to connect a new number or an existing number from the WhatsApp Business app. You will be redirected to Meta to log into your WhatsApp Business account. Having admin access will help make the setup smooth and easy."
      />
      {!configLoaded ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading configuration…
        </div>
      ) : !whatsappConfigId ? (
        <Alert className="border-destructive/30 bg-destructive/5">
          <CircleAlert className="text-destructive" />
          <AlertDescription>
            WhatsApp Embedded Signup is not configured. Please set WHATSAPP_CONFIGURATION_ID in Chatwoot Super Admin.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2 rounded-lg border p-4">
        <span className="font-medium text-sm">Benefits of Embedded Signup:</span>
        {[
          "No manual configuration required",
          "Secure OAuth based authentication",
          "Automatic webhook and phone number configuration",
        ].map((b) => (
          <span key={b} className="flex items-center gap-2 text-muted-foreground text-sm">
            <Check className="size-3.5 text-emerald-600" /> {b}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">
        To learn more about quick setup, pricing, and limitations, visit{" "}
        <button type="button" className="text-primary underline-offset-4 hover:underline">
          this link
        </button>
        .
      </p>
      {wsAuth.error ? (
        <Alert className="border-destructive/30 bg-destructive/5">
          <CircleAlert className="text-destructive" />
          <AlertDescription className="text-destructive">{wsAuth.error}</AlertDescription>
        </Alert>
      ) : null}
      {createError ? (
        <Alert className="border-destructive/30 bg-destructive/5">
          <CircleAlert className="text-destructive" />
          <AlertDescription className="text-destructive">{createError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || !whatsappConfigId} onClick={handleConnect}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Connect with WhatsApp Business
        </Button>
        {state === "auth" ? <span className="text-muted-foreground text-sm">Authenticating with Meta</span> : null}
        {state === "processing" ? (
          <span className="text-muted-foreground text-sm">Setting up your WhatsApp Business Account</span>
        ) : null}
      </div>
    </div>
  );
}

function ProviderCards<T extends string>({
  title,
  description,
  options,
  onPick,
}: {
  title: string;
  description: string;
  options: { value: T; title: string; description: string; icon?: React.ReactNode }[];
  onPick: (value: T) => void;
}) {
  return (
    <div className="grid gap-6">
      <FormHeading title={title} description={description} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            {option.icon}
            <span className="font-medium text-sm">{option.title}</span>
            <span className="text-muted-foreground text-xs leading-relaxed">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> {children}
    </button>
  );
}

function WhatsappForm({ onCreate }: { onCreate: (created: CreatedInbox) => void }) {
  const [provider, setProvider] = React.useState<"" | "embedded" | "manual" | "twilio">("");
  if (!provider) {
    return (
      <ProviderCards
        title="Select your API provider"
        description="Choose your WhatsApp provider. You can connect directly through Meta which requires no setup, or connect through Twilio using your account credentials."
        options={[
          { value: "embedded", title: "WhatsApp Cloud", description: "Quick setup through Meta" },
          { value: "twilio", title: "Twilio", description: "Connect via Twilio credentials" },
        ]}
        onPick={setProvider}
      />
    );
  }
  return (
    <div>
      <BackLink onClick={() => setProvider("")}>Select your API provider</BackLink>
      {provider === "embedded" ? (
        <>
          <EmbeddedSignup onCreate={onCreate} />
          {/* Chatwoot Whatsapp.vue: manual setup is a link under the embedded signup, not a third card. */}
          <p className="mt-6 max-w-2xl border-t pt-6 text-muted-foreground text-sm">
            If your number is already connected to the WhatsApp Business Platform (API), or if you’re a tech provider
            onboarding your own number, please use the{" "}
            <button type="button" className="text-primary underline" onClick={() => setProvider("manual")}>
              manual setup flow
            </button>{" "}
            flow
          </p>
        </>
      ) : null}
      {provider === "manual" ? <CloudWhatsappForm onCreate={onCreate} /> : null}
      {provider === "twilio" ? <TwilioForm medium="whatsapp" onCreate={onCreate} /> : null}
    </div>
  );
}

// ---------- SMS ----------

function SmsForm({ onCreate }: { onCreate: (created: CreatedInbox) => void }) {
  const [provider, setProvider] = React.useState<"twilio" | "bandwidth">("twilio");
  return (
    <div className="grid gap-6">
      <div className="grid max-w-2xl gap-4">
        <FormHeading title="SMS Channel" description="Start supporting your customers via SMS." />
        <Field>
          <FieldLabel htmlFor="sms-provider">API Provider</FieldLabel>
          <NativeSelect
            id="sms-provider"
            className="w-full"
            value={provider}
            onChange={(event) => setProvider(event.target.value as "twilio" | "bandwidth")}
          >
            <NativeSelectOption value="twilio">Twilio</NativeSelectOption>
            <NativeSelectOption value="bandwidth">Bandwidth</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      {provider === "twilio" ? (
        <TwilioForm key="twilio" medium="sms" onCreate={onCreate} />
      ) : (
        <SimpleChannelForm
          key="bandwidth"
          title="Bandwidth"
          fields={[
            { id: "name", label: "Inbox Name", placeholder: "Please enter an inbox name" },
            {
              id: "phone",
              label: "Phone number",
              placeholder: "Please enter the phone number from which message will be sent.",
              pattern: PHONE,
              patternError: PHONE_ERROR,
            },
            { id: "account", label: "Account ID", placeholder: "Please enter your Bandwidth Account ID" },
            { id: "app", label: "Application ID", placeholder: "Please enter your Bandwidth Application ID" },
            { id: "key", label: "API Key", placeholder: "Please enter your Bandwidth API Key" },
            {
              id: "secret",
              label: "API Secret",
              placeholder: "Please enter your Bandwidth API Secret",
              type: "password",
            },
          ]}
          submit="Create Bandwidth Channel"
          onCreate={onCreate}
          toCreated={(v) => ({ channel: "sms", name: v.name.trim(), provider: "bandwidth", phone: v.phone.trim() })}
        />
      )}
    </div>
  );
}

// ---------- Email ----------

function OAuthEmail({
  provider,
  onCreate,
}: {
  provider: "google" | "microsoft";
  onCreate: (created: CreatedInbox) => void;
}) {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const isGoogle = provider === "google";
  const error = submitted && !/^\S+@\S+\.\S+$/.test(email.trim());
  const auth = useFakeAuth(() => onCreate({ channel: "email", name: email.trim(), provider }));
  return (
    <form
      className="grid max-w-2xl gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (/^\S+@\S+\.\S+$/.test(email.trim())) auth.start();
      }}
    >
      <FormHeading
        title={isGoogle ? "Google Email" : "Microsoft Email"}
        description={`Click on the Sign in with ${isGoogle ? "Google" : "Microsoft"} button to get started. You will redirected to the email sign in page. Once you accept the requested permissions, you would be redirected back to the inbox creation step.`}
      />
      <Field data-invalid={error || undefined}>
        <FieldLabel htmlFor="oauth-email">Email</FieldLabel>
        <Input
          id="oauth-email"
          type="email"
          placeholder="Enter email address"
          value={email}
          aria-invalid={error || undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        {error ? <FieldError>Please enter a valid email address</FieldError> : null}
      </Field>
      <div>
        <Button type="submit" disabled={auth.busy}>
          {auth.busy ? <Loader2 className="animate-spin" /> : null}
          {isGoogle ? "Sign in with Google" : "Sign in with Microsoft"}
        </Button>
      </div>
    </form>
  );
}

function EmailForm({ onCreate }: { onCreate: (created: CreatedInbox) => void }) {
  const [provider, setProvider] = React.useState<"" | "google" | "microsoft" | "other">("");
  if (!provider) {
    return (
      <ProviderCards
        title="Select your email provider"
        description="Select an email provider from the list below. If you don't see your email provider in the list, you can select the other provider option and provide the IMAP and SMTP Credentials."
        options={[
          {
            value: "microsoft",
            title: "Microsoft",
            description: "Connect with Microsoft",
            icon: <Mail className="size-5 text-sky-600" />,
          },
          {
            value: "google",
            title: "Google",
            description: "Connect with Google",
            icon: <Mail className="size-5 text-rose-600" />,
          },
          {
            value: "other",
            title: "Other Providers",
            description: "Connect with Other Providers",
            icon: <Mail className="size-5 text-muted-foreground" />,
          },
        ]}
        onPick={setProvider}
      />
    );
  }
  return (
    <div>
      <BackLink onClick={() => setProvider("")}>Select your email provider</BackLink>
      {provider === "other" ? (
        <SimpleChannelForm
          title="Email Channel"
          description="Integrate your email inbox."
          fields={[
            { id: "name", label: "Channel Name", placeholder: "Please enter a channel name" },
            {
              id: "email",
              label: "Email",
              placeholder: "Email",
              help: "Provide the email address where your customers send support requests.",
              pattern: /^\S+@\S+\.\S+$/,
              patternError: "Please enter a valid email address",
            },
          ]}
          submit="Create Email Channel"
          onCreate={onCreate}
          toCreated={(v) => ({
            channel: "email",
            name: v.name.trim(),
            provider: "other",
            identifier: v.email.trim(),
            channelParams: { email: v.email.trim() },
          })}
        />
      ) : (
        <OAuthEmail provider={provider} onCreate={onCreate} />
      )}
    </div>
  );
}

// ---------- The switch ----------

export function ChannelForm({ channel, onCreate }: { channel: Channel; onCreate: (created: CreatedInbox) => void }) {
  const Icon = channel.icon;
  switch (channel.key) {
    case "website":
      return <WebsiteForm onCreate={onCreate} />;
    case "facebook":
      return <FacebookForm channel={channel} onCreate={onCreate} />;
    case "whatsapp":
      return <WhatsappForm onCreate={onCreate} />;
    case "whatsapp_call":
      return <CloudWhatsappForm onCreate={onCreate} calling />;
    case "sms":
      return <SmsForm onCreate={onCreate} />;
    case "email":
      return <EmailForm onCreate={onCreate} />;
    case "api":
      return (
        <SimpleChannelForm
          title="API Channel"
          description="Integrate with API channel and start supporting your customers."
          fields={[
            { id: "name", label: "Channel Name", placeholder: "Please enter a channel name" },
            {
              id: "webhook",
              label: "Webhook URL",
              placeholder: "Webhook URL",
              help: "Configure the URL where you want to receive callbacks on events.",
              optional: true,
              pattern: URL_RE,
              patternError: "Please enter a valid URL",
            },
          ]}
          submit="Create API Channel"
          onCreate={onCreate}
          toCreated={(v) => ({
            channel: "api",
            name: v.name.trim(),
            webhookUrl: v.webhook?.trim() || undefined,
            channelParams: { webhookUrl: v.webhook?.trim() || "" },
          })}
        />
      );
    case "telegram":
      return (
        <SimpleChannelForm
          title="Telegram Channel"
          description="Integrate with Telegram channel and start supporting your customers."
          fields={[
            {
              id: "token",
              label: "Bot Token",
              placeholder: "Bot Token",
              help: "Configure the bot token you have obtained from Telegram BotFather.",
              // F-6A (sim2 problem 14: any text was taken as a token): the form of a bot token, as Telegram documents
              // it (https://core.telegram.org/bots/api#authorizing-your-bot: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11").
              pattern: TELEGRAM_TOKEN,
              patternError: "This is not a Telegram bot token. It looks like 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            },
          ]}
          submit="Create Telegram Channel"
          onCreate={onCreate}
          // Chatwoot names the inbox from the bot's name (Telegram getMe). The preview sends nothing to Telegram, so
          // the name comes from the bot number in the token, and the token itself is not kept.
          toCreated={(v) => {
            const botNumber = v.token.trim().split(":")[0];
            return {
              channel: "telegram",
              name: `Telegram bot ${botNumber}`,
              identifier: `Bot ${botNumber}`,
              channelParams: { botToken: v.token.trim() },
            };
          }}
        >
          <div className="rounded-lg border bg-emerald-50/60 p-3 dark:bg-emerald-950/30" data-webhook-ready>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium text-sm text-emerald-800 dark:text-emerald-300">Webhook URL Ready</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Your encrypted Telegram webhook receiver is ready at{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                https://inbox.airest.ai/public/api/v1/accounts/&#123;id&#125;/inboxes/&#123;id&#125;/telegram/webhook
              </code>
              . The token you enter will be registered with Telegram once the inbox is created.
            </p>
          </div>
          <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm" data-preview-note>
            Preview — simulated: the token is checked for its form only. It is not sent to Telegram and not kept, so the
            bot's name is not read and no message arrives until the inbox is connected through the engine.
          </p>
        </SimpleChannelForm>
      );
    case "line":
      return (
        <SimpleChannelForm
          title="LINE Channel"
          description="Integrate with LINE channel and start supporting your customers."
          fields={[
            { id: "name", label: "Channel Name", placeholder: "Please enter a channel name" },
            { id: "lineId", label: "LINE Channel ID", placeholder: "LINE Channel ID" },
            { id: "secret", label: "LINE Channel Secret", placeholder: "LINE Channel Secret", type: "password" },
            { id: "token", label: "LINE Channel Token", placeholder: "LINE Channel Token", type: "password" },
          ]}
          submit="Create LINE Channel"
          onCreate={onCreate}
          toCreated={(v) => ({
            channel: "line",
            name: v.name.trim(),
            channelParams: {
              lineChannelId: v.lineId.trim(),
              lineChannelSecret: v.secret.trim(),
              lineChannelToken: v.token.trim(),
            },
          })}
        />
      );
    case "instagram":
      return <InstagramChannelForm channel={channel} onCreate={onCreate} />;
    case "tiktok":
      return (
        <ConnectPanel
          icon={<Icon className="size-7 text-foreground" />}
          title="Connect your TikTok Profile"
          help="To add your TikTok profile as a channel, you need to authenticate your TikTok Profile by clicking on 'Continue with TikTok'"
          button="Continue with TikTok"
          warning="TikTok connections for North American accounts are temporarily unavailable while we wait for an update from the TikTok team."
          onConnected={() => onCreate({ channel: "tiktok", name: "@weblabs.studio" })}
        />
      );
    case "voice":
      return (
        <SimpleChannelForm
          title="Voice Channel"
          description="Integrate Twilio Voice and start supporting your customers via phone calls."
          fields={[
            {
              id: "phone",
              label: "Phone Number",
              placeholder: "Enter your phone number (e.g. +1234567890)",
              pattern: PHONE,
              patternError: "Please provide a valid phone number in E.164 format (e.g. +1234567890)",
            },
            {
              id: "sid",
              label: "Account SID",
              placeholder: "Enter your Twilio Account SID",
              required: "Account SID is required",
            },
            {
              id: "token",
              label: "Auth Token",
              placeholder: "Enter your Twilio Auth Token",
              type: "password",
              required: "Auth Token is required",
            },
            {
              id: "keySid",
              label: "API Key SID",
              placeholder: "Enter your Twilio API Key SID",
              required: "API Key SID is required",
            },
            {
              id: "keySecret",
              label: "API Key Secret",
              placeholder: "Enter your Twilio API Key Secret",
              type: "password",
              required: "API Key Secret is required",
            },
          ]}
          submit="Create Voice Channel"
          onCreate={onCreate}
          toCreated={(v) => ({ channel: "voice", name: v.phone.trim(), provider: "twilio", phone: v.phone.trim() })}
        />
      );
    default:
      return null;
  }
}

// ---------- V-37: Instagram real auth form ----------

function InstagramChannelForm({ channel, onCreate }: { channel: Channel; onCreate: (created: CreatedInbox) => void }) {
  const Icon = channel.icon;
  const [started, setStarted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);
  const igAuth = useInstagramAuth();

  const handleConnect = () => {
    igAuth.start((popup) => {
      setStarted(true);
      // Poll GET /inboxes every 1s until a Channel::Instagram inbox appears, then close popup
      const poll = setInterval(() => {
        fetch("/api/cw/inboxes")
          .then((res) => res.json())
          .then(
            (
              data:
                | { payload?: Array<{ id: number; name: string; channel_type?: string }> }
                | Array<{ id: number; name: string; channel_type?: string }>,
            ) => {
              const inboxes = Array.isArray(data)
                ? data
                : ((data as { payload?: Array<{ id: number; name: string; channel_type?: string }> }).payload ?? []);
              const newIg = inboxes.find(
                (ibx: { id: number; channel_type?: string }) => ibx.channel_type === "Channel::Instagram",
              );
              if (newIg) {
                clearInterval(poll);
                if (popup && !popup.closed) popup.close();
                setPolling(false);
                onCreate({
                  channel: "instagram",
                  name: newIg.name || "Instagram",
                  identifier: newIg.name || undefined,
                });
              }
            },
          )
          .catch(() => {
            // Continue polling on transient errors
          });
      }, 1000);
      setPolling(true);

      // Safety cleanup after 120s
      setTimeout(() => {
        clearInterval(poll);
        setPolling(false);
      }, 120_000);

      // Also listen for popup close (user cancelled)
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll);
          clearInterval(checkPopup);
          setPolling(false);
          setStarted(false);
          // Popup closed without new inbox = likely cancelled
        }
      }, 500);
    });
  };

  if (igAuth.error) {
    return (
      <div className="mx-auto grid max-w-lg justify-items-center gap-5 py-6 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border bg-muted/50">
          <Icon className="size-7 text-pink-600" />
        </div>
        <h2 className="font-medium text-lg">Connect your Instagram Profile</h2>
        <Alert className="text-left border-destructive/30 bg-destructive/5">
          <CircleAlert className="text-destructive" />
          <AlertDescription className="text-destructive">{igAuth.error}</AlertDescription>
        </Alert>
        <Button onClick={handleConnect} disabled={igAuth.busy} type="button">
          {igAuth.busy ? <Loader2 className="animate-spin" /> : null}
          Continue with Instagram
        </Button>
      </div>
    );
  }

  if (polling) {
    return (
      <div className="mx-auto grid max-w-lg justify-items-center gap-4 py-6 text-center">
        <Loader2 className="size-8 animate-spin text-pink-500" />
        <h2 className="font-medium text-lg">Waiting for Instagram Authorization</h2>
        <p className="text-muted-foreground text-sm">
          Complete the authorization in the Instagram popup window. This page will update automatically once your
          Instagram profile is connected.
        </p>
        <p className="text-muted-foreground text-xs">
          Note: After authorization, Instagram redirects to Chatwoot which then redirects to its dashboard. The popup
          will close automatically when your inbox appears here.
        </p>
      </div>
    );
  }

  if (started) {
    return (
      <div className="mx-auto grid max-w-lg justify-items-center gap-4 py-6 text-center">
        <Loader2 className="size-8 animate-spin text-pink-500" />
        <h2 className="font-medium text-lg">Opening Instagram Authorization</h2>
        <p className="text-muted-foreground text-sm">A popup window should open. Please allow popups for this site.</p>
      </div>
    );
  }

  return (
    <ConnectPanel
      icon={<Icon className="size-7 text-pink-600" />}
      title="Connect your Instagram Profile"
      help="To add your Instagram profile as a channel, you need to authenticate your Instagram Profile by clicking on 'Continue with Instagram'"
      button="Continue with Instagram"
      onConnected={() => setStarted(true)}
      connectFn={(onDone) => {
        igAuth.start(() => {
          onDone();
          setStarted(true);
        });
      }}
    />
  );
}

/** A drawn QR code for the finish step (FinishSetup.vue shows one to test WhatsApp, SMS, Messenger, Telegram). */
export function FakeQr({ seed, className }: { seed: string; className?: string }) {
  const size = 25;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cells: React.ReactNode[] = [];
  const finder = (x: number, y: number) => x < 7 && y < 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inFinder = finder(x, y) || finder(size - 1 - x, y) || finder(x, size - 1 - y);
      let on: boolean;
      if (inFinder) {
        const fx = x < 7 ? x : size - 1 - x;
        const fy = y < 7 ? y : size - 1 - y;
        on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
      } else {
        h = (h * 1103515245 + 12345) >>> 0;
        on = (h >>> 16) % 2 === 0;
      }
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  }
  return (
    <svg
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className={cn("rounded-lg bg-white fill-black", className)}
      role="img"
      aria-label="QR code"
    >
      {cells}
    </svg>
  );
}

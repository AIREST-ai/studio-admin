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

function ConnectPanel({
  icon,
  title,
  help,
  button,
  warning,
  onConnected,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  help: React.ReactNode;
  button: string;
  warning?: string;
  onConnected: () => void;
  children?: React.ReactNode;
}) {
  const auth = useFakeAuth(onConnected);
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
      {children}
      <Button onClick={auth.start} disabled={auth.busy} type="button">
        {auth.busy ? <Loader2 className="animate-spin" /> : null}
        {button}
      </Button>
    </div>
  );
}

const facebookPages = ["Weblabs Studio", "Weblabs Careers", "Weblabs Arabic"];

function FacebookForm({ channel, onCreate }: { channel: Channel; onCreate: (created: CreatedInbox) => void }) {
  const accountName = useAccountName(); // F-9: the name saved in General Settings
  const [connected, setConnected] = React.useState(false);
  const [page, setPage] = React.useState("");
  const [name, setName] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const Icon = channel.icon;
  if (!connected) {
    return (
      <ConnectPanel
        icon={<Icon className="size-7 text-muted-foreground" />}
        title="Continue with Facebook"
        help={`PS: By signing in, we only get access to your Page's messages. Your private messages can never be accessed by ${accountName}.`}
        button="Continue with Facebook"
        onConnected={() => setConnected(true)}
      />
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
        if (page && name.trim()) onCreate({ channel: "facebook", name: name.trim() });
      }}
    >
      <FormHeading
        title="Inbox Details"
        description={`From the dropdown below, select the Facebook Page you want to connect to ${accountName}. You can also give a custom name to your inbox for better identification.`}
      />
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
              if (!name) setName(event.target.value);
            }}
          >
            <NativeSelectOption value="">Select a page from the list</NativeSelectOption>
            {facebookPages.map((p) => (
              <NativeSelectOption key={p} value={p}>
                {p}
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
        <Button type="submit">Create Inbox</Button>
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
  const [state, setState] = React.useState<"idle" | "auth" | "processing">("idle");
  return (
    <div className="grid max-w-2xl gap-6">
      <FormHeading
        title="Quick setup with Meta"
        description="Use Quick setup with Meta to connect a new number or an existing number from the WhatsApp Business app. You will be redirected to Meta to log into your WhatsApp Business account. Having admin access will help make the setup smooth and easy."
      />
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
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={state !== "idle"}
          onClick={() => {
            setState("auth");
            setTimeout(() => setState("processing"), 800);
            setTimeout(
              () =>
                onCreate({ channel: "whatsapp", name: "WhatsApp Sales", provider: "embedded", phone: "+97444001133" }),
              1700,
            );
          }}
        >
          {state !== "idle" ? <Loader2 className="animate-spin" /> : null}
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
      return (
        <ConnectPanel
          icon={<Icon className="size-7 text-pink-600" />}
          title="Connect your Instagram Profile"
          help="To add your Instagram profile as a channel, you need to authenticate your Instagram Profile by clicking on 'Continue with Instagram'"
          button="Continue with Instagram"
          onConnected={() => onCreate({ channel: "instagram", name: "@weblabs.studio" })}
        />
      );
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

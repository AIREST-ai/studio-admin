"use client";
// Chatwoot routes/dashboard/settings/account/Index.vue + components/{AutoResolve,AudioTranscription,AccountId,
// BuildInfo,AccountDelete}.vue, drawn in the Studio pattern: big title outside, one card per section.
import * as React from "react";

import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

import { ACCOUNT_ID } from "../../_components/account-id";
import { copyText } from "../../_components/copy-text";
import { SettingsCard } from "../../_components/settings-card";
import { loadSettingsPreview, SAVED_IN_PREVIEW, saveAccountExtras } from "../../_components/settings-preview-client";
import { ConfirmDeleteDialog } from "../../inboxes/_components/settings-ui";
import { PageHeader } from "../../labels/_shared/settings-shell";
import { loadGeneralSettings, saveGeneralSettings } from "./general-settings-client";

const ACCOUNT_NAME = "Weblabs Studio";
const BUILD = { version: "4.18.0", sha: "8f3c2a1" };

// F161: every locale shipped in Chatwoot 4.18 (app/javascript/dashboard/i18n/locale/*), sorted by code as
// account/Index.vue languagesSortedByCode does. Names are each language's own name (the server list is not in the source).
const languages = [
  { code: "am", name: "አማርኛ (am)" },
  { code: "ar", name: "العربية (ar)" },
  { code: "az", name: "Azərbaycan (az)" },
  { code: "bg", name: "български (bg)" },
  { code: "bn", name: "বাংলা (bn)" },
  { code: "ca", name: "Català (ca)" },
  { code: "cs", name: "čeština (cs)" },
  { code: "da", name: "dansk (da)" },
  { code: "de", name: "Deutsch (de)" },
  { code: "el", name: "ελληνικά (el)" },
  { code: "en", name: "English (en)" },
  { code: "es", name: "Español (es)" },
  { code: "et", name: "eesti (et)" },
  { code: "fa", name: "فارسی (fa)" },
  { code: "fi", name: "suomi (fi)" },
  { code: "fr", name: "Français (fr)" },
  { code: "he", name: "עברית (he)" },
  { code: "hi", name: "हिन्दी (hi)" },
  { code: "hr", name: "hrvatski (hr)" },
  { code: "hu", name: "magyar (hu)" },
  { code: "hy", name: "Հայերեն (hy)" },
  { code: "id", name: "Bahasa Indonesia (id)" },
  { code: "is", name: "íslenska (is)" },
  { code: "it", name: "Italiano (it)" },
  { code: "ja", name: "日本語 (ja)" },
  { code: "ka", name: "ქართული (ka)" },
  { code: "ko", name: "한국어 (ko)" },
  { code: "lt", name: "lietuvių (lt)" },
  { code: "lv", name: "latviešu (lv)" },
  { code: "ml", name: "മലയാളം (ml)" },
  { code: "ms", name: "Bahasa Melayu (ms)" },
  { code: "ne", name: "नेपाली (ne)" },
  { code: "nl", name: "Nederlands (nl)" },
  { code: "no", name: "norsk (no)" },
  { code: "pl", name: "polski (pl)" },
  { code: "pt", name: "Português (pt)" },
  { code: "pt_BR", name: "Português Brasileiro (pt_BR)" },
  { code: "ro", name: "Română (ro)" },
  { code: "ru", name: "русский (ru)" },
  { code: "sh", name: "srpskohrvatski (sh)" },
  { code: "sk", name: "slovenčina (sk)" },
  { code: "sl", name: "slovenščina (sl)" },
  { code: "sq", name: "shqip (sq)" },
  { code: "sr", name: "српски (sr)" },
  { code: "sv", name: "Svenska (sv)" },
  { code: "ta", name: "தமிழ் (ta)" },
  { code: "th", name: "ภาษาไทย (th)" },
  { code: "tl", name: "Tagalog (tl)" },
  { code: "tr", name: "Türkçe (tr)" },
  { code: "uk", name: "українська (uk)" },
  { code: "ur", name: "اردو (ur)" },
  { code: "ur_IN", name: "اردو (ہندوستان) (ur_IN)" },
  { code: "uz", name: "o'zbek (uz)" },
  { code: "vi", name: "Tiếng Việt (vi)" },
  { code: "zh_CN", name: "中文 (简体) (zh_CN)" },
  { code: "zh_TW", name: "中文 (台灣) (zh_TW)" },
];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <InputGroupButton
      size="icon-xs"
      aria-label={label}
      onClick={async () => {
        if (await copyText(value, "Copied to clipboard successfully")) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
    </InputGroupButton>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function GeneralSection({ onSavedName }: { onSavedName: (name: string) => void }) {
  const [name, setName] = React.useState(ACCOUNT_NAME);
  const [language, setLanguage] = React.useState("en");
  // F-6A (sim2 problem 9): Support Email and Incoming Email Domain were sent nowhere ("Successfully updated" kept
  // only the name and language). They are saved in this preview with the rest of the form (api/settings-preview,
  // section "account") and come back after a reload.
  const [domain, setDomain] = React.useState("mail.weblabs.studio");
  const [supportEmail, setSupportEmail] = React.useState("support@weblabs.studio");
  const [touched, setTouched] = React.useState(false);
  // T-225: name and language are loaded from and saved to the preview state (general-settings-client.ts); the button
  // waits for the load so a save never writes the defaults over a saved value.
  const [status, setStatus] = React.useState<"loading" | "ready" | "saving">("loading");
  const nameError = touched && !name.trim();
  const emailError = touched && supportEmail.trim() !== "" && !EMAIL.test(supportEmail.trim());
  const domainError = touched && domain.trim() !== "" && !DOMAIN.test(domain.trim());

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      loadGeneralSettings().then((saved) => {
        if (!alive || !saved) return;
        setName(saved.name);
        setLanguage(saved.language);
        onSavedName(saved.name);
      }),
      loadSettingsPreview().then(({ account }) => {
        if (!alive || !account) return;
        if (typeof account.supportEmail === "string") setSupportEmail(account.supportEmail);
        if (typeof account.incomingEmailDomain === "string") setDomain(account.incomingEmailDomain);
      }),
    ])
      .catch((error: Error) => {
        if (alive) toast.error(`Could not load the saved account settings: ${error.message}`);
      })
      .finally(() => {
        if (alive) setStatus("ready");
      });
    return () => {
      alive = false;
    };
  }, [onSavedName]);

  return (
    <SettingsCard title="General settings">
      <FieldGroup className="max-w-2xl gap-4">
        <Field data-invalid={nameError || undefined}>
          <FieldLabel htmlFor="account-name">Account name</FieldLabel>
          <Input
            id="account-name"
            placeholder="Your account name"
            value={name}
            aria-invalid={nameError || undefined}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          {nameError ? <FieldError>Please enter a valid account name</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="site-language">Site language</FieldLabel>
          <NativeSelect
            id="site-language"
            className="w-full"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languages.map((lang) => (
              <NativeSelectOption key={lang.code} value={lang.code}>
                {lang.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={domainError || undefined}>
          <FieldLabel htmlFor="custom-domain">Incoming Email Domain</FieldLabel>
          <Input
            id="custom-domain"
            placeholder="The domain where you will receive the emails"
            value={domain}
            aria-invalid={domainError || undefined}
            onChange={(event) => setDomain(event.target.value)}
          />
          {domainError ? (
            <FieldError>Please enter a valid domain (eg: mail.example.com)</FieldError>
          ) : (
            <FieldDescription>
              Preview: the domain is saved in this preview only. No email is received at it, because the preview has no
              mail server.
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={emailError || undefined}>
          <FieldLabel htmlFor="support-email">Support Email</FieldLabel>
          <Input
            id="support-email"
            placeholder="Your company's support email"
            value={supportEmail}
            aria-invalid={emailError || undefined}
            onChange={(event) => setSupportEmail(event.target.value)}
          />
          {emailError ? <FieldError>Please enter a valid email address</FieldError> : null}
        </Field>
        {/* م137 (Fahad 137): one save pattern across Settings: the form's Save at the end of the form, left, inside its
            card, as Chatwoot's General settings (GENERAL_SETTINGS.SUBMIT ends the form) and the inbox, team,
            workflow, SAML and profile forms here (Primer saving pattern: "bottom left of the form"). Was the card's
            footer. Same handler. */}
        <div>
          <Button
            size="sm"
            disabled={status !== "ready"}
            onClick={async () => {
              setTouched(true);
              const badEmail = supportEmail.trim() !== "" && !EMAIL.test(supportEmail.trim());
              const badDomain = domain.trim() !== "" && !DOMAIN.test(domain.trim());
              if (!name.trim() || badEmail || badDomain) {
                toast.error("Please fix form errors");
                return;
              }
              setStatus("saving");
              try {
                const saved = await saveGeneralSettings(name, language);
                const extras = await saveAccountExtras({
                  supportEmail: supportEmail.trim(),
                  incomingEmailDomain: domain.trim(),
                });
                setName(saved.name);
                setLanguage(saved.language);
                setSupportEmail(extras.supportEmail ?? "");
                setDomain(extras.incomingEmailDomain ?? "");
                onSavedName(saved.name);
                toast.success("Successfully updated account settings", { description: SAVED_IN_PREVIEW });
              } catch (error) {
                toast.error(`Account settings not saved: ${(error as Error).message}`);
              } finally {
                setStatus("ready");
              }
            }}
          >
            Update settings
          </Button>
        </div>
      </FieldGroup>
    </SettingsCard>
  );
}

export function AccountPage() {
  const [transcribe, setTranscribe] = React.useState(true);
  // م137 round 2 (item 99): the switch saves at once in this preview (api/settings-preview) and comes back after a
  // reload; the message says so, and a failure puts it back.
  const [transcribeLoaded, setTranscribeLoaded] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview()
      .then(({ account }) => {
        if (alive && typeof account?.transcribeAudio === "boolean") setTranscribe(account.transcribeAudio);
      })
      .catch((error) => toast.error("Saved settings could not be read", { description: (error as Error).message }))
      .finally(() => alive && setTranscribeLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  // Chatwoot AccountDelete.vue: confirming only marks the account for deletion; it can be cancelled until the date.
  // F-6A: the mark is saved in this preview (it said "marked" and was gone after a reload), and nothing is deleted.
  const [deletionDate, setDeletionDate] = React.useState<string | null>(null);
  // F-6A (sim2 problem 21): the delete dialog asks for the saved account name, not the name the page started with.
  const [accountName, setAccountName] = React.useState(ACCOUNT_NAME);
  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview()
      .then(({ account }) => {
        if (alive && account?.deletionScheduledFor) setDeletionDate(account.deletionScheduledFor);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const scheduleDeletion = async (date: string | null, done: string) => {
    try {
      await saveAccountExtras({ deletionScheduledFor: date });
      setDeletionDate(date);
      toast.success(done, {
        description: `${SAVED_IN_PREVIEW} Preview — simulated: nothing is deleted on that date.`,
      });
    } catch (error) {
      toast.error("Not saved", { description: (error as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="General Settings"
        description="General settings and the ID of this account. Auto-resolve lives in Conversation Workflow."
      />

      <GeneralSection onSavedName={setAccountName} />

      <SettingsCard
        title={
          <span className="flex items-center gap-2">
            Transcribe Audio Messages
            <Badge variant="secondary" className="font-normal">
              Beta
            </Badge>
          </span>
        }
        description="Automatically transcribe audio messages in conversations. Generate a text transcript whenever an audio message is sent or received, and display it alongside the message."
        action={
          <Switch
            checked={transcribe}
            disabled={!transcribeLoaded}
            onCheckedChange={async (on) => {
              setTranscribe(on);
              try {
                await saveAccountExtras({ transcribeAudio: on });
                toast.success("Audio transcription setting updated successfully", { description: SAVED_IN_PREVIEW });
              } catch (error) {
                setTranscribe(!on);
                toast.error("Audio transcription setting not saved", { description: (error as Error).message });
              }
            }}
            aria-label="Transcribe audio messages"
          />
        }
      />

      <SettingsCard title="Account ID" description="This ID is required if you are building an API based integration">
        <InputGroup className="max-w-xs">
          <InputGroupInput readOnly value={ACCOUNT_ID} className="font-mono tabular-nums" />
          <InputGroupAddon align="inline-end">
            <CopyButton value={ACCOUNT_ID} label="Copy account ID" />
          </InputGroupAddon>
        </InputGroup>
      </SettingsCard>

      <SettingsCard
        tone="danger"
        title="Delete your Account"
        description="Once you delete your account, all your data will be deleted."
        action={
          deletionDate ? null : (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete Your Account
            </Button>
          )
        }
      >
        {deletionDate ? (
          <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p>
              This account is scheduled for deletion on {new Date(deletionDate).toLocaleString()}. This was requested by
              an administrator. You can cancel the deletion before this date.
            </p>
            <p className="text-muted-foreground text-xs">Preview — simulated: nothing will be deleted.</p>
            <div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => scheduleDeletion(null, "Successfully updated account settings")}
              >
                Cancel Scheduled Deletion
              </Button>
            </div>
          </div>
        ) : null}
      </SettingsCard>

      <div className="flex flex-wrap items-center justify-center gap-2 py-2 text-muted-foreground text-xs">
        <span>Build</span>
        <Badge variant="outline" className="font-mono font-normal">
          v{BUILD.version}
        </Badge>
        <span>·</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-mono hover:text-foreground"
          onClick={() => {
            void copyText(BUILD.sha, "Copied to clipboard successfully");
          }}
        >
          {BUILD.sha}
          <Copy className="size-3" />
        </button>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Account"
        message="Deleting your Account is irreversible. All its data will be permanently deleted."
        confirmValue={accountName}
        onConfirm={() =>
          scheduleDeletion(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), "Account marked for deletion")
        }
      />
    </div>
  );
}

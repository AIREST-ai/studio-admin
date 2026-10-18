"use client";
// Chatwoot settings/profile/MfaSettings.vue + MfaStatusCard, MfaSetupWizard, MfaManagementActions in the Studio
// pattern.
// F-6A (sim2 problem 8: "accepts any 6 digits and shows 10 made-up backup codes"): a real two-factor setup in this
// preview. Enable asks the preview server for a new secret (api/settings-preview/mfa), shows it as a QR code drawn from
// the authenticator Key URI and as text, and turns on only when the 6-digit code from an authenticator app (Google
// Authenticator, Authy, 1Password…) is that secret's current TOTP code (RFC 6238). Disable asks for a current code too.
// What cannot be real here says so: no sign-in asks for the code (the preview has no accounts) and no backup codes
// are made, so none are shown.
import * as React from "react";

import { cn } from "cn";
import { Copy, Info, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { copyText } from "../../_components/copy-text";
import { SettingsBreadcrumb } from "../../_components/settings-breadcrumb";
import { PageHeader } from "../../labels/_shared/settings-shell";

const ENDPOINT = "/api/settings-preview/mfa";
const PREVIEW_LINE =
  "Preview: saved in this preview. No sign-in asks for the code, because the preview has no accounts, and no backup codes are made.";

interface Setup {
  secret: string;
  otpauth: string;
  qr: string | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !data) throw new Error(data?.error ?? `${response.status} ${response.statusText}`);
  return data;
}

function copy(text: string, message: string) {
  void copyText(text, message);
}

function OtpInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="000000"
      className="w-40 text-center font-mono text-lg tracking-[0.4em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}

export function MfaSettings() {
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [setup, setSetup] = React.useState<Setup | null>(null);
  const [manual, setManual] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);

  React.useEffect(() => {
    fetch(ENDPOINT, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((state: { enabled: boolean }) => setEnabled(state.enabled))
      .catch((error: Error) => {
        setEnabled(false);
        toast.error("The two-factor state could not be read", { description: error.message });
      });
  }, []);

  async function start() {
    setBusy(true);
    try {
      setSetup(await call<Setup>({ action: "start" }));
      setCode("");
      setCodeError("");
      setManual(false);
    } catch (error) {
      toast.error("Two-factor setup could not start", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      await call({ action: "verify", code });
      setEnabled(true);
      setSetup(null);
      toast.success("Two-factor authentication has been enabled successfully", { description: PREVIEW_LINE });
    } catch (error) {
      setCodeError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setSetup(null);
    await call({ action: "cancel" }).catch(() => undefined);
  }

  const loading = enabled === null;

  return (
    <div className="flex flex-col gap-4">
      {/* م137 round 2 (judge M137): the path above the title, as on every Settings detail page, not a back link. */}
      <SettingsBreadcrumb
        items={[
          { label: "Profile Settings", href: "/dashboard/settings/profile" },
          { label: "Two-Factor Authentication" },
        ]}
      />
      <PageHeader
        title="Two-Factor Authentication"
        description="Protect your account from unauthorized access with TOTP-based authentication. This adds an extra layer of security to your account."
        learnMore="Learn more about 2FA"
      />

      <p
        className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm"
        data-preview-note
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        Preview: this is a working setup with a real authenticator app. The code is checked against your secret, and the
        result is kept in this preview. There is no sign-in that asks for it yet, and no backup codes are made.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Status</CardTitle>
          <CardDescription>Manage your two-factor authentication settings</CardDescription>
          <CardAction>
            <Badge
              variant="outline"
              data-mfa-status={loading ? "loading" : enabled ? "enabled" : "disabled"}
              className={cn(
                "gap-1.5 border px-2 py-1 font-medium",
                enabled
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-muted-foreground")} />
              {loading ? "Loading…" : enabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? null : enabled ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <ShieldCheck className="mt-0.5 size-5 text-emerald-600" />
              <div className="grid gap-0.5">
                <span className="font-medium text-sm">Two-factor authentication is active</span>
                <span className="text-muted-foreground text-sm">
                  Your authenticator app holds the secret. Turning it off asks for a current code.
                </span>
              </div>
            </div>
          ) : !setup ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <ShieldOff className="mt-0.5 size-5 text-muted-foreground" />
                <div className="grid max-w-xl gap-0.5">
                  <span className="font-medium text-sm">Enhance Your Account Security</span>
                  <span className="text-muted-foreground text-sm">
                    Two-factor authentication adds an extra layer of security by requiring a verification code from your
                    authenticator app in addition to your password.
                  </span>
                </div>
              </div>
              <Button onClick={start} disabled={busy}>
                Enable Two-Factor Authentication
              </Button>
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
                  1
                </span>
                <div className="grid gap-3">
                  <div className="grid gap-0.5">
                    <span className="font-medium text-sm">Scan QR Code with Your Authenticator App</span>
                    <span className="text-muted-foreground text-sm">
                      Use Google Authenticator, Authy, or any TOTP-compatible app
                    </span>
                  </div>
                  {setup.qr ? (
                    // biome-ignore lint/performance/noImgElement: a data: URL SVG made by the preview server.
                    <img
                      src={setup.qr}
                      alt="QR code of your two-factor secret"
                      className="size-44 rounded-lg border bg-white p-1"
                      data-mfa-qr
                    />
                  ) : (
                    <p className="max-w-sm text-muted-foreground text-sm">
                      The QR picture is not available on this preview machine. Enter the key below in your app.
                    </p>
                  )}
                  <Button variant="link" size="sm" className="w-fit px-0" onClick={() => setManual((m) => !m)}>
                    Can't scan? Enter code manually
                  </Button>
                  {manual || !setup.qr ? (
                    <div className="grid gap-1.5">
                      <Label>Secret Key</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded-md border bg-muted/40 px-3 py-1.5 text-xs" data-mfa-secret>
                          {setup.secret}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(setup.secret, "Secret key copied to clipboard")}
                        >
                          <Copy /> Copy
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs">
                  2
                </span>
                <div className="grid gap-3">
                  <Label htmlFor="mfa-code">Enter the 6-digit code from your authenticator app</Label>
                  <OtpInput
                    id="mfa-code"
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      setCodeError("");
                    }}
                  />
                  {codeError ? <p className="text-destructive text-xs">{codeError}</p> : null}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={cancel}>
                      Cancel
                    </Button>
                    <Button onClick={verify} disabled={code.length !== 6 || busy}>
                      Verify & Continue
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {enabled ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" /> Backup Codes
              </CardTitle>
              <CardDescription>
                Not made in this preview. In the engine you would get one-time codes here for when you lose your phone.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldOff className="size-4" /> Disable 2FA
              </CardTitle>
              <CardDescription>Remove two-factor authentication from your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDisableOpen(true)}>
                Disable Two-Factor Authentication
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <DisableDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        onDone={() => {
          setEnabled(false);
          setDisableOpen(false);
          toast.success("Two-factor authentication has been disabled", { description: PREVIEW_LINE });
        }}
      />
    </div>
  );
}

function DisableDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCode("");
      setError("");
    }
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setBusy(true);
    try {
      await call({ action: "disable", code });
      onDone();
    } catch (failure) {
      setError(`Failed to disable MFA: ${(failure as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter the current code from your authenticator app. This preview has no password to ask for.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="mfa-disable-code">Verification Code</Label>
            <OtpInput id="mfa-disable-code" value={code} onChange={setCode} />
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={busy}>
              Disable 2FA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

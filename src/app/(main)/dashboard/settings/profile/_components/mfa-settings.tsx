"use client";
// Chatwoot settings/profile/MfaSettings.vue + MfaStatusCard, MfaSetupWizard, MfaManagementActions in the Studio
// pattern. Mock flow: Enable -> scan QR / secret key -> any 6-digit code except 000000 verifies -> backup codes ->
// Complete Setup -> enabled with Regenerate / Disable dialogs.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { ChevronLeft, Copy, Download, KeyRound, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

import { PageHeader } from "../../labels/_shared/settings-shell";

const SECRET = "JBSWY3DPEHPK3PXPQ7ZK4M2TFA5LG6NV";

function makeCodes() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
  );
}

function copy(text: string, message: string) {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
  toast.success(message);
}

function downloadCodes(codes: string[]) {
  const url = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "chatwoot-backup-codes.txt";
  a.click();
  URL.revokeObjectURL(url);
}

/** A stand-in QR picture drawn from the secret, so the step looks real without a QR library. */
function FakeQr() {
  const size = 25;
  const cells: boolean[] = [];
  let seed = 7;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    cells.push(seed / 233280 > 0.5);
  }
  const finder = (x: number, y: number) =>
    [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const finderOn = (x: number, y: number) => {
    const fx = x < 7 ? 0 : size - 7;
    const fy = y < 7 ? 0 : size - 7;
    const dx = x - fx;
    const dy = y - fy;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="size-44 rounded-lg border bg-white p-2" aria-label="QR code">
      {cells.map((on, i) => {
        const x = i % size;
        const y = Math.floor(i / size);
        const fill = finder(x, y) ? finderOn(x, y) : on;
        return fill ? <rect key={i} x={x} y={y} width={1} height={1} fill="#111" /> : null;
      })}
    </svg>
  );
}

function CodesGrid({ codes }: { codes: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-4 font-mono text-sm">
      {codes.map((c) => (
        <span key={c} className="rounded bg-background px-2 py-1 text-center">
          {c}
        </span>
      ))}
    </div>
  );
}

function OtpInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      maxLength={6}
      placeholder="000000"
      className="w-40 text-center font-mono text-lg tracking-[0.4em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}

export function MfaSettings({ initialEnabled = false }: { initialEnabled?: boolean }) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [step, setStep] = React.useState<"idle" | "scan" | "backup">("idle");
  const [manual, setManual] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState("");
  const [codes, setCodes] = React.useState<string[]>([]);
  const [saved, setSaved] = React.useState(false);
  // Opened with ?state=enabled the mock account has 2 backup codes left, which shows the low-codes warning.
  const [remaining, setRemaining] = React.useState(initialEnabled ? 2 : 10);
  const [dialog, setDialog] = React.useState<"disable" | "regenerate" | null>(null);

  function verify() {
    if (code.length !== 6 || code === "000000") {
      setCodeError("Invalid verification code");
      return;
    }
    setCodes(makeCodes());
    setSaved(false);
    setStep("backup");
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit px-1.5 text-muted-foreground" asChild>
        <Link href="/dashboard/settings/profile">
          <ChevronLeft /> Profile Settings
        </Link>
      </Button>
      <PageHeader
        title="Two-Factor Authentication"
        description="Protect your account from unauthorized access with TOTP-based authentication. This adds an extra layer of security to your account."
        learnMore="Learn more about 2FA"
      />

      <Card>
        <CardHeader>
          <CardTitle>Authentication Status</CardTitle>
          <CardDescription>Manage your two-factor authentication settings and backup recovery codes</CardDescription>
          <CardAction>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 border px-2 py-1 font-medium",
                enabled
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-muted-foreground")} />
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {enabled ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <ShieldCheck className="mt-0.5 size-5 text-emerald-600" />
              <div className="grid gap-0.5">
                <span className="font-medium text-sm">Two-factor authentication is active</span>
                <span className="text-muted-foreground text-sm">
                  Your account is protected with an additional layer of security
                </span>
              </div>
            </div>
          ) : step === "idle" ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <ShieldOff className="mt-0.5 size-5 text-muted-foreground" />
                <div className="grid max-w-xl gap-0.5">
                  <span className="font-medium text-sm">Enhance Your Account Security</span>
                  <span className="text-muted-foreground text-sm">
                    Two-factor authentication adds an extra layer of security by requiring a verification code from
                    your authenticator app in addition to your password.
                  </span>
                </div>
              </div>
              <Button
                onClick={() => {
                  setCode("");
                  setCodeError("");
                  setManual(false);
                  setStep("scan");
                }}
              >
                Enable Two-Factor Authentication
              </Button>
            </div>
          ) : null}

          {!enabled && step === "scan" ? (
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-[auto_1fr]">
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
                    <FakeQr />
                    <Button variant="link" size="sm" className="w-fit px-0" onClick={() => setManual((m) => !m)}>
                      Can't scan? Enter code manually
                    </Button>
                    {manual ? (
                      <div className="grid gap-1.5">
                        <Label>Secret Key</Label>
                        <div className="flex items-center gap-2">
                          <code className="rounded-md border bg-muted/40 px-3 py-1.5 text-xs">{SECRET}</code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copy(SECRET, "Secret key copied to clipboard")}
                          >
                            <Copy /> Copy
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
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
                    <Button variant="outline" onClick={() => setStep("idle")}>
                      Cancel
                    </Button>
                    <Button onClick={verify} disabled={code.length !== 6}>
                      Verify & Continue
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!enabled && step === "backup" ? (
            <div className="grid max-w-xl gap-4">
              <div className="grid gap-0.5">
                <span className="font-medium">Save Your Backup Codes</span>
                <span className="text-muted-foreground text-sm">
                  Keep these codes safe. Each can be used once if you lose access to your authenticator
                </span>
              </div>
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-300">
                <strong>Important:</strong> Save these codes in a secure location. You won't be able to see them
                again.
              </p>
              <CodesGrid codes={codes} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadCodes(codes)}>
                  <Download /> Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(codes.join("\n"), "Backup codes copied to clipboard")}
                >
                  <Copy /> Copy All
                </Button>
              </div>
              <Label className="items-start font-normal leading-relaxed">
                <Checkbox checked={saved} onCheckedChange={(c) => setSaved(c === true)} className="mt-0.5" />I have
                saved my backup codes in a secure location and understand that I won't be able to see them again
              </Label>
              <Button
                className="w-fit"
                disabled={!saved}
                onClick={() => {
                  setEnabled(true);
                  setRemaining(10);
                  setStep("idle");
                  toast.success("Two-factor authentication has been enabled successfully");
                }}
              >
                Complete Setup
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {enabled ? (
        <>
          {remaining <= 3 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <ShieldAlert className="size-4" />
                {remaining === 0
                  ? "You have no backup codes remaining. Generate new codes now to avoid getting locked out if you lose access to your authenticator."
                  : `You have ${remaining} backup codes remaining. Generate new codes to avoid getting locked out if you lose access to your authenticator.`}
              </span>
              <Button size="sm" variant="outline" onClick={() => setDialog("regenerate")}>
                Generate codes
              </Button>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4" /> Backup Codes
                </CardTitle>
                <CardDescription>Generate new codes if you've lost or used your existing ones</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => setDialog("regenerate")}>
                  Regenerate Backup Codes
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldOff className="size-4" /> Disable 2FA
                </CardTitle>
                <CardDescription>Remove two-factor authentication from your account</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setDialog("disable")}>
                  Disable Two-Factor Authentication
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <DisableDialog
        open={dialog === "disable"}
        onOpenChange={(open) => !open && setDialog(null)}
        onDone={() => {
          setEnabled(false);
          setDialog(null);
          toast.success("Two-factor authentication has been disabled");
        }}
      />
      <RegenerateDialog
        open={dialog === "regenerate"}
        onOpenChange={(open) => !open && setDialog(null)}
        onDone={() => setRemaining(10)}
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
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [backup, setBackup] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setPassword("");
      setCode("");
      setBackup(false);
      setError("");
    }
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || (backup ? code.trim().length < 8 : code.length !== 6)) {
      setError("Failed to disable MFA. Please check your credentials.");
      return;
    }
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              You'll need to enter your password and either a verification code from your authenticator app or a
              backup code to disable two-factor authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="mfa-disable-password">Password</Label>
            <Input
              id="mfa-disable-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mfa-disable-code">{backup ? "Backup Code" : "Verification Code"}</Label>
            {backup ? (
              <Input
                id="mfa-disable-code"
                placeholder="Enter one of your backup codes"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            ) : (
              <OtpInput id="mfa-disable-code" value={code} onChange={setCode} />
            )}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="w-fit px-0"
              onClick={() => {
                setBackup((b) => !b);
                setCode("");
              }}
            >
              {backup
                ? "Use a verification code from your authenticator app"
                : "Lost access to your authenticator? Use a backup code instead"}
            </Button>
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive">
              Disable 2FA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegenerateDialog({
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
  const [codes, setCodes] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    if (open) {
      setCode("");
      setError("");
      setCodes(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {codes ? (
          <>
            <DialogHeader>
              <DialogTitle>New Backup Codes Generated</DialogTitle>
              <DialogDescription>
                Your old backup codes have been invalidated. Save these new codes in a secure location.
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-300">
              <strong>Important:</strong> Each code can only be used once. Save them before closing this window.
            </p>
            <CodesGrid codes={codes} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCodes(codes)}>
                <Download /> Download Codes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(codes.join("\n"), "Backup codes copied to clipboard")}
              >
                <Copy /> Copy All Codes
              </Button>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button>I've Saved My Codes</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length !== 6 || code === "000000") {
                setError("Failed to regenerate backup codes");
                return;
              }
              setCodes(makeCodes());
              onDone();
              toast.success("New backup codes have been generated");
            }}
          >
            <DialogHeader>
              <DialogTitle>Regenerate Backup Codes</DialogTitle>
              <DialogDescription>
                This will invalidate your existing backup codes and generate new ones. Enter your verification code
                to continue.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="mfa-regen-code">Verification Code</Label>
              <OtpInput
                id="mfa-regen-code"
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setError("");
                }}
              />
              {error ? <p className="text-destructive text-xs">{error}</p> : null}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Generate New Codes</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

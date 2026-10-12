"use client";
import * as React from "react";

import Link from "next/link";

import { ChevronDown, Copy, Info, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { PageHeader } from "../../labels/_shared/settings-shell";

const spInfo = [
  {
    label: "ACS URL",
    value: "https://support.doharetail.qa/omniauth/saml/callback?account_id=1",
    tooltip: "Assertion Consumer Service URL - Configure this URL in your IdP as the destination for SAML responses",
  },
  {
    label: "SP Entity ID",
    value: "https://support.doharetail.qa/saml/sp/1",
    tooltip: "Unique identifier for Chatwoot as the Service Provider - Configure this in your IdP settings",
  },
  {
    label: "Fingerprint",
    value: "4F:2A:91:C7:0B:6E:D3:58:AA:12:7C:E4:39:B0:65:1D:F8:C2:9E:07",
    tooltip: "SHA-1 fingerprint of the certificate - Use this to verify the certificate in your IdP configuration",
  },
];

function copy(value: string) {
  void navigator.clipboard?.writeText(value).catch(() => undefined);
  toast.success("Copied to clipboard");
}

export function SecuritySettings({ paywall = false }: { paywall?: boolean }) {
  const [enabled, setEnabled] = React.useState(true);
  const [ssoUrl, setSsoUrl] = React.useState("https://login.microsoftonline.com/9c1f-doharetail/saml2");
  const [idpEntityId, setIdpEntityId] = React.useState("https://sts.windows.net/9c1f-doharetail/");
  const [certificate, setCertificate] = React.useState(
    "-----BEGIN CERTIFICATE-----\nMIIC8DCCAdigAwIBAgIQGq0xV2l4mUeTj7n0bE1d3TANBgkqhkiG9w0BAQsFADA0\n-----END CERTIFICATE-----",
  );
  const [errors, setErrors] = React.useState<{ ssoUrl?: string; idp?: string; cert?: string }>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    try {
      const parsed = new URL(ssoUrl.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad");
    } catch {
      next.ssoUrl = "Please enter a valid SSO URL";
    }
    if (!idpEntityId.trim()) next.idp = "Identity Provider Entity ID is required";
    if (!certificate.trim()) next.cert = "Certificate is required";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("SSO URL, Identity Provider Entity ID, and Certificate are required fields");
      return;
    }
    toast.success("SAML settings updated successfully");
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Security"
        description="Manage your account security settings."
        learnMore="Learn more about SAML SSO"
      />

      {paywall ? (
        <Card className="items-center py-10 text-center">
          <CardHeader className="w-full max-w-lg justify-items-center">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-5" />
            </div>
            <CardTitle>Upgrade to enable SAML SSO</CardTitle>
            <CardDescription>
              The SAML SSO feature is only available in the Enterprise plans. Upgrade your plan to get access to SAML
              single sign-on and other advanced features.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid justify-items-center gap-2">
            <Button asChild>
              <Link href="/dashboard/settings/billing">Upgrade now</Link>
            </Button>
            <span className="text-muted-foreground text-xs">You can change or cancel your plan anytime</span>
          </CardContent>
        </Card>
      ) : null}

      {paywall ? null : (
      <Card>
        <CardHeader>
          <CardTitle>SAML SSO</CardTitle>
          <CardDescription className="max-w-2xl">
            Configure SAML single sign-on for your account. Users will authenticate through your identity provider
            instead of using email/password.
          </CardDescription>
          <CardAction>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => {
                setEnabled(checked);
                if (!checked) toast.success("SAML settings disabled successfully");
              }}
              aria-label="Enable SAML SSO"
            />
          </CardAction>
        </CardHeader>
        {!enabled ? (
          <CardContent>
            <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-sm">
              SAML SSO is currently disabled. Please contact your administrator to enable this feature.
            </p>
          </CardContent>
        ) : null}
        {enabled && (
          <CardContent className="grid gap-6">
            <div className="rounded-xl border bg-muted/30">
              <div className="flex items-center gap-1.5 px-4 py-3 font-medium text-sm">
                Service Provider Information
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Copy these values and configure them in your Identity Provider to establish the SAML connection
                  </TooltipContent>
                </Tooltip>
              </div>
              <Separator />
              <div className="grid gap-3 p-4">
                {spInfo.map((item) => (
                  <div key={item.label} className="grid gap-1.5 md:grid-cols-[180px_1fr] md:items-center">
                    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      {item.label}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{item.tooltip}</TooltipContent>
                      </Tooltip>
                    </span>
                    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
                      <code className="flex-1 truncate text-xs">{item.value}</code>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Copy ${item.label}`}
                        onClick={() => copy(item.value)}
                      >
                        <Copy />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Collapsible className="rounded-xl border">
              <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 font-medium text-sm hover:bg-muted/40">
                SAML Attribute Setup
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-3 text-sm">
                <p className="mb-2 text-muted-foreground">
                  The following attribute mappings must be configured in your identity provider
                </p>
                <ul className="space-y-1">
                  {["email", "first_name", "last_name"].map((a) => (
                    <li key={a}>
                      <code className="rounded bg-muted px-1 text-xs">{a}</code>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>

            <form className="grid max-w-2xl gap-5" onSubmit={submit} noValidate>
              <div className="grid gap-2">
                <Label htmlFor="saml-sso-url">SSO URL</Label>
                <Input
                  id="saml-sso-url"
                  placeholder="https://sso.example.com/saml/sso"
                  value={ssoUrl}
                  aria-invalid={Boolean(errors.ssoUrl)}
                  onChange={(e) => setSsoUrl(e.target.value)}
                />
                <p className={errors.ssoUrl ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                  {errors.ssoUrl ?? "The URL where SAML authentication requests will be sent"}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="saml-idp">Identity Provider Entity ID</Label>
                <Input
                  id="saml-idp"
                  placeholder="https://sso.example.com/saml"
                  value={idpEntityId}
                  aria-invalid={Boolean(errors.idp)}
                  onChange={(e) => setIdpEntityId(e.target.value)}
                />
                <p className={errors.idp ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                  {errors.idp ?? "Unique identifier for your identity provider (usually found in IdP configuration)"}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="saml-cert">Signing certificate in PEM format</Label>
                <Textarea
                  id="saml-cert"
                  className="min-h-28 font-mono text-xs"
                  placeholder={"-----BEGIN CERTIFICATE-----\nMIIC..."}
                  value={certificate}
                  aria-invalid={Boolean(errors.cert)}
                  onChange={(e) => setCertificate(e.target.value)}
                />
                <p className={errors.cert ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                  {errors.cert ?? "The public certificate from your identity provider used to verify SAML responses"}
                </p>
              </div>
              <Button type="submit" className="w-fit">
                Update SAML Settings
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
      )}
    </div>
  );
}

"use client";
import * as React from "react";

import { ChevronDown, Copy, ExternalLink, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

export function SecuritySettings() {
  const [enabled, setEnabled] = React.useState(true);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-2xl gap-1.5">
        <h1 className="font-semibold text-xl">Security</h1>
        <p className="text-muted-foreground text-sm">Manage your account security settings.</p>
        <Button variant="link" size="sm" className="h-auto w-fit px-0">
          Learn more about SAML SSO <ExternalLink />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SAML SSO</CardTitle>
          <CardDescription className="max-w-2xl">
            Configure SAML single sign-on for your account. Users will authenticate through your identity provider
            instead of using email/password.
          </CardDescription>
          <CardAction>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable SAML SSO" />
          </CardAction>
        </CardHeader>
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
                      <Button variant="ghost" size="icon-xs" aria-label={`Copy ${item.label}`}>
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

            <div className="grid max-w-2xl gap-5">
              <div className="grid gap-2">
                <Label>SSO URL</Label>
                <Input
                  placeholder="https://sso.example.com/saml/sso"
                  defaultValue="https://login.microsoftonline.com/9c1f-doharetail/saml2"
                />
                <p className="text-muted-foreground text-xs">The URL where SAML authentication requests will be sent</p>
              </div>
              <div className="grid gap-2">
                <Label>Identity Provider Entity ID</Label>
                <Input
                  placeholder="https://sso.example.com/saml"
                  defaultValue="https://sts.windows.net/9c1f-doharetail/"
                />
                <p className="text-muted-foreground text-xs">
                  Unique identifier for your identity provider (usually found in IdP configuration)
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Signing certificate in PEM format</Label>
                <Textarea
                  className="min-h-28 font-mono text-xs"
                  placeholder={"-----BEGIN CERTIFICATE-----\nMIIC..."}
                />
                <p className="text-muted-foreground text-xs">
                  The public certificate from your identity provider used to verify SAML responses
                </p>
              </div>
              <Button className="w-fit">Update SAML Settings</Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

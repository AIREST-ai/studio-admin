"use client";
import * as React from "react";

import { cn } from "cn";
import { Blocks, Globe, Palette, Plus, Settings2, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";

import { activePortal } from "./data";
import { CustomDomainDialog, DeletePortalDialog, DnsConfigurationDialog } from "./help-center-dialogs";
import { PortalTitle } from "./portal-title";

type SettingsTab = "general" | "domain" | "appearance" | "integrations";

const nav: { value: SettingsTab; label: string; icon: React.ElementType }[] = [
  { value: "general", label: "General", icon: Settings2 },
  { value: "domain", label: "Domain", icon: Globe },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "integrations", label: "Integrations", icon: Blocks },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-4">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="grid gap-1">
      <h3 className="font-medium text-base">{title}</h3>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
  );
}

function GeneralSettings() {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <Row label="Logo">
          <div className="flex items-center gap-3">
            <div
              className="flex size-12 items-center justify-center rounded-xl font-semibold text-lg text-white"
              style={{ background: activePortal.color }}
            >
              N
            </div>
            <Button variant="outline" size="sm">
              <Upload /> Upload logo
            </Button>
          </div>
        </Row>
        <Row label="Name">
          <Input placeholder="Portal name" defaultValue={activePortal.name} />
        </Row>
        <Row label="Header text">
          <Input placeholder="Portal header text" defaultValue={activePortal.headerText} />
        </Row>
        <Row label="Page title">
          <Input placeholder="Portal page title" defaultValue={activePortal.pageTitle} />
        </Row>
        <Row label="Home page link">
          <Input placeholder="Portal home page link" defaultValue={activePortal.homePageLink} />
        </Row>
        <Row label="Slug">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText>app.chatwoot.com/hc/</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput placeholder="Portal slug" defaultValue={activePortal.slug} />
          </InputGroup>
        </Row>
        <Row label="Brand color">
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-lg border" style={{ background: activePortal.color }} />
            <Input defaultValue={activePortal.color} className="w-32 font-mono" />
          </div>
        </Row>
        <div className="flex justify-end">
          <Button>Save changes</Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <SectionHeading title="Delete portal" description="Permanently delete this portal. This action is irreversible" />
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Delete {activePortal.name}
        </Button>
      </div>
      <DeletePortalDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function DomainSettings() {
  const [dialog, setDialog] = React.useState<"edit" | "dns" | null>(null);
  return (
    <div className="grid gap-5">
      <SectionHeading
        title="Custom domain"
        description="You can host your portal on a custom domain. For instance, if your website is yourdomain.com and you want your portal available at docs.yourdomain.com, simply enter that in this field."
      />
      <div className="grid gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Custom domain:</span>
            <span className="font-medium">{activePortal.customDomain}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-amber-500/10 px-2 font-medium text-amber-700 text-xs dark:text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Awaiting verification
            </span>
            <Button variant="outline" size="sm" onClick={() => setDialog("edit")}>
              Edit
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Your custom portal will start working as soon as it is verified.
        </p>
        <Button variant="link" size="sm" className="w-fit px-0" onClick={() => setDialog("dns")}>
          Edit configuration
        </Button>
      </div>
      <CustomDomainDialog open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} edit />
      <DnsConfigurationDialog open={dialog === "dns"} onOpenChange={(o) => !o && setDialog(null)} />
    </div>
  );
}

const socialPlatforms = [
  { key: "instagram", label: "Instagram", prefix: "instagram.com/" },
  { key: "x", label: "X", prefix: "x.com/" },
  { key: "whatsapp", label: "WhatsApp", prefix: "wa.me/" },
  { key: "linkedin", label: "LinkedIn", prefix: "linkedin.com/company/" },
  { key: "youtube", label: "YouTube", prefix: "youtube.com/@" },
  { key: "tiktok", label: "TikTok", prefix: "tiktok.com/@" },
  { key: "facebook", label: "Facebook", prefix: "facebook.com/" },
  { key: "github", label: "GitHub", prefix: "github.com/" },
];

function LayoutPreview({ kind }: { kind: "classic" | "sidebar" }) {
  return (
    <div className="flex h-24 w-full gap-1.5 overflow-hidden rounded-lg border bg-muted/40 p-2">
      {kind === "sidebar" ? (
        <div className="grid w-1/4 content-start gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1.5 rounded bg-muted-foreground/25" />
          ))}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-1.5">
        {kind === "classic" ? (
          <>
            <span className="mx-auto mt-1 h-2 w-1/2 rounded bg-muted-foreground/30" />
            <span className="mx-auto h-3 w-2/3 rounded-full border bg-background" />
            <div className="mt-auto grid grid-cols-3 gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-6 rounded border bg-background" />
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="h-2 w-1/2 rounded bg-muted-foreground/30" />
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-1.5 w-full rounded bg-muted-foreground/15" />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const [layout, setLayout] = React.useState<"classic" | "sidebar">("classic");
  const [visible, setVisible] = React.useState(["instagram", "x", "whatsapp"]);
  const values: Record<string, string> = { instagram: "noorclinics.qa", x: "noorclinics", whatsapp: "97444001234" };
  const hidden = socialPlatforms.filter((p) => !visible.includes(p.key));

  return (
    <div className="grid gap-6">
      <SectionHeading title="Appearance" description="Pick the layout that fits how your visitors read." />
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              value: "classic",
              title: "Classic",
              description: "A welcoming home page with search and featured topics.",
            },
            {
              value: "sidebar",
              title: "Documentation",
              description: "Side-by-side navigation that keeps every guide a click away.",
            },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLayout(option.value)}
            className={cn(
              "grid gap-2.5 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40",
              layout === option.value && "border-primary ring-2 ring-primary/20",
            )}
          >
            <LayoutPreview kind={option.value} />
            <div className="grid gap-0.5">
              <span className="font-medium text-sm">{option.title}</span>
              <span className="text-muted-foreground text-xs">{option.description}</span>
            </div>
          </button>
        ))}
      </div>
      <Separator />
      <SectionHeading
        title="Social links"
        description="Add the handle for each network and your help center builds the full link. Shown in the documentation layout footer."
      />
      <div className="grid gap-2">
        {visible.map((key) => {
          const platform = socialPlatforms.find((p) => p.key === key);
          if (!platform) return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm">{platform.label}</span>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>{platform.prefix}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput placeholder="handle" defaultValue={values[key]} />
              </InputGroup>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove"
                onClick={() => setVisible((v) => v.filter((k) => k !== key))}
              >
                <X />
              </Button>
            </div>
          );
        })}
        {hidden.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-fit">
                <Plus /> Add social link
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {hidden.map((p) => (
                <DropdownMenuItem key={p.key} onSelect={() => setVisible((v) => [...v, p.key])}>
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button>Save changes</Button>
      </div>
    </div>
  );
}

const integrations = [
  {
    title: "Google Tag Manager",
    description: "Add analytics and marketing tags by connecting your Tag Manager container.",
    placeholder: "GTM-XXXXXXX",
    help: "Find this in your Google Tag Manager workspace. Leave empty to disable.",
    value: "GTM-5K8QX2M",
  },
  {
    title: "Google Analytics 4",
    description: "Measure traffic and visitor behavior on your help center with Google Analytics.",
    placeholder: "G-XXXXXXXXXX",
    help: "Find the measurement ID under Admin → Data streams in Google Analytics. Leave empty to disable.",
    value: "",
  },
  {
    title: "Hotjar",
    description: "Understand how visitors use your help center with heatmaps and session recordings.",
    placeholder: "1234567",
    help: "Find your site ID under Sites & organizations in Hotjar. Leave empty to disable.",
    value: "",
  },
  {
    title: "Plausible",
    description: "Track help center traffic with privacy-friendly Plausible Analytics.",
    placeholder: "example.com",
    help: "Enter the domain configured in your Plausible site settings. Leave empty to disable.",
    value: "",
  },
  {
    title: "Amplitude",
    description: "Analyze visitor behavior on your help center with Amplitude.",
    placeholder: "0123456789abcdef0123456789abcdef",
    help: "Find the API key in your Amplitude project settings. Leave empty to disable.",
    value: "",
  },
];

function IntegrationsSettings() {
  return (
    <div className="grid gap-5">
      <SectionHeading title="Integrations" description="Connect tools that extend what your help center can do." />
      <div className="grid gap-3 rounded-xl border p-4">
        <div className="grid gap-0.5">
          <span className="font-medium text-sm">Live chat with Chatwoot</span>
          <span className="text-muted-foreground text-sm">
            Show a live chat widget on your help center so visitors can reach you while they read.
          </span>
        </div>
        <NativeSelect className="w-full" defaultValue="web">
          <option value="">No widget</option>
          <option value="web">Noor Clinics website (Website)</option>
          <option value="app">Noor app support (Website)</option>
        </NativeSelect>
      </div>
      {integrations.map((item) => (
        <div key={item.title} className="grid gap-3 rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-0.5">
              <span className="font-medium text-sm">{item.title}</span>
              <span className="text-muted-foreground text-sm">{item.description}</span>
            </div>
            {item.value ? (
              <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-emerald-500/10 px-2 font-medium text-emerald-700 text-xs dark:text-emerald-400">
                Connected
              </span>
            ) : null}
          </div>
          <Input placeholder={item.placeholder} defaultValue={item.value} className="font-mono" />
          <p className="text-muted-foreground text-xs">{item.help}</p>
        </div>
      ))}
      <div className="flex justify-end">
        <Button>Save changes</Button>
      </div>
    </div>
  );
}

export function PortalSettings() {
  const [tab, setTab] = React.useState<SettingsTab>("general");
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          <PortalTitle section="Settings" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {nav.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={cn(
                  "flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground",
                  tab === item.value && "bg-muted font-medium text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="max-w-[40rem] pb-4">
            {tab === "general" ? <GeneralSettings /> : null}
            {tab === "domain" ? <DomainSettings /> : null}
            {tab === "appearance" ? <AppearanceSettings /> : null}
            {tab === "integrations" ? <IntegrationsSettings /> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

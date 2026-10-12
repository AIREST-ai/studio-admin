"use client";
// Chatwoot PortalSettings (components-next/HelpCenter/Pages/PortalSettingsPage): General (PortalBaseSettings +
// ConfirmDeletePortalDialog), Domain (PortalConfigurationSettings + AddCustomDomainDialog + DNSConfigurationDialog),
// Appearance (PortalLayoutContentSettings) and Integrations (PortalIntegrationsSettings), inside a Studio card
// with a side nav. Saving writes to the mock store (hc-store.ts) and shows Chatwoot's success alert as a toast.
import * as React from "react";

import { cn } from "cn";
import { ArrowUpRight, Blocks, Globe, Palette, Plus, Settings2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/utils";

import type { Portal } from "./data";
import { hc, useActivePortal } from "./hc-store";
import { ToneBadge } from "./hc-ui";
import { CustomDomainDialog, DeletePortalDialog, DnsConfigurationDialog } from "./help-center-dialogs";
import { HelpCenterHeader } from "./portal-title";

type SettingsTab = "general" | "domain" | "appearance" | "integrations";

const nav: { value: SettingsTab; label: string; icon: React.ElementType; description: string }[] = [
  { value: "general", label: "General", icon: Settings2, description: "Logo, name, texts, slug and brand color." },
  { value: "domain", label: "Domain", icon: Globe, description: "Host your portal on a custom domain." },
  {
    value: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Pick the layout that fits how your visitors read.",
  },
  {
    value: "integrations",
    label: "Integrations",
    icon: Blocks,
    description: "Connect tools that extend what your help center can do.",
  },
];

function Row({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[9rem_1fr] sm:items-start sm:gap-4">
      <Label htmlFor={htmlFor} className="text-muted-foreground sm:pt-2">
        {label}
      </Label>
      <div className="grid min-w-0 gap-1">
        {children}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
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

const URL_RE = /^https?:\/\/\S+$/;

function GeneralSettings({ portal }: { portal: Portal }) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [form, setForm] = React.useState(portal);
  const [logo, setLogo] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setForm(portal);
    setTouched(false);
  }, [portal]);

  const nameError = touched && !form.name.trim() ? "Name is required" : null;
  const slugError = touched && !form.slug.trim() ? "Slug is required" : null;
  const linkError =
    touched && form.homePageLink && !URL_RE.test(form.homePageLink)
      ? "Enter a valid URL. The Home page link must start with 'http://' or 'https://'."
      : null;
  const set = (key: keyof Portal) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function save() {
    setTouched(true);
    if (!form.name.trim() || !form.slug.trim() || (form.homePageLink && !URL_RE.test(form.homePageLink))) return;
    hc.updatePortal(portal.id, form);
    toast.success("Portal updated successfully");
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <Row label="Logo">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar className="size-12 rounded-xl">
              {logo ? <AvatarImage src={logo} alt="" className="object-cover" /> : null}
              <AvatarFallback className="rounded-xl font-semibold text-lg text-white" style={{ background: form.color }}>
                {getInitials(form.name || "P").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 3 * 1024 * 1024) {
                  toast.error("Image size should be less than 3MB");
                  return;
                }
                setLogo(URL.createObjectURL(file));
                toast.success("Image added successfully. Please click on save changes to save the logo");
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload /> Upload logo
            </Button>
            {logo ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setLogo(null);
                  toast.success("Logo deleted successfully");
                }}
              >
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>
        </Row>
        <Row label="Name" htmlFor="portal-name-field" error={nameError}>
          <Input
            id="portal-name-field"
            placeholder="Portal name"
            value={form.name}
            aria-invalid={Boolean(nameError)}
            onChange={set("name")}
          />
        </Row>
        <Row label="Header text" htmlFor="portal-header-field">
          <Input
            id="portal-header-field"
            placeholder="Portal header text"
            value={form.headerText}
            onChange={set("headerText")}
          />
        </Row>
        <Row label="Page title" htmlFor="portal-title-field">
          <Input
            id="portal-title-field"
            placeholder="Portal page title"
            value={form.pageTitle}
            onChange={set("pageTitle")}
          />
        </Row>
        <Row label="Home page link" htmlFor="portal-link-field" error={linkError}>
          <Input
            id="portal-link-field"
            placeholder="Portal home page link"
            value={form.homePageLink}
            aria-invalid={Boolean(linkError)}
            onChange={set("homePageLink")}
          />
        </Row>
        <Row label="Slug" htmlFor="portal-slug-field" error={slugError}>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText>app.weblabs.studio/hc/</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="portal-slug-field"
              placeholder="Portal slug"
              value={form.slug}
              aria-invalid={Boolean(slugError)}
              onChange={set("slug")}
            />
          </InputGroup>
        </Row>
        <Row label="Brand color" htmlFor="portal-color-field">
          <div className="flex items-center gap-2">
            <label
              className="relative size-8 cursor-pointer overflow-hidden rounded-lg border"
              style={{ background: form.color }}
            >
              <input
                type="color"
                aria-label="Pick brand color"
                value={form.color}
                onChange={set("color")}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
            <Input id="portal-color-field" value={form.color} onChange={set("color")} className="w-32 font-mono" />
          </div>
        </Row>
        <div className="flex justify-end">
          <Button onClick={save}>Save changes</Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <SectionHeading title="Delete portal" description="Permanently delete this portal. This action is irreversible" />
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Delete {portal.name}
        </Button>
      </div>
      <DeletePortalDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function DomainSettings({ portal }: { portal: Portal }) {
  const [dialog, setDialog] = React.useState<"edit" | "add" | "dns" | null>(null);
  return (
    <div className="grid gap-5">
      <SectionHeading
        title="Custom domain"
        description="You can host your portal on a custom domain. For instance, if your website is yourdomain.com and you want your portal available at docs.yourdomain.com, simply enter that in this field."
      />
      {portal.customDomain ? (
        <div className="grid gap-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Custom domain:</span>
              <span className="font-medium">{portal.customDomain}</span>
            </div>
            <div className="flex items-center gap-2">
              <ToneBadge color="amber">Awaiting verification</ToneBadge>
              <Button variant="outline" size="sm" onClick={() => setDialog("edit")}>
                Edit
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Your custom portal will start working as soon as it is verified.</p>
          <Button variant="link" size="sm" className="w-fit px-0" onClick={() => setDialog("dns")}>
            Edit configuration
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="w-fit" onClick={() => setDialog("add")}>
          <Plus /> Add custom domain
        </Button>
      )}
      <CustomDomainDialog
        open={dialog === "edit" || dialog === "add"}
        onOpenChange={(o) => !o && setDialog(null)}
        edit={dialog === "edit"}
      />
      <DnsConfigurationDialog open={dialog === "dns"} onOpenChange={(o) => !o && setDialog(null)} />
    </div>
  );
}

// PortalLayoutContentSettings.vue SOCIAL_PLATFORMS: the handle is stored, the prefix is filled in by the portal.
const socialPlatforms = [
  { key: "facebook", label: "Facebook", prefix: "facebook.com/" },
  { key: "x", label: "X", prefix: "x.com/" },
  { key: "instagram", label: "Instagram", prefix: "instagram.com/" },
  { key: "linkedin", label: "LinkedIn", prefix: "linkedin.com/" },
  { key: "youtube", label: "YouTube", prefix: "youtube.com/" },
  { key: "tiktok", label: "TikTok", prefix: "tiktok.com/" },
  { key: "github", label: "GitHub", prefix: "github.com/" },
  { key: "whatsapp", label: "WhatsApp", prefix: "wa.me/" },
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
  const [shown, setShown] = React.useState(["instagram", "x", "whatsapp"]);
  const [handles, setHandles] = React.useState<Record<string, string>>({
    instagram: "weblabs.studio",
    x: "weblabsstudio",
    whatsapp: "97444001122",
  });
  const available = socialPlatforms.filter((p) => !shown.includes(p.key));

  return (
    <div className="grid gap-6">
      <SectionHeading title="Appearance" description="Pick the layout that fits how your visitors read." />
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Layout">
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
            role="radio"
            aria-checked={layout === option.value}
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
        {shown.map((key) => {
          const platform = socialPlatforms.find((p) => p.key === key);
          if (!platform) return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm">{platform.label}</span>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>{platform.prefix}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="handle"
                  value={handles[key] ?? ""}
                  onChange={(e) => setHandles((v) => ({ ...v, [key]: e.target.value }))}
                />
              </InputGroup>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove"
                title="Remove"
                onClick={() => setShown((v) => v.filter((k) => k !== key))}
              >
                <X />
              </Button>
            </div>
          );
        })}
        {available.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-fit">
                <Plus /> Add social link
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {available.map((p) => (
                <DropdownMenuItem key={p.key} onSelect={() => setShown((v) => [...v, p.key])}>
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => toast.success("Portal updated successfully")}>Save changes</Button>
      </div>
    </div>
  );
}

// PortalIntegrationsSettings.vue ANALYTICS_PROVIDERS with their formats.
const integrations = [
  {
    key: "gtm",
    title: "Google Tag Manager",
    description: "Add analytics and marketing tags by connecting your Tag Manager container.",
    placeholder: "GTM-XXXXXXX",
    help: "Find this in your Google Tag Manager workspace. Leave empty to disable.",
    invalid: "Enter a valid container ID, for example GTM-XXXXXXX.",
    format: /^GTM-[A-Z0-9]+$/,
    value: "GTM-5K8QX2M",
  },
  {
    key: "ga4",
    title: "Google Analytics 4",
    description: "Measure traffic and visitor behavior on your help center with Google Analytics.",
    placeholder: "G-XXXXXXXXXX",
    help: "Find the measurement ID under Admin → Data streams in Google Analytics. Leave empty to disable.",
    invalid: "Enter a valid measurement ID, for example G-XXXXXXXXXX.",
    format: /^G-[A-Z0-9]+$/,
    value: "",
  },
  {
    key: "hotjar",
    title: "Hotjar",
    description: "Understand how visitors use your help center with heatmaps and session recordings.",
    placeholder: "1234567",
    help: "Find your site ID under Sites & organizations in Hotjar. Leave empty to disable.",
    invalid: "Enter a numeric Hotjar site ID.",
    format: /^\d+$/,
    value: "",
  },
  {
    key: "plausible",
    title: "Plausible",
    description: "Track help center traffic with privacy-friendly Plausible Analytics.",
    placeholder: "example.com",
    help: "Enter the domain configured in your Plausible site settings. Leave empty to disable.",
    invalid: "Enter a valid domain, for example example.com.",
    format: /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i,
    value: "",
  },
  {
    key: "amplitude",
    title: "Amplitude",
    description: "Analyze visitor behavior on your help center with Amplitude.",
    placeholder: "0123456789abcdef0123456789abcdef",
    help: "Find the API key in your Amplitude project settings. Leave empty to disable.",
    invalid: "Enter a valid Amplitude API key.",
    format: /^[a-z0-9]+$/i,
    value: "",
  },
  {
    key: "clarity",
    title: "Microsoft Clarity",
    description: "Capture heatmaps and session recordings with Microsoft Clarity.",
    placeholder: "abcd1234ef",
    help: "Find the project ID in your Clarity project settings. Leave empty to disable.",
    invalid: "Enter a valid Clarity project ID.",
    format: /^[a-z0-9]+$/i,
    value: "",
  },
  {
    key: "meta",
    title: "Meta Pixel",
    description: "Measure ad conversions and build audiences from help center visits with Meta Pixel.",
    placeholder: "123456789012345",
    help: "Find the pixel ID in Meta Events Manager. Leave empty to disable.",
    invalid: "Enter a numeric pixel ID.",
    format: /^\d+$/,
    value: "",
  },
];

function IntegrationsSettings() {
  const [ids, setIds] = React.useState<Record<string, string>>(
    Object.fromEntries(integrations.map((i) => [i.key, i.value])),
  );
  const [touched, setTouched] = React.useState(false);
  const errorOf = (item: (typeof integrations)[number]) =>
    touched && ids[item.key] && !item.format.test(ids[item.key]) ? item.invalid : null;

  return (
    <div className="grid gap-5">
      <SectionHeading title="Integrations" description="Connect tools that extend what your help center can do." />
      <div className="grid gap-3 rounded-xl border p-4">
        <div className="grid gap-0.5">
          <span className="font-medium text-sm">Live chat widget</span>
          <span className="text-muted-foreground text-sm">
            Show a live chat widget on your help center so visitors can reach you while they read.
          </span>
        </div>
        <NativeSelect className="w-full" defaultValue="web" aria-label="Select live chat widget">
          <option value="">No widget</option>
          <option value="web">Weblabs Website (Website)</option>
          <option value="support">Weblabs Support Widget (Website)</option>
        </NativeSelect>
      </div>
      {integrations.map((item) => {
        const error = errorOf(item);
        return (
          <div key={item.key} className="grid gap-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-0.5">
                <span className="font-medium text-sm">{item.title}</span>
                <span className="text-muted-foreground text-sm">{item.description}</span>
              </div>
              {ids[item.key] && !error ? <ToneBadge color="green">Connected</ToneBadge> : null}
            </div>
            <Input
              placeholder={item.placeholder}
              value={ids[item.key]}
              aria-invalid={Boolean(error)}
              onChange={(e) => setIds((v) => ({ ...v, [item.key]: e.target.value.trim() }))}
              className="font-mono"
            />
            <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{error ?? item.help}</p>
          </div>
        );
      })}
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setTouched(true);
            if (integrations.some((i) => ids[i.key] && !i.format.test(ids[i.key]))) return;
            toast.success("Portal updated successfully");
          }}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function PortalSettings() {
  const portal = useActivePortal();
  const [tab, setTab] = React.useState<SettingsTab>("general");
  const current = nav.find((item) => item.value === tab);
  return (
    <div className="flex flex-col gap-4">
      <HelpCenterHeader
        section="settings"
        description="Portal details, custom domain, look and connected tools for this help center."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a
              href={portal?.customDomain ? `https://${portal.customDomain}` : "https://help.weblabs.studio"}
              target="_blank"
              rel="noreferrer"
            >
              <ArrowUpRight /> Preview portal
            </a>
          </Button>
        }
      />
      {portal ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl leading-none">{current?.label}</CardTitle>
            <CardDescription>{current?.description}</CardDescription>
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
              <div className="min-w-0 max-w-[40rem] pb-4">
                {tab === "general" ? <GeneralSettings portal={portal} /> : null}
                {tab === "domain" ? <DomainSettings portal={portal} /> : null}
                {tab === "appearance" ? <AppearanceSettings /> : null}
                {tab === "integrations" ? <IntegrationsSettings /> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

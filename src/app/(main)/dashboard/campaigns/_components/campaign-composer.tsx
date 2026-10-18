"use client";

// M129-C (Fahad 129.3): the campaign composer, with the parts respond.io (Broadcasts), WATI (Campaigns) and Chatwoot
// (WhatsApp campaigns) share: channel and inbox with the channel's official conditions, audience (labels, a segment
// of contacts or a CSV file, with the counts before sending), content (an approved WhatsApp template with its
// variables filled from contact fields and a media header within the channel's limits), and timing (send now,
// schedule in a time zone, or save as a draft). Sending is simulated (Fahad 129.2) and every screen says so.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ExternalLink,
  FileUp,
  Info,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_NAME } from "@/config/app-config";
import { downloadCsv, SimBadge } from "@/lib/cw/preview-sim-ui";
import { useCwList } from "@/lib/cw/store";

import { PageHeading } from "../../contacts/_components/studio-ui";
import { type TemplateRecord, templateKey, variableNumbers } from "../../settings/templates/_components/template-model";
import { bubbleFromRecord, WhatsAppBubble } from "../../settings/templates/_components/whatsapp-bubble";
import {
  type AudienceSpec,
  type CampaignContent,
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  FIELD_OPTIONS,
  fillFor,
  formatInZone,
  mediaProblem,
  OP_LABELS,
  readCsvAudience,
  resolveAudience,
  SEGMENT_FIELDS,
  type SegmentRule,
  TIME_ZONES,
  type VariableSource,
  variableValue,
  withArticle,
  zonedToEpoch,
} from "./broadcast";
import { SIMULATED_SEND, sendNow, useAudienceContacts } from "./campaign-runtime";
import { type BroadcastChannel, CHANNEL_ORDER, CHANNELS, isBroadcastChannel, WHATSAPP_DAILY_LIMIT } from "./channels";
import type { OneOffCampaign } from "./data";
import { setCampaignList, useCampaignList, useCampaignsReady } from "./store";

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-4">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary text-xs underline-offset-2 hover:underline"
    >
      {label} <ExternalLink className="size-3" />
    </a>
  );
}

export function ChannelRules({ channel }: { channel: (typeof CHANNEL_ORDER)[number] }) {
  const info = CHANNELS[channel];
  return (
    <ul className="grid gap-2" data-channel-rules={channel}>
      {info.rules.map((rule) => (
        <li key={rule.text} className="grid gap-0.5 text-sm">
          <span>{rule.text}</span>
          {rule.source ? <SourceLink href={rule.source} label={`Source: ${rule.sourceLabel ?? rule.source}`} /> : null}
        </li>
      ))}
      {info.media?.length ? (
        <li className="grid gap-0.5 text-sm">
          <span>
            Media:{" "}
            {info.media.map((m) => `${m.label} ${m.extensions} up to ${m.maxBytes / 1024 / 1024} MB`).join(" · ")}
          </span>
          {info.mediaSource ? <SourceLink href={info.mediaSource} label="Source: media limits" /> : null}
        </li>
      ) : null}
    </ul>
  );
}

const SAMPLE_CSV: (string | number)[][] = [
  ["name", "phone", "email", "city"],
  ["Noura Al-Thani", "+974 5512 3348", "noura.althani@outlook.com", "Doha"],
  ["Khalid Saeed", "+974 5530 1122", "", "Al Wakrah"],
  ["Mona Adel", "+971 50 123 4567", "mona@example.com", "Dubai"],
];

const newId = () => Date.now();

/** Meta needs a value for every variable: a text, or a field every recipient has (or a fallback for those without). */
function variableOk(source: VariableSource | undefined, recipients: { fields: Record<string, string> }[]): boolean {
  if (!source) return false;
  if (source.kind === "text") return !!source.value.trim();
  return (
    !!source.fallback.trim() || (recipients.length > 0 && recipients.every((r) => !!r.fields[source.field]?.trim()))
  );
}

export function CampaignComposer({ campaignId, initialChannel }: { campaignId?: number; initialChannel?: string }) {
  const router = useRouter();
  const ready = useCampaignsReady();
  const [whatsapp] = useCampaignList("whatsapp");
  const [sms] = useCampaignList("sms");
  const [instagram] = useCampaignList("instagram");
  const [messenger] = useCampaignList("messenger");
  const lists: Record<BroadcastChannel, OneOffCampaign[]> = { whatsapp, sms, instagram, messenger };
  const existingEntry = campaignId
    ? (Object.entries(lists) as [BroadcastChannel, OneOffCampaign[]][])
        .map(([list, items]) => ({ list, campaign: items.find((c) => c.id === campaignId) }))
        .find((e) => e.campaign)
    : undefined;
  const existing = existingEntry?.campaign;

  const [inboxes] = useCwList("inboxes");
  const [labels] = useCwList("labels");
  const [templateList] = useCwList("whatsappTemplates");
  const templates = templateList as TemplateRecord[];
  const contacts = useAudienceContacts();

  const [loaded, setLoaded] = React.useState(!campaignId);
  const [channel, setChannel] = React.useState<BroadcastChannel>(
    isBroadcastChannel(initialChannel) ? initialChannel : "whatsapp",
  );
  const [title, setTitle] = React.useState("");
  const [inbox, setInbox] = React.useState("");
  const [mode, setMode] = React.useState<AudienceSpec["mode"]>("segment");
  const [pickedLabels, setPickedLabels] = React.useState<string[]>([]);
  const [match, setMatch] = React.useState<"all" | "any">("all");
  const [rules, setRules] = React.useState<SegmentRule[]>([{ field: "phone", op: "present", value: "" }]);
  const [csv, setCsv] = React.useState<Extract<AudienceSpec, { mode: "csv" }> | null>(null);
  const [csvError, setCsvError] = React.useState<string | null>(null);
  const [tplKey, setTplKey] = React.useState("");
  const [variables, setVariables] = React.useState<Record<string, VariableSource>>({});
  const [text, setText] = React.useState("");
  const [media, setMedia] = React.useState<CampaignContent["media"]>(null);
  const [timing, setTiming] = React.useState<"now" | "later">("now");
  const [local, setLocal] = React.useState("");
  const [zone, setZone] = React.useState("Asia/Qatar");
  const [optIn, setOptIn] = React.useState(false);
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const [showErrors, setShowErrors] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const csvInput = React.useRef<HTMLInputElement>(null);
  const mediaInput = React.useRef<HTMLInputElement>(null);

  // An existing draft or scheduled campaign opened by its link: fill the form once the saved campaigns are read.
  React.useEffect(() => {
    if (loaded || !ready) return;
    setLoaded(true);
    const c = existing;
    if (!c || !c.channel) return;
    setChannel(c.channel);
    setTitle(c.title);
    setInbox(c.inbox);
    const spec = c.audienceSpec;
    if (spec) {
      setMode(spec.mode);
      if (spec.mode === "labels") setPickedLabels(spec.labels);
      if (spec.mode === "segment") {
        setMatch(spec.match);
        setRules(spec.rules);
      }
      if (spec.mode === "csv") setCsv(spec);
    }
    setTplKey(c.content?.templateKey ?? "");
    setVariables(c.content?.variables ?? {});
    setText(c.content?.text ?? "");
    setMedia(c.content?.media ?? null);
    setTiming(c.schedule?.mode ?? "now");
    setLocal(c.schedule?.local ?? "");
    setZone(c.schedule?.zone ?? "Asia/Qatar");
    setOptIn(!!c.optIn);
  }, [loaded, ready, existing]);

  const info = CHANNELS[channel];
  const channelInboxes = inboxes.filter((i) => i.channel === info.inboxChannel).map((i) => i.name);
  React.useEffect(() => {
    if (!inbox && channelInboxes.length === 1) setInbox(channelInboxes[0]);
  }, [inbox, channelInboxes]);

  const spec: AudienceSpec =
    mode === "labels"
      ? { mode, labels: pickedLabels }
      : mode === "segment"
        ? { mode, match, rules }
        : (csv ?? { mode: "csv", fileName: "", columns: [], rows: [], problems: [] });
  const audience = resolveAudience(spec, channel, contacts);
  const reasons = Object.entries(
    audience.skipped.reduce<Record<string, number>>((acc, s) => {
      acc[s.reason] = (acc[s.reason] ?? 0) + 1;
      return acc;
    }, {}),
  );

  const approved = templates.filter(
    (t) => t.provider === "Meta" && t.status === "APPROVED" && (!inbox || t.inboxes.includes(inbox)),
  );
  const notApproved = templates.filter((t) => t.provider === "Meta" && t.status !== "APPROVED").length;
  const template = templates.find((t) => templateKey(t) === tplKey);
  const numbers = template ? variableNumbers(template.body) : [];
  const previewRecipient = audience.recipients[Math.min(previewIndex, Math.max(0, audience.recipients.length - 1))];
  const sampleFields = previewRecipient?.fields ?? { first_name: "Noura", name: "Noura Al-Thani" };
  const wantMedia = channel === "whatsapp" ? template?.media : undefined;
  const mediaError = media ? mediaProblem(channel, media, wantMedia) : null;
  const scheduledAt = timing === "later" && local ? zonedToEpoch(local, zone) : null;

  // ---------- validation ----------
  const errors: Record<string, string | undefined> = {
    title: title.trim() ? undefined : "Enter a campaign name",
    inbox: inbox ? undefined : `Choose ${withArticle(info.label)} inbox`,
    audience:
      mode === "labels" && !pickedLabels.length
        ? "Choose at least one label"
        : mode === "csv" && !csv
          ? "Upload a CSV file"
          : audience.recipients.length
            ? undefined
            : "Nobody in this audience can receive the campaign on this channel",
    template: channel === "whatsapp" && !template ? "Choose an approved template" : undefined,
    variables:
      channel === "whatsapp" && template && numbers.some((n) => !variableOk(variables[String(n)], audience.recipients))
        ? "Give every variable a text, or a contact field with a fallback for contacts who do not have it"
        : undefined,
    media:
      wantMedia && !media
        ? `This template has ${withArticle(wantMedia)} header: choose the file`
        : (mediaError ?? undefined),
    text:
      channel !== "whatsapp" && !text.trim()
        ? "Write the message"
        : channel === "sms" && text.length > 200
          ? "SMS campaign messages are up to 200 characters"
          : undefined,
    schedule:
      timing === "later"
        ? !local
          ? "Choose the date and time"
          : scheduledAt && scheduledAt <= Date.now()
            ? "Choose a time in the future"
            : undefined
        : undefined,
    optIn: channel === "whatsapp" && !optIn ? "Confirm that these contacts opted in" : undefined,
  };
  const sendErrors = Object.entries(errors).filter(([, v]) => v);
  // The "Before sending" list: only the lines that apply to this channel and content.
  const checklist: [string, string | undefined, string][] = [
    ["title", errors.title, "Name set"],
    ["inbox", errors.inbox, `Inbox: ${inbox}`],
    ["audience", errors.audience, `${audience.recipients.length} can receive it`],
    ...(channel === "whatsapp"
      ? ([
          ["template", errors.template, `Template ${template?.name ?? ""} is approved`],
          ["variables", errors.variables, "Every variable has a value"],
        ] as [string, string | undefined, string][])
      : ([["text", errors.text, "Message written"]] as [string, string | undefined, string][])),
    ...(wantMedia || media
      ? ([["media", errors.media, "Media fits the channel's limits"]] as [string, string | undefined, string][])
      : []),
    ["schedule", errors.schedule, timing === "later" ? "Time set, in the future" : "Sends now"],
    ...(channel === "whatsapp"
      ? ([["optIn", errors.optIn, "Opt-in confirmed"]] as [string, string | undefined, string][])
      : []),
  ] as [string, string | undefined, string][];

  function audienceLabels(): string[] {
    if (mode === "labels") return pickedLabels;
    if (mode === "csv") return csv ? [`CSV: ${csv.fileName}`] : [];
    return rules
      .filter((r) => r.op === "present" || r.op === "absent" || r.value.trim())
      .map(
        (r) =>
          `${SEGMENT_FIELDS.find((f) => f.value === r.field)?.label ?? r.field} ${OP_LABELS[r.op]}${r.op === "present" || r.op === "absent" ? "" : ` ${r.value}`}`,
      );
  }

  function build(status: OneOffCampaign["status"], note?: string): OneOffCampaign {
    const content: CampaignContent =
      channel === "whatsapp"
        ? { templateKey: tplKey, templateName: template?.name, templateCode: template?.code, variables, media }
        : { text, media };
    const message =
      channel === "whatsapp" ? (template ? fillFor(template.body, variables, { fields: sampleFields }) : "") : text;
    const at = timing === "later" ? scheduledAt : null;
    return {
      id: existing?.id ?? newId(),
      title: title.trim() || "Untitled campaign",
      message: message || "(no message yet)",
      status,
      inbox,
      scheduledAt: at ? formatInZone(at, zone) : status === "draft" ? "Not scheduled" : "Now",
      audience: audienceLabels(),
      ...(channel === "whatsapp" && template ? { template: `${template.name} (${template.code})` } : {}),
      channel,
      audienceSpec: spec,
      content,
      schedule: { mode: timing, ...(timing === "later" ? { local, zone, ...(at ? { at } : {}) } : {}) },
      optIn,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      history: [
        ...(existing?.history ?? []),
        {
          at: Date.now(),
          text: note ?? (status === "draft" ? "Saved as draft" : `Scheduled for ${at ? formatInZone(at, zone) : ""}`),
        },
      ],
    };
  }

  function store(campaign: OneOffCampaign) {
    // A campaign that moved to another channel leaves its old list.
    if (existingEntry && existingEntry.list !== channel)
      setCampaignList(existingEntry.list, (prev) => prev.filter((c) => c.id !== campaign.id));
    setCampaignList(channel, (prev) =>
      prev.some((c) => c.id === campaign.id)
        ? prev.map((c) => (c.id === campaign.id ? campaign : c))
        : [campaign, ...prev],
    );
  }

  function saveDraft() {
    if (!title.trim()) {
      setShowErrors(true);
      toast.error("Enter a campaign name to save the draft");
      return;
    }
    store(build("draft"));
    toast.success(`Draft "${title.trim()}" saved`, {
      description: `Saved in the ${PRODUCT_NAME} preview. Nothing was sent.`,
    });
    router.push(CHANNELS[channel].href);
  }

  function submit() {
    setShowErrors(true);
    if (sendErrors.length) {
      toast.error(`${sendErrors.length} thing${sendErrors.length === 1 ? "" : "s"} to fix`, {
        description: sendErrors.map(([, v]) => v).join(" · "),
      });
      return;
    }
    if (timing === "later") {
      store(build("scheduled"));
      toast.success(`"${title.trim()}" scheduled`, {
        description: `${scheduledAt ? formatInZone(scheduledAt, zone) : ""}. ${SIMULATED_SEND}`,
      });
      router.push(CHANNELS[channel].href);
      return;
    }
    setConfirmOpen(true);
  }

  function confirmSend() {
    const campaign = build("scheduled", "Send now confirmed");
    store(campaign);
    sendNow(channel, campaign.id);
    setConfirmOpen(false);
    toast.success(`"${campaign.title}" is running`, { description: SIMULATED_SEND });
    router.push(`/dashboard/campaigns/report/${campaign.id}`);
  }

  async function readCsv(file: File | undefined) {
    if (!file) return;
    setCsvError(null);
    if (file.size > CSV_MAX_BYTES) {
      setCsvError(
        `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; this preview reads CSV files up to 1 MB.`,
      );
      return;
    }
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setCsvError(`${file.name} is not a CSV file.`);
      return;
    }
    const result = readCsvAudience(file.name, await file.text());
    if ("error" in result) {
      setCsvError(result.error);
      setCsv(null);
      return;
    }
    setCsv(result);
  }

  if (!ready || !loaded) {
    return <PageHeading title="Loading campaign…" subtitle="Reading the campaigns saved in the preview." />;
  }
  if (campaignId && !existing) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Campaign not found" subtitle="It may have been deleted." />
        <Button variant="outline" size="sm" className="w-fit" asChild>
          <Link href="/dashboard/campaigns/whatsapp">
            <ChevronLeft /> Campaigns
          </Link>
        </Button>
      </div>
    );
  }
  if (existing && existing.status !== "draft" && existing.status !== "scheduled") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading
          title={existing.title}
          subtitle="This campaign was sent, so it cannot be edited. Open its report."
        />
        <Button size="sm" className="w-fit" asChild>
          <Link href={`/dashboard/campaigns/report/${existing.id}`}>View report</Link>
        </Button>
      </div>
    );
  }

  const err = (key: string) => (showErrors ? errors[key] : undefined);
  const bubble = (() => {
    if (channel === "whatsapp" && template) {
      const values = numbers.map((n) => variableValue(variables[String(n)], { fields: sampleFields }) || `{{${n}}}`);
      const b = bubbleFromRecord(template, values);
      return { ...b, mediaName: media?.name ?? b.mediaName };
    }
    return {
      body: text || " ",
      buttons: [],
      media: media
        ? media.type.startsWith("image/")
          ? "image"
          : media.type.startsWith("video/")
            ? "video"
            : "document"
        : undefined,
      mediaName: media?.name,
    } as Parameters<typeof WhatsAppBubble>[0]["content"];
  })();

  return (
    <div className="@container flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground" asChild>
        <Link href={CHANNELS[channel].href}>
          <ChevronLeft /> {CHANNELS[channel].label} campaigns
        </Link>
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title={existing ? `Edit ${existing.title}` : "New campaign"}
          subtitle="A one-off message to many contacts: choose the channel, the audience, the content and when it goes."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={saveDraft}>
            Save as draft
          </Button>
          <Button size="sm" onClick={submit} data-composer-submit="">
            {timing === "later" ? <CalendarClock /> : <Send />}
            {timing === "later" ? "Schedule campaign" : "Send now"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 border-dashed bg-amber-500/5 px-3 py-2 text-sm">
        <SimBadge />
        <span className="text-muted-foreground">{SIMULATED_SEND} The report shows simulated numbers.</span>
      </div>

      <div className="grid min-w-0 items-start gap-4 @4xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-4">
          <Section title="Channel" description="Each channel has its own rules for messages a business starts.">
            <div role="radiogroup" aria-label="Channel" className="grid gap-2 @xl:grid-cols-2 @3xl:grid-cols-3">
              {CHANNEL_ORDER.map((id) => {
                const c = CHANNELS[id];
                const selectable = isBroadcastChannel(id);
                const active = selectable && channel === id;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: a card that acts as one radio of an ARIA radiogroup (title + help text)
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-disabled={!selectable}
                    data-channel={id}
                    onClick={() => {
                      if (!selectable) {
                        if (id === "live_chat") router.push(c.href);
                        else toast.info(`${c.label}: no campaigns`, { description: c.rules[0].text });
                        return;
                      }
                      setChannel(id);
                      setInbox("");
                      setMedia(null);
                    }}
                    className={cn(
                      "grid gap-1 rounded-lg border p-3 text-left transition-colors",
                      selectable ? "hover:bg-muted/50" : "cursor-help border-dashed bg-muted/30",
                      active && "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 font-medium text-sm">
                      {c.label}
                      {!selectable ? (
                        <Badge variant="outline" className="font-normal text-[10px]">
                          {id === "live_chat" ? "Separate page" : "Not available"}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground text-xs leading-snug">{c.summary}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 font-medium text-sm">{info.label} rules</p>
              <ChannelRules channel={channel} />
            </div>
            <div className="grid gap-4 @xl:grid-cols-2">
              <Field data-invalid={err("title") ? true : undefined}>
                <FieldLabel htmlFor="cmp-title">Campaign name</FieldLabel>
                <Input
                  id="cmp-title"
                  value={title}
                  placeholder="Eid offer for Qatar customers"
                  onChange={(e) => setTitle(e.target.value)}
                />
                {err("title") ? <p className="text-destructive text-xs">{err("title")}</p> : null}
              </Field>
              <Field data-invalid={err("inbox") ? true : undefined}>
                <FieldLabel htmlFor="cmp-inbox">Send from inbox</FieldLabel>
                <NativeSelect
                  id="cmp-inbox"
                  className="w-full"
                  value={inbox}
                  onChange={(e) => setInbox(e.target.value)}
                >
                  <option value="" disabled>
                    {channelInboxes.length ? "Select inbox" : `No ${info.label} inbox`}
                  </option>
                  {channelInboxes.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
                {err("inbox") ? <p className="text-destructive text-xs">{err("inbox")}</p> : null}
              </Field>
            </div>
          </Section>

          <Section title="Audience" description="Who receives it. The counts update as you choose.">
            <Tabs value={mode} onValueChange={(v) => setMode(v as AudienceSpec["mode"])}>
              <TabsList>
                <TabsTrigger value="segment">Segment of contacts</TabsTrigger>
                <TabsTrigger value="labels">Labels</TabsTrigger>
                <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === "labels" ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2">
                  {labels.map((l) => {
                    const on = pickedLabels.includes(l.title);
                    return (
                      // biome-ignore lint/a11y/noLabelWithoutControl: checkbox is nested
                      <label
                        key={l.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                          on && "border-primary bg-primary/5",
                        )}
                      >
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) =>
                            setPickedLabels((p) => (v ? [...p, l.title] : p.filter((x) => x !== l.title)))
                          }
                        />
                        <span className="size-2 rounded-full" style={{ background: l.color }} />
                        {l.title}
                      </label>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-xs">
                  Contacts with any of these labels (labels are added on the Contacts page).
                </p>
              </div>
            ) : null}
            {mode === "segment" ? (
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-sm">
                  Contacts that match
                  <NativeSelect
                    className="w-24"
                    size="sm"
                    value={match}
                    onChange={(e) => setMatch(e.target.value as "all" | "any")}
                    aria-label="Match"
                  >
                    <option value="all">all</option>
                    <option value="any">any</option>
                  </NativeSelect>
                  of these rules:
                </div>
                {rules.map((rule, index) => {
                  const def = SEGMENT_FIELDS.find((f) => f.value === rule.field) ?? SEGMENT_FIELDS[0];
                  const valueOptions = rule.field === "label" ? labels.map((l) => l.title) : def.values;
                  const noValue = rule.op === "present" || rule.op === "absent";
                  const setRule = (patch: Partial<SegmentRule>) =>
                    setRules((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rules have no id; order is their identity
                    <div
                      key={index}
                      data-segment-rule={index}
                      className="grid items-center gap-2 @xl:grid-cols-[1fr_140px_1fr_auto]"
                    >
                      <NativeSelect
                        className="w-full"
                        aria-label="Field"
                        value={rule.field}
                        onChange={(e) => {
                          const field = SEGMENT_FIELDS.find((f) => f.value === e.target.value) ?? SEGMENT_FIELDS[0];
                          setRule({ field: field.value, op: field.ops[0], value: field.values?.[0] ?? "" });
                        }}
                      >
                        {SEGMENT_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </NativeSelect>
                      <NativeSelect
                        className="w-full"
                        aria-label="Operator"
                        value={rule.op}
                        onChange={(e) => setRule({ op: e.target.value as SegmentRule["op"] })}
                      >
                        {def.ops.map((op) => (
                          <option key={op} value={op}>
                            {OP_LABELS[op]}
                          </option>
                        ))}
                      </NativeSelect>
                      {noValue ? (
                        <span />
                      ) : valueOptions?.length ? (
                        <NativeSelect
                          className="w-full"
                          aria-label="Value"
                          value={rule.value}
                          onChange={(e) => setRule({ value: e.target.value })}
                        >
                          <option value="" disabled>
                            Select
                          </option>
                          {valueOptions.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          aria-label="Value"
                          value={rule.value}
                          placeholder="Value"
                          onChange={(e) => setRule({ value: e.target.value })}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove rule"
                        onClick={() => setRules((rs) => rs.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setRules((rs) => [...rs, { field: "country", op: "is", value: "" }])}
                >
                  <Plus /> Add rule
                </Button>
              </div>
            ) : null}
            {mode === "csv" ? (
              <div className="grid gap-2">
                <input
                  ref={csvInput}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  aria-label="CSV file"
                  data-csv-input=""
                  onChange={(e) => {
                    void readCsv(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => csvInput.current?.click()}>
                    <FileUp /> Choose CSV file
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadCsv("campaign-audience-sample.csv", SAMPLE_CSV)}
                  >
                    Download a sample file
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  A header row with a phone column (phone, mobile or whatsapp), and optional name, email and other
                  columns. Up to {CSV_MAX_ROWS} rows and 1 MB in this preview. The file is read in this browser; its
                  rows are saved with the campaign.
                </p>
                {csvError ? (
                  <p className="flex items-start gap-1.5 text-destructive text-sm" data-csv-error="">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {csvError}
                  </p>
                ) : null}
                {csv ? (
                  <div className="grid gap-1 rounded-md border bg-muted/30 p-3 text-sm" data-csv-summary="">
                    <span className="font-medium">{csv.fileName}</span>
                    <span className="text-muted-foreground">
                      {csv.rows.length} rows read · columns: {csv.columns.join(", ")}
                    </span>
                    {csv.problems.length ? (
                      <span className="text-amber-700 dark:text-amber-300">
                        {csv.problems.length} rows dropped:{" "}
                        {csv.problems
                          .slice(0, 3)
                          .map((p) => `row ${p.row} (${p.reason})`)
                          .join(", ")}
                        {csv.problems.length > 3 ? "…" : ""}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 rounded-lg border p-3" data-audience-counts="">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  Matched{" "}
                  <strong className="tabular-nums" data-count-total="">
                    {audience.total}
                  </strong>
                </span>
                <span className="text-sm">
                  Will receive{" "}
                  <strong className="text-emerald-700 tabular-nums dark:text-emerald-400" data-count-recipients="">
                    {audience.recipients.length}
                  </strong>
                </span>
                <span className="text-sm">
                  Skipped{" "}
                  <strong className="tabular-nums" data-count-skipped="">
                    {audience.skipped.length}
                  </strong>
                </span>
              </div>
              {reasons.length ? (
                <ul className="grid gap-0.5 text-muted-foreground text-xs">
                  {reasons.map(([reason, n]) => (
                    <li key={reason}>
                      {n} × {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {audience.recipients.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {audience.recipients.slice(0, 8).map((r) => (
                    <Badge key={r.key} variant="secondary" className="font-normal">
                      {r.name}
                      <span className="ms-1 text-muted-foreground" dir="ltr">
                        {r.address}
                      </span>
                    </Badge>
                  ))}
                  {audience.recipients.length > 8 ? (
                    <Badge variant="outline">+{audience.recipients.length - 8} more</Badge>
                  ) : null}
                </div>
              ) : null}
              {channel === "whatsapp" && audience.recipients.length > WHATSAPP_DAILY_LIMIT ? (
                <p className="flex items-start gap-1.5 text-amber-700 text-xs dark:text-amber-300">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  Over the messaging limit of {WHATSAPP_DAILY_LIMIT} unique customers in 24 hours: the rest are skipped.
                </p>
              ) : null}
              {err("audience") ? <p className="text-destructive text-xs">{err("audience")}</p> : null}
            </div>
          </Section>

          <Section
            title="Content"
            description={
              channel === "whatsapp"
                ? "An approved template. Its variables are filled from each contact's fields."
                : `The message${info.media ? ", with an optional attachment" : ""}.`
            }
          >
            {channel === "whatsapp" ? (
              <div className="grid gap-4">
                <Field data-invalid={err("template") ? true : undefined}>
                  <FieldLabel htmlFor="cmp-template">Approved template</FieldLabel>
                  <NativeSelect
                    id="cmp-template"
                    className="w-full"
                    value={tplKey}
                    onChange={(e) => {
                      setTplKey(e.target.value);
                      const next = templates.find((t) => templateKey(t) === e.target.value);
                      const nums = next ? variableNumbers(next.body) : [];
                      setVariables(
                        Object.fromEntries(
                          nums.map((n) => [
                            String(n),
                            n === 1
                              ? { kind: "field", field: "first_name", fallback: "there" }
                              : { kind: "text", value: next?.draft?.examples[n - 1] ?? next?.examples?.[n - 2] ?? "" },
                          ]),
                        ) as Record<string, VariableSource>,
                      );
                      setMedia(null);
                    }}
                  >
                    <option value="" disabled>
                      {approved.length ? "Select a template" : "No approved template for this inbox"}
                    </option>
                    {approved.map((t) => (
                      <option key={templateKey(t)} value={templateKey(t)}>
                        {t.name} ({t.code}) · {t.category.toLowerCase()}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    Only approved templates are listed
                    {notApproved ? `; ${notApproved} others are pending, rejected or drafts` : ""}.{" "}
                    <Link href="/dashboard/settings/templates/new" className="text-primary hover:underline">
                      New template
                    </Link>
                  </FieldDescription>
                  {err("template") ? <p className="text-destructive text-xs">{err("template")}</p> : null}
                </Field>
                {template && numbers.length ? (
                  <div className="grid gap-2" data-variable-map="">
                    <Label>Variables</Label>
                    {numbers.map((n) => {
                      const key = String(n);
                      const source = variables[key] ?? { kind: "text", value: "" };
                      const setSource = (next: VariableSource) => setVariables((v) => ({ ...v, [key]: next }));
                      return (
                        <div key={n} className="grid items-center gap-2 @xl:grid-cols-[56px_1fr_1fr]">
                          <Badge variant="outline" className="justify-center font-mono">{`{{${n}}}`}</Badge>
                          <NativeSelect
                            className="w-full"
                            aria-label={`Source of {{${n}}}`}
                            value={source.kind === "field" ? source.field : "__text"}
                            onChange={(e) =>
                              setSource(
                                e.target.value === "__text"
                                  ? { kind: "text", value: "" }
                                  : {
                                      kind: "field",
                                      field: e.target.value,
                                      fallback: source.kind === "field" ? source.fallback : "",
                                    },
                              )
                            }
                          >
                            {FIELD_OPTIONS.map((f) => (
                              <option key={f.value} value={f.value}>
                                Contact: {f.label}
                              </option>
                            ))}
                            {csv && mode === "csv"
                              ? csv.columns
                                  .filter((c) => !["name", "phone", "email"].includes(c.toLowerCase()))
                                  .map((c) => (
                                    <option key={c} value={`csv:${c.toLowerCase()}`}>
                                      CSV column: {c}
                                    </option>
                                  ))
                              : null}
                            <option value="__text">Same text for everyone</option>
                          </NativeSelect>
                          <Input
                            aria-label={source.kind === "field" ? `Fallback for {{${n}}}` : `Text for {{${n}}}`}
                            placeholder={source.kind === "field" ? "Fallback when the field is empty" : "Text"}
                            dir="auto"
                            value={source.kind === "field" ? source.fallback : source.value}
                            onChange={(e) =>
                              setSource(
                                source.kind === "field"
                                  ? { ...source, fallback: e.target.value }
                                  : { kind: "text", value: e.target.value },
                              )
                            }
                          />
                        </div>
                      );
                    })}
                    {err("variables") ? <p className="text-destructive text-xs">{err("variables")}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <Field data-invalid={err("text") ? true : undefined}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="cmp-text">Message</FieldLabel>
                  {channel === "sms" ? (
                    <span className="text-muted-foreground text-xs tabular-nums">{text.length} / 200</span>
                  ) : null}
                </div>
                <Textarea
                  id="cmp-text"
                  rows={4}
                  dir="auto"
                  value={text}
                  maxLength={channel === "sms" ? 200 : undefined}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write the message"
                />
                {err("text") ? <p className="text-destructive text-xs">{err("text")}</p> : null}
              </Field>
            )}
            {info.media && (channel !== "whatsapp" || wantMedia) ? (
              <div className="grid gap-2" data-media-field="">
                <Label>{channel === "whatsapp" ? `Header ${wantMedia}` : "Attachment (optional)"}</Label>
                <input
                  ref={mediaInput}
                  type="file"
                  hidden
                  aria-label="Media file"
                  data-media-input=""
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) setMedia({ name: f.name, size: f.size, type: f.type });
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => mediaInput.current?.click()}>
                    <FileUp /> Choose file
                  </Button>
                  {media ? (
                    <span className="text-sm" data-media-name="">
                      {media.name} · {(media.size / 1024 / 1024).toFixed(2)} MB
                      <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => setMedia(null)}>
                        <Trash2 />
                      </Button>
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {info.label} takes:{" "}
                  {info.media
                    .filter((m) => !wantMedia || m.kind === wantMedia)
                    .map((m) => `${m.label} ${m.extensions} up to ${m.maxBytes / 1024 / 1024} MB`)
                    .join(" · ")}
                  . The file stays in this browser; the campaign keeps its name and size.
                </p>
                {err("media") || (media && mediaError) ? (
                  <p className="text-destructive text-xs" data-media-error="">
                    {mediaError ?? err("media")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Section>

          <Section
            title="Timing"
            description="Send now, or schedule it in a time zone. A draft is kept until you send it."
          >
            <div role="radiogroup" aria-label="Timing" className="grid gap-2 @xl:grid-cols-2">
              {(
                [
                  { value: "now", label: "Send now", help: "Starts as soon as you confirm." },
                  { value: "later", label: "Schedule", help: "Starts at the date and time you choose." },
                ] as const
              ).map((o) => (
                // biome-ignore lint/a11y/useSemanticElements: a card that acts as one radio of an ARIA radiogroup (title + help text)
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={timing === o.value}
                  data-timing={o.value}
                  onClick={() => setTiming(o.value)}
                  className={cn(
                    "grid gap-1 rounded-lg border p-3 text-left hover:bg-muted/50",
                    timing === o.value && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  <span className="font-medium text-sm">{o.label}</span>
                  <span className="text-muted-foreground text-xs">{o.help}</span>
                </button>
              ))}
            </div>
            {timing === "later" ? (
              <div className="grid gap-3 @xl:grid-cols-2">
                <Field data-invalid={err("schedule") ? true : undefined}>
                  <FieldLabel htmlFor="cmp-when">Date and time</FieldLabel>
                  <Input id="cmp-when" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cmp-zone">Time zone</FieldLabel>
                  <NativeSelect id="cmp-zone" className="w-full" value={zone} onChange={(e) => setZone(e.target.value)}>
                    {TIME_ZONES.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {scheduledAt ? (
                  <p className="text-muted-foreground text-xs @xl:col-span-2" data-schedule-preview="">
                    Sends on {formatInZone(scheduledAt, zone)} · your time:{" "}
                    {new Date(scheduledAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
                {err("schedule") ? <p className="text-destructive text-xs @xl:col-span-2">{err("schedule")}</p> : null}
              </div>
            ) : null}
            {channel === "whatsapp" ? (
              <div className="grid gap-1">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="cmp-optin"
                    checked={optIn}
                    onCheckedChange={(v) => setOptIn(v === true)}
                    aria-invalid={err("optIn") ? true : undefined}
                  />
                  <Label htmlFor="cmp-optin" className="font-normal leading-snug">
                    These contacts opted in to receive WhatsApp messages from us.
                  </Label>
                </div>
                <SourceLink
                  href="https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in"
                  label="Meta requires opt-in"
                />
                {err("optIn") ? <p className="text-destructive text-xs">{err("optIn")}</p> : null}
              </div>
            ) : null}
          </Section>
        </div>

        <div className="grid min-w-0 gap-4">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>
                {previewRecipient ? `As ${previewRecipient.name} receives it.` : "With sample values."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {audience.recipients.length > 1 ? (
                <NativeSelect
                  size="sm"
                  className="w-full"
                  aria-label="Preview for"
                  value={String(previewIndex)}
                  onChange={(e) => setPreviewIndex(Number(e.target.value))}
                >
                  {audience.recipients.slice(0, 50).map((r, i) => (
                    <option key={r.key} value={i}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}
              {channel === "whatsapp" && !template ? (
                <p className="text-muted-foreground text-sm">Choose a template to see the message.</p>
              ) : (
                <WhatsAppBubble content={bubble} />
              )}
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">Before sending</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 text-sm" data-send-checklist="">
                {checklist.map(([key, value, done]) => (
                  <li
                    key={key}
                    data-check={key}
                    data-check-ok={value ? "false" : "true"}
                    className={cn("flex items-start gap-2", value ? "text-muted-foreground" : "")}
                  >
                    <span
                      className={cn("mt-1 size-2 shrink-0 rounded-full", value ? "bg-amber-500" : "bg-emerald-500")}
                    />
                    {value ?? done}
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-start gap-1.5 text-muted-foreground text-xs">
                <Info className="mt-px size-3.5 shrink-0" /> Drafts can be saved at any time; sending needs every line
                green.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send "{title.trim()}" now?</AlertDialogTitle>
            <AlertDialogDescription>
              {audience.recipients.length} contacts on {info.label} from {inbox}. {SIMULATED_SEND}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend} data-confirm-send="">
              <Send /> Send (simulated)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

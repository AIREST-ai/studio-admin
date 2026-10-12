"use client";
// Studio pattern (contacts/_components/contacts-list.tsx): big heading + primary action, line tabs with counts,
// card with search and filter chips, table with coloured badges and a "…" menu per row.
// Chatwoot v4.18 content (components-next/Campaigns): Live chat / SMS / WhatsApp campaigns, Enabled/Disabled and
// Scheduled/Processing/Completed statuses, "Sent by … from …", "Sent from … on …", Edit / Delete / View analytics.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  Bot,
  ChartNoAxesColumn,
  Globe,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  SlidersVertical,
  Smartphone,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";

import { PageHeading, personToneClass } from "../../contacts/_components/studio-ui";
import {
  ConfirmDeleteCampaignDialog,
  LiveChatCampaignDialog,
  SMSCampaignDialog,
  WhatsAppCampaignDialog,
} from "./campaign-forms";
import {
  type LiveChatCampaign,
  liveChatCampaigns,
  type OneOffCampaign,
  type OneOffStatus,
  smsCampaigns,
  whatsappCampaigns,
} from "./data";

export type CampaignTab = "live_chat" | "sms" | "whatsapp";

const tabs: { value: CampaignTab; label: string; href: string; icon: React.ElementType }[] = [
  { value: "live_chat", label: "Live chat", href: "/dashboard/campaigns/live-chat", icon: MessageSquareText },
  { value: "sms", label: "SMS", href: "/dashboard/campaigns/sms", icon: Smartphone },
  { value: "whatsapp", label: "WhatsApp", href: "/dashboard/campaigns/whatsapp", icon: Megaphone },
];

const copy: Record<CampaignTab, { title: string; description: string; emptyTitle: string; emptySubtitle: string }> =
  {
    live_chat: {
      title: "Live chat campaigns",
      description: "Proactive messages shown to visitors of your website.",
      emptyTitle: "No live chat campaigns are available",
      emptySubtitle: "Connect with your customers using proactive messages.  Click 'Create campaign' to get started.",
    },
    sms: {
      title: "SMS campaigns",
      description: "One-off SMS broadcasts to labelled contacts.",
      emptyTitle: "No SMS campaigns are available",
      emptySubtitle:
        "Launch an SMS campaign to reach your customers directly. Send offers or make announcements with ease. Click 'Create campaign' to get started.",
    },
    whatsapp: {
      title: "WhatsApp campaigns",
      description: "Approved WhatsApp templates sent to labelled contacts.",
      emptyTitle: "No WhatsApp campaigns are available",
      emptySubtitle:
        "Launch a WhatsApp campaign to reach your customers directly. Send offers or make announcements with ease. Click 'Create campaign' to get started.",
    },
  };

const badgeBase = "gap-1.5 border px-2 py-1 font-medium";

// Chatwoot colours: active (Enabled, Scheduled, Processing) = teal, inactive (Disabled, Completed) = grey.
const teal = "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400";
const grey = "border-border bg-muted/50 text-muted-foreground";
const statusTone: Record<string, { label: string; badge: string; dot: string }> = {
  enabled: { label: "Enabled", badge: teal, dot: "bg-teal-500" },
  disabled: { label: "Disabled", badge: grey, dot: "bg-muted-foreground" },
  scheduled: { label: "Scheduled", badge: teal, dot: "bg-teal-500" },
  processing: { label: "Processing", badge: teal, dot: "animate-pulse bg-teal-500" },
  completed: { label: "Completed", badge: grey, dot: "bg-muted-foreground" },
};

function CampaignStatusBadge({ status }: { status: keyof typeof statusTone }) {
  const tone = statusTone[status];
  return (
    <Badge variant="outline" className={cn(badgeBase, tone.badge)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </Badge>
  );
}

function AudienceBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className={cn(badgeBase, "border-border bg-muted/50 text-muted-foreground")}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </Badge>
  );
}

function ChipSelect({
  label,
  value,
  options,
  onChange,
  align = "start",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  align?: "start" | "end";
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align={align}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function SenderCell({ sender }: { sender: string | null }) {
  if (!sender) {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <span className="flex size-6 items-center justify-center rounded-full border bg-muted text-muted-foreground">
          <Bot className="size-3.5" />
        </span>
        Bot
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <Avatar size="sm" className={cn("font-medium", personToneClass(sender))}>
        <AvatarFallback>{getInitials(sender)}</AvatarFallback>
      </Avatar>
      <span className="whitespace-nowrap">{sender}</span>
    </span>
  );
}

function RowMenu({
  title,
  onEdit,
  onDelete,
  analyticsHref,
}: {
  title: string;
  onEdit?: () => void;
  onDelete: () => void;
  analyticsHref?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${title}`}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {onEdit ? (
          <DropdownMenuItem onSelect={onEdit}>
            <SlidersVertical /> Edit
          </DropdownMenuItem>
        ) : null}
        {analyticsHref ? (
          <DropdownMenuItem asChild>
            <Link href={analyticsHref}>
              <ChartNoAxesColumn /> View analytics
            </Link>
          </DropdownMenuItem>
        ) : null}
        {onEdit || analyticsHref ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TablePager({
  total,
  page,
  pageSize,
  onPage,
  noun,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  noun: string;
}) {
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const start = total ? page * pageSize + 1 : 0;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 pt-4">
      <span className="text-muted-foreground text-sm tabular-nums">
        Showing {start} - {end} of {total} {noun}
      </span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page === 0}
              className={cn(page === 0 && "pointer-events-none opacity-50")}
              onClick={(e) => {
                e.preventDefault();
                onPage(Math.max(page - 1, 0));
              }}
            />
          </PaginationItem>
          {Array.from({ length: pageCount }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: page numbers
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={i === page}
                onClick={(e) => {
                  e.preventDefault();
                  onPage(i);
                }}
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page >= pageCount - 1}
              className={cn(page >= pageCount - 1 && "pointer-events-none opacity-50")}
              onClick={(e) => {
                e.preventDefault();
                onPage(Math.min(page + 1, pageCount - 1));
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

const PAGE_SIZE = 8;

type LiveColumn = "sender" | "inbox" | "url" | "timeOnPage";
type OneOffColumn = "inbox" | "audience" | "scheduledAt" | "template";

const liveColumnLabels: Record<LiveColumn, string> = {
  sender: "Sent by",
  inbox: "Inbox",
  url: "URL",
  timeOnPage: "Time on page",
};
const oneOffColumnLabels: Record<OneOffColumn, string> = {
  inbox: "Sent from",
  audience: "Audience",
  scheduledAt: "Scheduled time",
  template: "Template",
};

export function CampaignsList({ tab, empty = false }: { tab: CampaignTab; empty?: boolean }) {
  const router = useRouter();
  const [live, setLive] = React.useState<LiveChatCampaign[]>(empty ? [] : liveChatCampaigns);
  const [sms, setSms] = React.useState<OneOffCampaign[]>(empty ? [] : smsCampaigns);
  const [whatsapp, setWhatsapp] = React.useState<OneOffCampaign[]>(empty ? [] : whatsappCampaigns);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("All");
  const [inbox, setInbox] = React.useState("All");
  const [sender, setSender] = React.useState("All");
  const [page, setPage] = React.useState(0);
  const [hiddenLive, setHiddenLive] = React.useState<LiveColumn[]>([]);
  const [hiddenOneOff, setHiddenOneOff] = React.useState<OneOffColumn[]>([]);
  const [dialog, setDialog] = React.useState<"create" | "edit" | "delete" | null>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const isLive = tab === "live_chat";
  const isWhatsApp = tab === "whatsapp";
  const oneOff = isWhatsApp ? whatsapp : sms;
  const setOneOff = isWhatsApp ? setWhatsapp : setSms;
  const counts: Record<CampaignTab, number> = { live_chat: live.length, sms: sms.length, whatsapp: whatsapp.length };
  const text = copy[tab];

  const statusOptions = isLive ? ["All", "Enabled", "Disabled"] : ["All", "Scheduled", "Processing", "Completed"];
  const inboxOptions = ["All", ...Array.from(new Set((isLive ? live : oneOff).map((c) => c.inbox)))];
  const senderOptions = ["All", ...Array.from(new Set(live.map((c) => c.sender ?? "Bot")))];

  const q = query.trim().toLowerCase();
  const liveRows = live.filter(
    (c) =>
      (!q || [c.title, c.message, c.url].some((v) => v.toLowerCase().includes(q))) &&
      (status === "All" || (status === "Enabled") === c.enabled) &&
      (inbox === "All" || c.inbox === inbox) &&
      (sender === "All" || (c.sender ?? "Bot") === sender),
  );
  const oneOffRows = oneOff.filter(
    (c) =>
      (!q || [c.title, c.message].some((v) => v.toLowerCase().includes(q))) &&
      (status === "All" || c.status === (status.toLowerCase() as OneOffStatus)) &&
      (inbox === "All" || c.inbox === inbox),
  );
  const total = isLive ? liveRows.length : oneOffRows.length;
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const slice = <T,>(rows: T[]) => rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const selectedLive = live.find((c) => c.id === selectedId);
  const selectedTitle = (isLive ? live : oneOff).find((c) => c.id === selectedId)?.title;
  const filtered = Boolean(q) || status !== "All" || inbox !== "All" || sender !== "All";
  const showLive = (key: LiveColumn) => !hiddenLive.includes(key);
  const showOneOff = (key: OneOffColumn) => !hiddenOneOff.includes(key) && (key !== "template" || isWhatsApp);

  function chip(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(0);
    };
  }

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setInbox("All");
    setSender("All");
    setPage(0);
  }

  function open(kind: "edit" | "delete", id: number) {
    setSelectedId(id);
    setDialog(kind);
  }

  const columnMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal /> Hide
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        {isLive
          ? (Object.keys(liveColumnLabels) as LiveColumn[]).map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={showLive(key)}
                onCheckedChange={(checked) =>
                  setHiddenLive((prev) => (checked ? prev.filter((k) => k !== key) : [...prev, key]))
                }
              >
                {liveColumnLabels[key]}
              </DropdownMenuCheckboxItem>
            ))
          : (Object.keys(oneOffColumnLabels) as OneOffColumn[])
              .filter((key) => key !== "template" || isWhatsApp)
              .map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={showOneOff(key)}
                  onCheckedChange={(checked) =>
                    setHiddenOneOff((prev) => (checked ? prev.filter((k) => k !== key) : [...prev, key]))
                  }
                >
                  {oneOffColumnLabels[key]}
                </DropdownMenuCheckboxItem>
              ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const emptyState = (
    <Empty className="border-t py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">{isLive ? <MessageSquareText /> : <Megaphone />}</EmptyMedia>
        <EmptyTitle>{filtered ? "No campaigns match these filters" : text.emptyTitle}</EmptyTitle>
        <EmptyDescription>{filtered ? "Try another search or clear the filters." : text.emptySubtitle}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button size="sm" onClick={() => setDialog("create")}>
            <Plus /> Create campaign
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title="Campaigns"
          subtitle="Proactive website messages and one-off SMS and WhatsApp broadcasts to your contacts."
        />
        <Button size="sm" onClick={() => setDialog("create")}>
          <Plus /> Create campaign
        </Button>
      </div>

      <Tabs
        className="gap-4"
        value={tab}
        onValueChange={(value) => router.push(tabs.find((t) => t.value === value)?.href ?? "/dashboard/campaigns")}
      >
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon />
              {t.label}
              <Badge variant="secondary" className="ms-1 tabular-nums">
                {counts[t.value]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">{text.title}</CardTitle>
          <CardDescription className="max-w-sm leading-snug">{text.description}</CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                placeholder="Search campaigns..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </InputGroup>
            {columnMenu}
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <ChipSelect label="Status" value={status} options={statusOptions} onChange={chip(setStatus)} />
              <ChipSelect label="Inbox" value={inbox} options={inboxOptions} onChange={chip(setInbox)} />
              {isLive ? (
                <ChipSelect label="Sent by" value={sender} options={senderOptions} onChange={chip(setSender)} />
              ) : null}
            </div>
            <span className="text-muted-foreground text-sm tabular-nums">
              {total} {total === 1 ? "campaign" : "campaigns"}
            </span>
          </div>

          {total === 0 ? (
            emptyState
          ) : isLive ? (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader className="[&_tr]:border-t">
                <TableRow>
                  <TableHead className="py-4 font-normal">Campaign</TableHead>
                  <TableHead className="py-4 font-normal">Status</TableHead>
                  {showLive("sender") ? <TableHead className="py-4 font-normal">Sent by</TableHead> : null}
                  {showLive("inbox") ? <TableHead className="py-4 font-normal">Inbox</TableHead> : null}
                  {showLive("url") ? <TableHead className="py-4 font-normal">URL</TableHead> : null}
                  {showLive("timeOnPage") ? <TableHead className="py-4 font-normal">Time on page</TableHead> : null}
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice(liveRows).map((c) => (
                  <TableRow key={c.id} className="border-border/60 hover:bg-white/2.5">
                    <TableCell className="max-w-96 py-4 align-middle">
                      <button type="button" className="grid gap-0.5 text-left" onClick={() => open("edit", c.id)}>
                        <span className="truncate font-medium text-foreground text-sm">{c.title}</span>
                        <span className="line-clamp-1 whitespace-normal text-muted-foreground text-sm" dir="auto">
                          {c.message}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="py-4 align-middle">
                      <CampaignStatusBadge status={c.enabled ? "enabled" : "disabled"} />
                    </TableCell>
                    {showLive("sender") ? (
                      <TableCell className="py-4 align-middle">
                        <SenderCell sender={c.sender} />
                      </TableCell>
                    ) : null}
                    {showLive("inbox") ? (
                      <TableCell className="py-4 align-middle">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
                          <Globe className="size-3.5 text-muted-foreground" />
                          {c.inbox}
                        </span>
                      </TableCell>
                    ) : null}
                    {showLive("url") ? (
                      <TableCell className="max-w-56 py-4 align-middle">
                        <span className="block truncate text-muted-foreground text-sm">{c.url}</span>
                      </TableCell>
                    ) : null}
                    {showLive("timeOnPage") ? (
                      <TableCell className="py-4 align-middle">
                        <span className="text-sm tabular-nums">{c.timeOnPage}s</span>
                        {c.businessHoursOnly ? (
                          <span className="block text-muted-foreground text-xs">Business hours only</span>
                        ) : null}
                      </TableCell>
                    ) : null}
                    <TableCell className="py-4 align-middle">
                      <div className="flex justify-end">
                        <RowMenu
                          title={c.title}
                          onEdit={() => open("edit", c.id)}
                          onDelete={() => open("delete", c.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader className="[&_tr]:border-t">
                <TableRow>
                  <TableHead className="py-4 font-normal">Campaign</TableHead>
                  <TableHead className="py-4 font-normal">Status</TableHead>
                  {showOneOff("inbox") ? <TableHead className="py-4 font-normal">Sent from</TableHead> : null}
                  {showOneOff("template") ? <TableHead className="py-4 font-normal">Template</TableHead> : null}
                  {showOneOff("audience") ? <TableHead className="py-4 font-normal">Audience</TableHead> : null}
                  {showOneOff("scheduledAt") ? (
                    <TableHead className="py-4 font-normal">Scheduled time</TableHead>
                  ) : null}
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice(oneOffRows).map((c) => {
                  const analyticsHref =
                    isWhatsApp && c.status !== "scheduled" ? `/dashboard/campaigns/whatsapp/${c.id}/analytics` : undefined;
                  return (
                    <TableRow key={c.id} className="border-border/60 hover:bg-white/2.5">
                      <TableCell className="max-w-96 py-4 align-middle">
                        <div className="grid gap-0.5">
                          {analyticsHref ? (
                            <Link href={analyticsHref} className="truncate font-medium text-foreground text-sm">
                              {c.title}
                            </Link>
                          ) : (
                            <span className="truncate font-medium text-foreground text-sm">{c.title}</span>
                          )}
                          <span className="line-clamp-1 whitespace-normal text-muted-foreground text-sm" dir="auto">
                            {c.message}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <CampaignStatusBadge status={c.status} />
                      </TableCell>
                      {showOneOff("inbox") ? (
                        <TableCell className="py-4 align-middle">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
                            {isWhatsApp ? (
                              <MessageSquareText className="size-3.5 text-muted-foreground" />
                            ) : (
                              <Smartphone className="size-3.5 text-muted-foreground" />
                            )}
                            {c.inbox}
                          </span>
                        </TableCell>
                      ) : null}
                      {showOneOff("template") ? (
                        <TableCell className="py-4 align-middle">
                          <span className="whitespace-nowrap font-mono text-muted-foreground text-xs">
                            {c.template ?? "---"}
                          </span>
                        </TableCell>
                      ) : null}
                      {showOneOff("audience") ? (
                        <TableCell className="py-4 align-middle">
                          <div className="flex flex-wrap gap-1.5">
                            {c.audience.map((label) => (
                              <AudienceBadge key={label} label={label} />
                            ))}
                          </div>
                        </TableCell>
                      ) : null}
                      {showOneOff("scheduledAt") ? (
                        <TableCell className="py-4 align-middle">
                          <span className="whitespace-nowrap text-sm tabular-nums">{c.scheduledAt}</span>
                        </TableCell>
                      ) : null}
                      <TableCell className="py-4 align-middle">
                        <div className="flex justify-end">
                          <RowMenu
                            title={c.title}
                            analyticsHref={analyticsHref}
                            onDelete={() => open("delete", c.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {total > 0 ? (
            <TablePager total={total} page={current} pageSize={PAGE_SIZE} onPage={setPage} noun="campaigns" />
          ) : null}
        </CardContent>
      </Card>

      {isLive ? (
        <LiveChatCampaignDialog
          open={dialog === "create" || dialog === "edit"}
          campaign={dialog === "edit" ? selectedLive : undefined}
          onOpenChange={(o) => setDialog(o ? dialog : null)}
          onSave={(saved) =>
            setLive((prev) =>
              prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev],
            )
          }
        />
      ) : isWhatsApp ? (
        <WhatsAppCampaignDialog
          open={dialog === "create"}
          onOpenChange={(o) => setDialog(o ? "create" : null)}
          onSave={(saved) => setWhatsapp((prev) => [saved, ...prev])}
        />
      ) : (
        <SMSCampaignDialog
          open={dialog === "create"}
          onOpenChange={(o) => setDialog(o ? "create" : null)}
          onSave={(saved) => setSms((prev) => [saved, ...prev])}
        />
      )}
      <ConfirmDeleteCampaignDialog
        open={dialog === "delete"}
        title={selectedTitle}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        onConfirm={() => {
          if (isLive) setLive((prev) => prev.filter((c) => c.id !== selectedId));
          else setOneOff((prev) => prev.filter((c) => c.id !== selectedId));
        }}
      />
    </div>
  );
}

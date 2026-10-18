"use client";
// Studio pattern (contacts/_components/contacts-list.tsx): big heading + primary action,
// card with search and filter chips, table with coloured badges and a "…" menu per row.
// Chatwoot v4.18 content (components-next/Campaigns): Live chat / SMS / WhatsApp campaigns, Enabled/Disabled and
// Scheduled/Processing/Completed statuses, "Sent by … from …", "Sent from … on …", Edit / Delete / View analytics.
// M129-C (Fahad 129.3): every channel has a page with its official conditions (Instagram, Messenger, TikTok and Email
// added; TikTok and Email say why they have no campaigns, with the source). One-off campaigns are made in the composer
// (/dashboard/campaigns/new), go Draft → Scheduled → Running → Completed / Failed, can be sent now, retried and opened
// in their report, and are saved in the preview (store.ts). Sending is simulated and says so.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  Ban,
  Bot,
  ChartNoAxesColumn,
  Globe,
  Info,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Send,
  SlidersHorizontal,
  SlidersVertical,
  Smartphone,
  Trash2,
} from "lucide-react";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
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
import { SimBadge } from "@/lib/cw/preview-sim-ui";
import { getInitials } from "@/lib/utils";

import { PageHeading, personToneClass } from "../../contacts/_components/studio-ui";
import { ChannelRules } from "./campaign-composer";
import { ConfirmDeleteCampaignDialog, LiveChatCampaignDialog } from "./campaign-forms";
import { retryFailed, SIMULATED_SEND, sendNow, useCampaignClock } from "./campaign-runtime";
import { type BroadcastChannel, CHANNELS } from "./channels";
import type { LiveChatCampaign, OneOffCampaign, OneOffStatus } from "./data";
import { CampaignStatusBadge } from "./status-badge";
import { useCampaignList } from "./store";

export type CampaignTab = "live_chat" | "sms" | "whatsapp" | "instagram" | "messenger" | "tiktok" | "email";

const copy: Record<CampaignTab, { title: string; description: string; emptyTitle: string; emptySubtitle: string }> = {
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
  instagram: {
    title: "Instagram campaigns",
    description: "Messages to customers who wrote to your Instagram account in the last 24 hours.",
    emptyTitle: "No Instagram campaigns yet",
    emptySubtitle:
      "Instagram campaigns reach only customers whose 24-hour window is open. Click 'Create campaign' to get started.",
  },
  messenger: {
    title: "Messenger campaigns",
    description: "Messages to customers who wrote to your Facebook Page in the last 24 hours.",
    emptyTitle: "No Messenger campaigns yet",
    emptySubtitle:
      "Messenger campaigns reach only customers whose 24-hour window is open. Click 'Create campaign' to get started.",
  },
  tiktok: {
    title: "TikTok campaigns",
    description: "TikTok does not allow campaigns: a business cannot start a conversation.",
    emptyTitle: "TikTok has no campaigns",
    emptySubtitle: "TikTok's Business Messaging API forbids messaging anyone who has not messaged the business first.",
  },
  email: {
    title: "Email campaigns",
    description: "Campaigns do not send from email inboxes.",
    emptyTitle: "Email has no campaigns here",
    emptySubtitle: "The engine accepts campaigns for Website, SMS and WhatsApp inboxes only.",
  },
};

const ONE_OFF_TABS = ["sms", "whatsapp", "instagram", "messenger"] as const;
type OneOffTab = (typeof ONE_OFF_TABS)[number];
const isOneOffTab = (tab: CampaignTab): tab is OneOffTab => (ONE_OFF_TABS as readonly string[]).includes(tab);

const badgeBase = "gap-1.5 border px-2 py-1 font-medium";

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
      <SelectTrigger size="sm" aria-label={label}>
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
  onSendNow,
  onRetry,
}: {
  title: string;
  onEdit?: () => void;
  onDelete: () => void;
  analyticsHref?: string;
  onSendNow?: () => void;
  onRetry?: { count: number; run: () => void };
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
        {onSendNow ? (
          <DropdownMenuItem onSelect={onSendNow}>
            <Send /> Send now
          </DropdownMenuItem>
        ) : null}
        {analyticsHref ? (
          <DropdownMenuItem asChild>
            <Link href={analyticsHref}>
              <ChartNoAxesColumn /> View {analyticsHref.includes("/report/") ? "report" : "analytics"}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {onRetry ? (
          <DropdownMenuItem onSelect={onRetry.run}>
            <RotateCcw /> Retry failed ({onRetry.count})
          </DropdownMenuItem>
        ) : null}
        {onEdit || analyticsHref || onSendNow || onRetry ? <DropdownMenuSeparator /> : null}
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
  // Shared store so created/edited/deleted campaigns survive switching tabs; `?empty` previews a blank list.
  const [storedLive, setStoredLive] = useCampaignList("live");
  const [storedSms, setStoredSms] = useCampaignList("sms");
  const [storedWhatsapp, setStoredWhatsapp] = useCampaignList("whatsapp");
  const [storedInstagram, setStoredInstagram] = useCampaignList("instagram");
  const [storedMessenger, setStoredMessenger] = useCampaignList("messenger");
  useCampaignClock();
  const [emptyLive, setEmptyLive] = React.useState<LiveChatCampaign[]>([]);
  const [emptyOneOff, setEmptyOneOff] = React.useState<OneOffCampaign[]>([]);
  const [live, setLive] = empty ? [emptyLive, setEmptyLive] : [storedLive, setStoredLive];
  const stored: Record<OneOffTab, [OneOffCampaign[], (next: (prev: OneOffCampaign[]) => OneOffCampaign[]) => void]> = {
    sms: [storedSms, setStoredSms],
    whatsapp: [storedWhatsapp, setStoredWhatsapp],
    instagram: [storedInstagram, setStoredInstagram],
    messenger: [storedMessenger, setStoredMessenger],
  };
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
  const oneOffTab: OneOffTab | null = isOneOffTab(tab) ? tab : null;
  const unavailable = tab === "tiktok" || tab === "email";
  const [oneOff, setOneOff] = empty || !oneOffTab ? [emptyOneOff, setEmptyOneOff] : stored[oneOffTab];
  const count = isLive ? live.length : oneOff.length;
  const text = copy[tab];

  const statusOptions = isLive
    ? ["All", "Enabled", "Disabled"]
    : ["All", "Draft", "Scheduled", "Running", "Completed", "Failed"];
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
        <EmptyDescription>
          {filtered ? "Try another search or clear the filters." : text.emptySubtitle}
        </EmptyDescription>
      </EmptyHeader>
      {/* T-148: Chatwoot's campaign empty states (LiveChat/SMS/WhatsAppCampaignEmptyState.vue) fill no actions slot, so
          the header's Create campaign is the only one; Clear filters stays when the list is filtered. */}
      {filtered ? (
        <EmptyContent>
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* T-148: one header row, the page's own title (CAMPAIGN.<TYPE>.HEADER_TITLE), no tabs, count by the title. T-199 A1:
          button on the block's bottom, as Chatwoot header-actions (ArticlesPage.vue:364-374, BaseSettingsHeader.vue:93,128). */}
      <div className="flex flex-wrap items-end justify-between gap-3 md:flex-nowrap">
        <div className="min-w-0">
          <PageHeading
            title={
              <>
                {text.title}
                <Badge variant="secondary" className="ms-2 align-middle tabular-nums">
                  {count}
                </Badge>
              </>
            }
            subtitle={text.description}
          />
        </div>
        {isLive ? (
          <Button size="sm" className="shrink-0" onClick={() => setDialog("create")}>
            <Plus /> Create campaign
          </Button>
        ) : unavailable ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Button size="sm" disabled aria-describedby="campaign-unavailable">
              <Ban /> Create campaign
            </Button>
            <span id="campaign-unavailable" className="text-muted-foreground text-xs">
              Not available on {CHANNELS[tab].label}: see why below.
            </span>
          </div>
        ) : (
          <Button size="sm" className="shrink-0" asChild>
            <Link href={`/dashboard/campaigns/new?channel=${tab}`}>
              <Plus /> Create campaign
            </Link>
          </Button>
        )}
      </div>

      {/* M129-C round 2: Live chat shows its conditions and sources too, like every channel. */}
      {CHANNELS[tab] ? (
        <details
          className="group rounded-xl border bg-card px-4 py-3 text-sm"
          open={unavailable || undefined}
          data-channel-conditions={tab}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
            <span className="flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" />
              {CHANNELS[tab].label} campaign conditions
              <span className="font-normal text-muted-foreground">{CHANNELS[tab].summary}</span>
            </span>
            <span className="text-muted-foreground text-xs group-open:hidden">Show</span>
            <span className="hidden text-muted-foreground text-xs group-open:inline">Hide</span>
          </summary>
          <div className="mt-3 border-t pt-3">
            <ChannelRules channel={tab} />
          </div>
        </details>
      ) : null}
      {oneOffTab ? (
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          <SimBadge />
          {SIMULATED_SEND}
        </div>
      ) : null}

      {unavailable ? (
        <Card>
          <CardContent>
            <Empty className="py-12" data-campaigns-unavailable={tab}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Ban />
                </EmptyMedia>
                <EmptyTitle>{text.emptyTitle}</EmptyTitle>
                <EmptyDescription>{text.emptySubtitle}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/campaigns/whatsapp">WhatsApp campaigns</Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
            <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
              <ExpandingSearch
                name="campaigns"
                label="Search campaigns"
                placeholder="Search campaigns..."
                className="w-full md:w-64"
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(0);
                }}
              />
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
              {/* T-282 round 2 (Fahad 123): the view (Hide columns) comes after the filters, as the shadcn/ui tasks
                toolbar (filters, then View) and Twenty's view bar (filter, sort, options); it sat before them, in the
                header row. */}
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm tabular-nums">
                  {total} {total === 1 ? "campaign" : "campaigns"}
                </span>
                {columnMenu}
              </div>
            </div>

            {total === 0 ? (
              emptyState
            ) : isLive ? (
              <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
                <TableHeader className="[&_tr]:border-t">
                  <TableRow>
                    <TableHead className="min-w-56 py-4 font-normal">Campaign</TableHead>
                    <TableHead className="py-4 font-normal">Status</TableHead>
                    {showLive("sender") ? <TableHead className="py-4 font-normal">Sent by</TableHead> : null}
                    {showLive("inbox") ? <TableHead className="py-4 font-normal">Inbox</TableHead> : null}
                    {showLive("url") ? <TableHead className="py-4 font-normal">URL</TableHead> : null}
                    {showLive("timeOnPage") ? <TableHead className="py-4 font-normal">Time on page</TableHead> : null}
                    <TableHead className="sticky right-0 bg-card py-4 font-normal shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
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
                      <TableCell className="sticky right-0 bg-card py-4 align-middle shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
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
                    <TableHead className="min-w-56 py-4 font-normal">Campaign</TableHead>
                    <TableHead className="py-4 font-normal">Status</TableHead>
                    {showOneOff("inbox") ? <TableHead className="py-4 font-normal">Sent from</TableHead> : null}
                    {showOneOff("template") ? <TableHead className="py-4 font-normal">Template</TableHead> : null}
                    {showOneOff("audience") ? <TableHead className="py-4 font-normal">Audience</TableHead> : null}
                    {showOneOff("scheduledAt") ? (
                      <TableHead className="py-4 font-normal">Scheduled time</TableHead>
                    ) : null}
                    <TableHead className="sticky right-0 bg-card py-4 font-normal shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                      <div className="text-right">Actions</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slice(oneOffRows).map((c) => {
                    // Composer campaigns open their report; the Chatwoot sample WhatsApp campaigns keep their analytics page.
                    const analyticsHref = c.channel
                      ? `/dashboard/campaigns/report/${c.id}`
                      : isWhatsApp && c.status !== "scheduled"
                        ? `/dashboard/campaigns/whatsapp/${c.id}/analytics`
                        : undefined;
                    const editable = !!c.channel && (c.status === "draft" || c.status === "scheduled");
                    const failedCount = c.run?.results.filter((r) => r.status === "failed").length ?? 0;
                    const channelKey = (c.channel ?? oneOffTab) as BroadcastChannel;
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
                              {tab !== "sms" ? (
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
                        <TableCell className="sticky right-0 bg-card py-4 align-middle shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                          <div className="flex justify-end">
                            <RowMenu
                              title={c.title}
                              analyticsHref={analyticsHref}
                              onEdit={editable ? () => router.push(`/dashboard/campaigns/new?id=${c.id}`) : undefined}
                              onSendNow={editable ? () => sendNow(channelKey, c.id) : undefined}
                              onRetry={
                                c.channel && (c.status === "completed" || c.status === "failed") && failedCount
                                  ? { count: failedCount, run: () => retryFailed(channelKey, c.id) }
                                  : undefined
                              }
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
      )}

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
      ) : null}
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

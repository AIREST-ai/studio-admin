"use client";
// V-4 (Fahad 160.9): Studio Calls History Table (/dashboard/calls).
// - In linked mode, fetches permanent live call records from /api/calls/history (SQLite WAL on 127.0.0.1:3483).
// - Displays contact_name + peer_number_or_id, channel (WhatsApp / Messenger with icon), direction (incoming / outgoing),
//   status (مكتملة, فائتة, مرفوضة, فاشلة with error badge like 131044), ring_duration_sec & talk_duration_sec,
//   ended_by + agent_name, timestamp, and direct link to the conversation (/dashboard/chat?conversationId=...).
// - Enforces Fahad's 5 visual rules: luxury dark mode, filter bar starting with «الكل» (All -> Missed -> Incoming ->
//   Outgoing -> Failed), ExpandingSearch lens, Western tabular-nums (0-9), and zero 501 unavailability banner.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  ListFilter,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Play,
  Plus,
  RefreshCw,
  Smartphone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { conversations } from "@/app/(main)/chat/_components/data";
import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { linkedSession, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
import { SIMULATED, type SimCall, usePreviewSim } from "@/lib/cw/preview-sim";
import { SIGNED_IN_VIEWER } from "@/lib/cw/view-as";
import { getInitials } from "@/lib/utils";

import { PageHeading, personToneClass } from "../../contacts/_components/studio-ui";
import { agents, type Call, type CallKind, calls, voiceInboxes } from "./data";

const PAGE_SIZE = 10;

export type CallFilterKey = "all" | "missed" | "incoming" | "outgoing" | "failed" | "rejected";

const FILTER_TABS: {
  key: CallFilterKey;
  labelAr: string;
  labelEn: string;
  icon: React.ElementType;
}[] = [
  { key: "all", labelAr: "الكل", labelEn: "All", icon: Phone },
  { key: "missed", labelAr: "فائتة", labelEn: "Missed", icon: PhoneMissed },
  { key: "incoming", labelAr: "واردة", labelEn: "Incoming", icon: PhoneIncoming },
  { key: "outgoing", labelAr: "صادرة", labelEn: "Outgoing", icon: PhoneOutgoing },
  { key: "failed", labelAr: "فاشلة", labelEn: "Failed", icon: PhoneOff },
];

export interface LiveCallRecord {
  call_id: string;
  channel: "whatsapp" | "messenger" | string;
  direction: "incoming" | "outgoing" | string;
  status: "ended" | "missed" | "rejected" | "failed" | "accepted" | "ringing" | string;
  peer_number_or_id: string;
  contact_name: string;
  account_id: number;
  conversation_id: number | null;
  inbox_id: number | null;
  agent_id: number | null;
  agent_name: string;
  started_at: number;
  answered_at: number | null;
  ended_at: number | null;
  ring_duration_sec: number;
  talk_duration_sec: number;
  ended_by: "agent" | "customer" | "system" | "meta_error" | string;
  error_code: string;
  error_message: string;
}

interface UnifiedCallRow {
  id: string;
  contactName: string;
  peerNumberOrId: string;
  channel: "whatsapp" | "messenger" | "phone";
  channelLabel: string;
  direction: "incoming" | "outgoing";
  directionLabel: string;
  status: "ended" | "missed" | "rejected" | "failed" | "ongoing";
  statusLabel: string;
  ringDurationSec: number;
  talkDurationSec: number;
  endedBy: string;
  endedByLabel: string;
  agentName: string | null;
  inboxName: string;
  conversationId: number | null;
  createdAt: string;
  createdAtFull: string;
  timestampMs: number;
  errorCode: string;
  errorMessage: string;
  recordingSeconds: number | null;
  simulated?: boolean;
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.5, 2];

function RecordingPlayer({ seconds, name }: { seconds: number; name: string }) {
  const [playing, setPlaying] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);

  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPosition((p) => {
        const next = p + 0.25 * speed;
        if (next >= seconds) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, speed, seconds]);

  return (
    <div className="flex h-8 w-fit items-center gap-1.5 rounded-full bg-muted px-1.5">
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full bg-background"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => setPlaying((p) => !p)}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <input
        type="range"
        min={0}
        max={seconds}
        step={1}
        value={position}
        aria-label="Seek"
        className="h-1 w-20 cursor-pointer accent-primary"
        onChange={(e) => setPosition(Number(e.target.value))}
      />
      <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
        {formatDuration(position)} / {formatDuration(seconds)}
      </span>
      <button
        type="button"
        className="rounded-md px-1 font-medium text-muted-foreground text-xs tabular-nums hover:text-foreground"
        aria-label="Playback speed"
        onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
      >
        {speed}x
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label="Download recording"
        onClick={() => toast.success(`Recording of the call with ${name} downloaded`)}
      >
        <Download />
      </Button>
    </div>
  );
}

function ChannelBadge({ channel, label }: { channel: UnifiedCallRow["channel"]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-xs">
      {channel === "whatsapp" ? (
        <MessageSquareText className="size-3.5 shrink-0 text-emerald-400" />
      ) : channel === "messenger" ? (
        <MessageCircle className="size-3.5 shrink-0 text-sky-400" />
      ) : (
        <Phone className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span>{label}</span>
    </span>
  );
}

function DirectionBadge({ direction, label }: { direction: UnifiedCallRow["direction"]; label: string }) {
  const isIncoming = direction === "incoming";
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
      {isIncoming ? (
        <PhoneIncoming className="size-3 shrink-0 text-teal-400" />
      ) : (
        <PhoneOutgoing className="size-3 shrink-0 text-sky-400" />
      )}
      <span>{label}</span>
    </span>
  );
}

function StatusBadge({
  status,
  label,
  errorCode,
  errorMessage,
}: {
  status: UnifiedCallRow["status"];
  label: string;
  errorCode?: string;
  errorMessage?: string;
}) {
  const styles: Record<UnifiedCallRow["status"], { badge: string; icon: React.ElementType }> = {
    ended: {
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      icon: PhoneCall,
    },
    ongoing: {
      badge: "border-teal-500/30 bg-teal-500/10 text-teal-400",
      icon: PhoneCall,
    },
    missed: {
      badge: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: PhoneMissed,
    },
    rejected: {
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      icon: PhoneOff,
    },
    failed: {
      badge: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: PhoneOff,
    },
  };
  const cfg = styles[status];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className={cn("gap-1.5 border px-2 py-0.5 font-medium text-xs", cfg.badge)}>
        <Icon className="size-3" />
        <span>{label}</span>
      </Badge>
      {errorCode ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              data-testid={`call-error-badge-${errorCode}`}
              className="border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] text-amber-300 tabular-nums"
            >
              <AlertTriangle className="me-1 size-3 text-amber-400" />
              {errorCode}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{errorMessage || `رمز خطأ ميتا: ${errorCode}`}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function PersonAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "default" }) {
  const unknown = name.startsWith("+") || name === "Deleted contact";
  return (
    <Avatar size={size} className={cn("font-medium", personToneClass(name))}>
      <AvatarFallback>{unknown ? <UserRound className="size-3.5" /> : getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

function CallsSetupState() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Calls" subtitle="Every voice call your team made or received, with recordings." />
      <Card>
        <CardContent>
          <Empty className="py-20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PhoneCall />
              </EmptyMedia>
              <EmptyTitle>Make and receive calls in one place</EmptyTitle>
              <EmptyDescription>
                Set up a voice channel to start handling calls with your team. Every call, along with its recording,
                will appear here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" asChild>
                <Link href="/dashboard/settings/inboxes/new">
                  <Plus /> Set up voice channel
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
}

const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function shortTimeFromDate(at: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (at.toDateString() === today.toDateString()) {
    return at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  if (at.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mapEndedByLabel(endedBy: string, errorCode?: string): string {
  switch (endedBy) {
    case "agent":
      return "الموظف";
    case "customer":
      return "العميل";
    case "system":
      return "النظام (انتهاء المهلة)";
    case "meta_error":
      return errorCode === "131044" ? "رفض ميتا (قيد الدفع 131044)" : "رفض ميتا";
    default:
      return endedBy || "---";
  }
}

function mapLiveRecord(rec: LiveCallRecord): UnifiedCallRow {
  const startedMs = (rec.started_at > 1e11 ? rec.started_at : rec.started_at * 1000) || Date.now();
  const dateObj = new Date(startedMs);

  const channel: UnifiedCallRow["channel"] =
    rec.channel === "messenger" ? "messenger" : rec.channel === "whatsapp" ? "whatsapp" : "phone";
  const channelLabel = channel === "whatsapp" ? "واتساب" : channel === "messenger" ? "ماسنجر" : "هاتف";

  const direction: UnifiedCallRow["direction"] = rec.direction === "outgoing" ? "outgoing" : "incoming";
  const directionLabel = direction === "incoming" ? "واردة" : "صادرة";

  let status: UnifiedCallRow["status"] = "ended";
  let statusLabel = "مكتملة";
  if (rec.status === "missed") {
    status = "missed";
    statusLabel = "فائتة";
  } else if (rec.status === "rejected") {
    status = "rejected";
    statusLabel = "مرفوضة";
  } else if (rec.status === "failed") {
    status = "failed";
    statusLabel = "فاشلة";
  } else if (rec.status === "ringing" || rec.status === "accepted") {
    status = "ongoing";
    statusLabel = rec.status === "ringing" ? "ترن الآن" : "جارية";
  }

  return {
    id: rec.call_id,
    contactName: rec.contact_name || rec.peer_number_or_id || "عميل",
    peerNumberOrId: rec.peer_number_or_id || "",
    channel,
    channelLabel,
    direction,
    directionLabel,
    status,
    statusLabel,
    ringDurationSec: Math.max(0, Number(rec.ring_duration_sec ?? 0)),
    talkDurationSec: Math.max(0, Number(rec.talk_duration_sec ?? 0)),
    endedBy: rec.ended_by || "",
    endedByLabel: mapEndedByLabel(rec.ended_by, rec.error_code),
    agentName: rec.agent_name ? rec.agent_name : null,
    inboxName:
      rec.inbox_id === 3
        ? "Studio Test (API)"
        : channel === "whatsapp"
          ? "1. واتساب"
          : channel === "messenger"
            ? "ماسنجر"
            : "Phone",
    conversationId: rec.conversation_id ?? null,
    createdAt: shortTimeFromDate(dateObj),
    createdAtFull: FULL_DATE.format(dateObj),
    timestampMs: startedMs,
    errorCode: rec.error_code || "",
    errorMessage: rec.error_message || "",
    recordingSeconds: null,
  };
}

function mapPreviewCall(call: Call & { simulated?: boolean }): UnifiedCallRow {
  const isWhatsApp = call.inbox.toLowerCase().includes("whatsapp");
  const channel: UnifiedCallRow["channel"] = isWhatsApp ? "whatsapp" : "phone";
  const channelLabel = isWhatsApp ? "واتساب" : "هاتف";

  const direction: UnifiedCallRow["direction"] =
    call.kind === "outgoing" || call.kind === "no_reply" ? "outgoing" : "incoming";
  const directionLabel = direction === "incoming" ? "واردة" : "صادرة";

  let status: UnifiedCallRow["status"] = "ended";
  let statusLabel = "مكتملة";
  if (call.kind === "missed") {
    status = "missed";
    statusLabel = "فائتة";
  } else if (call.kind === "no_reply") {
    status = "rejected";
    statusLabel = "مرفوضة";
  } else if (call.kind === "failed") {
    status = "failed";
    statusLabel = "فاشلة";
  } else if (call.kind === "ongoing") {
    status = "ongoing";
    statusLabel = call.ringing ? "ترن الآن" : "جارية";
  }

  return {
    id: `preview-${call.id}`,
    contactName: call.contact.replace(/^\+/, ""),
    peerNumberOrId: "",
    channel,
    channelLabel,
    direction,
    directionLabel,
    status,
    statusLabel,
    ringDurationSec: status === "missed" || status === "rejected" ? 15 : 4,
    talkDurationSec: call.recordingSeconds ?? (status === "ended" ? 60 : 0),
    endedBy: call.agent ? "agent" : status === "missed" ? "system" : "customer",
    endedByLabel: call.agent ? "الموظف" : status === "missed" ? "النظام (انتهاء المهلة)" : "العميل",
    agentName: call.agent,
    inboxName: call.inbox,
    conversationId: call.conversationId,
    createdAt: call.createdAt,
    createdAtFull: call.createdAtFull,
    timestampMs: Date.parse(call.createdAtFull) || 0,
    errorCode: "",
    errorMessage: "",
    recordingSeconds: call.recordingSeconds,
    simulated: call.simulated,
  };
}

function listedOfSim(call: SimCall, index: number): Call & { simulated: boolean } {
  const at = new Date(call.at);
  return {
    id: 100_000 + index,
    contact: conversations.find((c) => c.id === call.convId)?.contact.name ?? "Deleted contact",
    kind: call.outcome === "ended" ? ("outgoing" as CallKind) : ("no_reply" as CallKind),
    agent: call.outcome === "ended" ? (call.byName ?? SIGNED_IN_VIEWER.name) : null,
    inbox:
      voiceInboxes.find((inbox) =>
        call.channel === "phone" ? inbox.provider === "twilio" : inbox.provider === "whatsapp",
      )?.name ?? (call.channel === "phone" ? "Phone" : "WhatsApp Business"),
    conversationId: call.convId,
    createdAt: shortTimeFromDate(at),
    createdAtFull: FULL_DATE.format(at),
    recordingSeconds: call.seconds > 0 ? call.seconds : null,
    simulated: true,
  };
}

function matchesCallFilter(row: UnifiedCallRow, filter: CallFilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "missed":
      return row.status === "missed";
    case "incoming":
      return row.direction === "incoming";
    case "outgoing":
      return row.direction === "outgoing";
    case "failed":
      return row.status === "failed";
    case "rejected":
      return row.status === "rejected";
    default:
      return true;
  }
}

export function CallsTable({ setup = false }: { setup?: boolean }) {
  const [activeFilter, setActiveFilter] = React.useState<CallFilterKey>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [assignee, setAssignee] = React.useState<number | null>(null);
  const [channelFilter, setChannelFilter] = React.useState<"all" | "whatsapp" | "messenger" | "phone">("all");
  const [agentQuery, setAgentQuery] = React.useState("");
  const [page, setPage] = React.useState(0);

  const [liveRecords, setLiveRecords] = React.useState<LiveCallRecord[]>([]);
  const [loadingLive, setLoadingLive] = React.useState<boolean>(false);
  const [liveError, setLiveError] = React.useState<string | null>(null);

  const simCalls = usePreviewSim((s) => s.calls);
  const linkedActive = useLinkedAdapterStatus((s) => s.active);
  const isLinked = linkedActive || linkedSession();

  const fetchLiveHistory = React.useCallback(async (signal?: AbortSignal) => {
    setLoadingLive(true);
    setLiveError(null);
    try {
      const res = await fetch("/api/calls/history?limit=200", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        calls?: LiveCallRecord[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setLiveRecords(Array.isArray(data.calls) ? data.calls : []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setLiveError(err instanceof Error ? err.message : "تعذر جلب سجل المكالمات");
    } finally {
      setLoadingLive(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isLinked) return;
    const controller = new AbortController();
    void fetchLiveHistory(controller.signal);
    return () => controller.abort();
  }, [isLinked, fetchLiveHistory]);

  const allUnifiedRows: UnifiedCallRow[] = React.useMemo(() => {
    if (isLinked) {
      return liveRecords.map(mapLiveRecord);
    }
    return [...calls, ...simCalls.map(listedOfSim)].map(mapPreviewCall).sort((a, b) => b.timestampMs - a.timestampMs);
  }, [isLinked, liveRecords, simCalls]);

  const filterCounts = React.useMemo(() => {
    return {
      all: allUnifiedRows.length,
      missed: allUnifiedRows.filter((r) => r.status === "missed").length,
      incoming: allUnifiedRows.filter((r) => r.direction === "incoming").length,
      outgoing: allUnifiedRows.filter((r) => r.direction === "outgoing").length,
      failed: allUnifiedRows.filter((r) => r.status === "failed").length,
      rejected: allUnifiedRows.filter((r) => r.status === "rejected").length,
    };
  }, [allUnifiedRows]);

  if (setup) return <CallsSetupState />;

  const assigneeName = agents.find((a) => a.id === assignee)?.name;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const rows = allUnifiedRows.filter((row) => {
    if (!matchesCallFilter(row, activeFilter)) return false;
    if (channelFilter !== "all" && row.channel !== channelFilter) return false;
    if (assigneeName && row.agentName !== assigneeName) return false;
    if (normalizedQuery) {
      const haystack = [
        row.contactName,
        row.peerNumberOrId,
        row.id,
        row.channelLabel,
        row.directionLabel,
        row.statusLabel,
        row.errorCode,
        row.errorMessage,
        row.agentName ?? "",
        row.endedByLabel,
        row.inboxName,
        row.conversationId ? String(row.conversationId) : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading
          title="Calls · سجل المكالمات"
          subtitle="سجل المكالمات الصوتية الواردة والصادرة عبر واتساب وماسنجر مع حالة الرنين والتحدث."
        />
        {isLinked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="calls-refresh-button"
            disabled={loadingLive}
            onClick={() => void fetchLiveHistory()}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loadingLive && "animate-spin")} />
            <span>تحديث السجل</span>
          </Button>
        )}
      </div>

      {/* Honest Meta Calling Constraints Summary Bar */}
      {isLinked && (
        <div
          data-testid="calls-meta-constraints-bar"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground"
          dir="rtl"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Smartphone className="size-3.5 text-sky-400" />
              <strong>قيد تطبيق الهاتف:</strong> مكالمات واتساب للأعمال ترن على تطبيق الهاتف المحمول فقط لا الحاسوب.
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-400" />
              <strong>الخطأ 131044:</strong> الصادر في واتساب يتطلب وسيلة دفع مفعلة في ميتا، بينما{" "}
              <strong className="text-emerald-400">المكالمات الواردة مجانية وتعمل بالكامل</strong>.
            </span>
            <span>·</span>
            <span>إنستغرام لا يدعم واجهة المكالمات البرمجية.</span>
          </div>
        </div>
      )}

      {liveError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs"
        >
          {liveError}
        </div>
      )}

      <Card className="border-border/50 bg-card/95 shadow-sm">
        <CardHeader className="border-border/50 border-b py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Fahad Visual Rule: Filter bar ALWAYS starts with «الكل» (All) first */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="فلاتر سجل المكالمات">
              {FILTER_TABS.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeFilter === tab.key;
                const count = filterCounts[tab.key];
                return (
                  <Button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    data-filter-tab={tab.key}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "gap-1.5 tabular-nums",
                      !isSelected && "border-border/50 text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => {
                      setActiveFilter(tab.key);
                      setPage(0);
                    }}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.labelAr}</span>
                    <span className="font-mono text-xs opacity-80 tabular-nums">({count})</span>
                  </Button>
                );
              })}
            </div>

            {/* Fahad Visual Rule: ExpandingSearch (lens icon) + Channel & Assignee filters */}
            <div className="flex flex-wrap items-center gap-2">
              <ExpandingSearch
                value={searchQuery}
                onChange={(val) => {
                  setSearchQuery(val);
                  setPage(0);
                }}
                label="Search calls"
                placeholder="بحث بالعميل أو الرقم أو رمز الخطأ…"
                name="calls"
                className="w-56"
                testId="calls-search"
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={
                      channelFilter !== "all"
                        ? "border-primary/40 text-primary"
                        : "border-border/50 text-muted-foreground"
                    }
                  >
                    <ListFilter className="size-3.5" />
                    <span>
                      {channelFilter === "all"
                        ? "القناة: الكل"
                        : channelFilter === "whatsapp"
                          ? "واتساب"
                          : channelFilter === "messenger"
                            ? "ماسنجر"
                            : "هاتف"}
                    </span>
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>تصفية حسب القناة</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => {
                      setChannelFilter("all");
                      setPage(0);
                    }}
                  >
                    الكل
                    {channelFilter === "all" ? <Check className="ms-auto size-4" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setChannelFilter("whatsapp");
                      setPage(0);
                    }}
                  >
                    <MessageSquareText className="size-3.5 text-emerald-400" /> واتساب
                    {channelFilter === "whatsapp" ? <Check className="ms-auto size-4" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setChannelFilter("messenger");
                      setPage(0);
                    }}
                  >
                    <MessageCircle className="size-3.5 text-sky-400" /> ماسنجر
                    {channelFilter === "messenger" ? <Check className="ms-auto size-4" /> : null}
                  </DropdownMenuItem>
                  {!isLinked && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setChannelFilter("phone");
                        setPage(0);
                      }}
                    >
                      <Phone className="size-3.5" /> هاتف
                      {channelFilter === "phone" ? <Check className="ms-auto size-4" /> : null}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {!isLinked && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("max-w-48", !assignee && "text-muted-foreground")}
                    >
                      {assigneeName ? (
                        <Avatar className={cn("size-4", personToneClass(assigneeName))}>
                          <AvatarFallback className="text-[7px]">{getInitials(assigneeName)}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <UserRound className="size-3.5" />
                      )}
                      <span className="truncate">{assigneeName ?? "الموظف"}</span>
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="p-1">
                      <Input
                        className="h-7"
                        placeholder="Search"
                        value={agentQuery}
                        onChange={(e) => setAgentQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <DropdownMenuItem
                      onSelect={() => {
                        setAssignee(null);
                        setPage(0);
                      }}
                    >
                      الكل
                      {!assignee ? <Check className="ms-auto size-4" /> : null}
                    </DropdownMenuItem>
                    {agents
                      .filter((a) => a.name.toLowerCase().includes(agentQuery.toLowerCase()))
                      .map((a) => (
                        <DropdownMenuItem
                          key={a.id}
                          onSelect={() => {
                            setAssignee(a.id);
                            setPage(0);
                          }}
                        >
                          <Avatar className={cn("size-5", personToneClass(a.name))}>
                            <AvatarFallback className="text-[8px]">{getInitials(a.name)}</AvatarFallback>
                          </Avatar>
                          {a.name}
                          {assignee === a.id ? <Check className="ms-auto size-4" /> : null}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          {pageRows.length ? (
            <Table className="**:data-[slot='table-cell']:px-2 xl:**:data-[slot='table-cell']:px-3 **:data-[slot='table-head']:px-2 xl:**:data-[slot='table-head']:px-3">
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="py-3 font-normal">العميل</TableHead>
                  <TableHead className="py-3 font-normal">القناة والاتجاه</TableHead>
                  <TableHead className="py-3 font-normal">الحالة</TableHead>
                  <TableHead className="py-3 font-normal">الرنين / التحدث</TableHead>
                  <TableHead className="py-3 font-normal">الإنهاء والموظف</TableHead>
                  <TableHead className="py-3 font-normal">المحادثة</TableHead>
                  <TableHead className="py-3 font-normal">التوقيت</TableHead>
                  <TableHead className="py-3 font-normal">
                    <div className="sr-only">إجراءات</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((call) => {
                  const convHref = call.conversationId
                    ? `/dashboard/chat?conversationId=${call.conversationId}&conversation=${call.conversationId}`
                    : "/dashboard/chat";
                  return (
                    <TableRow key={call.id} data-call-row={call.id} className="border-border/50 hover:bg-muted/30">
                      {/* 1. Contact (contact_name + peer_number_or_id) */}
                      <TableCell className="py-2.5 align-middle">
                        <div className="flex max-w-32 items-center gap-1.5 xl:max-w-48 xl:gap-2.5">
                          <PersonAvatar name={call.contactName} />
                          <div className="min-w-0">
                            <div
                              className={cn(
                                "truncate font-medium text-xs xl:text-sm tabular-nums",
                                call.contactName === "Deleted contact" && "text-muted-foreground italic",
                              )}
                              title={call.contactName}
                            >
                              {call.contactName}
                            </div>
                            {call.peerNumberOrId ? (
                              <div className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
                                {call.peerNumberOrId}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      {/* 2. Channel & Direction */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <ChannelBadge channel={call.channel} label={call.channelLabel} />
                          <DirectionBadge direction={call.direction} label={call.directionLabel} />
                        </div>
                      </TableCell>

                      {/* 3. Status + Error Code Badge (e.g. 131044) */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge
                            status={call.status}
                            label={call.statusLabel}
                            errorCode={call.errorCode}
                            errorMessage={call.errorMessage}
                          />
                          {call.errorMessage ? (
                            <span
                              className="hidden max-w-44 truncate text-[11px] text-muted-foreground xl:block"
                              title={call.errorMessage}
                            >
                              {call.errorMessage}
                            </span>
                          ) : null}
                          {call.simulated ? (
                            <span data-simulated-call className="text-[11px] text-muted-foreground italic">
                              {SIMULATED}, no call was placed
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* 4. Ring Duration & Talk Duration (tabular-nums) */}
                      <TableCell className="align-middle">
                        {call.recordingSeconds && !isLinked ? (
                          <RecordingPlayer seconds={call.recordingSeconds} name={call.contactName} />
                        ) : (
                          <div className="flex flex-col gap-0.5 font-mono text-[11px] xl:text-xs tabular-nums">
                            <span className="text-muted-foreground tabular-nums">
                              رنين: <strong className="text-foreground">{formatDuration(call.ringDurationSec)}</strong>{" "}
                              ({call.ringDurationSec}s)
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              تحدث: <strong className="text-foreground">{formatDuration(call.talkDurationSec)}</strong>{" "}
                              ({call.talkDurationSec}s)
                            </span>
                          </div>
                        )}
                      </TableCell>

                      {/* 5. Ended By & Agent */}
                      <TableCell className="align-middle">
                        <div className="flex max-w-28 flex-col gap-0.5 text-xs xl:max-w-48">
                          <span className="truncate font-medium text-foreground" title={call.endedByLabel}>
                            {call.endedByLabel}
                          </span>
                          {call.agentName ? (
                            <span className="truncate text-muted-foreground">الموظف: {call.agentName}</span>
                          ) : (
                            <span className="text-muted-foreground">بدون موظف</span>
                          )}
                        </div>
                      </TableCell>

                      {/* 6. Direct Conversation Link */}
                      <TableCell className="align-middle">
                        {call.conversationId ? (
                          <Link
                            href={convHref}
                            data-testid={`call-open-conv-${call.conversationId}`}
                            className="inline-flex h-6 xl:h-7 items-center gap-1 rounded-md border border-border/60 px-1.5 xl:px-2 font-mono text-foreground text-xs tabular-nums transition-colors hover:bg-muted"
                          >
                            <MessageCircle className="size-3 xl:size-3.5 text-primary" />
                            <span>#{call.conversationId}</span>
                            <ArrowUpRight className="size-3 xl:size-3.5 text-muted-foreground" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs">---</span>
                        )}
                      </TableCell>

                      {/* 7. Timestamp (Western digits, tabular-nums) */}
                      <TableCell className="align-middle">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="whitespace-nowrap font-mono text-muted-foreground text-xs tabular-nums">
                              {call.createdAt}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="font-mono text-xs tabular-nums">
                            {call.createdAtFull}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* 8. Actions */}
                      <TableCell className="align-middle">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-label={`Open actions for the call with ${call.contactName}`}
                                className="size-7 rounded-md text-muted-foreground hover:bg-muted/50"
                                size="icon-sm"
                                variant="ghost"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {call.conversationId ? (
                                <DropdownMenuItem asChild>
                                  <Link href={convHref}>
                                    <MessageCircle className="size-4" /> فتح المحادثة #{call.conversationId}
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {!isLinked && (
                                <DropdownMenuItem
                                  disabled={!call.recordingSeconds}
                                  onSelect={() =>
                                    toast.success(`Recording of the call with ${call.contactName} downloaded`)
                                  }
                                >
                                  <Download className="size-4" /> Download recording
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              {loadingLive ? "جاري تحميل سجل المكالمات…" : "لا توجد مكالمات مطابقة للفلتر الحالي"}
            </div>
          )}

          {rows.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 pt-4">
              <span className="font-mono text-muted-foreground text-xs tabular-nums">
                Showing {current * PAGE_SIZE + 1} - {Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length}{" "}
                calls
              </span>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={current === 0}
                      className={cn(current === 0 && "pointer-events-none opacity-50")}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(Math.max(current - 1, 0));
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: pageCount }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: page numbers
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        isActive={i === current}
                        className="tabular-nums"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(i);
                        }}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={current >= pageCount - 1}
                      className={cn(current >= pageCount - 1 && "pointer-events-none opacity-50")}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(Math.min(current + 1, pageCount - 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

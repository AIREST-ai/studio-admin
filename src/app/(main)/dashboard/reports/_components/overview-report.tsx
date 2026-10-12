"use client";
import * as React from "react";

import { cn } from "cn";
import { addMonths, eachDayOfInterval, endOfMonth, format, min as minDate, startOfMonth, subDays } from "date-fns";
import {
  Check,
  ChevronDown,
  Clock3,
  Download,
  Hourglass,
  type LucideIcon,
  MessagesSquare,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { inboxes as cwInboxes } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { ChannelIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { type AgentStatus, agentLiveRows, liveCounts, teamLiveRows } from "./data";
import { TODAY } from "./report-period";
import { ReportHeader } from "./report-ui";
import { TablePager, usePager } from "./table-pager";

const statusDot: Record<AgentStatus, string> = {
  online: "bg-emerald-500",
  busy: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

const statusLabel: Record<AgentStatus, string> = { online: "Online", busy: "Busy", offline: "Offline" };

const statusBadge: Record<AgentStatus, string> = {
  online: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  busy: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  offline: "border-border bg-muted/50 text-muted-foreground",
};

function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border px-2 py-1 font-medium", statusBadge[status])}>
      <span className={cn("size-1.5 rounded-full", statusDot[status])} />
      {statusLabel[status]}
    </Badge>
  );
}

function LiveBadge() {
  return (
    <Badge variant="outline" className="gap-1.5 text-emerald-700 dark:text-emerald-400">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </Badge>
  );
}

// F159: live numbers from the conversations themselves (the same store as /dashboard/chat), so Open, Unattended and
// Unassigned match the conversation list counts and follow a resolve or an assignment made there.
function useLiveMeta() {
  const meta = useCwStore((s) => s.meta);
  const deleted = useCwStore((s) => s.deleted);
  return { meta, deleted };
}

// Studio metric tile (default/_components/metric-cards.tsx): icon tile, label, big number.
function StatTile({ label, value, icon: Icon, dot }: { label: string; value: number; icon?: LucideIcon; dot?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-linear-to-t from-primary/5 to-card p-4 shadow-xs dark:bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-lg border bg-muted">
            <Icon className="size-4" />
          </span>
        ) : (
          <span className={cn("size-2 rounded-full", dot)} />
        )}
        {label}
      </div>
      <span className="font-medium text-3xl tabular-nums leading-none tracking-tight">{value}</span>
    </div>
  );
}

function OpenConversations() {
  const [team, setTeam] = React.useState("all");
  const { meta, deleted } = useLiveMeta();
  const counts = liveCounts(meta, team === "all" ? null : team, deleted);
  const teamLive = teamLiveRows(meta, deleted);
  const agentLive = agentLiveRows(meta, deleted);
  const stats = [
    { label: "Open", value: counts.open, icon: MessagesSquare },
    { label: "Unattended", value: counts.unattended, icon: Hourglass },
    { label: "Unassigned", value: counts.unassigned, icon: UserRoundX },
    { label: "Pending", value: counts.pending, icon: Clock3 },
  ];
  const online = agentLive.filter((a) => a.status === "online").length;
  const busy = agentLive.filter((a) => a.status === "busy").length;
  const offline = agentLive.filter((a) => a.status === "offline").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Open Conversations <LiveBadge />
          </CardTitle>
          <CardAction>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger size="sm" className="w-40" aria-label="Team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamLive.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} icon={s.icon} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Agent status <LiveBadge />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <StatTile label="Online" value={online} dot={statusDot.online} />
          <StatTile label="Busy" value={busy} dot={statusDot.busy} />
          <StatTile label="Offline" value={offline} dot={statusDot.offline} />
        </CardContent>
      </Card>
    </div>
  );
}

// HeatmapDateRangeSelector.vue: day ranges, then This month and the two months before it.
type HeatRange = { value: string; label: string; kind: "day" | "month"; days?: number; offset?: number };
const heatRanges: HeatRange[] = [
  { value: "last7", label: "Last 7 days", kind: "day", days: 7 },
  { value: "last14", label: "Last 14 days", kind: "day", days: 14 },
  { value: "last30", label: "Last 30 days", kind: "day", days: 30 },
  { value: "month_0", label: "This month", kind: "month", offset: 0 },
  { value: "month_-1", label: format(addMonths(TODAY, -1), "MMMM yyyy"), kind: "month", offset: -1 },
  { value: "month_-2", label: format(addMonths(TODAY, -2), "MMMM yyyy"), kind: "month", offset: -2 },
];

function heatDates(r: HeatRange) {
  if (r.kind === "day") return eachDayOfInterval({ start: subDays(TODAY, (r.days ?? 7) - 1), end: TODAY });
  const start = startOfMonth(addMonths(TODAY, r.offset ?? 0));
  return eachDayOfInterval({ start, end: minDate([endOfMonth(start), TODAY]) });
}

function seeded(seed: number) {
  let s = seed % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// One row per date x 24 hours. Gulf week: busy Sun-Thu daytime, quiet Friday morning.
function heatGrid(dates: Date[], seed: number, scale: number) {
  return dates.map((date, row) => {
    const rand = seeded(seed * 1000 + Number(format(date, "yyyyMMdd")) % 9973 + row);
    const d = date.getDay();
    return Array.from({ length: 24 }, (_, h) => {
      const work = h >= 8 && h <= 21 ? 1 : 0.15;
      const evening = h >= 19 && h <= 23 ? 0.6 : 0;
      const friday = d === 5 && h < 13 ? 0.2 : 1;
      const weekend = d === 5 || d === 6 ? 0.7 : 1;
      return Math.round((work * 14 + evening * 8) * friday * weekend * (0.6 + rand() * 0.8) * scale);
    });
  });
}

function InboxPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const current = cwInboxes.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-48 font-normal" aria-label="Inbox">
          <span className="truncate">{current?.name ?? "All Inboxes"}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Search Inbox" />
          <CommandList className="max-h-96">
            <CommandEmpty>No results found</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All Inboxes"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                All Inboxes
                {!value ? <Check className="ml-auto" /> : null}
              </CommandItem>
              {cwInboxes.map((inbox) => (
                <CommandItem
                  key={inbox.id}
                  value={inbox.name}
                  onSelect={() => {
                    onChange(inbox.id);
                    setOpen(false);
                  }}
                >
                  <ChannelIcon channel={inbox.id} />
                  <span className="truncate">{inbox.name}</span>
                  {value === inbox.id ? <Check className="ml-auto" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Heatmap({ title, seed, tone }: { title: string; seed: number; tone: "blue" | "green" }) {
  const [rangeValue, setRangeValue] = React.useState("last7");
  const [inbox, setInbox] = React.useState<string | null>(null);
  const range = heatRanges.find((r) => r.value === rangeValue) ?? heatRanges[0];
  const dates = React.useMemo(() => heatDates(range), [range]);
  const inboxIndex = inbox ? cwInboxes.findIndex((i) => i.id === inbox) : -1;
  const grid = React.useMemo(
    () => heatGrid(dates, seed + inboxIndex + 2, inboxIndex >= 0 ? 0.18 + (inboxIndex % 3) * 0.08 : 1),
    [dates, seed, inboxIndex],
  );
  const max = Math.max(1, ...grid.flat());
  // CW heatmaps: Conversation Traffic is blue, Resolutions is green (Tailwind blue-500 / emerald-500).
  const color = tone === "blue" ? "#3b82f6" : "#10b981";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {format(dates[0], "MMM d, yyyy")} - {format(dates[dates.length - 1], "MMM d, yyyy")}
        </CardDescription>
        <CardAction className="flex flex-wrap items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="font-normal" aria-label="Date range">
                {range.label}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup value={rangeValue} onValueChange={setRangeValue}>
                {heatRanges
                  .filter((r) => r.kind === "day")
                  .map((r) => (
                    <DropdownMenuRadioItem key={r.value} value={r.value}>
                      {r.label}
                    </DropdownMenuRadioItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">Month</DropdownMenuLabel>
                {heatRanges
                  .filter((r) => r.kind === "month")
                  .map((r) => (
                    <DropdownMenuRadioItem key={r.value} value={r.value}>
                      {r.label}
                    </DropdownMenuRadioItem>
                  ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <InboxPicker value={inbox} onChange={setInbox} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Download report"
                onClick={() => toast.success(`${title} report download started (sample)`)}
              >
                <Download />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download report</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="grid min-w-[780px] grid-cols-[104px_repeat(24,minmax(0,1fr))] gap-1">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[10px] text-muted-foreground">
              {h % 3 === 0 ? `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "a" : "p"}` : ""}
            </span>
          ))}
          {grid.map((row, d) => (
            <React.Fragment key={dates[d].toISOString()}>
              <span className="flex items-center text-muted-foreground text-xs">{format(dates[d], "MMM d, yyyy")}</span>
              {row.map((v, h) => (
                <Tooltip key={h}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn("rounded-[4px] border border-border/40", dates.length > 14 ? "h-5" : "h-7")}
                      style={{
                        backgroundColor: v
                          ? `color-mix(in oklab, ${color} ${Math.round((v / max) * 90 + 8)}%, transparent)`
                          : undefined,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {format(dates[d], "EEE, MMM d")}, {h}:00 ·{" "}
                    {v ? `${v} ${v === 1 ? "conversation" : "conversations"}` : "No conversations"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentTable() {
  const { meta, deleted } = useLiveMeta();
  const agentLive = agentLiveRows(meta, deleted);
  const pager = usePager(agentLive, 5);
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Conversations by agents</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Agent</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Unattended</TableHead>
              <TableHead className="pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.pageRows.length ? (
              pager.pageRows.map((a) => (
                <TableRow key={a.email}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2.5">
                      <Avatar className={cn("size-8 font-medium", personToneClass(a.name))}>
                        <AvatarFallback className="text-xs">{getInitials(a.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted-foreground text-xs">{a.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.open}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.unattended}</TableCell>
                  <TableCell className="pr-6">
                    <StatusBadge status={a.status} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  There are no conversations by agents
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePager pager={pager} />
      </CardContent>
    </Card>
  );
}

function TeamTable() {
  const { meta, deleted } = useLiveMeta();
  const teamLive = teamLiveRows(meta, deleted);
  const pager = usePager(teamLive, 5);
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Conversations by teams</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Team</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Unattended</TableHead>
              <TableHead className="pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.pageRows.length ? (
              pager.pageRows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-6 font-medium">{t.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.open}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.unattended}</TableCell>
                  <TableCell className="pr-6">
                    <StatusBadge status={t.unattended > 2 ? "busy" : "online"} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  There is no data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePager pager={pager} />
      </CardContent>
    </Card>
  );
}

// CW LiveReports.vue (the Overview is the live view in v4.18).
export function OverviewReport() {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <ReportHeader
          title={
            <span className="flex items-center gap-3">
              Overview <LiveBadge />
            </span>
          }
          description="Live view of open conversations, traffic, resolutions and who is online right now."
        />
        <OpenConversations />
        <Heatmap title="Conversation Traffic" seed={11} tone="blue" />
        <Heatmap title="Resolutions" seed={23} tone="green" />
        <AgentTable />
        <TeamTable />
      </div>
    </TooltipProvider>
  );
}


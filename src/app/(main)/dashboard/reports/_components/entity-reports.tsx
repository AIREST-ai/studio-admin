"use client";
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { differenceInDays } from "date-fns";
import { ArrowDownUp, Search, Tag, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

import { ChannelIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { type EntityKind, entities, entityMeta, entityMetrics, entityTrends, type SummaryRow } from "./data";
import { type PeriodState, ReportPeriodProvider, usePeriod } from "./report-period";
import { DownloadButton, MetricChartsGrid, MetricKpis, ReportFilters, ReportHeader } from "./report-ui";

// F159: the same channel icons as the conversation list (channel type -> inbox channel id).
const inboxChannel: Record<string, string> = {
  Email: "email",
  Website: "chat",
  WhatsApp: "whatsapp",
  Instagram: "instagram",
  Facebook: "facebook",
  Voice: "phone",
};

function EntityCell({ kind, row }: { kind: EntityKind; row: SummaryRow }) {
  let media: React.ReactNode;
  if (kind === "agents") {
    // F159: the agent's own initials colour, as in the conversations and Settings > Teams.
    media = (
      <Avatar className={cn("size-7 font-medium", personToneClass(row.name))}>
        <AvatarFallback className="text-[10px]">{getInitials(row.name)}</AvatarFallback>
      </Avatar>
    );
  } else if (kind === "labels") {
    media = <span className="size-3 rounded-sm" style={{ backgroundColor: row.color }} />;
  } else if (kind === "inboxes") {
    media = (
      <span className="flex size-7 items-center justify-center rounded-md bg-muted">
        <ChannelIcon channel={inboxChannel[row.subtitle ?? ""] ?? "chat"} />
      </span>
    );
  } else {
    media = (
      <span className="flex size-7 items-center justify-center rounded-md bg-muted">
        <Users className="size-3.5" />
      </span>
    );
  }
  return (
    <Link href={`/dashboard/reports/${kind}/${row.id}`} className="group flex items-center gap-2.5">
      {media}
      <div className="flex flex-col">
        <span className="font-medium group-hover:underline">{row.name}</span>
        {row.subtitle ? <span className="text-muted-foreground text-xs">{row.subtitle}</span> : null}
      </div>
    </Link>
  );
}

type SortKey = "name" | "conversations" | "resolutionCount";

// "1h 04m", "4m 50s", "52m 10s" -> minutes.
function parseMinutes(text: string) {
  let m = 0;
  for (const [, n, u] of text.matchAll(/(\d+)\s*([dhms])/g)) {
    const v = Number(n);
    m += u === "d" ? v * 1440 : u === "h" ? v * 60 : u === "m" ? v : v / 60;
  }
  return m;
}

function shortDuration(minutes: number) {
  const s = Math.round(minutes * 60);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

// The sample rows are for the last 7 days; another range scales the counts and moves the times a little.
function scaleRow(row: SummaryRow, period: PeriodState): SummaryRow {
  if (!period.salt) return row;
  const days = differenceInDays(period.to, period.from) + 1;
  const hours = period.businessHours ? 0.72 : 1;
  const k = (days / 7) * hours;
  const wobble = 1 + (((period.salt + Number(row.id) * 13) % 21) - 10) / 100;
  return {
    ...row,
    conversations: Math.max(0, Math.round(row.conversations * k)),
    resolutionCount: Math.max(0, Math.round(row.resolutionCount * k)),
    avgFirstResponse: shortDuration(parseMinutes(row.avgFirstResponse) * wobble * hours),
    avgResolution: shortDuration(parseMinutes(row.avgResolution) * wobble * hours),
    avgReply: shortDuration(parseMinutes(row.avgReply) * wobble * hours),
  };
}

export function EntitySummary({ kind }: { kind: EntityKind }) {
  return (
    <ReportPeriodProvider showGroupBy={false}>
      <EntitySummaryBody kind={kind} />
    </ReportPeriodProvider>
  );
}

function EntitySummaryBody({ kind }: { kind: EntityKind }) {
  const meta = entityMeta[kind];
  const period = usePeriod();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("conversations");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entities[kind].filter((r) => !q || r.name.toLowerCase().includes(q)).map((r) => scaleRow(r, period));
    return [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]));
  }, [kind, query, sort, period]);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <ReportHeader title={meta.header} description={meta.description}>
        <DownloadButton label={meta.download} />
      </ReportHeader>
      <ReportFilters showGroupBy={false} showBusinessHours />
      <Card className="py-0">
        <CardContent className="px-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                {kind === "labels" ? <Tag className="size-3.5" /> : <Search className="size-3.5" />}
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                type="search"
                placeholder={meta.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
            <span className="ml-auto text-muted-foreground text-xs">
              {rows.length} {rows.length === 1 ? meta.column.toLowerCase() : `${meta.column.toLowerCase()}s`}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => setSort("name")}>
                    {meta.column}
                    <ArrowDownUp className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => setSort("conversations")}
                  >
                    No. of conversations
                    <ArrowDownUp className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Avg. First Response Time</TableHead>
                <TableHead className="text-right">Avg. Resolution Time</TableHead>
                <TableHead className="text-right">Avg. Customer Waiting Time</TableHead>
                <TableHead className="pr-4 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => setSort("resolutionCount")}
                  >
                    Resolution Count
                    <ArrowDownUp className="size-3" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4">
                      <EntityCell kind={kind} row={r} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.conversations}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.avgFirstResponse}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.avgResolution}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.avgReply}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{r.resolutionCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No results found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// WootReports.vue with a selected item: back button, entity chip with search, date range, Group By, Business Hours,
// then one chart per metric. The sample row (last 7 days) sets the daily level, so the charts agree with the table.
export function EntityDetail({ kind, row }: { kind: EntityKind; row: SummaryRow }) {
  return (
    <ReportPeriodProvider>
      <EntityDetailBody kind={kind} row={row} />
    </ReportPeriodProvider>
  );
}

// Every total is anchored to the summary row for the same period (scaleRow), so the detail page and the
// Overview table always show the same numbers.
function EntityDetailBody({ kind, row }: { kind: EntityKind; row: SummaryRow }) {
  const meta = entityMeta[kind];
  const router = useRouter();
  const period = usePeriod();
  const scaled = scaleRow(row, period);
  const anchors: Record<string, number> = {
    conversations: scaled.conversations,
    resolutionCount: scaled.resolutionCount,
    incoming: Math.round(scaled.conversations * 6),
    outgoing: Math.round(scaled.conversations * 5.5),
    firstResponse: parseMinutes(scaled.avgFirstResponse),
    resolutionTime: parseMinutes(scaled.avgResolution),
    replyTime: parseMinutes(scaled.avgReply),
  };
  const trends = entityTrends(kind, row.id);
  const perDay = (n: number) => Math.max(1, Math.round(n / 7));
  const counts: Record<string, number> = {
    conversations: perDay(row.conversations),
    resolutionCount: perDay(row.resolutionCount),
    incoming: perDay(row.conversations * 6),
    outgoing: perDay(row.conversations * 5.5),
  };
  const times: Record<string, string> = {
    firstResponse: row.avgFirstResponse,
    resolutionTime: row.avgResolution,
    replyTime: row.avgReply,
  };
  // WootReports.vue reportKeys: an agent has no "Messages received" chart; inboxes, teams and labels have all seven.
  const defs = kind === "agents" ? entityMetrics.filter((def) => def.key !== "incoming") : entityMetrics;
  const metrics = defs.map((def) => {
    const m = { ...def, trend: trends[def.key] ?? def.trend, anchor: anchors[def.key] };
    if (m.key in counts) return { ...m, base: counts[m.key], spread: Math.max(2, Math.round(counts[m.key] * 0.6)) };
    if (m.key in times) {
      const minutes = parseMinutes(times[m.key]) || m.base;
      return { ...m, base: minutes, spread: minutes * 0.7 };
    }
    return m;
  });
  const seed = Number(row.id) + kind.length * 10;

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <ReportHeader title={row.name} description={meta.header} backHref={`/dashboard/reports/${kind}`}>
        <DownloadButton label={meta.download} />
      </ReportHeader>
      <ReportFilters
        entityLabel={meta.select}
        searchPlaceholder={meta.search}
        entityOptions={entities[kind].map((e) => ({ id: e.id, name: e.name }))}
        entityValue={row.id}
        onEntityChange={(id) => router.push(`/dashboard/reports/${kind}/${id}`)}
      />
      <MetricKpis
        metrics={metrics}
        seed={seed}
        keys={["conversations", "firstResponse", "resolutionTime", "resolutionCount"]}
      />
      <MetricChartsGrid metrics={metrics} seed={seed} scope={{ kind, row }} />
    </div>
  );
}

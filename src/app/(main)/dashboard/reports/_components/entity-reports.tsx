"use client";
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowDownUp, Camera, Globe, Inbox, Mail, MessageCircle, Search, Tag, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

import { type EntityKind, entities, entityMeta, entityMetrics, type SummaryRow } from "./data";
import { DownloadButton, MetricChartsGrid, ReportFilters, ReportHeader } from "./report-ui";

const inboxIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  WhatsApp: MessageCircle,
  Website: Globe,
  Email: Mail,
  Instagram: Camera,
};

function EntityCell({ kind, row }: { kind: EntityKind; row: SummaryRow }) {
  let media: React.ReactNode;
  if (kind === "agents") {
    media = (
      <Avatar className="size-7">
        <AvatarFallback className="text-[10px]">{getInitials(row.name)}</AvatarFallback>
      </Avatar>
    );
  } else if (kind === "labels") {
    media = <span className="size-3 rounded-sm" style={{ backgroundColor: row.color }} />;
  } else if (kind === "inboxes") {
    const Icon = inboxIcon[row.subtitle ?? ""] ?? Inbox;
    media = (
      <span className="flex size-7 items-center justify-center rounded-md bg-muted">
        <Icon className="size-3.5" />
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

export function EntitySummary({ kind }: { kind: EntityKind }) {
  const meta = entityMeta[kind];
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("conversations");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entities[kind].filter((r) => !q || r.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]));
  }, [kind, query, sort]);

  return (
    <div className="flex flex-col gap-5">
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

export function EntityDetail({ kind, row }: { kind: EntityKind; row: SummaryRow }) {
  const meta = entityMeta[kind];
  const router = useRouter();
  const scale = row.conversations / 214;
  const metrics = entityMetrics.map((m) => {
    if (m.key === "conversations") return { ...m, total: String(row.conversations), base: Math.round(m.base * scale) };
    if (m.key === "resolutionCount") return { ...m, total: String(row.resolutionCount), base: Math.round(m.base * scale) };
    if (m.key === "incoming" || m.key === "outgoing") {
      const v = Math.round(Number(m.total.replace(",", "")) * scale);
      return { ...m, total: v.toLocaleString("en-US"), base: Math.round(m.base * scale) };
    }
    if (m.key === "firstResponse") return { ...m, total: row.avgFirstResponse };
    if (m.key === "resolutionTime") return { ...m, total: row.avgResolution };
    return m;
  });

  return (
    <div className="flex flex-col gap-5">
      <ReportHeader title={row.name} backHref={`/dashboard/reports/${kind}`}>
        <DownloadButton label={meta.download} />
      </ReportHeader>
      <ReportFilters
        entityLabel={meta.select}
        entityOptions={entities[kind].map((e) => ({ id: e.id, name: e.name }))}
        entityValue={row.id}
        onEntityChange={(id) => router.push(`/dashboard/reports/${kind}/${id}`)}
      />
      <MetricChartsGrid metrics={metrics} seed={Number(row.id) + kind.length * 10} />
    </div>
  );
}

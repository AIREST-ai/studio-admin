"use client";
import * as React from "react";

import { ListFilter, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { agents, csatDistribution, csatResponses, dateRangeOptions, inboxes, teams } from "./data";
import { DownloadButton, ReportHeader, StatCard } from "./report-ui";

const emojiFor: Record<number, string> = { 1: "😡", 2: "😞", 3: "😐", 4: "😀", 5: "😍" };

const filterGroups = [
  { key: "Agent", options: agents.map((a) => a.name) },
  { key: "Inbox", options: inboxes.map((i) => i.name) },
  { key: "Team", options: teams.map((t) => t.name) },
  { key: "Rating", options: ["😍 5", "😀 4", "😐 3", "😞 2", "😡 1"] },
];

function CsatFilters({ filters, setFilters }: { filters: Record<string, string[]>; setFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>> }) {
  const [range, setRange] = React.useState("Last 7 days");
  const active = Object.entries(filters).filter(([, v]) => v.length);

  function toggle(group: string, value: string, checked: boolean) {
    setFilters((prev) => {
      const list = prev[group] ?? [];
      return { ...prev, [group]: checked ? [...list, value] : list.filter((x) => x !== value) };
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={range} onValueChange={setRange}>
        <SelectTrigger size="sm" className="w-44" aria-label="Duration">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {dateRangeOptions.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {active.map(([group, values]) => (
        <Badge key={group} variant="secondary" className="h-7 gap-1 pr-1">
          {group}: {values.length > 1 ? `${values[0]} +${values.length - 1}` : values[0]}
          <button
            type="button"
            aria-label={`Clear ${group}`}
            className="rounded-sm p-0.5 hover:bg-background"
            onClick={() => setFilters((p) => ({ ...p, [group]: [] }))}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ListFilter />
            Add filter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {filterGroups.map((g) => (
            <DropdownMenuSub key={g.key}>
              <DropdownMenuSubTrigger>{g.key}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  {`Search ${g.key === "Inbox" ? "inboxes" : `${g.key.toLowerCase()}s`}`}
                </DropdownMenuLabel>
                {g.options.map((o) => (
                  <DropdownMenuCheckboxItem
                    key={o}
                    checked={filters[g.key]?.includes(o) ?? false}
                    onCheckedChange={(c) => toggle(g.key, o, Boolean(c))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {o}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {active.length ? (
        <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

function RatingDistribution() {
  const total = csatDistribution.reduce((s, r) => s + r.count, 0);
  const colors = ["bg-emerald-500", "bg-lime-500", "bg-amber-400", "bg-orange-500", "bg-rose-500"];
  return (
    <div className="flex flex-col gap-3 p-5">
      <span className="text-muted-foreground text-sm">Rating distribution</span>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {csatDistribution.map((r, i) => (
          <span key={r.rating} className={colors[i]} style={{ width: `${(r.count / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {csatDistribution.map((r, i) => (
          <span key={r.rating} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${colors[i]}`} />
            {r.emoji}
            <span className="tabular-nums">{Math.round((r.count / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function CsatReport() {
  const [filters, setFilters] = React.useState<Record<string, string[]>>({});
  const agentFilter = filters.Agent ?? [];
  const ratingFilter = (filters.Rating ?? []).map((r) => Number(r.split(" ")[1]));
  const rows = csatResponses.filter(
    (r) =>
      (!agentFilter.length || (r.agent && agentFilter.includes(r.agent))) &&
      (!ratingFilter.length || ratingFilter.includes(r.rating)),
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        <ReportHeader title="CSAT Reports">
          <DownloadButton label="Download CSAT Reports" />
        </ReportHeader>
        <CsatFilters filters={filters} setFilters={setFilters} />
        <Card className="py-0">
          <CardContent className="grid grid-cols-1 divide-y px-0 md:grid-cols-[1fr_1fr_1fr_1.6fr] md:divide-x md:divide-y-0">
            <StatCard label="Total responses" value="536" tooltip="Total number of responses collected" />
            <StatCard
              label="Satisfaction score"
              value="84.5%"
              tooltip="Total number of positive responses / Total number of responses * 100"
            />
            <StatCard
              label="Response rate"
              value="41.2%"
              tooltip="Total number of responses / Total number of CSAT survey messages sent * 100"
            />
            <RatingDistribution />
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Contact</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Feedback comment</TableHead>
                  <TableHead className="pr-5 text-right">Conversation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-[10px]">{getInitials(r.contact)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{r.contact}</span>
                            <span className="text-muted-foreground text-xs">{r.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.agent ?? <span className="text-muted-foreground">No assigned agent</span>}
                      </TableCell>
                      <TableCell>
                        <span className="text-lg" title={`${r.rating} / 5`}>
                          {emojiFor[r.rating]}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-80 whitespace-normal">
                        {r.feedback || <span className="text-muted-foreground">No feedback provided</span>}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium text-primary">#{r.conversation}</span>
                          <span className="text-muted-foreground text-xs">{r.time}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">No responses yet</span>
                        <span className="text-muted-foreground text-sm">
                          CSAT survey responses will appear here once customers start providing feedback.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

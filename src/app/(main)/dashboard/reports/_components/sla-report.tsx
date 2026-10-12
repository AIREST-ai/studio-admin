"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { format, subDays, subMinutes } from "date-fns";
import { AlarmClockOff, MessagesSquare, Target } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { useChatTags } from "@/app/(main)/chat/_components/chat-tags-store";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { agents, inboxes, labels, type SlaMetric, type SlaRow, slaPolicies, slaRows, slaSummary, teams } from "./data";
import { FilterBar, type FilterGroup, type FilterValues } from "./filter-bar";
import { ReportDatePicker, ReportPeriodProvider, TODAY, usePeriod } from "./report-period";
import { DownloadButton, KpiCards, ReportHeader } from "./report-ui";
import { TablePager, usePager } from "./table-pager";

// SLAFilter.vue: SLA Policy, Inbox, Agent, Team, Label (placeholders from SLA_REPORTS.DROPDOWN.INPUT_PLACEHOLDER).
const filterGroups: FilterGroup[] = [
  { key: "policy", label: "SLA Policy", placeholder: "SLA name", options: slaPolicies },
  { key: "inbox", label: "Inbox", placeholder: "Inbox name", options: inboxes.map((i) => i.name) },
  { key: "agent", label: "Agent", placeholder: "Agent name", options: agents.map((a) => a.name) },
  { key: "team", label: "Team", placeholder: "Team name", options: teams.map((t) => t.name) },
  { key: "label", label: "Label", placeholder: "Label name", options: labels.map((l) => l.name) },
];

// SLAPopoverCard.vue sections, in this order.
const eventSections: { metric: SlaMetric; label: string }[] = [
  { metric: "First Response Time", label: "First response time" },
  { metric: "Next Response Time", label: "Next response time" },
  { metric: "Resolution Time", label: "Resolution time" },
];

// When each missed target was missed (sample): yesterday afternoon, a few minutes apart per row.
function missedAt(row: SlaRow, index: number) {
  return format(subMinutes(subDays(TODAY, 1), -(15 * 60 + row.conversation * 7 + index * 41)), "MMM d, yyyy, h:mm a");
}

// SLAViewDetails.vue: a link button that opens the SLA Misses card next to it.
function ViewDetails({ row }: { row: SlaRow }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="link" size="sm" className="px-0 text-muted-foreground">
          View Details
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-4">
        <span className="font-medium text-sm">SLA Misses</span>
        {eventSections
          .filter((s) => row.missed.includes(s.metric))
          .map((s) => (
            <div key={s.metric} className="flex justify-between gap-4">
              <span className="min-w-36 text-muted-foreground text-sm">{s.label}</span>
              <span className="text-right text-sm tabular-nums">{missedAt(row, eventSections.indexOf(s))}</span>
            </div>
          ))}
      </PopoverContent>
    </Popover>
  );
}

function SlaBody() {
  const period = usePeriod();
  const [filters, setFilters] = React.useState<FilterValues>({});
  // Conversation labels come from the inbox (the same labels the conversation list shows).
  const { tags, byConv } = useChatTags();
  const labelsOf = (conversation: number) =>
    (byConv[String(conversation)] ?? []).flatMap((tagId) => tags.filter((tag) => tag.id === tagId));

  // The SLA conversations are the inbox's open ones (this week), so a period before Oct 6 has none.
  const inPeriod = period.to >= subDays(TODAY, 6);
  const rows = slaRows.filter((r) => {
    if (!inPeriod) return false;
    if (filters.policy && r.policy !== filters.policy) return false;
    if (filters.agent && r.agent !== filters.agent) return false;
    if (filters.inbox && r.inbox !== filters.inbox) return false;
    if (filters.team && r.team !== filters.team) return false;
    if (filters.label && !labelsOf(r.conversation).some((tag) => tag.label === filters.label)) return false;
    return true;
  });
  const summary = slaSummary(rows);
  const pager = usePager(rows, 10);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <ReportHeader
        title="SLA Reports"
        description="Conversations that met or missed their first response, next response and resolution targets."
      >
        <DownloadButton label="Download SLA reports" />
      </ReportHeader>
      <div className="flex flex-wrap items-center gap-2">
        <ReportDatePicker />
        <FilterBar groups={filterGroups} values={filters} onChange={setFilters} joiner="with" />
      </div>

      <KpiCards
        items={[
          {
            label: "Hit Rate",
            value: summary.hitRate,
            icon: Target,
            tooltip: "Percentage of SLAs created were completed successfully",
          },
          {
            label: "Number of Misses",
            value: String(summary.misses),
            icon: AlarmClockOff,
            tooltip: "Total SLA misses in a certain period",
          },
          {
            label: "Number of Conversations",
            value: String(summary.conversations),
            icon: MessagesSquare,
            tooltip: "Total number of conversations with SLA",
          },
        ]}
      />

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Conversation</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="pr-5 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.pageRows.length ? (
                pager.pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-3 pl-5">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          <Link
                            href={`/dashboard/chat?conversation=${r.conversation}`}
                            className="text-primary hover:underline"
                          >
                            #{r.conversation}
                          </Link>{" "}
                          <span className="font-normal text-muted-foreground">with</span> {r.contact}
                        </span>
                        <span className="text-muted-foreground text-xs">{r.subject}</span>
                        {labelsOf(r.conversation).length ? (
                          <span className="flex flex-wrap gap-1">
                            {labelsOf(r.conversation).map((tag) => (
                              <Badge key={tag.id} variant="outline" className="gap-1 px-1.5 py-0 font-normal text-xs">
                                <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                {tag.label}
                              </Badge>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{r.policy}</span>
                        {r.missed.length ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/20 bg-destructive/10 text-destructive"
                          >
                            Missed
                          </Badge>
                        ) : r.active ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          >
                            Hit
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.agent ? (
                        <div className="flex items-center gap-2">
                          <Avatar className={cn("size-6 font-medium", personToneClass(r.agent))}>
                            <AvatarFallback className="text-[10px]">{getInitials(r.agent)}</AvatarFallback>
                          </Avatar>
                          {r.agent}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">---</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <ViewDetails row={r} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    SLA applied conversations are not available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePager pager={pager} />
        </CardContent>
      </Card>
    </div>
  );
}

// CW SLAReports.vue.
export function SlaReport() {
  return (
    <TooltipProvider>
      <ReportPeriodProvider showGroupBy={false}>
        <SlaBody />
      </ReportPeriodProvider>
    </TooltipProvider>
  );
}

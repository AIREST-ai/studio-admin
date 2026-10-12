"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { subDays } from "date-fns";
import { ChevronDown, ChevronUp, MessageSquareHeart, Pencil, Percent, Smile } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { csatRatingLabels } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { agents, type CsatResponse, csatResponses, csatSummary, inboxes, teams } from "./data";
import { FilterBar, type FilterGroup, type FilterValues } from "./filter-bar";
import { ReportDatePicker, ReportPeriodProvider, TODAY, usePeriod } from "./report-period";
import { DownloadButton, KpiCards, ReportHeader } from "./report-ui";
import { TablePager, usePager } from "./table-pager";

// CW CSAT_RATINGS: label and colour of each rating (the labels are the inbox's own, cw-data csatRatingLabels).
const ratingMeta: Record<number, { label: string; bar: string; pill: string }> = {
  5: {
    label: csatRatingLabels[5],
    bar: "bg-emerald-500",
    pill: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  4: { label: csatRatingLabels[4], bar: "bg-lime-500", pill: "border-lime-500/20 bg-lime-500/10 text-lime-700 dark:text-lime-300" },
  3: {
    label: csatRatingLabels[3],
    bar: "bg-amber-400",
    pill: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  2: {
    label: csatRatingLabels[2],
    bar: "bg-orange-500",
    pill: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  1: { label: csatRatingLabels[1], bar: "bg-rose-500", pill: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
};

const filterGroups: FilterGroup[] = [
  { key: "agent", label: "Agent", placeholder: "Search agents", options: agents.map((a) => a.name) },
  { key: "inbox", label: "Inbox", placeholder: "Search inboxes", options: inboxes.map((i) => i.name) },
  { key: "team", label: "Team", placeholder: "Search teams", options: teams.map((t) => t.name) },
  { key: "rating", label: "Rating", placeholder: "Search ratings", options: [5, 4, 3, 2, 1].map((r) => ratingMeta[r].label) },
];

// CsatRatingDistribution.vue: one stacked bar, then label, percentage and (count) for each rating.
function RatingDistribution({ rows }: { rows: CsatResponse[] }) {
  const total = rows.length;
  const segments = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    ...ratingMeta[rating],
    count: rows.filter((r) => r.rating === rating).length,
  }));
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardDescription>Rating distribution</CardDescription>
        <CardTitle className="font-medium text-3xl tabular-nums leading-none tracking-tight">{total}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {total ? (
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {segments.map((s) =>
              s.count ? (
                <Tooltip key={s.rating}>
                  <TooltipTrigger asChild>
                    <span className={s.bar} style={{ width: `${(s.count / total) * 100}%` }} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {s.label}: {Math.round((s.count / total) * 100)}% ({s.count})
                  </TooltipContent>
                </Tooltip>
              ) : null,
            )}
          </div>
        ) : (
          <div className="h-3 w-full rounded-full bg-muted" />
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((s) => (
            <span key={s.rating} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", s.bar)} />
              <span className="text-muted-foreground text-sm">{s.label}</span>
              <span className="font-medium text-sm tabular-nums">
                {total ? Math.round((s.count / total) * 100) : 0}%
              </span>
              <span className="text-muted-foreground text-xs">({s.count})</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// CsatExpandedRow.vue: review notes, edited in place, then shown with "Updated by".
function ReviewNotes({
  note,
  onSave,
}: {
  note?: { text: string; by: string; at: string };
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = React.useState(!note);
  const [text, setText] = React.useState(note?.text ?? "");
  const [saving, setSaving] = React.useState(false);
  const changed = text.trim() !== (note?.text ?? "");

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Review notes</span>
        {!editing && note ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
        ) : null}
      </div>
      {editing ? (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add review notes about this rating..."
            className="min-h-20 bg-background"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(note?.text ?? "");
                if (note) setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!changed || !text.trim() || saving}
              onClick={() => {
                setSaving(true);
                setTimeout(() => {
                  onSave(text.trim());
                  setSaving(false);
                  setEditing(false);
                  toast.success("Notes saved successfully");
                }, 400);
              }}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </>
      ) : note ? (
        <>
          <p className="whitespace-pre-wrap text-sm">{note.text}</p>
          <span className="text-muted-foreground text-xs">
            Updated by {note.by} {note.at}
          </span>
        </>
      ) : null}
    </div>
  );
}

function PersonCell({ name, size = "size-6" }: { name: string; size?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className={cn(size, "font-medium", personToneClass(name))}>
        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </div>
  );
}

function CsatBody() {
  const period = usePeriod();
  const [filters, setFilters] = React.useState<FilterValues>({});
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState<Record<number, { text: string; by: string; at: string }>>({});

  // The responses are from today and yesterday (the inbox's CSAT messages), so a period without those days is empty.
  const rows = csatResponses.filter((r) => {
    const day = r.time === "Yesterday" ? subDays(TODAY, 1) : TODAY;
    if (day < period.from || day > period.to) return false;
    if (filters.agent && r.agent !== filters.agent) return false;
    if (filters.inbox && r.inbox !== filters.inbox) return false;
    if (filters.team && r.team !== filters.team) return false;
    if (filters.rating && ratingMeta[r.rating].label !== filters.rating) return false;
    return true;
  });
  const summary = csatSummary(rows);
  const pager = usePager(rows, 10);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <ReportHeader
        title="CSAT Reports"
        description="How satisfied customers are after a conversation, from their survey ratings and feedback."
      >
        <DownloadButton label="Download CSAT Reports" />
      </ReportHeader>
      <div className="flex flex-wrap items-center gap-2">
        <ReportDatePicker />
        <FilterBar groups={filterGroups} values={filters} onChange={setFilters} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <KpiCards
          items={[
            {
              label: "Total responses",
              value: String(summary.total),
              icon: MessageSquareHeart,
              tooltip: "Total number of responses collected",
            },
            {
              label: "Satisfaction score",
              value: summary.satisfaction,
              icon: Smile,
              tooltip: "Total number of positive responses / Total number of responses * 100",
            },
            {
              label: "Response rate",
              value: rows.length ? summary.responseRate : "--",
              icon: Percent,
              tooltip: "Total number of responses / Total number of CSAT survey messages sent * 100",
            },
          ]}
        />
        <RatingDistribution rows={rows} />
      </div>
      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Contact</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Feedback comment</TableHead>
                <TableHead>Handled by</TableHead>
                <TableHead className="w-12 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.pageRows.length ? (
                pager.pageRows.map((r) => {
                  const open = expanded === r.id;
                  const meta = ratingMeta[r.rating];
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow
                        className={cn("cursor-pointer", open && "border-b-0 bg-muted/30")}
                        onClick={() => setExpanded(open ? null : r.id)}
                      >
                        <TableCell className="py-3 pl-5">
                          <div className="flex items-center gap-2.5">
                            <Avatar className={cn("size-8 font-medium", personToneClass(r.contact))}>
                              <AvatarFallback className="text-xs">{getInitials(r.contact)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5">
                              <Link
                                onClick={(e) => e.stopPropagation()}
                                href={r.contactId ? `/dashboard/contacts/${r.contactId}` : "/dashboard/contacts"}
                                className="font-medium hover:underline"
                              >
                                {r.contact}
                              </Link>
                              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                <Link
                                onClick={(e) => e.stopPropagation()}
                                  href={`/dashboard/chat?conversation=${r.conversation}`}
                                  className="hover:text-primary hover:underline"
                                  title={r.subject}
                                >
                                  #{r.conversation}
                                </Link>
                                <span>·</span>
                                <span>{r.time}</span>
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-medium text-sm",
                              meta.pill,
                            )}
                          >
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-96 whitespace-normal">
                          {r.feedback ? (
                            <span className="line-clamp-2">{r.feedback}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">No feedback provided</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.agent ? (
                            <PersonCell name={r.agent} />
                          ) : (
                            <span className="text-muted-foreground">No assigned agent</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={open ? "Collapse" : "Expand"}
                            aria-expanded={open}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(open ? null : r.id);
                            }}
                          >
                            {open ? <ChevronUp /> : <ChevronDown />}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={5} className="px-5 pt-0 pb-4">
                            <ReviewNotes
                              note={notes[r.id]}
                              onSave={(text) =>
                                setNotes((n) => ({ ...n, [r.id]: { text, by: "Arham Khan", at: "just now" } }))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })
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
          <TablePager pager={pager} />
        </CardContent>
      </Card>
    </div>
  );
}

// CW CsatResponses.vue.
export function CsatReport() {
  return (
    <TooltipProvider>
      <ReportPeriodProvider showGroupBy={false}>
        <CsatBody />
      </ReportPeriodProvider>
    </TooltipProvider>
  );
}

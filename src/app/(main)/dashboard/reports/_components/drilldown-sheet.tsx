"use client";
// F159: Chatwoot v4.18 ReportDrilldownDrawer + ReportDrilldownCard. Clicking a bar of a report chart opens a side
// panel with the conversations (or messages) behind that bar, Previous bar / Next bar, and Load more.
import * as React from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { addDays, addMinutes, format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, UserRound, UsersRound } from "lucide-react";

import {
  agentName,
  baseConversations,
  inboxOf,
  initialMeta,
  teamName,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import { ChannelIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CeUnavailableNotice } from "@/lib/chatwoot/settings-adapter";
import { getInitials } from "@/lib/utils";

import type { EntityKind, SummaryRow } from "./data";

export interface DrillScope {
  kind: EntityKind;
  row: SummaryRow;
}

export interface DrillPoint {
  label: string;
  long: string;
  start: Date;
  days: number;
  value: number;
  display: string;
}

// A time inside the clicked bar: its first day plus a spread of days and working hours per record.
function recordTime(point: DrillPoint, i: number, salt: number) {
  const day = point.days > 1 ? (i * 3 + salt) % point.days : 0;
  const minutes = 8 * 60 + ((i * 97 + salt * 13) % (13 * 60));
  return format(addMinutes(addDays(point.start, day), minutes), "MMM d, h:mm a");
}

export interface DrillRequest {
  metricKey: string;
  metricName: string;
  isAverage: boolean;
  points: DrillPoint[];
  index: number;
}

const MESSAGE_METRICS = ["incoming", "outgoing"];
const PAGE = 8;

function conversationPool(scope?: DrillScope) {
  if (!scope) return baseConversations;
  const { kind, row } = scope;
  const list = baseConversations.filter((c) => {
    const meta = initialMeta[c.id];
    if (kind === "agents") return meta?.assigneeId === Number(row.id);
    if (kind === "teams") return teamName(meta?.teamId) === row.name;
    if (kind === "inboxes") return inboxOf(c).channelType === row.subtitle || inboxOf(c).name === row.name;
    return true;
  });
  return list.length ? list : baseConversations;
}

function rotate<T>(list: T[], by: number) {
  if (!list.length) return list;
  const n = ((by % list.length) + list.length) % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}

function minutesText(m: number) {
  if (m >= 60) return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  return `${Math.max(1, Math.round(m))}m`;
}

export function DrilldownSheet({
  request,
  onNavigate,
  onClose,
  scope,
}: {
  request: DrillRequest | null;
  onNavigate: (index: number) => void;
  onClose: () => void;
  scope?: DrillScope;
}) {
  const router = useRouter();
  const [shown, setShown] = React.useState(PAGE);
  const point = request ? request.points[request.index] : null;
  const isMessage = request ? MESSAGE_METRICS.includes(request.metricKey) : false;

  React.useEffect(() => {
    setShown(PAGE);
  }, [request?.index, request?.metricKey]);

  const findIndex = (start: number, step: number) => {
    if (!request) return null;
    for (let i = start; i >= 0 && i < request.points.length; i += step) {
      if (request.points[i].value > 0) return i;
    }
    return null;
  };
  const prev = request ? findIndex(request.index - 1, -1) : null;
  const next = request ? findIndex(request.index + 1, 1) : null;

  const pool = rotate(conversationPool(scope), (request?.index ?? 0) * 3 + (request?.metricKey.length ?? 0));
  const total = point ? Math.round(point.value) : 0;
  const recordCount = request?.isAverage ? Math.min(pool.length, Math.max(1, Math.round(total / 2) || 6)) : total;
  const records = pool.slice(0, Math.min(shown, recordCount, pool.length));
  const hasMore = records.length < Math.min(recordCount, pool.length);
  const countLabel = isMessage
    ? `${recordCount.toLocaleString("en-US")} ${recordCount === 1 ? "message" : "messages"}`
    : `${recordCount.toLocaleString("en-US")} ${recordCount === 1 ? "conversation" : "conversations"}`;

  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl" showCloseButton>
        <SheetHeader className="border-b pr-28">
          <SheetTitle className="truncate">{request ? `${request.metricName} details` : ""}</SheetTitle>
          {point?.display ? <p className="font-semibold text-xl tabular-nums">{point.display}</p> : null}
          <SheetDescription>{point ? `${point.long} · ${countLabel}` : ""}</SheetDescription>
          <div className="absolute top-3 right-12 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous bar"
                  disabled={prev === null}
                  onClick={() => prev !== null && onNavigate(prev)}
                >
                  <ChevronLeft />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous bar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next bar"
                  disabled={next === null}
                  onClick={() => next !== null && onNavigate(next)}
                >
                  <ChevronRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next bar</TooltipContent>
            </Tooltip>
          </div>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {request ? (
            <CeUnavailableNotice
              area="reporting_events"
              title="Granular reporting events (/reporting_events) are unavailable in Chatwoot Community Edition (501)"
            />
          ) : null}
          {!records.length ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
              No records found for this bar.
            </div>
          ) : (
            records.map((c, i) => {
              const meta = initialMeta[c.id];
              const agent = agentName(meta?.assigneeId);
              const team = teamName(meta?.teamId);
              const inbox = inboxOf(c);
              const incoming = request?.metricKey === "incoming" || (isMessage ? false : i % 2 === 0);
              const msg = isMessage
                ? (c.messages.filter((m) =>
                    request?.metricKey === "incoming" ? m.align === "start" : m.align === "end",
                  )[0] ?? c.messages[0])
                : null;
              const perValue = request?.isAverage
                ? minutesText((point?.value ?? 5) * (0.5 + ((i * 37) % 10) / 10))
                : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => router.push(`/dashboard/chat?conversation=${c.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-sm">
                      <span>#{c.id}</span>
                      {meta?.status ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs capitalize">
                          {meta.status}
                        </span>
                      ) : null}
                      {isMessage ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex size-5 items-center justify-center rounded bg-muted text-muted-foreground">
                              {incoming ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{incoming ? "Incoming message" : "Outgoing message"}</TooltipContent>
                        </Tooltip>
                      ) : null}
                      {perValue ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">{perValue}</span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {point ? recordTime(point, i, c.id) : c.time}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm">{msg?.text || c.subject || c.preview || "No message content"}</p>
                  <div className="grid grid-cols-3 gap-2 text-muted-foreground text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Avatar className={cn("size-4 font-medium", personToneClass(c.name))}>
                        <AvatarFallback className="text-[8px]">{getInitials(c.name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{c.name || "Unknown contact"}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ChannelIcon channel={c.channel} className="size-3" />
                      <span className="truncate">{inbox?.name ?? "Unknown inbox"}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {team && scope?.kind === "teams" ? (
                        <UsersRound className="size-3 shrink-0" />
                      ) : (
                        <UserRound className="size-3 shrink-0" />
                      )}
                      <span className="truncate">{agent ?? "Unassigned"}</span>
                    </span>
                  </div>
                </button>
              );
            })
          )}
          {hasMore ? (
            <Button variant="secondary" size="sm" className="mx-auto mt-2" onClick={() => setShown((s) => s + PAGE)}>
              Load more
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

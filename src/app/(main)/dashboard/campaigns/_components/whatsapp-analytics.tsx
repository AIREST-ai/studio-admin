"use client";
// Chatwoot v4.18 WhatsAppCampaignAnalyticsPage.vue + CampaignAnalyticsPage/* in the Studio detail pattern:
// breadcrumb + big title, metric cards on top (default/_components/metric-cards.tsx look), breakdown, then
// status tabs with counts and the deliveries table inside a card.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  BookOpenCheck,
  CircleSlash,
  Clock,
  Info,
  LoaderCircle,
  MailCheck,
  MessageSquareText,
  MoreHorizontal,
  Send,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { useContactsStore } from "../../contacts/_components/contacts-store";
import { PageHeading, personToneClass } from "../../contacts/_components/studio-ui";
import { analyticsState, type DeliveryStatus, deliveriesFor, metricsFor } from "./data";
import { useCampaignList } from "./store";

const PAGE_SIZE = 25;

const statusLabel: Record<DeliveryStatus, string> = {
  queued: "Queued",
  sent: "Awaiting delivery update",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  skipped: "Skipped",
};

const statusTone: Record<DeliveryStatus, { badge: string; dot: string }> = {
  queued: { badge: "border-border bg-muted/50 text-muted-foreground", dot: "bg-muted-foreground" },
  sent: { badge: "border-border bg-muted/50 text-muted-foreground", dot: "bg-muted-foreground" },
  delivered: { badge: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400", dot: "bg-teal-500" },
  read: { badge: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
  failed: { badge: "border-destructive/20 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  skipped: { badge: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
};

const filters = ["all", "sent", "delivered", "read", "failed", "skipped"] as const;
type Filter = (typeof filters)[number];

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const tone = statusTone[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border px-2 py-1 font-medium", tone.badge)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {statusLabel[status]}
    </Badge>
  );
}

function CampaignCrumbs({ title }: { title: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard/campaigns">Campaigns</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard/campaigns/whatsapp">WhatsApp</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function pageWindow(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set([0, count - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < count));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function WhatsAppCampaignAnalytics({ id }: { id: number }) {
  const [campaigns] = useCampaignList("whatsapp");
  const contactBook = useContactsStore((s) => s.list);
  const campaign = campaigns.find((c) => c.id === id);
  const state = analyticsState(id, campaign?.status);
  const m = metricsFor(id);
  const all = deliveriesFor(id, contactBook);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [page, setPage] = React.useState(0);

  const title = campaign?.title ?? `Campaign #${id}`;
  const rows = filter === "all" ? all : all.filter((d) => d.status === filter);
  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const countFor = (f: Filter) => (f === "all" ? all.length : all.filter((d) => d.status === f).length);
  const rate = (value: number) => (m.audience ? `${Math.round((value / m.audience) * 100)}% of audience` : "");

  const header = (
    <div className="flex flex-col gap-3">
      <CampaignCrumbs title={title} />
      <PageHeading
        title={title}
        subtitle={
          campaign ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <MessageSquareText className="size-3.5" />
                {campaign.inbox}
              </span>
              <span className="h-3 w-px bg-border" />
              <span>Sent on {campaign.scheduledAt}</span>
              {campaign.template ? (
                <>
                  <span className="h-3 w-px bg-border" />
                  <span className="font-mono text-xs">{campaign.template}</span>
                </>
              ) : null}
            </span>
          ) : (
            "This campaign could not be found."
          )
        }
      />
    </div>
  );

  if (state !== "ready") {
    const pending = state === "pending";
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card>
          <CardContent>
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">{pending ? <Clock /> : <CircleSlash />}</EmptyMedia>
                <EmptyTitle>
                  {pending
                    ? "Delivery data will appear once sending begins"
                    : "Analytics aren't available for this campaign"}
                </EmptyTitle>
                <EmptyDescription>
                  {pending
                    ? "There are no delivery records for this campaign yet."
                    : "No delivery data was recorded for this campaign. This can happen for campaigns sent before campaign analytics were introduced."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/campaigns/whatsapp">Back to WhatsApp campaigns</Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metricCards = [
    { key: "audience", label: "Audience", hint: "Contacts included in this campaign.", value: m.audience, icon: Users },
    {
      key: "sent",
      label: "Submitted to WhatsApp",
      hint: "Messages accepted by WhatsApp for delivery.",
      value: m.sent,
      icon: Send,
    },
    {
      key: "delivered",
      label: "Delivered",
      hint: "Messages that reached the contact's device. Read messages are included.",
      value: m.delivered,
      icon: MailCheck,
    },
    { key: "read", label: "Read", hint: "Messages opened by the contact.", value: m.read, icon: BookOpenCheck },
    {
      key: "failed",
      label: "Failed",
      hint: "Messages WhatsApp could not deliver.",
      value: m.failed,
      icon: TriangleAlert,
    },
    {
      key: "skipped",
      label: "Skipped",
      hint: "Contacts skipped before sending, usually because of a missing or invalid phone number.",
      value: m.skipped,
      icon: CircleSlash,
    },
  ];

  const segments = [
    { key: "read", label: "Read", value: m.read, dot: "bg-indigo-500" },
    { key: "delivered", label: "Delivered", value: m.delivered - m.read, dot: "bg-teal-500" },
    { key: "failed", label: "Failed", value: m.failed, dot: "bg-rose-500" },
    { key: "skipped", label: "Skipped", value: m.skipped, dot: "bg-amber-500" },
    { key: "pending", label: "Queued or awaiting update", value: m.queued + m.awaiting, dot: "bg-muted-foreground/30" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {header}

      {campaign?.status === "running" ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 text-sm dark:text-amber-300">
          <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
          <span>
            This campaign is still running. {m.queued} messages are queued, and {m.awaiting} are awaiting a delivery
            update from WhatsApp.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 dark:*:data-[slot=card]:bg-card">
        {metricCards.map((metric) => (
          <Card key={metric.key}>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <metric.icon className="size-4" />
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                {metric.label}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 cursor-help" aria-label={metric.hint} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">{metric.hint}</TooltipContent>
                </Tooltip>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
                {metric.value.toLocaleString()}
              </div>
              <p className="text-muted-foreground text-sm tabular-nums">
                {metric.key === "audience" ? "Contacts included in this campaign." : rate(metric.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl leading-none">Delivery breakdown</CardTitle>
          <span className="text-muted-foreground text-sm tabular-nums">
            {Math.round((m.delivered / m.audience) * 100)}% delivered
          </span>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
            {segments.map((s) => (
              <div key={s.key} className={s.dot} style={{ width: `${(s.value / m.audience) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 rounded-full", s.dot)} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium tabular-nums">{s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4">
          <div className="grid gap-1.5">
            <CardTitle className="text-xl leading-none">Deliveries</CardTitle>
            <CardDescription>Every contact of the audience with the status WhatsApp reported.</CardDescription>
          </div>
          <Tabs
            value={filter}
            onValueChange={(value) => {
              setFilter(value as Filter);
              setPage(0);
            }}
          >
            <TabsList
              variant="line"
              className="w-full flex-wrap justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
            >
              {filters.map((f) => (
                <TabsTrigger key={f} value={f}>
                  {f === "all" ? "All" : statusLabel[f]}
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {countFor(f).toLocaleString()}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-0">
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="py-4 font-normal">Contact</TableHead>
                <TableHead className="py-4 font-normal">Status</TableHead>
                <TableHead className="py-4 font-normal">Message</TableHead>
                <TableHead className="py-4 font-normal">Reason</TableHead>
                <TableHead className="sticky right-0 bg-card py-4 font-normal">
                  <div className="text-right">Actions</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? (
                pageRows.map((d) => (
                  <TableRow key={d.id} className="border-border/60 hover:bg-white/2.5">
                    <TableCell className="py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <Avatar className={cn("font-medium", personToneClass(d.name))}>
                          <AvatarFallback>{getInitials(d.name)}</AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          {d.contactId ? (
                            <Link
                              href={`/dashboard/contacts/${d.contactId}`}
                              target="_blank"
                              className="whitespace-nowrap font-medium text-sm hover:underline"
                            >
                              {d.name}
                            </Link>
                          ) : (
                            <span className="whitespace-nowrap font-medium text-sm">{d.name}</span>
                          )}
                          <span className="text-muted-foreground text-xs tabular-nums">{d.phone || "---"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">
                      <DeliveryBadge status={d.status} />
                    </TableCell>
                    <TableCell className="max-w-80 align-middle">
                      {d.message ? (
                        <span className="line-clamp-1 whitespace-normal text-muted-foreground text-sm" dir="auto">
                          {d.message}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      {d.reason ? (
                        <div className="grid gap-0.5">
                          <span className="text-sm">{d.reason}</span>
                          {d.code ? (
                            <span className="font-mono text-muted-foreground text-xs">Code {d.code}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">---</span>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card align-middle">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={`Open actions for ${d.name}`}
                              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                              size="icon-sm"
                              variant="ghost"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {d.contactId ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/contacts/${d.contactId}`} target="_blank">
                                  View details
                                </Link>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled>Not in your contacts</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {filter === "all"
                      ? "No delivery records found."
                      : `No ${statusLabel[filter].toLowerCase()} delivery records found.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rows.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 pt-4">
              <span className="text-muted-foreground text-sm tabular-nums">
                Showing {(current * PAGE_SIZE + 1).toLocaleString()} -{" "}
                {Math.min(rows.length, (current + 1) * PAGE_SIZE).toLocaleString()} of {rows.length.toLocaleString()}{" "}
                {rows.length === 1 ? "contact" : "contacts"}
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
                  {pageWindow(current, pageCount).map((p, i) =>
                    p === "gap" ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity
                      <PaginationItem key={`gap-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={p === current}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                        >
                          {p + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
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

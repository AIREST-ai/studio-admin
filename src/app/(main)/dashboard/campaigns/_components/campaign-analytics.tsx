"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { Info, LoaderCircle, MessageSquareText } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { analyticsMetrics, type DeliveryStatus, deliveries, toneFor, whatsappCampaigns } from "./data";

const m = analyticsMetrics;

const metricCards = [
  { key: "audience", label: "Audience", hint: "Contacts included in this campaign.", value: m.audience },
  { key: "sent", label: "Submitted to WhatsApp", hint: "Messages accepted by WhatsApp for delivery.", value: m.sent },
  {
    key: "delivered",
    label: "Delivered",
    hint: "Messages that reached the contact's device. Read messages are included.",
    value: m.delivered,
  },
  { key: "read", label: "Read", hint: "Messages opened by the contact.", value: m.read },
  { key: "failed", label: "Failed", hint: "Messages WhatsApp could not deliver.", value: m.failed },
  {
    key: "skipped",
    label: "Skipped",
    hint: "Contacts skipped before sending, usually because of a missing or invalid phone number.",
    value: m.skipped,
  },
];

const statusLabel: Record<DeliveryStatus, string> = {
  queued: "Queued",
  sent: "Awaiting delivery update",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  skipped: "Skipped",
};

const statusClass: Record<DeliveryStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-muted text-muted-foreground",
  delivered: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  read: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  skipped: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const statusCounts: Record<string, number> = {
  all: m.audience,
  sent: m.audience - m.delivered - m.failed - m.skipped - m.queued,
  delivered: m.delivered - m.read,
  read: m.read,
  failed: m.failed,
  skipped: m.skipped,
};

const filters = ["all", "sent", "delivered", "read", "failed", "skipped"] as const;

function Breakdown() {
  const read = m.read;
  const delivered = m.delivered - m.read;
  const pending = m.audience - read - delivered - m.failed - m.skipped;
  const segments = [
    { key: "read", label: "Read", value: read, dot: "bg-indigo-500" },
    { key: "delivered", label: "Delivered", value: delivered, dot: "bg-teal-500" },
    { key: "failed", label: "Failed", value: m.failed, dot: "bg-rose-500" },
    { key: "skipped", label: "Skipped", value: m.skipped, dot: "bg-amber-500" },
    { key: "pending", label: "Queued or awaiting update", value: pending, dot: "bg-muted-foreground/30" },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Delivery breakdown</CardTitle>
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
  );
}

export function CampaignAnalytics({ id }: { id: number }) {
  const campaign = whatsappCampaigns.find((c) => c.id === id) ?? whatsappCampaigns[0];
  const [filter, setFilter] = React.useState<string>("all");
  const rows = filter === "all" ? deliveries : deliveries.filter((d) => d.status === filter);
  const processing = campaign.status === "processing";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3">
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
              <BreadcrumbPage>{campaign.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <MessageSquareText className="size-3.5" />
            {campaign.inbox}
          </span>
          <span className="h-3 w-px bg-border" />
          <span>Sent on {campaign.scheduledAt}</span>
        </div>
      </div>

      {processing ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
          <span>
            This campaign is still processing. {m.queued} messages are queued, and {statusCounts.sent} are awaiting a
            delivery update from WhatsApp.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((metric) => (
          <div key={metric.key} className="grid gap-2 bg-card p-5">
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              {metric.label}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-60">{metric.hint}</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-2xl tabular-nums">{metric.value.toLocaleString()}</span>
              {metric.key !== "audience" ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {Math.round((metric.value / m.audience) * 100)}% of audience
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Breakdown />

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Deliveries</CardTitle>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList variant="line" className="flex-wrap">
              {filters.map((f) => (
                <TabsTrigger key={f} value={f}>
                  {f === "all" ? "All" : statusLabel[f]}
                  <span className="text-muted-foreground tabular-nums">{statusCounts[f].toLocaleString()}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-0">
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader className="[&_tr]:border-t">
              <TableRow>
                <TableHead className="font-normal">Contact</TableHead>
                <TableHead className="font-normal">Status</TableHead>
                <TableHead className="font-normal">Message</TableHead>
                <TableHead className="font-normal">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((d) => (
                  <TableRow key={d.id} className="border-border/60">
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-7">
                          <AvatarFallback className={cn("text-[10px]", toneFor(d.id))}>
                            {getInitials(d.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">{d.phone || "---"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-md px-2 font-medium text-xs",
                          statusClass[d.status],
                        )}
                      >
                        {statusLabel[d.status]}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-80">
                      {d.message ? (
                        <span className="line-clamp-1 whitespace-normal text-muted-foreground">{d.message}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.reason ?? "---"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {filter === "all"
                      ? "No delivery records found."
                      : `No ${statusLabel[filter as DeliveryStatus].toLowerCase()} delivery records found.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="border-t px-6 pt-4 text-muted-foreground text-sm tabular-nums">
            Showing 1 - {rows.length} of {statusCounts[filter].toLocaleString()} contacts
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

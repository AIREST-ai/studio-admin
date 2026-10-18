"use client";

// M129-C (Fahad 129.3): the report of a campaign made with the composer: status (Draft, Scheduled, Running, Completed,
// Failed), the numbers respond.io and WATI report (sent, delivered, read, replied, failed, skipped), each row's
// outcome with Meta's error code, "Retry failed" and the status history. The numbers are simulated and say so.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  BookOpenCheck,
  CircleSlash,
  MailCheck,
  MessageSquareReply,
  RotateCcw,
  Send,
  TriangleAlert,
  Users,
} from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimBadge } from "@/lib/cw/preview-sim-ui";

import { PageHeading } from "../../contacts/_components/studio-ui";
import { type DeliveryOutcome, metricsAt, pendingKeys } from "./broadcast";
import { retryFailed, SIMULATED_SEND, sendNow, useCampaignClock } from "./campaign-runtime";
import { CHANNELS } from "./channels";
import { CampaignStatusBadge } from "./status-badge";
import { allOneOff, useCampaignsReady, useCampaignsStore } from "./store";

const outcomeLabel: Record<DeliveryOutcome | "queued", string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  replied: "Replied",
  failed: "Failed",
  skipped: "Skipped",
};
const outcomeTone: Record<DeliveryOutcome | "queued", string> = {
  queued: "border-border bg-muted/50 text-muted-foreground",
  sent: "border-border bg-muted/50 text-muted-foreground",
  delivered: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  read: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  replied: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  failed: "border-destructive/20 bg-destructive/10 text-destructive",
  skipped: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

type Filter = "all" | DeliveryOutcome | "queued";

export function CampaignReport({ id }: { id: number }) {
  useCampaignClock();
  const ready = useCampaignsReady();
  const state = useCampaignsStore();
  const entry = allOneOff(state).find((e) => e.campaign.id === id);
  const [now, setNow] = React.useState(() => Date.now());
  const [filter, setFilter] = React.useState<Filter>("all");
  const running = entry?.campaign.status === "running";
  React.useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [running]);
  React.useEffect(() => {
    if (!running) setNow(Date.now());
  }, [running]);

  if (!ready) return <PageHeading title="Loading report…" subtitle="Reading the campaigns saved in the preview." />;
  if (!entry) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Campaign not found" subtitle="It may have been deleted." />
        <Button variant="outline" size="sm" className="w-fit" asChild>
          <Link href="/dashboard/campaigns/whatsapp">Back to campaigns</Link>
        </Button>
      </div>
    );
  }
  const { list, campaign } = entry;
  const channel = CHANNELS[list];
  const run = campaign.run;
  const m = run ? metricsAt(run, now) : null;
  const pending = run ? pendingKeys(run, now) : new Set<string>();
  const rows = run?.results ?? [];
  const statusOf = (key: string, status: DeliveryOutcome) => (pending.has(key) ? "queued" : status);
  const shown = filter === "all" ? rows : rows.filter((r) => statusOf(r.key, r.status) === filter);
  const failedNow = rows.filter((r) => r.status === "failed").length;
  const progress =
    run && running
      ? Math.round(
          ((rows.filter((r) => r.status !== "skipped" && r.attempts === run.attempt).length - pending.size) /
            Math.max(1, rows.filter((r) => r.status !== "skipped" && r.attempts === run.attempt).length)) *
            100,
        )
      : 100;
  const pct = (value: number) => (m && m.audience ? `${Math.round((value / m.audience) * 100)}% of audience` : "");

  const cards = m
    ? [
        {
          key: "audience",
          label: "Audience",
          value: m.audience,
          icon: Users,
          hint: "Matched contacts, skipped ones included",
        },
        { key: "sent", label: "Sent", value: m.sent, icon: Send, hint: pct(m.sent) },
        { key: "delivered", label: "Delivered", value: m.delivered, icon: MailCheck, hint: pct(m.delivered) },
        ...(list === "sms"
          ? []
          : [{ key: "read", label: "Read", value: m.read, icon: BookOpenCheck, hint: pct(m.read) }]),
        { key: "replied", label: "Replied", value: m.replied, icon: MessageSquareReply, hint: pct(m.replied) },
        { key: "failed", label: "Failed", value: m.failed, icon: TriangleAlert, hint: pct(m.failed) },
        {
          key: "skipped",
          label: "Skipped",
          value: m.skipped,
          icon: CircleSlash,
          hint: "Not sent: see the reason per row",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4" data-campaign-report={campaign.id}>
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
              <Link href={channel.href}>{channel.label}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{campaign.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading
          title={
            <span className="flex flex-wrap items-center gap-3">
              {campaign.title}
              <CampaignStatusBadge status={campaign.status} />
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                {channel.label} · {campaign.inbox}
              </span>
              {campaign.template ? <span className="font-mono text-xs">{campaign.template}</span> : null}
              <span>
                {campaign.status === "scheduled"
                  ? `Scheduled: ${campaign.scheduledAt}`
                  : `Started: ${campaign.scheduledAt}`}
              </span>
            </span>
          }
        />
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" || campaign.status === "scheduled" ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/campaigns/new?id=${campaign.id}`}>Edit</Link>
              </Button>
              <Button size="sm" onClick={() => sendNow(list, campaign.id)}>
                <Send /> Send now
              </Button>
            </>
          ) : null}
          {(campaign.status === "completed" || campaign.status === "failed") && failedNow > 0 ? (
            <Button size="sm" onClick={() => retryFailed(list, campaign.id)} data-retry-failed="">
              <RotateCcw /> Retry failed ({failedNow})
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 border-dashed bg-amber-500/5 px-3 py-2 text-sm"
        data-sim-numbers=""
      >
        <SimBadge label="Simulated numbers" />
        <span className="text-muted-foreground">{SIMULATED_SEND}</span>
      </div>

      {run?.failure ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {run.failure}
        </div>
      ) : null}

      {running && run ? (
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-base">
              Sending{run.attempt > 1 ? ` (retry ${run.attempt - 1})` : ""}… {progress}%
            </CardTitle>
            <CardDescription>{m?.queued ?? 0} messages queued.</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} />
          </CardContent>
        </Card>
      ) : null}

      {m ? (
        <div
          className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-(--metric-cols)"
          style={{ "--metric-cols": `repeat(${cards.length}, minmax(0, 1fr))` } as React.CSSProperties}
          data-report-metrics=""
        >
          {cards.map((c) => (
            <Card key={c.key} className="gap-2 py-4" data-metric={c.key}>
              <CardHeader className="px-4">
                <CardDescription className="flex items-center gap-1.5">
                  <c.icon className="size-3.5" /> {c.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-0.5 px-4">
                <span className="font-medium text-2xl tabular-nums" data-metric-value="">
                  {c.value.toLocaleString()}
                </span>
                <span className="text-muted-foreground text-xs">{c.hint}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            {campaign.status === "draft"
              ? "This campaign is a draft: nothing has been sent."
              : "Nothing has been sent yet. The report fills in when sending starts."}
          </CardContent>
        </Card>
      )}

      {run && rows.length ? (
        <Card>
          <CardHeader className="gap-3">
            <div className="grid gap-1">
              <CardTitle className="text-xl leading-none">Recipients</CardTitle>
              <CardDescription>
                Each contact's outcome. Failed rows show Meta's error code where the channel has one.
              </CardDescription>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList
                variant="line"
                className="w-full flex-wrap justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
              >
                {(["all", "queued", "delivered", "read", "replied", "failed", "skipped"] as Filter[])
                  .filter((f) => !(list === "sms" && f === "read"))
                  .map((f) => (
                    <TabsTrigger key={f} value={f}>
                      {f === "all" ? "All" : outcomeLabel[f]}
                      <Badge variant="secondary" className="ms-1 tabular-nums">
                        {f === "all" ? rows.length : rows.filter((r) => statusOf(r.key, r.status) === f).length}
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
                  <TableHead className="font-normal">Contact</TableHead>
                  <TableHead className="font-normal">Status</TableHead>
                  <TableHead className="font-normal">Message</TableHead>
                  <TableHead className="font-normal">Reason</TableHead>
                  <TableHead className="text-right font-normal">Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.slice(0, 200).map((r) => {
                  const status = statusOf(r.key, r.status);
                  return (
                    <TableRow key={r.key} data-recipient-status={status}>
                      <TableCell className="py-3">
                        <div className="grid gap-0.5">
                          {r.contactId ? (
                            <Link
                              href={`/dashboard/contacts/${r.contactId}`}
                              className="font-medium text-sm hover:underline"
                            >
                              {r.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-sm">{r.name}</span>
                          )}
                          <span className="text-muted-foreground text-xs tabular-nums" dir="ltr">
                            {r.address || "---"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("gap-1.5 border px-2 py-1 font-medium", outcomeTone[status])}
                        >
                          {outcomeLabel[status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <span className="line-clamp-1 whitespace-normal text-muted-foreground text-sm" dir="auto">
                          {status === "skipped" ? "Not generated" : (r.message ?? campaign.message)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.reason && status !== "queued" ? (
                          <span className="grid gap-0.5">
                            {r.reason}
                            {r.code ? (
                              <span className="font-mono text-muted-foreground text-xs">Code {r.code}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.attempts}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {shown.length > 200 ? (
              <p className="px-4 pt-3 text-muted-foreground text-xs">Showing the first 200 of {shown.length}.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {campaign.history?.length ? (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Status history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-1.5 text-sm" data-history="">
              {campaign.history.map((h, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: history lines only grow
                <li key={i} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(h.at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

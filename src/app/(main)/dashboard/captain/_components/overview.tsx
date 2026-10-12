"use client";
// Chatwoot: components-next/captain/pageComponents/overview/v2 (OverviewV2, OverviewSummaryCard, ResolutionFlowCard,
// ResolutionTrendCard, CsatCard, UsageCard, KnowledgeCoverageCard, RangeSelector, InboxBanner, CoverageBanner,
// AssistantDrilldownDrawer). Studio: heading outside, stat cards on top (default/_components/metric-cards.tsx).
import * as React from "react";

import Link from "next/link";

import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Hourglass,
  Info,
  MessagesSquare,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  TrendingDown,
  TrendingUp,
  Unplug,
  UserRoundCheck,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { handoffReasons, trend } from "./data";
import { CaptainShell, ChipSelect, useCurrentAssistant } from "./shared";

const summaryPoints = [
  "Captain handled 1,360 conversations this week and resolved 71% of them on its own.",
  "Most handoffs came from billing disputes. Adding the refund policy as a document could lower them.",
  "4 FAQ suggestions are ready. They come from 90 recent conversations about payments and Ramadan speeds.",
];

const rangeOptions = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_30", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

interface Metric {
  metricId: string;
  label: string;
  value: string;
  change: string;
  up: boolean;
  support: string;
  hint: string;
  note?: string;
  total: number;
  icon: typeof MessagesSquare;
}

const metrics: Metric[] = [
  {
    metricId: "hours_saved",
    label: "Saved in agent effort and time",
    value: "41h",
    change: "+6h",
    up: true,
    support: "1,230 public Captain replies",
    hint: "An estimate of how much agent reply time Captain saved.",
    note: "Based on two minutes saved for each public Captain reply.",
    total: 1230,
    icon: Hourglass,
  },
  {
    metricId: "durable_resolution_rate",
    label: "Captain resolutions remained closed",
    value: "93%",
    change: "+1 pt",
    up: true,
    support: "903 of 971",
    hint: "The share of Captain-resolved conversations that were still closed seven days later.",
    note: "Only resolutions old enough to observe for seven days are included.",
    total: 903,
    icon: ShieldCheck,
  },
  {
    metricId: "conversations_handled",
    label: "Conversations handled",
    value: "1,360",
    change: "+12%",
    up: true,
    support: "vs 1,214 in the previous period",
    hint: "Conversations where Captain replied to the customer or handed the conversation to your team.",
    total: 1360,
    icon: MessagesSquare,
  },
  {
    metricId: "auto_resolution_rate",
    label: "Auto-resolution rate",
    value: "71.4%",
    change: "+3.2 pts",
    up: true,
    support: "971 of 1,360",
    hint: "The share of handled conversations Captain resolved without help from your team. Higher means Captain resolved more on its own.",
    total: 971,
    icon: CheckCheck,
  },
  {
    metricId: "handoff_rate",
    label: "Handoff rate",
    value: "22.8%",
    change: "-1.9 pts",
    up: false,
    support: "310 of 1,360",
    hint: "The share of handled conversations Captain passed to your team. Lower means fewer conversations needed an agent.",
    total: 310,
    icon: UserRoundCheck,
  },
  {
    metricId: "conversation_depth",
    label: "Messages per conversation",
    value: "2.4",
    change: "-0.3",
    up: false,
    support: "Captain replies on average",
    hint: "The average number of replies Captain sent in each conversation it handled.",
    note: "A lower number can mean quicker answers, but complex questions may need more replies.",
    total: 1360,
    icon: MessagesSquare,
  },
  {
    metricId: "reopen_rate",
    label: "Reopen rate",
    value: "7%",
    change: "-1 pt",
    up: false,
    support: "68 of 971",
    hint: "The share of Captain-resolved conversations that customers returned to later.",
    note: "Lower means more resolutions stayed resolved.",
    total: 68,
    icon: Repeat,
  },
  {
    metricId: "median_resolution_seconds",
    label: "Median resolution time",
    value: "4 min",
    change: "-40s",
    up: false,
    support: "From reaching Captain to resolved",
    hint: "The typical time from when a conversation reached Captain until it was resolved.",
    note: "Lower means customers generally got resolved sooner.",
    total: 971,
    icon: Clock,
  },
];

const drilldownRows = [
  {
    id: 4921,
    name: "Maryam Al-Kuwari",
    inbox: "WhatsApp Support",
    text: "Paid my October bill twice by mistake",
    time: "12 min ago",
  },
  {
    id: 4918,
    name: "Khalid Al-Mansoori",
    inbox: "Website chat",
    text: "Which roaming pack works in Riyadh?",
    time: "34 min ago",
  },
  {
    id: 4907,
    name: "Fatima Al-Suwaidi",
    inbox: "WhatsApp Support",
    text: "Discount for families with many lines",
    time: "1 h ago",
  },
  {
    id: 4899,
    name: "Sarah Mitchell",
    inbox: "Customer Care Email",
    text: "Moving to Al Wakrah next month",
    time: "2 h ago",
  },
  {
    id: 4890,
    name: "Hamad Al-Marri",
    inbox: "Website chat",
    text: "Router light is red since morning",
    time: "3 h ago",
  },
  {
    id: 4884,
    name: "Noura Al-Thani",
    inbox: "WhatsApp Support",
    text: "Add beIN Sports to my TV plan",
    time: "4 h ago",
  },
  { id: 4871, name: "Omar Al-Shehhi", inbox: "Website chat", text: "Pause my plan for the summer", time: "5 h ago" },
  { id: 4866, name: "Reem Al-Otaibi", inbox: "Customer Care Email", text: "E-invoice not received", time: "6 h ago" },
];

const flowColumns = [
  [{ label: "Handled", value: 1360, dot: "bg-chart-2" }],
  [
    { label: "Resolved by Captain", value: 971, dot: "bg-chart-1" },
    { label: "Handed off", value: 310, dot: "bg-sky-500" },
    { label: "Other reasons", value: 79, dot: "bg-muted-foreground" },
  ],
  [
    { label: "Stayed closed", value: 903, dot: "bg-emerald-500" },
    { label: "Reopened in 7d", value: 68, dot: "bg-amber-500" },
    { label: "Closed with team", value: 280, dot: "bg-violet-500" },
  ],
];

const rateTrend = [
  { day: "Mon", current: 66, previous: 61 },
  { day: "Tue", current: 68, previous: 63 },
  { day: "Wed", current: 72, previous: 65 },
  { day: "Thu", current: 69, previous: 66 },
  { day: "Fri", current: 71, previous: 64 },
  { day: "Sat", current: 74, previous: 67 },
  { day: "Sun", current: 74, previous: 68 },
];

const chartConfig = {
  handled: { label: "Handled", color: "var(--chart-2)" },
  resolved: { label: "Resolved by Captain", color: "var(--chart-1)" },
} satisfies ChartConfig;

const rateConfig = {
  current: { label: "Current period", color: "var(--chart-1)" },
  previous: { label: "Previous period", color: "var(--chart-3)" },
} satisfies ChartConfig;

function Hint({ text, note }: { text: string; note?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="size-3.5 shrink-0 cursor-help text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p>{text}</p>
        {note && <p className="mt-1 opacity-80">{note}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function DrilldownSheet({ metric, onClose }: { metric: Metric | null; onClose: () => void }) {
  const [count, setCount] = React.useState(5);
  return (
    <Sheet open={metric !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        {metric && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{metric.label}</SheetTitle>
              <SheetDescription>{metric.total.toLocaleString()} conversations</SheetDescription>
            </SheetHeader>
            <div className="grid flex-1 content-start gap-2 overflow-y-auto p-4">
              {drilldownRows.slice(0, count).map((r) => (
                <Link
                  key={r.id}
                  href="/dashboard/chat"
                  className="grid gap-1 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground text-xs">
                      #{r.id} · {r.time}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{r.text}</span>
                  <span className="text-muted-foreground text-xs">{r.inbox}</span>
                </Link>
              ))}
              {count < drilldownRows.length && (
                <Button variant="outline" size="sm" onClick={() => setCount(drilldownRows.length)}>
                  Load more
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function CaptainOverview() {
  const assistant = useCurrentAssistant();
  const [point, setPoint] = React.useState(0);
  const [coverageBanner, setCoverageBanner] = React.useState(true);
  const [inboxBanner, setInboxBanner] = React.useState(true);
  const [range, setRange] = React.useState("this_week");
  const [drill, setDrill] = React.useState<Metric | null>(null);
  const [trendView, setTrendView] = React.useState("count");
  const [aligned, setAligned] = React.useState(true);
  const totalReasons = handoffReasons.reduce((s, r) => s + r.value, 0);

  return (
    <CaptainShell
      title="Overview"
      subtitle="How Captain is doing for your customers: conversations handled, resolutions, handoffs and knowledge coverage."
      actions={<ChipSelect label="Range" value={range} options={rangeOptions} onChange={setRange} align="end" />}
    >
      {assistant.inboxes === 0 && inboxBanner && (
        <Alert className="flex items-center gap-3 border-amber-500/30 bg-amber-500/5">
          <Unplug className="size-4 text-amber-600" />
          <AlertDescription className="flex-1 text-foreground">
            This assistant isn&apos;t connected to any inbox yet, so it won&apos;t respond to conversations.
          </AlertDescription>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/captain/inboxes">Connect inbox</Link>
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setInboxBanner(false)}>
            <X />
          </Button>
        </Alert>
      )}
      {coverageBanner && (
        <Alert className="flex items-center gap-3">
          <Sparkles className="size-4 text-primary" />
          <AlertDescription className="flex-1 text-foreground">
            4 FAQ suggestions are ready for review, keeping coverage at 82%. Approve them so your assistant can resolve
            more on its own.
          </AlertDescription>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/captain/faqs/suggestions">Review suggestions</Link>
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setCoverageBanner(false)}>
            <X />
          </Button>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        {metrics.map((m) => (
          <Card
            key={m.metricId}
            role="button"
            tabIndex={0}
            onClick={() => setDrill(m)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setDrill(m);
            }}
            className="cursor-pointer transition-colors hover:border-primary/40"
          >
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <m.icon className="size-4" />
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                {m.label}
                <Hint text={m.hint} note={m.note} />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{m.value}</div>
                <Badge>
                  {m.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {m.change}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">{m.support}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-lg">Hello, Arham!</CardTitle>
          <CardDescription>Captain summary · {assistant.name}</CardDescription>
          <CardAction className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Previous summary point"
              disabled={point === 0}
              onClick={() => setPoint(point - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {point + 1} / {summaryPoints.length}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Next summary point"
              disabled={point === summaryPoints.length - 1}
              onClick={() => setPoint(point + 1)}
            >
              <ChevronRight />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-base">{summaryPoints[point]}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolution flow</CardTitle>
          <CardDescription>Flow of handled conversations through Captain and team outcomes</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          {flowColumns.map((col, ci) => (
            <React.Fragment key={col[0].label}>
              {ci > 0 && <ArrowRight className="hidden size-4 text-muted-foreground md:block" />}
              <div className="grid gap-2">
                {col.map((n) => (
                  <div key={n.label} className="grid gap-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className={`size-2 rounded-full ${n.dot}`} />
                        {n.label}
                      </span>
                      <span className="font-medium tabular-nums">{n.value.toLocaleString()}</span>
                    </div>
                    <Progress value={Math.round((n.value / 1360) * 100)} className="h-1" />
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resolution trend</CardTitle>
            <CardDescription>
              {trendView === "count"
                ? "Handled and Captain-resolved conversations by reporting period"
                : "Current and previous Captain resolution rates"}
            </CardDescription>
            <CardAction>
              <Tabs value={trendView} onValueChange={setTrendView}>
                <TabsList>
                  <TabsTrigger value="count">Conversation count</TabsTrigger>
                  <TabsTrigger value="rate">Resolution rate</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            {trendView === "rate" ? (
              <>
                <Label className="flex items-center gap-2 font-normal text-sm">
                  <Switch checked={aligned} onCheckedChange={setAligned} /> Weekday-aligned comparison
                  <Hint
                    text="Compare resolution rates on matching weekdays, such as Monday with Monday."
                    note="Today is compared up to the same time of day."
                  />
                </Label>
                <ChartContainer config={rateConfig} className="h-56 w-full">
                  <LineChart data={aligned ? rateTrend : [...rateTrend].reverse()} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={36} unit="%" domain={[50, 80]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      dataKey="current"
                      stroke="var(--color-current)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="previous"
                      stroke="var(--color-previous)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ChartContainer>
              </>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={trend} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="handled" fill="var(--color-handled)" radius={4} isAnimationActive={false} />
                  <Bar dataKey="resolved" fill="var(--color-resolved)" radius={4} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Handoff reasons</CardTitle>
            <CardDescription>{totalReasons} handoffs in this period</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {handoffReasons.map((r) => {
              const pct = Math.round((r.value / totalReasons) * 100);
              return (
                <div key={r.label} className="grid gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {r.value} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge coverage</CardTitle>
            <CardDescription>82% approved</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Progress value={82} />
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["126", "Approved FAQs"],
                ["4", "Suggested FAQs"],
                ["14", "Documents"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-lg border p-3">
                  <div className="font-semibold text-lg tabular-nums">{v}</div>
                  <div className="text-muted-foreground text-xs">{l}</div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/captain/faqs">Review FAQs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>Resets on Nov 1, 2026</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <div className="flex justify-between text-sm">
                <span>Credits</span>
                <span className="text-muted-foreground tabular-nums">3,420/5,000 (68% used)</span>
              </div>
              <Progress value={68} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex justify-between text-sm">
                <span>Documents</span>
                <span className="text-muted-foreground tabular-nums">43/200 (22% used)</span>
              </div>
              <Progress value={22} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.success("Usage refreshed")}>
                <RefreshCw /> Refresh usage
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href="/dashboard/settings/billing">
                  <CreditCard /> Buy more credits
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Captain CSAT</CardTitle>
            <CardDescription>Average customer rating out of 5</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="inline-flex items-center gap-1.5 text-sm">
                Captain-resolved conversations
                <Hint text="The average customer rating for conversations Captain resolved without help from your team." />
              </span>
              <span className="font-semibold tabular-nums">4.6</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="inline-flex items-center gap-1.5 text-sm">
                Captain-assisted conversations
                <Hint text="The average customer rating when Captain helped before your team resolved the conversation." />
              </span>
              <span className="font-semibold tabular-nums">4.4</span>
            </div>
            <p className="text-muted-foreground text-xs">+0.2 vs humans</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: BookOpen,
            title: "Captain docs",
            desc: "Guides and how-tos for Captain",
            href: "https://www.chatwoot.com/hc/user-guide/en/categories/captain",
          },
          {
            icon: SquareTerminal,
            title: "Playground",
            desc: "Test this assistant's replies",
            href: "/dashboard/captain/playground",
          },
          { icon: CreditCard, title: "Billing", desc: "Manage credits and plan", href: "/dashboard/settings/billing" },
        ].map((l) => (
          <Link key={l.title} href={l.href}>
            <Card className="flex-row items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <l.icon className="size-4" />
              </div>
              <div className="grid gap-0.5">
                <span className="font-medium text-sm">{l.title}</span>
                <span className="text-muted-foreground text-xs">{l.desc}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <DrilldownSheet key={drill?.metricId} metric={drill} onClose={() => setDrill(null)} />
    </CaptainShell>
  );
}

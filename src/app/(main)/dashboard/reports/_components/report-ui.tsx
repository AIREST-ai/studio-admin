"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  Clock,
  Download,
  Hourglass,
  Info,
  type LucideIcon,
  MessageSquareDot,
  MessagesSquare,
  Send,
  Timer,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { MetricDef } from "./data";
import { type DrillRequest, type DrillScope, DrilldownSheet } from "./drilldown-sheet";
import { type GroupBy, type PeriodState, ReportDatePicker, usePeriod } from "./report-period";

export function ReportHeader({
  title,
  description,
  backHref,
  children,
}: {
  title: React.ReactNode;
  description?: string;
  backHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {backHref ? (
        <Button variant="link" size="sm" className="w-fit px-0 text-muted-foreground" asChild>
          <Link href={backHref}>
            <ChevronLeft />
            Back
          </Link>
        </Button>
      ) : null}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="text-3xl tracking-tight">{title}</h1>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
    </section>
  );
}

export function DownloadButton({ label }: { label: string }) {
  return (
    <Button size="sm" onClick={() => toast.success("Report download started (sample)")}>
      <Download />
      {label}
    </Button>
  );
}

// F159: Chatwoot ActiveFilterChip with enable-search ("Select Agent" + "Search agents"), as a Studio Popover+Command.
function EntityChip({
  label,
  searchPlaceholder,
  options,
  value,
  onChange,
}: {
  label: string;
  searchPlaceholder: string;
  options: { id: string; name: string }[];
  value?: string;
  onChange?: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-64 font-normal" aria-label={label}>
          <span className="truncate font-medium">{current?.name ?? label}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={() => {
                    setOpen(false);
                    onChange?.(o.id);
                  }}
                >
                  <span className="truncate">{o.name}</span>
                  {o.id === value ? <Check className="ml-auto" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function GroupByChip() {
  const p = usePeriod();
  if (!p.groupOptions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal" aria-label="Group By">
          <span className="text-muted-foreground">Group By</span>
          <span className="font-medium">{p.group}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuRadioGroup value={p.group} onValueChange={(v) => p.setGroup(v as GroupBy)}>
          {p.groupOptions.map((g) => (
            <DropdownMenuRadioItem key={g} value={g}>
              {g}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ReportFilters.vue: date picker, entity chip (detail pages), Group By chip (29 days or more), Business Hours.
export function ReportFilters({
  entityLabel,
  entityOptions,
  entityValue,
  onEntityChange,
  searchPlaceholder = "Search",
  showBusinessHours = true,
}: {
  entityLabel?: string;
  entityOptions?: { id: string; name: string }[];
  entityValue?: string;
  onEntityChange?: (id: string) => void;
  searchPlaceholder?: string;
  showGroupBy?: boolean;
  showBusinessHours?: boolean;
}) {
  const p = usePeriod();
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <ReportDatePicker />
        {entityOptions ? (
          <EntityChip
            label={entityLabel ?? "Select"}
            searchPlaceholder={searchPlaceholder}
            options={entityOptions}
            value={entityValue}
            onChange={onEntityChange}
          />
        ) : null}
        <GroupByChip />
        {showBusinessHours ? (
          <div className="flex items-center gap-2 md:ml-auto">
            <Label htmlFor="business-hours" className="font-normal text-sm">
              Business Hours
            </Label>
            <Switch id="business-hours" checked={p.businessHours} onCheckedChange={p.setBusinessHours} />
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

// Chatwoot formatTime (@chatwoot/utils): "4 Min 38 Sec", "3 Hr 6 Min", "1 Day 2 Hr".
export function formatDuration(minutes: number) {
  const sec = Math.round(minutes * 60);
  if (sec < 60) return `${sec} Sec`;
  if (sec < 3600) return `${Math.floor(sec / 60)} Min ${sec % 60} Sec`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} Hr ${Math.floor((sec % 3600) / 60)} Min`;
  return `${Math.floor(sec / 86400)} Day ${Math.floor((sec % 86400) / 3600)} Hr`;
}

function axisDuration(minutes: number) {
  const s = Math.round(minutes * 60);
  if (s === 0) return "0";
  if (s < 60) return `${s}s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60}m`;
  if (s < 86400) {
    const m = Math.floor((s % 3600) / 60);
    return m ? `${Math.floor(s / 3600)}h ${m}m` : `${Math.floor(s / 3600)}h`;
  }
  return `${Math.round(s / 86400)}d`;
}

// Even duration steps for the time charts (CW getDurationStepSize): at most 4 steps above zero.
const DURATION_STEPS = [15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800];

function durationTicks(maxMinutes: number) {
  const maxS = Math.max(1, maxMinutes * 60);
  const step = DURATION_STEPS.find((s) => maxS / s <= 4) ?? DURATION_STEPS[DURATION_STEPS.length - 1];
  const n = Math.max(1, Math.ceil(maxS / step));
  return Array.from({ length: n + 1 }, (_, i) => (i * step) / 60);
}

function seeded(seed: number) {
  let s = Math.abs(Math.round(seed)) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export interface MetricValues {
  data: { day: string; long: string; start: Date; days: number; value: number }[];
  total: number;
  totalText: string;
  trend: number;
}

// One function for the chart, its header and the KPI cards, so all three always show the same numbers.
export function computeMetric(metric: MetricDef, seed: number, period: PeriodState): MetricValues {
  const rand = seeded(seed * 7 + period.salt);
  const avg = metric.unit === "min";
  const hours = period.businessHours ? 0.72 : 1;
  const data = period.buckets.map((b) => {
    const noise = (rand() - 0.5) * metric.spread;
    const row = { day: b.label, long: b.long, start: b.start, days: b.days };
    if (avg) return { ...row, value: Math.max(0.2, Math.round((metric.base + noise) * hours * 10) / 10) };
    return { ...row, value: Math.max(0, Math.round((metric.base + noise) * b.days * hours)) };
  });
  // An anchored metric is rescaled so its total (or average) is exactly the anchor; rounding leftovers go to the
  // biggest bar so the sum stays exact.
  if (metric.anchor !== undefined && data.length) {
    const current = data.reduce((s, d) => s + d.value, 0);
    if (avg) {
      const k = current ? (metric.anchor * data.length) / current : 1;
      for (const d of data) d.value = Math.max(0.1, Math.round(d.value * k * 100) / 100);
    } else {
      const k = current ? metric.anchor / current : 0;
      for (const d of data) d.value = Math.round(d.value * k);
      const diff = metric.anchor - data.reduce((s, d) => s + d.value, 0);
      const big = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);
      data[big].value = Math.max(0, data[big].value + diff);
    }
  }
  const sum = data.reduce((s, d) => s + d.value, 0);
  const total =
    avg && metric.anchor !== undefined ? metric.anchor : avg ? (data.length ? sum / data.length : 0) : sum;
  const trend = period.salt ? metric.trend + ((period.salt % 9) - 4) || metric.trend : metric.trend;
  return {
    data,
    total,
    totalText: avg ? (total ? formatDuration(total) : "--") : Math.round(total).toLocaleString("en-US"),
    trend,
  };
}

export function metricSeed(seed: number, index: number) {
  return seed * 31 + index * 7;
}

export function TrendBadge({ trend, inverse }: { trend: number; inverse?: boolean }) {
  const good = inverse ? trend < 0 : trend > 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border px-1.5 font-medium",
        good
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      {trend > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {trend > 0 ? "+" : ""}
      {trend}%
    </Badge>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="More info" className="text-muted-foreground hover:text-foreground">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

// Studio chart card (default/_components/performance-overview.tsx look) holding a Chatwoot ChartStats + BarChart.
export function MetricChart({
  metric,
  values,
  onBarClick,
  infoCount,
}: {
  metric: MetricDef;
  values: MetricValues;
  onBarClick?: (index: number) => void;
  infoCount?: number;
}) {
  const config = { value: { label: metric.name, color: "var(--chart-1)" } } satisfies ChartConfig;
  const avg = metric.unit === "min";
  const empty = values.data.every((d) => d.value === 0);
  const gradientName = `fill-${metric.key}`;
  const ticks = durationTicks(Math.max(0, ...values.data.map((d) => d.value)));

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{metric.name}</span>
          {metric.desc ? <span>{metric.desc}</span> : null}
          {metric.info ? <InfoTip text={`${metric.info} ${(infoCount ?? 0).toLocaleString("en-US")}`} /> : null}
        </CardDescription>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-3xl tabular-nums leading-none tracking-tight">{values.totalText}</span>
          <TrendBadge trend={values.trend} inverse={avg} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-60 items-center justify-center text-center text-muted-foreground text-sm">
            We&apos;ve not received enough data points to generate report, Please try again later.
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-60 w-full">
            <BarChart data={values.data} margin={{ left: 0, right: 4, top: 4 }}>
              <defs>
                <linearGradient id={gradientName} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.95} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={avg ? 56 : 44}
                ticks={avg ? ticks : undefined}
                domain={avg ? [0, ticks[ticks.length - 1]] : undefined}
                interval={avg ? 0 : "preserveEnd"}
                tickFormatter={(v: number) => (avg ? axisDuration(v) : v.toLocaleString("en-US"))}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.long ?? ""}
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{metric.name}</span>
                        <span className="font-medium font-mono tabular-nums">
                          {avg ? formatDuration(Number(value)) : Number(value).toLocaleString("en-US")}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="value"
                fill={`url(#${gradientName})`}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
                className={onBarClick ? "cursor-pointer" : undefined}
                onClick={(_, index) => onBarClick?.(index)}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ReportContainer.vue: one chart per metric, a click on a bar opens the drilldown side panel.
export function MetricChartsGrid({
  metrics,
  seed = 1,
  scope,
}: {
  metrics: MetricDef[];
  seed?: number;
  scope?: DrillScope;
}) {
  const period = usePeriod();
  const [drill, setDrill] = React.useState<{ metric: MetricDef; values: MetricValues; index: number } | null>(null);
  const all = metrics.map((m, i) => ({ metric: m, values: computeMetric(m, metricSeed(seed, i), period) }));
  const counted = all.find((x) => ["resolutionCount", "conversations"].includes(x.metric.key));
  const conversationsUsed = Math.round(counted?.values.total ?? 0);

  const request: DrillRequest | null = drill
    ? {
        metricKey: drill.metric.key,
        metricName: drill.metric.name,
        isAverage: drill.metric.unit === "min",
        index: drill.index,
        points: drill.values.data.map((d) => ({
          label: d.day,
          long: d.long,
          start: d.start,
          days: d.days,
          value: d.value,
          display: drill.metric.unit === "min" ? formatDuration(d.value) : d.value.toLocaleString("en-US"),
        })),
      }
    : null;

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {all.map(({ metric, values }) => (
          <MetricChart
            key={metric.key}
            metric={metric}
            values={values}
            infoCount={conversationsUsed}
            onBarClick={(index) => {
              if (values.data[index]?.value > 0) setDrill({ metric, values, index });
            }}
          />
        ))}
      </div>
      <DrilldownSheet
        request={request}
        scope={scope}
        onClose={() => setDrill(null)}
        onNavigate={(index) => setDrill((d) => (d ? { ...d, index } : d))}
      />
    </TooltipProvider>
  );
}

export interface KpiItem {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  inverse?: boolean;
  sub?: string;
  tooltip?: string;
}

// Studio metric cards (default/_components/metric-cards.tsx): icon tile, label, big number, change badge, sub line.
export function KpiCards({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          "grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 dark:*:data-[slot=card]:bg-card",
          items.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
          className,
        )}
      >
        {items.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <item.icon className="size-4" />
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                {item.label}
                {item.tooltip ? <InfoTip text={item.tooltip} /> : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{item.value}</div>
                {item.trend !== undefined ? <TrendBadge trend={item.trend} inverse={item.inverse} /> : null}
              </div>
              {item.sub ? <p className="text-muted-foreground text-sm">{item.sub}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}

const kpiIcons: Record<string, LucideIcon> = {
  conversations: MessagesSquare,
  firstResponse: Timer,
  resolutionTime: Clock,
  resolutionCount: CheckCheck,
  incoming: MessageSquareDot,
  outgoing: Send,
  replyTime: Hourglass,
  botResolutionCount: CheckCheck,
  botHandoffCount: UserRoundCheck,
};

// KPI cards for a report page: the same numbers as the chart headers below them.
export function MetricKpis({ metrics, seed = 1, keys }: { metrics: MetricDef[]; seed?: number; keys: string[] }) {
  const period = usePeriod();
  const items = keys.flatMap((key) => {
    const i = metrics.findIndex((m) => m.key === key);
    if (i < 0) return [];
    const m = metrics[i];
    const v = computeMetric(m, metricSeed(seed, i), period);
    return [
      {
        label: `${m.name}${m.desc ? ` ${m.desc}` : ""}`,
        value: v.totalText,
        icon: kpiIcons[m.key] ?? MessagesSquare,
        trend: v.trend,
        inverse: m.unit === "min",
        sub: `vs ${period.previousLabel}`,
      },
    ];
  });
  return <KpiCards items={items} />;
}

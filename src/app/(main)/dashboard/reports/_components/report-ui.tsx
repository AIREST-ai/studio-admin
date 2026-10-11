"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, Download, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { dateRangeOptions, type MetricDef, series } from "./data";

export function ReportHeader({
  title,
  description,
  backHref,
  children,
}: {
  title: string;
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex max-w-3xl flex-col gap-1.5">
          <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
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

const groupOptions: Record<string, string[]> = {
  "Last 7 days": ["Day"],
  "Last 14 days": ["Day", "Week"],
  "Last 30 days": ["Day", "Week"],
  "This month": ["Day", "Week"],
  "Last month": ["Day", "Week"],
  "Last 3 months": ["Day", "Week", "Month"],
  "Last 6 months": ["Day", "Week", "Month"],
  "Last year": ["Week", "Month", "Year"],
  "Custom date range": ["Day", "Week", "Month"],
};

export function ReportFilters({
  entityLabel,
  entityOptions,
  entityValue,
  onEntityChange,
  showGroupBy = true,
  showBusinessHours = true,
}: {
  entityLabel?: string;
  entityOptions?: { id: string; name: string }[];
  entityValue?: string;
  onEntityChange?: (id: string) => void;
  showGroupBy?: boolean;
  showBusinessHours?: boolean;
}) {
  const [range, setRange] = React.useState("Last 7 days");
  const [group, setGroup] = React.useState("Day");
  const groups = groupOptions[range] ?? ["Day"];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entityOptions ? (
        <Select defaultValue={entityValue} onValueChange={onEntityChange}>
          <SelectTrigger size="sm" className="w-56" aria-label={entityLabel}>
            <SelectValue placeholder={entityLabel} />
          </SelectTrigger>
          <SelectContent>
            {entityOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={range}
        onValueChange={(v) => {
          setRange(v);
          const next = groupOptions[v] ?? ["Day"];
          if (!next.includes(group)) setGroup(next[0]);
        }}
      >
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
      <span className="rounded-md border px-2.5 py-1 text-muted-foreground text-xs">Oct 6, 2026 – Oct 12, 2026</span>
      {showGroupBy ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Group By</span>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger size="sm" className="w-28" aria-label="Group By">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {showBusinessHours ? (
        <div className="flex items-center gap-2 md:ml-auto">
          <Label htmlFor="business-hours" className="font-normal text-muted-foreground text-sm">
            Business Hours
          </Label>
          <Switch id="business-hours" />
        </div>
      ) : null}
    </div>
  );
}

function formatValue(value: number, unit?: "min") {
  if (unit !== "min") return value.toLocaleString("en-US");
  if (value >= 60) return `${Math.floor(value / 60)}h ${value % 60}m`;
  return `${value}m`;
}

export function MetricChart({ metric, seed, days = 7 }: { metric: MetricDef; seed: number; days?: number }) {
  const data = React.useMemo(
    () => series(seed, metric.base, metric.spread, days),
    [seed, metric.base, metric.spread, days],
  );
  const config = { value: { label: metric.name, color: "var(--chart-1)" } } satisfies ChartConfig;
  const better = metric.unit === "min" ? metric.trend < 0 : metric.trend > 0;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <span className="font-medium text-foreground">{metric.name}</span>
          {metric.desc ? <span>{metric.desc}</span> : null}
          {metric.unit === "min" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Total number of conversations used for computation: 861</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-2xl tabular-nums">{metric.total}</span>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium text-xs",
              better ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
            )}
          >
            {metric.trend > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(metric.trend)}%
          </span>
        </div>
      </div>
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => (metric.unit === "min" && v >= 60 ? `${Math.round(v / 60)}h` : formatValue(v, metric.unit))}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function MetricChartsGrid({ metrics, seed = 1 }: { metrics: MetricDef[]; seed?: number }) {
  return (
    <TooltipProvider>
      <Card className="py-0">
        <CardContent className="grid grid-cols-1 divide-y px-0 lg:grid-cols-2 lg:divide-y-0 lg:[&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(odd)]:border-r">
          {metrics.map((m, i) => (
            <MetricChart key={m.key} metric={m} seed={seed * 31 + i * 7} />
          ))}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export function StatCard({ label, value, tooltip, sub }: { label: string; value: string; tooltip?: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-5">
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        {label}
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <span className="font-semibold text-2xl tabular-nums">{value}</span>
      {sub ? <span className="text-muted-foreground text-xs">{sub}</span> : null}
    </div>
  );
}

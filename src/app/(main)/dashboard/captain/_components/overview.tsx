"use client";
import * as React from "react";

import Link from "next/link";

import { BookOpen, ChevronLeft, ChevronRight, CreditCard, Info, Sparkles, SquareTerminal, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { handoffReasons, trend } from "./data";
import { AssistantSwitcher } from "./shared";

const summaryPoints = [
  "Captain handled 1,360 conversations this week and resolved 71% of them on its own.",
  "Most handoffs came from billing disputes. Adding the refund policy as a document could lower them.",
  "4 FAQ suggestions are ready. They come from 90 recent conversations about payments and Ramadan speeds.",
];

const metrics = [
  {
    label: "Conversations handled",
    value: "1,360",
    change: "+12%",
    hint: "Conversations where Captain replied to the customer or handed the conversation to your team.",
  },
  {
    label: "Auto-resolution rate",
    value: "71.4%",
    change: "+3.2 pts",
    hint: "The share of handled conversations Captain resolved without help from your team. Higher means Captain resolved more on its own.",
  },
  {
    label: "Handoff rate",
    value: "22.8%",
    change: "-1.9 pts",
    hint: "The share of handled conversations Captain passed to your team. Lower means fewer conversations needed an agent.",
  },
  {
    label: "Saved in agent effort and time",
    value: "41h",
    change: "+6h",
    hint: "An estimate of how much agent reply time Captain saved.",
  },
  {
    label: "Captain resolutions remained closed",
    value: "93%",
    change: "+1 pt",
    hint: "The share of Captain-resolved conversations that were still closed seven days later.",
  },
  {
    label: "Median resolution time",
    value: "4 min",
    change: "-40s",
    hint: "The typical time from when a conversation reached Captain until it was resolved.",
  },
];

const chartConfig = {
  handled: { label: "Handled", color: "var(--chart-2)" },
  resolved: { label: "Resolved by Captain", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function CaptainOverview() {
  const [point, setPoint] = React.useState(0);
  const [banner, setBanner] = React.useState(true);
  const totalReasons = handoffReasons.reduce((s, r) => s + r.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-xl">Overview</h1>
          <AssistantSwitcher />
        </div>
        <NativeSelect size="sm" defaultValue="this_week" className="w-40">
          <option value="this_week">This week</option>
          <option value="last_week">Last week</option>
          <option value="last_30">Last 30 days</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
        </NativeSelect>
      </div>

      {banner && (
        <Alert className="flex items-center gap-3">
          <Sparkles className="size-4 text-primary" />
          <AlertDescription className="flex-1 text-foreground">
            4 FAQ suggestions are ready for review, keeping coverage at 82%. Approve them so your assistant can resolve
            more on its own.
          </AlertDescription>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/captain/faqs?tab=pending">Review suggestions</Link>
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setBanner(false)}>
            <X />
          </Button>
        </Alert>
      )}

      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-lg">Hello, Fahad!</CardTitle>
          <CardDescription>Captain summary</CardDescription>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <Card key={m.label} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription className="flex items-start justify-between gap-2 text-xs">
                <span>{m.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 shrink-0 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">{m.hint}</TooltipContent>
                </Tooltip>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-baseline gap-2 px-4">
              <span className="font-semibold text-2xl tabular-nums">{m.value}</span>
              <span className="text-muted-foreground text-xs">{m.change}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resolution trend</CardTitle>
            <CardDescription>Handled and Captain-resolved conversations by reporting period</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Handoff reasons</CardTitle>
            <CardDescription>{totalReasons} handoffs this week</CardDescription>
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
                ["4", "FAQ suggestions"],
                ["14", "Documents"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-lg border p-3">
                  <div className="font-semibold text-lg tabular-nums">{v}</div>
                  <div className="text-muted-foreground text-xs">{l}</div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/captain/faqs?tab=pending">Review FAQs</Link>
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
              <Button variant="outline" size="sm" className="flex-1">
                Refresh usage
              </Button>
              <Button size="sm" className="flex-1">
                Buy more credits
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
              <span className="text-sm">Captain-resolved conversations</span>
              <span className="font-semibold tabular-nums">4.6</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Captain-assisted conversations</span>
              <span className="font-semibold tabular-nums">4.4</span>
            </div>
            <p className="text-muted-foreground text-xs">+0.2 vs humans</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: BookOpen, title: "Captain docs", desc: "Guides and how-tos for Captain", href: "#" },
          {
            icon: SquareTerminal,
            title: "Playground",
            desc: "Test this assistant's replies",
            href: "/dashboard/captain/playground",
          },
          { icon: CreditCard, title: "Billing", desc: "Manage credits and plan", href: "#" },
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
    </div>
  );
}

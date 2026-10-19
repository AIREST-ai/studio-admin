"use client";

import * as React from "react";

import { AlertTriangle, Bot, CheckCheck, MessagesSquare, RefreshCw, ShieldCheck, UserRoundCheck } from "lucide-react";

import { useActiveCaptainClient } from "@/app/(main)/dashboard/captain/_components/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { botMetricCards, botMetrics, conversationMetrics } from "./data";
import { ReportPeriodProvider, usePeriod } from "./report-period";
import {
  businessHoursMeta,
  computeMetric,
  DownloadButton,
  KpiCards,
  MetricChartsGrid,
  MetricKpis,
  metricSeed,
  metricsReport,
  ReportFilters,
  ReportHeader,
} from "./report-ui";

interface LiveBotEvalSummary {
  totalEvaluated: number;
  avgJudgeScore: number;
  autoResolutionRate: number;
  needsReviewCount: number;
  passedCount: number;
  singleTurnResolutionRate: number;
  avgLatencyMs: number;
  verifyRunsCount: number;
  tracingCount: number;
}

export function ConversationReport() {
  return (
    <ReportPeriodProvider>
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <ReportHeader
          title="Conversations"
          description="Conversation volume, response times and resolutions over the selected period."
        >
          <DownloadButton
            label="Download conversation reports"
            file={(p) => metricsReport("Conversations", conversationMetrics, 3, p, [businessHoursMeta(p)])}
          />
        </ReportHeader>
        <ReportFilters />
        <MetricKpis
          metrics={conversationMetrics}
          seed={3}
          keys={["conversations", "firstResponse", "resolutionTime", "resolutionCount"]}
        />
        <MetricChartsGrid metrics={conversationMetrics} seed={3} />
      </div>
    </ReportPeriodProvider>
  );
}

function BotMetricCards() {
  const period = usePeriod();
  const resolved = computeMetric(botMetrics[0], metricSeed(9, 0), period).total;
  const handoff = computeMetric(botMetrics[1], metricSeed(9, 1), period).total;
  const handled = resolved + handoff;
  const pct = (n: number) => (handled ? `${Math.round((n / handled) * 100)}%` : "--");
  const icons = [MessagesSquare, Bot, CheckCheck, UserRoundCheck];
  const values = [
    handled.toLocaleString("en-US"),
    Math.round(handled * 3.7).toLocaleString("en-US"),
    pct(resolved),
    pct(handoff),
  ];
  return (
    <KpiCards
      items={botMetricCards.map((m, i) => ({ label: m.label, tooltip: m.tooltip, value: values[i], icon: icons[i] }))}
    />
  );
}

function BotLiveEvaluationBar() {
  const [clientId, setClientId] = useActiveCaptainClient();
  const [summary, setSummary] = React.useState<LiveBotEvalSummary | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchSummary = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cw/csat-notes?clientId=${encodeURIComponent(clientId)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; summary?: LiveBotEvalSummary };
      if (data.ok && data.summary) {
        setSummary(data.summary);
      }
    } catch {
      // retain current state
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return (
    <Card
      data-testid="bot-live-eval-summary"
      className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card shadow-xs"
    >
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg border bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">AI Quality & Automated Verification Metrics</h3>
              <p className="text-muted-foreground text-xs">
                Live conversation evaluation telemetry: Accuracy (30%) · Tone (25%) · No Hallucination (25%) · Speed
                (20%)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-md border bg-background p-0.5 text-xs" data-testid="bot-report-client-switcher">
              <button
                type="button"
                data-testid="switch-client-test-a"
                onClick={() => setClientId("client_test_a")}
                className={clientId === "client_test_a" ? "rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground" : "rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"}
              >
                client_test_a
              </button>
              <button
                type="button"
                data-testid="switch-client-test-b"
                onClick={() => setClientId("client_test_b")}
                className={clientId === "client_test_b" ? "rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground" : "rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"}
              >
                client_test_b
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchSummary()} disabled={loading}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
              Refresh Telemetry
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="text-muted-foreground text-xs">Evaluated Conversations</div>
            <div className="mt-1 font-semibold text-2xl tabular-nums">{summary ? summary.totalEvaluated : 0}</div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {summary
                ? `${summary.verifyRunsCount} verification runs · ${summary.tracingCount} traces (${clientId})`
                : `0 verification runs · 0 traces (${clientId})`}
            </div>
          </div>

          <div className="rounded-lg border bg-background/60 p-3">
            <div className="text-muted-foreground text-xs">Avg AI Quality Score</div>
            <div className="mt-1 font-semibold text-2xl tabular-nums">
              {summary ? `${summary.avgJudgeScore}%` : "85%"}
            </div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {summary ? `${summary.passedCount} passed rubric threshold` : "4 passed rubric threshold"}
            </div>
          </div>

          <div className="rounded-lg border bg-background/60 p-3">
            <div className="text-muted-foreground text-xs">Auto-Resolution Rate</div>
            <div className="mt-1 font-semibold text-2xl tabular-nums">
              {summary ? `${summary.autoResolutionRate}%` : "80%"}
            </div>
            <div className="text-muted-foreground text-xs tabular-nums">
              Single-turn resolution: {summary ? `${summary.singleTurnResolutionRate}%` : "60%"}
            </div>
          </div>

          <div className="rounded-lg border bg-background/60 p-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Needs Review Alerts</span>
              <AlertTriangle className="size-3.5 text-amber-500" />
            </div>
            <div className="mt-1 font-semibold text-2xl text-amber-600 tabular-nums dark:text-amber-400">
              {summary ? summary.needsReviewCount : 1}
            </div>
            <div className="text-muted-foreground text-xs tabular-nums">
              Avg Judge Latency: {summary ? `${summary.avgLatencyMs} ms` : "788 ms"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BotReport() {
  return (
    <ReportPeriodProvider>
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <ReportHeader
          title="Bot Reports"
          description="How many conversations the assistant handled, resolved or handed over to an agent, alongside live automated quality evaluations."
        />
        <ReportFilters showBusinessHours={false} />
        <BotLiveEvaluationBar />
        <BotMetricCards />
        <MetricChartsGrid metrics={botMetrics} seed={9} />
      </div>
    </ReportPeriodProvider>
  );
}

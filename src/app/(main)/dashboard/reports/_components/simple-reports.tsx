"use client";

import { Bot, CheckCheck, MessagesSquare, UserRoundCheck } from "lucide-react";

import { botMetricCards, botMetrics, conversationMetrics } from "./data";
import { ReportPeriodProvider, usePeriod } from "./report-period";
import {
  computeMetric,
  DownloadButton,
  KpiCards,
  MetricChartsGrid,
  MetricKpis,
  metricSeed,
  ReportFilters,
  ReportHeader,
} from "./report-ui";

// CW Index.vue: header, Download conversation reports, ReportFilters (no entity), one chart per metric.
export function ConversationReport() {
  return (
    <ReportPeriodProvider>
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <ReportHeader
          title="Conversations"
          description="Conversation volume, response times and resolutions over the selected period."
        >
          <DownloadButton label="Download conversation reports" />
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

// CW BotMetrics.vue: the four numbers follow the two charts below (resolved + handed off = handled).
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

// CW BotReports.vue: ReportFilters with Group By and without Business Hours, BotMetrics, then the two charts.
export function BotReport() {
  return (
    <ReportPeriodProvider>
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <ReportHeader
          title="Bot Reports"
          description="How many conversations the bot handled, resolved or handed over to an agent."
        />
        <ReportFilters showBusinessHours={false} />
        <BotMetricCards />
        <MetricChartsGrid metrics={botMetrics} seed={9} />
      </div>
    </ReportPeriodProvider>
  );
}

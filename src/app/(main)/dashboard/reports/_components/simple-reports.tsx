"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";

import { botMetricCards, botMetrics, conversationMetrics } from "./data";
import { DownloadButton, MetricChartsGrid, ReportFilters, ReportHeader, StatCard } from "./report-ui";

export function ConversationReport() {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader title="Conversations">
        <DownloadButton label="Download conversation reports" />
      </ReportHeader>
      <ReportFilters />
      <MetricChartsGrid metrics={conversationMetrics} seed={3} />
    </div>
  );
}

export function BotReport() {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        <ReportHeader title="Bot Reports" />
        <ReportFilters showBusinessHours={false} />
        <Card className="py-0">
          <CardContent className="grid grid-cols-2 divide-x px-0 md:grid-cols-4">
            {botMetricCards.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} tooltip={m.tooltip} />
            ))}
          </CardContent>
        </Card>
        <MetricChartsGrid metrics={botMetrics} seed={9} />
      </div>
    </TooltipProvider>
  );
}

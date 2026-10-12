import type { Metadata } from "next";

import { channelNames } from "./_components/channel-breakdown";
import { MetricCards } from "./_components/metric-cards";
import { PerformanceOverview } from "./_components/performance-overview";
import { SubscriberOverview } from "./_components/subscriber-overview";

export const metadata: Metadata = {
  title: "AIREST overview",
  description:
    "Dodges detected in customer conversations on Email, Chat, WhatsApp, Instagram, Facebook and Phone, and how many get solved.",
  alternates: {
    canonical: "/dashboard/default",
  },
};

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">AIREST overview</h1>
        <p className="text-muted-foreground text-sm">Sample data · {channelNames}</p>
      </div>
      <MetricCards />
      <PerformanceOverview />
      <SubscriberOverview />
    </div>
  );
}

"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { channelItems } from "@/app/(main)/chat/_components/data";
import { agentName, baseConversations, initialMeta } from "@/app/(main)/dashboard/chat/_components/cw-data";

import { channelBreakdown, DODGES_30_DAYS } from "./channel-breakdown";
import dodgeSeeds from "./data.json";
import type { RecentCustomerRow } from "./recent-customers-table/schema";
import { RecentCustomersTable } from "./recent-customers-table/table";

// F159: each dodge is an agent reply in a real inbox conversation (/dashboard/chat), so the customer, channel,
// agent, quote and age are read from that conversation instead of being typed twice.
type DodgeSeed = { conversation: number; message: number; quote: string; status: string };

const TODAY = "2026-10-12";
const YESTERDAY = "2026-10-11";

const dodges: RecentCustomerRow[] = (dodgeSeeds as DodgeSeed[])
  .flatMap((seed) => {
    const conversation = baseConversations.find((c) => c.id === seed.conversation);
    const message = conversation?.messages.find((m) => m.id === seed.message);
    if (!conversation || !message) return [];
    return [
      {
        id: String(conversation.id),
        name: conversation.name,
        channel: channelItems.find((item) => item.id === conversation.channel)?.title ?? conversation.channel,
        agent: agentName(initialMeta[conversation.id]?.assigneeId) ?? "Unassigned",
        dodge: message.text.includes(seed.quote) ? seed.quote : message.text,
        status: seed.status,
        detected: conversation.group === "Yesterday" ? YESTERDAY : TODAY,
        ago: message.time,
        minutes: message.ago ?? 24 * 60,
      },
    ];
  })
  .sort((a, b) => a.minutes - b.minutes)
  .map(({ minutes: _minutes, ...row }) => row);

export function SubscriberOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">Recent dodges</CardTitle>
        <CardDescription>
          {DODGES_30_DAYS} dodges in the last 30 days:{" "}
          {channelBreakdown.map((item) => `${item.title} ${item.count}`).join(" · ")}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            <Download />
            Export
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable data={dodges} />
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";

import { Download } from "lucide-react";

import { channelItems } from "@/app/(main)/chat/_components/data";
import { agentName, baseConversations, initialMeta } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { loadDodgeBoard } from "@/app/(main)/dashboard/kanban/_components/board-api";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadCsv, SimBadge } from "@/lib/cw/preview-sim-ui";

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

// F-9: the Dodge board (/dashboard/kanban) follows these same dodges and saves their columns in the preview; once it
// is saved, each row's status is its card's column there, so both pages say the same thing.
// F-20: the board is kept in the board engine now (/api/dodge-board), so the columns are read from there.
const columnTitles: Record<string, string> = {
  detected: "Dodge detected",
  "in-progress": "In progress",
  waiting: "Waiting on customer",
  solved: "Solved",
};

function useBoardStatuses(): Record<string, string> {
  const [statuses, setStatuses] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let alive = true;
    loadDodgeBoard<{ kind?: string; conversationId?: number; column?: string }>().then(
      (saved) => {
        if (!alive || !saved.items) return;
        const next: Record<string, string> = {};
        for (const card of saved.items)
          if (card.kind === "card" && card.conversationId && card.column && columnTitles[card.column])
            next[String(card.conversationId)] = columnTitles[card.column];
        setStatuses(next);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  return statuses;
}

export function SubscriberOverview() {
  const statuses = useBoardStatuses();
  const rows = React.useMemo(
    () => dodges.map((row) => (statuses[row.id] ? { ...row, status: statuses[row.id] } : row)),
    [statuses],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">Recent dodges</CardTitle>
        <CardDescription>
          {DODGES_30_DAYS} dodges in the last 30 days:{" "}
          {channelBreakdown.map((item) => `${item.title} ${item.count}`).join(" · ")}
        </CardDescription>
        {/* M129-A (Fahad 129.2): Export downloads these rows as a CSV built in the browser (sample data). */}
        <CardAction className="flex flex-wrap items-center justify-end gap-2">
          <SimBadge />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(`recent-dodges-${new Date().toISOString().slice(0, 10)}.csv`, [
                ["conversation_id", "customer", "channel", "agent", "dodge", "status", "detected", "age"],
                ...rows.map((row) => [
                  Number(row.id),
                  row.name,
                  row.channel,
                  row.agent,
                  row.dodge,
                  row.status,
                  row.detected,
                  row.ago,
                ]),
              ])
            }
          >
            <Download />
            Export
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable data={rows} />
      </CardContent>
    </Card>
  );
}

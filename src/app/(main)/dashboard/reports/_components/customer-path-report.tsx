"use client";

// T-101 (Fahad 21:21): the first report, «مسار العميل», its stages in his order. respond.io's Lifecycle report is the
// first tab of its reports. The numbers count the inbox conversations (chat/_components/cw-data.ts, the same rows the
// other reports read) by the stage set on their contact in the contact panel; nothing is assigned by default, so a
// stage nobody set reads 0.
import * as React from "react";

import { StageDot } from "@/app/(main)/dashboard/chat/_components/customer-path";
import { baseConversations } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pathKeyOf, useCustomerPath, useHydrateCustomerPath } from "@/lib/cw/customer-path";

import { ReportHeader } from "./report-ui";

interface Row {
  id: string;
  name: string;
  color?: string;
  contacts: number;
  conversations: number;
}

export function CustomerPathReport() {
  useHydrateCustomerPath();
  const stages = useCustomerPath((s) => s.stages);
  const assigned = useCustomerPath((s) => s.assigned);

  const { rows, none, total } = React.useMemo(() => {
    const contacts = new Map<string, Set<string>>();
    const conversations = new Map<string, number>();
    for (const conversation of baseConversations) {
      const key = pathKeyOf(conversation.id);
      const stageId = assigned[key] ?? "";
      if (!contacts.has(stageId)) contacts.set(stageId, new Set());
      contacts.get(stageId)?.add(key);
      conversations.set(stageId, (conversations.get(stageId) ?? 0) + 1);
    }
    const count = (id: string) => ({
      contacts: contacts.get(id)?.size ?? 0,
      conversations: conversations.get(id) ?? 0,
    });
    return {
      rows: stages.map<Row>((stage) => ({ id: stage.id, name: stage.name, color: stage.color, ...count(stage.id) })),
      none: { id: "none", name: "No stage", ...count("") } as Row,
      total: baseConversations.length,
    };
  }, [stages, assigned]);

  const share = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "--");

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <ReportHeader
        title="Customer Path"
        description="Conversations by the stage of their contact, in the order of the stages. A contact's stage is set from the contact panel of a conversation."
      />
      <Card className="py-0">
        <CardContent className="px-0">
          <Table data-slot="customer-path-report">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Stage</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Conversations</TableHead>
                <TableHead className="pr-4 text-right">Share of conversations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows, none].map((row) => (
                <TableRow key={row.id} data-stage={row.name}>
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-2">
                      {row.color ? <StageDot color={row.color} /> : <span className="size-2.5 shrink-0" />}
                      <span className={row.color ? "font-medium" : "text-muted-foreground"}>{row.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.contacts}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.conversations}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{share(row.conversations)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4">Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {rows.reduce((sum, row) => sum + row.contacts, none.contacts)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{total}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{total ? "100%" : "--"}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

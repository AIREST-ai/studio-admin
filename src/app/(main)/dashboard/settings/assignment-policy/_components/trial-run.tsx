"use client";
// T-70: trial auto assignment. Runs the assignment rules (src/lib/cw/assignment-policy/engine.ts) over fixed sample
// conversations with the policies, inboxes, teams and agent availability as they are now in Settings. A dry run:
// nothing is assigned in Inbox and nothing is saved.
// T-232 (item 78.1a): each agent's open count for the capacity limit is counted from the conversations assigned in Inbox
// (by hand or automatically) at the moment the trial runs, as Chatwoot counts it, and shown above the results.
import * as React from "react";

import { FlaskConical, Play } from "lucide-react";

import { baseConversations } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  dropText,
  reasonText,
  runTrialAssignment,
  type TrialResult,
  type TrialWorkload,
} from "@/lib/cw/assignment-policy/engine";
import { openCounts } from "@/lib/cw/assignment-policy/open-count";
import { canManageAssignment } from "@/lib/cw/assignment-policy/permissions";
import { TRIAL_NOW, trialConversations, trialRecent } from "@/lib/cw/assignment-policy/trial-data";
import { CURRENT_USER_ID } from "@/lib/cw/data";
import { useCwShared } from "@/lib/cw/store";

import { PageHeader } from "../../labels/_shared/settings-shell";
import { useAssignmentPolicies, useCapacityPolicies } from "./policies-store";
import { POLICY_HOME, PolicyBreadcrumb } from "./policy-ui";

function hours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function TrialRun() {
  const agents = useCwShared((state) => state.agents);
  const inboxes = useCwShared((state) => state.inboxes);
  const teams = useCwShared((state) => state.teams);
  const assignmentPolicies = useAssignmentPolicies();
  const capacityPolicies = useCapacityPolicies();
  const meta = useCwStore((state) => state.meta);
  const deleted = useCwStore((state) => state.deleted);
  const [result, setResult] = React.useState<TrialResult | null>(null);
  const [counted, setCounted] = React.useState<TrialWorkload["open"]>({});

  const me = agents.find((a) => a.id === CURRENT_USER_ID);
  const agentName = (id: number) => agents.find((a) => a.id === id)?.name ?? `Agent ${id}`;
  const conversation = (id: string) => trialConversations.find((c) => c.id === id);

  const crumbs = [{ label: "Agent Assignment", href: POLICY_HOME }, { label: "Trial assignment" }];
  if (!canManageAssignment(me)) {
    return (
      <div className="flex flex-col gap-4">
        <PolicyBreadcrumb items={crumbs} />
        <p className="text-muted-foreground text-sm" data-trial-denied>
          Only administrators can run the trial assignment.
        </p>
      </div>
    );
  }

  const run = () => {
    const open = openCounts(
      Object.entries(meta)
        .filter(([id]) => !deleted.includes(Number(id)))
        .map(([id, m]) => {
          const channel = baseConversations.find((c) => c.id === Number(id))?.channel;
          return {
            inboxId: inboxes.find((i) => i.slug === channel)?.id ?? null,
            assigneeId: m.assigneeId,
            status: m.status,
          };
        }),
    );
    setCounted(open);
    setResult(
      runTrialAssignment({
        now: TRIAL_NOW,
        conversations: trialConversations,
        workload: { open, recent: trialRecent },
        agents,
        inboxes,
        teams,
        assignmentPolicies,
        capacityPolicies,
      }),
    );
  };
  // Per inbox of the sample, the agents with a capacity limit there: open conversations counted / limit.
  const countLines = [...new Set(trialConversations.map((c) => c.inboxId))]
    .sort((a, b) => a - b)
    .map((inboxId) => {
      const inbox = inboxes.find((i) => i.id === inboxId);
      const limited = (inbox?.agents ?? []).flatMap((agentId) => {
        const limit = capacityPolicies.find((p) => p.agents.includes(agentId))?.limits.find((l) => l.inbox === inboxId);
        return limit ? [`${agentName(agentId)} ${counted[inboxId]?.[agentId] ?? 0}/${limit.max}`] : [];
      });
      return limited.length ? `${inbox?.name}: ${limited.join(", ")}` : null;
    })
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <PolicyBreadcrumb items={crumbs} />
      <PageHeader
        title="Trial assignment"
        description={`A dry run of auto assignment on ${trialConversations.length} fixed sample conversations (TR-…) at a fixed time, using the policies, inboxes, teams and agent availability as they are now. Nothing is assigned in Inbox and nothing is saved.`}
        actions={
          <Button size="sm" onClick={run} data-trial-run>
            <Play />
            {result ? "Run again" : "Run trial"}
          </Button>
        }
      />
      {result ? (
        <>
          <div className="flex flex-wrap gap-2 text-sm" data-trial-summary>
            <Badge variant="secondary" className="tabular-nums">
              {result.assigned} assigned
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {result.skipped} not assigned
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs" data-trial-counts>
            Open conversations counted from Inbox (assigned by hand or automatically) / capacity limit:{" "}
            {countLines.join(" · ") || "no capacity limits on these inboxes"}
          </p>
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Step</TableHead>
                  <TableHead>Conversation</TableHead>
                  <TableHead>Inbox</TableHead>
                  <TableHead>Waiting</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Other agents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => {
                  const c = conversation(row.conversationId);
                  const team = c?.teamId ? teams.find((t) => t.id === c.teamId) : undefined;
                  return (
                    <TableRow
                      key={row.conversationId}
                      data-trial-row={row.conversationId}
                      data-reason={row.reason}
                      data-agent-id={row.agentId ?? ""}
                    >
                      <TableCell className="text-muted-foreground tabular-nums">{row.step ?? "–"}</TableCell>
                      <TableCell>
                        <div className="font-medium">{row.conversationId}</div>
                        <div className="text-muted-foreground text-xs">
                          {[
                            team ? `Team ${team.name}` : null,
                            ...(c?.labels ?? []),
                            c && c.status !== "open" ? c.status : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{inboxes.find((i) => i.id === row.inboxId)?.name ?? `Inbox ${row.inboxId}`}</TableCell>
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {c ? `created ${hours(c.createdHoursAgo)} · active ${hours(c.lastActivityHoursAgo)} ago` : "—"}
                      </TableCell>
                      <TableCell>{assignmentPolicies.find((p) => p.id === row.policyId)?.name ?? "—"}</TableCell>
                      <TableCell>
                        {row.agentId !== null ? (
                          <Badge>{agentName(row.agentId)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">{reasonText[row.reason]}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-72 text-muted-foreground text-xs">
                        {row.dropped.length
                          ? row.dropped.map((d) => `${agentName(d.agentId)}: ${dropText[d.why]}`).join("; ")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <Card className="flex flex-row items-center gap-3 p-6 text-muted-foreground text-sm">
          <FlaskConical className="size-5 shrink-0" />
          Run the trial to see which agent each sample conversation would go to, and why.
        </Card>
      )}
    </div>
  );
}

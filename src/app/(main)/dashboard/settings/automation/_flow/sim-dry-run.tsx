"use client";
// M129-B (item 129.1, condition 5): the dry run plays the whole flow in the Studio simulator (sim-engine.ts), one
// made-up conversation per channel: every message it would send and when (waits move the clock forward), each branch
// it takes, what each action changes, and each attachment checked for that channel, with the refusals in red and
// their sources. Nothing is sent and no real conversation changes.
import * as React from "react";

import { cn } from "cn";
import { CircleCheck, CircleDot, CircleX, Dices, ExternalLink, Info, Send, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import { MultiPick } from "../../labels/_shared/settings-ui";
import { CreateInDavis } from "./calendar-action";
import type { FlowDoc, SimChannel } from "./model";
import { CHANNELS, eventCarriesMessage, isSimEvent, SIM_CHANNELS, SIM_EVENTS } from "./sim-catalog";
import {
  defaultScenario,
  formatOffset,
  type SimContext,
  type SimLevel,
  type SimRun,
  type SimScenario,
  simulateAll,
} from "./sim-engine";
import { MakeItReal } from "./work-action-fields";

const LEVEL_LOOK: Record<SimLevel, { icon: React.ElementType; tone: string }> = {
  info: { icon: CircleDot, tone: "text-muted-foreground" },
  send: { icon: Send, tone: "text-sky-700 dark:text-sky-400" },
  ok: { icon: CircleCheck, tone: "text-emerald-700 dark:text-emerald-400" },
  warning: { icon: TriangleAlert, tone: "text-amber-700 dark:text-amber-400" },
  error: { icon: CircleX, tone: "text-destructive" },
};

const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function RunCard({
  run,
  start,
  flowName,
  flowId,
  onJump,
}: {
  run: SimRun;
  start: Date;
  flowName: string;
  flowId: string;
  onJump: (nodeId: string) => void;
}) {
  return (
    <section
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border p-3"
      data-sim-channel={run.channel}
      data-sim-sends={run.sends}
      data-sim-errors={run.errors}
      aria-label={`${CHANNELS[run.channel].label} timeline`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-sm">{CHANNELS[run.channel].label}</p>
        <span className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-400">
            {run.sends} sent
          </span>
          {run.errors ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">{run.errors} refused</span>
          ) : null}
          {run.warnings ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400">
              {run.warnings} warning{run.warnings === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
      </div>
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5" data-testid="sim-timeline">
        {run.steps.map((step, index) => {
          const look = LEVEL_LOOK[step.level];
          const at = new Date(start.getTime() + step.at * 1000);
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: timeline lines have no id; order is the identity.
              key={index}
              className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 break-words text-xs leading-relaxed"
              data-sim-level={step.level}
            >
              <span className="pt-px text-muted-foreground tabular-nums" title={at.toLocaleString()}>
                {formatOffset(step.at)}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className={cn("flex items-start gap-1.5", look.tone)}>
                  <look.icon className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0">
                    {step.step && step.nodeId ? (
                      <button
                        type="button"
                        className="me-1 font-medium underline-offset-4 hover:underline"
                        onClick={() => step.nodeId && onJump(step.nodeId)}
                      >
                        {step.step}:
                      </button>
                    ) : null}
                    <span dir="auto">{step.title}</span>
                  </span>
                </span>
                {step.detail ? (
                  <span className="ps-5 text-muted-foreground" dir="auto">
                    {step.detail}
                  </span>
                ) : null}
                {step.calendarAction ? (
                  <CreateInDavis
                    values={step.calendarAction.values}
                    at={new Date(step.calendarAction.at)}
                    flowName={flowName}
                  />
                ) : null}
                {step.work ? (
                  <MakeItReal
                    kind={step.work.kind}
                    values={step.work.values}
                    at={new Date(step.work.at)}
                    flow={{ id: flowId, name: flowName }}
                  />
                ) : null}
                {step.source?.url ? (
                  <a
                    href={step.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 ps-5 text-primary underline-offset-4 hover:underline"
                  >
                    Source: {step.source.label} <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="border-t pt-2 text-muted-foreground text-xs">{run.outcome}</p>
    </section>
  );
}

export function SimDryRun({ doc, ctx, onJump }: { doc: FlowDoc; ctx: SimContext; onJump: (nodeId: string) => void }) {
  const { labels: labelNames } = useLivePickerNames(); // F-6B: the live labels, not the seed
  const trigger = doc.nodes.find((node) => node.kind === "trigger");
  const event = trigger?.kind === "trigger" ? trigger.event : "message_created";
  const [scenario, setScenario] = React.useState<SimScenario>(() => defaultScenario(doc));
  const [channels, setChannels] = React.useState<SimChannel[]>(() =>
    trigger?.kind === "trigger" && trigger.channels?.length ? trigger.channels : SIM_CHANNELS,
  );
  const set = (patch: Partial<SimScenario>) => setScenario((current) => ({ ...current, ...patch }));
  const runs = React.useMemo(() => simulateAll(doc, channels, scenario, ctx), [doc, channels, scenario, ctx]);
  const hasAsk = doc.nodes.some((n) => n.kind === "ask");
  const hasSplit = doc.nodes.some((n) => n.kind === "split");
  const hasWait = doc.nodes.some((n) => n.kind === "wait");
  const once = trigger?.kind === "trigger" && trigger.repeat === "once_per_contact";
  const details = isSimEvent(event) ? SIM_EVENTS[event].details : undefined;
  const totals = runs.reduce((sum, run) => ({ sends: sum.sends + run.sends, errors: sum.errors + run.errors }), {
    sends: 0,
    errors: 0,
  });

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" data-testid="sim-dry-run">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border bg-muted/30 p-3 [&_.grid]:min-w-0">
        <p className="flex items-center gap-1.5 font-medium text-sm">
          <Info className="size-3.5" /> The made-up situation
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <Label>Channels</Label>
          <MultiPick
            className="min-w-0 max-w-full"
            options={SIM_CHANNELS.map((c) => CHANNELS[c].label)}
            value={channels.map((c) => CHANNELS[c].label)}
            onChange={(labels) => setChannels(SIM_CHANNELS.filter((c) => labels.includes(CHANNELS[c].label)))}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid gap-1.5">
            <Label htmlFor="sim-start">Starts at (your time)</Label>
            <Input
              id="sim-start"
              type="datetime-local"
              value={toLocalInput(scenario.start)}
              onChange={(e) => {
                const value = new Date(e.target.value);
                if (!Number.isNaN(value.getTime())) set({ start: value });
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sim-contact">Contact</Label>
            <NativeSelect
              id="sim-contact"
              className="w-full"
              value={`${scenario.contact}${scenario.ranBefore ? "-ran" : ""}`}
              onChange={(e) =>
                set({
                  contact: e.target.value.startsWith("new") ? "new" : "returning",
                  ranBefore: e.target.value.endsWith("-ran"),
                })
              }
            >
              <option value="new">New contact</option>
              <option value="returning">Returning contact</option>
              <option value="returning-ran">Returning, already ran this flow</option>
            </NativeSelect>
          </div>
        </div>
        {eventCarriesMessage(event) ? (
          <div className="grid gap-1.5">
            <Label htmlFor="sim-message">The customer's message</Label>
            <Input
              id="sim-message"
              value={scenario.messageText}
              onChange={(e) => set({ messageText: e.target.value })}
            />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="sim-last">The customer last wrote (hours before)</Label>
            <Input
              id="sim-last"
              type="number"
              min={0}
              className="w-28"
              value={scenario.lastMessageHoursAgo}
              onChange={(e) => set({ lastMessageHoursAgo: Math.max(0, Number(e.target.value)) })}
            />
          </div>
        )}
        {details ? (
          <div className="grid gap-1.5">
            <Label htmlFor="sim-detail">{SIM_EVENTS[event as keyof typeof SIM_EVENTS].label}: which one</Label>
            <NativeSelect
              id="sim-detail"
              className="w-full"
              value={scenario.eventDetail}
              onChange={(e) => set({ eventDetail: e.target.value })}
            >
              {details.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        {hasAsk ? (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
            <div className="grid gap-1.5">
              <Label htmlFor="sim-replies">To questions</Label>
              <NativeSelect
                id="sim-replies"
                className="w-full"
                value={scenario.replies}
                onChange={(e) => set({ replies: e.target.value as SimScenario["replies"] })}
              >
                <option value="reply">The customer replies</option>
                <option value="silent">No reply</option>
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sim-reply-text">Reply</Label>
              <Input
                id="sim-reply-text"
                value={scenario.replyText}
                onChange={(e) => set({ replyText: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sim-reply-after">After (s)</Label>
              <Input
                id="sim-reply-after"
                type="number"
                min={1}
                value={scenario.replyAfterSeconds}
                onChange={(e) => set({ replyAfterSeconds: Math.max(1, Number(e.target.value)) })}
              />
            </div>
          </div>
        ) : null}
        {hasSplit ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sim-split">Random split</Label>
              <NativeSelect
                id="sim-split"
                value={scenario.split}
                onChange={(e) => set({ split: e.target.value as SimScenario["split"] })}
              >
                <option value="random">At random</option>
                <option value="a">Always A</option>
                <option value="b">Always B</option>
              </NativeSelect>
            </div>
            {scenario.split === "random" ? (
              <Button variant="outline" size="sm" onClick={() => set({ seed: scenario.seed + 1 })}>
                <Dices /> Roll again
              </Button>
            ) : null}
          </div>
        ) : null}
        {hasWait ? (
          <div className="grid gap-1.5">
            <Label htmlFor="sim-during">During the rule's wait</Label>
            <NativeSelect
              id="sim-during"
              className="w-full"
              value={scenario.duringWait}
              onChange={(e) => set({ duringWait: e.target.value as SimScenario["duringWait"] })}
            >
              <option value="nothing">Nothing changes</option>
              <option value="customer_replies">The customer replies</option>
              <option value="teammate_replies">A teammate replies</option>
              <option value="status_changes">The status changes</option>
            </NativeSelect>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid gap-1.5">
            <Label htmlFor="sim-status">Conversation status</Label>
            <NativeSelect
              id="sim-status"
              className="w-full"
              value={scenario.status}
              onChange={(e) => set({ status: e.target.value as SimScenario["status"] })}
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="snoozed">Snoozed</option>
              <option value="resolved">Resolved</option>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <Label>Labels on it</Label>
            <MultiPick
              options={labelNames}
              value={scenario.labels}
              placeholder="None"
              onChange={(labels) => set({ labels })}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="sim-handoff">A teammate steps in</Label>
            <NativeSelect
              id="sim-handoff"
              className="w-full"
              value={scenario.handoff}
              onChange={(e) => set({ handoff: e.target.value as SimScenario["handoff"] })}
            >
              <option value="none">No</option>
              <option value="agent_replied">A teammate replies (the customer sees it)</option>
              <option value="agent_assigned">The conversation is assigned to a teammate</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sim-handoff-after">After (s)</Label>
            <Input
              id="sim-handoff-after"
              type="number"
              min={0}
              disabled={scenario.handoff === "none"}
              value={scenario.handoffAfterSeconds}
              onChange={(e) => set({ handoffAfterSeconds: Math.max(0, Number(e.target.value)) })}
            />
          </div>
        </div>
        {scenario.handoff !== "none" ? (
          <p className="text-muted-foreground text-xs" data-testid="sim-handoff-note">
            As in the engine, the bot answers while the conversation is Pending. A teammate&apos;s reply the customer
            sees, or an assignment to a teammate, hands it over: it becomes Open and the flow stops. A private note or
            typing does not stop it.
          </p>
        ) : null}
        {once ? (
          <p className="text-muted-foreground text-xs">
            This flow runs once per contact: choose “Returning, already ran this flow” to see it skipped.
          </p>
        ) : null}
      </div>
      <p className="text-sm" role="status" data-testid="sim-summary">
        {totals.sends} message{totals.sends === 1 ? "" : "s"} would be sent across {runs.length} channel
        {runs.length === 1 ? "" : "s"}
        {totals.errors ? `, ${totals.errors} refused (format, size or reply window)` : ""}. Nothing was sent.
      </p>
      {runs.map((run) => (
        <RunCard
          key={run.channel}
          run={run}
          start={scenario.start}
          flowName={ctx.flowName}
          flowId={ctx.flowId}
          onJump={onJump}
        />
      ))}
    </div>
  );
}

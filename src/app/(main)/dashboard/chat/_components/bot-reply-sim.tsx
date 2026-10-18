"use client";

// F-19 (Fahad 82 "the human comes before the bot" and 87 "I am with the world standard"): a person's reply stops the
// bot. The preview has no live bot, so a conversation the bot holds (Pending, nobody assigned: the "handled by a bot"
// banner) offers "Simulate bot reply": the bot's next reply waits WAIT_S seconds, then is sent only if the conversation
// is still the bot's. The rules, from Chatwoot v4.18.0 (Captain, the bot that ships with Chatwoot):
// - Just before posting, the bot checks again that the conversation is still Pending, and posts nothing when a person
//   took over meanwhile ("a human took over mid-run; bail out rather than posting a stale ... message on top of their
//   reply"): enterprise/app/jobs/captain/conversation/response_builder_job.rb process_response (line 70), elsif
//   conversation_pending? -> process_standard_response.
//   https://github.com/chatwoot/chatwoot/blob/v4.18.0/enterprise/app/jobs/captain/conversation/response_builder_job.rb#L70-L92
// - An agent's reply the customer sees (not a private note) opens a Pending conversation the bot holds, with the activity
//   "Conversation was marked open automatically after an agent reply": enterprise/app/models/enterprise/message.rb
//   mark_pending_conversation_as_open_for_human_response (line 41) and config/locales/en.yml
//   conversations.activity.captain.auto_opened_after_agent_reply.
//   https://github.com/chatwoot/chatwoot/blob/v4.18.0/enterprise/app/models/enterprise/message.rb#L41-L62
// - Assigning a person also takes it from the bot (app/services/conversations/assignment_service.rb, F-11's source).
// The check reads the preview server, so a reply, an assignment or a Take over made in another browser stops it too.
// The F-11 Dry run of the automation flows uses the same words: "Stopped: agent replied" / "Stopped: agent assigned".
// WAIT_S is the preview's own pause, so a teammate has time to reply first; Chatwoot's bot posts as soon as its answer
// is ready. A reply the bot sends is kept in the preview like any reply (written by "Bot") and reaches nobody.
import { type ReactNode, useEffect, useState } from "react";

import { Bot, ChevronDown, ChevronUp, CircleStop, FlaskConical, X } from "lucide-react";
import { create } from "zustand";

import { Button } from "@/components/ui/button";
import { SIMULATED, type SimMessage, type SimStatus } from "@/lib/cw/preview-sim";
import { SimBadge } from "@/lib/cw/preview-sim-ui";
import { useCwShared } from "@/lib/cw/store";
import { currentViewer } from "@/lib/cw/view-as";

import { useCwStore } from "./cw-store";
import { changeStatus, keepMessage, whenKept } from "./sim-thread-persist";

const WAIT_S = 30;
/** Chatwoot config/locales/en.yml conversations.activity.captain.auto_opened_after_agent_reply. */
export const AUTO_OPENED = "Conversation was marked open automatically after an agent reply";
const BOT_TEXT = "Thanks for your message. I am checking this for you now.";
/** How long the send-time check may take; without an answer the bot does not post (it cannot know nobody replied). */
const CHECK_MS = 20_000;
/** F-19 note 2: while the bot waits, this page asks the preview every WATCH_MS whether a person took over elsewhere
 * (another tab or browser replied, assigned or opened the conversation). Chatwoot's bot checks once, just before
 * posting (response_builder_job.rb), but its run is instant; the preview waits WAIT_S s, so a page that only checked
 * at the end would keep counting to 30 while a reply already arrived in the other browser. Stopping at the first
 * check that finds a person keeps the countdown honest without a reload. */
const WATCH_MS = 2000;

type Stop = "replied" | "assigned" | "opened";
type Run =
  | { state: "waiting"; startedAt: number }
  | { state: "checking"; startedAt: number }
  /** elsewhere: found on the preview server (another tab or browser), so this page does not show it until a reload. */
  | { state: "stopped"; stop: Stop; who: string; at: string; elsewhere?: boolean }
  | { state: "sent"; at: string }
  | { state: "failed"; message: string };

const useBotRuns = create<Record<number, Run | undefined>>(() => ({}));
const timers = new Map<number, ReturnType<typeof setTimeout>>();
/** The while-waiting check (WATCH_MS): asks the preview whether a person took over, so this page stops without a reload. */
const watchers = new Map<number, ReturnType<typeof setInterval>>();
const setRun = (convId: number, run: Run | undefined) => useBotRuns.setState({ [convId]: run });
const clock = (at: string) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const agentName = (id: number | null | undefined) =>
  useCwShared.getState().agents.find((agent) => agent.id === id)?.name ?? (id ? `agent #${id}` : "an agent");

function stopRun(convId: number, stop: Stop, who: string, at = new Date().toISOString(), elsewhere = false) {
  clearTimeout(timers.get(convId));
  timers.delete(convId);
  clearInterval(watchers.get(convId));
  watchers.delete(convId);
  setRun(convId, { state: "stopped", stop, who, at, elsewhere });
}

const isActive = (run: Run | undefined) => run?.state === "waiting" || run?.state === "checking";

/**
 * Called by the reply box when the person sends a reply the customer sees (not a note). Stops a bot reply waiting in
 * this conversation, and opens a conversation the bot holds, as Chatwoot does (see the top of this file).
 */
export function agentReplied(convId: number, options: { resolving: boolean }) {
  const viewer = currentViewer();
  if (isActive(useBotRuns.getState()[convId])) stopRun(convId, "replied", viewer.name);
  const meta = useCwStore.getState().meta[convId];
  // Send and resolve: the resolve that follows takes it from the bot already.
  if (meta?.status === "pending" && meta.assigneeId === null && !options.resolving)
    void changeStatus([convId], "open", { quiet: true, label: AUTO_OPENED });
}

interface Saved {
  messages: SimMessage[];
  statuses: SimStatus[];
}

/** Why the bot must not post now, from this page and from the preview server (another browser's changes). */
async function whyStop(convId: number, startedAt: number): Promise<{ stop: Stop; who: string; at?: string } | null> {
  const since = new Date(startedAt).toISOString();
  const [sim, panel] = await Promise.all([
    fetch("/api/preview-sim", { cache: "no-store", signal: AbortSignal.timeout(CHECK_MS) }).then((r) =>
      r.ok ? (r.json() as Promise<{ data?: Saved }>) : Promise.reject(new Error(`${r.status} ${r.statusText}`)),
    ),
    fetch("/api/preview-sim/panel", { cache: "no-store", signal: AbortSignal.timeout(CHECK_MS) }).then((r) =>
      r.ok
        ? (r.json() as Promise<{ state?: { meta?: Record<string, { assigneeId?: number | null }> } | null }>)
        : Promise.reject(new Error(`${r.status} ${r.statusText}`)),
    ),
  ]);
  const reply = (sim.data?.messages ?? [])
    .filter((m) => m.convId === convId && m.kind === "outgoing" && m.by !== 0 && m.at >= since)
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  if (reply) return { stop: "replied", who: reply.byName, at: reply.at };
  const savedMeta = panel.state?.meta?.[String(convId)];
  const assignee =
    savedMeta && "assigneeId" in savedMeta ? savedMeta.assigneeId : useCwStore.getState().meta[convId]?.assigneeId;
  if (assignee) return { stop: "assigned", who: agentName(assignee) };
  const newest = (sim.data?.statuses ?? [])
    .filter((s) => s.convId === convId)
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1);
  const status = newest?.status ?? useCwStore.getState().meta[convId]?.status;
  if (status && status !== "pending") return { stop: "opened", who: newest?.byName ?? "someone", at: newest?.at };
  return null;
}

async function fire(convId: number) {
  timers.delete(convId);
  clearInterval(watchers.get(convId));
  watchers.delete(convId);
  const run = useBotRuns.getState()[convId];
  if (run?.state !== "waiting") return;
  setRun(convId, { state: "checking", startedAt: run.startedAt });
  let why: Awaited<ReturnType<typeof whyStop>>;
  try {
    why = await whyStop(convId, run.startedAt);
  } catch (error) {
    // Not sure it is still the bot's: like Chatwoot's check, no answer means no post.
    setRun(convId, {
      state: "failed",
      message: `Not sent: the preview could not check whether a person took over (${error instanceof Error ? error.message : String(error)}).`,
    });
    return;
  }
  if (useBotRuns.getState()[convId]?.state !== "checking") return; // stopped on this page meanwhile
  if (why) {
    stopRun(convId, why.stop, why.who, why.at, true);
    return;
  }
  const id = keepMessage(convId, { kind: "outgoing", text: BOT_TEXT, from: { id: 0, name: "Bot" } });
  const kept = await whenKept(id);
  setRun(
    convId,
    kept.ok
      ? { state: "sent", at: new Date().toISOString() }
      : { state: "failed", message: `The bot's reply was not saved in the preview (${kept.message}).` },
  );
}

function start(convId: number) {
  clearTimeout(timers.get(convId));
  clearInterval(watchers.get(convId));
  setRun(convId, { state: "waiting", startedAt: Date.now() });
  timers.set(
    convId,
    setTimeout(() => void fire(convId), WAIT_S * 1000),
  );
  // F-19 note 2: while the bot waits, stop as soon as another tab or browser replies (the wait is the preview's own).
  watchers.set(
    convId,
    setInterval(() => void watch(convId), WATCH_MS),
  );
}

/** One while-waiting check: stop the run when the preview (another tab or browser) shows a person took over. */
async function watch(convId: number) {
  const run = useBotRuns.getState()[convId];
  if (run?.state !== "waiting") return;
  let why: Awaited<ReturnType<typeof whyStop>>;
  try {
    why = await whyStop(convId, run.startedAt);
  } catch {
    return; // a check that could not answer changes nothing here; the send-time check in fire() is the strict one
  }
  // Still waiting, and a person took over meanwhile: stop now instead of counting to WAIT_S. This page just learned
  // it from the preview, so the outcome is shown here as it happens (no "reload this page" hint, that is for the
  // send-time check in fire(), which only reports after the wait).
  if (why && useBotRuns.getState()[convId]?.state === "waiting") stopRun(convId, why.stop, why.who, why.at);
}

function cancel(convId: number) {
  clearTimeout(timers.get(convId));
  timers.delete(convId);
  clearInterval(watchers.get(convId));
  watchers.delete(convId);
  setRun(convId, undefined);
}

const STOP_TITLE: Record<Stop, string> = {
  replied: "Stopped: agent replied",
  assigned: "Stopped: agent assigned",
  opened: "Stopped: conversation opened",
};

function stopText(run: Extract<Run, { state: "stopped" }>) {
  return `${stopReason(run)}${run.elsewhere ? " It happened in another tab or browser: reload this page to see it." : ""}`;
}

function stopReason(run: Extract<Run, { state: "stopped" }>) {
  const when = clock(run.at);
  if (run.stop === "replied")
    return `${run.who} replied (${when}), so the bot's reply was not sent. A person's reply comes first: the bot posts only while the conversation is still Pending.`;
  if (run.stop === "assigned")
    return `The conversation is assigned to ${run.who}, so the bot's reply was not sent. The bot posts only while nobody is assigned.`;
  return `The conversation is no longer Pending (changed by ${run.who}), so the bot's reply was not sent.`;
}

/** Chatwoot conversation.json BOT_HANDOFF_MESSAGE with the fallback assignee "a bot". */
const HANDLED_BY_BOT = "This conversation is currently handled by a bot.";

/** A stopped run's outcome as short as a narrow bar needs it; the whole sentence is under Details. */
function stopShort(run: Extract<Run, { state: "stopped" }>) {
  if (run.stop === "replied") return `${run.who}, ${clock(run.at)}`;
  if (run.stop === "assigned") return `assigned to ${run.who}`;
  return `changed by ${run.who}`;
}

/** A stopped run's outcome in one sentence, for a wide bar. */
function stopSummary(run: Extract<Run, { state: "stopped" }>) {
  if (run.stop === "replied") return `${run.who} replied (${clock(run.at)}), so the bot's reply was not sent.`;
  if (run.stop === "assigned") return `Assigned to ${run.who}, so the bot's reply was not sent.`;
  return `No longer Pending (changed by ${run.who}), so the bot's reply was not sent.`;
}

const rowButton = "h-5 shrink-0 gap-1 px-1.5 text-[11px]";

/**
 * The bot's hand-off banner and the simulated bot reply, in ONE bar of one line (26 px).
 * F-25 (F-19's note: with the banner, the "Test it" block and the "Stopped" block stacked above the reply box, a 768 px
 * tall window at 1024 wide left the messages 39 px): idle it reads "<hand-off banner> [Simulate bot reply] [Take over]";
 * while the bot waits it shows the countdown and Cancel; when the run ended it shows the outcome in one line with a
 * Details button that opens the rest of the sentence (closed by default) and a button to dismiss it. The hand-off
 * sentence is Chatwoot's whole sentence when the bar is wide and "Handled by a bot" when it is narrow (the whole
 * sentence stays in its tooltip). The spacing around the bar is the notices wrapper's (conversation-pane.tsx).
 */
export function BotReplySim({
  convId,
  botOwned,
  onTakeOver,
}: {
  convId: number;
  botOwned: boolean;
  /** Chatwoot's "Take over": assigns the conversation to the person and opens it (conversation-pane.tsx). */
  onTakeOver: () => void;
}) {
  const run = useBotRuns((state) => state[convId]);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const waiting = run?.state === "waiting";
  useEffect(() => {
    if (!waiting) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [waiting]);
  // A new outcome starts closed.
  const outcome = run && !isActive(run) ? run.state : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `convId` and the outcome are what close the details.
  useEffect(() => setOpen(false), [convId, outcome]);
  // Taken over on this page (Take over, an assignment, a status change): the waiting reply stops at once.
  const meta = useCwStore((state) => state.meta[convId]);
  useEffect(() => {
    if (!isActive(run) || botOwned || !meta) return;
    if (meta.assigneeId) stopRun(convId, "assigned", agentName(meta.assigneeId));
    else stopRun(convId, "opened", currentViewer().name);
  }, [botOwned, convId, meta, run]);

  if (!run && !botOwned) return null;
  // `now` is last set by the 500 ms tick; never earlier than the start, so the first frame reads 30 s.
  const left =
    run?.state === "waiting"
      ? Math.max(0, Math.ceil((run.startedAt + WAIT_S * 1000 - Math.max(now, run.startedAt)) / 1000))
      : 0;
  const done = run && !isActive(run) ? run : null;

  // How a finished run ended: the outcome in one line, the rest of its sentence under Details.
  let full = "";
  let line: ReactNode = null;
  if (done?.state === "stopped") {
    full = `${STOP_TITLE[done.stop]}. ${stopText(done)}`;
    line = (
      <span className="flex min-w-0 flex-1 items-center gap-1.5" data-bot-reply-stopped={done.stop}>
        <CircleStop className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="truncate">
          <strong>{STOP_TITLE[done.stop]}</strong>. <span className="@md:hidden">{stopShort(done)}</span>
          <span className="@md:inline hidden">{stopSummary(done)}</span>
        </span>
      </span>
    );
  } else if (done?.state === "sent") {
    full = `Sent by the bot (${clock(done.at)}): no agent had replied. Saved in this preview; it reached nobody.`;
    line = (
      <span className="min-w-0 flex-1 truncate" data-bot-reply-sent="">
        <strong>Sent by the bot</strong> ({clock(done.at)}). <span className="@md:hidden">Reached nobody.</span>
        <span className="@md:inline hidden">No agent had replied. Saved in this preview; it reached nobody.</span>
      </span>
    );
  } else if (done?.state === "failed") {
    full = done.message;
    line = (
      <span className="min-w-0 flex-1 truncate text-destructive" data-bot-reply-failed="">
        {done.message}
      </span>
    );
  }

  // The one line of the bar: the outcome of a finished run, the countdown, the check, or the idle controls.
  let row: ReactNode;
  if (done) {
    row = (
      <>
        {/* The visible line is cut to the bar; the whole sentence is the paragraph under it (read by screen readers). */}
        <span className="flex min-w-0 flex-1" aria-hidden="true">
          {line}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          className="size-5"
          aria-label={open ? "Hide details" : "Show details"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          data-bot-reply-details=""
        >
          {open ? <ChevronUp /> : <ChevronDown />}
        </Button>
        <Button size="icon-xs" variant="ghost" className="size-5" aria-label="Dismiss" onClick={() => cancel(convId)}>
          <X />
        </Button>
      </>
    );
  } else if (run?.state === "waiting") {
    row = (
      <>
        <span className="flex min-w-0 flex-1 items-center gap-1.5" data-bot-reply-waiting="">
          <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate" aria-hidden="true">
            Bot reply in {left} s unless an agent replies first
          </span>
          <span className="sr-only">The bot will reply in {left} s unless an agent replies first.</span>
        </span>
        <Button size="xs" variant="ghost" className={rowButton} onClick={() => cancel(convId)}>
          Cancel
        </Button>
        {/* Chatwoot's Take over stays reachable while the bot waits when the bar is wide enough. */}
        <Button size="xs" variant="outline" className={`${rowButton} @md:inline-flex hidden`} onClick={onTakeOver}>
          Take over
        </Button>
      </>
    );
  } else if (run?.state === "checking") {
    row = (
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">Checking whether a person took over…</span>
      </span>
    );
  } else {
    row = (
      <>
        <span className="flex min-w-0 flex-1 items-center gap-1.5" title={HANDLED_BY_BOT}>
          <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="@md:hidden truncate">Handled by a bot</span>
          <span className="@md:inline hidden truncate">{HANDLED_BY_BOT}</span>
          <span className="sr-only @md:hidden">{HANDLED_BY_BOT}</span>
        </span>
        <Button
          size="xs"
          variant="outline"
          className={`${rowButton} border-amber-500/50 border-dashed`}
          title={`${SIMULATED}: the bot's next reply waits ${WAIT_S} s, and a reply from any agent stops it. It reaches nobody.`}
          onClick={() => start(convId)}
          data-bot-reply-start=""
        >
          <FlaskConical className="text-amber-700 dark:text-amber-300" /> Simulate bot reply
        </Button>
        <Button size="xs" variant="outline" className={rowButton} onClick={onTakeOver}>
          Take over
        </Button>
        <SimBadge label={SIMULATED} className="@xl:inline-flex hidden h-4 py-0 leading-3" />
      </>
    );
  }

  return (
    <div
      data-bot-reply-sim=""
      role="status"
      title={done ? full : undefined}
      className="@container flex shrink-0 flex-col gap-1 overflow-hidden rounded-md border border-dashed bg-muted/40 px-2 py-0.5 text-xs"
    >
      <div className="flex min-h-5 items-center gap-2">{row}</div>
      {done && (
        <p className={open ? "pb-1 text-muted-foreground" : "sr-only"} data-bot-reply-details-text="">
          {full}
        </p>
      )}
    </div>
  );
}

"use client";
// T-139: what the canvas draws: one card per step (respond.io's card: icon, "Type #n", a short summary, a red
// border when it has a problem), the lines between them with a "+" to put a step in between, the "+" under a free
// exit, and the palette of steps (drag onto the canvas, or press to add under the selected step).
// M129-B (items 129.1, 129.2): the seven steps that were shown locked ("Ask a question", "Wait between steps", "Random
// split", "HTTP request", "Go to another flow", "Update a contact field", "Once per contact") now work: they are
// drawn, edited and played by the Studio simulator (sim-engine.ts). Nothing is shown locked any more.
import * as React from "react";

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  Handle,
  type NodeProps,
  Position,
} from "@xyflow/react";
import { cn } from "cn";
import {
  BellRing,
  CalendarPlus,
  CirclePlay,
  Clock,
  CornerDownRight,
  FlaskConical,
  GitBranch,
  Hourglass,
  ListTodo,
  MessageCircleQuestion,
  Paperclip,
  Play,
  Plus,
  ReceiptText,
  Repeat,
  Shuffle,
  TriangleAlert,
  UserPen,
  Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRODUCT_NAME } from "@/config/app-config";

import { CALENDAR_ACTION, specSummary } from "./calendar-event";
import { actionDefs, attributeDefs, durationText, eventLabels, triggerLabels } from "./catalog";
import { mediaSummary } from "./media";
import { EXIT_LABELS, type Handle as Exit, exitsOf, type FlowNode, type NodeKind } from "./model";
import { CHANNELS, isSimEvent, KIND_LABELS, SIM_EVENTS, SIM_STEP_INFO } from "./sim-catalog";
import { kindOfAction, workSummary } from "./work-actions";

export const KIND_LOOK: Record<NodeKind, { label: string; icon: React.ElementType; tone: string }> = {
  // F-10 (Fahad 125.3): the trigger is where the flow starts, drawn as a circle in the BPMN 2.0 standard (Start Event,
  // OMG BPMN 2.0.2 §10.5.2 / ISO/IEC 19510); CirclePlay = that circle with "start". Not the lightning.
  trigger: { label: KIND_LABELS.trigger, icon: CirclePlay, tone: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  wait: { label: KIND_LABELS.wait, icon: Clock, tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  condition: {
    label: KIND_LABELS.condition,
    icon: GitBranch,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  action: { label: KIND_LABELS.action, icon: Play, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  ask: {
    label: KIND_LABELS.ask,
    icon: MessageCircleQuestion,
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  delay: { label: KIND_LABELS.delay, icon: Hourglass, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  split: { label: KIND_LABELS.split, icon: Shuffle, tone: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400" },
  http: { label: KIND_LABELS.http, icon: Webhook, tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  goto: { label: KIND_LABELS.goto, icon: CornerDownRight, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
};

const ellipsis = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The lines a card shows: the same words the text form uses. */
export function summaryOf(node: FlowNode, derivedEvent?: string, flowName?: (id: string) => string): string[] {
  switch (node.kind) {
    case "trigger": {
      const event = isSimEvent(node.event) ? SIM_EVENTS[node.event].label : eventLabels[node.event];
      const lines = [derivedEvent && derivedEvent !== event ? `${derivedEvent} (set by the wait)` : event];
      if (node.event === "scheduled" && node.schedule)
        lines.push(`${node.schedule.mode === "once" ? node.schedule.date : node.schedule.mode} ${node.schedule.time}`);
      if (node.event === "label_added") lines.push(`Label: ${node.label || "…"}`);
      if (node.detail) lines.push(node.detail);
      if (node.channels?.length) lines.push(`Only: ${node.channels.map((c) => CHANNELS[c].label).join(", ")}`);
      if (node.repeat === "once_per_contact") lines.push("Once per contact");
      return lines.map((l) => ellipsis(l));
    }
    case "wait":
      return [
        triggerLabels[node.wait.trigger] + (node.wait.trigger === "conversation_status" ? `: ${node.wait.status}` : ""),
        `For ${durationText(node.wait.amount, node.wait.unit)} · ${node.wait.inboxes.length ? node.wait.inboxes.join(", ") : "All inboxes"}`,
      ];
    case "condition": {
      const lines = node.rows.map((row, index) => {
        const label = attributeDefs[row.attribute]?.label ?? (row.attribute || "Choose a field");
        const values =
          row.operator === "Is present" ||
          row.operator === "Is not present" ||
          row.operator === "Is open" ||
          row.operator === "Is closed"
            ? ""
            : ` ${row.values.filter(Boolean).join(", ") || "…"}`;
        return `${index ? `${row.join.toUpperCase()} ` : ""}${label} ${row.operator.toLowerCase()}${values}`;
      });
      return lines.length > 3
        ? [...lines.slice(0, 3).map((l) => ellipsis(l)), `+${lines.length - 3} more`]
        : lines.map((l) => ellipsis(l));
    }
    case "action": {
      const def = actionDefs[node.action.action];
      if (node.action.action === "send_attachment") return [def.label, ellipsis(mediaSummary(node.action.media))];
      // M129-G: the event's title and when, not the raw values (calendar id, numbers)
      if (node.action.action === CALENDAR_ACTION) return [def.label, ellipsis(specSummary(node.action.values))];
      // F-11: the task's title and assignee, the invoice's customer and item, the notification's teammate and text
      if (kindOfAction(node.action.action))
        return [def.label, ellipsis(workSummary(node.action.action, node.action.values))];
      if (def?.input === "key_value")
        return [def.label, ellipsis(`${node.action.values[0] || "…"} = ${node.action.values[1] || "…"}`)];
      const values = node.action.values.filter(Boolean).join(", ");
      return [
        def?.label ?? node.action.action,
        ...(values ? [ellipsis(values)] : []),
        ...(node.action.message ? [ellipsis(node.action.message)] : []),
      ];
    }
    case "ask":
      return [
        ellipsis(node.ask.question || "Write the question"),
        ...(node.ask.answers.length ? [ellipsis(`Buttons: ${node.ask.answers.join(" | ")}`)] : []),
        `No reply after ${durationText(node.ask.timeout.amount, node.ask.timeout.unit)}`,
      ];
    case "delay":
      return [`Wait ${durationText(node.delay.amount, node.delay.unit)}`];
    case "split":
      return [`A ${node.split.percentA}% · B ${100 - node.split.percentA}%`];
    case "http":
      return [ellipsis(`${node.http.method} ${node.http.url || "…"}`), `Simulated answer ${node.http.mockStatus}`];
    case "goto":
      return [
        ellipsis(node.goto.flowId ? `Go to: ${flowName?.(node.goto.flowId) ?? node.goto.flowId}` : "Choose a flow"),
      ];
  }
}

export interface StepData extends Record<string, unknown> {
  node: FlowNode;
  title: string;
  summary: string[];
  errors: string[];
  warnings: string[];
  free: Exit[];
}

/** Callbacks the cards and lines need, given once through context so the canvas data stays plain. */
export interface CanvasActions {
  addAfter: (sourceId: string, handle: Exit, kind: NodeKind, variant?: string) => void;
  canAddAfter: (sourceId: string, handle: Exit, kind: NodeKind, variant?: string) => string | null;
}
export const CanvasActionsContext = React.createContext<CanvasActions | null>(null);

/** One entry of the palette and of the "+" menus. `variant` starts an action as that action. */
export interface StepChoice {
  id: string;
  kind: NodeKind;
  variant?: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  tone: string;
  sim?: true;
}

const look = (kind: NodeKind) => ({ icon: KIND_LOOK[kind].icon, tone: KIND_LOOK[kind].tone });

export const STEP_CHOICES: StepChoice[] = [
  {
    id: "condition",
    kind: "condition",
    label: "Condition",
    hint: "Check fields; Yes and Else lead to different steps",
    ...look("condition"),
  },
  {
    id: "action",
    kind: "action",
    label: "Action",
    hint: "Label, assign, reply, note, email, webhook…",
    ...look("action"),
  },
  {
    id: "wait",
    kind: "wait",
    label: "Wait",
    hint: "An engine rule's wait: 10 minutes to 30 days, right after the trigger",
    ...look("wait"),
  },
  { id: "ask", kind: "ask", label: SIM_STEP_INFO.ask.label, hint: SIM_STEP_INFO.ask.hint, sim: true, ...look("ask") },
  {
    id: "delay",
    kind: "delay",
    label: SIM_STEP_INFO.delay.label,
    hint: SIM_STEP_INFO.delay.hint,
    sim: true,
    ...look("delay"),
  },
  {
    id: "split",
    kind: "split",
    label: SIM_STEP_INFO.split.label,
    hint: SIM_STEP_INFO.split.hint,
    sim: true,
    ...look("split"),
  },
  {
    id: "http",
    kind: "http",
    label: SIM_STEP_INFO.http.label,
    hint: SIM_STEP_INFO.http.hint,
    sim: true,
    ...look("http"),
  },
  {
    id: "goto",
    kind: "goto",
    label: SIM_STEP_INFO.goto.label,
    hint: SIM_STEP_INFO.goto.hint,
    sim: true,
    ...look("goto"),
  },
  {
    id: "update_contact_field",
    kind: "action",
    variant: "update_contact_field",
    label: "Update a contact field",
    hint: "Saves a value on the contact, such as their language or consent",
    sim: true,
    icon: UserPen,
    tone: KIND_LOOK.action.tone,
  },
  {
    // M129-G (item 129.8): an event in the Calendar page's calendar (Davis)
    id: "create_calendar_event",
    kind: "action",
    variant: "create_calendar_event",
    label: "Create calendar event",
    hint: "Adds an event to a calendar on the Calendar page, a set number of days after the trigger",
    sim: true,
    icon: CalendarPlus,
    tone: KIND_LOOK.action.tone,
  },
  // F-11 (Fahad L6, item 91): a task on the Tasks page (Twenty), a draft on Invoices (Bigcapital), a bell notification
  {
    id: "create_twenty_task",
    kind: "action",
    variant: "create_twenty_task",
    label: "Create task",
    hint: "Adds a task to the Tasks page with its assignee and due date",
    sim: true,
    icon: ListTodo,
    tone: KIND_LOOK.action.tone,
  },
  {
    id: "create_invoice_draft",
    kind: "action",
    variant: "create_invoice_draft",
    label: "Create draft invoice",
    hint: "Adds a draft invoice to Invoices for a customer and item; never delivered or emailed",
    sim: true,
    icon: ReceiptText,
    tone: KIND_LOOK.action.tone,
  },
  {
    id: "notify_teammate",
    kind: "action",
    variant: "notify_teammate",
    label: "Notify a teammate",
    hint: "Sends an internal notification to an agent or a team; it shows in the bell",
    sim: true,
    icon: BellRing,
    tone: KIND_LOOK.action.tone,
  },
  {
    id: "send_attachment",
    kind: "action",
    variant: "send_attachment",
    label: "Send attachment",
    hint: "Image, video, voice note, document, contact card or location, checked for every channel",
    icon: Paperclip,
    tone: KIND_LOOK.action.tone,
  },
];

const choiceKey = (choice: Pick<StepChoice, "kind" | "variant">) =>
  choice.variant ? `${choice.kind}:${choice.variant}` : choice.kind;

/** "kind" or "kind:variant", as the palette drags it. */
export function parseChoice(value: string): { kind: NodeKind; variant?: string } | null {
  const [kind, variant] = value.split(":");
  return STEP_CHOICES.some((c) => c.kind === kind && (c.variant ?? "") === (variant ?? ""))
    ? { kind: kind as NodeKind, ...(variant ? { variant } : {}) }
    : null;
}

function AddMenu({
  sourceId,
  handle,
  label,
  className,
  style,
}: {
  sourceId: string;
  handle: Exit;
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const actions = React.useContext(CanvasActionsContext);
  if (!actions) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          aria-label={label}
          style={style}
          className={cn("nodrag nopan size-6 rounded-full bg-background shadow-xs", className)}
          onClick={(event) => event.stopPropagation()}
        >
          <Plus className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-[70vh] w-72 overflow-y-auto">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Add a step here</DropdownMenuLabel>
        {STEP_CHOICES.map((choice, index) => {
          const problem = actions.canAddAfter(sourceId, handle, choice.kind, choice.variant);
          return (
            <React.Fragment key={choice.id}>
              {choice.sim && !STEP_CHOICES[index - 1]?.sim ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-muted-foreground text-xs">
                    {PRODUCT_NAME} simulator steps
                  </DropdownMenuLabel>
                </>
              ) : null}
              <DropdownMenuItem
                disabled={!!problem}
                data-add-choice={choice.id}
                // M129-B: after the menu closes, the mouse's click lands on the step under it and React Flow selects
                // that step; adding a moment later keeps the NEW step selected, so its settings open
                onSelect={() =>
                  window.setTimeout(() => actions.addAfter(sourceId, handle, choice.kind, choice.variant), 0)
                }
                className="items-start"
              >
                <choice.icon className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span>{choice.label}</span>
                  {problem ? <span className="text-muted-foreground text-xs leading-snug">{problem}</span> : null}
                </span>
              </DropdownMenuItem>
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const handleClass =
  "!size-3 !border-2 !border-muted-foreground/60 !bg-background transition-colors hover:!border-primary [&.connectingto]:!border-primary [&.valid]:!border-emerald-500";

export function StepNode({ data, selected }: NodeProps) {
  const step = data as StepData;
  const { node } = step;
  const look = KIND_LOOK[node.kind];
  const Icon = look.icon;
  const hasErrors = step.errors.length > 0;
  return (
    <div
      data-step-id={node.id}
      data-step-kind={node.kind}
      data-errors={step.errors.length}
      className={cn(
        "relative w-[272px] rounded-xl border bg-card text-card-foreground shadow-xs transition-shadow motion-reduce:transition-none",
        selected && "border-primary ring-2 ring-primary/30",
        hasErrors && "border-destructive ring-2 ring-destructive/20",
      )}
    >
      {node.kind !== "trigger" ? (
        <Handle
          type="target"
          position={Position.Top}
          id="in"
          className={handleClass}
          aria-label={`${step.title}: input`}
        />
      ) : null}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", look.tone)}>
          <Icon className="size-3.5" />
        </span>
        <span className="truncate font-medium text-sm">{step.title}</span>
        {hasErrors || step.warnings.length ? (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-[11px]",
              hasErrors ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            <TriangleAlert className="size-3" />
            {hasErrors ? step.errors.length : step.warnings.length}
          </span>
        ) : null}
      </div>
      <div className="grid gap-0.5 px-3 py-2 text-muted-foreground text-xs leading-relaxed" dir="auto">
        {step.summary.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: summary lines have no id; order is the identity.
          <span key={index} className={cn("truncate", index === 0 && "text-foreground")}>
            {line}
          </span>
        ))}
      </div>
      {exitsOf(node).length === 2 ? (
        exitsOf(node).map((exit, index) => {
          const at = index === 0 ? "28%" : "72%";
          let word = EXIT_LABELS[exit];
          if (node.kind === "split") word = `${word} ${index === 0 ? node.split.percentA : 100 - node.split.percentA}%`;
          // respond.io's Ask a Question: "Replied" and "No reply after <time>"
          if (node.kind === "ask" && exit === "noreply")
            word = `No reply after ${durationText(node.ask.timeout.amount, node.ask.timeout.unit)}`;
          return (
            <React.Fragment key={exit}>
              <Handle
                type="source"
                position={Position.Bottom}
                id={exit}
                style={{ left: at }}
                className={handleClass}
                aria-label={`${step.title}: ${EXIT_LABELS[exit]} exit`}
              />
              <span
                className={cn(
                  "pointer-events-none absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-[11px]",
                  index === 0
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
                style={{ left: at }}
              >
                {word}
              </span>
              {step.free.includes(exit) ? (
                <AddMenu
                  sourceId={node.id}
                  handle={exit}
                  label={`Add a step under ${step.title} ${EXIT_LABELS[exit]}`}
                  className="absolute top-full mt-8 -translate-x-1/2"
                  style={{ left: at }}
                />
              ) : null}
            </React.Fragment>
          );
        })
      ) : exitsOf(node).length === 1 ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="out"
            className={handleClass}
            aria-label={`${step.title}: output`}
          />
          {step.free.includes("out") ? (
            <AddMenu
              sourceId={node.id}
              handle="out"
              label={`Add a step under ${step.title}`}
              className="absolute top-full left-1/2 mt-3 -translate-x-1/2"
            />
          ) : null}
        </>
      ) : (
        <span className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          Continues in the other flow
        </span>
      )}
    </div>
  );
}

/** A line, with a "+" in the middle that puts a new step between its two ends. */
export function StepEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    selected,
    source,
    sourceHandleId,
  } = props;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ strokeWidth: selected ? 2.5 : 1.5 }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          <AddMenu
            sourceId={source}
            handle={(sourceHandleId ?? "out") as Exit}
            label="Add a step on this line"
            className="size-5 opacity-80 hover:opacity-100"
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const PALETTE_DRAG_TYPE = "application/x-studio-automation-step";

export function Palette({
  compact,
  onAdd,
  canAdd,
  onOncePerContact,
}: {
  compact: boolean;
  onAdd: (kind: NodeKind, variant?: string) => void;
  canAdd: (kind: NodeKind, variant?: string) => string | null;
  /** Opens the trigger's "Once per contact / Every time" setting. */
  onOncePerContact: () => void;
}) {
  const item = (choice: StepChoice) => {
    const problem = canAdd(choice.kind, choice.variant);
    return (
      <button
        key={choice.id}
        type="button"
        draggable
        data-palette-kind={choice.variant ? undefined : choice.kind}
        data-palette-item={choice.id}
        onDragStart={(event) => {
          event.dataTransfer.setData(PALETTE_DRAG_TYPE, choiceKey(choice));
          event.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onAdd(choice.kind, choice.variant)}
        title={problem ?? `${choice.label}: drag onto the canvas, or press to add under the selected step`}
        data-unavailable={problem ? "true" : undefined}
        aria-label={`Add ${choice.variant ? choice.label : KIND_LOOK[choice.kind].label}`}
        className={cn(
          "flex cursor-grab items-start gap-2 rounded-lg border bg-card p-2 text-left outline-none transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing motion-reduce:transition-none",
          compact && "justify-center p-2",
        )}
      >
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", choice.tone)}>
          <choice.icon className="size-4" />
        </span>
        {!compact ? (
          <span className="grid gap-0.5">
            <span className="font-medium text-sm">{choice.label}</span>
            <span className="text-muted-foreground text-xs leading-snug">{choice.hint}</span>
            {problem ? (
              <span className="text-amber-700 text-xs leading-snug dark:text-amber-400">Here: {problem}</span>
            ) : null}
          </span>
        ) : null}
      </button>
    );
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        {!compact ? <p className="px-1 font-medium text-muted-foreground text-xs">Steps</p> : null}
        {STEP_CHOICES.filter((c) => !c.sim).map(item)}
      </div>
      <div className="grid gap-1.5" data-slot="simulator-steps">
        {!compact ? (
          <p className="flex items-center gap-1 px-1 font-medium text-muted-foreground text-xs">
            <FlaskConical className="size-3" /> {PRODUCT_NAME} simulator steps
          </p>
        ) : (
          <span className="mx-auto h-px w-8 bg-border" aria-hidden />
        )}
        {STEP_CHOICES.filter((c) => c.sim).map(item)}
        <button
          type="button"
          data-palette-item="once_per_contact"
          onClick={onOncePerContact}
          title="Once per contact or every time: set on the trigger"
          aria-label="Once per contact: set on the trigger"
          className={cn(
            "flex items-start gap-2 rounded-lg border border-dashed bg-card p-2 text-left outline-none transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
            compact && "justify-center p-2",
          )}
        >
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", KIND_LOOK.trigger.tone)}>
            <Repeat className="size-4" />
          </span>
          {!compact ? (
            <span className="grid gap-0.5">
              <span className="font-medium text-sm">Once per contact</span>
              <span className="text-muted-foreground text-xs leading-snug">
                Set on the trigger: run once for each contact, or every time
              </span>
            </span>
          ) : null}
        </button>
        {!compact ? (
          <p className="px-1 text-muted-foreground text-xs leading-snug">
            The engine's (v4.18) rules cannot run these steps; a flow that uses one runs in the {PRODUCT_NAME} simulator
            (Dry run) and sends nothing to real customers.
          </p>
        ) : null}
      </div>
    </div>
  );
}

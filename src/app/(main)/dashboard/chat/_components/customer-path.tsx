"use client";

// T-96 «مسار العميل» in the inbox. T-141 (Fahad item 59, 00:45): «Labels ومسار العميل كلاهما نفس الايقونات والمعنا والشكل
// والتاثير بينما فعليا هذه مستوحاه من دورة الحياة … ظاهرة في الصندوق الشات من ضمن الخيارات … وفي حال كانت كثيره يسبح لها
// شريط يتحرك … ايضا من ضمن الفلتره … يستوحى من ريسبوند».
// So the stages are drawn as a path, not as labels: ordered chevron steps (each keeps its colour dot), the steps before
// the contact's stage filled lightly and its own stage filled, under the route icon (Labels: tag icon, round chips).
// respond.io Lifecycle: set from the conversation ("Add or remove a Lifecycle stage", "Clear selection") and filter
// conversations by stage. When the steps do not fit, the strip scrolls sideways with arrows at both ends.
// T-285 (Fahad 124.4-124.8): the feature's English name is the one agreed for «مسار العميل», Customer Path (the UI is
// English first). Each stage is marked by an icon of what it means in the stage's colour (Recent ✦, Important ★,
// Needs follow-up ◷ …), not a numbered chevron that read as a flag; the stage the contact is at is tinted with its
// colour and keeps the normal text colour, not a solid fill with white text.
import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  CreditCard,
  type LucideIcon,
  RotateCw,
  Route,
  Settings2,
  Shuffle,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  customerPath,
  type PathStage,
  pathKeyOf,
  useCustomerPath,
  useHydrateCustomerPath,
} from "@/lib/cw/customer-path";

import type { Conversation } from "./cw-data";

export function StageDot({ color }: { color: string }) {
  return <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

/** The feature's name in the UI (Fahad 124.4: the English name agreed for «مسار العميل»). */
export const CUSTOMER_PATH = "Customer Path";

// The six starting stages by meaning; a stage added in Settings gets the plain step mark.
const stageIcons: Record<string, LucideIcon> = {
  recent: Sparkles,
  important: Star,
  "follow-up": Clock,
  payments: CreditCard,
  "our-customer": BadgeCheck,
  random: Shuffle,
};

/** A stage's mark: its icon in its colour. */
export function StageIcon({ stage, className }: { stage: PathStage; className?: string }) {
  const Icon = stageIcons[stage.id] ?? CircleDot;
  return (
    <span data-slot="stage-icon" aria-hidden="true" className="inline-flex shrink-0" style={{ color: stage.color }}>
      <Icon className={cn("size-3.5", className)} strokeWidth={2.25} />
    </span>
  );
}

const NOTCH = "0.5rem";
// A path step: an arrow pointing to the next stage; every step after the first has the notch of the one before.
const chevron = (first: boolean) =>
  `polygon(0 0, calc(100% - ${NOTCH}) 0, 100% 50%, calc(100% - ${NOTCH}) 100%, 0 100%${first ? "" : `, ${NOTCH} 50%`})`;
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/** One stage's mark for lists (Settings, the Inbox bar): its icon on a light tint of its colour; the number is its place. */
export function StageStep({ stage, index, className }: { stage: PathStage; index: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="stage-step"
      title={`Stage ${index + 1}`}
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md", className)}
      style={{ backgroundColor: tint(stage.color, 16) }}
    >
      <StageIcon stage={stage} className="size-3" />
    </span>
  );
}

/**
 * The stages in order as one path. `currentId` is filled with its colour, the steps before it lightly. With
 * `onSelect` every step is a button. Scrolls sideways when the steps do not fit, with an arrow at each hidden end.
 */
export function PathStrip({
  stages,
  currentId,
  onSelect,
  className,
}: {
  stages: PathStage[];
  currentId?: string;
  onSelect?: (stage: PathStage) => void;
  className?: string;
}) {
  const scroller = useRef<HTMLOListElement>(null);
  const [ends, setEnds] = useState({ start: false, end: false });
  const currentIndex = stages.findIndex((stage) => stage.id === currentId);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () =>
      setEnds({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  // The contact's stage is scrolled into sight when the strip opens or the stage changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the stage or the list changes
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>("[data-current=true]");
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentId, stages.length]);

  const move = (direction: 1 | -1) =>
    scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.7, behavior: "smooth" });

  return (
    <div className={cn("relative flex w-full min-w-0 items-center gap-1", className)} data-slot="customer-path-strip">
      {ends.start && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          aria-label="Earlier stages"
          title="Earlier stages"
          onClick={() => move(-1)}
        >
          <ChevronLeft />
        </Button>
      )}
      <ol
        ref={scroller}
        aria-label={CUSTOMER_PATH}
        className="flex min-w-0 flex-1 snap-x gap-0.5 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        {stages.map((stage, index) => {
          const current = index === currentIndex;
          const passed = currentIndex >= 0 && index < currentIndex;
          const style = {
            clipPath: chevron(index === 0),
            backgroundColor: current ? tint(stage.color, 26) : passed ? tint(stage.color, 12) : undefined,
          };
          const classes = cn(
            "flex h-7 shrink-0 items-center gap-1.5 text-foreground text-xs",
            index === 0 ? "ps-2.5 pe-4" : "ps-4 pe-4",
            current ? "font-semibold" : !passed && "bg-muted",
          );
          const body = (
            <>
              <StageIcon stage={stage} />
              <span dir="auto" className="max-w-36 truncate">
                {stage.name}
              </span>
            </>
          );
          return (
            <li key={stage.id} className="flex shrink-0 snap-start" data-current={current} data-stage={stage.name}>
              {onSelect ? (
                <button
                  type="button"
                  aria-pressed={current}
                  title={current ? `${stage.name} (current stage)` : `Move to ${stage.name}`}
                  className={cn(
                    classes,
                    "outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  style={style}
                  onClick={() => onSelect(stage)}
                >
                  {body}
                </button>
              ) : (
                <span className={classes} style={style}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {ends.end && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          aria-label="Later stages"
          title="Later stages"
          onClick={() => move(1)}
        >
          <ChevronRight />
        </Button>
      )}
    </div>
  );
}

/** "Not saved" with the reason and Retry, while the last change is not in the shared save. */
export function CustomerPathSaveNotice({ className }: { className?: string }) {
  const status = useCustomerPath((s) => s.status);
  const error = useCustomerPath((s) => s.error);
  if (status !== "error") return null;
  return (
    <div role="alert" className={cn("flex items-start gap-2 text-destructive text-xs", className)}>
      <span className="min-w-0 flex-1">Not saved: {error}</span>
      <Button variant="outline" size="xs" onClick={() => customerPath.retry()}>
        <RotateCw /> Retry
      </Button>
    </div>
  );
}

function useStageOf(conversation: Conversation) {
  const stages = useCustomerPath((s) => s.stages);
  const stageId = useCustomerPath((s) => s.assigned[pathKeyOf(conversation.id)]);
  return { stages, stageId, current: stages.find((stage) => stage.id === stageId) };
}

/**
 * The contact panel of a conversation: the path, set by clicking a step (respond.io "Select the Lifecycle stage").
 * T-285 (Fahad 124.4): it sits right above the phone number and stands out as the product's own feature: a framed
 * block under its name, not a plain row among the contact details.
 */
export function CustomerPath({ conversation }: { conversation: Conversation }) {
  useHydrateCustomerPath();
  const { stages, stageId, current } = useStageOf(conversation);

  return (
    <div
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 rounded-lg border border-primary/25 bg-primary/5 p-2"
      data-slot="customer-path"
    >
      <div className="flex items-center gap-1.5 text-xs">
        <Route className="size-3.5 text-primary" />
        <span className="font-semibold">{CUSTOMER_PATH}</span>
        <span className="ms-auto flex items-center gap-1">
          {current ? (
            <Button
              variant="ghost"
              size="xs"
              className="h-5 px-1 text-xs"
              onClick={() => customerPath.setStage(conversation.id, null)}
            >
              Clear selection
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5"
            aria-label="Add stages in Settings"
            title="Add stages in Settings"
            asChild
          >
            <Link href="/dashboard/settings/customer-path">
              <Settings2 />
            </Link>
          </Button>
        </span>
      </div>
      <PathStrip
        stages={stages}
        currentId={stageId}
        onSelect={(stage) => customerPath.setStage(conversation.id, stage.id === stageId ? null : stage.id)}
      />
      <CustomerPathSaveNotice />
    </div>
  );
}

/**
 * The conversation header's option (beside Status, SLA and Labels): the route icon and the contact's stage; it opens
 * the path to move the contact to another stage.
 */
export function CustomerPathOption({ conversation, className }: { conversation: Conversation; className?: string }) {
  useHydrateCustomerPath();
  const [open, setOpen] = useState(false);
  const { stages, stageId, current } = useStageOf(conversation);
  const index = stages.findIndex((stage) => stage.id === stageId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("min-w-0 max-w-72", className)}
          data-slot="customer-path-option"
          aria-label={current ? `${CUSTOMER_PATH}: ${current.name}` : CUSTOMER_PATH}
        >
          <Route />
          {/* F-13 (Fahad 124.7, «حديث» / Recent): the stage keeps its field's name beside it. Alone, "Recent" beside the
              status read as a state of the conversation, not a Customer Path stage; an icon alone does not say what it
              stands for (https://www.nngroup.com/articles/icon-usability/), as a lifecycle stage is shown with its
              field's label in a record (https://knowledge.hubspot.com/records/use-lifecycle-stages). */}
          <span className="shrink-0">{CUSTOMER_PATH}</span>
          {current ? (
            <span
              data-slot="customer-path-option-stage"
              className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-medium text-foreground text-xs"
              style={{ backgroundColor: tint(current.color, 20) }}
            >
              <StageIcon stage={current} className="size-3" />
              <span dir="auto" className="truncate">
                {current.name}
              </span>
            </span>
          ) : null}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="grid w-[min(34rem,calc(100vw-2rem))] grid-cols-[minmax(0,1fr)] gap-2 p-3"
      >
        <div className="flex items-center gap-1.5 text-sm">
          <Route className="size-4 text-muted-foreground" />
          <span className="font-medium">{CUSTOMER_PATH}</span>
          <span className="text-muted-foreground text-xs">
            {current ? `Stage ${index + 1} of ${stages.length}` : `${stages.length} stages`}
          </span>
        </div>
        <PathStrip
          stages={stages}
          currentId={stageId}
          onSelect={(stage) => {
            customerPath.setStage(conversation.id, stage.id);
            setOpen(false);
          }}
        />
        <CustomerPathSaveNotice />
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          {current ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                customerPath.setStage(conversation.id, null);
                setOpen(false);
              }}
            >
              <X /> Clear selection
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" size="xs" asChild>
            <Link href="/dashboard/settings/customer-path">
              <Settings2 /> Add stages in Settings
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

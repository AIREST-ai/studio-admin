"use client";
// T-243 (item 93): what a flow made with "Use template" carries in the editor (and after a reload, from
// FlowRecord.template): which template, how complete its draft is, where its effect lands, what it is missing
// (contracts G01…), the steps still to fill in, and the channel limits. Also the badges and channel list the
// template gallery shows, so both say the same thing. Nothing here saves or sends anything.
// M129-B: no "after linking" badge any more: a template's draft runs in the Studio simulator (or as Chatwoot rules),
// and each gap says how the simulator covers it.
// F-4 (item 124.8): every text of the template (channel notes, limits, gap titles, the fill-in labels) is the English
// one; the Arabic fields stay in the data for the translation later and are not read here.
import * as React from "react";

import { cn } from "cn";
import { ChevronDown, LayoutTemplate } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/config/app-config";

import { ToneBadge } from "../../labels/_shared/settings-ui";
import { actionError, conditionError } from "./catalog";
import type { FlowDoc, FlowNode } from "./model";
import {
  availabilityLabels,
  buildableLabels,
  channelLabels,
  confidenceLabels,
  findTemplate,
  gapCover,
  gapTitle,
  instantiateTemplate,
  slotLabel,
  TEMPLATE_CHANNELS,
  type TemplateEntry,
  type TemplateRef,
  templateRunsInSimulator,
  templateSends,
} from "./templates";

const availabilityTone = { available: "green", conditional: "amber", unavailable: "gray" } as const;
const buildableTone = { full: "green", partial: "amber", none: "red" } as const;
/** The badges a template card and the editor notice share: draft, where it runs, confidence, and what it sends. */
export function TemplateBadges({ template, compact = false }: { template: TemplateEntry; compact?: boolean }) {
  const buildable = template.editor_today.buildable;
  const sim = templateRunsInSimulator(template);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToneBadge tone={buildable === "none" ? "violet" : buildableTone[buildable]}>
        {buildableLabels[buildable]}
      </ToneBadge>
      {compact ? null : (
        <ToneBadge tone={sim ? "violet" : "green"}>
          {sim ? `Runs in the ${PRODUCT_NAME} simulator` : "Engine rules · simulator dry run"}
        </ToneBadge>
      )}
      {template.confidence !== "certain" ? (
        <ToneBadge tone={template.confidence === "guess" ? "red" : "gray"}>
          {/* item 116 fix: "ours" is never shown raw, compact or not */}
          {compact && template.confidence !== "ours" ? template.confidence : confidenceLabels[template.confidence]}
        </ToneBadge>
      ) : null}
      {templateSends(template) && !compact ? <ToneBadge tone="sky">Sends in the simulator only</ToneBadge> : null}
    </div>
  );
}

/** The six channels with the matrix status and its note (T-242 catalog `channels`). */
export function ChannelList({ template }: { template: TemplateEntry }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Channels">
      {TEMPLATE_CHANNELS.map((channel) => {
        const cell = template.channels[channel];
        return (
          <li key={channel} className="grid gap-0.5 rounded-md border p-2">
            <span className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium">{channelLabels[channel]}</span>
              <ToneBadge tone={availabilityTone[cell.status]}>{availabilityLabels[cell.status]}</ToneBadge>
            </span>
            <span className="text-muted-foreground text-xs leading-relaxed">{cell.note_en}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** The capabilities Chatwoot v4.18 lacks for it (contracts.md G01…), each with how the simulator covers it. */
export function GapList({ template }: { template: TemplateEntry }) {
  if (!template.gaps.length) return null;
  return (
    <ul className="grid gap-1 text-xs" data-testid="gap-list">
      {template.gaps.map((gap) => {
        const cover = gapCover[gap];
        return (
          <li key={gap} className="grid gap-0.5" data-gap={gap} data-covered={cover?.covered ? "true" : "false"}>
            <span>
              <span className="font-mono text-muted-foreground">{gap}</span> {gapTitle(gap)}
            </span>
            {cover ? (
              <span
                className={
                  cover.covered ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                }
              >
                {cover.covered ? "In the simulator: " : ""}
                {cover.how}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function stepFilled(node: FlowNode) {
  if (node.kind === "condition") return node.rows.every((row) => !conditionError(row));
  if (node.kind === "action") return !actionError(node.action);
  if (node.kind === "ask") return !!node.ask.question.trim();
  if (node.kind === "http") return !!node.http.url.trim();
  if (node.kind === "goto") return !!node.goto.flowId;
  if (node.kind === "trigger" && node.event === "label_added") return !!node.label;
  return true;
}

export function TemplateNotice({
  template: ref,
  doc,
  compact,
  onJump,
}: {
  template: TemplateRef;
  doc: FlowDoc;
  compact: boolean;
  onJump: (nodeId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const detailsId = React.useId();
  const template = findTemplate(ref.id);
  // the steps the template left empty, on this draft's step ids (instantiateTemplate names them the same way each
  // time); a step deleted since is not listed
  const slots = React.useMemo(() => {
    if (!template) return [];
    try {
      return instantiateTemplate(template).slots.flatMap((slot) => {
        const node = doc.nodes.find((n) => n.id === slot.nodeId);
        return node ? [{ ...slot, filled: stepFilled(node) }] : [];
      });
    } catch {
      return [];
    }
  }, [template, doc]);
  const toFill = slots.filter((slot) => !slot.filled).length;

  if (!template)
    return (
      <div className="border-b bg-muted/40 px-3 py-1.5 text-muted-foreground text-xs" data-testid="template-notice">
        Started from template “{ref.id}”, which is no longer in the template library.
      </div>
    );

  return (
    <section
      aria-label="Template"
      className="border-b bg-muted/40 px-3 py-1.5 text-xs"
      data-testid="template-notice"
      data-template-id={template.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <LayoutTemplate className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0">
          From template <span className="font-medium">{template.title_en}</span>
        </span>
        <TemplateBadges template={template} compact={compact} />
        {toFill ? (
          <span className="text-amber-700 dark:text-amber-400" data-testid="template-to-fill">
            {toFill} field{toFill === 1 ? "" : "s"} to fill in
          </span>
        ) : null}
        <Button
          variant="ghost"
          className="ms-auto"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide details" : "Details"}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </div>
      {open ? (
        <div id={detailsId} className="mt-2 grid max-h-56 gap-3 overflow-y-auto pb-1">
          {template.editor_today.buildable === "partial" ? (
            <div className="grid gap-1">
              <span className="font-medium">What this partial draft does not do</span>
              <p className="leading-relaxed">{template.editor_today.limit_en}</p>
            </div>
          ) : null}
          {template.editor_today.buildable === "none" ? (
            <p className="leading-relaxed">
              This draft was written for the {PRODUCT_NAME} simulator: outside events (orders, calls, ads, ratings…) are
              made to happen in the Dry run, and every empty field is yours to fill in.
            </p>
          ) : null}
          {template.gaps.length ? (
            <div className="grid gap-1">
              <span className="font-medium">Not in the engine (v4.18.0), and how the simulator covers it</span>
              <GapList template={template} />
            </div>
          ) : null}
          {slots.length ? (
            <div className="grid gap-1">
              <span className="font-medium">Fill in before approving</span>
              <ul className="flex flex-wrap gap-1.5">
                {slots.map((slot) => (
                  <li key={`${slot.nodeId}-${slot.label_ar}`}>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => onJump(slot.nodeId)}
                      aria-label={`${slotLabel(template, slot.label_ar)}: ${slot.filled ? "filled" : "to fill in"}, go to the step`}
                    >
                      <span dir="auto">{slotLabel(template, slot.label_ar)}</span>
                      <ToneBadge tone={slot.filled ? "green" : "amber"}>{slot.filled ? "filled" : "to fill"}</ToneBadge>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid gap-1">
            <span className="font-medium">Channels</span>
            <ChannelList template={template} />
          </div>
          <p className="text-muted-foreground">
            Using a template made this draft only. It runs in the {PRODUCT_NAME} simulator's dry run; rules change only
            when you approve, and nothing is sent to real customers from this preview.
          </p>
        </div>
      ) : null}
    </section>
  );
}

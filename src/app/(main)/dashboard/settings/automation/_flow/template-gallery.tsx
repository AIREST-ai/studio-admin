"use client";
// T-243 (item 93): the template gallery (/dashboard/automation/templates), as the accepted design T-242 draws it
// (use-template-plan.md 1): the six categories and All, a search, "Start from scratch", and one card per template
// with its channels, its draft (full / partial / none) and where its effect lands. "Use template" opens a new draft
// in the visual editor (flow/new?template=<id>) and saves nothing; a template the editor cannot draw keeps its
// button disabled with what it needs. The idea of a reference gallery, none of its code, names or pictures.
// T-278 (item 112, plan-after-acceptance.md step 3): 87 templates. A "Type" filter (flow, approved message, inbox
// setting, macro, canned response), the "جديد" and "إبداعنا" badges, a requirements line (window, consent, approved
// message, cost with no number) and a button by kind (diff-contracts.md 2): only a flow opens the editor; the
// other kinds open the settings page they live on. No other platform is named in what the gallery shows (P6).
// Item 116: the library stays neutral for every market; the templates only an Arab audience needs (market: "arabic":
// Ramadan, Eid, the Arabic-only welcome) leave their categories for their own "Arabic" section and filter.
// M129-B (item 129.2, condition 1): no "Use template" is disabled any more. Every template opens a draft in the editor
// (a template the editor could not draw opens the simulator draft written for it, sim-drafts.ts); a message template,
// inbox setting, macro or canned response keeps its button to its settings page beside "Use template".
// F-4 (item 124.8): the gallery shows English only. The Arabic fields of the data (title_ar, what_it_does_ar, note_ar, ...)
// are kept for the translation later and are not read here; every text below is the *_en sibling. The title is
// title_en, so the Arabic line under it is gone. The search looks in the English text.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { ArrowLeft } from "lucide-react";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRODUCT_NAME } from "@/config/app-config";

import { PageHeader, plural } from "../../labels/_shared/settings-shell";
import { ToneBadge } from "../../labels/_shared/settings-ui";
import { ChannelList, GapList, TemplateBadges } from "./template-notice";
import {
  availabilityLabels,
  channelLabels,
  costLine,
  kindHomes,
  kindLabels,
  metaCategoryLabels,
  TEMPLATE_CHANNELS,
  type TemplateCategoryId,
  type TemplateEntry,
  type TemplateKind,
  templateCategories,
  templateHomeLine,
  templateHref,
  templateKind,
  templateRequirementLine,
  templates,
} from "./templates";

const LIST_HREF = "/dashboard/automation";
const SCRATCH_HREF = `${LIST_HREF}/flow/new`;
const mark = { available: "✓", conditional: "~", unavailable: "✕" } as const;
const markTone = {
  available: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  conditional: "border-amber-500/30 text-amber-700 dark:text-amber-400",
  unavailable: "border-border text-muted-foreground line-through",
} as const;

type Filter = "all" | TemplateCategoryId | "arabic";
const isArabic = (t: TemplateEntry) => t.market === "arabic";
const ARABIC_GROUP = {
  id: "arabic",
  title_en: "Arabic",
  note_en: "For an Arabic-speaking audience: Ramadan, Eid and the Arabic welcome",
} as const;
type KindFilter = "all" | TemplateKind;
const KINDS = Object.keys(kindLabels) as TemplateKind[];

function UseButton({ template }: { template: TemplateEntry }) {
  // T-278: a template that is not a flow also opens the page it lives on; M129-B: and every template opens a draft
  const kind = templateKind(template);
  return (
    <>
      <Button asChild data-testid="use-template">
        <Link href={templateHref(template.id)}>Use template</Link>
      </Button>
      {kind !== "workflow" ? (
        <Button asChild variant="outline" data-testid="open-home" data-kind={kind}>
          <Link href={kindHomes[kind].href}>{kindHomes[kind].label}</Link>
        </Button>
      ) : null}
    </>
  );
}

/** T-278: kind, "New", "Our own"; a flow keeps the T-243 badges, the other kinds never get a "works" badge (P5). */
function CardBadges({ template }: { template: TemplateEntry }) {
  const kind = templateKind(template);
  const category = template.message?.meta_category;
  return (
    // [&>div]:contents lets the T-243 badges flow on the same line as "New"
    <div className="flex flex-wrap items-center gap-1.5 [&>div]:contents" data-testid="template-badges">
      {template.new ? (
        <span data-testid="badge-new">
          <ToneBadge tone="sky">New</ToneBadge>
        </span>
      ) : null}
      {kind === "workflow" ? (
        <TemplateBadges template={template} />
      ) : (
        <>
          <span data-testid="badge-kind">
            <ToneBadge tone="teal">{kindLabels[kind]}</ToneBadge>
          </span>
          {kind === "message_template" ? (
            <ToneBadge tone="violet">
              Message template: needs Meta approval{category ? ` · ${metaCategoryLabels[category]}` : ""}
            </ToneBadge>
          ) : null}
          {template.provenance?.type === "ours" ? <ToneBadge tone="gray">Our own</ToneBadge> : null}
        </>
      )}
    </div>
  );
}

/** T-278: window, consent, approved message and cost, one short line; the cost never carries a number (P4). */
function RequirementLine({ template }: { template: TemplateEntry }) {
  const parts = templateRequirementLine(template);
  if (!parts.length) return null;
  return (
    <ul
      className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs leading-relaxed"
      aria-label="Requirements"
      data-testid="template-requirements"
    >
      {parts.map((part) => (
        <li key={part.key} data-requirement={part.key}>
          <span className="font-medium text-foreground">{part.label}:</span> {part.value}
        </li>
      ))}
    </ul>
  );
}

function TemplateCard({
  template,
  onDetails,
}: {
  template: TemplateEntry;
  onDetails: (button: HTMLButtonElement) => void;
}) {
  const titleId = React.useId();
  const home = templateHomeLine(template);
  const kind = templateKind(template);
  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4"
        data-testid="template-card"
        data-template-id={template.id}
        data-buildable={template.editor_today.buildable}
        data-kind={kind}
        data-new={template.new ? "true" : undefined}
      >
        <h3 id={titleId} className="font-semibold text-sm leading-snug">
          {template.title_en}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed" data-testid="template-what-it-does">
          {template.what_it_does_en}
        </p>
        <CardBadges template={template} />
        <ul className="flex flex-wrap gap-1" aria-label="Channels">
          {TEMPLATE_CHANNELS.map((channel) => {
            const status = template.channels[channel].status;
            return (
              <li
                key={channel}
                className={cn("rounded-md border px-1.5 py-0.5 text-[11px] leading-4", markTone[status])}
                aria-label={`${channelLabels[channel]}: ${availabilityLabels[status]}`}
                title={`${channelLabels[channel]}: ${availabilityLabels[status]}`}
              >
                <span aria-hidden>
                  {mark[status]} {channelLabels[channel]}
                </span>
              </li>
            );
          })}
        </ul>
        <RequirementLine template={template} />
        {template.message?.meta_category === "authentication" ? (
          <p className="text-xs leading-relaxed" data-testid="auth-note">
            Sends a code from an outside sign-in system; it does not verify identity
          </p>
        ) : null}
        {home ? (
          <p className="text-muted-foreground text-xs leading-relaxed" data-testid="template-home">
            {home}
          </p>
        ) : null}
        {template.editor_today.studio_setting && !template.new ? (
          <p className="text-muted-foreground text-xs">
            The engine also does this as a setting:{" "}
            <span className="font-mono">{template.editor_today.studio_setting}</span>
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <UseButton template={template} />
          <Button variant="outline" onClick={(event) => onDetails(event.currentTarget)} aria-haspopup="dialog">
            Details
          </Button>
        </div>
      </article>
    </li>
  );
}

/** An English label, then the template's English text. */
function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li>
      {label}: {children}
    </li>
  );
}

function TemplateDetails({
  template,
  onClose,
  returnFocus,
}: {
  template: TemplateEntry | null;
  onClose: () => void;
  /** the Details button that opened the dialog: focus goes back to it on close */
  returnFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Dialog open={!!template} onOpenChange={(open) => (open ? null : onClose())}>
      {template ? (
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{template.title_en}</DialogTitle>
            <DialogDescription>{template.what_it_does_en}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 text-sm">
            <CardBadges template={template} />
            <section className="grid gap-1">
              <h4 className="font-medium">The idea, step by step</h4>
              <ol className="grid gap-0.5 text-xs leading-relaxed">
                <Labelled label="Trigger">{template.reference_flow_en.trigger}</Labelled>
                {template.reference_flow_en.conditions.map((c) => (
                  <Labelled key={`c-${c}`} label="Condition">
                    {c}
                  </Labelled>
                ))}
                {template.reference_flow_en.actions.map((a) => (
                  <Labelled key={`a-${a}`} label="Action">
                    {a}
                  </Labelled>
                ))}
              </ol>
            </section>
            <section className="grid gap-1">
              <h4 className="font-medium">In the editor today</h4>
              {template.editor_today.buildable === "none" ? (
                // M129-B: the old line said what the editor lacked; the simulator draft now has it
                <p className="text-xs leading-relaxed" data-testid="details-sim-draft">
                  “Use template” opens a draft written for the {PRODUCT_NAME} simulator, with the steps this template
                  needs. Outside events (orders, calls, ads, ratings…) are made to happen in the Dry run, and the fields
                  left empty are yours to fill in.
                </p>
              ) : (
                <p className="text-xs leading-relaxed">{template.editor_today.limit_en}</p>
              )}
            </section>
            {template.gaps.length ? (
              <section className="grid gap-1">
                <h4 className="font-medium">Not in the engine (v4.18.0), and how the simulator covers it</h4>
                <GapList template={template} />
              </section>
            ) : null}
            {template.chatwoot_v4_18.mapping_en ? (
              <section className="grid gap-1">
                <h4 className="font-medium">In the engine (v4.18.0)</h4>
                <p className="text-xs leading-relaxed">{template.chatwoot_v4_18.mapping_en}</p>
              </section>
            ) : null}
            {template.message ? (
              <section className="grid gap-1" data-testid="details-message">
                <h4 className="font-medium">
                  The message (category {metaCategoryLabels[template.message.meta_category]})
                </h4>
                <ul className="grid gap-0.5 text-xs leading-relaxed">
                  {template.message.components_en.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                  {template.message.variables_en.length ? (
                    <Labelled label="Variables">{template.message.variables_en.join(", ")}</Labelled>
                  ) : null}
                </ul>
              </section>
            ) : null}
            {template.requirements ? (
              <section className="grid gap-1" data-testid="details-requirements">
                <h4 className="font-medium">Requirements</h4>
                <ul className="grid gap-0.5 text-xs leading-relaxed">
                  <Labelled label="Window">{template.requirements.window.note_en}</Labelled>
                  <Labelled label="Consent">{template.requirements.consent.note_en}</Labelled>
                  <Labelled label="Privacy">{template.requirements.privacy.note_en}</Labelled>
                  <Labelled label="Approved message">{template.requirements.approved_message.note_en}</Labelled>
                  <li>Cost: {costLine(template)}</li>
                </ul>
              </section>
            ) : null}
            <section className="grid gap-1">
              <h4 className="font-medium">When it works</h4>
              <p className="text-xs leading-relaxed">
                Now, in the {PRODUCT_NAME} simulator: “Use template” opens its draft and the Dry run plays it. Nothing
                is sent to real customers.
              </p>
              {template.linking ? <p className="text-xs leading-relaxed">{template.linking.condition_en}</p> : null}
            </section>
            <section className="grid gap-1">
              <h4 className="font-medium">Channels</h4>
              <ChannelList template={template} />
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <UseButton template={template} />
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function TemplateGallery() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [kindFilter, setKindFilter] = React.useState<KindFilter>("all");
  const [query, setQuery] = React.useState("");
  const [details, setDetails] = React.useState<TemplateEntry | null>(null);
  const detailsFrom = React.useRef<HTMLButtonElement | null>(null);
  const q = query.trim().toLowerCase();
  const titleOf = (id: TemplateCategoryId) => templateCategories.find((c) => c.id === id);
  const ofKind = templates.filter((t) => kindFilter === "all" || templateKind(t) === kindFilter);
  const shown = ofKind.filter((t) => {
    if (filter === "arabic" && !isArabic(t)) return false;
    if (filter !== "all" && filter !== "arabic" && (isArabic(t) || t.category !== filter)) return false;
    if (!q) return true;
    const category = isArabic(t) ? ARABIC_GROUP : titleOf(t.category);
    return [t.title_en, t.what_it_does_en, category?.title_en].join(" ").toLowerCase().includes(q);
  });
  // item 116: a category left with no general template (Ramadan and Eid) is not listed; its rows are under "Arabic"
  const generalCategories = templateCategories.filter((c) =>
    templates.some((t) => t.category === c.id && !isArabic(t)),
  );
  const groups = [
    ...generalCategories
      .filter((c) => filter === "all" || c.id === filter)
      .map((c) => ({
        id: c.id,
        title_en: c.title_en,
        note_en: "",
        items: shown.filter((t) => t.category === c.id && !isArabic(t)),
      })),
    ...(filter === "all" || filter === "arabic" ? [{ ...ARABIC_GROUP, items: shown.filter(isArabic) }] : []),
  ].filter((g) => g.items.length);
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: ofKind.length },
    ...generalCategories.map((c) => ({
      id: c.id,
      label: c.title_en,
      count: ofKind.filter((t) => t.category === c.id && !isArabic(t)).length,
    })),
    { id: "arabic", label: ARABIC_GROUP.title_en, count: ofKind.filter(isArabic).length },
  ];
  const kindFilters: { id: KindFilter; label: string; count: number }[] = [
    { id: "all", label: "All types", count: templates.length },
    ...KINDS.map((k) => ({
      id: k,
      label: kindLabels[k],
      count: templates.filter((t) => templateKind(t) === k).length,
    })),
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="template-gallery">
      <Link
        href={LIST_HREF}
        className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Automation
      </Link>
      <PageHeader
        title="Templates"
        description="Start a flow from a ready template. Using one opens a new draft in the visual editor: nothing is saved until you save it, the rules change only when you approve, and nothing is sent from this preview."
        actions={
          <Button variant="outline" asChild>
            <Link href={SCRATCH_HREF}>Start from scratch</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Template categories" className="min-w-0">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {filters.map((f) => (
              <li key={f.id} className="shrink-0">
                <Button
                  variant={filter === f.id ? "secondary" : "ghost"}
                  aria-pressed={filter === f.id}
                  // T-278: the longer new category names wrap in the side column instead of pushing the count out
                  className="w-full justify-between gap-3 lg:h-auto lg:min-h-8 lg:whitespace-normal lg:text-start"
                  data-filter={f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="text-muted-foreground text-xs tabular-nums">{f.count}</span>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0" data-testid="kind-filter">
            <legend className="sr-only">Template type</legend>
            <span className="me-1 text-muted-foreground text-xs">Type:</span>
            {kindFilters.map((k) => (
              <Button
                key={k.id}
                size="sm"
                variant={kindFilter === k.id ? "secondary" : "ghost"}
                aria-pressed={kindFilter === k.id}
                className="gap-1.5"
                data-kind={k.id}
                onClick={() => setKindFilter(k.id)}
              >
                {k.label}
                <span className="text-muted-foreground text-xs tabular-nums">{k.count}</span>
              </Button>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <ExpandingSearch
              name="templates"
              label="Search templates"
              placeholder="Search templates..."
              size="default"
              className="w-full sm:w-72"
              value={query}
              onChange={setQuery}
            />
            <span className="text-muted-foreground text-sm tabular-nums" role="status" data-testid="template-count">
              {plural(shown.length, "template", "templates")}
            </span>
          </div>
          {groups.length ? (
            groups.map((group) => (
              <section
                key={group.id}
                aria-labelledby={`cat-${group.id}`}
                className="grid gap-2"
                data-testid="template-group"
                data-group={group.id}
              >
                <h2 id={`cat-${group.id}`} className="font-medium text-base">
                  {group.title_en}
                  {group.note_en ? (
                    <span className="ms-2 font-normal text-muted-foreground text-sm" data-testid="group-note">
                      {group.note_en}
                    </span>
                  ) : null}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {group.items.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      onDetails={(button) => {
                        detailsFrom.current = button;
                        setDetails(t);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="rounded-xl border p-8 text-center text-muted-foreground text-sm">
              No template matches “{query}”.
            </p>
          )}
        </div>
      </div>
      <TemplateDetails template={details} onClose={() => setDetails(null)} returnFocus={detailsFrom} />
    </div>
  );
}

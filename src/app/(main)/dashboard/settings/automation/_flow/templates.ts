// T-243 (item 93): the template library behind "Use template" (accepted design T-242, use-template-plan.md).
// A template is plain data (template-data.ts); using one makes a NEW draft in the editor: fresh step ids, the
// steps re-linked, every placeholder left empty so the editor's own checks mark it "required", nothing saved until
// "Save draft". The template itself never changes. Templates the editor cannot draw today ("none") have no draft
// and cannot be used; they show what is missing instead. Plain data and functions only (no React).
// T-278 (item 112, plan-after-acceptance.md step 2): 51 rows from the accepted T-273 design join the 36. They keep
// their own field names (TemplateRowV2, template-schema-v2.ts) and are read here as TemplateEntry; every current field
// stays. A row's kind says where it lives: only a "workflow" opens the editor, the others open their settings page.
// M129-B (item 129.2, condition 1): no template is locked any more. A template the editor could not draw now opens
// the draft written for it in sim-drafts.ts (Studio simulator steps and events), so every "Use template" works. The
// library's Arabic notes that said a template works only "after linking" are read with the simulator's words
// (simText), because the simulator runs them now; the data file itself is not edited.
// F-4 (item 124.8): the UI text is English first. Every Arabic field of the data (title_ar, what_it_does_ar, note_ar, ...)
// stays as it is, for the translation later, and has an English sibling (what_it_does_en, note_en, ...) which is the
// only one the gallery, the template notice and a new flow's description read. Nothing here shows an Arabic field.

import { PRODUCT_NAME } from "@/config/app-config";

import { type Action, actionError, type Condition, conditionError, type EventKey } from "./catalog";
import type { FlowDoc, FlowEdge, FlowNode, Handle, NodeKind, WaitData } from "./model";
import { isSimDoc } from "./sim-catalog";
import { simDraftDoc } from "./sim-drafts";
import { templateGapTitlesEn, templateLibrary } from "./template-data";

export const TEMPLATE_CHANNELS = ["whatsapp", "instagram", "facebook", "tiktok", "email", "website"] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];
export type TemplateCategoryId =
  | "auto_responder"
  | "routing"
  | "business"
  | "reporting"
  | "meta_ads"
  | "tiktok_ads"
  | "commerce_orders"
  | "appointments"
  | "seasonal_sa"
  | "service_quality"
  | "message_blueprints";
export type Availability = "available" | "conditional" | "unavailable";
export type TemplateScope = "works_in_preview" | "after_linking" | "needs_missing_capability";
export type Buildable = "full" | "partial" | "none";
export type TemplateKind = "workflow" | "message_template" | "inbox_setting" | "macro" | "quick_reply";
export type MetaCategory = "utility" | "marketing" | "authentication";

type DraftNode =
  | { id: string; kind: "trigger"; position: { x: number; y: number }; event: EventKey }
  | { id: string; kind: "wait"; position: { x: number; y: number }; wait: WaitData }
  | { id: string; kind: "condition"; position: { x: number; y: number }; rows: Condition[] }
  | { id: string; kind: "action"; position: { x: number; y: number }; action: Action };

export interface TemplatePlaceholder {
  key: string;
  node: string;
  field: "values" | "message";
  label_ar: string;
  /** F-4: the English the notice shows */
  label_en: string;
  source: "inboxes" | "teams" | "agents" | "labels" | "priority" | "sla" | "free_text" | "url" | "attachment";
}

export interface ChannelCell {
  status: Availability;
  note_ar: string;
  note_en: string;
  evidence: string[];
}

interface Requirement {
  note_ar: string;
  note_en: string;
  evidence: string[];
}

/** The five requirements of a T-273 row (template-schema-v2.ts Requirements). */
export interface TemplateRequirements {
  window: Requirement & { applies: boolean };
  consent: Requirement & { needed: "none" | "opt_in" | "opt_in_marketing" };
  privacy: Requirement;
  approved_message: Requirement & { required: "never" | "outside_window" | "always"; category: MetaCategory | null };
  cost: Requirement & {
    level: "none" | "possibly_paid" | "paid_always" | "external_service";
    ask_fahad_before_enable: boolean;
  };
}

export interface TemplateProvenance {
  type: "sourced" | "ours";
  confidence: "certain" | "likely" | "guess" | "ours";
  inspired_by: string[];
  note_ar?: string;
}

export interface TemplateLinking {
  scope: TemplateScope;
  /** For tracing only; never shown (P6). */
  requires_source: string[];
  condition_ar: string;
  condition_en: string;
}

export interface TemplateMessage {
  meta_category: MetaCategory;
  components_ar: string[];
  components_en: string[];
  variables: string[];
  /** F-4: the variable names in English (variables keeps the Arabic) */
  variables_en: string[];
  used_by: string[];
}

/** One row of catalog.json, typed as template-schema.ts (T-242) describes it. */
export interface TemplateEntry {
  id: string;
  category: TemplateCategoryId;
  title_en: string;
  title_ar: string;
  /** For tracing the inventory only; never shown. */
  reference_name: string;
  what_it_does_ar: string;
  /** F-4: what the gallery shows; what_it_does_ar is kept for the translation later */
  what_it_does_en: string;
  reference_flow: { trigger: string; conditions: string[]; actions: string[] };
  reference_flow_en: { trigger: string; conditions: string[]; actions: string[] };
  channels: Record<TemplateChannel, ChannelCell>;
  chatwoot_v4_18: {
    mechanisms: ("automation" | "macro" | "agent_bot" | "inbox_setting" | "webhook" | "none")[];
    mapping_ar: string;
    mapping_en: string;
    evidence: string[];
  };
  editor_today: {
    buildable: Buildable;
    limit_ar: string;
    limit_en: string;
    draft: { nodes: DraftNode[]; edges: FlowEdge[] } | null;
    placeholders: TemplatePlaceholder[];
    studio_setting: string | null;
  };
  gaps: string[];
  scope: TemplateScope;
  preview_checks: ("draft" | "save" | "reload" | "dry_run" | "inbox_setting_saved")[];
  guards: string[];
  /** "ours" only on T-273 rows of our own design (provenance.type ours). */
  confidence: "certain" | "likely" | "guess" | "ours";
  sources: string[];
  // T-278: optional fields from the T-273 design (diff-contracts.md 4); the 36 rows carry version and kind only
  kind?: TemplateKind;
  version?: number;
  new?: boolean;
  status?: "existing" | "new" | "retired";
  provenance?: TemplateProvenance;
  requirements?: TemplateRequirements;
  linking?: TemplateLinking;
  message?: TemplateMessage | null;
  languages?: ("ar" | "en")[];
  summary_ar?: string;
  summary_en?: string;
  steps?: { trigger_ar: string; conditions_ar: string[]; actions_ar: string[] };
  steps_en?: { trigger: string; conditions: string[]; actions: string[] };
  /** Item 116: only an Arab audience needs it (Ramadan, Eid, Arabic-only); shown under "Arabic", not in the neutral library. */
  market?: "arabic";
}

/** A row T-273 added, with the fields template-schema-v2.ts NewEntry gives it. */
export interface TemplateRowV2 {
  status: "new";
  new: true;
  id: string;
  version: number;
  kind: TemplateKind;
  category: TemplateCategoryId;
  title_en: string;
  title_ar: string;
  summary_ar: string;
  summary_en: string;
  languages: ("ar" | "en")[];
  provenance: TemplateProvenance;
  steps: { trigger_ar: string; conditions_ar: string[]; actions_ar: string[] };
  steps_en: { trigger: string; conditions: string[]; actions: string[] };
  channels: Record<TemplateChannel, ChannelCell>;
  requirements: TemplateRequirements;
  linking: TemplateLinking;
  message: TemplateMessage | null;
  editor_today: TemplateEntry["editor_today"];
  gaps: string[];
  guards: string[];
  sources: string[];
  market?: "arabic";
}

export interface TemplateLibrary {
  version: number;
  task: string;
  generated_at: string;
  chatwoot_ref: string;
  categories: {
    id: TemplateCategoryId;
    title_en: string;
    title_ar: string;
    kinds?: TemplateKind[];
    new?: boolean;
  }[];
  templates: (TemplateEntry | TemplateRowV2)[];
}

/** What a saved flow keeps of the template it came from (FlowRecord.template). */
export interface TemplateRef {
  id: string;
  version: number;
}

const isRowV2 = (row: TemplateEntry | TemplateRowV2): row is TemplateRowV2 => row.status === "new";

/** The library's "works after linking" wording, read as what is true now: it runs in the Studio simulator. */
const SIM_WORDING: [string, string][] = [
  ["أثره داخلي على المحادثة بعد الربط", "أثره داخلي على المحادثة، ويعمل في المحاكي الآن"],
  ["أثره داخلي بعد الربط", "أثره داخلي، ويعمل في المحاكي الآن"],
  ["بعد الربط واعتماد Meta", "يعمل في المحاكي الآن؛ وإرساله فعلاً يحتاج اعتماد Meta"],
  ["بعد الربط، وتحتاج delayed_automations", "يعمل في المحاكي الآن؛ وفي شات ووت تحتاج ميزة delayed_automations"],
  ["بعد الربط، وتحتاج تفعيل", "يعمل في المحاكي الآن؛ وفي محرك المحادثات تحتاج تفعيل"],
  ["بعد الربط، وبعد إنشاء فريق", "يعمل في المحاكي الآن، وبعد إنشاء فريق"],
  ["بعد الربط، وبشرط", "يعمل في المحاكي الآن، بشرط"],
  ["بعد الربط يدوياً", "يعمل في المحاكي الآن، ويدوياً"],
  ["بعد الربط بنسخة المؤسسات فقط", "يعمل في المحاكي الآن؛ وفي الواقع بنسخة المؤسسات فقط"],
  ["(يُملأ بعد الربط)", "(عنوان تجريبي في المحاكي)"],
  ["أحداث طلبات المتجر بعد الربط", "أحداث طلبات المتجر"],
  ["بعد الربط. ", "يعمل في المحاكي الآن. "],
  ["بعد الربط", "في المحاكي الآن"],
];

export function simText(text: string): string {
  let out = text;
  for (const [from, to] of SIM_WORDING) out = out.split(from).join(to);
  return out;
}

/** Every text of a row, with simText applied (a copy; the data file is not changed). */
function withSimWording<T>(value: T): T {
  if (typeof value === "string") return simText(value) as T;
  if (Array.isArray(value)) return value.map(withSimWording) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withSimWording(v)])) as T;
  return value;
}

/** A T-273 row read as a TemplateEntry: what it does, its steps, scope and confidence under the current names. */
function entryOf(source: TemplateEntry | TemplateRowV2): TemplateEntry {
  const row = withSimWording(source);
  if (!isRowV2(row)) return row;
  return {
    ...row,
    reference_name: "",
    what_it_does_ar: row.summary_ar,
    what_it_does_en: row.summary_en,
    reference_flow: {
      trigger: row.steps.trigger_ar,
      conditions: row.steps.conditions_ar,
      actions: row.steps.actions_ar,
    },
    reference_flow_en: row.steps_en,
    chatwoot_v4_18: { mechanisms: [], mapping_ar: "", mapping_en: "", evidence: [] },
    scope: row.linking.scope,
    // the same checks as T-242's drafts: Use template, the draft, save, reload, dry run
    preview_checks: row.editor_today.draft ? ["draft", "save", "reload", "dry_run"] : [],
    confidence: row.provenance.confidence,
  };
}

export const templates: TemplateEntry[] = templateLibrary.templates.map(entryOf);
/** F-4: the gap titles in English (templateGapTitles keeps the Arabic; the English never said "after linking"). */
const gapTitles: Record<string, string> = templateGapTitlesEn;
export const templateCategories = templateLibrary.categories;
export const TEMPLATES_HREF = "/dashboard/automation/templates";
export const templateHref = (id: string) => `/dashboard/automation/flow/new?template=${encodeURIComponent(id)}`;

export const channelLabels: Record<TemplateChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Messenger",
  tiktok: "TikTok",
  email: "Email",
  website: "Website",
};

export const availabilityLabels: Record<Availability, string> = {
  available: "works",
  conditional: "with conditions",
  unavailable: "does not work",
};

// M129-B: no template waits for a link any more; each says where it runs today
export const scopeLabels: Record<TemplateScope, string> = {
  works_in_preview: "Works in this preview",
  after_linking: "Engine rules · runs in the simulator",
  needs_missing_capability: `Runs in the ${PRODUCT_NAME} simulator`,
};

export const buildableLabels: Record<Buildable, string> = {
  full: "Full draft",
  partial: "Partial draft",
  none: "Simulator draft",
};

export const confidenceLabels = {
  certain: "",
  likely: "Likely: described in one line by its source",
  guess: "Guess: no official source describes it",
  ours: "Our own",
} as const;

/** The five kinds, as the gallery's "Type" filter names them (plan-after-acceptance.md step 3). */
export const kindLabels: Record<TemplateKind, string> = {
  workflow: "Flow",
  message_template: "Approved message",
  inbox_setting: "Inbox setting",
  macro: "Macro",
  quick_reply: "Canned response",
};

/** Where a template that is not a flow lives (diff-contracts.md 2): the card's button opens that page. */
export const kindHomes: Record<Exclude<TemplateKind, "workflow">, { href: string; label: string; line: string }> = {
  message_template: {
    href: "/dashboard/settings/templates",
    label: "Open message templates",
    line: "Message template: it lives on the message templates page and does not open in the editor",
  },
  inbox_setting: {
    href: "/dashboard/settings/inboxes",
    label: "Open inbox settings",
    line: "Inbox setting: it lives in the inbox settings and does not open in the editor",
  },
  macro: {
    href: "/dashboard/settings/macros",
    label: "Open macros",
    line: "Macro: it lives on the Macros page and does not open in the editor",
  },
  quick_reply: {
    href: "/dashboard/settings/canned-responses",
    label: "Open canned responses",
    line: "Canned response: it lives on the canned responses page and does not open in the editor",
  },
};

export const templateKind = (t: TemplateEntry): TemplateKind => t.kind ?? "workflow";

export const metaCategoryLabels: Record<MetaCategory, string> = {
  utility: "utility",
  marketing: "marketing",
  authentication: "authentication",
};

/**
 * The requirements line (window, consent, approved message, cost), short. No number for the cost (guards-v2.md P4):
 * anything that may be charged says so and that Fahad is asked before it is turned on.
 */
export function templateRequirementLine(t: TemplateEntry): { key: string; label: string; value: string }[] {
  const r = t.requirements;
  if (!r) return [];
  const approved = r.approved_message;
  return [
    { key: "window", label: "Window", value: r.window.applies ? "Applies" : "Does not apply" },
    {
      key: "consent",
      label: "Consent",
      value: { none: "Not needed", opt_in: "Required", opt_in_marketing: "Explicit marketing opt-in" }[
        r.consent.needed
      ],
    },
    {
      key: "approved_message",
      label: "Approved message",
      value:
        { never: "Not needed", outside_window: "Outside the window", always: "Always needed" }[approved.required] +
        (approved.category ? ` (${metaCategoryLabels[approved.category]})` : ""),
    },
    { key: "cost", label: "Cost", value: costLine(t) },
  ];
}

export function costLine(t: TemplateEntry): string {
  const cost = t.requirements?.cost;
  if (!cost) return "";
  return cost.level === "none" && !cost.ask_fahad_before_enable
    ? "No cost"
    : "May be charged; you are asked before it is turned on";
}

export function findTemplate(id: string | null | undefined): TemplateEntry | undefined {
  return id ? templates.find((t) => t.id === id) : undefined;
}

export const gapTitle = (gap: string) => gapTitles[gap] ?? gap;

/** M129-B: how the Studio simulator covers each gap of the library (contracts G01…), or what is still needed. */
export const gapCover: Record<string, { covered: boolean; how: string }> = {
  G01: { covered: true, how: "Ask a question step (Replied / No reply)" },
  G02: { covered: true, how: "Ask a question with up to 3 reply buttons" },
  G03: { covered: true, how: "Update a contact field action" },
  G04: { covered: true, how: "Business hours condition" },
  G05: { covered: true, how: "Assign by strategy: online teammates only" },
  G06: { covered: true, how: "Assign by strategy: round robin or fewest open conversations" },
  G07: { covered: true, how: "Contact is new or returning, and Once per contact" },
  G08: { covered: true, how: "Call ended event, made to happen in the dry run" },
  G09: { covered: true, how: "Conversation from an ad event, made to happen in the dry run" },
  G10: { covered: true, how: "HTTP request step with a simulated answer" },
  G11: { covered: true, how: "HTTP request step with a simulated answer" },
  G12: { covered: true, how: "Satisfaction rating received event, made to happen in the dry run" },
  G13: { covered: true, how: "Reply to a broadcast event, made to happen in the dry run" },
  G14: { covered: true, how: "Run by a teammate (shortcut) event" },
  G15: { covered: true, how: "Wait between steps and Go to another flow" },
  G16: { covered: true, how: "TikTok is a channel of the simulator (the preview has no TikTok inbox)" },
  G17: { covered: false, how: "Still needed: create the team in Settings > Teams" },
  G18: { covered: true, how: "Send attachment: uploaded, saved and checked for every channel" },
  G19: { covered: true, how: "Send an approved message template action" },
  G20: { covered: true, how: "Store order update event, made to happen in the dry run" },
  G21: { covered: true, how: "Appointment update event, made to happen in the dry run" },
  G22: { covered: true, how: "Scheduled time event" },
  G23: { covered: true, how: "Update a contact field (the consent and its date)" },
  G24: { covered: true, how: "HTTP request step with a simulated answer" },
  G25: { covered: true, how: "Comment on a post event, made to happen in the dry run" },
  G26: { covered: true, how: "Payment update event, made to happen in the dry run" },
  G27: { covered: true, how: "Message template status changed event, made to happen in the dry run" },
  G28: { covered: false, how: `Still outside ${PRODUCT_NAME}: an outside login system makes the code` },
};

/** The draft a template opens: its own (T-242 / T-273), or the simulator draft written for it (sim-drafts.ts). */
function draftOf(t: TemplateEntry): FlowDoc | null {
  if (templateKind(t) === "workflow" && t.editor_today.buildable !== "none" && t.editor_today.draft)
    return t.editor_today.draft as FlowDoc;
  return simDraftDoc(t.id);
}

/** true when the template's draft uses simulator steps (it runs in the Studio simulator, not as Chatwoot rules). */
export function templateRunsInSimulator(t: TemplateEntry): boolean {
  const draft = draftOf(t);
  return !!draft && isSimDoc(draft);
}

/** Where a template that is not a flow also lives (its settings page); "" for a flow. */
export function templateHomeLine(t: TemplateEntry): string {
  const kind = templateKind(t);
  return kind === "workflow" ? "" : kindHomes[kind].line;
}

/** Why a template cannot become a draft ("" when it can). M129-B: every template has a draft now. */
export function templateBlocker(t: TemplateEntry): string {
  return draftOf(t) ? "" : "No draft for this template in the editor yet";
}

/** The actions that would reach a customer or an outside address once linked (guards.md P1.2). */
const SEND_ACTIONS = new Set([
  "send_message",
  "send_attachment",
  "send_email_to_team",
  "send_email_transcript",
  "send_webhook_event",
]);

export function templateSends(t: TemplateEntry): boolean {
  const draft = draftOf(t);
  return !!draft?.nodes.some(
    (n) =>
      (n.kind === "action" && (SEND_ACTIONS.has(n.action.action) || n.action.action === "send_template")) ||
      n.kind === "ask",
  );
}

const SLOT = /^\{\{[a-z0-9_]+\}\}$/;

/** A step the teammate must fill in, on the new draft's own step id. */
export interface TemplateSlot {
  nodeId: string;
  label_ar: string;
  source: TemplatePlaceholder["source"];
}

const edgeId = (source: string, handle: Handle, target: string) => `e-${source}-${handle}-${target}`;

/**
 * A new, independent copy of the template's draft as the editor names things: the trigger is "trigger", the other
 * steps "<kind>-<n>" (edit.ts nextId) and the lines "e-<source>-<handle>-<target>". Placeholder values are removed,
 * so the step shows "Action parameters are required" / "Value is required" (catalog.ts) until it is filled.
 * Positions are left for arrange(). Throws when the template has no draft or a line points to a missing step.
 */
export function instantiateTemplate(t: TemplateEntry): { doc: FlowDoc; slots: TemplateSlot[] } {
  const own = templateKind(t) === "workflow" && t.editor_today.buildable !== "none" ? t.editor_today.draft : null;
  if (!own) {
    // M129-B: the simulator draft, already in the editor's names; every empty field is a slot to fill in
    const doc = simDraftDoc(t.id);
    if (!doc) throw new Error(templateBlocker(t));
    return { doc, slots: simSlots(doc) };
  }
  const draft = own;
  const ids = new Map<string, string>();
  const counts: Partial<Record<NodeKind, number>> = {};
  for (const node of draft.nodes) {
    if (ids.has(node.id)) throw new Error(`Template step ${node.id} appears twice.`);
    if (node.kind === "trigger") ids.set(node.id, "trigger");
    else {
      counts[node.kind] = (counts[node.kind] ?? 0) + 1;
      ids.set(node.id, `${node.kind}-${counts[node.kind]}`);
    }
  }
  const clear = (values: string[]) => values.filter((v) => !SLOT.test(v));
  const nodes = draft.nodes.map((node): FlowNode => {
    const id = ids.get(node.id) as string;
    const position = { x: 0, y: 0 };
    if (node.kind === "trigger") return { id, kind: "trigger", position, event: node.event };
    if (node.kind === "wait")
      return { id, kind: "wait", position, wait: { ...node.wait, inboxes: clear(node.wait.inboxes) } };
    if (node.kind === "condition")
      return { id, kind: "condition", position, rows: node.rows.map((row) => ({ ...row, values: clear(row.values) })) };
    const action: Action = { ...node.action, values: clear(node.action.values) };
    if (action.message !== undefined && SLOT.test(action.message)) action.message = "";
    return { id, kind: "action", position, action };
  });
  const edges = draft.edges.map((edge): FlowEdge => {
    const source = ids.get(edge.source);
    const target = ids.get(edge.target);
    if (!source || !target) throw new Error(`Template line ${edge.id} points to a missing step.`);
    return { id: edgeId(source, edge.handle, target), source, handle: edge.handle, target };
  });
  const slots = t.editor_today.placeholders.flatMap((p): TemplateSlot[] => {
    const nodeId = ids.get(p.node);
    return nodeId ? [{ nodeId, label_ar: p.label_ar, source: p.source }] : [];
  });
  return { doc: { nodes, edges }, slots };
}

const SLOT_WORDS: Record<string, string> = {
  send_message: "Message to send",
  send_template: "Approved template to send",
  assign_team: "Team",
  assign_agent: "Teammate",
  add_label: "Label",
  add_private_note: "Note",
  send_email_to_team: "Team to email and the message",
  update_contact_field: "Contact field and value",
};

/** The fields a simulator draft leaves empty, one per step, named for the teammate. */
function simSlots(doc: FlowDoc): TemplateSlot[] {
  return doc.nodes.flatMap((node): TemplateSlot[] => {
    let label = "";
    if (node.kind === "condition" && node.rows.some((row) => conditionError(row)))
      label = `Condition: ${node.rows.map((row) => row.attribute.replace(/_/g, " ")).join(", ")}`;
    if (node.kind === "action" && actionError(node.action))
      label = SLOT_WORDS[node.action.action] ?? node.action.action;
    if (node.kind === "ask" && !node.ask.question.trim()) label = "Question to ask";
    if (node.kind === "http" && !node.http.url.trim()) label = "Address to call";
    if (node.kind === "goto" && !node.goto.flowId) label = "Flow to go to";
    if (node.kind === "trigger" && node.event === "label_added" && !node.label) label = "Label that starts it";
    return label ? [{ nodeId: node.id, label_ar: label, source: "free_text" }] : [];
  });
}

/**
 * The draft's description: the first sentence of what the template does. F-4: a new flow made from a template gets the
 * English sentence ("en"); without a language it is still the Arabic one, which is what M129-B's baseline.mjs compares.
 */
export function templateDescription(t: TemplateEntry, lang: "ar" | "en" = "ar"): string {
  const text = lang === "en" ? t.what_it_does_en : t.what_it_does_ar;
  const first = text.split(/(?<=[.؟!])\s/)[0] ?? text;
  return first.trim();
}

/**
 * F-4: the English of a slot's label. A slot keeps label_ar (M129-B's baseline compares the slots as they are); its English
 * is the label_en of the template's placeholder with the same Arabic label. A label the simulator drafts wrote in English
 * (simSlots) has no such placeholder and stays as it is.
 */
export function slotLabel(t: TemplateEntry, label: string): string {
  return t.editor_today.placeholders.find((p) => p.label_ar === label)?.label_en ?? label;
}

/** T-278 (diff-contracts.md 3.3): the template's own version, not the library's; the 36 are all version 1. */
export function templateRef(t: TemplateEntry): TemplateRef {
  return { id: t.id, version: t.version ?? 1 };
}

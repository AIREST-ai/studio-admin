// T-139: what the visual editor draws and saves. A flow is a tree that starts at one trigger. Every path from the
// trigger to its last action becomes one Chatwoot automation rule (the engine has one event, a flat condition list
// and an ordered action list per rule, nothing more), so the canvas never stores anything the rules cannot hold.
// M129-B (items 129.1, 129.2): the Studio simulator's steps join the four Chatwoot steps. A flow that uses any of them
// (sim-catalog.ts simFeatures) runs in the Studio simulator: the dry run plays it through and it is saved here, and
// nothing is sent to real customers. A flow without them still becomes Chatwoot rules exactly as before.
import type { Action, Condition, EventKey, Rule } from "./catalog";

export type WaitData = NonNullable<Rule["wait"]>;

/** The channels the simulator checks (bahth-129 table 1): the five Meta/TikTok/Telegram ones, email and website chat. */
export type SimChannel = "whatsapp" | "instagram" | "facebook" | "tiktok" | "telegram" | "email" | "website";

/** Outside events Chatwoot v4.18 does not have; the dry run makes them happen (sim-catalog.ts SIM_EVENTS). */
export type SimEventKey =
  | "scheduled"
  | "label_added"
  | "manual"
  | "call_ended"
  | "ad_click"
  | "csat_submitted"
  | "broadcast_reply"
  | "comment_on_post"
  | "store_order"
  | "payment"
  | "appointment"
  | "template_status";

export type FlowEvent = EventKey | SimEventKey;

export interface ScheduleData {
  /** once = on `date`; daily / weekly (on `weekdays`) / monthly (on the day of `date`) at `time`. */
  mode: "once" | "daily" | "weekly" | "monthly";
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24 hours */
  time: string;
  /** 0 = Sunday … 6 = Saturday (weekly only) */
  weekdays: number[];
  /** IANA name, e.g. Asia/Riyadh */
  timezone: string;
  /** Only conversations with one of these labels (empty = every open conversation). */
  labels: string[];
}

export type DelayUnit = "seconds" | "minutes" | "hours" | "days";

export interface AskData {
  question: string;
  /** Reply buttons (WhatsApp allows up to 3); empty = any text answer. */
  answers: string[];
  /** Contact field the answer is saved to ("" = not saved). */
  saveTo: string;
  /** No answer within this time takes the "No reply" exit (respond.io: up to 7 days). */
  timeout: { amount: number; unit: "minutes" | "hours" | "days" };
}

export interface DelayData {
  amount: number;
  unit: DelayUnit;
}

export interface SplitData {
  /** Share of contacts that take path A (1-99); the rest take path B. */
  percentA: number;
}

export interface HttpData {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body: string;
  /** The simulated answer: the preview never calls the address. */
  mockStatus: number;
  mockBody: string;
  /** Contact field the simulated answer body is saved to ("" = not saved). */
  saveTo: string;
}

export interface GotoData {
  flowId: string;
}

/** Flow-wide simulator settings, kept inside the drawing so undo, redo and "unsaved changes" cover them. */
export interface FlowSettings {
  /** At least this many seconds between two automated messages to the same contact (0 = no gap). */
  secondsBetweenReplies?: number;
}

export interface XY {
  x: number;
  y: number;
}

export interface TriggerNode {
  id: string;
  kind: "trigger";
  position: XY;
  event: FlowEvent;
  /** Simulator: only conversations on these channels (empty or missing = every channel). */
  channels?: SimChannel[];
  /** Simulator: "once_per_contact" runs the flow at most once per contact (respond.io "Trigger once per contact"). */
  repeat?: "every_time" | "once_per_contact";
  /** event "scheduled" */
  schedule?: ScheduleData;
  /** event "label_added": the label */
  label?: string;
  /** a simulated outside event: which one (e.g. "Shipped" for a store order) */
  detail?: string;
}

export interface WaitNode {
  id: string;
  kind: "wait";
  position: XY;
  wait: WaitData;
}

export interface ConditionNode {
  id: string;
  kind: "condition";
  position: XY;
  /** The text form's rows as they are: `join` of row i links it to row i-1 (row 0's join is kept, never read). */
  rows: Condition[];
}

export interface ActionNode {
  id: string;
  kind: "action";
  position: XY;
  action: Action;
}

export interface AskNode {
  id: string;
  kind: "ask";
  position: XY;
  ask: AskData;
}

export interface DelayNode {
  id: string;
  kind: "delay";
  position: XY;
  delay: DelayData;
}

export interface SplitNode {
  id: string;
  kind: "split";
  position: XY;
  split: SplitData;
}

export interface HttpNode {
  id: string;
  kind: "http";
  position: XY;
  http: HttpData;
}

export interface GotoNode {
  id: string;
  kind: "goto";
  position: XY;
  goto: GotoData;
}

export type FlowNode =
  | TriggerNode
  | WaitNode
  | ConditionNode
  | ActionNode
  | AskNode
  | DelayNode
  | SplitNode
  | HttpNode
  | GotoNode;
export type NodeKind = FlowNode["kind"];

/** The step kinds only the Studio simulator runs. */
export const SIM_KINDS: NodeKind[] = ["ask", "delay", "split", "http", "goto"];

/**
 * `yes` and `no` leave a condition ("no" is drawn as Else); an ask leaves by `replied` or `noreply`, a random split by
 * `a` or `b`, an HTTP request by `success` or `failure`; "Go to another flow" ends its path; every other step has `out`.
 */
export type Handle = "out" | "yes" | "no" | "replied" | "noreply" | "a" | "b" | "success" | "failure";

export function exitsOf(node: Pick<FlowNode, "kind">): Handle[] {
  switch (node.kind) {
    case "condition":
      return ["yes", "no"];
    case "ask":
      return ["replied", "noreply"];
    case "split":
      return ["a", "b"];
    case "http":
      return ["success", "failure"];
    case "goto":
      return [];
    default:
      return ["out"];
  }
}

/** What each exit is called on the canvas and in the problems list. */
export const EXIT_LABELS: Record<Handle, string> = {
  out: "",
  yes: "Yes",
  no: "Else",
  replied: "Replied",
  noreply: "No reply",
  a: "A",
  b: "B",
  success: "Success",
  failure: "Failure",
};

export interface FlowEdge {
  id: string;
  source: string;
  handle: Handle;
  target: string;
}

export interface FlowDoc {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Simulator settings (missing on flows saved before M129-B: no gap between replies). */
  settings?: FlowSettings;
}

/** A flow as saved in the "automation" section beside the rules it made. */
export interface FlowRecord {
  id: string;
  name: string;
  description: string;
  doc: FlowDoc;
  /** Path key (see compile.ts pathKey) -> id of the rule that path became at the last approval. */
  ruleIds: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  /** null until approved once; drafts saved later than this have changes that are not in the rules yet. */
  approvedAt: string | null;
  /** T-243: the library template this flow was started from ("Use template"); kept as it is by the save checker. */
  template?: { id: string; version: number };
  /** M129-B: set when approved for the Studio simulator (a flow with simulator steps makes no Chatwoot rule). */
  simApprovedAt?: string | null;
}

/** One entry of the saved "automation" section. Rules are kept exactly as the list and the text form use them. */
export type AutomationItem = { kind: "rule"; rule: Rule } | { kind: "flow"; flow: FlowRecord };

export const FLOW_ID = /^flow-[a-z0-9]+$/;

export function newFlowId(now = Date.now()): string {
  return `flow-${now.toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, "0")}`;
}

export function rulesOf(items: AutomationItem[]): Rule[] {
  return items.flatMap((item) => (item.kind === "rule" ? [item.rule] : []));
}

export function flowsOf(items: AutomationItem[]): FlowRecord[] {
  return items.flatMap((item) => (item.kind === "flow" ? [item.flow] : []));
}

/** Puts the rules back in their place in the saved order; flows stay where they were. */
export function withRules(items: AutomationItem[], rules: Rule[]): AutomationItem[] {
  return [...rules.map((rule): AutomationItem => ({ kind: "rule", rule })), ...items.filter((i) => i.kind === "flow")];
}

export function flowOfRule(flows: FlowRecord[], ruleId: number): FlowRecord | undefined {
  return flows.find((flow) => Object.values(flow.ruleIds).includes(ruleId));
}

export type { Action, Condition, EventKey, Rule };

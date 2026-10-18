// M129-B (item 129.2, condition 1): a draft for every template that had none, so "Use template" opens every template
// in the editor. Each draft follows the template's own steps (template-data.ts steps / reference_flow) with the Studio
// simulator's steps and events (sim-catalog.ts). Nothing is invented for the teammate: every message, team, label,
// address, keyword and template name is left empty, so the editor marks it "to fill in". Plain data, no React.
import type { Action, Condition } from "./catalog";
import type {
  AskData,
  DelayData,
  FlowDoc,
  FlowEdge,
  FlowNode,
  Handle,
  HttpData,
  NodeKind,
  ScheduleData,
  TriggerNode,
  WaitData,
} from "./model";

type Step =
  | { if: Condition[]; yes?: Step[]; no?: Step[] }
  | { ask: Partial<AskData>; replied?: Step[]; noreply?: Step[] }
  | { split: number; a?: Step[]; b?: Step[] }
  | { http: Partial<HttpData>; success?: Step[]; failure?: Step[] }
  | { act: string; values?: string[]; message?: string }
  | { delay: DelayData }
  | { wait: WaitData }
  | { goto: true };

interface Draft {
  trigger: Omit<TriggerNode, "id" | "kind" | "position">;
  steps: Step[];
}

const row = (attribute: string, operator: string, values: string[] = [], join: "and" | "or" = "and"): Condition => ({
  attribute,
  operator,
  values,
  join,
});
const send = (): Step => ({ act: "send_message" });
const template = (): Step => ({ act: "send_template" });
const act = (action: string, values: string[] = [], message?: string): Step => ({
  act: action,
  values,
  ...(message !== undefined ? { message } : {}),
});
const http = (): Step => ({ http: {} });
const onWhatsAppWithConsent: Condition[] = [
  row("channel_type", "Equal to", ["WhatsApp"]),
  row("contact_attr", "Equal to", []),
];
const consentedTemplate = (): Step[] => [{ if: onWhatsAppWithConsent, yes: [template()] }];

function schedule(): ScheduleData {
  const now = new Date();
  return {
    mode: "once",
    date: now.toISOString().slice(0, 10),
    time: "09:00",
    weekdays: [now.getDay()],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    labels: [],
  };
}

/** template id -> its draft. */
const DRAFTS: Record<string, () => Draft> = {
  // ---- the 39 flows that had no draft
  away_business_hours: () => ({
    trigger: { event: "conversation_created" },
    steps: [{ if: [row("business_hours", "Within business hours of")], yes: [send()], no: [send()] }],
  }),
  multi_level_menu: () => ({
    trigger: { event: "conversation_created" },
    steps: [
      {
        ask: {},
        replied: [{ if: [row("content", "Contains")], yes: [send(), act("add_label")], no: [{ goto: true }] }],
        noreply: [send()],
      },
    ],
  }),
  round_robin: () => ({ trigger: { event: "conversation_created" }, steps: [act("assign_strategy", ["Round robin"])] }),
  round_robin_online: () => ({
    trigger: { event: "conversation_created" },
    steps: [send(), act("assign_strategy", ["Round robin, online teammates only"])],
  }),
  least_open_contacts: () => ({
    trigger: { event: "conversation_created" },
    steps: [send(), act("assign_strategy", ["Fewest open conversations, online teammates only"])],
  }),
  missed_call_follow_up: () => ({
    trigger: { event: "call_ended", detail: "Missed" },
    steps: [
      {
        if: [row("event_detail", "Equal to", ["Missed"])],
        yes: [act("open_conversation"), act("assign_agent"), send()],
      },
    ],
  }),
  broadcast_response_assign: () => ({
    trigger: { event: "broadcast_reply" },
    steps: [{ if: [row("content", "Contains")], yes: [act("assign_agent")], no: [send()] }],
  }),
  new_and_returning: () => ({
    trigger: { event: "conversation_created" },
    steps: [{ if: [row("contact_type", "Equal to", ["New contact"])], yes: [send()], no: [send()] }],
  }),
  ask_language: () => ({
    trigger: { event: "conversation_created" },
    steps: [
      {
        ask: { answers: ["Arabic", "English"], saveTo: "preferred_language" },
        replied: [act("assign_team"), act("send_email_to_team", [], "")],
        noreply: [send()],
      },
    ],
  }),
  shift_routing: () => ({
    trigger: { event: "conversation_created" },
    steps: [
      {
        if: [row("business_hours", "Within business hours of")],
        yes: [send(), act("assign_team")],
        no: [send(), { goto: true }],
      },
    ],
  }),
  ctc_ads_assignment: () => ({
    trigger: { event: "ad_click", detail: "Meta click-to-chat ad" },
    steps: [send(), act("assign_team"), act("send_email_to_team", [], "")],
  }),
  log_call_summary: () => ({
    trigger: { event: "call_ended", detail: "Answered" },
    steps: [act("add_private_note")],
  }),
  sales_call_report: () => ({ trigger: { event: "manual" }, steps: [act("add_private_note")] }),
  privacy_consent: () => ({
    trigger: { event: "conversation_created" },
    steps: [
      send(),
      {
        ask: {},
        replied: [act("update_contact_field"), act("add_label")],
        noreply: [act("resolve_conversation")],
      },
    ],
  }),
  shift_transfer: () => ({
    trigger: { event: "manual" },
    steps: [
      {
        if: [row("business_hours", "Within business hours of")],
        yes: [act("assign_team"), act("add_private_note")],
        no: [act("add_private_note")],
      },
    ],
  }),
  csat_to_warehouse: () => ({
    trigger: { event: "conversation_resolved" },
    steps: [{ ask: {}, replied: [{ ask: {}, replied: [http()], noreply: [http()] }] }],
  }),
  csat_to_sheets: () => ({
    trigger: { event: "conversation_resolved" },
    steps: [{ ask: {}, replied: [{ ask: {}, replied: [http()], noreply: [http()] }] }],
  }),
  meta_appointment: () => ({ trigger: { event: "ad_click", detail: "Meta click-to-chat ad" }, steps: [send()] }),
  meta_assignment: () => ({
    trigger: { event: "ad_click", detail: "Meta click-to-chat ad" },
    steps: [send(), act("assign_team"), act("send_email_to_team", [], "")],
  }),
  tiktok_new_leads: () => ({
    trigger: { event: "ad_click", detail: "TikTok messaging ad", channels: ["tiktok"] },
    steps: [http()],
  }),
  tiktok_conversion_tracker: () => ({
    trigger: { event: "ad_click", detail: "TikTok messaging ad" },
    steps: [{ if: [row("channel_type", "Equal to", ["TikTok"])], yes: [act("add_label"), http()] }],
  }),
  tiktok_qualification: () => ({
    trigger: { event: "manual", channels: ["tiktok"] },
    steps: [act("add_label"), http(), act("add_private_note")],
  }),
  csat_low_alert: () => ({
    trigger: { event: "csat_submitted", detail: "1" },
    steps: [
      {
        if: [row("event_detail", "Equal to", ["1", "2"])],
        yes: [act("send_email_to_team", [], ""), act("add_label")],
      },
    ],
  }),
  order_placed_notify: () => ({ trigger: { event: "store_order", detail: "Placed" }, steps: consentedTemplate() }),
  cod_confirmation_request: () => ({
    trigger: { event: "store_order", detail: "Placed" },
    steps: [{ if: onWhatsAppWithConsent, yes: [template(), act("add_label")] }],
  }),
  shipping_update_notify: () => ({ trigger: { event: "store_order", detail: "Shipped" }, steps: consentedTemplate() }),
  out_for_delivery_notify: () => ({
    trigger: { event: "store_order", detail: "Out for delivery" },
    steps: consentedTemplate(),
  }),
  delivery_failed_reschedule: () => ({
    trigger: { event: "store_order", detail: "Delivery failed" },
    steps: consentedTemplate(),
  }),
  order_cancelled_notify: () => ({
    trigger: { event: "store_order", detail: "Cancelled" },
    steps: consentedTemplate(),
  }),
  return_refund_update: () => ({
    trigger: { event: "store_order", detail: "Return or refund" },
    steps: consentedTemplate(),
  }),
  delivered_feedback_request: () => ({
    trigger: { event: "store_order", detail: "Delivered" },
    steps: consentedTemplate(),
  }),
  abandoned_cart_reminder: () => ({
    trigger: { event: "store_order", detail: "Cart abandoned" },
    steps: [{ delay: { amount: 1, unit: "hours" } }, { if: [row("contact_attr", "Equal to", [])], yes: [template()] }],
  }),
  payment_due_reminder: () => ({ trigger: { event: "payment", detail: "Due soon" }, steps: consentedTemplate() }),
  payment_received_receipt: () => ({ trigger: { event: "payment", detail: "Received" }, steps: consentedTemplate() }),
  appointment_reminder_24h: () => ({
    trigger: { event: "appointment", detail: "24 hours before" },
    steps: consentedTemplate(),
  }),
  appointment_no_show_followup: () => ({
    trigger: { event: "appointment", detail: "Missed" },
    steps: [{ if: [row("event_detail", "Equal to", ["Missed"])], yes: [template()] }],
  }),
  ig_comment_to_dm: () => ({
    trigger: { event: "comment_on_post", detail: "Instagram", channels: ["instagram", "facebook"] },
    steps: [{ if: [row("content", "Contains")], yes: [send()] }],
  }),
  window_closed_fallback: () => ({
    trigger: { event: "conversation_updated" },
    steps: [{ if: [row("reply_window", "Is closed")], yes: [template()], no: [send()] }],
  }),
  template_status_alert: () => ({
    trigger: { event: "template_status", detail: "Paused" },
    steps: [
      { if: [row("event_detail", "Equal to", ["Paused", "Rejected"])], yes: [act("send_email_to_team", [], "")] },
    ],
  }),
  // ---- the inbox settings, the macro and the canned responses, as flows that do the same
  greeting_after_inactivity: () => ({
    trigger: { event: "message_created" },
    steps: [{ if: [row("contact_type", "Equal to", ["New contact"])], yes: [send()] }],
  }),
  ramadan_hours_notice: () => ({
    trigger: { event: "message_created" },
    steps: [{ if: [row("business_hours", "Outside business hours of")], yes: [send()] }],
  }),
  eid_holiday_away: () => ({
    trigger: { event: "message_created" },
    steps: [{ if: [row("business_hours", "Outside business hours of")], yes: [send()] }],
  }),
  cod_phone_confirmed_macro: () => ({
    trigger: { event: "manual" },
    steps: [act("add_label"), act("add_private_note"), act("resolve_conversation")],
  }),
  quick_replies_store_pack: () => ({
    trigger: { event: "message_created" },
    steps: [{ if: [row("content", "Contains")], yes: [send()] }],
  }),
  // ---- the approved messages: a flow that sends the message on its occasion
  order_confirmation_message: () => ({
    trigger: { event: "store_order", detail: "Placed" },
    steps: consentedTemplate(),
  }),
  cod_confirmation_message: () => ({ trigger: { event: "store_order", detail: "Placed" }, steps: consentedTemplate() }),
  shipping_update_message: () => ({ trigger: { event: "store_order", detail: "Shipped" }, steps: consentedTemplate() }),
  appointment_reminder_message: () => ({
    trigger: { event: "appointment", detail: "24 hours before" },
    steps: consentedTemplate(),
  }),
  payment_reminder_message: () => ({ trigger: { event: "payment", detail: "Due soon" }, steps: consentedTemplate() }),
  abandoned_cart_message: () => ({
    trigger: { event: "store_order", detail: "Cart abandoned" },
    steps: consentedTemplate(),
  }),
  ramadan_greeting_message: () => ({
    trigger: { event: "scheduled", schedule: schedule() },
    steps: consentedTemplate(),
  }),
  eid_greeting_message: () => ({ trigger: { event: "scheduled", schedule: schedule() }, steps: consentedTemplate() }),
  opt_in_confirmation_message: () => ({
    trigger: { event: "label_added" },
    steps: [{ if: [row("channel_type", "Equal to", ["WhatsApp"])], yes: [template()] }],
  }),
  csat_survey_message: () => ({ trigger: { event: "conversation_resolved" }, steps: consentedTemplate() }),
  otp_code_message: () => ({
    trigger: { event: "manual" },
    steps: [{ if: [row("channel_type", "Equal to", ["WhatsApp"])], yes: [template()] }],
  }),
};

export const simDraftIds = Object.keys(DRAFTS);

/** Builds the draft as the editor names things: "trigger", "<kind>-<n>", lines "e-<source>-<handle>-<target>". */
export function simDraftDoc(id: string): FlowDoc | null {
  const make = DRAFTS[id];
  if (!make) return null;
  const draft = make();
  const nodes: FlowNode[] = [{ id: "trigger", kind: "trigger", position: { x: 0, y: 0 }, ...draft.trigger }];
  const edges: FlowEdge[] = [];
  const counts: Partial<Record<NodeKind, number>> = {};
  const position = { x: 0, y: 0 };
  const add = (node: FlowNode) => {
    nodes.push(node);
    return node.id;
  };
  const idFor = (kind: NodeKind) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
    return `${kind}-${counts[kind]}`;
  };
  const link = (source: string, handle: Handle, target: string) =>
    edges.push({ id: `e-${source}-${handle}-${target}`, source, handle, target });
  /** Lays `steps` under `from`'s `handle`, one after another. */
  const chain = (steps: Step[], from: string, handle: Handle) => {
    let at = from;
    let exit: Handle | null = handle;
    for (const step of steps) {
      if (!exit) break;
      let id: string;
      let next: Handle | null = "out";
      const branches: [Handle, Step[] | undefined][] = [];
      if ("if" in step) {
        id = add({ id: idFor("condition"), kind: "condition", position, rows: step.if.map((r) => ({ ...r })) });
        branches.push(["yes", step.yes], ["no", step.no]);
        next = null;
      } else if ("ask" in step) {
        id = add({
          id: idFor("ask"),
          kind: "ask",
          position,
          ask: { question: "", answers: [], saveTo: "", timeout: { amount: 7, unit: "days" }, ...step.ask },
        });
        branches.push(["replied", step.replied], ["noreply", step.noreply]);
        next = null;
      } else if ("split" in step) {
        id = add({ id: idFor("split"), kind: "split", position, split: { percentA: step.split } });
        branches.push(["a", step.a], ["b", step.b]);
        next = null;
      } else if ("http" in step) {
        id = add({
          id: idFor("http"),
          kind: "http",
          position,
          http: { method: "POST", url: "", body: "", mockStatus: 200, mockBody: "", saveTo: "", ...step.http },
        });
        branches.push(["success", step.success], ["failure", step.failure]);
        next = null;
      } else if ("delay" in step) {
        id = add({ id: idFor("delay"), kind: "delay", position, delay: { ...step.delay } });
      } else if ("wait" in step) {
        id = add({ id: idFor("wait"), kind: "wait", position, wait: { ...step.wait } });
      } else if ("goto" in step) {
        id = add({ id: idFor("goto"), kind: "goto", position, goto: { flowId: "" } });
        next = null;
      } else {
        const action: Action = { action: step.act, values: [...(step.values ?? [])] };
        if (step.message !== undefined) action.message = step.message;
        id = add({ id: idFor("action"), kind: "action", position, action });
      }
      link(at, exit, id);
      for (const [branch, children] of branches) if (children?.length) chain(children, id, branch);
      at = id;
      exit = next;
    }
  };
  chain(draft.steps, "trigger", "out");
  return { nodes, edges };
}

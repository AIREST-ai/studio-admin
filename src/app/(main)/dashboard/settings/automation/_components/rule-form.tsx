"use client";
// F159 settings-b: Chatwoot v4.18 AutomationRuleForm.vue + components/AutomationRunTypeSelector.vue,
// AutomationWaitCondition.vue, AutomationActions.vue; events/conditions/actions from constants.js and operators.js.
import * as React from "react";

import { Clock, Info, Paperclip, Plus, TriangleAlert, X, Zap } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

import {
  agentNames,
  countryNames,
  inboxNames,
  labelNames,
  languageNames,
  priorityNames,
  slaNames,
  statusNames,
  teamNames,
} from "../../labels/_shared/settings-data";
import { FieldError, MultiPick } from "../../labels/_shared/settings-ui";

export type RunType = "instant" | "delayed";
export type EventKey =
  | "conversation_created"
  | "conversation_updated"
  | "conversation_resolved"
  | "message_created"
  | "conversation_opened";
export type Trigger = "conversation_status" | "customer_unresponsive" | "agent_unresponsive";
type InputType = "search_select" | "multi_select" | "plain_text" | "multi_text";

export interface Condition {
  attribute: string;
  operator: string;
  values: string[];
  join: "and" | "or";
}

export interface Action {
  action: string;
  values: string[];
  message?: string;
}

export interface Rule {
  id: number;
  name: string;
  description: string;
  active: boolean;
  createdOn: string;
  runType: RunType;
  event: EventKey;
  conditions: Condition[];
  actions: Action[];
  wait?: { trigger: Trigger; status: string; amount: number; unit: "minutes" | "hours" | "days"; inboxes: string[] };
}

export const eventLabels: Record<EventKey, string> = {
  conversation_created: "Conversation Created",
  conversation_updated: "Conversation Updated",
  conversation_resolved: "Conversation Resolved",
  message_created: "Message Created",
  conversation_opened: "Conversation Opened",
};

const OP1 = ["Equal to", "Not equal to"];
const OP2 = ["Equal to", "Not equal to", "Contains", "Does not contain"];
const OP3 = ["Equal to", "Not equal to", "Is present", "Is not present"];
const OP6 = ["Equal to", "Not equal to", "Contains", "Does not contain", "Starts With"];

const attributeDefs: Record<string, { label: string; input: InputType; ops: string[]; options?: string[] }> = {
  message_type: { label: "Message Type", input: "search_select", ops: OP1, options: ["Incoming Message", "Outgoing Message"] },
  private_note: { label: "Private Note", input: "search_select", ops: OP1, options: ["True", "False"] },
  content: { label: "Message Content", input: "multi_text", ops: OP2 },
  email: { label: "Email", input: "plain_text", ops: OP2 },
  inbox_id: { label: "Inbox", input: "multi_select", ops: OP1, options: inboxNames },
  status: { label: "Status", input: "multi_select", ops: OP1, options: statusNames },
  assignee_id: { label: "Assignee", input: "search_select", ops: OP3, options: agentNames },
  team_id: { label: "Team", input: "search_select", ops: OP3, options: teamNames },
  priority: { label: "Priority", input: "multi_select", ops: OP1, options: priorityNames },
  conversation_language: { label: "Conversation Language", input: "multi_select", ops: OP1, options: languageNames },
  phone_number: { label: "Phone Number", input: "plain_text", ops: OP6 },
  company_name: { label: "Company", input: "plain_text", ops: OP2 },
  labels: { label: "Labels", input: "multi_select", ops: OP3, options: labelNames },
  browser_language: { label: "Browser Language", input: "search_select", ops: OP1, options: languageNames },
  mail_subject: { label: "Email Subject", input: "plain_text", ops: OP2 },
  country_code: { label: "Country", input: "search_select", ops: OP1, options: countryNames },
  referer: { label: "Referrer Link", input: "plain_text", ops: OP2 },
  // Custom attributes are appended by Chatwoot under their own group (Settings > Custom Attributes).
  "conversation.order_number": { label: "Order number", input: "plain_text", ops: OP2 },
  "conversation.delivery_city": { label: "Delivery city", input: "search_select", ops: OP1, options: ["Doha", "Al Wakrah", "Lusail", "Dubai", "Riyadh"] },
  "contact.subscription_plan": { label: "Subscription plan", input: "search_select", ops: OP1, options: ["Basic", "Plus", "Family"] },
  "contact.preferred_language": { label: "Preferred language", input: "search_select", ops: OP1, options: ["Arabic", "English"] },
};

// constants.js AUTOMATIONS[event].conditions
const eventConditions: Record<EventKey, string[]> = {
  message_created: ["message_type", "private_note", "content", "email", "inbox_id", "status", "assignee_id", "team_id", "priority", "conversation_language", "phone_number", "company_name", "labels"],
  conversation_created: ["status", "browser_language", "mail_subject", "country_code", "phone_number", "company_name", "referer", "email", "inbox_id", "conversation_language", "priority", "labels"],
  conversation_updated: ["status", "browser_language", "mail_subject", "country_code", "referer", "phone_number", "company_name", "assignee_id", "team_id", "email", "inbox_id", "conversation_language", "priority", "labels"],
  conversation_opened: ["browser_language", "email", "mail_subject", "country_code", "referer", "assignee_id", "phone_number", "company_name", "team_id", "inbox_id", "conversation_language", "priority", "labels"],
  conversation_resolved: ["browser_language", "email", "mail_subject", "country_code", "referer", "assignee_id", "phone_number", "company_name", "team_id", "inbox_id", "conversation_language", "priority"],
};
const customConditions = {
  conversation: ["conversation.order_number", "conversation.delivery_city"],
  contact: ["contact.subscription_plan", "contact.preferred_language"],
};

type ActionInput = "search_select" | "multi_select" | "team_message" | "email" | "url" | "attachment" | "textarea" | null;

// constants.js AUTOMATION_ACTION_TYPES (labels from automation.json ACTIONS)
export const actionDefs: Record<string, { label: string; input: ActionInput; options?: string[] }> = {
  assign_agent: { label: "Assign to Agent", input: "search_select", options: ["None", "Last Responding Agent", ...agentNames] },
  assign_team: { label: "Assign a Team", input: "search_select", options: ["None", ...teamNames] },
  remove_assigned_agent: { label: "Remove Assigned Agent", input: null },
  remove_assigned_team: { label: "Remove Assigned Team", input: null },
  add_label: { label: "Add a Label", input: "multi_select", options: labelNames },
  remove_label: { label: "Remove a Label", input: "multi_select", options: labelNames },
  send_email_to_team: { label: "Send an Email to Team", input: "team_message", options: teamNames },
  send_email_transcript: { label: "Send an Email Transcript", input: "email" },
  mute_conversation: { label: "Mute Conversation", input: null },
  snooze_conversation: { label: "Snooze Conversation", input: null },
  resolve_conversation: { label: "Resolve Conversation", input: null },
  open_conversation: { label: "Open conversation", input: null },
  pending_conversation: { label: "Mark conversation as pending", input: null },
  send_webhook_event: { label: "Send Webhook Event", input: "url" },
  send_attachment: { label: "Send Attachment", input: "attachment" },
  send_message: { label: "Send a Message", input: "textarea" },
  add_private_note: { label: "Add a Private Note", input: "textarea" },
  change_priority: { label: "Change Priority", input: "search_select", options: priorityNames },
  add_sla: { label: "Add SLA", input: "search_select", options: slaNames },
};

const triggerLabels: Record<Trigger, string> = {
  conversation_status: "Conversation stays in a status",
  customer_unresponsive: "Customer hasn't replied",
  agent_unresponsive: "No teammate has replied",
};

function explanation(trigger: Trigger, duration: string) {
  if (trigger === "conversation_status")
    return `The clock starts when a conversation moves into this status. If it is still there ${duration} later, the actions below run. If the status changes before then, nothing happens.`;
  if (trigger === "customer_unresponsive")
    return `The clock starts when a teammate replies. If the customer hasn't written back ${duration} later, the actions below run. If they do reply, nothing happens, and the next teammate reply starts the clock again.`;
  return `The clock starts when a customer sends a message. If no teammate has replied ${duration} later, the actions below run. If someone replies before then, nothing happens.`;
}

export function durationText(amount: number, unit: string) {
  const one = unit.replace(/s$/, "");
  return `${amount} ${amount === 1 ? one : unit}`;
}

const minutesPer = { minutes: 1, hours: 60, days: 1440 } as const;

function blankCondition(event: EventKey): Condition {
  const attribute = eventConditions[event][0];
  return { attribute, operator: attributeDefs[attribute].ops[0], values: [], join: "and" };
}
const blankAction = (): Action => ({ action: "assign_agent", values: [] });

const noValueOps = ["Is present", "Is not present"];

function conditionError(c: Condition) {
  if (!c.attribute) return "Attribute key is required";
  if (!c.operator) return "Filter operator is required";
  if (!noValueOps.includes(c.operator) && !c.values.filter(Boolean).length) return "Value is required";
  return "";
}
function actionError(a: Action) {
  const input = actionDefs[a.action]?.input;
  if (!input) return "";
  if (input === "team_message") return a.values.length && a.message?.trim() ? "" : "Action parameters are required";
  return a.values.filter(Boolean).length ? "" : "Action parameters are required";
}

function ConditionValue({
  condition,
  onChange,
  invalid,
}: {
  condition: Condition;
  onChange: (values: string[]) => void;
  invalid: boolean;
}) {
  const def = attributeDefs[condition.attribute];
  if (noValueOps.includes(condition.operator)) return <div />;
  if (def.input === "multi_select")
    return (
      <MultiPick options={def.options ?? []} value={condition.values} onChange={onChange} placeholder="Select" invalid={invalid} />
    );
  if (def.input === "search_select")
    return (
      <NativeSelect
        className="w-full"
        aria-invalid={invalid}
        value={condition.values[0] ?? ""}
        onChange={(e) => onChange([e.target.value])}
      >
        <option value="" disabled>
          Select
        </option>
        {def.options?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </NativeSelect>
    );
  return (
    <Input
      aria-invalid={invalid}
      placeholder={def.input === "multi_text" ? "Enter values, comma separated" : "Enter value"}
      value={condition.values.join(def.input === "multi_text" ? ", " : "")}
      onChange={(e) =>
        onChange(def.input === "multi_text" ? e.target.value.split(",").map((v) => v.trimStart()) : [e.target.value])
      }
    />
  );
}

function ConditionList({
  event,
  conditions,
  setConditions,
  showErrors,
}: {
  event: EventKey;
  conditions: Condition[];
  setConditions: (c: Condition[]) => void;
  showErrors: boolean;
}) {
  const update = (i: number, patch: Partial<Condition>) =>
    setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const [removeWarning, setRemoveWarning] = React.useState(false);
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      {conditions.map((c, i) => {
        const def = attributeDefs[c.attribute];
        const error = showErrors ? conditionError(c) : "";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id, order is the identity.
          <div key={i} className="grid gap-2">
            {i > 0 ? (
              <NativeSelect
                size="sm"
                className="w-20"
                aria-label="Query operator"
                value={c.join}
                onChange={(e) => update(i, { join: e.target.value as "and" | "or" })}
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
              </NativeSelect>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[1fr_0.9fr_1.4fr_auto]">
              <NativeSelect
                className="w-full"
                aria-label="Attribute"
                value={c.attribute}
                onChange={(e) => {
                  const attribute = e.target.value;
                  update(i, { attribute, operator: attributeDefs[attribute].ops[0], values: [] });
                }}
              >
                <optgroup label="Standard Filters">
                  {eventConditions[event].map((key) => (
                    <option key={key} value={key}>
                      {attributeDefs[key].label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Conversation Custom Attributes">
                  {customConditions.conversation.map((key) => (
                    <option key={key} value={key}>
                      {attributeDefs[key].label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Contact Custom Attributes">
                  {customConditions.contact.map((key) => (
                    <option key={key} value={key}>
                      {attributeDefs[key].label}
                    </option>
                  ))}
                </optgroup>
              </NativeSelect>
              <NativeSelect
                className="w-full"
                aria-label="Operator"
                value={c.operator}
                onChange={(e) => update(i, { operator: e.target.value })}
              >
                {def.ops.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </NativeSelect>
              <ConditionValue condition={c} invalid={!!error} onChange={(values) => update(i, { values })} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove condition"
                onClick={() => {
                  if (conditions.length === 1) {
                    setRemoveWarning(true);
                    return;
                  }
                  setConditions(conditions.filter((_, idx) => idx !== i));
                }}
              >
                <X />
              </Button>
            </div>
            <FieldError>{error}</FieldError>
          </div>
        );
      })}
      <FieldError>{removeWarning ? "You need to have atleast one condition to save" : ""}</FieldError>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          setRemoveWarning(false);
          setConditions([...conditions, blankCondition(event)]);
        }}
      >
        <Plus /> Add Condition
      </Button>
    </div>
  );
}

function ActionValue({ action, onChange, invalid }: { action: Action; onChange: (a: Action) => void; invalid: boolean }) {
  const def = actionDefs[action.action];
  const fileRef = React.useRef<HTMLInputElement>(null);
  switch (def.input) {
    case null:
      return <div />;
    case "search_select":
      return (
        <NativeSelect
          className="w-full"
          aria-invalid={invalid}
          value={action.values[0] ?? ""}
          onChange={(e) => onChange({ ...action, values: [e.target.value] })}
        >
          <option value="" disabled>
            Select
          </option>
          {def.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
      );
    case "multi_select":
      return (
        <MultiPick
          options={def.options ?? []}
          value={action.values}
          invalid={invalid}
          onChange={(values) => onChange({ ...action, values })}
        />
      );
    case "team_message":
      return (
        <div className="grid gap-2">
          <MultiPick
            options={def.options ?? []}
            value={action.values}
            invalid={invalid}
            placeholder="Select teams"
            onChange={(values) => onChange({ ...action, values })}
          />
          <Textarea
            rows={3}
            placeholder="Enter your message here"
            value={action.message ?? ""}
            onChange={(e) => onChange({ ...action, message: e.target.value })}
          />
        </div>
      );
    case "email":
      return (
        <div className="grid gap-1.5">
          <Input
            type="email"
            aria-invalid={invalid}
            placeholder="Enter email"
            value={action.values[0] ?? ""}
            onChange={(e) => onChange({ ...action, values: [e.target.value] })}
          />
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto w-fit px-0 text-xs"
            onClick={() => onChange({ ...action, values: ["{{contact.email}}"] })}
          >
            Use contact&apos;s email
          </Button>
        </div>
      );
    case "url":
      return (
        <Input
          type="url"
          aria-invalid={invalid}
          placeholder="Enter URL"
          value={action.values[0] ?? ""}
          onChange={(e) => onChange({ ...action, values: [e.target.value] })}
        />
      );
    case "attachment":
      return (
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const name = e.target.files?.[0]?.name;
              if (name) onChange({ ...action, values: [name] });
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-invalid={invalid}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip /> {action.values[0] ? "Successfully Uploaded" : "Upload Attachment"}
          </Button>
          {action.values[0] ? <span className="truncate text-muted-foreground text-xs">{action.values[0]}</span> : null}
        </div>
      );
    default:
      return (
        <Textarea
          rows={3}
          aria-invalid={invalid}
          placeholder="Enter your message here"
          value={action.values[0] ?? ""}
          onChange={(e) => onChange({ ...action, values: [e.target.value] })}
        />
      );
  }
}

function ActionList({
  actions,
  setActions,
  showErrors,
}: {
  actions: Action[];
  setActions: (a: Action[]) => void;
  showErrors: boolean;
}) {
  const [removeWarning, setRemoveWarning] = React.useState(false);
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      {actions.map((a, i) => {
        const error = showErrors ? actionError(a) : "";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id, order is the identity.
          <div key={i} className="grid gap-1.5">
            <div className="grid items-start gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <NativeSelect
                className="w-full"
                aria-label="Action"
                value={a.action}
                onChange={(e) =>
                  setActions(actions.map((x, idx) => (idx === i ? { action: e.target.value, values: [] } : x)))
                }
              >
                {Object.entries(actionDefs).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
              </NativeSelect>
              <ActionValue
                action={a}
                invalid={!!error}
                onChange={(next) => setActions(actions.map((x, idx) => (idx === i ? next : x)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove action"
                onClick={() => {
                  if (actions.length === 1) {
                    setRemoveWarning(true);
                    return;
                  }
                  setActions(actions.filter((_, idx) => idx !== i));
                }}
              >
                <X />
              </Button>
            </div>
            <FieldError>{error}</FieldError>
          </div>
        );
      })}
      <FieldError>{removeWarning ? "You need to have atleast one action to save" : ""}</FieldError>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          setRemoveWarning(false);
          setActions([...actions, blankAction()]);
        }}
      >
        <Plus /> Add Action
      </Button>
    </div>
  );
}

type Draft = Omit<Rule, "id" | "createdOn" | "active"> & { wait: NonNullable<Rule["wait"]> };

function draftFrom(rule?: Rule): Draft {
  return {
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    runType: rule?.runType ?? "instant",
    event: rule?.event ?? "conversation_created",
    conditions: rule?.conditions.length ? rule.conditions : [blankCondition(rule?.event ?? "conversation_created")],
    actions: rule?.actions.length ? rule.actions : [blankAction()],
    wait: rule?.wait ?? { trigger: "conversation_status", status: "Pending", amount: 4, unit: "hours", inboxes: [] },
  };
}

export function RuleDialog({
  open,
  onOpenChange,
  rule,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rule?: Rule;
  onSave: (draft: Omit<Rule, "id" | "createdOn" | "active">) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom(rule));
  const [submitted, setSubmitted] = React.useState(false);
  const [eventChanged, setEventChanged] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(rule));
    setSubmitted(false);
    setEventChanged(false);
  }, [open, rule]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const waitMinutes = draft.wait.amount * minutesPer[draft.wait.unit];

  const errors = {
    name: draft.name.trim() ? "" : "Name is required",
    description: draft.description.trim() ? "" : "Description is required",
    wait:
      draft.runType === "delayed" && (waitMinutes < 10 || waitMinutes > 43200 || !Number.isFinite(waitMinutes))
        ? "The wait must be between 10 minutes and 30 days"
        : "",
    conditions: draft.runType === "instant" ? draft.conditions.map(conditionError).find(Boolean) : "",
    actions: draft.actions.map(actionError).find(Boolean) ?? "",
  };
  const hasError = Object.values(errors).some(Boolean);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasError) return;
    const eventName: EventKey =
      draft.runType === "delayed"
        ? draft.wait.trigger === "conversation_status"
          ? "conversation_updated"
          : "message_created"
        : draft.event;
    onSave({ ...draft, event: eventName, wait: draft.runType === "delayed" ? draft.wait : undefined });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{rule ? "Edit Automation Rule" : "Add Automation Rule"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              placeholder="Enter rule name"
              value={draft.name}
              aria-invalid={submitted && !!errors.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <FieldError>{submitted ? errors.name : ""}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rule-desc">Description</Label>
            <Textarea
              id="rule-desc"
              placeholder="Enter rule description"
              value={draft.description}
              aria-invalid={submitted && !!errors.description}
              onChange={(e) => set("description", e.target.value)}
            />
            <FieldError>{submitted ? errors.description : ""}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label>When should this rule run?</Label>
            <RadioGroup
              value={draft.runType}
              onValueChange={(v) => set("runType", v as RunType)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {[
                {
                  value: "instant",
                  icon: Zap,
                  label: "Run instantly",
                  desc: "Runs the moment an event happens, as long as the conditions match.",
                },
                {
                  value: "delayed",
                  icon: Clock,
                  label: "Run after a wait",
                  desc: "Waits for a set time and runs only if things are still the same. If they change, the rule is skipped.",
                },
              ].map((o) => (
                <Label
                  key={o.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                >
                  <RadioGroupItem value={o.value} className="mt-0.5" />
                  <div className="grid gap-1">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <o.icon className="size-3.5" /> {o.label}
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">{o.desc}</span>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {draft.runType === "instant" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="rule-event">Event</Label>
                <NativeSelect
                  id="rule-event"
                  className="w-full"
                  value={draft.event}
                  onChange={(e) => {
                    const event = e.target.value as EventKey;
                    setDraft((d) => ({ ...d, event, conditions: [blankCondition(event)], actions: [blankAction()] }));
                    setEventChanged(true);
                  }}
                >
                  {(Object.keys(eventLabels) as EventKey[]).map((e) => (
                    <option key={e} value={e}>
                      {eventLabels[e]}
                    </option>
                  ))}
                </NativeSelect>
                {eventChanged ? (
                  <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <TriangleAlert />
                    <AlertDescription className="text-inherit">
                      Changing event type will reset the conditions and events you have added below
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>Conditions</Label>
                <ConditionList
                  event={draft.event}
                  conditions={draft.conditions}
                  setConditions={(c) => set("conditions", c)}
                  showErrors={submitted}
                />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label>Wait condition</Label>
              <div
                className="grid gap-4 rounded-xl border p-4 data-[error=true]:border-destructive/50 data-[error=true]:bg-destructive/5"
                data-error={submitted && !!errors.wait}
              >
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-muted-foreground text-sm">When</span>
                      <NativeSelect
                        className="w-full"
                        aria-label="When"
                        value={draft.wait.trigger}
                        onChange={(e) => set("wait", { ...draft.wait, trigger: e.target.value as Trigger })}
                      >
                        {(Object.keys(triggerLabels) as Trigger[]).map((t) => (
                          <option key={t} value={t}>
                            {triggerLabels[t]}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    {draft.wait.trigger === "conversation_status" ? (
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-muted-foreground text-sm">Status is</span>
                        <NativeSelect
                          className="w-full"
                          aria-label="Status is"
                          value={draft.wait.status}
                          onChange={(e) => set("wait", { ...draft.wait, status: e.target.value })}
                        >
                          {statusNames.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </NativeSelect>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-muted-foreground text-sm">For</span>
                      <div className="flex w-64 gap-2">
                        <Input
                          type="number"
                          min={1}
                          aria-label="Duration"
                          className="w-20"
                          value={draft.wait.amount}
                          onChange={(e) => set("wait", { ...draft.wait, amount: Number(e.target.value) })}
                        />
                        <NativeSelect
                          className="w-full"
                          aria-label="Unit"
                          value={draft.wait.unit}
                          onChange={(e) =>
                            set("wait", { ...draft.wait, unit: e.target.value as "minutes" | "hours" | "days" })
                          }
                        >
                          <option value="minutes">minutes</option>
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </NativeSelect>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-muted-foreground text-sm">Inbox</span>
                      <MultiPick
                        options={inboxNames}
                        value={draft.wait.inboxes}
                        placeholder="All inboxes"
                        onChange={(inboxes) => set("wait", { ...draft.wait, inboxes })}
                      />
                    </div>
                  </div>
                  <aside className="flex gap-2 self-start rounded-xl bg-muted/50 p-3">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="grid gap-2 text-muted-foreground text-xs leading-relaxed">
                      <p>{explanation(draft.wait.trigger, durationText(draft.wait.amount, draft.wait.unit))}</p>
                      <p>
                        Only new activity starts a clock. Conversations already sitting in this state are picked up the
                        next time something happens on them.
                      </p>
                    </div>
                  </aside>
                </div>
              </div>
              <FieldError>{submitted ? errors.wait : ""}</FieldError>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Actions</Label>
            <ActionList actions={draft.actions} setActions={(a) => set("actions", a)} showErrors={submitted} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{rule ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

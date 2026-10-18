"use client";
// F159 settings-b: Chatwoot v4.18 AutomationRuleForm.vue + components/AutomationRunTypeSelector.vue,
// AutomationWaitCondition.vue, AutomationActions.vue; events/conditions/actions from constants.js and operators.js.
import * as React from "react";

import { Clock, Info, Play, Plus, TriangleAlert, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_NAME } from "@/config/app-config";

import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import { statusNames } from "../../labels/_shared/settings-data";
import { FieldError, MultiPick } from "../../labels/_shared/settings-ui";
// M129-G: "Create calendar event" lists the Davis calendars and its event's day and time.
import { CalendarEventFields } from "../_flow/calendar-action";
// T-139: the catalog (events, fields, operators, actions, waits, checks) now lives in ../_flow/catalog.ts, unchanged,
// so this form and the visual editor read one copy. The names this file exported before are still exported here.
import {
  type Action,
  actionDefs,
  actionError,
  attributeDefs,
  blankAction,
  blankCondition,
  type Condition,
  conditionError,
  contactFieldKeys,
  customConditions,
  durationText,
  type EventKey,
  eventConditions,
  eventLabels,
  explanation,
  minutesPer,
  noValueOps,
  type Rule,
  type RunType,
  simConditionKeys,
  type Trigger,
  triggerLabels,
} from "../_flow/catalog";
// M129-B: "Send Attachment" uploads and checks the file per channel; the simulator's lists come from the editor.
import { MediaPicker } from "../_flow/media-ui";
import { useSimOptions } from "../_flow/sim-options";
import { defaultVariables, type TemplateAction } from "../_flow/template-vars";
import { TemplateVariablesFields } from "../_flow/template-vars-ui";
// F-11: "Create task in Twenty", "Create draft invoice" and "Notify a teammate" (work-action-fields.tsx).
import { InvoiceDraftFields, TeammateNotifyFields, TwentyTaskFields } from "../_flow/work-action-fields";

export type { Action, Condition, EventKey, Rule, RunType, Trigger };
export { actionDefs, durationText, eventLabels };

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
  const sim = useSimOptions();
  useLivePickerNames(); // F-6B: def.options reads the live agents, teams, inboxes and labels; draw again when they change
  if (def.input === "key_value")
    return (
      <KeyValue
        values={condition.values}
        invalid={invalid}
        hideValue={noValueOps.includes(condition.operator)}
        onChange={onChange}
      />
    );
  if (noValueOps.includes(condition.operator) || def.input === "none") return <div />;
  const options = condition.attribute === "folder" ? sim.folders : def.options;
  if (def.input === "multi_select")
    return (
      <MultiPick
        options={options ?? []}
        value={condition.values}
        onChange={onChange}
        placeholder="Select"
        invalid={invalid}
      />
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
          {condition.attribute === "folder" && !options?.length ? "No folders saved in Conversations" : "Select"}
        </option>
        {options?.map((o) => (
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

/** M129-B: a contact field (name, or one typed in) and its value. */
function KeyValue({
  values,
  onChange,
  invalid,
  hideValue = false,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  invalid: boolean;
  hideValue?: boolean;
}) {
  const listId = React.useId();
  return (
    <div className="grid gap-2">
      <Input
        list={listId}
        aria-label="Contact field"
        aria-invalid={invalid && !values[0]?.trim()}
        placeholder="Field, e.g. preferred_language"
        value={values[0] ?? ""}
        onChange={(e) => onChange([e.target.value, values[1] ?? ""])}
      />
      <datalist id={listId}>
        {contactFieldKeys.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>
      {hideValue ? null : (
        <Input
          aria-label="Value"
          aria-invalid={invalid && !values[1]?.trim()}
          placeholder="Value"
          value={values[1] ?? ""}
          onChange={(e) => onChange([values[0] ?? "", e.target.value])}
        />
      )}
    </div>
  );
}

export function ConditionList({
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
                <optgroup label={`${PRODUCT_NAME} simulator`}>
                  {simConditionKeys.map((key) => (
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
            {def.hint ? (
              <p className="text-muted-foreground text-xs leading-relaxed" data-condition-hint={c.attribute}>
                {def.hint}
              </p>
            ) : null}
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

export function ActionValue({
  action,
  onChange,
  invalid,
}: {
  action: Action;
  onChange: (a: Action) => void;
  invalid: boolean;
}) {
  const def = actionDefs[action.action];
  const sim = useSimOptions();
  useLivePickerNames(); // F-6B: live teams, agents, labels and SLAs in def.options
  switch (def.input) {
    case null:
      return <div />;
    case "key_value":
      return (
        <KeyValue values={action.values} invalid={invalid} onChange={(values) => onChange({ ...action, values })} />
      );
    case "search_select": {
      const isTemplate = action.action === "send_template";
      const options = isTemplate ? sim.templates : def.options;
      const select = (
        <NativeSelect
          className="w-full"
          aria-invalid={invalid}
          value={action.values[0] ?? ""}
          onChange={(e) => {
            // F-3 item 6: a newly picked template starts with {{1}} = the contact's first name
            const next: TemplateAction = { ...action, values: [e.target.value] };
            if (isTemplate) next.variables = defaultVariables(sim.templateBodies[e.target.value] ?? "");
            onChange(next);
          }}
        >
          <option value="" disabled>
            Select
          </option>
          {options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
      );
      if (!isTemplate) return select;
      return (
        <div className="grid gap-2">
          {select}
          <TemplateVariablesFields action={action} onChange={onChange} />
        </div>
      );
    }
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
      // M129-B: the old picker only kept the file's name and said sending was not available; now the file is
      // uploaded to this preview, saved with the flow, and checked for every channel (media-ui.tsx).
      return <MediaPicker action={action} onChange={onChange} invalid={invalid} />;
    case "calendar_event":
      return <CalendarEventFields action={action} onChange={onChange} invalid={invalid} />;
    case "twenty_task":
      return <TwentyTaskFields action={action} onChange={onChange} invalid={invalid} />;
    case "invoice_draft":
      return <InvoiceDraftFields action={action} onChange={onChange} invalid={invalid} />;
    case "teammate_notify":
      return <TeammateNotifyFields action={action} onChange={onChange} invalid={invalid} />;
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
  const names = useLivePickerNames();

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
                  // F-10 (Fahad 125.3): "run" is Play, the icon of Chatwoot's own run-now button (Macros > Execute,
                  // conversation/Macros/MacroItem.vue i-lucide-play); Chatwoot's run-type cards carry no icon.
                  icon: Play,
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
                        options={names.inboxes}
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

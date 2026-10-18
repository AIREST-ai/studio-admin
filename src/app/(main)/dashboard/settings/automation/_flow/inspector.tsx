"use client";
// T-139: the side panel. A selected step is edited with the text form's own fields (ConditionList, ActionValue and
// the same wait controls and words), so the editor has exactly the form's options, no fewer and no others. With no
// step selected it shows the flow itself: name, description, the rules it makes, and the related pages.
import Link from "next/link";

import { Info, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_NAME } from "@/config/app-config";

import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import { statusNames } from "../../labels/_shared/settings-data";
import { MultiPick } from "../../labels/_shared/settings-ui";
import { ActionValue, ConditionList } from "../_components/rule-form";
import {
  actionDefs,
  durationText,
  type EventKey,
  eventLabels,
  explanation,
  type Trigger,
  triggerLabels,
} from "./catalog";
import type { CompiledPath, Issue } from "./compile";
import type { FlowNode, FlowSettings, WaitData } from "./model";
import { SIM_HONEST_DETAIL, SOURCES } from "./sim-catalog";
import {
  AskFields,
  DelayFields,
  GotoFields,
  HttpFields,
  SplitFields,
  TriggerEventSelect,
  TriggerExtras,
} from "./sim-inspector";

function Issues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="grid gap-1.5" aria-label="Problems in this step">
      {issues.map((issue) => (
        <li
          key={issue.message}
          className={
            issue.level === "error"
              ? "flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive text-xs leading-relaxed"
              : "flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-amber-700 text-xs leading-relaxed dark:text-amber-400"
          }
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function StepInspector({
  node,
  title,
  issues,
  event,
  waitFirst,
  inSheet = false,
  onChange,
  onDelete,
}: {
  node: FlowNode;
  title: string;
  issues: Issue[];
  /** The event the rule runs on (a wait sets it). */
  event: EventKey;
  /** true when a wait sits right after the trigger (then the wait chooses the event). */
  waitFirst: boolean;
  /** In a sheet the sheet's own header shows the title. */
  inSheet?: boolean;
  onChange: (node: FlowNode) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-4" data-inspector-for={node.id}>
      <div className="flex items-start justify-between gap-2">
        <h2 className={inSheet ? "sr-only" : "font-semibold text-base"} id="inspector-title" tabIndex={-1}>
          {title}
        </h2>
        {node.kind !== "trigger" ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
            <Trash2 /> Delete step
          </Button>
        ) : null}
      </div>
      <Issues issues={issues} />
      {node.kind === "trigger" ? (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="flow-event">Event</Label>
            {/* M129-B: Chatwoot's five events, then the simulator's (schedule, label added, outside events) */}
            <TriggerEventSelect
              node={node}
              value={waitFirst ? event : node.event}
              disabled={waitFirst}
              onChange={onChange}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              {waitFirst
                ? "The wait below chooses the event, as in the form: a status wait runs on Conversation Updated, the two “hasn't replied” waits on Message Created."
                : "The rule runs when this happens, if the conditions below match. Rows that do not fit a new event are flagged, not deleted."}
            </p>
          </div>
          <TriggerExtras node={node} onChange={onChange} />
        </div>
      ) : null}
      {node.kind === "ask" ? <AskFields ask={node.ask} onChange={(ask) => onChange({ ...node, ask })} /> : null}
      {node.kind === "delay" ? (
        <DelayFields delay={node.delay} onChange={(delay) => onChange({ ...node, delay })} />
      ) : null}
      {node.kind === "split" ? (
        <SplitFields split={node.split} onChange={(split) => onChange({ ...node, split })} />
      ) : null}
      {node.kind === "http" ? <HttpFields http={node.http} onChange={(http) => onChange({ ...node, http })} /> : null}
      {node.kind === "goto" ? <GotoFields goto={node.goto} onChange={(goto) => onChange({ ...node, goto })} /> : null}
      {node.kind === "wait" ? <WaitFields wait={node.wait} onChange={(wait) => onChange({ ...node, wait })} /> : null}
      {node.kind === "condition" ? (
        <div className="grid gap-2" data-flow-conditions>
          {/* The form lays a row out as four columns for its wide window; in this narrow panel that cut the field and
              operator names to two or three letters. Here each row is one column, so every name shows in full. */}
          <style>{`
            [data-flow-conditions] [class*="grid-cols-[1fr_0.9fr_1.4fr_auto]"] { grid-template-columns: minmax(0, 1fr); }
            [data-flow-conditions] [class*="grid-cols-[1fr_0.9fr_1.4fr_auto]"] > button { justify-self: end; }
          `}</style>
          <Label>Conditions</Label>
          <ConditionList
            event={event}
            conditions={node.rows}
            setConditions={(rows) => onChange({ ...node, rows })}
            showErrors
          />
          <p className="flex gap-1.5 text-muted-foreground text-xs leading-relaxed">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Yes runs when these rows match (AND before OR, as the engine reads them). Else runs when they do not: it
              is allowed only where the engine has an exact opposite, so a conversation can never run both or neither.
            </span>
          </p>
        </div>
      ) : null}
      {node.kind === "action" ? (
        <div className="grid gap-2">
          <Label htmlFor="flow-action">Action</Label>
          <NativeSelect
            id="flow-action"
            className="w-full"
            value={node.action.action}
            onChange={(e) => onChange({ ...node, action: { action: e.target.value, values: [] } })}
          >
            <optgroup label="Engine actions">
              {Object.entries(actionDefs)
                .filter(([, def]) => !def.sim)
                .map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label={`${PRODUCT_NAME} simulator actions`}>
              {Object.entries(actionDefs)
                .filter(([, def]) => def.sim)
                .map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
            </optgroup>
          </NativeSelect>
          <ActionValue
            action={node.action}
            invalid={issues.some((issue) => issue.message === "Action parameters are required")}
            onChange={(action) => onChange({ ...node, action })}
          />
        </div>
      ) : null}
    </div>
  );
}

function WaitFields({ wait, onChange }: { wait: WaitData; onChange: (wait: WaitData) => void }) {
  const names = useLivePickerNames(); // F-6B: the live inboxes, not the seed
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="flow-wait-when">When</Label>
        <NativeSelect
          id="flow-wait-when"
          className="w-full"
          value={wait.trigger}
          onChange={(e) => onChange({ ...wait, trigger: e.target.value as Trigger })}
        >
          {(Object.keys(triggerLabels) as Trigger[]).map((t) => (
            <option key={t} value={t}>
              {triggerLabels[t]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {wait.trigger === "conversation_status" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="flow-wait-status">Status is</Label>
          <NativeSelect
            id="flow-wait-status"
            className="w-full"
            value={wait.status}
            onChange={(e) => onChange({ ...wait, status: e.target.value })}
          >
            {statusNames.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="flow-wait-amount">For</Label>
        <div className="flex gap-2">
          <Input
            id="flow-wait-amount"
            type="number"
            min={1}
            className="w-24"
            value={wait.amount}
            onChange={(e) => onChange({ ...wait, amount: Number(e.target.value) })}
          />
          <NativeSelect
            className="w-full"
            aria-label="Unit"
            value={wait.unit}
            onChange={(e) => onChange({ ...wait, unit: e.target.value as WaitData["unit"] })}
          >
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Inbox</Label>
        <MultiPick
          options={names.inboxes}
          value={wait.inboxes}
          placeholder="All inboxes"
          onChange={(inboxes) => onChange({ ...wait, inboxes })}
        />
      </div>
      <aside className="flex gap-2 rounded-xl bg-muted/50 p-3">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="grid gap-2 text-muted-foreground text-xs leading-relaxed">
          <p>{explanation(wait.trigger, durationText(wait.amount, wait.unit))}</p>
          <p>
            Only new activity starts a clock. Conversations already sitting in this state are picked up the next time
            something happens on them.
          </p>
        </div>
      </aside>
    </div>
  );
}

const RELATED: { label: string; href: string; why: string }[] = [
  { label: "Macros", href: "/dashboard/settings/macros", why: "the same actions, run by hand" },
  { label: "Canned responses", href: "/dashboard/settings/canned-responses", why: "saved replies" },
  { label: "Agent bots", href: "/dashboard/settings/bots", why: "bots that answer first" },
  { label: "SLA", href: "/dashboard/settings/sla", why: "used by the Add SLA action" },
  { label: "Assignment policy", href: "/dashboard/settings/assignment-policy", why: "automatic assignment" },
  { label: "Custom attributes", href: "/dashboard/settings/attributes", why: "fields the conditions can check" },
];

export function FlowInspector({
  name,
  description,
  onName,
  onDescription,
  issues,
  paths,
  ruleState,
  inSheet = false,
  simReasons = [],
  settings = {},
  onSettings,
}: {
  name: string;
  description: string;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  issues: Issue[];
  paths: CompiledPath[];
  ruleState: { name: string; active: boolean }[];
  inSheet?: boolean;
  /** M129-B: why this flow runs in the Studio simulator (empty = it becomes Chatwoot rules). */
  simReasons?: string[];
  settings?: FlowSettings;
  onSettings?: (settings: FlowSettings) => void;
}) {
  const sim = simReasons.length > 0;
  return (
    <div className="grid gap-4" data-inspector-for="flow">
      <h2 className={inSheet ? "sr-only" : "font-semibold text-base"} id="inspector-title" tabIndex={-1}>
        Flow settings
      </h2>
      <Issues issues={issues} />
      <div className="grid gap-2">
        <Label htmlFor="flow-name">Rule Name</Label>
        <Input id="flow-name" placeholder="Enter rule name" value={name} onChange={(e) => onName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="flow-description">Description</Label>
        <Textarea
          id="flow-description"
          placeholder="Enter rule description"
          value={description}
          onChange={(e) => onDescription(e.target.value)}
        />
      </div>
      <div
        className="grid gap-2 rounded-lg border p-3"
        data-testid="flow-engine"
        data-engine={sim ? "simulator" : "chatwoot"}
      >
        <p className="font-medium text-sm">{sim ? `Runs in the ${PRODUCT_NAME} simulator` : "Becomes engine rules"}</p>
        <p className="text-muted-foreground text-xs leading-relaxed">{SIM_HONEST_DETAIL}</p>
        {sim ? (
          <ul className="grid list-disc gap-0.5 pl-4 text-muted-foreground text-xs leading-relaxed">
            {[...new Set(simReasons)].map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Every step here is one the engine (v4.18) can run, so approving writes engine rules into this preview's
            list.
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="flow-gap">Seconds between replies</Label>
        <Input
          id="flow-gap"
          type="number"
          min={0}
          max={3600}
          className="w-28"
          value={settings.secondsBetweenReplies ?? 0}
          onChange={(e) => onSettings?.({ ...settings, secondsBetweenReplies: Number(e.target.value) })}
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Keeps at least this many seconds between two automated messages to the same contact (0 = none). WhatsApp takes
          about one message every 6 seconds to the same person (error 131056 when faster).{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={SOURCES.waErrors.url}
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </p>
      </div>
      <div className="grid gap-2">
        <p className="font-medium text-sm">{sim ? "Engine rules" : "Rules this flow makes"}</p>
        {sim ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            None: the engine's (v4.18) rules cannot run the steps listed above. Approving keeps this flow as an approved
            simulator flow.
          </p>
        ) : paths.length ? (
          <ul className="grid gap-1.5">
            {paths.map((path) => (
              <li key={path.key} className="rounded-lg border p-2 text-xs leading-relaxed">
                <span className="font-medium text-sm">{path.label || name || "This flow"}</span>
                <span className="block text-muted-foreground">
                  {path.runType === "delayed" && path.wait
                    ? `Runs after ${durationText(path.wait.amount, path.wait.unit)}`
                    : `Runs instantly on ${eventLabels[path.event]}`}
                  {` · ${path.conditions.length} condition row${path.conditions.length === 1 ? "" : "s"} · ${path.actions.length} action${path.actions.length === 1 ? "" : "s"}`}
                  {path.restructured ? " · rows rebuilt for the engine" : ""}
                  {path.blocked ? " · cannot become a rule yet" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">Add steps under the trigger.</p>
        )}
        {ruleState.length ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Approved rules: {ruleState.map((rule) => `${rule.name} (${rule.active ? "on" : "off"})`).join(", ")}. Turn
            them on or off in the Automation list, where the engine asks you to confirm.
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <p className="font-medium text-sm">Related pages</p>
        <p className="text-muted-foreground text-xs">
          The engine keeps these outside rules; the flow links to them instead of copying them.
        </p>
        <ul className="grid gap-1 text-sm">
          {RELATED.map((item) => (
            <li key={item.href}>
              <Link className="text-primary underline-offset-4 hover:underline" href={item.href}>
                {item.label}
              </Link>
              <span className="text-muted-foreground text-xs"> · {item.why}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

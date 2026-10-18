"use client";
// M129-B (items 129.1, 129.2): the side panel's fields for the Studio simulator: the trigger's simulator events
// (schedule, label added, outside events), its channels and "Once per contact / Every time", and the five simulator
// steps (Ask a question, Wait between steps, Random split, HTTP request, Go to another flow). Each says what it does
// and where the idea comes from; none of them sends anything.
import { ExternalLink, Info } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_NAME } from "@/config/app-config";

import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import { MultiPick } from "../../labels/_shared/settings-ui";
import { contactFieldKeys, type EventKey, eventLabels } from "./catalog";
import type {
  AskData,
  DelayData,
  FlowEvent,
  GotoData,
  HttpData,
  ScheduleData,
  SimChannel,
  SplitData,
  TriggerNode,
} from "./model";
import {
  CHANNELS,
  channelOfLabel,
  isSimEvent,
  SIM_CHANNELS,
  SIM_EVENT_KEYS,
  SIM_EVENTS,
  SIM_STEP_INFO,
  SOURCES,
  type Source,
} from "./sim-catalog";
import { useSimOptions } from "./sim-options";

function SourceLink({ source }: { source: Source }) {
  // F-16 round 2: a source without an address (another product's code) is not linked or shown.
  if (!source.url) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1 text-primary text-xs underline-offset-4 hover:underline"
    >
      Source: {source.label} <ExternalLink className="size-3" />
    </a>
  );
}

function Note({ children, source }: { children: React.ReactNode; source?: Source }) {
  return (
    <aside className="flex gap-2 rounded-xl bg-muted/50 p-3">
      <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="grid gap-1.5 text-muted-foreground text-xs leading-relaxed">
        {children}
        {source ? <SourceLink source={source} /> : null}
      </div>
    </aside>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** A new schedule starts today at 09:00 in the browser's own timezone (the teammate changes what they need). */
export function blankSchedule(): ScheduleData {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return { mode: "once", date: today(), time: "09:00", weekdays: [new Date().getDay()], timezone, labels: [] };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The trigger's Event select: Chatwoot's five events, then the simulator's. */
export function TriggerEventSelect({
  node,
  value,
  disabled,
  onChange,
}: {
  node: TriggerNode;
  value: FlowEvent;
  disabled: boolean;
  onChange: (node: TriggerNode) => void;
}) {
  return (
    <NativeSelect
      id="flow-event"
      className="w-full"
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const event = e.target.value as FlowEvent;
        const next: TriggerNode = { ...node, event };
        if (event === "scheduled" && !next.schedule) next.schedule = blankSchedule();
        if (isSimEvent(event)) next.detail = SIM_EVENTS[event].details?.[0];
        else delete next.detail;
        onChange(next);
      }}
    >
      <optgroup label="Engine events">
        {(Object.keys(eventLabels) as EventKey[]).map((key) => (
          <option key={key} value={key}>
            {eventLabels[key]}
          </option>
        ))}
      </optgroup>
      <optgroup label={`${PRODUCT_NAME} simulator events`}>
        {SIM_EVENT_KEYS.map((key) => (
          <option key={key} value={key}>
            {SIM_EVENTS[key].label}
          </option>
        ))}
      </optgroup>
    </NativeSelect>
  );
}

/** Below the Event select: the simulator event's own fields, the channels and once per contact. */
export function TriggerExtras({ node, onChange }: { node: TriggerNode; onChange: (node: TriggerNode) => void }) {
  const { labels: labelNames } = useLivePickerNames(); // F-6B: the live labels, not the seed
  const event = node.event;
  const schedule = node.schedule ?? blankSchedule();
  const setSchedule = (patch: Partial<ScheduleData>) => onChange({ ...node, schedule: { ...schedule, ...patch } });
  return (
    <div className="grid gap-4" data-trigger-extras>
      {isSimEvent(event) ? (
        <Note>
          <p>{SIM_EVENTS[event].hint}</p>
        </Note>
      ) : null}
      {event === "scheduled" ? (
        <div className="grid gap-3" data-testid="schedule-fields">
          <div className="grid gap-1.5">
            <Label htmlFor="schedule-mode">Repeat</Label>
            <NativeSelect
              id="schedule-mode"
              className="w-full"
              value={schedule.mode}
              onChange={(e) => setSchedule({ mode: e.target.value as ScheduleData["mode"] })}
            >
              <option value="once">Once, on a date</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-date">{schedule.mode === "once" ? "Date" : "Starting"}</Label>
              <Input
                id="schedule-date"
                type="date"
                value={schedule.date}
                onChange={(e) => setSchedule({ date: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={schedule.time}
                onChange={(e) => setSchedule({ time: e.target.value })}
              />
            </div>
          </div>
          {schedule.mode === "weekly" ? (
            <div className="grid gap-1.5">
              <Label>On</Label>
              <MultiPick
                options={WEEKDAY_NAMES}
                value={schedule.weekdays.map((d) => WEEKDAY_NAMES[d])}
                onChange={(names) => setSchedule({ weekdays: names.map((n) => WEEKDAY_NAMES.indexOf(n)).sort() })}
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="schedule-zone">Timezone</Label>
            <Input
              id="schedule-zone"
              value={schedule.timezone}
              placeholder="e.g. Asia/Riyadh"
              onChange={(e) => setSchedule({ timezone: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Only conversations with these labels</Label>
            <MultiPick
              options={labelNames}
              value={schedule.labels}
              placeholder="Every open conversation"
              onChange={(labels) => setSchedule({ labels })}
            />
          </div>
        </div>
      ) : null}
      {event === "label_added" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="trigger-label">Label</Label>
          <NativeSelect
            id="trigger-label"
            className="w-full"
            value={node.label ?? ""}
            onChange={(e) => onChange({ ...node, label: e.target.value })}
          >
            <option value="" disabled>
              Select
            </option>
            {labelNames.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      {isSimEvent(event) && SIM_EVENTS[event].details ? (
        <div className="grid gap-1.5">
          <Label htmlFor="trigger-detail">Which one</Label>
          <NativeSelect
            id="trigger-detail"
            className="w-full"
            value={node.detail ?? ""}
            onChange={(e) => onChange({ ...node, detail: e.target.value })}
          >
            {SIM_EVENTS[event].details?.map((detail) => (
              <option key={detail}>{detail}</option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        <Label>Channels</Label>
        <MultiPick
          className="min-w-0 max-w-full"
          options={SIM_CHANNELS.map((c) => CHANNELS[c].label)}
          value={(node.channels ?? []).map((c) => CHANNELS[c].label)}
          placeholder="Every channel"
          onChange={(labels) => {
            const channels = labels.map(channelOfLabel).filter((c): c is SimChannel => !!c);
            const next: TriggerNode = { ...node, channels };
            if (!channels.length) delete next.channels;
            onChange(next);
          }}
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Run this flow only for conversations on these channels (inboxes). Empty = every channel.
        </p>
      </div>
      <div className="grid gap-1.5" data-testid="repeat-setting">
        <Label>For each contact</Label>
        <RadioGroup
          value={node.repeat ?? "every_time"}
          onValueChange={(value) => {
            const next: TriggerNode = { ...node, repeat: value as TriggerNode["repeat"] };
            if (value === "every_time") delete next.repeat;
            onChange(next);
          }}
          className="grid gap-2"
        >
          {[
            {
              value: "every_time",
              label: "Every time",
              desc: "Runs each time the trigger happens, also for the same contact.",
            },
            {
              value: "once_per_contact",
              label: "Once per contact",
              desc: "Runs only the first time for a contact; later triggers for them are skipped.",
            },
          ].map((o) => (
            <Label
              key={o.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
            >
              <RadioGroupItem value={o.value} className="mt-0.5" aria-label={o.label} />
              <span className="grid gap-0.5">
                <span className="font-medium text-sm">{o.label}</span>
                <span className="text-muted-foreground text-xs leading-relaxed">{o.desc}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}

function AmountUnit<U extends string>({
  id,
  amount,
  unit,
  units,
  onChange,
}: {
  id: string;
  amount: number;
  unit: U;
  units: U[];
  onChange: (amount: number, unit: U) => void;
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="number"
        min={1}
        className="w-24"
        value={amount}
        onChange={(e) => onChange(Number(e.target.value), unit)}
      />
      <NativeSelect
        className="w-full"
        aria-label="Unit"
        value={unit}
        onChange={(e) => onChange(amount, e.target.value as U)}
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function AskFields({ ask, onChange }: { ask: AskData; onChange: (ask: AskData) => void }) {
  const listId = "ask-save-fields";
  return (
    <div className="grid gap-3" data-testid="ask-fields">
      <div className="grid gap-1.5">
        <Label htmlFor="ask-question">Question</Label>
        <Textarea
          id="ask-question"
          rows={3}
          value={ask.question}
          aria-invalid={!ask.question.trim()}
          placeholder="Would you like to talk to our team?"
          onChange={(e) => onChange({ ...ask, question: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Reply buttons (optional, up to 3)</Label>
        {ask.answers.map((answer, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: buttons have no id; order is the identity.
          <div key={index} className="flex gap-2">
            <Input
              aria-label={`Button ${index + 1}`}
              value={answer}
              maxLength={20}
              onChange={(e) =>
                onChange({ ...ask, answers: ask.answers.map((a, i) => (i === index ? e.target.value : a)) })
              }
            />
            <button
              type="button"
              className="rounded-md px-2 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => onChange({ ...ask, answers: ask.answers.filter((_, i) => i !== index) })}
            >
              Remove
            </button>
          </div>
        ))}
        {ask.answers.length < 3 ? (
          <button
            type="button"
            className="w-fit text-primary text-xs underline-offset-4 hover:underline"
            onClick={() => onChange({ ...ask, answers: [...ask.answers, ""] })}
          >
            Add a button
          </button>
        ) : null}
        <SourceLink source={SOURCES.waButtons} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ask-save">Save the answer to the contact field (optional)</Label>
        <Input
          id="ask-save"
          list={listId}
          value={ask.saveTo}
          placeholder="preferred_language"
          onChange={(e) => onChange({ ...ask, saveTo: e.target.value })}
        />
        <datalist id={listId}>
          {contactFieldKeys.map((key) => (
            <option key={key} value={key} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ask-timeout">No reply after</Label>
        <AmountUnit
          id="ask-timeout"
          amount={ask.timeout.amount}
          unit={ask.timeout.unit}
          units={["minutes", "hours", "days"]}
          onChange={(amount, unit) => onChange({ ...ask, timeout: { amount, unit } })}
        />
      </div>
      <Note source={SIM_STEP_INFO.ask.source}>
        <p>
          Two exits: <b>Replied</b> when the customer answers in time, <b>No reply</b> when the time runs out (up to 7
          days, as respond.io allows).
        </p>
      </Note>
    </div>
  );
}

export function DelayFields({ delay, onChange }: { delay: DelayData; onChange: (delay: DelayData) => void }) {
  return (
    <div className="grid gap-3" data-testid="delay-fields">
      <div className="grid gap-1.5">
        <Label htmlFor="delay-amount">Wait</Label>
        <AmountUnit
          id="delay-amount"
          amount={delay.amount}
          unit={delay.unit}
          units={["seconds", "minutes", "hours", "days"]}
          onChange={(amount, unit) => onChange({ amount, unit })}
        />
      </div>
      <Note source={SIM_STEP_INFO.delay.source}>
        <p>Waits this long, then goes on to the next step. Anywhere in the flow, up to 7 days.</p>
      </Note>
    </div>
  );
}

export function SplitFields({ split, onChange }: { split: SplitData; onChange: (split: SplitData) => void }) {
  return (
    <div className="grid gap-3" data-testid="split-fields">
      <div className="grid gap-1.5">
        <Label htmlFor="split-a">Path A share (%)</Label>
        <Input
          id="split-a"
          type="number"
          min={1}
          max={99}
          value={split.percentA}
          onChange={(e) => onChange({ percentA: Number(e.target.value) })}
        />
        <p className="text-muted-foreground text-xs">Path B gets the rest: {100 - split.percentA}%.</p>
      </div>
      <Note source={SIM_STEP_INFO.split.source}>
        <p>Each contact goes down A or B at random, by these shares (an A/B test).</p>
      </Note>
    </div>
  );
}

export function HttpFields({ http, onChange }: { http: HttpData; onChange: (http: HttpData) => void }) {
  return (
    <div className="grid gap-3" data-testid="http-fields">
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="http-method">Method</Label>
          <NativeSelect
            id="http-method"
            value={http.method}
            onChange={(e) => onChange({ ...http, method: e.target.value as HttpData["method"] })}
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="http-url">Address</Label>
          <Input
            id="http-url"
            type="url"
            placeholder="https://"
            value={http.url}
            onChange={(e) => onChange({ ...http, url: e.target.value })}
          />
        </div>
      </div>
      {http.method !== "GET" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="http-body">Body</Label>
          <Textarea
            id="http-body"
            rows={3}
            className="font-mono text-xs"
            value={http.body}
            onChange={(e) => onChange({ ...http, body: e.target.value })}
          />
        </div>
      ) : null}
      <div className="grid gap-2 rounded-lg border border-dashed p-3">
        <p className="font-medium text-sm">Simulated answer</p>
        <div className="grid gap-1.5">
          <Label htmlFor="http-status">Status code</Label>
          <Input
            id="http-status"
            type="number"
            min={100}
            max={599}
            value={http.mockStatus}
            onChange={(e) => onChange({ ...http, mockStatus: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="http-mock">Body</Label>
          <Textarea
            id="http-mock"
            rows={2}
            className="font-mono text-xs"
            value={http.mockBody}
            onChange={(e) => onChange({ ...http, mockBody: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="http-save">Save the answer to the contact field (optional)</Label>
          <Input id="http-save" value={http.saveTo} onChange={(e) => onChange({ ...http, saveTo: e.target.value })} />
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          The preview never calls the address: the dry run uses this answer. 2xx takes <b>Success</b>, anything else{" "}
          <b>Failure</b>.
        </p>
      </div>
      <Note source={SIM_STEP_INFO.http.source}>
        <p>Like respond.io's HTTP request step: it sends a request and branches on the answer.</p>
      </Note>
    </div>
  );
}

export function GotoFields({ goto, onChange }: { goto: GotoData; onChange: (goto: GotoData) => void }) {
  const { flows, currentFlowId } = useSimOptions();
  const others = flows.filter((flow) => flow.id !== currentFlowId);
  return (
    <div className="grid gap-3" data-testid="goto-fields">
      <div className="grid gap-1.5">
        <Label htmlFor="goto-flow">Flow</Label>
        <NativeSelect
          id="goto-flow"
          className="w-full"
          value={goto.flowId}
          aria-invalid={!goto.flowId}
          onChange={(e) => onChange({ flowId: e.target.value })}
        >
          <option value="" disabled>
            {others.length ? "Select a saved flow" : "No other flow is saved yet"}
          </option>
          {others.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name || "Untitled flow"}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Note source={SIM_STEP_INFO.goto.source}>
        <p>This path ends here and the chosen flow continues from its first step, for the same conversation.</p>
      </Note>
    </div>
  );
}

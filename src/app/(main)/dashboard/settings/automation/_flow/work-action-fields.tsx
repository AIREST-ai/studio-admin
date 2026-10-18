"use client";
// F-11 (Fahad L6, item 91): the fields of the simulator actions "Create task in Twenty", "Create draft invoice" and
// "Notify a teammate", and the dry run's buttons that make that one task, draft or notification for real:
// the task in Twenty (Tasks page), the draft in Bigcapital (Invoices), the notification in the bell.
import * as React from "react";

import Link from "next/link";

import { BellRing, ExternalLink, ListTodo, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { loadFeed } from "../../../notifications/_components/notifications-store";
import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import type { Action } from "./catalog";
import { SOURCES, type Source } from "./sim-catalog";
import {
  DAYS_MAX,
  INVOICE_DUE_DEFAULT,
  invoiceFromSpec,
  invoiceSpecOf,
  invoiceValuesOf,
  MESSAGE_MAX,
  type NotifyTo,
  notifySpecOf,
  notifyValuesOf,
  taskFromSpec,
  taskSpecOf,
  taskValuesOf,
  type WorkKind,
} from "./work-actions";

// ------------------------------------------------------------------------------------------------- lists (read once)

type Loaded<T> = { ok: true; rows: T } | { ok: false; message: string };
const cache = new Map<string, Promise<Loaded<unknown>>>();

/** GETs a preview route once per page; a failure is not kept, so the next field tries again. */
function loadOnce<T>(url: string, pick: (json: Record<string, unknown>) => T): Promise<Loaded<T>> {
  let loading = cache.get(url) as Promise<Loaded<T>> | undefined;
  if (!loading) {
    loading = fetch(url, { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          cache.delete(url);
          return { ok: false as const, message: String(json.error ?? `HTTP ${response.status}`) };
        }
        return { ok: true as const, rows: pick(json) };
      })
      .catch((error: Error) => {
        cache.delete(url);
        return { ok: false as const, message: error.message };
      });
    cache.set(url, loading as Promise<Loaded<unknown>>);
  }
  return loading;
}

function useLoaded<T>(url: string, pick: (json: Record<string, unknown>) => T) {
  const [state, setState] = React.useState<Loaded<T> | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pick` is a fixed reader per url.
  React.useEffect(() => {
    let live = true;
    void loadOnce(url, pick).then((result) => live && setState(result));
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

type Member = { id: string; name: string };
type Customer = { id: number; name: string };

const useTwentyMembers = () =>
  useLoaded<Member[]>("/api/tasks-twenty", (json) =>
    ((json.members as Member[] | undefined) ?? []).map((m) => ({ id: m.id, name: m.name })),
  );
const useBigcapitalCustomers = () =>
  useLoaded<Customer[]>("/api/invoice-bigcapital/customers", (json) =>
    ((json.customers as Customer[] | undefined) ?? []).map((c) => ({ id: c.id, name: c.name })),
  );
const useBigcapitalItems = () =>
  useLoaded<string[]>("/api/invoice-bigcapital/items", (json) =>
    ((json.items as string[] | undefined) ?? []).filter((name) => name !== json.discountItem),
  );

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
      Standard: {source.label} <ExternalLink className="size-3" />
    </a>
  );
}

function LoadError({ what, loaded }: { what: string; loaded: Loaded<unknown> | null }) {
  if (!loaded || loaded.ok) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {what} could not be read: {loaded.message}
    </p>
  );
}

// ------------------------------------------------------------------------------------------------- fields

type FieldProps = { action: Action; onChange: (action: Action) => void; invalid: boolean };

export function TwentyTaskFields({ action, onChange, invalid }: FieldProps) {
  const members = useTwentyMembers();
  const spec = taskSpecOf(action.values);
  const set = (change: Partial<typeof spec>) => onChange({ ...action, values: taskValuesOf({ ...spec, ...change }) });
  const id = React.useId();
  // a new step: due the next day, nobody assigned yet
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the step is still empty.
  React.useEffect(() => {
    if (!action.values.length)
      onChange({
        ...action,
        values: taskValuesOf({ title: "", assigneeId: "", assigneeName: "", dueDays: 1, notes: "" }),
      });
  }, [action.values.length]);
  return (
    <div className="grid gap-2" data-work-action="task">
      <Input
        aria-label="Task title"
        dir="auto"
        placeholder="Task title, e.g. Call the customer back"
        maxLength={300}
        aria-invalid={invalid && !spec.title}
        value={spec.title}
        onChange={(e) => set({ title: e.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-who`} className="text-xs">
            Assignee
          </Label>
          <NativeSelect
            id={`${id}-who`}
            className="w-full"
            value={spec.assigneeId}
            onChange={(e) => {
              const member = members?.ok ? members.rows.find((m) => m.id === e.target.value) : undefined;
              set({ assigneeId: member?.id ?? "", assigneeName: member?.name ?? "" });
            }}
          >
            <option value="">{members === null ? "Loading members…" : "Not assigned"}</option>
            {members?.ok
              ? members.rows.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))
              : null}
            {spec.assigneeId && members?.ok && !members.rows.some((m) => m.id === spec.assigneeId) ? (
              <option value={spec.assigneeId}>{spec.assigneeName || "A member no longer on the tasks server"}</option>
            ) : null}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-due`} className="text-xs">
            Due in (days)
          </Label>
          <Input
            id={`${id}-due`}
            type="number"
            min={0}
            max={DAYS_MAX}
            placeholder="No date"
            value={Number.isNaN(spec.dueDays) ? "" : spec.dueDays}
            onChange={(e) => set({ dueDays: e.target.value === "" ? Number.NaN : Number.parseInt(e.target.value, 10) })}
          />
        </div>
      </div>
      <LoadError what="Members" loaded={members} />
      <Textarea
        aria-label="Task notes"
        dir="auto"
        rows={2}
        maxLength={2000}
        placeholder="Notes (optional)"
        value={spec.notes}
        onChange={(e) => set({ notes: e.target.value })}
      />
      <p className="text-muted-foreground text-xs">
        Saved on the tasks server of the Tasks page. Due in counts days from the trigger; empty = no due date. The dry
        run shows the task; its “Create task” button makes it.
      </p>
      <SourceLink source={SOURCES.taskStandard} />
    </div>
  );
}

export function InvoiceDraftFields({ action, onChange, invalid }: FieldProps) {
  const customers = useBigcapitalCustomers();
  const items = useBigcapitalItems();
  const spec = invoiceSpecOf(action.values);
  const set = (change: Partial<typeof spec>) =>
    onChange({ ...action, values: invoiceValuesOf({ ...spec, ...change }) });
  const id = React.useId();
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the step is still empty.
  React.useEffect(() => {
    if (!action.values.length)
      onChange({
        ...action,
        values: invoiceValuesOf({
          customerId: Number.NaN,
          customerName: "",
          item: "",
          quantity: 1,
          unitPrice: Number.NaN,
          dueDays: INVOICE_DUE_DEFAULT,
          reference: "",
        }),
      });
  }, [action.values.length]);
  return (
    <div className="grid gap-2" data-work-action="invoice">
      <NativeSelect
        className="w-full"
        aria-label="Customer"
        aria-invalid={invalid && !(spec.customerId > 0)}
        value={Number.isNaN(spec.customerId) ? "" : String(spec.customerId)}
        onChange={(e) => {
          const customer = customers?.ok ? customers.rows.find((c) => String(c.id) === e.target.value) : undefined;
          set({ customerId: customer?.id ?? Number.NaN, customerName: customer?.name ?? "" });
        }}
      >
        <option value="" disabled>
          {customers === null ? "Loading customers…" : "Choose the customer"}
        </option>
        {customers?.ok
          ? customers.rows.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))
          : null}
        {spec.customerId > 0 && customers?.ok && !customers.rows.some((c) => c.id === spec.customerId) ? (
          <option value={spec.customerId}>{spec.customerName || "A customer no longer on the invoices server"}</option>
        ) : null}
      </NativeSelect>
      <LoadError what="Customers" loaded={customers} />
      <NativeSelect
        className="w-full"
        aria-label="Item"
        aria-invalid={invalid && !spec.item}
        value={spec.item}
        onChange={(e) => set({ item: e.target.value })}
      >
        <option value="" disabled>
          {items === null ? "Loading items…" : "Choose the item"}
        </option>
        {items?.ok
          ? items.rows.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))
          : null}
        {spec.item && items?.ok && !items.rows.includes(spec.item) ? (
          <option value={spec.item}>{spec.item}</option>
        ) : null}
      </NativeSelect>
      <LoadError what="Items" loaded={items} />
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-qty`} className="text-xs">
            Quantity
          </Label>
          <Input
            id={`${id}-qty`}
            type="number"
            min={0}
            step="any"
            aria-invalid={invalid && !(spec.quantity > 0)}
            value={Number.isNaN(spec.quantity) ? "" : spec.quantity}
            onChange={(e) => set({ quantity: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-price`} className="text-xs">
            Unit price
          </Label>
          <Input
            id={`${id}-price`}
            type="number"
            min={0}
            step="any"
            aria-invalid={invalid && !(spec.unitPrice >= 0)}
            value={Number.isNaN(spec.unitPrice) ? "" : spec.unitPrice}
            onChange={(e) => set({ unitPrice: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-due`} className="text-xs">
            Due in (days)
          </Label>
          <Input
            id={`${id}-due`}
            type="number"
            min={0}
            max={DAYS_MAX}
            value={Number.isNaN(spec.dueDays) ? "" : spec.dueDays}
            onChange={(e) => set({ dueDays: Number.parseInt(e.target.value, 10) })}
          />
        </div>
      </div>
      <Input
        aria-label="Reference"
        dir="auto"
        maxLength={60}
        placeholder="Reference (optional), e.g. order number"
        value={spec.reference}
        onChange={(e) => set({ reference: e.target.value })}
      />
      <p className="text-muted-foreground text-xs">
        A draft on the invoices server of Invoices: dated the day of the trigger, not delivered and not emailed. The dry
        run shows it; its “Create draft” button makes it.
      </p>
      <SourceLink source={SOURCES.invoiceStandard} />
    </div>
  );
}

export function TeammateNotifyFields({ action, onChange, invalid }: FieldProps) {
  const names = useLivePickerNames();
  const spec = notifySpecOf(action.values);
  const set = (change: Partial<typeof spec>) => onChange({ ...action, values: notifyValuesOf({ ...spec, ...change }) });
  const options = spec.to === "team" ? names.teams : names.agents;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the step is still empty.
  React.useEffect(() => {
    if (!action.values.length) onChange({ ...action, values: notifyValuesOf({ to: "agent", name: "", message: "" }) });
  }, [action.values.length]);
  return (
    <div className="grid gap-2" data-work-action="notify">
      <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <NativeSelect
          className="w-full"
          aria-label="Notify"
          value={spec.to}
          onChange={(e) => set({ to: e.target.value as NotifyTo, name: "" })}
        >
          <option value="agent">An agent</option>
          <option value="team">A team</option>
        </NativeSelect>
        <NativeSelect
          className="w-full"
          aria-label={spec.to === "team" ? "Team" : "Agent"}
          aria-invalid={invalid && !spec.name}
          value={spec.name}
          onChange={(e) => set({ name: e.target.value })}
        >
          <option value="" disabled>
            {spec.to === "team" ? "Choose the team" : "Choose the agent"}
          </option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {spec.name && !options.includes(spec.name) ? <option value={spec.name}>{spec.name}</option> : null}
        </NativeSelect>
      </div>
      <Textarea
        aria-label="Notification"
        dir="auto"
        rows={2}
        maxLength={MESSAGE_MAX}
        aria-invalid={invalid && !spec.message}
        placeholder="The notification, e.g. A VIP customer is waiting"
        value={spec.message}
        onChange={(e) => set({ message: e.target.value })}
      />
      <p className="text-muted-foreground text-xs">
        Internal only: the customer never sees it. It shows in the bell and is kept in the activity log. The dry run
        shows it; its “Send to the bell” button sends it.
      </p>
      <SourceLink source={SOURCES.notifyStandard} />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- dry-run buttons

const BUTTON: Record<WorkKind, { label: string; icon: React.ElementType }> = {
  task: { label: "Create task", icon: ListTodo },
  invoice: { label: "Create draft", icon: ReceiptText },
  notify: { label: "Send to the bell", icon: BellRing },
};

/** The bell reads the activity log every 30 s (notifications-store.ts loadFeed); after a send it reads it again at
 *  once and twice more, since the log takes the event just after the answer (lib/audit/with-audit.ts `after`). */
function refreshBell() {
  for (const ms of [800, 2500, 6000]) window.setTimeout(() => void loadFeed(), ms);
}

async function makeReal(
  kind: WorkKind,
  values: string[],
  at: Date,
  flow: { id: string; name: string },
): Promise<{ done: string; href: string; link: string }> {
  const post = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
    return json;
  };
  if (kind === "task") {
    const json = await post("/api/tasks-twenty", { task: taskFromSpec(taskSpecOf(values), at, flow.name) });
    return { done: `Task created: “${json.task?.title ?? ""}”.`, href: "/dashboard/tasks", link: "Open Tasks" };
  }
  if (kind === "invoice") {
    const json = await post("/api/invoice-bigcapital/invoices", invoiceFromSpec(invoiceSpecOf(values), at));
    return {
      done: `Draft ${json.invoice?.number ?? ""} created on the invoices server.`,
      href: "/dashboard/invoice",
      link: "Open Invoices",
    };
  }
  const spec = notifySpecOf(values);
  await post("/api/automation-notify", { to: spec.to, name: spec.name, message: spec.message, flow });
  refreshBell();
  return { done: `Sent to the ${spec.to} ${spec.name}. It is in the bell.`, href: "", link: "" };
}

/** On the dry run's line: make this one task, draft or notification for real. */
export function MakeItReal({
  kind,
  values,
  at,
  flow,
}: {
  kind: WorkKind;
  values: string[];
  at: Date;
  flow: { id: string; name: string };
}) {
  const [state, setState] = React.useState<{
    busy: boolean;
    done?: { text: string; href: string; link: string };
    error?: string;
  }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      const result = await makeReal(kind, values, at, flow);
      setState({ busy: false, done: { text: result.done, href: result.href, link: result.link } });
    } catch (error) {
      setState({ busy: false, error: (error as Error).message });
    }
  };
  if (state.done)
    return (
      <span className="ps-5 text-emerald-700 dark:text-emerald-400" role="status" data-work-done={kind} dir="auto">
        {state.done.text}{" "}
        {state.done.href ? (
          <Link href={state.done.href} className="underline underline-offset-4">
            {state.done.link}
          </Link>
        ) : null}
      </span>
    );
  const look = BUTTON[kind];
  return (
    <span className="flex flex-wrap items-center gap-2 ps-5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={state.busy}
        data-work-button={kind}
        onClick={() => void run()}
      >
        <look.icon />
        {look.label}
      </Button>
      {state.error ? (
        <span role="alert" className="text-destructive">
          Not done: {state.error}
        </span>
      ) : null}
    </span>
  );
}

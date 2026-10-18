// F-11 (Fahad L6: «قد تكون هناك حاجة تعمل [التقويم والتاسكات والفواتير] تلقائيا للاحداث», item 91: automation must
// reach Tasks, Invoices and the notifications): three simulator actions beside "Create calendar event" (M129-G),
// as plain data (no React) so the simulator (sim-engine.ts) and its tests read them outside the browser.
//   Create task in Twenty      values [title, Twenty member id, member name, due in days ("" = no due date), notes]
//   Create draft invoice       values [Bigcapital customer id, customer name, item name, quantity, unit price,
//                                      due in days, reference]
//   Notify a teammate          values ["agent" | "team", name, message]
// A dry run only says what it would make. The button on that dry-run line makes it for real (work-action-fields.tsx):
// the task in Twenty (Tasks page), the draft in Bigcapital (Invoices), the notification in the bell (activity log).

export const TASK_ACTION = "create_twenty_task";
export const INVOICE_ACTION = "create_invoice_draft";
export const NOTIFY_ACTION = "notify_teammate";
export const WORK_ACTIONS = [TASK_ACTION, INVOICE_ACTION, NOTIFY_ACTION] as const;
export type WorkKind = "task" | "invoice" | "notify";

const KINDS: Record<string, WorkKind> = {
  [TASK_ACTION]: "task",
  [INVOICE_ACTION]: "invoice",
  [NOTIFY_ACTION]: "notify",
};
export const kindOfAction = (action: string): WorkKind | null => (Object.hasOwn(KINDS, action) ? KINDS[action] : null);

export const DAYS_MAX = 365;
const DAY_MS = 86_400_000;

const int = (value: string | undefined) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : Number.NaN;
};
const num = (value: string | undefined) => {
  const n = Number(value ?? "");
  return value?.trim() && Number.isFinite(n) ? n : Number.NaN;
};
const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dayText = (date: Date) =>
  date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
/** An Arabic name or title inside an English line keeps its own direction (FSI … PDI). */
export const iso = (text: string) => `⁨${text}⁩`;

// ------------------------------------------------------------------------------------------------- task (Twenty)

export interface TaskSpec {
  title: string;
  assigneeId: string;
  assigneeName: string;
  /** NaN when there is no due date. */
  dueDays: number;
  notes: string;
}

export function taskSpecOf(values: string[]): TaskSpec {
  return {
    title: (values[0] ?? "").trim(),
    assigneeId: values[1] ?? "",
    assigneeName: values[2] ?? "",
    dueDays: values[3] === "" || values[3] === undefined ? Number.NaN : int(values[3]),
    notes: values[4] ?? "",
  };
}

export const taskValuesOf = (spec: TaskSpec) => [
  spec.title,
  spec.assigneeId,
  spec.assigneeName,
  Number.isNaN(spec.dueDays) ? "" : String(spec.dueDays),
  spec.notes,
];

export function taskError(values: string[]): string {
  const spec = taskSpecOf(values);
  if (!spec.title) return "Enter the task title";
  if (spec.title.length > 300) return "The title must be 300 characters or fewer";
  const due = values[3] ?? "";
  if (due !== "" && (!Number.isInteger(spec.dueDays) || spec.dueDays < 0 || spec.dueDays > DAYS_MAX))
    return `Due in must be 0 to ${DAYS_MAX} days`;
  if (spec.notes.length > 2000) return "The notes must be 2000 characters or fewer";
  return "";
}

/** What POST /api/tasks-twenty receives when the action runs at `at` (Twenty's dueAt is a date and time). */
export function taskFromSpec(spec: TaskSpec, at: Date, flowName: string) {
  const source = `Created by the automation flow “${flowName || "Untitled flow"}” from its dry run.`;
  return {
    title: spec.title,
    assigneeId: spec.assigneeId || null,
    dueAt: Number.isNaN(spec.dueDays) ? null : new Date(at.getTime() + spec.dueDays * DAY_MS).toISOString(),
    body: spec.notes.trim() ? `${spec.notes.trim()}\n\n${source}` : source,
  };
}

export function taskLine(spec: TaskSpec, at: Date): string {
  const who = spec.assigneeName ? ` for ${iso(spec.assigneeName)}` : ", not assigned";
  const due = Number.isNaN(spec.dueDays)
    ? ", no due date"
    : `, due ${dayText(new Date(at.getTime() + spec.dueDays * DAY_MS))}`;
  return `Would create the task “${iso(spec.title)}” on the tasks server${who}${due}`;
}

// ------------------------------------------------------------------------------------------------- invoice (Bigcapital)

export interface InvoiceSpec {
  customerId: number;
  customerName: string;
  item: string;
  quantity: number;
  unitPrice: number;
  dueDays: number;
  reference: string;
}

/** Same as the Invoice page's own new invoice (invoice/_components/data.ts: due 14 days after it is issued). */
export const INVOICE_DUE_DEFAULT = 14;

export function invoiceSpecOf(values: string[]): InvoiceSpec {
  return {
    customerId: int(values[0]),
    customerName: values[1] ?? "",
    item: (values[2] ?? "").trim(),
    quantity: num(values[3]),
    unitPrice: num(values[4]),
    dueDays: int(values[5]),
    reference: (values[6] ?? "").trim(),
  };
}

export const invoiceValuesOf = (spec: InvoiceSpec) => [
  Number.isNaN(spec.customerId) ? "" : String(spec.customerId),
  spec.customerName,
  spec.item,
  Number.isNaN(spec.quantity) ? "" : String(spec.quantity),
  Number.isNaN(spec.unitPrice) ? "" : String(spec.unitPrice),
  Number.isNaN(spec.dueDays) ? "" : String(spec.dueDays),
  spec.reference,
];

export function invoiceError(values: string[]): string {
  const spec = invoiceSpecOf(values);
  if (!(spec.customerId > 0)) return "Choose the customer";
  if (!spec.item) return "Choose the item to invoice";
  if (!(spec.quantity > 0) || spec.quantity > 100_000) return "The quantity must be more than 0";
  if (!(spec.unitPrice >= 0) || spec.unitPrice > 100_000_000) return "Enter the unit price (0 or more)";
  if (!Number.isInteger(spec.dueDays) || spec.dueDays < 0 || spec.dueDays > DAYS_MAX)
    return `Due in must be 0 to ${DAYS_MAX} days`;
  if (spec.reference.length > 60) return "The reference must be 60 characters or fewer";
  return "";
}

/** What POST /api/invoice-bigcapital/invoices receives when the action runs at `at` (a draft: never delivered). */
export function invoiceFromSpec(spec: InvoiceSpec, at: Date) {
  const issued = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const due = new Date(issued.getFullYear(), issued.getMonth(), issued.getDate() + spec.dueDays);
  return {
    customerId: spec.customerId,
    referenceNumber: spec.reference,
    issuedDate: dayOf(issued),
    dueDate: dayOf(due),
    language: "en" as const,
    items: [{ description: spec.item, quantity: spec.quantity, unitPrice: spec.unitPrice }],
  };
}

export function invoiceLine(spec: InvoiceSpec, at: Date): string {
  const draft = invoiceFromSpec(spec, at);
  const due = new Date(`${draft.dueDate}T00:00:00`);
  return `Would create a draft invoice on the invoices server for “${iso(spec.customerName || `customer #${spec.customerId}`)}”: ${spec.quantity} × “${iso(spec.item)}” at ${spec.unitPrice}, due ${dayText(due)}${spec.reference ? `, reference ${iso(spec.reference)}` : ""}`;
}

// ------------------------------------------------------------------------------------------------- notification (bell)

export type NotifyTo = "agent" | "team";

export interface NotifySpec {
  to: NotifyTo;
  name: string;
  message: string;
}

export const MESSAGE_MAX = 500;

export function notifySpecOf(values: string[]): NotifySpec {
  return { to: values[0] === "team" ? "team" : "agent", name: values[1] ?? "", message: (values[2] ?? "").trim() };
}

export const notifyValuesOf = (spec: NotifySpec) => [spec.to, spec.name, spec.message];

export function notifyError(values: string[]): string {
  const spec = notifySpecOf(values);
  if (!spec.name) return spec.to === "team" ? "Choose the team" : "Choose the agent";
  if (!spec.message) return "Write the notification";
  if (spec.message.length > MESSAGE_MAX) return `The notification must be ${MESSAGE_MAX} characters or fewer`;
  return "";
}

export function notifyLine(spec: NotifySpec): string {
  return `Would notify the ${spec.to} ${iso(spec.name)} in the bell: “${iso(spec.message)}”`;
}

// ------------------------------------------------------------------------------------------------- shared

/** What is missing before one of the three can run ("" when nothing is, or for another action). */
export function workError(action: string, values: string[]): string {
  if (action === TASK_ACTION) return taskError(values);
  if (action === INVOICE_ACTION) return invoiceError(values);
  if (action === NOTIFY_ACTION) return notifyError(values);
  return "";
}

/** The canvas line of the step. */
export function workSummary(action: string, values: string[]): string {
  if (action === TASK_ACTION) {
    const spec = taskSpecOf(values);
    return `“${spec.title || "…"}”${spec.assigneeName ? ` · ${spec.assigneeName}` : ""}`;
  }
  if (action === INVOICE_ACTION) {
    const spec = invoiceSpecOf(values);
    return `${spec.customerName || "…"} · ${spec.item || "…"}`;
  }
  const spec = notifySpecOf(values);
  return `${spec.name || "…"}: ${spec.message || "…"}`;
}

// F-18a (Fahad 15 Oct 15:20: "I opened it and found it almost the same as before, nothing different to say it was
// really applied"): the whole sales side of the invoices server, read for the Invoices page, so the page shows the
// system itself (its lists with their statuses, its main sections and its real totals) and not only the old editor.
// Server-only (it imports ./server, which holds the API key). Sections and their API (Bigcapital v0.15.43 OpenAPI,
// https://github.com/bigcapitalhq/bigcapital/blob/v0.15.43/shared/sdk-ts/openapi.json):
//   invoices        GET /api/sale-invoices          statuses: SaleInvoice.meta.ts (draft, delivered, unpaid, overdue,
//                                                   partially-paid, paid)
//   estimates       GET /api/sale-estimates         statuses: SaleEstimate.meta.ts (draft, delivered, approved,
//                                                   rejected) + expired / converted to invoice (model attributes)
//   payments        GET /api/payments-received
//   receipts        GET /api/sale-receipts          closed or draft
//   credit notes    GET /api/credit-notes           draft, open, closed
//   customers       GET /api/customers              with each customer's receivable balance
//   items           GET /api/items                  products and services with their sell price
//   A/R aging       GET /api/reports/receivable-aging-summary (ARAgingSummary.controller.ts)
// Nothing here writes. The one action the page adds (mark a draft as delivered) uses ./server markDelivered.
import { estimateLinks } from "./sales";
import { BigcapitalError, baseCurrency, bc } from "./server";

type Row = Record<string, unknown>;

const num = (value: unknown) => {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const txt = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : fallback;
const pick = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};
const nested = (row: Row, key: string, inner: string) => {
  const value = row[key];
  return value && typeof value === "object" ? (value as Row)[inner] : undefined;
};
const day = (value: unknown) => txt(value).slice(0, 10);

/** The rows of a Bigcapital list answer: its `data`, or the first array it holds (sales_invoices, payment_receives…). */
function rowsOf(answer: unknown): Row[] {
  if (Array.isArray(answer)) return answer as Row[];
  if (!answer || typeof answer !== "object") return [];
  const body = answer as Row;
  if (Array.isArray(body.data)) return body.data as Row[];
  for (const value of Object.values(body)) if (Array.isArray(value)) return value as Row[];
  return [];
}

/** Every row of a list (pages of 200, at most 1,000 rows: a small business's sales list). */
async function allRows(path: string): Promise<Row[]> {
  const out: Row[] = [];
  const join = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= 5; page++) {
    const answer = await bc<unknown>(`${path}${join}page=${page}&page_size=200`);
    const rows = rowsOf(answer);
    out.push(...rows);
    const total = num((answer as { pagination?: { total?: unknown } } | null)?.pagination?.total);
    if (rows.length < 200 || (total && out.length >= total)) break;
  }
  return out;
}

export interface Money {
  amount: number;
  text: string;
}

function moneyFormatter(sign: string) {
  const format = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (amount: number): Money => ({
    amount,
    text: `${amount < 0 ? "-" : ""}${sign}${format.format(Math.abs(amount))}`,
  });
}

// ---- the sections ---------------------------------------------------------------------------------------------

export type InvoiceState = "draft" | "unpaid" | "overdue" | "partially-paid" | "paid";

export interface OverviewInvoice {
  id: number;
  number: string;
  reference: string;
  customer: string;
  date: string;
  dueDate: string;
  total: Money;
  paid: Money;
  due: Money;
  state: InvoiceState;
  overdueDays: number;
  deliveredAt: string;
}

export interface OverviewEstimate {
  id: number;
  number: string;
  reference: string;
  customer: string;
  date: string;
  expiresOn: string;
  total: Money;
  state: "draft" | "delivered" | "approved" | "rejected" | "expired" | "converted";
  /** F-21: the invoice this estimate was converted to (from the link this page keeps, see sales.ts estimateLinks). */
  convertedTo?: string;
}

export interface OverviewPayment {
  id: number;
  number: string;
  reference: string;
  customer: string;
  date: string;
  amount: Money;
  account: string;
}

export interface OverviewReceipt {
  id: number;
  number: string;
  reference: string;
  customer: string;
  date: string;
  total: Money;
  account: string;
  state: "draft" | "closed";
}

export interface OverviewCreditNote {
  id: number;
  number: string;
  reference: string;
  customer: string;
  date: string;
  total: Money;
  remaining: Money;
  state: "draft" | "open" | "closed";
}

export interface OverviewCustomer {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  balance: Money;
  currency: string;
  active: boolean;
}

export interface OverviewItem {
  id: number;
  name: string;
  code: string;
  type: string;
  sellPrice: Money;
  active: boolean;
}

export interface AgingRow {
  customer: string;
  current: Money;
  buckets: Money[];
  total: Money;
}

export interface InvoicesOverview {
  currency: { code: string; sign: string };
  summary: {
    outstanding: Money & { count: number };
    overdue: Money & { count: number };
    paidLast30: Money & { count: number };
    drafts: Money & { count: number };
    openEstimates: Money & { count: number };
    customers: number;
  };
  invoices: OverviewInvoice[];
  estimates: OverviewEstimate[];
  payments: OverviewPayment[];
  receipts: OverviewReceipt[];
  creditNotes: OverviewCreditNote[];
  customers: OverviewCustomer[];
  items: OverviewItem[];
  aging: { asOf: string; columns: string[]; rows: AgingRow[]; total: AgingRow | null } | null;
  /** Sections the server could not read (their error), so the page says so instead of showing an empty list. */
  errors: Record<string, string>;
  readAt: string;
}

function invoiceState(row: Row): InvoiceState {
  // F-21: the server's is_paid means partially OR fully paid (SaleInvoice.ts: isPaid = isPartiallyPaid || isFullyPaid),
  // so partially paid is checked first. Before, a partly paid invoice showed "Paid".
  if (row.is_partially_paid === true) return "partially-paid";
  if (row.is_paid === true) return "paid";
  if (row.is_delivered !== true) return "draft";
  if (row.is_overdue === true) return "overdue";
  return "unpaid";
}

function estimateState(row: Row): OverviewEstimate["state"] {
  if (row.is_converted_to_invoice === true || num(row.converted_to_invoice_id) > 0) return "converted";
  if (row.is_approved === true) return "approved";
  if (row.is_rejected === true) return "rejected";
  if (row.is_expired === true) return "expired";
  if (row.is_delivered === true) return "delivered";
  return "draft";
}

function customerName(row: Row) {
  return txt(nested(row, "customer", "display_name") ?? row.customer_name ?? row.display_name);
}

const settle = async <T>(name: string, errors: Record<string, string>, task: () => Promise<T>, empty: T) => {
  try {
    return await task();
  } catch (error) {
    errors[name] = (error as Error).message || "could not be read";
    return empty;
  }
};

export async function readInvoicesOverview(): Promise<InvoicesOverview> {
  const errors: Record<string, string> = {};
  const currency = (await settle("currency", errors, () => baseCurrency(), null)) ?? { code: "SAR", sign: "SR" };
  const money = moneyFormatter(currency.sign);
  const today = new Date().toISOString().slice(0, 10);

  const [invoiceRows, estimateRows, paymentRows, receiptRows, creditRows, customerRows, itemRows, agingAnswer] =
    await Promise.all([
      settle("invoices", errors, () => allRows("/sale-invoices?sort_order=desc&column_sort_by=invoice_date"), []),
      settle("estimates", errors, () => allRows("/sale-estimates?sort_order=desc&column_sort_by=estimate_date"), []),
      settle("payments", errors, () => allRows("/payments-received?sort_order=desc&column_sort_by=payment_date"), []),
      settle("receipts", errors, () => allRows("/sale-receipts?sort_order=desc&column_sort_by=receipt_date"), []),
      settle("creditNotes", errors, () => allRows("/credit-notes"), []),
      settle("customers", errors, () => allRows("/customers?inactive_mode=false"), []),
      settle("items", errors, () => allRows("/items?inactive_mode=false"), []),
      settle(
        "aging",
        errors,
        () => bc<unknown>(`/reports/receivable-aging-summary?as_date=${today}&aging_days_before=30&aging_periods=3`),
        null,
      ),
    ]);

  const invoices: OverviewInvoice[] = invoiceRows.map((row) => {
    const total = num(pick(row, "total", "total_local", "balance"));
    const due = num(pick(row, "due_amount"));
    const paid = num(pick(row, "payment_amount"));
    return {
      id: num(row.id),
      number: txt(row.invoice_no, `#${txt(row.id)}`),
      reference: txt(row.reference_no),
      customer: customerName(row),
      date: day(row.invoice_date),
      dueDate: day(row.due_date),
      total: { amount: total, text: txt(row.total_formatted) || money(total).text },
      paid: money(paid),
      due: money(due),
      state: invoiceState(row),
      overdueDays: num(row.overdue_days),
      deliveredAt: day(row.delivered_at),
    };
  });

  const estimates: OverviewEstimate[] = estimateRows.map((row) => {
    const total = num(pick(row, "total", "amount"));
    return {
      id: num(row.id),
      number: txt(row.estimate_number, `#${txt(row.id)}`),
      reference: txt(row.reference),
      customer: customerName(row),
      date: day(row.estimate_date),
      expiresOn: day(row.expiration_date),
      total: { amount: total, text: txt(row.total_formatted) || money(total).text },
      state: estimateState(row),
    };
  });

  const payments: OverviewPayment[] = paymentRows.map((row) => {
    const amount = num(pick(row, "amount", "total"));
    return {
      id: num(row.id),
      number: txt(pick(row, "payment_receive_no", "payment_number"), `#${txt(row.id)}`),
      reference: txt(row.reference_no),
      customer: customerName(row),
      date: day(row.payment_date),
      amount: { amount, text: money(amount).text },
      account: txt(nested(row, "deposit_account", "name")),
    };
  });

  const receipts: OverviewReceipt[] = receiptRows.map((row) => {
    const total = num(pick(row, "total", "amount"));
    return {
      id: num(row.id),
      number: txt(row.receipt_number, `#${txt(row.id)}`),
      reference: txt(row.reference_no),
      customer: customerName(row),
      date: day(row.receipt_date),
      // F-21: the server's total_formatted has no currency sign for receipts (SaleReceiptTransformer: money: false)
      total: money(total),
      account: txt(nested(row, "deposit_account", "name")),
      state: row.is_closed === true ? "closed" : "draft",
    };
  });

  const creditNotes: OverviewCreditNote[] = creditRows.map((row) => {
    const total = num(pick(row, "total", "amount"));
    const remaining = num(pick(row, "credits_remaining"));
    let state: OverviewCreditNote["state"] = "draft";
    if (row.is_closed === true) state = "closed";
    else if (row.is_open === true) state = "open";
    return {
      id: num(row.id),
      number: txt(row.credit_note_number, `#${txt(row.id)}`),
      reference: txt(row.reference_no),
      customer: customerName(row),
      date: day(row.credit_note_date),
      total: { amount: total, text: txt(row.total_formatted) || money(total).text },
      remaining: { amount: remaining, text: money(remaining).text },
      state,
    };
  });

  const customers: OverviewCustomer[] = customerRows.map((row) => {
    const balance = num(pick(row, "balance", "closing_balance"));
    return {
      id: num(row.id),
      name: txt(row.display_name, `#${txt(row.id)}`),
      company: txt(row.company_name),
      email: txt(row.email),
      phone: txt(pick(row, "work_phone", "personal_phone")),
      balance: { amount: balance, text: money(balance).text },
      currency: txt(row.currency_code, currency.code),
      active: row.active !== false,
    };
  });

  const items: OverviewItem[] = itemRows.map((row) => {
    const price = num(row.sell_price);
    return {
      id: num(row.id),
      name: txt(row.name, `#${txt(row.id)}`),
      code: txt(row.code),
      type: txt(pick(row, "type_formatted", "item_type_formatted", "type")),
      sellPrice: { amount: price, text: money(price).text },
      active: row.active !== false,
    };
  });

  // F-21: an estimate converted from this page shows "Converted to invoice" while that invoice exists (the server in
  // this version does not record the conversion itself, see sales.ts convertEstimate).
  if (!errors.invoices) {
    const links = await estimateLinks().catch(() => ({}) as Awaited<ReturnType<typeof estimateLinks>>);
    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice.number]));
    for (const estimate of estimates) {
      const link = links[String(estimate.id)];
      if (link && byId.has(link.invoiceId)) {
        estimate.state = "converted";
        estimate.convertedTo = byId.get(link.invoiceId);
      }
    }
  }

  let aging: InvoicesOverview["aging"] = null;
  if (agingAnswer && typeof agingAnswer === "object") {
    const body = agingAnswer as {
      columns?: Array<{ before_days?: number; to_days?: number | null }>;
      data?: { customers?: Row[]; total?: Row };
    };
    // Bigcapital's own buckets: "current" is not due yet, then days past the due date (ARAgingSummary.swagger.ts).
    const columns = (body.columns ?? []).map((c) => {
      const from = Math.max(c.before_days ?? 0, 1);
      return c.to_days ? `${from}–${c.to_days} days overdue` : `${from}+ days overdue`;
    });
    const amountOf = (value: unknown) => money(num((value as Row | undefined)?.amount));
    const toRow = (row: Row, name: string): AgingRow => ({
      customer: name,
      current: amountOf(row.current),
      buckets: (Array.isArray(row.aging) ? (row.aging as Row[]) : []).map((bucket) => amountOf(bucket.total)),
      total: amountOf(row.total),
    });
    aging = {
      asOf: today,
      columns,
      rows: (body.data?.customers ?? []).map((row) => toRow(row, txt(row.customer_name, "—"))),
      total: body.data?.total ? toRow(body.data.total, "Total") : null,
    };
  }

  const sum = (rows: Array<{ amount: number }>) => rows.reduce((acc, row) => acc + row.amount, 0);
  const open = invoices.filter((i) => i.state !== "draft" && i.state !== "paid");
  const overdue = invoices.filter((i) => i.state === "overdue");
  const drafts = invoices.filter((i) => i.state === "draft");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const recentPayments = payments.filter((p) => p.date >= since);
  const openEstimates = estimates.filter((e) => e.state === "draft" || e.state === "delivered");

  return {
    currency,
    summary: {
      outstanding: { ...money(sum(open.map((i) => i.due))), count: open.length },
      overdue: { ...money(sum(overdue.map((i) => i.due))), count: overdue.length },
      paidLast30: { ...money(sum(recentPayments.map((p) => p.amount))), count: recentPayments.length },
      drafts: { ...money(sum(drafts.map((i) => i.total))), count: drafts.length },
      openEstimates: { ...money(sum(openEstimates.map((e) => e.total))), count: openEstimates.length },
      customers: customers.length,
    },
    invoices,
    estimates,
    payments,
    receipts,
    creditNotes,
    customers,
    items,
    aging,
    errors,
    readAt: new Date().toISOString(),
  };
}

// ---- round 2: one invoice, opened and edited inside the page ------------------------------------------------------
// GET /api/sale-invoices/{id} (its lines, totals, dates, statement) and GET /api/sale-invoices/{id}/payments.
// PUT /api/sale-invoices/{id} (EditSaleInvoiceDto in the OpenAPI file). The invoices server's own rules decide
// (EditSaleInvoice.service.ts validate, v0.15.43 lines 102-155): a draft or a delivered invoice can be edited; the
// number must stay unique; the items must exist and be sellable; and the new total cannot be lower than what was
// already paid (validateInvoiceAmountBiggerPaymentAmount). Its refusal comes back as the error, word for word.

export interface InvoiceLine {
  itemId: number;
  item: string;
  description: string;
  quantity: number;
  rate: number;
  taxRateId: number | null;
  tax: string;
  total: Money;
}

export interface InvoiceDetail {
  id: number;
  number: string;
  reference: string;
  customerId: number;
  customer: string;
  date: string;
  dueDate: string;
  state: InvoiceState;
  delivered: boolean;
  statement: string;
  terms: string;
  lines: InvoiceLine[];
  subtotal: Money;
  tax: Money;
  total: Money;
  paid: Money;
  due: Money;
  payments: Array<{ id: number; date: string; amount: Money }>;
  currency: { code: string; sign: string };
}

async function rawInvoice(id: number): Promise<Row> {
  const answer = await bc<Row>(`/sale-invoices/${id}`);
  return answer.data && typeof answer.data === "object" && !Array.isArray(answer.data) ? (answer.data as Row) : answer;
}

export async function readInvoiceDetail(id: number): Promise<InvoiceDetail> {
  const [row, paymentRows, currency] = await Promise.all([
    rawInvoice(id),
    bc<unknown>(`/sale-invoices/${id}/payments`).catch(() => []),
    baseCurrency().catch(() => null),
  ]);
  const cur = currency ?? { code: "SAR", sign: "SR" };
  const money = moneyFormatter(cur.sign);
  const entries = Array.isArray(row.entries) ? (row.entries as Row[]) : [];
  const lines: InvoiceLine[] = [...entries]
    .sort((a, b) => num(a.index) - num(b.index))
    .map((entry) => {
      const quantity = num(entry.quantity);
      const rate = num(entry.rate);
      const taxRate = entry.tax_rate && typeof entry.tax_rate === "object" ? (entry.tax_rate as Row) : null;
      return {
        itemId: num(entry.item_id),
        item: txt(nested(entry, "item", "name")),
        description: txt(entry.description),
        quantity,
        rate,
        taxRateId: num(entry.tax_rate_id) || null,
        tax: taxRate
          ? `${txt(taxRate.name)} ${num(taxRate.rate)}%`.trim()
          : num(entry.tax_rate)
            ? `${num(entry.tax_rate)}%`
            : "",
        total: money(num(pick(entry, "total", "amount")) || quantity * rate),
      };
    });
  const total = num(pick(row, "total", "balance"));
  const subtotal = num(pick(row, "subtotal_exluding_tax", "subtotal"));
  const paid = num(row.payment_amount);
  return {
    id,
    number: txt(row.invoice_no, `#${id}`),
    reference: txt(row.reference_no),
    customerId: num(row.customer_id),
    customer: customerName(row),
    date: day(row.invoice_date),
    dueDate: day(row.due_date),
    state: invoiceState(row),
    delivered: row.is_delivered === true,
    statement: txt(row.invoice_message),
    terms: txt(row.terms_conditions),
    lines,
    subtotal: money(subtotal),
    tax: money(num(row.tax_amount_withheld) || Math.max(total - subtotal, 0)),
    total: money(total),
    paid: money(paid),
    due: money(num(row.due_amount)),
    payments: rowsOf(paymentRows).map((p) => ({
      id: num(pick(p, "payment_receive_id", "id")),
      date: day(pick(p, "date", "payment_date")),
      amount: money(num(pick(p, "payment_amount", "amount"))),
    })),
    currency: cur,
  };
}

export interface InvoiceEdit {
  invoiceDate: string;
  dueDate: string;
  reference: string;
  statement: string;
  lines: Array<{ itemId: number; description: string; quantity: number; rate: number; taxRateId: number | null }>;
}

/** Saves the edit with PUT /sale-invoices/{id}; what is not on the page's form is sent back as it was. */
export async function editInvoice(id: number, edit: InvoiceEdit): Promise<InvoiceDetail> {
  const row = await rawInvoice(id);
  const oldReference = txt(row.reference_no);
  const oldStatement = txt(row.invoice_message);
  // The PDF prints the reference through the statement (round 1, monitor's decision): when the statement is still
  // that one line, it follows the new reference.
  let statement = edit.statement.trim();
  if (statement === oldStatement && (!oldStatement || oldStatement === `Reference: ${oldReference}`))
    statement = edit.reference ? `Reference: ${edit.reference}` : "";
  await bc(`/sale-invoices/${id}`, {
    method: "PUT",
    body: {
      customerId: num(row.customer_id),
      invoiceDate: edit.invoiceDate,
      dueDate: edit.dueDate,
      invoiceNo: txt(row.invoice_no) || undefined,
      referenceNo: edit.reference || undefined,
      delivered: row.is_delivered === true,
      invoiceMessage: statement || undefined,
      termsConditions: txt(row.terms_conditions) || undefined,
      isInclusiveTax: row.is_inclusive_tax === true,
      pdfTemplateId: num(row.pdf_template_id) || undefined,
      ...(num(row.discount) ? { discount: num(row.discount), discountType: txt(row.discount_type, "amount") } : {}),
      ...(num(row.adjustment) ? { adjustment: num(row.adjustment) } : {}),
      attachments: [],
      entries: edit.lines.map((line, index) => ({
        index: index + 1,
        itemId: line.itemId,
        quantity: line.quantity,
        rate: line.rate,
        ...(line.taxRateId ? { taxRateId: line.taxRateId } : {}),
        ...(line.description ? { description: line.description.slice(0, 500) } : {}),
      })),
    },
  });
  return readInvoiceDetail(id);
}

export { BigcapitalError };

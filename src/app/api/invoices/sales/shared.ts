import { NextResponse } from "next/server";

import type { AuditChange, AuditContext } from "@/lib/audit/with-audit";
import type {
  CreditNoteInput,
  CustomerFields,
  DocLine,
  EstimateInput,
  ItemFields,
  PaymentInput,
  ReceiptInput,
} from "@/lib/bigcapital/sales";
import { BigcapitalError } from "@/lib/bigcapital/server";
import { ownNames } from "@/lib/own-names";

// F-21: what the /api/invoices/sales routes share: the kinds of records, reading and checking each form's body, the
// answers, and the audit describers (every write is logged with withAudit, lib/audit/with-audit.ts).

export const headers = { "Cache-Control": "no-store" };
export const fail = (status: number, error: string) =>
  NextResponse.json({ error: ownNames(error) }, { status, headers });
export const failFrom = (error: unknown) =>
  error instanceof BigcapitalError ? fail(error.status, error.message) : fail(500, (error as Error).message || "error");

export const KINDS = ["payments", "estimates", "receipts", "credit-notes", "customers", "items"] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (value: string): value is Kind => (KINDS as readonly string[]).includes(value);

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number.NaN);
const id = (value: unknown) => {
  const n = finite(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function lines(raw: unknown): DocLine[] | string {
  if (!Array.isArray(raw) || !raw.length) return "Add at least one line";
  if (raw.length > 100) return "Too many lines";
  const out: DocLine[] = [];
  for (const line of raw as Array<Record<string, unknown>>) {
    const itemId = id(line.itemId);
    const quantity = finite(line.quantity);
    const rate = finite(line.rate);
    if (!itemId) return "Choose a product or service on every line";
    if (!(quantity > 0)) return "Every line needs a quantity above 0";
    if (!(rate >= 0)) return "Every line needs a price of 0 or more";
    out.push({
      itemId,
      quantity,
      rate,
      description: str(line.description, 500),
      taxRateId: id(line.taxRateId) || null,
    });
  }
  return out;
}

export function readPayment(b: Record<string, unknown>): PaymentInput | string {
  const invoiceId = id(b.invoiceId);
  const amount = finite(b.amount);
  const date = str(b.date, 10);
  const depositAccountId = id(b.depositAccountId);
  if (!invoiceId) return "Choose the invoice";
  if (!(amount > 0)) return "The amount must be more than 0";
  if (!DATE.test(date)) return "The payment date is required";
  if (!depositAccountId) return "Choose the account the money went to";
  return { invoiceId, amount: Math.round(amount * 100) / 100, date, depositAccountId, reference: str(b.reference, 60) };
}

export function readEstimate(b: Record<string, unknown>): EstimateInput | string {
  const customerId = id(b.customerId);
  const estimateDate = str(b.estimateDate, 10);
  const expirationDate = str(b.expirationDate, 10);
  if (!customerId) return "Choose the customer";
  if (!DATE.test(estimateDate) || !DATE.test(expirationDate)) return "Estimate date and expiry date are required";
  const parsed = lines(b.lines);
  if (typeof parsed === "string") return parsed;
  return {
    customerId,
    estimateDate,
    expirationDate,
    reference: str(b.reference, 60),
    note: str(b.note, 1000),
    deliver: b.deliver === true,
    lines: parsed,
  };
}

export function readReceipt(b: Record<string, unknown>): ReceiptInput | string {
  const customerId = id(b.customerId);
  const depositAccountId = id(b.depositAccountId);
  const receiptDate = str(b.receiptDate, 10);
  if (!customerId) return "Choose the customer";
  if (!depositAccountId) return "Choose the account the money went to";
  if (!DATE.test(receiptDate)) return "The receipt date is required";
  const parsed = lines(b.lines);
  if (typeof parsed === "string") return parsed;
  return {
    customerId,
    depositAccountId,
    receiptDate,
    reference: str(b.reference, 60),
    message: str(b.message, 1000),
    close: b.close === true,
    lines: parsed,
  };
}

export function readCreditNote(b: Record<string, unknown>): CreditNoteInput | string {
  const customerId = id(b.customerId);
  const creditNoteDate = str(b.creditNoteDate, 10);
  if (!customerId) return "Choose the customer";
  if (!DATE.test(creditNoteDate)) return "The credit note date is required";
  const parsed = lines(b.lines);
  if (typeof parsed === "string") return parsed;
  return {
    customerId,
    creditNoteDate,
    reference: str(b.reference, 60),
    note: str(b.note, 1000),
    open: b.open === true,
    lines: parsed,
  };
}

export function readCustomerFields(b: Record<string, unknown>): CustomerFields | string {
  const fields: CustomerFields = {
    name: str(b.name, 120),
    company: str(b.company, 120),
    email: str(b.email, 160),
    phone: str(b.phone, 40),
    country: str(b.country, 80),
    city: str(b.city, 80),
    address: str(b.address, 200),
  };
  if (!fields.name) return "The customer's name is required";
  if (fields.email && !EMAIL.test(fields.email)) return "The email is not valid";
  return fields;
}

export function readItemFields(b: Record<string, unknown>): ItemFields | string {
  const name = str(b.name, 190);
  const sellPrice = finite(b.sellPrice);
  const sellAccountId = id(b.sellAccountId);
  if (!name) return "The name is required";
  if (!(sellPrice >= 0)) return "The sell price must be 0 or more";
  if (!sellAccountId) return "Choose the income account sales go to";
  return {
    name,
    type: b.type === "non-inventory" ? "non-inventory" : "service",
    code: str(b.code, 60),
    sellPrice: Math.round(sellPrice * 100) / 100,
    sellAccountId,
    sellTaxRateId: id(b.sellTaxRateId) || null,
    description: str(b.description, 500),
  };
}

// ---- audit: one sentence per write, with what it was before and after ------------------------------------------

type Rec = { id?: number; number?: string; name?: string; customer?: string; total?: string; state?: string };
const isObj = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const recOf = (answer: unknown, key: string): Rec | null => {
  if (!isObj(answer)) return null;
  const value = answer[key];
  return isObj(value) ? (value as Rec) : null;
};

const NOUN: Record<Kind, { action: string; key: string; word: string }> = {
  payments: { action: "invoice_payment", key: "payment", word: "payment" },
  estimates: { action: "invoice_estimate", key: "estimate", word: "estimate" },
  receipts: { action: "invoice_receipt", key: "receipt", word: "sales receipt" },
  "credit-notes": { action: "invoice_credit_note", key: "creditNote", word: "credit note" },
  customers: { action: "invoice_customer", key: "customer", word: "customer" },
  items: { action: "invoice_item", key: "item", word: "product or service" },
};

const label = (rec: Rec | null, fallback: string) => rec?.number ?? rec?.name ?? fallback;

/** POST /api/invoices/sales/{kind} (create). */
export function describeCreate(context: AuditContext<unknown>): AuditChange[] {
  const kind = context.params.kind;
  if (!isKind(kind)) return [];
  const noun = NOUN[kind];
  const rec = recOf(context.response, noun.key);
  const body = isObj(context.json) ? context.json : {};
  if (context.status >= 400)
    return [
      {
        action: `${noun.action}.create`,
        crud: "c",
        summary:
          kind === "payments"
            ? `tried to record a payment of ${String(body.amount ?? "")} on invoice #${String(body.invoiceId ?? "")}`
            : `tried to create a ${noun.word}`,
        target: { id: "new", name: noun.word, type: noun.key },
        after: body,
      },
    ];
  if (kind === "payments") {
    const invoice = isObj(context.response) && isObj(context.response.invoice) ? context.response.invoice : null;
    const before = isObj(context.response) && isObj(context.response.before) ? context.response.before : null;
    const number = String(invoice?.number ?? before?.number ?? `#${String(body.invoiceId ?? "")}`);
    return [
      {
        action: "invoice_payment.create",
        crud: "c",
        summary: `recorded a payment${rec?.number ? ` ${rec.number}` : ""} of ${rec?.total ?? String(body.amount ?? "")} on the invoice ${number}`,
        target: { id: String(rec?.id ?? body.invoiceId ?? ""), name: rec?.number ?? number, type: "payment" },
        before: before ? { invoice: number, status: before.status, due: before.due, paid: before.paid } : undefined,
        after: invoice
          ? { invoice: number, status: invoice.status, due: invoice.due, paid: invoice.paid, payment: rec ?? undefined }
          : { request: body },
      },
    ];
  }
  const name = label(rec, String(body.name ?? `new ${noun.word}`));
  return [
    {
      action: `${noun.action}.create`,
      crud: "c",
      summary: `created the ${noun.word} ${name}${rec?.customer ? ` for ${rec.customer}` : ""}${rec?.total ? ` (${rec.total})` : ""}`,
      target: { id: String(rec?.id ?? "new"), name, type: noun.key },
      after: rec ?? { request: body },
    },
  ];
}

/** PUT, DELETE and POST {action} on /api/invoices/sales/{kind}/{id}. */
export function describeRecord(context: AuditContext<unknown>): AuditChange[] {
  const kind = context.params.kind;
  if (!isKind(kind)) return [];
  const noun = NOUN[kind];
  const recId = context.params.id ?? "";
  const answer = isObj(context.response) ? context.response : {};
  const rec = recOf(answer, noun.key);
  const name = label(rec, `#${recId}`);
  if (context.status >= 400) {
    const verb =
      context.method === "DELETE"
        ? "delete"
        : context.method === "PUT"
          ? "edit"
          : String(isObj(context.json) ? (context.json.action ?? "change") : "change");
    return [
      {
        action: `${noun.action}.${context.method === "DELETE" ? "delete" : context.method === "PUT" ? "update" : verb === "convert" ? "convert_to_invoice" : verb}`,
        crud: context.method === "DELETE" ? "d" : "u",
        summary: `tried to ${verb === "convert" ? "convert to an invoice" : verb} the ${noun.word} #${recId}`,
        target: { id: recId, name: `#${recId}`, type: noun.key },
        after: isObj(context.json) ? context.json : undefined,
      },
    ];
  }
  if (context.method === "DELETE") {
    return [
      {
        action: `${noun.action}.delete`,
        crud: "d",
        summary: `deleted the ${noun.word} ${name}`,
        target: { id: recId, name, type: noun.key },
        before: rec ?? undefined,
      },
    ];
  }
  if (context.method === "PUT") {
    const before = recOf(answer, "before");
    return [
      {
        action: `${noun.action}.update`,
        crud: "u",
        summary: `edited the ${noun.word} ${name}`,
        target: { id: recId, name, type: noun.key },
        before: before ?? undefined,
        after: rec ?? (isObj(context.json) ? context.json : undefined),
      },
    ];
  }
  const action = isObj(context.json) ? String(context.json.action ?? "") : "";
  if (kind === "estimates" && action === "deliver")
    return [
      {
        action: "invoice_estimate.deliver",
        crud: "u",
        summary: `marked the estimate ${name} as delivered`,
        target: { id: recId, name, type: "estimate" },
        before: { status: "draft" },
        after: { status: rec?.state ?? "delivered" },
      },
    ];
  if (kind === "estimates" && action === "convert") {
    const invoice = isObj(answer.invoice) ? answer.invoice : null;
    const from = recOf(answer, "from");
    return [
      {
        action: "invoice_estimate.convert_to_invoice",
        crud: "c",
        summary: `converted the estimate ${name} to the invoice ${String(invoice?.number ?? "")}`.trim(),
        target: { id: recId, name, type: "estimate" },
        before: from ? { status: from.state } : undefined,
        after: {
          status: rec?.state,
          invoice: invoice ? { number: invoice.number, status: invoice.status } : undefined,
        },
      },
    ];
  }
  return [];
}

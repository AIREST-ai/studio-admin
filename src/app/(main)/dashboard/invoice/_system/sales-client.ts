// F-21: the browser side of /api/invoices/sales (the Invoices page's writes to the invoices server). Every failure
// throws with the server's reason, so the page shows it instead of pretending something was saved.
import type {
  CustomerDetail,
  CustomerFields,
  DocLine,
  ItemDetail,
  ItemFields,
  SalesOptions,
  WrittenRecord,
} from "@/lib/bigcapital/sales";

export type { CustomerDetail, CustomerFields, DocLine, ItemDetail, ItemFields, SalesOptions, WrittenRecord };

export type SalesKind = "payments" | "estimates" | "receipts" | "credit-notes" | "customers" | "items";

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/invoices/sales/${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? `The invoices server did not answer (${response.status})`);
  return body;
}

let optionsCache: Promise<SalesOptions> | null = null;
/** Deposit and income accounts, tax rates and today's date (read once per page view; a failure is not kept). */
export function fetchSalesOptions(): Promise<SalesOptions> {
  optionsCache ??= call<{ options: SalesOptions }>("options")
    .then((r) => r.options)
    .catch((error: unknown) => {
      optionsCache = null;
      throw error;
    });
  return optionsCache;
}

export interface PaymentResult {
  payment: (WrittenRecord & { invoices: string[] }) | null;
  invoice: { number: string; status: string; due: string; paid: string };
}

export const recordPayment = (body: {
  invoiceId: number;
  amount: number;
  date: string;
  depositAccountId: number;
  reference: string;
}) => call<PaymentResult>("payments", { method: "POST", body });

export const createEstimate = (body: {
  customerId: number;
  estimateDate: string;
  expirationDate: string;
  reference: string;
  note: string;
  deliver: boolean;
  lines: DocLine[];
}) => call<{ estimate: WrittenRecord }>("estimates", { method: "POST", body });

export const deliverEstimate = (id: number) =>
  call<{ estimate: WrittenRecord }>(`estimates/${id}`, { method: "POST", body: { action: "deliver" } });

export const convertEstimate = (id: number) =>
  call<{ estimate: WrittenRecord; invoice: { id: number; number: string; status: string } }>(`estimates/${id}`, {
    method: "POST",
    body: { action: "convert" },
  });

export const createReceipt = (body: {
  customerId: number;
  depositAccountId: number;
  receiptDate: string;
  reference: string;
  message: string;
  close: boolean;
  lines: DocLine[];
}) => call<{ receipt: WrittenRecord }>("receipts", { method: "POST", body });

export const createCreditNote = (body: {
  customerId: number;
  creditNoteDate: string;
  reference: string;
  note: string;
  open: boolean;
  lines: DocLine[];
}) => call<{ creditNote: WrittenRecord }>("credit-notes", { method: "POST", body });

export const readCustomer = (id: number) =>
  call<{ customer: CustomerDetail }>(`customers/${id}`).then((r) => r.customer);
export const createCustomer = (body: CustomerFields) =>
  call<{ customer: CustomerDetail }>("customers", { method: "POST", body });
export const editCustomer = (id: number, body: CustomerFields) =>
  call<{ customer: CustomerDetail }>(`customers/${id}`, { method: "PUT", body });

export const readItem = (id: number) => call<{ item: ItemDetail }>(`items/${id}`).then((r) => r.item);
export const createItem = (body: ItemFields) => call<{ item: ItemDetail }>("items", { method: "POST", body });
export const editItem = (id: number, body: ItemFields) =>
  call<{ item: ItemDetail }>(`items/${id}`, { method: "PUT", body });

/** DELETE /api/invoices/sales/{kind}/{id}; the server's refusal (a used customer, a converted estimate…) is thrown. */
export const deleteRecord = (kind: SalesKind, id: number) => call<unknown>(`${kind}/${id}`, { method: "DELETE" });

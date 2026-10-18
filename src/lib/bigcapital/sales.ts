// F-21 (Fahad 15 Oct: "I mean the whole system … I want a system of my own"; 129.4 "a complete invoicing system"): the
// writes of the invoices server's sales side, made from inside the Invoices page. Everything goes through the server's
// own API, so its rules, statuses and numbering decide (Bigcapital v0.15.43, the OpenAPI file and the module code):
//   record a payment     POST   /api/payments-received   (PaymentReceived.dto.ts; CreatePaymentReceived.serivce.ts
//                                                          validate: the invoice must be delivered, the amount cannot be
//                                                          more than its balance due, the deposit account must be cash,
//                                                          bank or other current asset; the number is its own sequence)
//   delete a payment     DELETE /api/payments-received/{id}
//   estimates            POST   /api/sale-estimates, POST /{id}/deliver, DELETE /{id} (refused once converted)
//   convert to invoice   POST   /api/sale-invoices with fromEstimateId (CreateSaleInvoice.service.ts:69-78 refuses an
//                                                          estimate already converted); the server's own web app seeds the
//                                                          invoice with the estimate's customer and lines and today's dates
//                                                          (webapp InvoiceForm/utils.tsx:103-104, InvoiceForm.tsx:126)
//   sales receipts       POST / DELETE /api/sale-receipts
//   credit notes         POST / DELETE /api/credit-notes  (refused with refunds or applied invoices)
//   customers            POST / PUT / DELETE /api/customers (refused with transactions: deleteIfNoRelations
//                                                          CUSTOMER_HAS_TRANSACTIONS, DeleteCustomer.service.ts:51-56)
//   products & services  POST / PUT / DELETE /api/items     (refused when used: ITEM_HAS_ASSOCIATED_TRANSACTINS,
//                                                          DeleteItem.service.ts:53-55)
// Server-only (it imports ./server, which holds the API key). The routes in app/api/invoices/sales log every write.

import { BigcapitalError, baseCurrency, bc, getInvoice, listTaxRates } from "./server";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, unknown>;

const num = (value: unknown) => {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const txt = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : fallback;

/** One record from an answer that may be the row itself or { data | customer | item | … : row }. */
function unwrap(answer: unknown, ...keys: string[]): Row {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return {};
  const body = answer as Row;
  for (const key of ["data", ...keys]) {
    const value = body[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  }
  return body;
}

/** Today on this machine, as YYYY-MM-DD (the server's own web app starts its forms on today's date). */
export function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---- the server's refusals, in words ----------------------------------------------------------------------------
// The error types are the server's own (ServiceError types in each module's constants.ts, and the relation checks of
// deleteIfNoRelations). The type stays at the end in brackets, so the reason can be traced.

const REFUSALS: Record<string, string> = {
  INVALID_PAYMENT_AMOUNT: "Refused: the payment is more than the invoice's balance due.",
  INVOICES_NOT_DELIVERED_YET: "Refused: the invoice is still a draft. Deliver it before recording a payment.",
  DEPOSIT_ACCOUNT_INVALID_TYPE: "Refused: money can only be deposited to a cash, bank or other current asset account.",
  DEPOSIT_ACCOUNT_NOT_CURRENT_ASSET: "Refused: money can only be deposited to a current asset account.",
  DEPOSIT_ACCOUNT_NOT_FOUND: "Refused: the deposit account was not found.",
  PAYMENT_ACCOUNT_CURRENCY_INVALID: "Refused: the deposit account's currency does not match the customer's.",
  PAYMENT_RECEIVE_NO_EXISTS: "Refused: a payment with this number already exists.",
  SALE_ESTIMATE_CONVERTED_TO_INVOICE:
    "Refused: this estimate was already converted to an invoice. Delete that invoice first to change or delete it.",
  SALE_ESTIMATE_ALREADY_DELIVERED: "Refused: this estimate is already delivered.",
  SALE_ESTIMATE_EXPIRATION_DATE_INVALID: "Refused: the expiry date cannot be before the estimate date.",
  SALE_ESTIMATE_NUMBER_EXISTANCE: "Refused: an estimate with this number already exists.",
  SALE_RECEIPT_NUMBER_NOT_UNIQUE: "Refused: a receipt with this number already exists.",
  CREDIT_NOTE_HAS_REFUNDS_TRANSACTIONS: "Refused: this credit note has refunds. Delete the refunds first.",
  CREDIT_NOTE_HAS_APPLIED_INVOICES: "Refused: this credit note is applied to invoices. Remove those first.",
  CUSTOMER_HAS_TRANSACTIONS:
    "Refused: this customer has transactions (invoices, estimates, receipts, payments or credit notes), so the invoices server keeps it.",
  ITEM_HAS_ASSOCIATED_TRANSACTINS:
    "Refused: this product or service is used on invoices, estimates, receipts or credit notes, so the invoices server keeps it.",
  ITEM_HAS_ASSOCIATED_TRANSACTIONS:
    "Refused: this product or service is used on invoices, estimates, receipts or credit notes, so the invoices server keeps it.",
  ITEM_NAME_EXISTS: "Refused: a product or service with this name already exists.",
  SELL_ACCOUNT_NOT_INCOME: "Refused: the sales account must be an income account.",
  INCOME_ACCOUNT_REQUIRED_WITH_SELLABLE_ITEM: "Refused: a product or service you sell needs an income account.",
  TYPE_CANNOT_CHANGE_WITH_ITEM_HAS_TRANSACTIONS: "Refused: the type cannot change while the item has transactions.",
  SELL_TAX_RATE_NOT_FOUND: "Refused: the tax rate was not found.",
  TRANSACTIONS_DATE_LOCKED: "Refused: sales transactions are locked for this date on the invoices server.",
};

/** The server's refusal in words (status kept), or the error as it came. */
function worded(error: unknown): unknown {
  if (!(error instanceof BigcapitalError)) return error;
  for (const [type, text] of Object.entries(REFUSALS))
    if (error.message.includes(type))
      return new BigcapitalError(`${text} (${type})`, error.status === 502 ? 409 : error.status);
  return error;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  try {
    return await bc<T>(path, init);
  } catch (error) {
    throw worded(error);
  }
}

// ---- what the forms pick from -----------------------------------------------------------------------------------

export interface SalesAccount {
  id: number;
  name: string;
  type: string;
}

export interface SalesOptions {
  depositAccounts: SalesAccount[];
  incomeAccounts: SalesAccount[];
  taxRates: Array<{ id: number; name: string; rate: number }>;
  currency: { code: string; sign: string };
  today: string;
}

// The deposit account types the server accepts (PaymentReceivedValidators.service.ts:279-285).
const DEPOSIT_TYPES = new Set(["cash", "bank", "other-current-asset"]);
const INCOME_TYPES = new Set(["income", "other-income"]);

export async function readSalesOptions(): Promise<SalesOptions> {
  const [answer, taxRates, currency] = await Promise.all([
    call<{ accounts?: Row[] } | Row[]>("/accounts"),
    listTaxRates(),
    baseCurrency().catch(() => null),
  ]);
  const accounts = (Array.isArray(answer) ? answer : (answer.accounts ?? [])).filter((a) => a.active !== false);
  const shape = (a: Row): SalesAccount => ({ id: num(a.id), name: txt(a.name), type: txt(a.account_type) });
  return {
    depositAccounts: accounts.filter((a) => DEPOSIT_TYPES.has(txt(a.account_type))).map(shape),
    incomeAccounts: accounts.filter((a) => INCOME_TYPES.has(txt(a.account_type))).map(shape),
    taxRates: taxRates.map((t) => ({ id: t.id, name: t.name, rate: t.rate })),
    currency: currency ?? { code: "SAR", sign: "SR" },
    today: today(),
  };
}

// ---- lines shared by estimates, receipts and credit notes --------------------------------------------------------

export interface DocLine {
  itemId: number;
  description: string;
  quantity: number;
  rate: number;
  taxRateId: number | null;
}

const entriesOf = (lines: DocLine[]) =>
  lines.map((line, index) => ({
    index: index + 1,
    itemId: line.itemId,
    quantity: line.quantity,
    rate: line.rate,
    ...(line.taxRateId ? { taxRateId: line.taxRateId } : {}),
    ...(line.description ? { description: line.description.slice(0, 500) } : {}),
  }));

const linesOfRow = (row: Row): DocLine[] =>
  (Array.isArray(row.entries) ? (row.entries as Row[]) : [])
    .sort((a, b) => num(a.index) - num(b.index))
    .map((entry) => ({
      itemId: num(entry.item_id),
      description: txt(entry.description),
      quantity: num(entry.quantity),
      rate: num(entry.rate),
      taxRateId: num(entry.tax_rate_id) || null,
    }));

/** A short record of what was written, for the page's notice and the audit log. */
export interface WrittenRecord {
  id: number;
  number: string;
  customer: string;
  total: string;
  state?: string;
}

const customerOf = (row: Row) => {
  const customer = row.customer;
  return txt(
    customer && typeof customer === "object" ? (customer as Row).display_name : undefined,
    txt(row.customer_name),
  );
};

// ---- payments received ------------------------------------------------------------------------------------------

export interface PaymentInput {
  invoiceId: number;
  amount: number;
  date: string;
  depositAccountId: number;
  reference: string;
}

async function readPayment(id: number): Promise<WrittenRecord & { invoices: string[] }> {
  const row = unwrap(await call<unknown>(`/payments-received/${id}`), "payment_receive", "paymentReceive");
  const entries = Array.isArray(row.entries) ? (row.entries as Row[]) : [];
  const amount = num(row.amount);
  return {
    id,
    number: txt(row.payment_receive_no, `#${id}`),
    customer: customerOf(row),
    // Q1: like receipts (withSign below), the amount carries the currency sign: "of SR200.00", not "of 200.00"
    total: await withSign(txt(row.formatted_amount, txt(row.amount_formatted, String(amount)))),
    invoices: entries
      .map((e) => {
        const invoice = e.invoice && typeof e.invoice === "object" ? (e.invoice as Row) : null;
        return txt(invoice?.invoice_no, e.invoice_id ? `#${txt(e.invoice_id)}` : "");
      })
      .filter(Boolean),
  };
}

/**
 * Records a payment received against one invoice (full or partial). The customer comes from the invoice; the server
 * numbers the payment, checks the amount against the balance due and changes the invoice's status.
 */
export async function recordPayment(input: PaymentInput) {
  const before = await getInvoice(input.invoiceId);
  const created = await call<Row>("/payments-received", {
    method: "POST",
    body: {
      customerId: before.customerId,
      paymentDate: input.date,
      depositAccountId: input.depositAccountId,
      ...(input.reference ? { referenceNo: input.reference } : {}),
      entries: [{ index: 1, invoiceId: input.invoiceId, paymentAmount: input.amount }],
    },
  });
  const id = num(unwrap(created, "payment_receive").id);
  const [payment, invoice] = await Promise.all([
    id ? readPayment(id) : Promise.resolve(null),
    getInvoice(input.invoiceId),
  ]);
  return { payment, invoice, before };
}

export async function deletePayment(id: number) {
  const payment = await readPayment(id);
  await call(`/payments-received/${id}`, { method: "DELETE" });
  return { payment };
}

// ---- estimates --------------------------------------------------------------------------------------------------

export interface EstimateInput {
  customerId: number;
  estimateDate: string;
  expirationDate: string;
  reference: string;
  note: string;
  deliver: boolean;
  lines: DocLine[];
}

async function rawEstimate(id: number) {
  return unwrap(await call<unknown>(`/sale-estimates/${id}`), "estimate", "sale_estimate");
}

function estimateRecord(id: number, row: Row): WrittenRecord {
  let state = "draft";
  if (num(row.converted_to_invoice_id) > 0 || row.is_converted_to_invoice === true) state = "converted";
  else if (row.is_approved === true) state = "approved";
  else if (row.is_rejected === true) state = "rejected";
  else if (row.is_delivered === true) state = "delivered";
  return {
    id,
    number: txt(row.estimate_number, `#${id}`),
    customer: customerOf(row),
    total: txt(row.total_formatted, txt(row.formatted_amount, String(num(row.total ?? row.amount)))),
    state,
  };
}

export async function createEstimate(input: EstimateInput) {
  const created = await call<Row>("/sale-estimates", {
    method: "POST",
    body: {
      customerId: input.customerId,
      estimateDate: input.estimateDate,
      expirationDate: input.expirationDate,
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.note ? { note: input.note } : {}),
      delivered: input.deliver,
      entries: entriesOf(input.lines),
    },
  });
  const id = num(unwrap(created, "estimate").id);
  return { estimate: estimateRecord(id, await rawEstimate(id)) };
}

/** The server's own "Mark as delivered" for an estimate. */
export async function deliverEstimate(id: number) {
  await call(`/sale-estimates/${id}/deliver`, { method: "POST" });
  return { estimate: estimateRecord(id, await rawEstimate(id)) };
}

/**
 * "Convert to invoice": a draft invoice with the estimate's customer, lines and reference, dated today and due today
 * (the server's own web app does the same), created with fromEstimateId so the server links the two and refuses an
 * estimate that was already converted.
 */
// The server in this version (v0.15.43) does not record a conversion: creating an invoice with fromEstimateId only
// checks the estimate (CreateSaleInvoice.service.ts:69-78), the invoice does not keep it (fromEstimateId is left out,
// CommandSaleInvoiceDTOTransformer.service.ts:100-106), and ConvertSaleEstimate, which sets converted_to_invoice_id, is
// registered (SaleEstimates.module.ts:8, :78) but called by nothing, and has no API route. So the page keeps the link
// itself, in one small file beside account-general-settings.json, and applies the server's own two rules with it:
// a converted estimate is not converted again, and is not deleted while its invoice exists (DeleteSaleEstimate
// .service.ts:47-48). When that invoice is deleted the link no longer counts, as the server's
// UnlinkConvertedSaleEstimate would do.
const LINKS_FILE = path.join(process.cwd(), ".preview-state", "invoice-estimate-links.json");

export type EstimateLinks = Record<string, { invoiceId: number; invoiceNumber: string; at: string }>;

export async function estimateLinks(): Promise<EstimateLinks> {
  try {
    const saved = JSON.parse(await readFile(LINKS_FILE, "utf8")) as unknown;
    return saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as EstimateLinks) : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function saveLinks(links: EstimateLinks) {
  // atomic: temp file + rename, so a crash never leaves half a file
  await mkdir(path.dirname(LINKS_FILE), { recursive: true });
  const temp = `${LINKS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(links));
  await rename(temp, LINKS_FILE);
}

/** The invoice an estimate was converted to, while that invoice still exists on the server; null otherwise. */
async function convertedInvoice(id: number) {
  const link = (await estimateLinks())[String(id)];
  if (!link) return null;
  try {
    return await getInvoice(link.invoiceId);
  } catch (error) {
    if (error instanceof BigcapitalError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

/**
 * "Convert to invoice": a draft invoice with the estimate's customer, lines and reference, dated today and due today
 * (the server's own web app does the same), created with fromEstimateId so the server checks the estimate.
 */
export async function convertEstimate(id: number) {
  const row = await rawEstimate(id);
  const estimate = estimateRecord(id, row);
  const already = await convertedInvoice(id);
  if (estimate.state === "converted" || already)
    throw new BigcapitalError(
      `${REFUSALS.SALE_ESTIMATE_CONVERTED_TO_INVOICE}${already ? ` Its invoice: ${already.number}.` : ""} (SALE_ESTIMATE_CONVERTED_TO_INVOICE)`,
      409,
    );
  const lines = linesOfRow(row);
  if (!lines.length) throw new BigcapitalError("This estimate has no lines to put on an invoice", 400);
  const reference = txt(row.reference);
  const day = today();
  const created = await call<Row>("/sale-invoices", {
    method: "POST",
    body: {
      customerId: num(row.customer_id),
      invoiceDate: day,
      dueDate: day,
      ...(reference ? { referenceNo: reference, invoiceMessage: `Reference: ${reference}` } : {}),
      delivered: false,
      fromEstimateId: id,
      isInclusiveTax: false,
      attachments: [],
      entries: entriesOf(lines),
    },
  });
  const invoiceId = num(unwrap(created, "sale_invoice").id);
  const invoice = await getInvoice(invoiceId);
  const links = await estimateLinks();
  links[String(id)] = { invoiceId, invoiceNumber: invoice.number, at: new Date().toISOString() };
  await saveLinks(links);
  return { estimate: { ...estimate, state: "converted" }, from: estimate, invoice };
}

export async function deleteEstimate(id: number) {
  const estimate = estimateRecord(id, await rawEstimate(id));
  const invoice = await convertedInvoice(id);
  if (invoice)
    throw new BigcapitalError(
      `${REFUSALS.SALE_ESTIMATE_CONVERTED_TO_INVOICE} Its invoice: ${invoice.number}. (SALE_ESTIMATE_CONVERTED_TO_INVOICE)`,
      409,
    );
  await call(`/sale-estimates/${id}`, { method: "DELETE" });
  const links = await estimateLinks();
  if (links[String(id)]) {
    delete links[String(id)];
    await saveLinks(links);
  }
  return { estimate };
}

// ---- sales receipts ---------------------------------------------------------------------------------------------

export interface ReceiptInput {
  customerId: number;
  depositAccountId: number;
  receiptDate: string;
  reference: string;
  message: string;
  close: boolean;
  lines: DocLine[];
}

/** "250.00" -> "SR250.00" (the base currency's sign), when the server's text has no sign. */
async function withSign(text: string) {
  if (!/^-?[\d.,]+$/.test(text)) return text;
  const currency = await baseCurrency().catch(() => null);
  return currency ? `${text.startsWith("-") ? "-" : ""}${currency.sign}${text.replace(/^-/, "")}` : text;
}

async function receiptRecord(id: number): Promise<WrittenRecord> {
  const row = unwrap(await call<unknown>(`/sale-receipts/${id}`), "sale_receipt", "receipt");
  return {
    id,
    number: txt(row.receipt_number, `#${id}`),
    customer: customerOf(row),
    // the server's total_formatted has no currency sign for receipts (SaleReceiptTransformer: money: false)
    total: await withSign(txt(row.formatted_amount, txt(row.total_formatted, String(num(row.total ?? row.amount))))),
    state: row.is_closed === true ? "closed" : "draft",
  };
}

export async function createReceipt(input: ReceiptInput) {
  const created = await call<Row>("/sale-receipts", {
    method: "POST",
    body: {
      customerId: input.customerId,
      depositAccountId: input.depositAccountId,
      receiptDate: input.receiptDate,
      ...(input.reference ? { referenceNo: input.reference } : {}),
      ...(input.message ? { receiptMessage: input.message } : {}),
      closed: input.close,
      entries: entriesOf(input.lines),
    },
  });
  const id = num(unwrap(created, "sale_receipt").id);
  return { receipt: await receiptRecord(id) };
}

export async function deleteReceipt(id: number) {
  const receipt = await receiptRecord(id);
  await call(`/sale-receipts/${id}`, { method: "DELETE" });
  return { receipt };
}

// ---- credit notes -----------------------------------------------------------------------------------------------

export interface CreditNoteInput {
  customerId: number;
  creditNoteDate: string;
  reference: string;
  note: string;
  open: boolean;
  lines: DocLine[];
}

async function creditNoteRecord(id: number): Promise<WrittenRecord> {
  const row = unwrap(await call<unknown>(`/credit-notes/${id}`), "credit_note", "creditNote");
  let state = "draft";
  if (row.is_closed === true) state = "closed";
  else if (row.is_open === true) state = "open";
  return {
    id,
    number: txt(row.credit_note_number, `#${id}`),
    customer: customerOf(row),
    total: txt(row.total_formatted, txt(row.formatted_amount, String(num(row.total ?? row.amount)))),
    state,
  };
}

/**
 * The next credit note number the way the server's web app makes it (CreditNoteForm.tsx:57-80): number_prefix +
 * next_number of the "credit_note" settings group when auto_increment is on. It must be sent: in v0.15.43 the server's
 * own fallback is not awaited (CommandCreditNoteDTOTransform.service.ts:65 calls getNextCreditNumber() without await),
 * so a credit note made without a number is saved with the number "{}". The server moves next_number on after the
 * credit note is created (CreditNoteAutoSerialSubscriber).
 */
async function nextCreditNoteNumber(): Promise<string | undefined> {
  const answer = await call<unknown>("/settings?group=credit_note");
  const rows = (
    Array.isArray(answer)
      ? answer
      : answer && typeof answer === "object" && Array.isArray((answer as Row).settings)
        ? ((answer as Row).settings as unknown[])
        : []
  ) as Row[];
  const get = (key: string) => rows.find((r) => txt(r.group) === "credit_note" && txt(r.key) === key)?.value;
  const auto = get("auto_increment");
  if (!(auto === true || auto === "true" || auto === 1 || auto === "1")) return undefined;
  const next = txt(get("next_number"));
  return next ? `${txt(get("number_prefix"))}${next}` : undefined;
}

export async function createCreditNote(input: CreditNoteInput) {
  const creditNoteNumber = await nextCreditNoteNumber();
  const created = await call<Row>("/credit-notes", {
    method: "POST",
    body: {
      ...(creditNoteNumber ? { creditNoteNumber } : {}),
      customerId: input.customerId,
      creditNoteDate: input.creditNoteDate,
      ...(input.reference ? { referenceNo: input.reference } : {}),
      ...(input.note ? { note: input.note } : {}),
      open: input.open,
      entries: entriesOf(input.lines),
    },
  });
  const id = num(unwrap(created, "credit_note").id);
  return { creditNote: await creditNoteRecord(id) };
}

export async function deleteCreditNote(id: number) {
  const creditNote = await creditNoteRecord(id);
  await call(`/credit-notes/${id}`, { method: "DELETE" });
  return { creditNote };
}

// ---- customers --------------------------------------------------------------------------------------------------

export interface CustomerFields {
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
}

export interface CustomerDetail extends CustomerFields {
  id: number;
  type: "individual" | "business";
  currency: string;
}

function customerDetail(row: Row): CustomerDetail {
  return {
    id: num(row.id),
    name: txt(row.display_name),
    company: txt(row.company_name),
    email: txt(row.email),
    phone: txt(row.work_phone, txt(row.personal_phone)),
    country: txt(row.billing_address_country),
    city: txt(row.billing_address_city),
    address: txt(row.billing_address_1, txt(row.billing_address1)),
    type: txt(row.customer_type) === "business" ? "business" : "individual",
    currency: txt(row.currency_code),
  };
}

export async function readCustomer(id: number): Promise<CustomerDetail> {
  return customerDetail(unwrap(await call<unknown>(`/customers/${id}`), "customer"));
}

const customerBody = (input: CustomerFields) => {
  const [first, ...rest] = input.name.split(/\s+/);
  return {
    customerType: input.company ? "business" : "individual",
    displayName: input.name,
    firstName: first || undefined,
    lastName: rest.join(" ") || undefined,
    companyName: input.company || undefined,
    email: input.email || undefined,
    workPhone: input.phone || undefined,
    billingAddressCountry: input.country || undefined,
    billingAddressCity: input.city || undefined,
    billingAddress1: input.address || undefined,
    billingAddressEmail: input.email || undefined,
    billingAddressPhone: input.phone || undefined,
  };
};

export async function createCustomerRecord(input: CustomerFields) {
  const currency = await baseCurrency().catch(() => null);
  const created = await call<Row>("/customers", {
    method: "POST",
    body: { ...customerBody(input), currencyCode: currency?.code ?? "SAR" },
  });
  const id = num(unwrap(created, "customer").id);
  return { customer: await readCustomer(id) };
}

/** PUT /customers/{id} (EditCustomerDto): what the form shows is sent; the currency cannot change after creation. */
export async function editCustomerRecord(id: number, input: CustomerFields) {
  const before = await readCustomer(id);
  await call(`/customers/${id}`, { method: "PUT", body: customerBody(input) });
  return { customer: await readCustomer(id), before };
}

/**
 * DELETE /customers/{id}. The server decides: it keeps a customer with transactions (CUSTOMER_HAS_TRANSACTIONS). When
 * it refuses, the customer's invoices are named so the user knows what to delete first.
 */
export async function deleteCustomerRecord(id: number) {
  const customer = await readCustomer(id);
  try {
    await bc(`/customers/${id}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof BigcapitalError) || (error.status !== 409 && error.status !== 400 && error.status !== 502))
      throw error;
    const invoices = await call<{ sales_invoices?: Row[]; data?: Row[] }>(
      `/sale-invoices?page=1&page_size=200&customer_id=${id}`,
    ).catch(() => null);
    const numbers = (invoices?.sales_invoices ?? invoices?.data ?? [])
      .filter((row) => num(row.customer_id) === id)
      .map((row) => txt(row.invoice_no))
      .filter(Boolean);
    // v0.15.43 answers this refusal with a bare 500 (no error type), so the words say what the server did and its rule.
    const base = error.message.includes("CUSTOMER_HAS_TRANSACTIONS")
      ? `${REFUSALS.CUSTOMER_HAS_TRANSACTIONS} (CUSTOMER_HAS_TRANSACTIONS)`
      : error.status === 502
        ? "Refused: the invoices server did not delete this customer (it answered 500). It keeps a customer that has transactions: invoices, estimates, receipts, payments or credit notes."
        : (worded(error) as Error).message;
    throw new BigcapitalError(numbers.length ? `${base} Its invoices: ${numbers.join(", ")}.` : base, 409);
  }
  return { customer };
}

// ---- products & services ----------------------------------------------------------------------------------------

export interface ItemFields {
  name: string;
  type: "service" | "non-inventory";
  code: string;
  sellPrice: number;
  sellAccountId: number;
  sellTaxRateId: number | null;
  description: string;
}

export interface ItemDetail extends Omit<ItemFields, "type"> {
  id: number;
  type: string;
  sellable: boolean;
}

async function rawItem(id: number) {
  return unwrap(await call<unknown>(`/items/${id}`), "item");
}

function itemDetail(row: Row): ItemDetail {
  return {
    id: num(row.id),
    name: txt(row.name),
    type: txt(row.type, "service"),
    code: txt(row.code),
    sellPrice: num(row.sell_price),
    sellAccountId: num(row.sell_account_id),
    sellTaxRateId: num(row.sell_tax_rate_id) || null,
    description: txt(row.sell_description),
    sellable: row.sellable !== false,
  };
}

export async function readItem(id: number): Promise<ItemDetail> {
  return itemDetail(await rawItem(id));
}

export async function createItemRecord(input: ItemFields) {
  const created = await call<Row>("/items", {
    method: "POST",
    body: {
      name: input.name,
      type: input.type,
      ...(input.code ? { code: input.code } : {}),
      sellable: true,
      purchasable: false,
      sellPrice: input.sellPrice,
      sellAccountId: input.sellAccountId,
      ...(input.sellTaxRateId ? { sellTaxRateId: input.sellTaxRateId } : {}),
      ...(input.description ? { sellDescription: input.description } : {}),
    },
  });
  const id = num(unwrap(created, "item").id);
  return { item: await readItem(id) };
}

/**
 * PUT /items/{id} (EditItemDto). The fields the form does not show (purchase side, inventory account, category,
 * note) are sent back as they were, so an edit here never clears them.
 */
export async function editItemRecord(id: number, input: ItemFields) {
  const row = await rawItem(id);
  const before = itemDetail(row);
  const keep = (key: string, value: unknown) =>
    value === null || value === undefined || value === "" ? {} : { [key]: value };
  // An inventory item keeps its type: the form only offers service and non-inventory.
  const type = txt(row.type) === "inventory" ? "inventory" : input.type;
  await call(`/items/${id}`, {
    method: "PUT",
    body: {
      name: input.name,
      type,
      ...(input.code ? { code: input.code } : {}),
      sellable: true,
      sellPrice: input.sellPrice,
      sellAccountId: input.sellAccountId,
      ...(input.sellTaxRateId ? { sellTaxRateId: input.sellTaxRateId } : {}),
      ...(input.description ? { sellDescription: input.description } : {}),
      purchasable: row.purchasable === true,
      ...keep("costPrice", row.cost_price === null ? null : num(row.cost_price) || null),
      ...keep("costAccountId", num(row.cost_account_id) || null),
      ...keep("inventoryAccountId", num(row.inventory_account_id) || null),
      ...keep("purchaseDescription", txt(row.purchase_description) || null),
      ...keep("purchaseTaxRateId", num(row.purchase_tax_rate_id) || null),
      ...keep("categoryId", num(row.category_id) || null),
      ...keep("note", txt(row.note) || null),
      active: row.active !== false,
    },
  });
  return { item: await readItem(id), before };
}

export async function deleteItemRecord(id: number) {
  const item = await readItem(id);
  try {
    await bc(`/items/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof BigcapitalError && error.status === 502)
      throw new BigcapitalError(
        `${REFUSALS.ITEM_HAS_ASSOCIATED_TRANSACTINS} (ITEM_HAS_ASSOCIATED_TRANSACTINS, answered 500)`,
        409,
      );
    throw worded(error);
  }
  return { item };
}

export { BigcapitalError };

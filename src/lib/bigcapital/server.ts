// M129-D (Fahad 129.4): server-side client for the local Bigcapital install (v0.15.43, docker project "bigcapital"
// on the colima "lab" machine, published on 127.0.0.1:3490 only). Only Next.js route handlers import this file, so
// the API key never reaches the browser. Key: BIGCAPITAL_API_KEY, else the 600 file next to the install.
// API reference: https://github.com/bigcapitalhq/bigcapital/blob/v0.15.43/shared/sdk-ts/openapi.json
// Auth: "Authorization: Bearer <api key>" (packages/server/src/modules/Auth/api-key/AuthApiKey.strategy.ts).

import { ownNames } from "@/lib/own-names";
import { readVaultSecret } from "@/lib/system-vault";

import { readFile } from "node:fs/promises";
import path from "node:path";

export const BIGCAPITAL_URL = process.env.BIGCAPITAL_URL ?? "http://127.0.0.1:3490";
const KEY_FILE = process.env.BIGCAPITAL_API_KEY_FILE ?? "/Users/ali/lobehub-hub/bigcapital/preview-api-key.txt";
const VAULT_NAMES = ["bigcapital_api_key", "BIGCAPITAL_API_KEY"] as const;

export class BigcapitalError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let cachedKey: string | null = null;

async function apiKey() {
  if (cachedKey) return cachedKey;
  const vault = readVaultSecret(VAULT_NAMES);
  if (vault) {
    cachedKey = vault;
    return cachedKey;
  }
  if (process.env.BIGCAPITAL_API_KEY) return process.env.BIGCAPITAL_API_KEY;
  try {
    cachedKey = (await readFile(KEY_FILE, "utf8")).trim();
  } catch {
    throw new BigcapitalError("The invoices server's API key is not configured on the preview server", 503);
  }
  return cachedKey;
}

/** The error text Bigcapital returns, in one line. */
function errorText(body: unknown, status: number) {
  const b = body as {
    message?: unknown;
    errors?: Array<{ type?: string; message?: string }>;
  } | null;
  if (Array.isArray(b?.errors) && b.errors.length) {
    // F-5B: keep Bigcapital's error type too (e.g. INVOICE_HAS_ASSOCIATED_PAYMENT_ENTRIES), the delete routes read it.
    return b.errors
      .map((e) => {
        const type = e.type ?? "";
        // B-2: never show the internal name ThrottlerException to the user
        if (/throttler/i.test(type)) return "Too many requests — please wait a moment";
        return e.message && type && e.message !== type ? `${e.message} (${type})` : (e.message ?? type ?? "error");
      })
      .join("; ");
  }
  if (typeof b?.message === "string") return b.message;
  if (Array.isArray(b?.message)) {
    return (b.message as Array<{ constraints?: Record<string, string> } | string>)
      .map((m) => (typeof m === "string" ? m : Object.values(m.constraints ?? {}).join(", ")))
      .join("; ");
  }
  return `The invoices server answered ${status}`;
}

async function request(path: string, init: { method?: string; body?: unknown; accept?: string } = {}) {
  let response: Response;
  try {
    response = await fetch(`${BIGCAPITAL_URL}/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${await apiKey()}`,
        Accept: init.accept ?? "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (error instanceof BigcapitalError) throw error;
    throw new BigcapitalError("The invoices server is not reachable", 502);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new BigcapitalError(errorText(body, response.status), response.status >= 500 ? 502 : response.status);
  }
  return response;
}

export async function bc<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await request(path, init);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function bcPdf(path: string): Promise<ArrayBuffer> {
  const response = await request(path, { accept: "application/pdf" });
  return response.arrayBuffer();
}

// ---- shapes (Bigcapital answers in snake_case) ----

interface BcCustomerRow {
  id: number;
  display_name: string;
  company_name: string | null;
  email: string | null;
  work_phone: string | null;
  personal_phone: string | null;
  billing_address_country: string | null;
  billing_address_city: string | null;
  billing_address1: string | null;
  balance?: number;
  formatted_balance?: string;
  currency_code?: string;
}

export interface BigcapitalCustomer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  city: string;
  address: string;
}

function toCustomer(row: BcCustomerRow): BigcapitalCustomer {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email ?? "",
    phone: row.work_phone || row.personal_phone || "",
    company: row.company_name ?? "",
    country: row.billing_address_country ?? "",
    city: row.billing_address_city ?? "",
    address: row.billing_address1 ?? "",
  };
}

export async function listCustomers(): Promise<BigcapitalCustomer[]> {
  const out: BigcapitalCustomer[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await bc<{ data: BcCustomerRow[]; pagination: { total: number; page_size: number } }>(
      `/customers?page=${page}&page_size=200&inactive_mode=false`,
    );
    out.push(...res.data.map(toCustomer));
    if (out.length >= res.pagination.total || res.data.length === 0) break;
  }
  return out;
}

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  country?: string;
  city?: string;
}

export async function createCustomer(input: CustomerInput): Promise<BigcapitalCustomer> {
  const [first, ...rest] = input.name.trim().split(/\s+/);
  const row = await bc<BcCustomerRow>("/customers", {
    method: "POST",
    body: {
      customerType: input.company ? "business" : "individual",
      currencyCode: "SAR",
      displayName: input.name.trim(),
      firstName: first || undefined,
      lastName: rest.join(" ") || undefined,
      companyName: input.company || undefined,
      email: input.email || undefined,
      workPhone: input.phone || undefined,
      billingAddressCountry: input.country || undefined,
      billingAddressCity: input.city || undefined,
      billingAddressEmail: input.email || undefined,
      billingAddressPhone: input.phone || undefined,
    },
  });
  return toCustomer(row);
}

/** The Bigcapital customer for this contact: same email (or, without one, same name), created when missing. */
export async function ensureCustomer(
  input: CustomerInput,
): Promise<{ customer: BigcapitalCustomer; created: boolean }> {
  const email = input.email?.trim().toLowerCase();
  const name = input.name.trim().toLowerCase();
  const all = await listCustomers();
  const found = email
    ? all.find((c) => c.email.toLowerCase() === email)
    : all.find((c) => !c.email && c.name.toLowerCase() === name);
  if (found) return { customer: found, created: false };
  return { customer: await createCustomer(input), created: true };
}

// ---- items, taxes, templates used when an invoice is created ----

/**
 * F-5B: the catalogue item that carries the invoice discount as its own line (see createInvoice). Its sales account is
 * Bigcapital's own "Discount" account (slug "discount", the account its invoice-level discount posts to).
 */
export const DISCOUNT_ITEM_NAME = "Discount";

const itemKey = (name: string) => name.trim().toLowerCase();

async function catalogueItems(): Promise<Map<string, number>> {
  const items = await bc<{ data?: Array<{ id: number; name: string }> }>("/items?page_size=1000");
  const ids = new Map<string, number>();
  for (const item of items.data ?? []) ids.set(itemKey(item.name), item.id);
  return ids;
}

/** F-5B: names of the catalogue items Bigcapital already has (the Send panel says which lines would be new items). */
export async function listItemNames(): Promise<string[]> {
  const items = await bc<{ data?: Array<{ id: number; name: string }> }>("/items?page_size=1000");
  return (items.data ?? []).map((item) => item.name);
}

/**
 * Bigcapital needs a catalogue item on every invoice line. Each line's description becomes (or reuses) a service item
 * with that name, so the PDF prints the description as the item, as the preview does.
 * F-5B: returns the names it created, so the page can say so (condition 3: nothing is created silently).
 */
async function ensureLineItems(
  names: string[],
  discountItem: boolean,
): Promise<{ ids: Map<string, number>; created: string[] }> {
  const ids = await catalogueItems();
  const missing = [...new Set(names.map((name) => name.trim()))].filter((name) => !ids.has(itemKey(name)));
  const needDiscount = discountItem && !ids.has(itemKey(DISCOUNT_ITEM_NAME));
  const created: string[] = [];
  if (!missing.length && !needDiscount) return { ids, created };
  type Account = { id: number; name: string; slug?: string; account_type: string };
  const res = await bc<{ accounts?: Account[] } | Account[]>("/accounts");
  const accounts = Array.isArray(res) ? res : (res.accounts ?? []);
  const income =
    accounts.find((a) => a.account_type === "income" && /service/i.test(a.name)) ??
    accounts.find((a) => a.account_type === "income");
  if (!income) throw new BigcapitalError("The invoices server has no income account for the invoice lines", 502);
  for (const name of missing) {
    const item = await bc<{ id: number }>("/items", {
      method: "POST",
      body: { name, type: "service", sellable: true, purchasable: false, sellAccountId: income.id },
    });
    ids.set(itemKey(name), item.id);
    created.push(name);
  }
  if (needDiscount) {
    const discountAccount = accounts.find((a) => a.slug === "discount") ?? income;
    const item = await bc<{ id: number }>("/items", {
      method: "POST",
      body: {
        name: DISCOUNT_ITEM_NAME,
        type: "service",
        sellable: true,
        purchasable: false,
        sellAccountId: discountAccount.id,
      },
    });
    ids.set(itemKey(DISCOUNT_ITEM_NAME), item.id);
    created.push(DISCOUNT_ITEM_NAME);
  }
  return { ids, created };
}

export interface BigcapitalTaxRate {
  id: number;
  name: string;
  code: string;
  rate: number;
}

/**
 * F-5B (condition 3): the tax menu comes from Bigcapital's own tax rates (GET /api/tax-rates), active ones only.
 * The page no longer creates tax rates; it uses the one the user picks.
 */
export async function listTaxRates(): Promise<BigcapitalTaxRate[]> {
  type Row = { id: number; name: string; code: string; rate: number; active: number | boolean };
  const res = await bc<{ data?: Row[] } | Row[]>("/tax-rates");
  const rows = Array.isArray(res) ? res : (res.data ?? []);
  return rows
    .filter((row) => Boolean(row.active))
    .map((row) => ({ id: row.id, name: row.name, code: row.code, rate: Number(row.rate) }))
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
}

/** Invoice templates made in the trial: "عربي - Arabic" (Arabic labels) and "English", both with the uploaded logo. */
async function templateFor(language: "en" | "ar"): Promise<number | undefined> {
  const templates = await bc<Array<{ id: number; resource: string; template_name: string }>>("/pdf-templates");
  const wanted = language === "ar" ? "عربي - Arabic" : "English";
  return templates.find((t) => t.resource === "SaleInvoice" && t.template_name === wanted)?.id;
}

export interface InvoiceInput {
  customerId: number;
  referenceNumber: string;
  issuedDate: string;
  dueDate: string;
  language: "en" | "ar";
  /** F-5B: a Bigcapital tax rate id (from listTaxRates), or null for no tax. */
  taxRateId: number | null;
  /** F-5B: the discount as an amount (already worked out from a percent), and the words printed on its line. */
  discount: { amount: number; label: string } | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
}

interface BcInvoice {
  id: number;
  invoice_no: string;
  reference_no: string | null;
  customer_id: number;
  invoice_date: string;
  due_date: string;
  is_delivered?: boolean;
  delivered_at?: string | null;
  balance?: number;
  total?: number | null;
  total_formatted?: string;
  due_amount?: number;
  due_amount_formatted?: string;
  payment_amount?: number;
  payment_amount_formatted?: string;
  is_paid?: boolean;
  is_partially_paid?: boolean;
  is_overdue?: boolean;
  currency_code?: string;
  customer?: { display_name?: string };
}

export interface BigcapitalInvoice {
  id: number;
  number: string;
  reference: string;
  customerId: number;
  customerName: string;
  date: string;
  dueDate: string;
  delivered: boolean;
  deliveredAt: string | null;
  total: string;
  due: string;
  paid: string;
  status: "paid" | "partially-paid" | "overdue" | "delivered" | "draft";
}

export function toInvoice(row: BcInvoice): BigcapitalInvoice {
  // F-21: the server's is_paid is "partially OR fully paid" (SaleInvoice.ts isPaid = isPartiallyPaid || isFullyPaid),
  // so partially paid is checked first; before, a partly paid invoice read "paid".
  const status = row.is_partially_paid
    ? "partially-paid"
    : row.is_paid
      ? "paid"
      : row.is_overdue
        ? "overdue"
        : row.is_delivered
          ? "delivered"
          : "draft";
  return {
    id: row.id,
    number: row.invoice_no,
    reference: row.reference_no ?? "",
    customerId: row.customer_id,
    customerName: row.customer?.display_name ?? "",
    date: row.invoice_date,
    dueDate: row.due_date,
    delivered: Boolean(row.is_delivered),
    deliveredAt: row.delivered_at ?? null,
    total: row.total_formatted ?? String(row.total ?? row.balance ?? ""),
    due: row.due_amount_formatted ?? String(row.due_amount ?? ""),
    paid: row.payment_amount_formatted ?? String(row.payment_amount ?? ""),
    status,
  };
}

/**
 * F-5B (condition 1): the discount is sent as its own negative line ("Discount", quantity 1, rate -amount) with the
 * invoice's tax rate, not as Bigcapital's invoice-level discount. Why, from Bigcapital v0.15.43's own code:
 *  - its PDF prints each line's total WITH the line tax (utils.ts:41 -> ItemEntry.total, ItemEntry.ts:90 and :123),
 *    while the invoice-level discount is taken off after the lines (SaleInvoice.ts:214-220). So the lines never added
 *    up to the total (the 1,375 vs 1,325 in the simulation: 1,100 + 275 = subtotal 1,250 + tax 125; total = 1,375 - 50);
 *  - its invoice-level discount does not lower the tax (tax comes from the lines, SaleInvoice.ts:216), while ZATCA
 *    taxes the amount after document-level discounts (E-Invoice XML Implementation Standard v1.2, section 9.6);
 *  - its line-level discount is left out of the invoice total (balance = sum of quantity x rate,
 *    CommandSaleInvoiceDTOTransformer.service.ts:159-160), so it cannot be used either (checked: lines 1,325, total 1,375).
 * With the discount as a taxed negative line, the line totals add up to the total, the tax is charged after the
 * discount, and the ledger stays balanced (the line posts to the "Discount" account, InvoiceGL.ts:110).
 */
export async function createInvoice(
  input: InvoiceInput,
): Promise<{ invoice: BigcapitalInvoice; createdItems: string[] }> {
  const lines = input.items.filter((i) => i.description.trim() || i.unitPrice);
  if (!lines.length) throw new BigcapitalError("Add at least one invoice item", 400);
  const lineName = (description: string) => description.trim().slice(0, 190) || "Service";
  const discount = input.discount && input.discount.amount > 0 ? input.discount : null;
  const [items, pdfTemplateId] = await Promise.all([
    ensureLineItems(
      lines.map((line) => lineName(line.description)),
      Boolean(discount),
    ),
    templateFor(input.language),
  ]);
  const taxRateId = input.taxRateId ?? undefined;
  const entries = lines.map((line, index) => ({
    index: index + 1,
    itemId: items.ids.get(itemKey(lineName(line.description))),
    quantity: Number.isFinite(line.quantity) ? line.quantity : 1,
    rate: Number.isFinite(line.unitPrice) ? line.unitPrice : 0,
    taxRateId,
  }));
  if (discount) {
    entries.push({
      index: entries.length + 1,
      itemId: items.ids.get(itemKey(DISCOUNT_ITEM_NAME)),
      quantity: 1,
      rate: -Math.round(discount.amount * 100) / 100,
      taxRateId,
      ...(discount.label ? { description: discount.label.slice(0, 120) } : {}),
    });
  }
  const created = await bc<{ id: number }>("/sale-invoices", {
    method: "POST",
    body: {
      customerId: input.customerId,
      invoiceDate: input.issuedDate,
      dueDate: input.dueDate,
      referenceNo: input.referenceNumber || undefined,
      // F-18a (monitor's decision, 15 Oct): the PDF template does not print Reference No (F-9 result, section 9), so the
      // reference is also written as one line in the Statement (invoiceMessage), which the PDF prints. Reference No
      // keeps it too.
      invoiceMessage: input.referenceNumber ? `Reference: ${input.referenceNumber}` : undefined,
      delivered: false,
      isInclusiveTax: false,
      pdfTemplateId,
      attachments: [],
      entries,
    },
  });
  return { invoice: await getInvoice(created.id), createdItems: items.created };
}

// ---- F-5B: the issuer (Bigcapital's organization profile) ----

/** What the invoice page's Business tab keeps in Bigcapital's organization profile (it is printed on its PDFs). */
export interface BigcapitalOrganization {
  name: string;
  addressLines: string[];
  phone: string;
  taxNumber: string;
  location: string;
}

interface BcOrgMetadata {
  name?: string | null;
  location?: string | null;
  tax_number?: string | null;
  address?: {
    address1?: string;
    address2?: string;
    city?: string;
    state_province?: string;
    stateProvince?: string;
    postal_code?: string;
    postalCode?: string;
    phone?: string;
  } | null;
}

function toOrganization(meta: BcOrgMetadata): BigcapitalOrganization {
  const a = meta.address ?? {};
  const cityLine = [a.city, a.state_province ?? a.stateProvince, a.postal_code ?? a.postalCode]
    .filter(Boolean)
    .join(" ");
  return {
    name: meta.name ?? "",
    addressLines: [a.address1, a.address2, cityLine].filter((line): line is string => Boolean(line?.trim())),
    phone: a.phone ?? "",
    taxNumber: meta.tax_number ?? "",
    location: meta.location ?? "",
  };
}

async function currentOrganization() {
  const org = await bc<{ metadata?: BcOrgMetadata & { base_currency?: string | null } }>("/organization/current");
  return { organization: toOrganization(org.metadata ?? {}), baseCurrency: org.metadata?.base_currency ?? null };
}

/** GET /api/organization/current: the name, address, phone and tax number Bigcapital prints as the seller. */
export async function getOrganization(): Promise<BigcapitalOrganization> {
  return (await currentOrganization()).organization;
}

// F-21 (task: "the organization name in the PDF is the establishment name from the site's General Settings"): the
// account name saved by Settings > General (app/api/account-general-settings, its own small file on the preview
// machine) is the seller name the invoices server prints. null when General Settings was never saved.
const GENERAL_SETTINGS_FILE = path.join(process.cwd(), ".preview-state", "account-general-settings.json");

export async function generalSettingsName(): Promise<string | null> {
  try {
    const saved = JSON.parse(await readFile(GENERAL_SETTINGS_FILE, "utf8")) as { name?: unknown };
    return typeof saved.name === "string" && saved.name.trim() ? saved.name.trim() : null;
  } catch {
    return null;
  }
}

/**
 * F-21: writes the General Settings name into the invoices server's organization profile (PUT /api/organization, name
 * only), so its PDFs print it. The base currency is sent unchanged: UpdateOrganization.service.ts (v0.15.43) emits
 * "base currency updated" whenever the sent baseCurrency differs from the saved one, undefined included, and
 * MutateBaseCurrencyAccountsSubscriber then rewrites every account's currency with it.
 */
export async function syncOrganizationName(): Promise<{ before: string; after: string; changed: boolean }> {
  const [{ organization: current, baseCurrency }, name] = await Promise.all([
    currentOrganization(),
    generalSettingsName(),
  ]);
  if (!name || name === current.name) return { before: current.name, after: current.name, changed: false };
  await bc("/organization", {
    method: "PUT",
    body: { name, ...(baseCurrency ? { baseCurrency } : {}) },
  });
  const after = await getOrganization();
  return { before: current.name, after: after.name, changed: after.name !== current.name };
}

/**
 * PUT /api/organization (UpdateOrganizationDto, Organization.dto.ts:108): name, address and tax number. Bigcapital
 * prints the name and address (with the phone) at the top of every invoice PDF (GetOrganizationBrandingAttributes
 * .service.ts:21-24, address-text-format.ts:18). Address lines map to address1, address2 and the rest to city.
 * Returns the fields that changed (empty when nothing did, and then nothing is sent).
 */
export async function saveOrganization(
  next: Pick<BigcapitalOrganization, "name" | "addressLines" | "phone" | "taxNumber">,
): Promise<{ organization: BigcapitalOrganization; changed: string[] }> {
  const [{ organization: current, baseCurrency }, settingsName] = await Promise.all([
    currentOrganization(),
    generalSettingsName(),
  ]);
  const lines = next.addressLines.map((line) => line.trim()).filter(Boolean);
  const wanted: BigcapitalOrganization = {
    ...current,
    // F-21: the seller name is the General Settings account name when one is saved (see generalSettingsName)
    name: settingsName ?? (next.name.trim() || current.name),
    addressLines: lines,
    phone: next.phone.trim(),
    taxNumber: next.taxNumber.trim(),
  };
  const changed: string[] = [];
  if (wanted.name !== current.name) changed.push("name");
  if (wanted.addressLines.join("\n") !== current.addressLines.join("\n")) changed.push("address");
  if (wanted.phone !== current.phone) changed.push("phone");
  if (wanted.taxNumber !== current.taxNumber) changed.push("tax number");
  if (!changed.length) return { organization: current, changed };
  await bc("/organization", {
    method: "PUT",
    body: {
      name: wanted.name,
      // F-21: unchanged, so the server does not rewrite the accounts' currency (see syncOrganizationName)
      ...(baseCurrency ? { baseCurrency } : {}),
      taxNumber: wanted.taxNumber,
      address: {
        address1: lines[0] ?? "",
        address2: lines[1] ?? "",
        city: lines.slice(2).join(", "),
        stateProvince: "",
        postalCode: "",
        phone: wanted.phone,
      },
    },
  });
  return { organization: await getOrganization(), changed };
}

// ---- F-5B: deleting (condition 4) ----

/** Bigcapital's own refusal reasons (ServiceError types in SaleInvoices/constants.ts), in words. */
const REFUSALS: Record<string, string> = {
  INVOICE_HAS_ASSOCIATED_PAYMENT_ENTRIES:
    "Refused: this invoice has received payments, so the invoices server keeps it.",
  SALE_INVOICE_HAS_APPLIED_TO_CREDIT_NOTES:
    "Refused: credit notes are applied to this invoice, so the invoices server keeps it.",
  TRANSACTIONS_DATE_LOCKED: "Refused: sales transactions are locked for this date on the invoices server.",
};

function refusalText(error: unknown): string | null {
  if (!(error instanceof BigcapitalError)) return null;
  for (const [type, text] of Object.entries(REFUSALS)) if (error.message.includes(type)) return text;
  return null;
}

/**
 * DELETE /api/sale-invoices/:id. Bigcapital deletes drafts and delivered invoices alike; it refuses only when the
 * invoice has received payments or applied credit notes (DeleteSaleInvoice.service.ts:74-77).
 */
export async function deleteInvoice(id: number): Promise<BigcapitalInvoice> {
  const invoice = await getInvoice(id);
  try {
    await bc(`/sale-invoices/${id}`, { method: "DELETE" });
  } catch (error) {
    const refusal = refusalText(error);
    if (refusal) throw new BigcapitalError(refusal, 409);
    throw error;
  }
  return invoice;
}

export async function invoicesOfCustomer(customerId: number): Promise<BigcapitalInvoice[]> {
  const out: BigcapitalInvoice[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await bc<{ data?: BcInvoice[]; sales_invoices?: BcInvoice[]; pagination?: { total: number } }>(
      `/sale-invoices?page=${page}&page_size=200`,
    );
    const rows = res.data ?? res.sales_invoices ?? [];
    out.push(...rows.filter((row) => row.customer_id === customerId).map(toInvoice));
    if (!rows.length || page * 200 >= (res.pagination?.total ?? 0)) break;
  }
  return out;
}

/**
 * DELETE /api/customers/:id. Bigcapital keeps a customer that has transactions (DeleteCustomer.service.ts:54-56,
 * "Customer has associated transactions"); in v0.15.43 that refusal reaches the API as a bare 500, so the invoices are
 * checked first and named.
 */
export async function deleteCustomer(id: number): Promise<{ id: number; name: string }> {
  const customer = await bc<BcCustomerRow | { customer: BcCustomerRow }>(`/customers/${id}`);
  const row = "customer" in customer ? customer.customer : customer;
  const invoices = await invoicesOfCustomer(id);
  if (invoices.length) {
    const numbers = invoices.map((invoice) => invoice.number).join(", ");
    throw new BigcapitalError(`Refused: customer #${id} has invoices (${numbers}). Delete those invoices first.`, 409);
  }
  try {
    await bc(`/customers/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof BigcapitalError && error.status === 502) {
      throw new BigcapitalError(
        "The invoices server refused to delete this customer (it answered 500). It keeps customers that have transactions such as payments, estimates or credit notes.",
        409,
      );
    }
    throw error;
  }
  return { id, name: row.display_name };
}

export async function getInvoice(id: number): Promise<BigcapitalInvoice> {
  const row = await bc<BcInvoice | { data: BcInvoice }>(`/sale-invoices/${id}`);
  return toInvoice("data" in row && row.data ? row.data : (row as BcInvoice));
}

/** Round 2: Bigcapital's base currency and its sign ("SAR", "SR"), so the preview prints amounts the same way. */
export async function baseCurrency(): Promise<{ code: string; sign: string } | null> {
  const org = await bc<{ metadata?: { base_currency?: string } }>("/organization/current");
  const code = org.metadata?.base_currency;
  if (!code) return null;
  const currencies = await bc<Array<{ currency_code: string; currency_sign: string }>>("/currencies");
  const sign = currencies.find((c) => c.currency_code === code)?.currency_sign;
  return { code, sign: sign ?? code };
}

export async function listInvoices(): Promise<BigcapitalInvoice[]> {
  const res = await bc<{ data?: BcInvoice[]; sales_invoices?: BcInvoice[] }>(
    "/sale-invoices?page=1&page_size=10&sort_order=desc&column_sort_by=created_at",
  );
  return (res.data ?? res.sales_invoices ?? []).map(toInvoice);
}

/**
 * F-7 (the Invoices list on /dashboard/invoice): one page of Bigcapital's invoices, newest first, with the total count.
 * GET /api/sale-invoices?page=&page_size= answers { sales_invoices, pagination: { page, pageSize, total } }.
 */
export async function listInvoicesPage(
  page: number,
  pageSize: number,
): Promise<{ invoices: BigcapitalInvoice[]; page: number; pageSize: number; total: number }> {
  const res = await bc<{
    data?: BcInvoice[];
    sales_invoices?: BcInvoice[];
    pagination?: { page?: number; pageSize?: number; page_size?: number; total?: number };
  }>(`/sale-invoices?page=${page}&page_size=${pageSize}&sort_order=desc&column_sort_by=created_at`);
  const rows = res.data ?? res.sales_invoices ?? [];
  return {
    invoices: rows.map(toInvoice),
    page: res.pagination?.page ?? page,
    pageSize: res.pagination?.pageSize ?? res.pagination?.page_size ?? pageSize,
    total: res.pagination?.total ?? rows.length,
  };
}

// ---- sending ----

export interface InvoiceMail {
  to: string[];
  subject: string;
  message: string;
  attachInvoice: boolean;
}

/**
 * The email Bigcapital would send for this invoice (its own default subject and message, placeholders filled from its
 * format_args). Nothing is sent here: this install has no mail server configured (MAIL_HOST is empty).
 */
export async function invoiceMail(id: number): Promise<InvoiceMail> {
  const state = await bc<{
    to?: string[];
    subject?: string;
    message?: string;
    attach_invoice?: boolean;
    format_args?: Record<string, string | number>;
  }>(`/sale-invoices/${id}/mail`);
  const norm = (key: string) => key.replace(/[\s_]/g, "").toLowerCase();
  const args = Object.fromEntries(Object.entries(state.format_args ?? {}).map(([k, v]) => [norm(k), String(v)]));
  // F-16: the preview of the email never names the system behind the page (lib/own-names.ts).
  const fill = (text: string) =>
    ownNames(text.replace(/\{([^}]+)\}/g, (match, name: string) => args[norm(name)] ?? match));
  return {
    to: state.to ?? [],
    subject: fill(state.subject ?? ""),
    message: fill(state.message ?? ""),
    attachInvoice: state.attach_invoice !== false,
  };
}

/** Bigcapital's own "Mark as delivered" (PUT /sale-invoices/:id/deliver). */
export async function markDelivered(id: number) {
  await bc(`/sale-invoices/${id}/deliver`, { method: "PUT" });
}

export async function invoicePayments(id: number) {
  const rows = await bc<
    Array<{ id: number; payment_receive_id?: number; payment_amount_formatted?: string; date?: string }>
  >(`/sale-invoices/${id}/payments`);
  return Array.isArray(rows) ? rows : [];
}

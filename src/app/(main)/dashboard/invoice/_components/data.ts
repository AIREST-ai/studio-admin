import { addDays, format } from "date-fns";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTaxOption {
  id: string;
  name: string;
  rate: number;
  /** F-5B: the Bigcapital tax rate this option is (GET /api/tax-rates); none for "No tax". */
  bigcapitalId?: number;
  code?: string;
}

export type InvoiceDiscountType = "fixed" | "percent";

export const INVOICE_PAPER_WIDTH = 816;
export const INVOICE_PAPER_HEIGHT = 1056;
export const INVOICE_PAPER_SCALE = 0.6;

export interface InvoiceFromDetails {
  name: string;
  email: string;
  phone: string;
  website: string;
  addressLines: string[];
  taxId: string;
  paymentAccountName: string;
  routingNumber: string;
  issuerName: string;
}

export interface InvoiceToDetails {
  id: string;
  name: string;
  email: string;
  addressLines: string[];
  taxId: string;
  /** M129-D: contact fields kept for the Bigcapital customer, and that customer's id once linked. */
  phone?: string;
  company?: string;
  country?: string;
  bigcapitalCustomerId?: number;
}

/** M129-D round 2: the currency Bigcapital uses (its base currency), printed the way Bigcapital prints it. */
export interface InvoiceCurrency {
  code: string;
  sign: string;
}

/** Bigcapital's organization was built with base currency SAR, sign "SR" (GET /api/currencies); the page re-reads it. */
export const DEFAULT_INVOICE_CURRENCY: InvoiceCurrency = { code: "SAR", sign: "SR" };

/** "SR6,008.00", as Bigcapital formats amounts in its PDF and screens. */
export function formatInvoiceMoney(value: number, currency: InvoiceCurrency | undefined = DEFAULT_INVOICE_CURRENCY) {
  const amount = Number.isFinite(value) ? value : 0;
  const text = Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? "-" : ""}${currency.sign}${text}`;
}

/** M129-D: the Bigcapital invoice made from this draft ("Send Invoice"), kept with the draft. */
export interface InvoiceBigcapitalLink {
  id: number;
  number: string;
  status: string;
  delivered: boolean;
}

export interface InvoiceBlockOffset {
  x: number;
  y: number;
}

/**
 * How the invoice is drawn. Template 0 is the studio paper below; 1-13 are the Invoify templates
 * (templates/registry.ts). The language only changes the Invoify templates' printed labels and direction.
 * Manual arrangement is an extra option: when it is off every template is drawn exactly as designed, and the moved
 * positions stay saved per template ("t0" ... "t13") in sheet pixels for when it is turned back on.
 */
export interface InvoiceDesign {
  templateId: number;
  language: "en" | "ar";
  manualLayout: boolean;
  offsets: Record<string, Record<string, InvoiceBlockOffset>>;
}

export const STUDIO_TEMPLATE_ID = 0;

export const defaultInvoiceDesign: InvoiceDesign = {
  templateId: STUDIO_TEMPLATE_ID,
  language: "en",
  manualLayout: false,
  offsets: {},
};

export function invoiceDesignKey(templateId: number) {
  return `t${templateId}`;
}

/** The moved positions in force for the chosen template, or undefined when manual arrangement is off. */
export function getActiveOffsets(design: InvoiceDesign) {
  return design.manualLayout ? (design.offsets[invoiceDesignKey(design.templateId)] ?? {}) : undefined;
}

/** Reads a saved design back. A draft saved before templates existed, or a bad value, gets the defaults. */
export function readInvoiceDesign(value: unknown): InvoiceDesign {
  const saved = (value ?? {}) as Partial<InvoiceDesign>;
  const templateId = Number.isInteger(saved.templateId) ? Number(saved.templateId) : STUDIO_TEMPLATE_ID;
  const offsets: InvoiceDesign["offsets"] = {};

  if (saved.offsets && typeof saved.offsets === "object") {
    for (const [key, blocks] of Object.entries(saved.offsets)) {
      if (!blocks || typeof blocks !== "object") continue;
      offsets[key] = {};
      for (const [id, offset] of Object.entries(blocks)) {
        if (Number.isFinite(offset?.x) && Number.isFinite(offset?.y)) offsets[key][id] = { x: offset.x, y: offset.y };
      }
    }
  }

  return {
    templateId: templateId >= 0 && templateId <= 13 ? templateId : STUDIO_TEMPLATE_ID,
    language: saved.language === "ar" ? "ar" : "en",
    manualLayout: saved.manualLayout === true,
    offsets,
  };
}

export interface InvoiceFormValues {
  design: InvoiceDesign;
  referenceNumber: string;
  issuedDate: string;
  paymentDueDate: string;
  from: InvoiceFromDetails;
  to: InvoiceToDetails;
  taxId: string;
  discountType: InvoiceDiscountType;
  discountValue: number;
  items: InvoiceLineItem[];
  /** M129-D: logo uploaded by clicking the logo on the invoice (data URL); empty = the studio mark. */
  logo?: string;
  bigcapital?: InvoiceBigcapitalLink | null;
  currency?: InvoiceCurrency;
  /** F-5B: Bigcapital's active tax rates, loaded by the Bigcapital bar; the tax menu lists these and "No tax". */
  taxRates?: InvoiceTaxOption[];
}

const today = new Date();

/**
 * F-5B (condition 2): a new invoice starts clean. No sample business, payment account, client or items: the issuer
 * comes from the saved business details (Business tab -> Bigcapital's organization profile, see bigcapital-bar.tsx),
 * the currency from Bigcapital's base currency, and the tax from Bigcapital's tax rates.
 */
export const emptyInvoiceFrom: InvoiceFromDetails = {
  name: "",
  email: "",
  phone: "",
  website: "",
  addressLines: [],
  taxId: "",
  paymentAccountName: "",
  routingNumber: "",
  issuerName: "",
};

export const defaultInvoiceValues: InvoiceFormValues = {
  design: defaultInvoiceDesign,
  referenceNumber: "",
  issuedDate: format(today, "yyyy-MM-dd"),
  paymentDueDate: format(addDays(today, 14), "yyyy-MM-dd"),
  from: emptyInvoiceFrom,
  // M129-D: no made-up client; the client is chosen from Contacts (or added) and linked to Bigcapital.
  to: {
    id: "",
    name: "",
    email: "",
    addressLines: [],
    taxId: "",
  },
  /** "" until Bigcapital's tax rates load; then its 15% VAT (ZATCA standard rate) when it has one, else "No tax". */
  taxId: "",
  taxRates: [],
  currency: DEFAULT_INVOICE_CURRENCY,
  discountType: "fixed",
  discountValue: 0,
  items: [
    {
      id: "line-1",
      description: "",
      quantity: 1,
      unitPrice: 0,
    },
  ],
};

export const NO_TAX_OPTION: InvoiceTaxOption = { id: "none", name: "No tax", rate: 0 };

/** Official source for the Saudi VAT rate, shown next to the tax menu. */
export const ZATCA_VAT_SOURCE = {
  label: "ZATCA: VAT 15% since 1 July 2020",
  href: "https://zatca.gov.sa/en/MediaCenter/News/Pages/News-342.aspx",
};

/** The tax menu: Bigcapital's tax rates (kept in the draft as `taxRates`) and "No tax". */
export function getInvoiceTaxOptions(invoice: Pick<InvoiceFormValues, "taxRates">): InvoiceTaxOption[] {
  return [...(invoice.taxRates ?? []), NO_TAX_OPTION];
}

/** The tax line's words on the invoice: the rate's name, with the rate when the name does not already say it. */
export function taxLineLabel(option: InvoiceTaxOption) {
  if (!option.bigcapitalId) return option.name;
  return option.name.includes(`${option.rate}%`) ? option.name : `${option.name} ${option.rate}%`;
}

export function taxOptionLabel(option: InvoiceTaxOption) {
  return `${option.name}${taxOptionSuffix(option)}`;
}

/**
 * F-23 (round 2): three rates on the invoices server were made with codes "STUDIO-GST-18", "STUDIO-VAT-12" and
 * "STUDIO-SERVICETAX-10". A code cannot be changed there without deleting the rate (Bigcapital v0.15.43
 * EditTaxRate.service.ts editTaxRateOrCreate), so the "STUDIO-" prefix is left out where the code is shown.
 */
export const ownTaxCode = (code: string) => code.replace(/^STUDIO-/i, "");

/** " (15%) · VAT15" after a Bigcapital rate's name (the name is drawn in its own direction, it can be Arabic). */
export function taxOptionSuffix(option: InvoiceTaxOption) {
  return option.bigcapitalId ? ` (${option.rate}%)${option.code ? ` · ${ownTaxCode(option.code)}` : ""}` : "";
}

export function getLineAmount(item?: InvoiceLineItem) {
  if (!item) return 0;

  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;

  return quantity * unitPrice;
}

export function getInvoiceItems(invoice: InvoiceFormValues) {
  return invoice.items;
}

/** The items before the discount and tax (quantity x price, added up). */
export function getInvoiceSubtotal(invoice: InvoiceFormValues) {
  return getInvoiceItems(invoice).reduce((subtotal, item) => subtotal + getLineAmount(item), 0);
}

export function getInvoiceTaxOption(invoice: InvoiceFormValues) {
  return getInvoiceTaxOptions(invoice).find((taxOption) => taxOption.id === invoice.taxId) ?? NO_TAX_OPTION;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The discount as an amount (a percent is worked out on the items' total), rounded to cents, never above it. */
export function getInvoiceDiscount(invoice: InvoiceFormValues) {
  const subtotal = getInvoiceSubtotal(invoice);
  const discountValue = Number.isFinite(invoice.discountValue) ? invoice.discountValue : 0;
  const discount = invoice.discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;

  return round2(Math.min(Math.max(discount, 0), Math.max(subtotal, 0)));
}

/**
 * F-5B (condition 1): one calculation for the page, its PDF and Bigcapital. The discount is its own line (quantity 1,
 * negative price) taxed at the invoice's rate, and Bigcapital gets the very same line (lib/bigcapital/server.ts,
 * createInvoice). So:
 *   taxable amount = items - discount          (ZATCA E-Invoice XML Implementation Standard v1.2, section 9.6:
 *   tax            = taxable amount x rate      the VAT base is the line net amounts minus document allowances)
 *   total          = taxable amount + tax
 * and every printed line shows its total with its tax, as Bigcapital's PDF does (pdf-templates utils.ts:41), so the
 * line totals add up to the invoice total.
 */
export interface InvoicePrintedLine {
  key: string;
  /** "item:<index>" for an item, "discount" for the discount line (what clicking it edits). */
  edit: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** quantity x price, before tax (negative on the discount line). */
  net: number;
  tax: number;
  /** net + tax: the line's total with its tax. */
  total: number;
  discount: boolean;
}

export const INVOICE_DISCOUNT_LABEL = { en: "Discount", ar: "خصم" };

export function getInvoiceDiscountLabel(invoice: InvoiceFormValues) {
  const word = INVOICE_DISCOUNT_LABEL[invoice.design?.language === "ar" ? "ar" : "en"];
  const value = Number.isFinite(invoice.discountValue) ? invoice.discountValue : 0;
  return invoice.discountType === "percent" ? `${word} ${value}%` : word;
}

export function getInvoicePrintedLines(invoice: InvoiceFormValues): InvoicePrintedLine[] {
  const rate = getInvoiceTaxOption(invoice).rate / 100;
  const lines: InvoicePrintedLine[] = getInvoiceItems(invoice).map((item, index) => {
    const net = getLineAmount(item);
    return {
      key: item.id,
      edit: `item:${index}`,
      description: item.description,
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
      unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
      net,
      tax: net * rate,
      total: net + net * rate,
      discount: false,
    };
  });
  const discount = getInvoiceDiscount(invoice);
  if (discount > 0) {
    lines.push({
      key: "discount",
      edit: "discount",
      description: getInvoiceDiscountLabel(invoice),
      quantity: 1,
      unitPrice: -discount,
      net: -discount,
      tax: -discount * rate,
      total: -discount - discount * rate,
      discount: true,
    });
  }
  return lines;
}

/** Items minus the discount: the amount the tax is charged on (Bigcapital prints it as "Subtotal"). */
export function getInvoiceTaxableAmount(invoice: InvoiceFormValues) {
  return getInvoiceSubtotal(invoice) - getInvoiceDiscount(invoice);
}

export function getInvoiceTax(invoice: InvoiceFormValues) {
  return getInvoiceTaxableAmount(invoice) * (getInvoiceTaxOption(invoice).rate / 100);
}

export function getInvoiceTotal(invoice: InvoiceFormValues) {
  return getInvoiceTaxableAmount(invoice) + getInvoiceTax(invoice);
}

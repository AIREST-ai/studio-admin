"use client";

// M129-D (Fahad 129.4): browser side of the invoice page's link to Bigcapital. The browser only talks to this
// preview's own routes (/api/invoice-bigcapital/*); those call Bigcapital from the Next.js server with the API key.

import * as React from "react";

import type { InvoiceFormValues, InvoiceFromDetails } from "./data";
import { getInvoiceDiscount, getInvoiceDiscountLabel, getInvoiceTaxOption } from "./data";

/**
 * The Bigcapital web app (v0.15.43, local install) answers on port 3490 of this Mac: 127.0.0.1 (colima tunnel) and,
 * for Fahad's devices, the Tailscale address 100.73.3.21 (LaunchAgent com.fahad.bigcapital-tailscale). The links use
 * the host this page was opened from, so they work from the Mac and from a Tailscale device alike.
 */
export const BIGCAPITAL_PORT = 3490;
const SERVER_BASE = `http://127.0.0.1:${BIGCAPITAL_PORT}`;

export function bigcapitalLinksFor(base: string) {
  return {
    base,
    host: base.replace(/^https?:\/\//, ""),
    invoices: `${base}/invoices`,
    invoice: (id: number) => `${base}/invoices/${id}/edit`,
    customers: `${base}/customers`,
    newPayment: `${base}/payments-received/new`,
    payments: `${base}/payments-received`,
    branding: `${base}/preferences/branding`,
    taxRates: `${base}/tax-rates`,
    /** F-5B: Bigcapital's organization profile (name, address, tax number printed on its PDFs). */
    organization: `${base}/preferences/general`,
    /** The Bigcapital UI in Arabic (right to left): its language comes from ?lang= (AppIntlLoader.tsx). */
    arabic: `${base}/?lang=ar`,
  };
}

const noSubscribe = () => () => {};

/** Bigcapital links on the host of the current page (server render: 127.0.0.1, replaced right after hydration). */
export function useBigcapitalLinks() {
  const base = React.useSyncExternalStore(
    noSubscribe,
    () =>
      `http://${window.location.hostname.includes(":") ? `[${window.location.hostname}]` : window.location.hostname}:${BIGCAPITAL_PORT}`,
    () => SERVER_BASE,
  );
  return React.useMemo(() => bigcapitalLinksFor(base), [base]);
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

export interface InvoiceMail {
  to: string[];
  subject: string;
  message: string;
  attachInvoice: boolean;
}

export interface ClientInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  country?: string;
  city?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/invoice-bigcapital${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

export const listBigcapitalCustomers = () =>
  call<{ customers: BigcapitalCustomer[] }>("/customers").then((r) => r.customers);

/** The Bigcapital customer for a contact (same email), created through the API when it is missing. */
export const ensureBigcapitalCustomer = (contact: ClientInput) =>
  call<{ customer: BigcapitalCustomer; created: boolean }>("/customers", {
    method: "POST",
    body: JSON.stringify({ mode: "ensure", contact }),
  });

export const createBigcapitalCustomer = (contact: ClientInput) =>
  call<{ customer: BigcapitalCustomer; created: boolean }>("/customers", {
    method: "POST",
    body: JSON.stringify({ mode: "create", contact }),
  });

/**
 * F-5B: the invoice as Bigcapital gets it. Tax = the chosen Bigcapital tax rate (nothing is created for it). Discount =
 * an amount and the words of its line (the server adds it as its own taxed line, like the page). Issuer = the Business
 * tab, written to Bigcapital's organization profile first (its PDF prints that as the seller).
 */
export function createBigcapitalInvoice(invoice: InvoiceFormValues) {
  const tax = getInvoiceTaxOption(invoice);
  const discount = getInvoiceDiscount(invoice);
  return call<{ invoice: BigcapitalInvoice; createdItems: string[]; organizationChanged: string[] }>("/invoices", {
    method: "POST",
    body: JSON.stringify({
      customerId: invoice.to.bigcapitalCustomerId,
      referenceNumber: invoice.referenceNumber,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.paymentDueDate,
      language: invoice.design.language,
      taxRateId: tax.bigcapitalId ?? null,
      discount: discount > 0 ? { amount: discount, label: getInvoiceDiscountLabel(invoice) } : null,
      issuer: {
        name: invoice.from.name,
        addressLines: invoice.from.addressLines,
        phone: invoice.from.phone,
        taxNumber: invoice.from.taxId,
      },
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
        unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
      })),
    }),
  });
}

/** F-7: one page of the invoices Bigcapital holds, newest first (the Invoices list), read by the Next.js server. */
export const listBigcapitalInvoices = (page: number, pageSize: number) =>
  call<{ invoices: BigcapitalInvoice[]; page: number; pageSize: number; total: number }>(
    `/invoices?page=${page}&pageSize=${pageSize}`,
  );

/** F-5B: deletes the invoice in Bigcapital. Bigcapital's refusal (payments, credit notes) comes back as the error. */
export const deleteBigcapitalInvoice = (id: number) =>
  call<{ deleted: true; invoice: BigcapitalInvoice }>(`/invoices/${id}`, { method: "DELETE" });

/** F-5B: deletes the Bigcapital customer (refused while it has invoices or other transactions). */
export const deleteBigcapitalCustomer = (id: number) =>
  call<{ deleted: true; customer: { id: number; name: string } }>(`/customers/${id}`, { method: "DELETE" });

/** F-5B: catalogue item names in Bigcapital, to say which invoice lines would become new items. */
export const listBigcapitalItemNames = () => call<{ items: string[]; discountItem: string }>("/items");

export interface BigcapitalOrganization {
  name: string;
  addressLines: string[];
  phone: string;
  taxNumber: string;
  location: string;
}

export interface SavedBusiness {
  organization: BigcapitalOrganization;
  extra: {
    email: string;
    website: string;
    issuerName: string;
    paymentAccountName: string;
    routingNumber: string;
    savedAt: string | null;
  };
}

/** F-5B: the saved issuer every new invoice starts from (Bigcapital's organization profile + a few local fields). */
export const getSavedBusiness = () => call<{ business: SavedBusiness }>("/business").then((r) => r.business);

export const saveBusiness = (from: InvoiceFromDetails) =>
  call<{ business: SavedBusiness; changed: string[] }>("/business", {
    method: "PUT",
    body: JSON.stringify({
      name: from.name,
      addressLines: from.addressLines,
      phone: from.phone,
      taxId: from.taxId,
      email: from.email,
      website: from.website,
      issuerName: from.issuerName,
      paymentAccountName: from.paymentAccountName,
      routingNumber: from.routingNumber,
    }),
  });

/** The invoice issuer ("from") a saved business gives. */
export function fromSavedBusiness(business: SavedBusiness): InvoiceFromDetails {
  return {
    name: business.organization.name,
    addressLines: business.organization.addressLines,
    phone: business.organization.phone,
    taxId: business.organization.taxNumber,
    email: business.extra.email,
    website: business.extra.website,
    issuerName: business.extra.issuerName,
    paymentAccountName: business.extra.paymentAccountName,
    routingNumber: business.extra.routingNumber,
  };
}

export const sendBigcapitalInvoice = (id: number) =>
  call<{ invoice: BigcapitalInvoice; mail: InvoiceMail; emailSimulated: true; note: string }>(`/invoices/${id}/send`, {
    method: "POST",
  });

export const getBigcapitalInvoice = (id: number) =>
  call<{
    invoice: BigcapitalInvoice;
    payments: Array<{ id: number; payment_amount_formatted?: string; date?: string }>;
  }>(`/invoices/${id}`);

// F-16: the same PDF under /api/invoices (app/api/invoices/[id]/pdf/route.ts), so the link names no other system.
export const bigcapitalPdfUrl = (id: number) => `/api/invoices/${id}/pdf`;

export const STATUS_LABELS: Record<BigcapitalInvoice["status"], string> = {
  draft: "Draft",
  delivered: "Delivered",
  overdue: "Overdue",
  "partially-paid": "Partially paid",
  paid: "Paid",
};

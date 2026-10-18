import { NextResponse } from "next/server";

import { BIGCAPITAL_URL, baseCurrency, listInvoices, listTaxRates } from "@/lib/bigcapital/server";

import { failFrom, headers } from "./shared";

// M129-D: is the local Bigcapital answering, its latest invoices and base currency. GET -> { connected, invoices, currency }.
// F-5B: plus its active tax rates (the invoice page's tax menu), { taxRates }.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [invoices, currency, taxRates] = await Promise.all([listInvoices(), baseCurrency(), listTaxRates()]);
    return NextResponse.json({ connected: true, server: BIGCAPITAL_URL, invoices, currency, taxRates }, { headers });
  } catch (error) {
    return failFrom(error);
  }
}

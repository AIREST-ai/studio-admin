"use client";

import * as React from "react";

import { useFormContext } from "react-hook-form";

import { Badge } from "@/components/ui/badge";

import { type BigcapitalInvoice, fromSavedBusiness, getSavedBusiness } from "./bigcapital-client";
import type { InvoiceCurrency, InvoiceFormValues, InvoiceTaxOption } from "./data";

/**
 * M129-D (condition 4): what this page does not manage is managed in Bigcapital itself. One line under the title:
 * whether the preview server reaches Bigcapital, and plain links to its pages (on the host this page was opened from).
 * Round 2: it also takes Bigcapital's base currency, so the preview prints the same currency as Bigcapital.
 * F-5B: and Bigcapital's tax rates (the tax menu; a new invoice gets the 15% rate when Bigcapital has one), and the
 * saved business details for an invoice that has no issuer yet (a new invoice starts from them, condition 2).
 * F-16 (Fahad 15 Oct 15:05): no links out to Bigcapital's own web app (it asks for its own sign-in) and no
 * "Bigcapital" in the text: the bar names the invoices server and whether it answers, nothing more.
 */
/** Q1 (F-21 follow-up): sent with the invoices count when the lists were read again after a change; the bar follows. */
export const INVOICES_REREAD_EVENT = "studio-admin:invoices-reread";

const LATEST_PAGE = 10;
const countText = (count: number) => (count ? `${count} latest invoices` : "no invoices yet");

export function BigcapitalBar() {
  const { getValues, setValue } = useFormContext<InvoiceFormValues>();
  const [state, setState] = React.useState<{ ok: boolean; text: string } | null>(null);
  // the latest read wins (the first read and a re-read may answer out of order)
  const request = React.useRef(0);

  React.useEffect(() => {
    const mine = ++request.current;
    fetch("/api/invoice-bigcapital", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          invoices?: BigcapitalInvoice[];
          currency?: InvoiceCurrency | null;
          taxRates?: Array<{ id: number; name: string; code: string; rate: number }>;
          error?: string;
        } | null;
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        const currency = body?.currency;
        const current = getValues("currency");
        if (currency && (current?.code !== currency.code || current?.sign !== currency.sign)) {
          setValue("currency", currency);
        }
        const taxRates: InvoiceTaxOption[] = (body?.taxRates ?? []).map((rate) => ({
          id: `bc-${rate.id}`,
          name: rate.name,
          rate: rate.rate,
          code: rate.code,
          bigcapitalId: rate.id,
        }));
        setValue("taxRates", taxRates);
        const taxId = getValues("taxId");
        if (!taxId || (taxId !== "none" && !taxRates.some((rate) => rate.id === taxId))) {
          // Saudi VAT is 15% (ZATCA, data.ts ZATCA_VAT_SOURCE): picked when Bigcapital has a 15% rate, else "No tax".
          setValue("taxId", taxRates.find((rate) => rate.rate === 15)?.id ?? "none");
        }
        if (mine === request.current) setState({ ok: true, text: countText(body?.invoices?.length ?? 0) });
      })
      .catch((error: Error) => {
        if (mine === request.current) setState({ ok: false, text: error.message });
      });
    // A new invoice (no issuer yet) starts from the saved business details.
    if (!getValues("from.name")) {
      getSavedBusiness()
        .then((business) => {
          if (!getValues("from.name")) setValue("from", fromSavedBusiness(business));
        })
        .catch(() => undefined);
    }
  }, [getValues, setValue]);

  // Q1: an invoice created or deleted on the page changes the count without a page reload. The count comes with the
  // event from the lists the page has just read again (no second request: the invoices server limits bursts).
  React.useEffect(() => {
    function recount(event: Event) {
      const total = (event as CustomEvent<number>).detail;
      if (typeof total !== "number") return;
      ++request.current; // an earlier read still on its way no longer counts
      // the bar's own read is the latest page of 10 (listInvoices, page_size=10), so the same number is min(total, 10)
      setState({ ok: true, text: countText(Math.min(total, LATEST_PAGE)) });
    }
    window.addEventListener(INVOICES_REREAD_EVENT, recount);
    return () => window.removeEventListener(INVOICES_REREAD_EVENT, recount);
  }, []);

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs"
      data-testid="invoices-server-bar"
    >
      <span className="flex items-center gap-1.5 font-medium">
        Invoices server
        <Badge variant={state?.ok === false ? "destructive" : "secondary"} className="h-4 px-1.5 text-[10px]">
          {state === null ? "Checking…" : state.ok ? "Connected" : "Not reachable"}
        </Badge>
      </span>
      <span className="text-muted-foreground">
        {state?.ok === false
          ? state.text
          : `This page reads and saves its invoices on the invoices server${state?.ok ? ` (${state.text})` : ""}.`}
      </span>
    </div>
  );
}

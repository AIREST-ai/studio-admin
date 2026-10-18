"use client";

import * as React from "react";

import { FilePlus2, Save, Send } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { InvoicesSystem, isSystemTab, type SystemTab } from "../_system/invoices-system";
import { BigcapitalBar } from "./bigcapital-bar";
import { defaultInvoiceValues, type InvoiceFormValues, readInvoiceDesign } from "./data";
import { InvoiceForm } from "./invoice-form";
import { InvoicePreview } from "./invoice-preview";
import { SendInvoiceSheet } from "./send-invoice-sheet";

/** Demo save: there is no invoice backend yet, so the draft is kept in this browser's localStorage. */
const INVOICE_DRAFT_KEY = "studio-admin:invoice-draft";

function readInvoiceDraft(): InvoiceFormValues | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(INVOICE_DRAFT_KEY) ?? "null");
    const values = saved?.values;

    if (!values || typeof values.referenceNumber !== "string" || !Array.isArray(values.items)) return null;

    return {
      ...defaultInvoiceValues,
      ...values,
      design: readInvoiceDesign(values.design),
      from: { ...defaultInvoiceValues.from, ...values.from },
      to: { ...defaultInvoiceValues.to, ...values.to },
    };
  } catch {
    return null;
  }
}

export function Invoice() {
  const form = useForm<InvoiceFormValues>({
    defaultValues: defaultInvoiceValues,
  });
  const invoice = useWatch({ control: form.control }) as InvoiceFormValues;
  const [fieldsKey, setFieldsKey] = React.useState(0);
  const [sendOpen, setSendOpen] = React.useState(false);
  // F-18a: the page opens on the invoicing system (its lists, statuses and totals); the editor is the "New invoice"
  // tab. The tab is kept in the address (?tab=new …) so a reload or a shared link opens the same section.
  const [tab, setTabState] = React.useState<SystemTab>("invoices");

  React.useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("tab");
    if (isSystemTab(asked)) setTabState(asked);
  }, []);

  function setTab(next: SystemTab) {
    setTabState(next);
    try {
      const url = new URL(window.location.href);
      if (next === "invoices") url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // the address is a convenience; the tab works without it
    }
  }

  React.useEffect(() => {
    const draft = readInvoiceDraft();

    if (!draft) return;
    form.reset(draft);
    // reset() empties react-hook-form's field registry, and the React Compiler keeps the inputs from re-rendering to
    // register again, so edits after a restore were ignored. Remounting the fields registers them with the draft.
    setFieldsKey((key) => key + 1);
  }, [form]);

  function handleSaveDraft() {
    const values = form.getValues();

    try {
      window.localStorage.setItem(
        INVOICE_DRAFT_KEY,
        JSON.stringify({ version: 1, savedAt: new Date().toISOString(), values }),
      );
      toast.success(`Draft ${values.referenceNumber || "(no reference)"} saved in this browser`);
    } catch {
      toast.error("Could not save the draft in this browser");
    }
  }

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-medium text-3xl leading-none tracking-tight">Invoices</h1>
            <p className="text-muted-foreground text-sm">
              Invoices, estimates, payments, customers and products, read live from the invoices server.
            </p>
          </div>

          {tab === "new" ? null : (
            <Button type="button" onClick={() => setTab("new")} data-testid="header-new-invoice">
              <FilePlus2 data-icon="inline-start" />
              New invoice
            </Button>
          )}
        </div>

        <BigcapitalBar />

        <InvoicesSystem tab={tab} onTabChange={setTab}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-medium text-2xl leading-none tracking-tight">Create New Invoice</h2>
                <p className="text-muted-foreground text-sm">
                  Add invoice details, review the preview, and send it to your client.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={handleSaveDraft}>
                  <Save data-icon="inline-start" />
                  Save as Draft
                </Button>
                <Button type="button" onClick={() => setSendOpen(true)}>
                  <Send data-icon="inline-start" />
                  Send Invoice
                </Button>
              </div>
            </div>

            <SendInvoiceSheet open={sendOpen} onOpenChange={setSendOpen} />

            <form className="grid gap-5 xl:grid-cols-2" noValidate onSubmit={(event) => event.preventDefault()}>
              <InvoiceForm key={fieldsKey} />
              <InvoicePreview invoice={invoice} />
            </form>
          </div>
        </InvoicesSystem>
      </div>
    </FormProvider>
  );
}

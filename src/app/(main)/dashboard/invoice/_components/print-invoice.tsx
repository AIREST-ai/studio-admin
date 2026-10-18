"use client";

import * as React from "react";

import { createPortal } from "react-dom";

import { type InvoiceFormValues, STUDIO_TEMPLATE_ID } from "./data";
import { InvoicePaper } from "./invoice-paper";
import { InvoiceTemplateSheet } from "./invoice-template-sheet";
import type { ManualArrangement } from "./templates/types";

/**
 * The global print rules hold the page to one Letter sheet, sized for the studio paper. A template can run onto more
 * pages (long item lists), so while one is printed the page is let to grow. Only rendered with a template.
 */
const TEMPLATE_PRINT_CSS = `@media print {
  html, body, [data-print-root] { height: auto !important; overflow: visible !important; }
}`;

export function PrintInvoice({
  invoice,
  arrangement,
}: {
  invoice: InvoiceFormValues;
  arrangement?: ManualArrangement;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div data-print-root>
      {invoice.design.templateId === STUDIO_TEMPLATE_ID ? (
        <InvoicePaper invoice={invoice} arrangement={arrangement} />
      ) : (
        <>
          <style>{TEMPLATE_PRINT_CSS}</style>
          <InvoiceTemplateSheet invoice={invoice} arrangement={arrangement} />
        </>
      )}
    </div>,
    document.body,
  );
}

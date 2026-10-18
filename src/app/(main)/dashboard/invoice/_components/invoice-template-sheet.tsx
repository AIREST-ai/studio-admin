"use client";

import * as React from "react";

import {
  getInvoicePrintedLines,
  getInvoiceTax,
  getInvoiceTaxableAmount,
  getInvoiceTotal,
  INVOICE_PAPER_HEIGHT,
  INVOICE_PAPER_WIDTH,
  type InvoiceFormValues,
} from "./data";
import { INVOICE_LABELS } from "./templates/invoice-labels";
import { getTemplateEntry, TEMPLATES } from "./templates/registry";
import type { InvoiceType, ManualArrangement } from "./templates/types";

/** The studio paper's mark (invoice-paper.tsx), as an image the templates can place as the logo. */
const STUDIO_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="#0a0a0a"><rect width="20" height="20" rx="3"/><rect x="28" width="20" height="20" rx="3"/><rect y="28" width="20" height="20" rx="3"/><rect x="28" y="28" width="20" height="20" rx="3"/></svg>',
)}`;

/** Studio fields the Invoify parties have no slot for, worded per document language. */
const EXTRA_LABELS = {
  en: { taxId: "Tax ID", issuedBy: "Issued by" },
  ar: { taxId: "الرقم الضريبي", issuedBy: "صادرة عن" },
};

/** "yyyy-MM-dd" read as a local date, so the printed day does not shift with the time zone. */
function localDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
}

function splitAddress(lines: string[]) {
  return { address: lines[0] ?? "", zipCode: "", city: lines[1] ?? "", country: lines.slice(2).join(", ") };
}

/** Maps the studio draft onto the invoice shape the Invoify templates read. */
export function toTemplateInvoice(invoice: InvoiceFormValues): InvoiceType {
  const language = invoice.design.language;
  const extra = EXTRA_LABELS[language];
  const notes = [invoice.from.website, `${extra.issuedBy} ${invoice.from.issuerName}`].filter(Boolean).join("\n");

  return {
    sender: {
      name: invoice.from.name,
      ...splitAddress(invoice.from.addressLines),
      email: invoice.from.email,
      phone: invoice.from.phone,
      customInputs: invoice.from.taxId ? [{ key: extra.taxId, value: invoice.from.taxId }] : [],
    },
    receiver: {
      name: invoice.to.name,
      ...splitAddress(invoice.to.addressLines),
      email: invoice.to.email,
      phone: "",
      customInputs: invoice.to.taxId ? [{ key: extra.taxId, value: invoice.to.taxId }] : [],
    },
    details: {
      // M129-D: the logo uploaded by clicking the logo on the invoice, else the studio mark.
      invoiceLogo: invoice.logo || STUDIO_LOGO,
      invoiceNumber: invoice.referenceNumber,
      invoiceDate: localDate(invoice.issuedDate),
      dueDate: localDate(invoice.paymentDueDate),
      // Round 2: Bigcapital's currency (templates print the ISO code).
      currency: invoice.currency?.code ?? "SAR",
      // F-5B: the same lines as the studio paper and Bigcapital: the items, then the discount as its own line. These
      // templates print quantity x price per line, so the lines add up to the subtotal and the tax is shown as an amount.
      items: getInvoicePrintedLines(invoice).map((line) => ({
        name: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.net,
      })),
      paymentInformation: { bankName: invoice.from.paymentAccountName, accountName: "", accountNumber: "" },
      taxDetails: { amount: getInvoiceTax(invoice), amountType: "amount" },
      discountDetails: { amount: 0, amountType: "amount" },
      subTotal: getInvoiceTaxableAmount(invoice),
      totalAmount: getInvoiceTotal(invoice),
      additionalNotes: notes,
      pdfTemplate: invoice.design.templateId,
    },
  };
}

let fontsRequested = false;

/** Adds the templates' embedded faces (templates/fonts.ts) to the page once, the first time a template is shown. */
function useTemplateFonts() {
  React.useEffect(() => {
    if (fontsRequested) return;
    fontsRequested = true;
    import("./templates/fonts")
      .then(({ TEMPLATE_FONT_FACES }) => {
        const style = document.createElement("style");
        style.dataset.invoiceTemplateFonts = "";
        style.textContent = TEMPLATE_FONT_FACES;
        document.head.append(style);
      })
      .catch(() => {
        fontsRequested = false;
      });
  }, []);
}

/** One of the 13 Invoify templates, drawn from the studio draft at the studio paper's width. */
export function InvoiceTemplateSheet({
  invoice,
  arrangement,
  sheetRef,
}: {
  invoice: InvoiceFormValues;
  arrangement?: ManualArrangement;
  sheetRef?: React.Ref<HTMLDivElement>;
}) {
  useTemplateFonts();

  const entry = getTemplateEntry(invoice.design.templateId) ?? TEMPLATES[0];
  const Template = entry.component;
  const language = invoice.design.language;

  return (
    <div
      ref={sheetRef}
      data-invoice-template={entry.id}
      style={{
        width: INVOICE_PAPER_WIDTH,
        minHeight: INVOICE_PAPER_HEIGHT,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
      className="relative bg-white"
    >
      <Template
        {...toTemplateInvoice(invoice)}
        labels={INVOICE_LABELS[language]}
        locale={language}
        arrangement={arrangement}
      />
    </div>
  );
}

import {
  formatInvoiceMoney,
  getInvoicePrintedLines,
  getInvoiceTax,
  getInvoiceTaxableAmount,
  getInvoiceTaxOption,
  getInvoiceTotal,
  INVOICE_PAPER_HEIGHT,
  INVOICE_PAPER_WIDTH,
  type InvoiceFormValues,
  taxLineLabel,
} from "./data";
import type { ManualArrangement } from "./templates/types";

/** M129-D: the studio paper's own words in the two document languages (Arabic from Invoify's ar.json where it has them). */
const STUDIO_LABELS = {
  en: {
    title: "Invoice",
    reference: "Reference",
    issued: "Issued",
    paymentDue: "Payment due",
    paymentAccount: "Payment account",
    routing: "Routing no.",
    from: "From",
    billTo: "Bill to",
    taxId: "Tax ID",
    description: "Description",
    units: "Units",
    unitCost: "Unit cost",
    // F-5B: each line shows its total with its tax, the way Bigcapital's PDF prints it.
    lineTotal: "Total incl. tax",
    net: "Subtotal",
    balanceDue: "Balance due",
    prepared: "Prepared for prompt processing.",
    issuedBy: "Issued by",
    noClient: "Choose a client",
  },
  ar: {
    title: "فاتورة",
    reference: "المرجع",
    issued: "تاريخ الإصدار",
    paymentDue: "تاريخ الاستحقاق",
    paymentAccount: "حساب الدفع",
    routing: "رقم التوجيه",
    from: "من",
    billTo: "إلى",
    taxId: "الرقم الضريبي",
    description: "الوصف",
    units: "الكمية",
    unitCost: "سعر الوحدة",
    lineTotal: "الإجمالي شامل الضريبة",
    net: "المجموع قبل الضريبة",
    balanceDue: "المبلغ المستحق",
    prepared: "أُعدّت للمعالجة السريعة.",
    issuedBy: "صادرة عن",
    noClient: "اختر العميل",
  },
};

const TOTAL_INFO = "info:Calculated from the items, discount and tax. Edit those to change it.";
const LINE_TOTAL_INFO =
  "info:Line total with its tax, as the invoices server prints it. The discount is its own line, so the lines add up to the total.";

/**
 * Props that make one block of the paper movable when manual arrangement is on: the id the preview drags by, and the
 * saved offset as a translate (it also works on the absolutely placed footer). Nothing changes when it is off.
 */
function movable(arrangement: ManualArrangement | undefined, id: string) {
  if (!arrangement) return {};

  const offset = arrangement.offsets?.[id];

  return {
    "data-move-id": id,
    "data-move-selected": arrangement.selected === id ? "" : undefined,
    tabIndex: arrangement.interactive ? 0 : undefined,
    style: offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined,
  };
}

export function InvoicePaper({
  invoice,
  arrangement,
}: {
  invoice: InvoiceFormValues;
  arrangement?: ManualArrangement;
}) {
  const taxOption = getInvoiceTaxOption(invoice);
  const language = invoice.design.language === "ar" ? "ar" : "en";
  const t = STUDIO_LABELS[language];
  // Round 2: amounts in Bigcapital's currency and format ("SR6,008.00").
  const money = (value: number) => formatInvoiceMoney(value, invoice.currency);
  // F-5B: the same lines Bigcapital gets (items, then the discount as its own taxed line).
  const lines = getInvoicePrintedLines(invoice);

  return (
    <article
      style={{ width: INVOICE_PAPER_WIDTH, height: INVOICE_PAPER_HEIGHT }}
      data-print-paper
      dir={language === "ar" ? "rtl" : "ltr"}
      lang={language}
      className="relative flex flex-col gap-24 bg-neutral-50 px-12.25 py-11 font-mono text-neutral-950 rtl:text-right"
    >
      <header className="flex flex-col gap-10">
        <div {...movable(arrangement, "brand")} className="grid grid-cols-2 items-start gap-14">
          <span data-edit="logo" className="block w-fit">
            {invoice.logo ? (
              // biome-ignore lint/performance/noImgElement: a data URL uploaded by the user, drawn at its own size
              <img src={invoice.logo} alt="Logo" className="max-h-16 max-w-48 object-contain" />
            ) : (
              <svg className="size-12" viewBox="0 0 48 48" aria-hidden="true">
                <rect width="20" height="20" rx="3" fill="currentColor" />
                <rect x="28" width="20" height="20" rx="3" fill="currentColor" />
                <rect y="28" width="20" height="20" rx="3" fill="currentColor" />
                <rect x="28" y="28" width="20" height="20" rx="3" fill="currentColor" />
              </svg>
            )}
          </span>
          <h2
            className="text-4xl uppercase tracking-widest"
            data-edit="info:The title follows the document language. Change it with Document language above."
          >
            {t.title}
          </h2>
        </div>

        <section {...movable(arrangement, "reference")} className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <div>
            <p data-edit="referenceNumber">
              {t.reference}: <bdi>{invoice.referenceNumber}</bdi>
            </p>
            <p data-edit="issuedDate">
              {t.issued}: <bdi>{invoice.issuedDate}</bdi>
            </p>
            <p data-edit="paymentDueDate">
              {t.paymentDue}: <bdi>{invoice.paymentDueDate}</bdi>
            </p>
          </div>
          <div data-edit="from.paymentAccountName,from.routingNumber">
            <p>{t.paymentAccount}</p>
            <p>
              <bdi>{invoice.from.paymentAccountName}</bdi>
            </p>
            <p>
              {t.routing} <bdi>{invoice.from.routingNumber}</bdi>
            </p>
          </div>
        </section>

        <section {...movable(arrangement, "parties")} className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <div>
            <p className="mb-4 font-semibold uppercase">{t.from}</p>
            <p data-edit="from.name">
              <bdi>{invoice.from.name}</bdi>
            </p>
            <div data-edit="from.addressLines">
              {invoice.from.addressLines.map((line) => (
                <p key={line}>
                  <bdi>{line}</bdi>
                </p>
              ))}
            </div>
            <p data-edit="from.taxId">
              {t.taxId}: <bdi>{invoice.from.taxId}</bdi>
            </p>
          </div>
          <div>
            <p className="mb-4 font-semibold uppercase">{t.billTo}</p>
            <p data-edit="to.name,to.email">
              {invoice.to.name ? <bdi>{invoice.to.name}</bdi> : <span className="text-neutral-400">{t.noClient}</span>}
            </p>
            <div data-edit="to.addressLines">
              {invoice.to.addressLines.map((line) => (
                <p key={line}>
                  <bdi>{line}</bdi>
                </p>
              ))}
            </div>
            {invoice.to.taxId ? (
              <p data-edit="to.taxId">
                {t.taxId}: <bdi>{invoice.to.taxId}</bdi>
              </p>
            ) : null}
          </div>
        </section>
      </header>

      <div className="flex flex-col gap-5">
        <section {...movable(arrangement, "items")} className="text-sm">
          <div className="grid grid-cols-[1fr_64px_116px_150px] bg-stone-200 px-3 py-3 font-semibold uppercase">
            <span>{t.description}</span>
            <span className="text-end">{t.units}</span>
            <span className="text-end">{t.unitCost}</span>
            <span className="text-end" data-edit={LINE_TOTAL_INFO}>
              {t.lineTotal}
            </span>
          </div>
          {lines.map((line) => (
            <div
              key={line.key}
              data-edit={line.edit}
              data-invoice-line={line.discount ? "discount" : "item"}
              className="grid grid-cols-[1fr_64px_116px_150px] border-[oklch(0.86_0_0)] border-b px-3 py-4"
            >
              <span>
                <bdi>{line.description}</bdi>
              </span>
              <span className="text-end">{line.quantity}</span>
              <span className="text-end">{money(line.unitPrice)}</span>
              <span className="text-end" data-line-total={line.total.toFixed(2)}>
                {money(line.total)}
              </span>
            </div>
          ))}
        </section>

        <div {...movable(arrangement, "totals")} className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <section className="col-start-2 space-y-2">
            <div>
              <div className="flex justify-between gap-8" data-edit={TOTAL_INFO} data-total="subtotal">
                <span>{t.net}</span>
                <span>{money(getInvoiceTaxableAmount(invoice))}</span>
              </div>
              <div className="flex justify-between gap-8" data-edit="tax" data-total="tax">
                <span>
                  <bdi>{taxLineLabel(taxOption)}</bdi>
                </span>
                <span>{money(getInvoiceTax(invoice))}</span>
              </div>
            </div>
            <div className="border-current border-y-2 py-3" data-edit={TOTAL_INFO} data-total="total">
              <div className="flex justify-between gap-8">
                <span className="font-semibold uppercase">{t.balanceDue}</span>
                <span className="font-semibold">{money(getInvoiceTotal(invoice))}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer
        {...movable(arrangement, "footer")}
        className="absolute right-12.25 bottom-11 left-12.25 grid grid-cols-2 gap-14 text-neutral-500 text-sm leading-relaxed"
      >
        <div>
          <p data-edit="from.email">{invoice.from.email}</p>
          <p data-edit="from.phone">{invoice.from.phone}</p>
          <p data-edit="from.website">{invoice.from.website}</p>
        </div>
        <div>
          <p>{t.prepared}</p>
          <p data-edit="from.issuerName">
            {t.issuedBy} <bdi>{invoice.from.issuerName}</bdi>
          </p>
        </div>
      </footer>
    </article>
  );
}

/**
 * The strings the invoice document renders, copied from Invoify's `i18n/locales/en.json` and `ar.json`
 * (`invoiceDocument`, 25 keys each, 3859b3c). Passed to the templates as a prop, as in Invoify.
 */
export const INVOICE_LABELS = {
  en: {
    invoiceNumber: "Invoice #",
    from: "From",
    billTo: "Bill to",
    invoiceDate: "Invoice date",
    dueDate: "Due date",
    item: "Item",
    qty: "Qty",
    rate: "Rate",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    shipping: "Shipping",
    total: "Total",
    totalInWords: "Total in words",
    additionalNotes: "Additional notes",
    paymentTerms: "Payment terms",
    signature: "Signature",
    paymentInfoHeading: "Please send the payment to this address",
    bankName: "Bank",
    accountName: "Account name",
    accountNumber: "Account no",
    contactHeading: "If you have any questions concerning this invoice, use the following contact information:",
    logoAlt: "Logo of {name}",
    signatureAlt: "Signature of {name}",
  },
  ar: {
    invoiceNumber: "رقم الفاتورة",
    from: "من",
    billTo: "إلى",
    invoiceDate: "تاريخ الفاتورة",
    dueDate: "تاريخ الاستحقاق",
    item: "البند",
    qty: "الكمية",
    rate: "السعر",
    amount: "المبلغ",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    tax: "الضريبة",
    shipping: "الشحن",
    total: "الإجمالي",
    totalInWords: "الإجمالي كتابةً",
    additionalNotes: "ملاحظات إضافية",
    paymentTerms: "شروط الدفع",
    signature: "التوقيع",
    paymentInfoHeading: "يرجى إرسال الدفعة إلى البيانات التالية",
    bankName: "البنك",
    accountName: "اسم الحساب",
    accountNumber: "رقم الحساب",
    contactHeading: "لأي استفسار بخصوص هذه الفاتورة، يرجى استخدام بيانات التواصل التالية:",
    logoAlt: "شعار {name}",
    signatureAlt: "توقيع {name}",
  },
};

export type InvoiceDocumentLanguage = keyof typeof INVOICE_LABELS;

export type InvoiceLabels = (typeof INVOICE_LABELS)["en"];

export const DEFAULT_INVOICE_LABELS: InvoiceLabels = INVOICE_LABELS.en;

/** Props shared by every invoice template, beyond the invoice data itself. */
export type InvoiceTemplateExtras = {
  labels?: InvoiceLabels;
  /** BCP-47 locale for number and currency formatting inside the document. */
  locale?: string;
  /** Overrides the direction derived from `locale`. */
  dir?: "ltr" | "rtl";
  /** Presentation options. Optional and individually defaulted. */
  theme?: Partial<import("./invoice-theme").InvoiceTheme>;
  /** Studio addition: the optional manual arrangement. */
  arrangement?: import("./types").ManualArrangement;
};

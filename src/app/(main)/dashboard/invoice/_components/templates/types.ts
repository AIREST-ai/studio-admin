/**
 * The invoice shape the Invoify templates read (Invoify `types.ts` / `lib/schemas.ts` at 3859b3c), cut down to the
 * fields the 13 layouts and their parts use. invoice-template-sheet.tsx fills it from the studio draft.
 */
export interface InvoiceParty {
  name: string;
  address: string;
  zipCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  customInputs?: { key: string; value: string }[];
}

export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceType {
  sender: InvoiceParty;
  receiver: InvoiceParty;
  details: {
    theme?: Partial<import("./invoice-theme").InvoiceTheme>;
    invoiceLogo?: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    items: InvoiceItem[];
    paymentInformation?: { bankName: string; accountName: string; accountNumber: string };
    taxDetails?: { amount: number; amountType: string };
    discountDetails?: { amount: number; amountType: string };
    shippingDetails?: { cost: number; costType: string };
    subTotal: number;
    totalAmount: number;
    totalAmountInWords?: string;
    additionalNotes?: string;
    paymentTerms?: string;
    signature?: { data: string; fontFamily?: string };
    pdfTemplate: number;
  };
}

/** Offset of one moved block on the sheet, in sheet pixels. */
export interface BlockOffset {
  x: number;
  y: number;
}

/**
 * Studio addition (not in Invoify): optional manual arrangement. When `offsets` is set, the parts named in it are
 * shifted by that many sheet pixels; `selected` and `interactive` only exist in the on-screen preview.
 */
export interface ManualArrangement {
  offsets?: Record<string, BlockOffset>;
  interactive?: boolean;
  selected?: string | null;
}

// F-16 (Fahad 15 Oct 15:20): the invoice PDF under an address that does not name the system behind the page (a
// download link's address shows when the pointer is on it). The handler is the one of
// /api/invoice-bigcapital/invoices/[id]/pdf, unchanged.
export const dynamic = "force-dynamic";

export { GET } from "../../../invoice-bigcapital/invoices/[id]/pdf/route";

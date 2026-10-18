import { PRODUCT_NAME } from "@/config/app-config";

import {
  formatInvoiceMoney,
  getInvoicePrintedLines,
  getInvoiceTax,
  getInvoiceTaxableAmount,
  getInvoiceTaxOption,
  getInvoiceTotal,
  INVOICE_PAPER_HEIGHT,
  INVOICE_PAPER_WIDTH,
  type InvoiceCurrency,
  type InvoiceFormValues,
  taxLineLabel,
} from "./data";
import { hasArabicText, LATIN_CHAR_EM, layoutLine, type PdfGlyph } from "./invoice-pdf-arabic";
import { ARABIC_PDF_FONT } from "./invoice-pdf-font";

/**
 * Builds the invoice as a real PDF file in the browser, without a server or a PDF library.
 * The layout follows InvoicePaper: the paper is 816 x 1056 px (US Letter at 96 dpi), so 1 px = 0.75 pt.
 * Text uses the built-in Courier fonts (the paper is font-mono) with WinAnsi encoding. A line that holds Arabic is
 * shaped and put in bidi order (invoice-pdf-arabic.ts) and its Arabic glyphs use an embedded Noto Sans Arabic subset
 * whose ToUnicode map gives the copied text back. Other characters outside WinAnsi are written as "?". Long text
 * wraps, and long item lists continue on a new page.
 */

const PT = 0.75;
const PAGE_W = INVOICE_PAPER_WIDTH;
const PAGE_H = INVOICE_PAPER_HEIGHT;
const MARGIN_X = 49;
const MARGIN_Y = 44;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const COLUMN_GAP = 56;
const COLUMN_W = (CONTENT_W - COLUMN_GAP) / 2;
const COLUMN_2_X = MARGIN_X + COLUMN_W + COLUMN_GAP;
const TEXT_SIZE = 14;
const LINE = 22.75;
const ROW_LINE = 20;
const CHAR_W = LATIN_CHAR_EM;
const COLUMNS = { units: 74, unitCost: 116, lineTotal: 116 };
const CELL_PAD = 12;
const DESCRIPTION_W = CONTENT_W - CELL_PAD * 2 - COLUMNS.units - COLUMNS.unitCost - COLUMNS.lineTotal;
const FOOTER_TOP = PAGE_H - MARGIN_Y - LINE * 3;
const BODY_BOTTOM = FOOTER_TOP - 32;

const INK = "0.039 0.039 0.039";
const MUTED = "0.451 0.451 0.451";
const HEADER_FILL = "0.906 0.898 0.894";
const RULE = "0.831 0.831 0.831";

// Characters WinAnsi places in 0x80-0x9f (the rest of 0xa0-0xff matches Latin-1).
const WIN_ANSI_EXTRA = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x2026, 0x85],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x2122, 0x99],
]);

function winAnsiCode(code: number) {
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;

  return WIN_ANSI_EXTRA.get(code);
}

function toWinAnsi(value: string) {
  let out = "";

  for (const char of value.replace(/[\t\r\n]+/g, " ")) {
    const code = char.codePointAt(0) ?? 0x3f;
    const mapped = winAnsiCode(code);

    if (mapped === undefined) out += "?";
    else if (mapped === 0x28 || mapped === 0x29 || mapped === 0x5c) out += `\\${String.fromCharCode(mapped)}`;
    else if (mapped > 0x7e) out += `\\${mapped.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(mapped);
  }

  return out;
}

function isWinAnsi(code: number) {
  return winAnsiCode(code) !== undefined;
}

/** Width in px: Courier is 0.6 em per character; a line with Arabic is measured from its shaped glyphs. */
function textWidth(value: string, size = TEXT_SIZE) {
  return (hasArabicText(value) ? layoutLine(value, isWinAnsi).width : Array.from(value).length * CHAR_W) * size;
}

/** PDF text string: WinAnsi when it fits, else UTF-16BE with a byte order mark. */
function pdfString(value: string) {
  if (Array.from(value).every((char) => /[\t\r\n]/.test(char) || isWinAnsi(char.codePointAt(0) ?? 0))) {
    return `(${toWinAnsi(value)})`;
  }

  let hex = "FEFF";

  for (let index = 0; index < value.length; index++) hex += value.charCodeAt(index).toString(16).padStart(4, "0");

  return `<${hex.toUpperCase()}>`;
}

function wrap(value: string, width: number, size = TEXT_SIZE) {
  const fits = (text: string) => textWidth(text, size) <= width + 1e-6;
  const lines: string[] = [];
  let current = "";

  for (const word of value.replace(/\s+/g, " ").trim().split(" ")) {
    let rest = word;

    while (Array.from(rest).length > 1 && !fits(rest)) {
      if (current) {
        lines.push(current);
        current = "";
      }

      const chars = Array.from(rest);
      let take = 1;

      while (take < chars.length && fits(chars.slice(0, take + 1).join(""))) take++;
      lines.push(chars.slice(0, take).join(""));
      rest = chars.slice(take).join("");
    }

    if (!rest) continue;
    if (!current) current = rest;
    else if (fits(`${current} ${rest}`)) current += ` ${rest}`;
    else {
      lines.push(current);
      current = rest;
    }
  }

  if (current) lines.push(current);

  return lines.length ? lines : [""];
}

/** Round 2 (M129-D): the invoice's currency (Bigcapital's base currency), set when a PDF is built. */
let pdfCurrency: InvoiceCurrency | undefined;

function money(value: number) {
  return formatInvoiceMoney(value, pdfCurrency);
}

function num(value: number) {
  return (Math.round(value * 100) / 100).toString();
}

class PdfPage {
  ops: string[] = [];
  /** Arabic glyph ids drawn on this page and the text each stands for (font widths and ToUnicode). */
  glyphs = new Map<number, string>();
  /** True when a bracket was drawn mirrored inside Arabic text (font F4). */
  mirrored = false;

  text(
    value: string,
    x: number,
    top: number,
    opts: { size?: number; bold?: boolean; color?: string; align?: "left" | "right"; tracking?: number } = {},
  ) {
    const size = opts.size ?? TEXT_SIZE;
    const tracking = opts.tracking ?? 0;
    const baseline = PAGE_H - (top + size * 0.8);

    if (hasArabicText(value)) {
      this.mixedText(value, x, baseline, size, opts);
      return;
    }

    const width = Array.from(value).length * (size * CHAR_W + tracking) - tracking;
    const left = opts.align === "right" ? x - width : x;

    this.ops.push(
      `BT /${opts.bold ? "F2" : "F1"} ${num(size * PT)} Tf ${num(tracking * PT)} Tc ${opts.color ?? INK} rg ${num(left * PT)} ${num(baseline * PT)} Td (${toWinAnsi(value)}) Tj ET`,
    );
  }

  /** A line with Arabic: Courier and Arabic-font runs in visual order. */
  mixedText(value: string, x: number, baseline: number, size: number, opts: Parameters<PdfPage["text"]>[3] = {}) {
    const layout = layoutLine(value.replace(/[\t\r\n]+/g, " "), isWinAnsi);
    const left = opts.align === "right" ? x - layout.width * size : x;
    const fontSize = num(size * PT);
    const shows = layout.runs.map((run) => {
      if (run.font === "arabic") return `/F3 ${fontSize} Tf [${this.glyphArray(run.glyphs)}] TJ`;
      let font = opts.bold ? "F2" : "F1";

      // A mirrored bracket uses F4: Courier whose ToUnicode swaps the brackets, so copied text keeps "(" as "(".
      if (run.mirrored) {
        font = "F4";
        this.mirrored = true;
      }

      return `/${font} ${fontSize} Tf (${toWinAnsi(run.text)}) Tj`;
    });

    this.ops.push(`BT 0 Tc ${opts.color ?? INK} rg ${num(left * PT)} ${num(baseline * PT)} Td ${shows.join(" ")} ET`);
  }

  glyphArray(glyphs: PdfGlyph[]) {
    const unit = 1000 / ARABIC_PDF_FONT.unitsPerEm;

    return glyphs
      .map((glyph) => {
        if (!this.glyphs.has(glyph.gid)) this.glyphs.set(glyph.gid, glyph.text);

        const hex = `<${glyph.gid.toString(16).padStart(4, "0").toUpperCase()}>`;

        return glyph.shift ? `${num(glyph.shift * unit)} ${hex} ${num(-glyph.shift * unit)}` : hex;
      })
      .join(" ");
  }

  /** One line of text inside a line box of `LINE` px, like a leading-relaxed paragraph. */
  line(value: string, x: number, top: number, opts: Parameters<PdfPage["text"]>[3] = {}) {
    this.text(value, x, top + (LINE - (opts.size ?? TEXT_SIZE)) / 2, opts);
  }

  rect(x: number, top: number, width: number, height: number, color: string) {
    this.ops.push(
      `${color} rg ${num(x * PT)} ${num((PAGE_H - top - height) * PT)} ${num(width * PT)} ${num(height * PT)} re f`,
    );
  }
}

function drawFooter(page: PdfPage, invoice: InvoiceFormValues, pageNumber: number, pageCount: number) {
  const left = [invoice.from.email, invoice.from.phone, invoice.from.website];
  const right = ["Prepared for prompt processing.", `Issued by ${invoice.from.issuerName}`];

  if (pageCount > 1) right.push(`Page ${pageNumber} of ${pageCount}`);
  left.forEach((value, index) => {
    page.line(value, MARGIN_X, FOOTER_TOP + index * LINE, { color: MUTED });
  });
  right.forEach((value, index) => {
    page.line(value, COLUMN_2_X, FOOTER_TOP + index * LINE, { color: MUTED });
  });
}

function drawLines(page: PdfPage, lines: string[], x: number, top: number, width: number, opts?: { bold?: boolean }) {
  let y = top;

  for (const value of lines) {
    for (const part of wrap(value, width)) {
      page.line(part, x, y, opts);
      y += LINE;
    }
  }

  return y;
}

function drawTableHeader(page: PdfPage, top: number) {
  const height = CELL_PAD * 2 + ROW_LINE;
  const baseTop = top + CELL_PAD + (ROW_LINE - TEXT_SIZE) / 2;
  const right = MARGIN_X + CONTENT_W - CELL_PAD;

  page.rect(MARGIN_X, top, CONTENT_W, height, HEADER_FILL);
  page.text("DESCRIPTION", MARGIN_X + CELL_PAD, baseTop, { bold: true });
  page.text("UNITS", right - COLUMNS.lineTotal - COLUMNS.unitCost, baseTop, { bold: true, align: "right" });
  page.text("UNIT COST", right - COLUMNS.lineTotal, baseTop, { bold: true, align: "right" });
  // F-5B: the line total includes the line's tax, as on the page and in Bigcapital's PDF.
  page.text("TOTAL INCL. TAX", right, baseTop, { bold: true, align: "right" });

  return top + height;
}

export function buildInvoicePdf(invoice: InvoiceFormValues, createdAt = new Date()) {
  pdfCurrency = invoice.currency;
  const { from, to } = invoice;
  const pages: PdfPage[] = [new PdfPage()];
  let page = pages[0];

  // Header: logo (four squares) and title
  for (const [x, y] of [
    [0, 0],
    [28, 0],
    [0, 28],
    [28, 28],
  ]) {
    page.rect(MARGIN_X + x, MARGIN_Y + y, 20, 20, INK);
  }
  page.text("INVOICE", COLUMN_2_X, MARGIN_Y, { size: 36, tracking: 3.6 });

  let top = MARGIN_Y + 48 + 40;
  const metaBottom = Math.max(
    drawLines(
      page,
      [
        `Reference: ${invoice.referenceNumber}`,
        `Issued: ${invoice.issuedDate}`,
        `Payment due: ${invoice.paymentDueDate}`,
      ],
      MARGIN_X,
      top,
      COLUMN_W,
    ),
    drawLines(
      page,
      ["Payment account", from.paymentAccountName, `Routing no. ${from.routingNumber}`],
      COLUMN_2_X,
      top,
      COLUMN_W,
    ),
  );

  top = metaBottom + 40;
  // Each heading is drawn with its own column so copied text reads like the page: FROM block, then BILL TO block.
  const partiesTop = top + LINE + 16;
  page.line("FROM", MARGIN_X, top, { bold: true });
  const fromBottom = drawLines(
    page,
    [from.name, ...from.addressLines, `Tax ID: ${from.taxId}`],
    MARGIN_X,
    partiesTop,
    COLUMN_W,
  );
  page.line("BILL TO", COLUMN_2_X, top, { bold: true });
  const toBottom = drawLines(
    page,
    [to.name, ...to.addressLines, `Tax ID: ${to.taxId}`],
    COLUMN_2_X,
    partiesTop,
    COLUMN_W,
  );
  const partiesBottom = Math.max(fromBottom, toBottom);

  // Items table
  top = drawTableHeader(page, partiesBottom + 96);
  const right = MARGIN_X + CONTENT_W - CELL_PAD;

  // F-5B: the same printed lines as the page (items, then the discount as its own taxed line).
  for (const item of getInvoicePrintedLines(invoice)) {
    const description = wrap(item.description, DESCRIPTION_W);
    const height = CELL_PAD * 2 + 4 + description.length * ROW_LINE;

    if (top + height > BODY_BOTTOM) {
      page = new PdfPage();
      pages.push(page);
      top = drawTableHeader(page, MARGIN_Y);
    }

    const rowTop = top + CELL_PAD + 2 + (ROW_LINE - TEXT_SIZE) / 2;
    description.forEach((part, index) => {
      page.text(part, MARGIN_X + CELL_PAD, rowTop + index * ROW_LINE);
    });
    page.text(
      Number.isFinite(item.quantity) ? String(item.quantity) : "0",
      right - COLUMNS.lineTotal - COLUMNS.unitCost,
      rowTop,
      { align: "right" },
    );
    page.text(money(item.unitPrice), right - COLUMNS.lineTotal, rowTop, { align: "right" });
    page.text(money(item.total), right, rowTop, { align: "right" });
    top += height;
    page.rect(MARGIN_X, top - 1, CONTENT_W, 1, RULE);
  }

  // Totals, right column (F-5B: the discount is a line above, so the totals are subtotal, tax and total)
  const taxOption = getInvoiceTaxOption(invoice);
  const totals: Array<[string, string]> = [
    ["Subtotal", money(getInvoiceTaxableAmount(invoice))],
    [taxLineLabel(taxOption), money(getInvoiceTax(invoice))],
  ];
  const totalsHeight = totals.length * LINE + 8 + 2 + 12 + LINE + 12 + 2;

  top += 20;
  if (top + totalsHeight > BODY_BOTTOM) {
    page = new PdfPage();
    pages.push(page);
    top = MARGIN_Y;
  }

  const totalsRight = MARGIN_X + CONTENT_W;
  for (const [label, value] of totals) {
    page.line(label, COLUMN_2_X, top);
    page.line(value, totalsRight, top, { align: "right" });
    top += LINE;
  }
  top += 8;
  page.rect(COLUMN_2_X, top, COLUMN_W, 2, INK);
  top += 2 + 12;
  page.line("BALANCE DUE", COLUMN_2_X, top, { bold: true });
  page.line(money(getInvoiceTotal(invoice)), totalsRight, top, { bold: true, align: "right" });
  top += LINE + 12;
  page.rect(COLUMN_2_X, top, COLUMN_W, 2, INK);

  pages.forEach((item, index) => {
    drawFooter(item, invoice, index + 1, pages.length);
  });

  return writePdf(pages, {
    title: `Invoice ${invoice.referenceNumber}`.trim(),
    createdAt,
  });
}

function pdfDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function writePdf(pages: PdfPage[], meta: { title: string; createdAt: Date }) {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  const pageIds = pages.map((_, index) => 6 + index * 2);
  const glyphs = new Map<number, string>();

  for (const page of pages) {
    for (const [gid, text] of page.glyphs) if (!glyphs.has(gid)) glyphs.set(gid, text);
  }

  // Objects of the embedded Arabic font follow the pages; only written when a line holds Arabic.
  const arabicFontId = 6 + pages.length * 2;
  const arabicFont = glyphs.size ? ` /F3 ${arabicFontId} 0 R` : "";
  const mirrorFontId = arabicFontId + (glyphs.size ? 5 : 0);
  const mirrorFont = pages.some((page) => page.mirrored) ? ` /F4 ${mirrorFontId} 0 R` : "";

  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>");
  add(
    `<< /Title ${pdfString(meta.title)} /Producer ${pdfString(`${PRODUCT_NAME} invoice`)} /CreationDate (${pdfDate(meta.createdAt)}) >>`,
  );
  pages.forEach((page, index) => {
    const stream = page.ops.join("\n");

    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_W * PT)} ${num(PAGE_H * PT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R${arabicFont}${mirrorFont} >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
    );
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  if (glyphs.size) addArabicFont(add, arabicFontId, glyphs);
  if (mirrorFont) addMirrorFont(add, mirrorFontId);

  // Every byte written is ASCII (non-ASCII text is escaped as octal), so string offsets are byte offsets.
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return new TextEncoder().encode(out);
}

/** Type0 font with Identity-H glyph ids over the embedded TrueType subset, its widths and a ToUnicode map. */
function addArabicFont(add: (body: string) => void, id: number, glyphs: Map<number, string>) {
  const font = ARABIC_PDF_FONT;
  const scale = (value: number) => Math.round((value * 1000) / font.unitsPerEm);
  const baseFont = `NTARAB+${font.name}`;
  const widths = new Map<number, number>();

  for (let index = 0; index < font.widths.length; index += 2) widths.set(font.widths[index], font.widths[index + 1]);

  const used = [...glyphs.keys()].sort((a, b) => a - b);
  const hex = (value: string) =>
    Array.from({ length: value.length }, (_, index) => value.charCodeAt(index).toString(16).padStart(4, "0"))
      .join("")
      .toUpperCase();
  const toUnicode = [
    "/CIDInit /ProcSet findresource begin 12 dict begin begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def /CMapType 2 def",
    "1 begincodespacerange <0000> <FFFF> endcodespacerange",
  ];

  for (let index = 0; index < used.length; index += 100) {
    const chunk = used.slice(index, index + 100);

    toUnicode.push(`${chunk.length} beginbfchar`);
    for (const gid of chunk) toUnicode.push(`<${hex(String.fromCharCode(gid))}> <${hex(glyphs.get(gid) ?? "")}>`);
    toUnicode.push("endbfchar");
  }
  toUnicode.push("endcmap CMapName currentdict /CMap defineresource pop end end");

  const cmap = toUnicode.join("\n");

  add(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${baseFont} /Encoding /Identity-H /DescendantFonts [${id + 1} 0 R] /ToUnicode ${id + 4} 0 R >>`,
  );
  add(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseFont} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${id + 2} 0 R /DW 1000 /W [${used.map((gid) => `${gid} [${scale(widths.get(gid) ?? 0)}]`).join(" ")}] /CIDToGIDMap /Identity >>`,
  );
  add(
    `<< /Type /FontDescriptor /FontName /${baseFont} /Flags 4 /FontBBox [${font.bbox.map(scale).join(" ")}] /ItalicAngle 0 /Ascent ${scale(font.ascent)} /Descent ${scale(font.descent)} /CapHeight ${scale(font.capHeight)} /StemV 80 /FontFile2 ${id + 3} 0 R >>`,
  );
  add(
    `<< /Length ${font.data.length} /Length1 ${font.length1} /Filter [/ASCII85Decode /FlateDecode] >>\nstream\n${font.data}\nendstream`,
  );
  add(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
}

/** Courier for brackets drawn mirrored in right-to-left text: its ToUnicode gives each one back as its pair. */
function addMirrorFont(add: (body: string) => void, id: number) {
  const pairs = ["()", ")(", "[]", "][", "{}", "}{", "<>", "><", "\u00ab\u00bb", "\u00bb\u00ab"];
  const hex = (char: string, digits: number) =>
    (char.codePointAt(0) ?? 0).toString(16).padStart(digits, "0").toUpperCase();
  const cmap = [
    "/CIDInit /ProcSet findresource begin 12 dict begin begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Mirrored-UCS def /CMapType 2 def",
    "1 begincodespacerange <00> <FF> endcodespacerange",
    `${pairs.length} beginbfchar`,
    ...pairs.map(([drawn, meant]) => `<${hex(drawn, 2)}> <${hex(meant, 4)}>`),
    "endbfchar",
    "endcmap CMapName currentdict /CMap defineresource pop end end",
  ].join("\n");

  add(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding /ToUnicode ${id + 1} 0 R >>`);
  add(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
}

export function invoicePdfFilename(invoice: InvoiceFormValues) {
  const reference = invoice.referenceNumber
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `invoice-${reference || "draft"}.pdf`;
}

/** Builds the PDF and hands it to the browser as a file download. Returns the file name. */
export function downloadInvoicePdf(invoice: InvoiceFormValues) {
  const filename = invoicePdfFilename(invoice);
  const url = URL.createObjectURL(new Blob([buildInvoicePdf(invoice)], { type: "application/pdf" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return filename;
}

"use client";

import * as React from "react";

import { Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { formatInvoiceMoney, getInvoiceTotal, type InvoiceFormValues } from "./data";

/**
 * M129-D (Fahad 129.4: "upload an invoice, then click any box on it and write"): an existing invoice PDF is uploaded,
 * its pages are drawn by pdfme's converter, a click on a page adds a text box there, and pdfme's generator writes the
 * boxes into the same PDF (template.basePdf = the uploaded file).
 * Accepted file: PDF only. pdfme's basePdf "accepts PDF data as a string (base64 encoded), an ArrayBuffer, or a
 * Uint8Array" (pdfme 6.2.5 website/docs/getting-started.md, line 80).
 */
// F-16 round 2: no links to other sites. The accepted-file rule is from pdfme 6.2.5 docs (website/docs/
// getting-started.md line 80: basePdf is a PDF); the filler is pdfme 6.2.5 (MIT).

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * pdfme 6.2.5 lays a line with Arabic out right to left as one run, so a run of digits or Latin letters inside it
 * comes out reversed ("2026" prints "6202"; evidence: monitor-workers/m129-d-invoices/shots/03-pdfme-arabic-node-test.png).
 * Reversing those runs first makes them print in the right order.
 */
export function prepareRtlForPdfme(text: string) {
  if (!ARABIC.test(text)) return text;
  return text.replace(/[0-9A-Za-z](?:[0-9A-Za-z.,:/+%$#-]*[0-9A-Za-z])?/g, (run) => [...run].reverse().join(""));
}

interface PageImage {
  url: string;
  width: number; // mm
  height: number; // mm
}

interface Box {
  id: string;
  page: number;
  /** Where the click was, in mm from the page's top-left corner. */
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

const PT_TO_MM = 25.4 / 72;
const boxHeight = (fontSize: number) => fontSize * PT_TO_MM * 1.5;

/** Box geometry in mm: left-to-right text starts at the click, right-to-left text ends at it. */
function geometry(box: Box, page: PageImage) {
  const rtl = ARABIC.test(box.text);
  const margin = 4;
  const height = boxHeight(box.fontSize);
  const top = Math.max(0, Math.min(box.y - height / 2, page.height - height));
  if (rtl) {
    const width = Math.max(20, box.x - margin);
    return { rtl, left: Math.max(margin, box.x - width), top, width, height };
  }
  return { rtl, left: box.x, top, width: Math.max(20, page.width - box.x - margin), height };
}

export function PdfFillSection() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [open, setOpen] = React.useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    const bytes = new Uint8Array(await chosen.arrayBuffer());
    const isPdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    if (!isPdf) {
      toast.error(`${chosen.name} is not a PDF`, { description: "Only PDF files can be filled (pdfme basePdf)." });
      return;
    }
    setFile({ name: chosen.name, bytes });
    setOpen(true);
  }

  return (
    <section className="flex flex-col gap-3" data-testid="pdf-fill-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-medium tracking-tight">Existing Invoice</h2>
          <p className="text-muted-foreground text-xs">
            Upload an invoice you already have, click anywhere on it and type, then download it filled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {file ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
              Open {file.name.length > 18 ? `${file.name.slice(0, 16)}…` : file.name}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <FileUp data-icon="inline-start" />
            Upload PDF
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          aria-label="Upload an existing invoice PDF"
          onChange={onFile}
        />
      </div>
      <p className="text-muted-foreground text-xs" data-testid="accepted-formats">
        Accepted file: <strong className="font-medium text-foreground">PDF (.pdf)</strong> only. Images and Word files
        are not accepted: the filler takes a PDF as the page under the boxes.
      </p>
      {file ? <PdfFillSheet file={file} open={open} onOpenChange={setOpen} /> : null}
    </section>
  );
}

function PdfFillSheet({
  file,
  open,
  onOpenChange,
}: {
  file: { name: string; bytes: Uint8Array };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { getValues } = useFormContext<InvoiceFormValues>();
  const [pages, setPages] = React.useState<PageImage[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [boxes, setBoxes] = React.useState<Box[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setPages(null);
    setBoxes([]);
    setError(null);
    (async () => {
      try {
        const { pdf2img, pdf2size } = await import("@pdfme/converter");
        const [sizes, images] = await Promise.all([pdf2size(file.bytes), pdf2img(file.bytes, { scale: 1.5 })]);
        if (cancelled) return;
        const next = images.map((image, index) => {
          const url = URL.createObjectURL(new Blob([image], { type: "image/png" }));
          urls.push(url);
          return { url, width: sizes[index]?.width ?? 210, height: sizes[index]?.height ?? 297 };
        });
        setPages(next);
      } catch (err) {
        if (!cancelled) setError(`Could not read this PDF: ${(err as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [file]);

  function addBox(event: React.MouseEvent<HTMLDivElement>, pageIndex: number, page: PageImage) {
    // React bubbles clicks from the portalled pop-up (Done, value chips) through this page; only real page clicks count.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if ((event.target as HTMLElement).closest("[data-fill-box]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * page.width;
    const y = ((event.clientY - rect.top) / rect.height) * page.height;
    const id = `box${Date.now().toString(36)}`;
    setBoxes((list) => [...list, { id, page: pageIndex, x, y, text: "", fontSize: 11 }]);
    setActive(id);
  }

  function update(id: string, patch: Partial<Box>) {
    setBoxes((list) => list.map((box) => (box.id === id ? { ...box, ...patch } : box)));
  }

  function remove(id: string) {
    setBoxes((list) => list.filter((box) => box.id !== id));
    setActive(null);
  }

  function closeBox(id: string) {
    setActive(null);
    setBoxes((list) => list.filter((box) => box.id !== id || box.text.trim()));
  }

  const values = getValues();
  const quickValues = [
    { label: "Client", value: values.to.name },
    { label: "Client email", value: values.to.email },
    { label: "Reference", value: values.referenceNumber },
    { label: "Issued", value: values.issuedDate },
    { label: "Due", value: values.paymentDueDate },
    { label: "Total", value: formatInvoiceMoney(getInvoiceTotal(values), values.currency) },
    { label: "Business", value: values.from.name },
  ].filter((item) => item.value);

  async function download() {
    if (!pages) return;
    const filled = boxes.filter((box) => box.text.trim());
    if (!filled.length) {
      toast.error("Click on the invoice and type something first");
      return;
    }
    setBusy(true);
    try {
      const [{ generate }, geist, arabic] = await Promise.all([
        import("@pdfme/generator"),
        fetch("/api/invoice-bigcapital/fonts/Geist-Regular.ttf").then((r) => r.arrayBuffer()),
        fetch("/api/invoice-bigcapital/fonts/NotoSansArabic-Regular.ttf").then((r) => r.arrayBuffer()),
      ]);
      const schemas = pages.map((page, pageIndex) =>
        filled
          .filter((box) => box.page === pageIndex)
          .map((box) => {
            const g = geometry(box, page);
            return {
              name: box.id,
              type: "text",
              position: { x: g.left, y: g.top },
              width: g.width,
              height: g.height,
              fontSize: box.fontSize,
              fontName: g.rtl ? "NotoSansArabic" : "Geist",
              alignment: g.rtl ? "right" : "left",
              verticalAlignment: "middle",
              fontColor: "#111827",
            };
          }),
      );
      const inputs = [
        Object.fromEntries(
          filled.map((box) => [box.id, ARABIC.test(box.text) ? prepareRtlForPdfme(box.text) : box.text]),
        ),
      ];
      const pdf = await generate({
        // biome-ignore lint/suspicious/noExplicitAny: pdfme's Template type is wider than this literal
        template: { basePdf: file.bytes, schemas } as any,
        inputs,
        options: {
          font: {
            Geist: { data: geist, fallback: true },
            NotoSansArabic: { data: arabic },
          },
        },
      });
      const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.pdf$/i, "") + "-filled.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(`Downloaded ${link.download}`, { description: `${filled.length} boxes written by pdfme` });
    } catch (err) {
      toast.error("pdfme could not write the PDF", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l shadow-xl data-[side=right]:sm:max-w-[min(860px,72vw)]"
        onInteractOutside={(event) => event.preventDefault()}
        data-testid="pdf-fill-sheet"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Fill {file.name}</SheetTitle>
          <SheetDescription>
            Click anywhere on the page to add a text box there, then type or pick a value from this invoice. Arabic text
            is written right to left, ending where you clicked.
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="secondary">
              {(() => {
                const count = boxes.filter((b) => b.text.trim()).length;
                return `${count} ${count === 1 ? "box" : "boxes"}`;
              })()}
            </Badge>
            <Button type="button" size="sm" onClick={() => void download()} disabled={busy || !pages}>
              {busy ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              Download filled PDF
            </Button>
            <span className="text-muted-foreground text-xs">Filled by pdfme 6.2.5 (MIT)</span>
          </div>
          <p className="pt-1 text-muted-foreground text-xs">
            Arabic: pdfme joins the letters correctly, but writes numbers inside Arabic text backwards (“2026” prints
            “6202”). This page reverses those numbers before pdfme writes them. A box holds one script: Arabic letters
            and Latin letters do not mix in one box.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto bg-stone-200 p-4 dark:bg-stone-800">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {!pages && !error ? (
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Reading the PDF…
            </p>
          ) : null}
          <div className="mx-auto flex max-w-[720px] flex-col gap-4">
            {pages?.map((page, pageIndex) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the boxes it makes are buttons that take the keyboard
              // biome-ignore lint/a11y/noStaticElementInteractions: a click on the page is where the new box goes
              <div
                key={page.url}
                className="relative cursor-crosshair bg-white shadow"
                style={{ aspectRatio: `${page.width} / ${page.height}`, containerType: "inline-size" }}
                onClick={(event) => addBox(event, pageIndex, page)}
                data-fill-page={pageIndex}
              >
                {/* biome-ignore lint/performance/noImgElement: a page image rendered from the uploaded PDF */}
                <img
                  src={page.url}
                  alt={`Page ${pageIndex + 1}`}
                  className="pointer-events-none size-full select-none"
                />
                {boxes
                  .filter((box) => box.page === pageIndex)
                  .map((box) => {
                    const g = geometry(box, page);
                    return (
                      <Popover
                        key={box.id}
                        open={active === box.id}
                        onOpenChange={(o) => (o ? setActive(box.id) : closeBox(box.id))}
                      >
                        <PopoverAnchor asChild>
                          <button
                            type="button"
                            data-fill-box={box.id}
                            className="absolute overflow-hidden rounded-sm border border-primary border-dashed bg-primary/5 px-0.5 text-neutral-900 leading-none hover:bg-primary/10"
                            style={{
                              left: `${(g.left / page.width) * 100}%`,
                              top: `${(g.top / page.height) * 100}%`,
                              width: `${(g.width / page.width) * 100}%`,
                              height: `${(g.height / page.height) * 100}%`,
                              fontSize: `${((box.fontSize * PT_TO_MM) / page.width) * 100}cqw`,
                              textAlign: g.rtl ? "right" : "left",
                            }}
                            dir={g.rtl ? "rtl" : "ltr"}
                            onClick={(event) => {
                              event.stopPropagation();
                              setActive(box.id);
                            }}
                          >
                            {box.text || <span className="text-muted-foreground">Type…</span>}
                          </button>
                        </PopoverAnchor>
                        <PopoverContent className="w-80" side="bottom" align="start">
                          <Textarea
                            autoFocus
                            dir="auto"
                            rows={2}
                            value={box.text}
                            aria-label="Text for this box"
                            placeholder="Type the text for this spot"
                            onChange={(event) => update(box.id, { text: event.target.value })}
                          />
                          {quickValues.length ? (
                            <div className="flex flex-wrap gap-1">
                              {quickValues.map((item) => (
                                <Button
                                  key={item.label}
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  onClick={() => update(box.id, { text: item.value })}
                                  title={item.value}
                                >
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 text-xs">
                              Size
                              {[9, 11, 14].map((size) => (
                                <Button
                                  key={size}
                                  type="button"
                                  size="xs"
                                  variant={box.fontSize === size ? "secondary" : "ghost"}
                                  onClick={() => update(box.id, { fontSize: size })}
                                >
                                  {size}
                                </Button>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Delete box"
                                onClick={() => remove(box.id)}
                              >
                                <Trash2 />
                              </Button>
                              <Button type="button" size="sm" onClick={() => closeBox(box.id)}>
                                Done
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";

import { cn } from "cn";
import { Download, Printer } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

import { ClickToEdit } from "./click-to-edit";
import {
  getActiveOffsets,
  INVOICE_PAPER_HEIGHT,
  INVOICE_PAPER_SCALE,
  INVOICE_PAPER_WIDTH,
  type InvoiceBlockOffset,
  type InvoiceDesign,
  type InvoiceFormValues,
  invoiceDesignKey,
  STUDIO_TEMPLATE_ID,
} from "./data";
import { InvoiceDesignBar, NUDGE_STEP } from "./invoice-design";
import { InvoicePaper } from "./invoice-paper";
import { downloadInvoicePdf, invoicePdfFilename } from "./invoice-pdf";
import { InvoiceTemplateSheet } from "./invoice-template-sheet";
import { PrintInvoice } from "./print-invoice";
import { useVisibleCenterPosition } from "./use-visible-center-position";

/** Names for the movable blocks, shown when one is selected. */
const BLOCK_LABELS: Record<string, string> = {
  brand: "Logo and title",
  reference: "Reference and payment",
  parties: "From and Bill to",
  items: "Items",
  totals: "Totals",
  footer: "Footer",
  logo: "Logo",
  sender: "From",
  receiver: "Bill to",
  meta: "Invoice dates",
  notes: "Notes",
  payment: "Payment details",
  signature: "Signature",
  contact: "Contact",
};

function handlePrint() {
  window.print();
}

/**
 * The studio paper with its blocks where they were designed has its own PDF builder. Any other look (an Invoify
 * template, or moved blocks) is saved as PDF from the print dialog, so the file always matches the preview.
 */
function handleDownloadPdf(invoice: InvoiceFormValues) {
  const offsets = getActiveOffsets(invoice.design);
  // M129-D: the studio PDF builder prints English labels only, so an Arabic studio invoice goes through the print path.
  const isStudioAsDesigned =
    invoice.design.templateId === STUDIO_TEMPLATE_ID &&
    invoice.design.language !== "ar" &&
    Object.keys(offsets ?? {}).length === 0;

  if (isStudioAsDesigned) {
    try {
      toast.success(`Downloaded ${downloadInvoicePdf(invoice)}`);
    } catch {
      toast.error("Could not create the PDF");
    }
    return;
  }

  const title = document.title;
  document.title = invoicePdfFilename(invoice).replace(/\.pdf$/, "");
  window.addEventListener("afterprint", () => (document.title = title), { once: true });
  toast.info("Choose “Save as PDF” in the print dialog");
  window.print();
}

export function InvoicePreview({ invoice }: { invoice: InvoiceFormValues }) {
  const { setValue } = useFormContext<InvoiceFormValues>();
  const design = invoice.design;
  const isStudio = design.templateId === STUDIO_TEMPLATE_ID;
  const designKey = invoiceDesignKey(design.templateId);
  const offsets = getActiveOffsets(design);

  const previewBodyRef = React.useRef<HTMLDivElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    start: InvoiceBlockOffset;
    min: InvoiceBlockOffset;
    max: InvoiceBlockOffset;
  } | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [sheetHeight, setSheetHeight] = React.useState(INVOICE_PAPER_HEIGHT);

  // A template grows with its content; the preview fits whatever height it has.
  React.useEffect(() => {
    const sheet = sheetRef.current;

    if (isStudio || !sheet) {
      setSheetHeight(INVOICE_PAPER_HEIGHT);
      return;
    }

    const observer = new ResizeObserver(() => setSheetHeight(Math.max(INVOICE_PAPER_HEIGHT, sheet.offsetHeight)));
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [isStudio]);

  const paperLayout = useVisibleCenterPosition(previewBodyRef, {
    height: sheetHeight,
    maxScale: INVOICE_PAPER_SCALE,
    width: INVOICE_PAPER_WIDTH,
  });
  const scale = paperLayout?.scale ?? INVOICE_PAPER_SCALE;

  function updateDesign(next: Partial<InvoiceDesign>) {
    if (next.templateId !== undefined || next.manualLayout === false) setSelected(null);
    setValue("design", { ...design, ...next }, { shouldDirty: true });
  }

  function setBlockOffset(id: string, offset: InvoiceBlockOffset) {
    const blocks = { ...design.offsets[designKey], [id]: { x: Math.round(offset.x), y: Math.round(offset.y) } };
    setValue("design", { ...design, offsets: { ...design.offsets, [designKey]: blocks } }, { shouldDirty: true });
  }

  /** How far a block may go, in sheet pixels, so it stays on the sheet. */
  function blockLimits(element: HTMLElement, current: InvoiceBlockOffset) {
    const sheet = sheetRef.current?.getBoundingClientRect();
    const block = element.getBoundingClientRect();

    if (!sheet) return { min: { x: -Infinity, y: -Infinity }, max: { x: Infinity, y: Infinity } };

    const left = (block.left - sheet.left) / scale;
    const top = (block.top - sheet.top) / scale;
    const right = (sheet.right - block.right) / scale;
    const bottom = (sheet.bottom - block.bottom) / scale;

    return {
      min: { x: current.x - Math.max(left, 0), y: current.y - Math.max(top, 0) },
      max: { x: current.x + Math.max(right, 0), y: current.y + Math.max(bottom, 0) },
    };
  }

  function findBlock(target: EventTarget | null) {
    const element = target instanceof Element ? target.closest<HTMLElement>("[data-move-id]") : null;

    return element && sheetRef.current?.contains(element) ? element : null;
  }

  function nudge(dx: number, dy: number) {
    const element = selected ? sheetRef.current?.querySelector<HTMLElement>(`[data-move-id="${selected}"]`) : null;

    if (!selected || !element) return;
    const current = offsets?.[selected] ?? { x: 0, y: 0 };
    const { min, max } = blockLimits(element, current);
    setBlockOffset(selected, {
      x: Math.min(Math.max(current.x + dx, min.x), max.x),
      y: Math.min(Math.max(current.y + dy, min.y), max.y),
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const element = design.manualLayout ? findBlock(event.target) : null;
    const id = element?.dataset.moveId;

    if (!element || !id || event.button !== 0) return;
    event.preventDefault();
    element.focus({ preventScroll: true });
    setSelected(id);

    const start = offsets?.[id] ?? { x: 0, y: 0 };
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start,
      ...blockLimits(element, start),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;
    setBlockOffset(drag.id, {
      x: Math.min(Math.max(drag.start.x + (event.clientX - drag.startX) / scale, drag.min.x), drag.max.x),
      y: Math.min(Math.max(drag.start.y + (event.clientY - drag.startY) / scale, drag.min.y), drag.max.y),
    });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const id = design.manualLayout ? findBlock(event.target)?.dataset.moveId : undefined;
    const step = event.shiftKey ? NUDGE_STEP * 4 : NUDGE_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];

    if (!id || !move || id !== selected) return;
    event.preventDefault();
    nudge(move[0], move[1]);
  }

  function handleFocus(event: React.FocusEvent<HTMLDivElement>) {
    const id = design.manualLayout ? findBlock(event.target)?.dataset.moveId : undefined;

    if (id) setSelected(id);
  }

  const arrangement = offsets ? { offsets, interactive: true, selected } : undefined;
  const printArrangement = offsets ? { offsets } : undefined;

  return (
    <>
      <PrintInvoice invoice={invoice} arrangement={printArrangement} />
      <div className="flex flex-col rounded-xl border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex flex-col">
            <h2 className="font-medium text-lg">Preview</h2>
            <p className="text-muted-foreground text-xs">
              {design.manualLayout
                ? "Arrange manually is on: clicks move blocks."
                : "Click any value on the invoice to edit it."}
            </p>
          </div>
          <ButtonGroup>
            <Button type="button" variant="outline" onClick={handlePrint}>
              <Printer data-icon="inline-start" />
              Print
            </Button>
            <Button type="button" variant="outline" onClick={() => handleDownloadPdf(invoice)}>
              <Download data-icon="inline-start" />
              Download PDF
            </Button>
          </ButtonGroup>
        </div>

        <InvoiceDesignBar
          design={design}
          selectedLabel={selected ? (BLOCK_LABELS[selected] ?? selected) : null}
          canReset={Object.keys(offsets ?? {}).length > 0}
          onChange={updateDesign}
          onNudge={nudge}
          onReset={() => {
            const rest = Object.fromEntries(Object.entries(design.offsets).filter(([key]) => key !== designKey));
            setValue("design", { ...design, offsets: rest }, { shouldDirty: true });
          }}
        />

        <div
          ref={previewBodyRef}
          className="@container/preview relative min-h-[calc(100svh-15rem)] flex-1 rounded-b-xl bg-stone-200 p-4 dark:bg-stone-800"
        >
          {paperLayout === null ? (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
              Loading Preview
            </div>
          ) : null}
          <div
            style={{
              height: sheetHeight * scale,
              top: paperLayout?.top ?? "50%",
              transform: paperLayout === null ? "translate(-50%, -50%)" : "translateX(-50%)",
              width: INVOICE_PAPER_WIDTH * scale,
            }}
            className="absolute left-1/2 opacity-0 data-[ready=true]:opacity-100"
            data-ready={paperLayout !== null}
          >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: delegates for the blocks inside, which are focusable and take the arrow keys */}
            <div
              style={{ transform: `scale(${scale})` }}
              className={cn(
                "origin-top-left",
                design.manualLayout &&
                  "touch-none select-none [&_[data-move-id]:focus-visible]:outline-2 [&_[data-move-id]:focus-visible]:outline-ring [&_[data-move-id]:hover]:outline-1 [&_[data-move-id]:hover]:outline-primary/60 [&_[data-move-id]:hover]:outline-dashed [&_[data-move-id]]:cursor-move [&_[data-move-selected]]:outline-2 [&_[data-move-selected]]:outline-primary [&_[data-move-selected]]:outline-dashed",
              )}
              data-manual-layout={design.manualLayout || undefined}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
            >
              <ClickToEdit enabled={!design.manualLayout}>
                {isStudio ? (
                  <div ref={sheetRef}>
                    <InvoicePaper invoice={invoice} arrangement={arrangement} />
                  </div>
                ) : (
                  <InvoiceTemplateSheet invoice={invoice} arrangement={arrangement} sheetRef={sheetRef} />
                )}
              </ClickToEdit>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

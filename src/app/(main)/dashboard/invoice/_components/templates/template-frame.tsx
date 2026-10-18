import type { ReactNode } from "react";

import { DEFAULT_LOCALE, dirForLocale } from "./helpers";
import { DEFAULT_INVOICE_LABELS, type InvoiceTemplateExtras } from "./invoice-labels";
import { densityScale, fontStack, type InvoiceTheme, resolveTheme } from "./invoice-theme";
import type { PartCtx } from "./parts";
import type { InvoiceType } from "./types";

export type TemplateProps = InvoiceType & InvoiceTemplateExtras;

/**
 * Builds the context every layout part needs, from whatever props the template was given. Missing labels fall back
 * to English and a missing theme to the default (Invoify TemplateFrame.tsx, 3859b3c).
 */
export function templateCtx(data: TemplateProps): PartCtx {
  const theme: InvoiceTheme = resolveTheme(data.theme ?? data.details?.theme);
  return {
    data,
    labels: data.labels ?? DEFAULT_INVOICE_LABELS,
    theme,
    scale: densityScale(theme.density),
    locale: data.locale ?? DEFAULT_LOCALE,
    dir: dirForLocale(data.locale ?? DEFAULT_LOCALE),
  };
}

/**
 * The sheet every layout sits on (Invoify TemplateFrame.tsx, 3859b3c).
 *
 * Studio changes, so the sheet matches the studio paper and its print page (US Letter, 816 x 1056 at 96 dpi):
 * - `@container`, so the layouts' breakpoints (turned into container queries when they were copied) follow the sheet
 *   width, not the window. The sheet is always 816 px wide, so a phone preview, the desktop preview and the print
 *   all get the same arrangement.
 * - One minimum height of 1056 px on screen and in print, in place of 30rem / 60rem / 1123 px (A4).
 */
export default function TemplateFrame({
  ctx,
  children,
  bare = false,
}: {
  ctx: PartCtx;
  children: ReactNode;
  /** Skips the page padding, for layouts that paint edge-to-edge. */
  bare?: boolean;
}) {
  const { theme, scale, dir } = ctx;

  return (
    <section dir={dir} className="@container" style={{ fontFamily: fontStack(theme.fontId), color: "#111827" }}>
      <div
        className={`flex min-h-[1056px] flex-col overflow-hidden rounded-xl bg-white print:overflow-visible print:rounded-none ${
          bare ? "" : scale.page
        }`}
      >
        {children}
      </div>
    </section>
  );
}

import { formatDate } from "../helpers";
import { readableOn } from "../invoice-theme";
import { ItemsTable, Logo, NotesBlock, PartyBlock, PaymentBlock, SignatureBlock, TotalsBlock } from "../parts";
import TemplateFrame, { type TemplateProps, templateCtx } from "../template-frame";

/**
 * Sidebar — a full-height accent rail carries the sender, meta and payment
 * details, leaving the main column for the line items alone.
 */
export default function Sidebar(props: TemplateProps) {
  const ctx = templateCtx(props);
  const { data, labels, theme, scale, locale } = ctx;
  const onAccent = readableOn(theme.accentColor);

  const railRow = (label: string, value: string) => (
    <div key={label} className="mt-3">
      <p className={`${scale.label} font-semibold uppercase tracking-wider`} style={{ color: onAccent, opacity: 0.7 }}>
        {label}
      </p>
      <p className={`${scale.body} tabular-nums`} style={{ color: onAccent }}>
        {value}
      </p>
    </div>
  );

  return (
    <TemplateFrame ctx={ctx} bare>
      <div className="flex min-h-full flex-1 flex-col @min-[640px]:flex-row">
        <aside
          className="w-full shrink-0 p-6 @min-[640px]:w-[34%] @min-[640px]:p-7"
          style={{ backgroundColor: theme.accentColor }}
        >
          {/* Plate on a dark accent — see Logo in parts/index.tsx */}
          <Logo {...ctx} plate={onAccent === "#ffffff"} />
          <p data-edit-field="sender.name" className={`${scale.name} mt-3 font-semibold`} style={{ color: onAccent }}>
            {data.sender.name}
          </p>
          <address
            data-edit-field="sender.address"
            className={`${scale.body} mt-1 not-italic leading-relaxed`}
            style={{ color: onAccent, opacity: 0.85 }}
          >
            {data.sender.address}
            <br />
            {[data.sender.zipCode, data.sender.city].filter(Boolean).join(", ")}
            <br />
            {data.sender.country}
            <br />
            {data.sender.email}
            <br />
            {/* T-160 harness-only patch: same LTR isolation as PartyBlock. */}
            <bdi dir="ltr">{data.sender.phone}</bdi>
          </address>

          {railRow(labels.invoiceNumber, data.details.invoiceNumber)}
          {railRow(labels.invoiceDate, formatDate(data.details.invoiceDate, locale))}
          {railRow(labels.dueDate, formatDate(data.details.dueDate, locale))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-6 @min-[640px]:p-8">
          <div className={`${scale.heading} font-bold uppercase tracking-tight`} style={{ color: theme.accentColor }}>
            {labels.invoiceNumber}
          </div>

          <div className="mt-5">
            <PartyBlock ctx={ctx} field="receiver" party={data.receiver} heading={labels.billTo} />
          </div>

          <div className={scale.sectionGap}>
            <ItemsTable ctx={ctx} />
          </div>

          <div className={`${scale.sectionGap} flex justify-end`}>
            <div className="w-full @min-[640px]:w-2/3">
              <TotalsBlock ctx={ctx} emphasis="fill" />
            </div>
          </div>

          <div className={`${scale.sectionGap} space-y-4`}>
            <NotesBlock ctx={ctx} />
            <PaymentBlock ctx={ctx} />
            <SignatureBlock ctx={ctx} />
          </div>
        </main>
      </div>
    </TemplateFrame>
  );
}

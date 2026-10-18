/**
 * The three helpers the Invoify templates import from `lib/helpers.ts`, and the locale direction from
 * `lib/variables.ts` (Invoify 3859b3c). Azerbaijani date formatting is left out: the studio offers English and Arabic.
 */
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };

export const DEFAULT_LOCALE = "en";

export const dirForLocale = (locale: string): "rtl" | "ltr" => (locale === "ar" || locale === "he" ? "rtl" : "ltr");

export const formatNumberWithCommas = (number: number) =>
  number.toLocaleString("en-US", { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const isDataUrl = (str: string) => str.startsWith("data:");

export const formatDate = (value: string | Date | undefined | null, locale = "en-US", fallback = "—"): string => {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  try {
    return date.toLocaleDateString(locale, DATE_OPTIONS);
  } catch {
    return date.toLocaleDateString("en-US", DATE_OPTIONS);
  }
};

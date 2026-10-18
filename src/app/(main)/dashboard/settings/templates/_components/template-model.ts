// M129-C (Fahad 129.9, 129.2): WhatsApp template drafts, Meta's template rules and the simulated review.
// Every limit below names its Meta page (META_SOURCES). Nothing here talks to Meta or Chatwoot: a submitted template
// goes to "Pending" in the Studio preview and a simulated decision (the user's choice, or approve after a short wait)
// moves it to "Approved" or "Rejected". The templates live in the shared list `whatsappTemplates` (lib/cw/store.ts),
// which the preview saves on its disk (/api/studio-preview-state), so they are still there after a reload.

import { PRODUCT_NAME } from "@/config/app-config";
import type { WhatsAppTemplate } from "@/lib/cw/data";

/** Meta's own pages for each rule (WhatsApp Business Platform documentation, read 2026-10-15). */
export const META_SOURCES = {
  overview: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview",
  components: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components",
  review: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review/",
  media: "https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media",
  authentication:
    "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates",
  catalog:
    "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/catalog-templates",
  coupon:
    "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/coupon-templates",
  library: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-library",
  management: "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management",
  categories:
    "https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization",
} as const;

export type Category = WhatsAppTemplate["category"];
export type HeaderType = "none" | "text" | "image" | "video" | "document";
export type TemplateKind = "standard" | "catalog";

export type TemplateButton =
  | { type: "quick_reply"; text: string }
  | { type: "url"; text: string; url: string; example: string }
  | { type: "phone"; text: string; phone: string }
  | { type: "copy_code"; example: string }
  | { type: "catalog" };

export interface MediaSample {
  name: string;
  size: number;
  type: string;
}

/** Simulated Meta review of a submitted template (Pending until `decideAt`, or until Sync templates). */
export interface SimReview {
  submittedAt: number;
  /** When the simulated decision arrives; null = only when "Sync templates" is pressed. */
  decideAt: number | null;
  outcome: "APPROVED" | "REJECTED";
  reason?: string;
  decidedAt?: number;
}

/** The editable form of a template (what the builder edits and saves on the list row as `draft`). */
export interface TemplateDraft {
  name: string;
  category: Category;
  /** Meta language code: en, en_US or ar. */
  code: string;
  kind: TemplateKind;
  headerType: HeaderType;
  headerText: string;
  headerExample: string;
  headerSample: MediaSample | null;
  body: string;
  examples: string[];
  footer: string;
  buttons: TemplateButton[];
  /** Authentication only: Meta's optional lines (authentication-templates). */
  authSecurity: boolean;
  authExpiry: number | null;
  /** Copied from a Meta Template Library entry; its text is fixed unless the user customizes it. */
  library?: { name: string; customized: boolean };
  /** Where the draft came from (the Template library card), shown on the row. */
  origin?: string;
}

/** A row of the shared `whatsappTemplates` list made in this preview: the list fields plus the draft and review. */
export interface TemplateRecord extends WhatsAppTemplate {
  id?: string;
  draft?: TemplateDraft;
  review?: SimReview;
  /** True for templates made in the Studio preview (never sent to Meta). */
  simulated?: boolean;
  updatedAt?: string;
}

export const LANGUAGES: { code: string; label: string; language: WhatsAppTemplate["language"] }[] = [
  { code: "en", label: "English (en)", language: "English" },
  { code: "en_US", label: "English (US) (en_US)", language: "English" },
  { code: "ar", label: "Arabic (ar)", language: "Arabic" },
];

export const CATEGORY_HELP: Record<Category, string> = {
  MARKETING: "Promotions, offers, greetings, catalog. Anything mixed with promotion counts as marketing.",
  UTILITY: "Updates about something the customer asked for: orders, payments, appointments.",
  AUTHENTICATION: "One-time passcodes only, with Meta's fixed text. No links or media.",
};

// Meta media reference (META_SOURCES.media): the types and sizes a template header sample may have.
export const HEADER_MEDIA: Record<
  Exclude<HeaderType, "none" | "text">,
  { label: string; types: string[]; extensions: string; maxBytes: number; note?: string }
> = {
  image: {
    label: "Image",
    types: ["image/jpeg", "image/png"],
    extensions: ".jpeg, .jpg, .png",
    maxBytes: 5 * 1024 * 1024,
  },
  video: {
    label: "Video",
    types: ["video/mp4", "video/3gpp"],
    extensions: ".mp4, .3gp",
    maxBytes: 16 * 1024 * 1024,
    note: "H.264 video and AAC audio only (Meta does not accept other codecs).",
  },
  document: {
    label: "Document",
    types: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    extensions: ".pdf, .txt, .doc, .docx, .xls, .xlsx, .ppt, .pptx",
    maxBytes: 100 * 1024 * 1024,
  },
};

// Meta authentication-templates: the preset text (the code is the one variable) and its two optional lines.
export const AUTH_BODY = "{{1}} is your verification code.";
export const AUTH_SECURITY = "For your security, do not share this code.";
export const authExpiryLine = (minutes: number) => `This code expires in ${minutes} minutes.`;

export const LIMITS = {
  name: 512,
  headerText: 60,
  body: 1024,
  footer: 60,
  buttons: 10,
  quickReplies: 10,
  urlButtons: 2,
  phoneButtons: 1,
  copyCodeButtons: 1,
  buttonText: 25,
  url: 2000,
  phone: 20,
  copyCode: 20,
} as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function emptyDraft(): TemplateDraft {
  return {
    name: "",
    category: "MARKETING",
    code: "en",
    kind: "standard",
    headerType: "none",
    headerText: "",
    headerExample: "",
    headerSample: null,
    body: "",
    examples: [],
    footer: "",
    buttons: [],
    authSecurity: true,
    authExpiry: 10,
  };
}

/** Every {{…}} token in the text, in order (also broken ones such as {{name}} or {{ 1 }}). */
export function tokens(text: string): string[] {
  return Array.from(text.matchAll(/\{\{([^{}]*)\}\}/g), (m) => m[1]);
}

/** The numbered variables {{1}}, {{2}}… used in the text, sorted, without repeats. */
export function variableNumbers(text: string): number[] {
  return Array.from(
    new Set(
      tokens(text)
        .filter((t) => /^\d+$/.test(t))
        .map(Number),
    ),
  ).sort((a, b) => a - b);
}

/** The body as Meta shows it: authentication templates use Meta's fixed text and optional lines. */
export function effectiveBody(draft: TemplateDraft): string {
  if (draft.category !== "AUTHENTICATION") return draft.body;
  return draft.authSecurity ? `${AUTH_BODY} ${AUTH_SECURITY}` : AUTH_BODY;
}

export function effectiveFooter(draft: TemplateDraft): string {
  if (draft.category === "AUTHENTICATION") return draft.authExpiry ? authExpiryLine(draft.authExpiry) : "";
  return draft.footer;
}

/** The buttons as they are sent: authentication = one copy-code button, catalog = the one "View catalog" button. */
export function effectiveButtons(draft: TemplateDraft): TemplateButton[] {
  if (draft.category === "AUTHENTICATION") {
    const sample = draft.examples[0]?.trim();
    return [{ type: "copy_code", example: sample ? sample : "123456" }];
  }
  if (draft.kind === "catalog") return [{ type: "catalog" }];
  // Meta components: quick replies must be grouped together, apart from the other buttons.
  const quick = draft.buttons.filter((b) => b.type === "quick_reply");
  const rest = draft.buttons.filter((b) => b.type !== "quick_reply");
  return [...quick, ...rest];
}

export function buttonLabel(button: TemplateButton): string {
  if (button.type === "copy_code") return "Copy code";
  if (button.type === "catalog") return "View catalog";
  return button.text;
}

/** Fill {{n}} with the sample values (or leave the token when no value is given). */
export function fillSamples(text: string, values: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (match, n: string) => values[Number(n) - 1]?.trim() || match);
}

export interface RuleCheck {
  id: string;
  label: string;
  ok: boolean;
  /** Advisory checks say what Meta reviews but cannot be measured here; they never block. */
  advisory?: boolean;
  detail?: string;
  source: string;
}

const NAME_RE = /^[a-z0-9_]+$/;
const HTTP_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/** Meta's rules for a template, each with its source. `others` are the other templates (for name and duplicate). */
/** Meta: after an approved template is deleted, no new template may take its name for 30 days. */
export const DELETED_NAME_DAYS = 30;

export interface TemplateDeletion {
  name: string;
  code: string;
  deletedAt: string;
}

export function blockedByDeletion(
  name: string,
  deletions: TemplateDeletion[],
  now = Date.now(),
): TemplateDeletion | undefined {
  return deletions.find((d) => d.name === name && now - Date.parse(d.deletedAt) < DELETED_NAME_DAYS * 86_400_000);
}

export function checkTemplate(
  draft: TemplateDraft,
  others: Pick<WhatsAppTemplate, "name" | "code" | "body" | "footer">[],
  deletions: TemplateDeletion[] = [],
): RuleCheck[] {
  const checks: RuleCheck[] = [];
  const add = (check: RuleCheck) => checks.push(check);
  const isAuth = draft.category === "AUTHENTICATION";
  const isCatalog = draft.kind === "catalog" && draft.category === "MARKETING";
  const body = effectiveBody(draft);
  const footer = effectiveFooter(draft);
  const buttons = effectiveButtons(draft);

  add({
    id: "name-format",
    label: "Name uses lowercase letters, numbers and underscores only",
    ok: NAME_RE.test(draft.name),
    detail: draft.name ? undefined : "Enter a name, for example order_update.",
    source: META_SOURCES.overview,
  });
  add({
    id: "name-length",
    label: `Name is at most ${LIMITS.name} characters`,
    ok: draft.name.length > 0 && draft.name.length <= LIMITS.name,
    source: META_SOURCES.overview,
  });
  const taken = others.some((t) => t.name === draft.name && t.code === draft.code);
  add({
    id: "name-unique",
    label: "No other template has this name in this language",
    ok: !!draft.name && !taken,
    detail: taken
      ? `${draft.name} (${draft.code}) already exists. The same name is allowed in another language.`
      : undefined,
    source: META_SOURCES.overview,
  });
  const deleted = draft.name ? blockedByDeletion(draft.name, deletions) : undefined;
  add({
    id: "name-not-deleted",
    label: `Name is not one of an approved template deleted in the last ${DELETED_NAME_DAYS} days`,
    ok: !deleted,
    detail: deleted
      ? `${deleted.name} was deleted on ${new Date(deleted.deletedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
      : undefined,
    source: META_SOURCES.management,
  });
  add({
    id: "language",
    label: "A language is set (Meta does not translate templates)",
    ok: LANGUAGES.some((l) => l.code === draft.code),
    source: META_SOURCES.overview,
  });

  if (!isAuth && draft.headerType === "text") {
    add({
      id: "header-text",
      label: `Text header has 1 to ${LIMITS.headerText} characters`,
      ok: draft.headerText.trim().length > 0 && draft.headerText.length <= LIMITS.headerText,
      detail: `${draft.headerText.length} / ${LIMITS.headerText}`,
      source: META_SOURCES.components,
    });
    const headerVars = tokens(draft.headerText);
    add({
      id: "header-vars",
      label: "Text header has at most 1 variable, written {{1}}",
      ok: headerVars.length <= 1 && headerVars.every((t) => t === "1"),
      source: META_SOURCES.components,
    });
    if (headerVars.length)
      add({
        id: "header-sample",
        label: "The header variable has a sample value",
        ok: !!draft.headerExample.trim(),
        source: META_SOURCES.components,
      });
  }
  if (
    !isAuth &&
    !isCatalog &&
    (draft.headerType === "image" || draft.headerType === "video" || draft.headerType === "document")
  ) {
    const spec = HEADER_MEDIA[draft.headerType];
    const sample = draft.headerSample;
    add({
      id: "header-media",
      label: `${spec.label} header has a sample file: ${spec.extensions}, up to ${formatBytes(spec.maxBytes)}`,
      ok: !!sample && spec.types.includes(sample.type) && sample.size <= spec.maxBytes,
      detail: sample
        ? `${sample.name}: ${sample.type || "unknown type"}, ${formatBytes(sample.size)}`
        : "Choose a sample file. Meta asks for one with every media header.",
      source: META_SOURCES.media,
    });
  }

  const fixedLibrary = !!draft.library && !draft.library.customized;
  if (!isAuth && fixedLibrary) {
    add({
      id: "library-fixed",
      label: "Text is Meta's Template Library text: fixed, so Meta needs no review",
      ok: true,
      detail: "Only the sample values and button inputs change. Customizing the text sends it to review.",
      source: META_SOURCES.library,
    });
    add({
      id: "body-samples",
      label: "Every variable has a sample value",
      ok: variableNumbers(body).every((n) => !!draft.examples[n - 1]?.trim()),
      source: META_SOURCES.library,
    });
  } else if (!isAuth) {
    add({
      id: "body-length",
      label: `Body has 1 to ${LIMITS.body} characters`,
      ok: body.trim().length > 0 && body.length <= LIMITS.body,
      detail: `${body.length} / ${LIMITS.body}`,
      source: META_SOURCES.components,
    });
    const all = tokens(body);
    add({
      id: "body-format",
      label: "Variables are written {{1}}, {{2}}… with matching braces",
      ok:
        all.every((t) => /^\d+$/.test(t)) &&
        (body.match(/\{\{/g)?.length ?? 0) === all.length &&
        (body.match(/\}\}/g)?.length ?? 0) === all.length,
      source: META_SOURCES.review,
    });
    const numbers = variableNumbers(body);
    add({
      id: "body-sequential",
      label: "Variables are numbered in order from {{1}}",
      ok: numbers.every((n, i) => n === i + 1),
      detail: numbers.length ? `Found ${numbers.map((n) => `{{${n}}}`).join(", ")}` : undefined,
      source: META_SOURCES.review,
    });
    const trimmed = body.trim();
    add({
      id: "body-edges",
      label: "Body does not start or end with a variable",
      ok: !/^\{\{[^{}]*\}\}/.test(trimmed) && !/\{\{[^{}]*\}\}$/.test(trimmed),
      source: META_SOURCES.review,
    });
    add({
      id: "body-samples",
      label: "Every variable has a sample value",
      ok: numbers.every((n) => !!draft.examples[n - 1]?.trim()),
      source: META_SOURCES.components,
    });
    add({
      id: "body-ratio",
      label: "Not too many variables for the length of the text",
      ok: true,
      advisory: true,
      detail: `Meta rejects templates with too many variables for their length but publishes no number, so ${PRODUCT_NAME} does not block this.`,
      source: META_SOURCES.review,
    });
  } else {
    add({
      id: "auth-preset",
      label: "Authentication text is Meta's preset (the code is the only variable)",
      ok: true,
      detail: "The body cannot be edited. Optional lines: security advice and expiry.",
      source: META_SOURCES.authentication,
    });
    add({
      id: "auth-expiry",
      label: "Code expiry, if set, is 1 to 90 minutes",
      ok:
        draft.authExpiry === null ||
        (Number.isInteger(draft.authExpiry) && draft.authExpiry >= 1 && draft.authExpiry <= 90),
      source: META_SOURCES.authentication,
    });
  }

  if (!isAuth) {
    add({
      id: "footer",
      label: `Footer is at most ${LIMITS.footer} characters, text only`,
      ok: footer.length <= LIMITS.footer && tokens(footer).length === 0,
      detail: footer ? `${footer.length} / ${LIMITS.footer}` : undefined,
      source: META_SOURCES.components,
    });
  }

  if (!isAuth && !isCatalog) {
    const count = (type: TemplateButton["type"]) => buttons.filter((b) => b.type === type).length;
    add({
      id: "buttons-total",
      label: `At most ${LIMITS.buttons} buttons in total`,
      ok: buttons.length <= LIMITS.buttons,
      detail: `${buttons.length} / ${LIMITS.buttons}`,
      source: META_SOURCES.components,
    });
    add({
      id: "buttons-kinds",
      label: `Quick replies ≤ ${LIMITS.quickReplies}, URL ≤ ${LIMITS.urlButtons}, phone ≤ ${LIMITS.phoneButtons}, copy code ≤ ${LIMITS.copyCodeButtons}`,
      ok:
        count("quick_reply") <= LIMITS.quickReplies &&
        count("url") <= LIMITS.urlButtons &&
        count("phone") <= LIMITS.phoneButtons &&
        count("copy_code") <= LIMITS.copyCodeButtons,
      source: META_SOURCES.components,
    });
    if (count("copy_code"))
      add({
        id: "copy-code-category",
        label: "Copy code (coupon) buttons are for marketing templates",
        ok: draft.category === "MARKETING",
        source: META_SOURCES.coupon,
      });
    const labelled = buttons.filter(
      (b) => b.type === "quick_reply" || b.type === "url" || b.type === "phone",
    ) as Extract<TemplateButton, { text: string }>[];
    if (labelled.length)
      add({
        id: "button-text",
        label: `Every button text has 1 to ${LIMITS.buttonText} characters`,
        ok: labelled.every((b) => b.text.trim().length > 0 && b.text.length <= LIMITS.buttonText),
        source: META_SOURCES.components,
      });
    const urls = buttons.filter((b) => b.type === "url") as Extract<TemplateButton, { type: "url" }>[];
    if (urls.length)
      add({
        id: "button-url",
        label: `URL is a web address up to ${LIMITS.url} characters; a variable only as {{1}} at its end, with a sample`,
        ok: urls.every((b) => {
          const vars = tokens(b.url);
          const varOk =
            vars.length === 0 ||
            (vars.length === 1 && vars[0] === "1" && b.url.endsWith("{{1}}") && !!b.example.trim());
          return HTTP_RE.test(b.url.replace("{{1}}", "x")) && b.url.length <= LIMITS.url && varOk;
        }),
        source: META_SOURCES.components,
      });
    const phones = buttons.filter((b) => b.type === "phone") as Extract<TemplateButton, { type: "phone" }>[];
    if (phones.length)
      add({
        id: "button-phone",
        label: `Phone number is up to ${LIMITS.phone} characters`,
        ok: phones.every((b) => /^\+?[0-9 ()-]{4,}$/.test(b.phone) && b.phone.length <= LIMITS.phone),
        source: META_SOURCES.components,
      });
    const codes = buttons.filter((b) => b.type === "copy_code") as Extract<TemplateButton, { type: "copy_code" }>[];
    if (codes.length)
      add({
        id: "button-code",
        label: `Copy code sample is 1 to ${LIMITS.copyCode} characters`,
        ok: codes.every((b) => b.example.trim().length > 0 && b.example.length <= LIMITS.copyCode),
        source: META_SOURCES.coupon,
      });
  }

  if (isCatalog) {
    add({
      id: "catalog-button",
      label: 'Catalog template: one "View catalog" button, the header is the product thumbnail',
      ok: true,
      source: META_SOURCES.catalog,
    });
    add({
      id: "catalog-connected",
      label: "An e-commerce catalog is connected to the WhatsApp Business Account",
      ok: true,
      advisory: true,
      detail:
        "Meta needs inventory in a catalog connected to the account. This preview has no Meta account, so it cannot check this.",
      source: META_SOURCES.catalog,
    });
  }

  if (!isAuth) {
    // `others` never holds the template being edited (the builder leaves it out).
    const duplicate = others.some((t) => t.body.trim() === body.trim() && (t.footer ?? "").trim() === footer.trim());
    add({
      id: "duplicate",
      label: "Body and footer are not the same as another template",
      ok: !duplicate,
      source: META_SOURCES.review,
    });
  }
  return checks;
}

export const blocking = (checks: RuleCheck[]) => checks.filter((c) => !c.ok && !c.advisory);

/** Chatwoot's content type for the list row, from the draft. */
export function contentType(draft: TemplateDraft): WhatsAppTemplate["type"] {
  if (draft.category === "AUTHENTICATION") return "Copy code";
  if (draft.kind === "catalog") return "Catalog";
  if (draft.headerType === "image") return "Image";
  if (draft.headerType === "video") return "Video";
  if (draft.headerType === "document") return "Document";
  if (draft.buttons.some((b) => b.type === "copy_code")) return "Copy code";
  if (draft.buttons.some((b) => b.type === "url" || b.type === "phone")) return "Call to action";
  if (draft.buttons.some((b) => b.type === "quick_reply")) return "Quick reply";
  return "Text";
}

/** The list row for a draft, keeping the id and review of the row it replaces. */
export function recordFromDraft(
  draft: TemplateDraft,
  base: Pick<TemplateRecord, "id" | "status" | "review"> & { inbox: string },
): TemplateRecord {
  const language = LANGUAGES.find((l) => l.code === draft.code)?.language ?? "English";
  const media =
    draft.kind === "catalog"
      ? undefined
      : draft.headerType === "none" || draft.headerType === "text"
        ? undefined
        : draft.headerType;
  const body = effectiveBody(draft);
  const footer = effectiveFooter(draft);
  const buttons = effectiveButtons(draft).map(buttonLabel);
  const numbers = variableNumbers(body);
  return {
    id: base.id,
    name: draft.name,
    status: base.status,
    type: contentType(draft),
    category: draft.category,
    language,
    code: draft.code,
    inboxes: [base.inbox],
    provider: "Meta",
    ...(draft.category !== "AUTHENTICATION" && draft.headerType === "text" && draft.headerText
      ? { header: draft.headerText }
      : {}),
    ...(media ? { media } : {}),
    body,
    ...(footer ? { footer } : {}),
    ...(buttons.length ? { buttons } : {}),
    // WhatsAppTemplate.examples holds the samples of {{2}}, {{3}}… ({{1}} is the contact's first name in Chatwoot).
    ...(numbers.length > 1 ? { examples: numbers.slice(1).map((n) => draft.examples[n - 1] ?? "") } : {}),
    draft,
    review: base.review,
    simulated: true,
    updatedAt: new Date().toISOString(),
  };
}

/** A draft that reproduces a template made before M129-C (seed rows), so it can be opened in the builder. */
export function draftFromRecord(t: TemplateRecord): TemplateDraft {
  if (t.draft) return t.draft;
  const numbers = variableNumbers(t.body);
  const examples = numbers.map((n) => (n === 1 ? "Noura" : (t.examples?.[n - 2] ?? "")));
  const buttons: TemplateButton[] =
    t.type === "Copy code"
      ? [{ type: "copy_code", example: "123456" }]
      : (t.buttons ?? []).map((text) =>
          t.type === "Call to action"
            ? { type: "url", text, url: "https://weblabs.studio", example: "" }
            : { type: "quick_reply", text },
        );
  return {
    ...emptyDraft(),
    name: t.name,
    category: t.category,
    code: t.code,
    kind: t.type === "Catalog" ? "catalog" : "standard",
    headerType: t.media ?? (t.header ? "text" : "none"),
    headerText: t.header ?? "",
    body: t.category === "AUTHENTICATION" ? "" : t.body,
    examples,
    footer: t.footer ?? "",
    buttons: t.type === "Catalog" ? [] : buttons,
  };
}

/** Stable key of a list row: the id of preview-made rows, name + language of the seed rows. */
export const templateKey = (t: Pick<TemplateRecord, "id" | "name" | "code">) => t.id ?? `${t.name}:${t.code}`;

export function newTemplateId(): string {
  return `tpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A name not used yet in this language: base, base_2, base_3… */
export function freeName(base: string, code: string, list: Pick<WhatsAppTemplate, "name" | "code">[]): string {
  const used = new Set(list.filter((t) => t.code === code).map((t) => t.name));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}_${i}`)) return `${base}_${i}`;
}

// ---------- simulated review ----------

// M129-C round 2 (judge): no reason is claimed unless the user picks one. The reasons are the `reason` values Meta
// sends with a REJECTED template (message_template_status_update webhook), each with Meta's own meaning.
export const META_REJECTION_SOURCE =
  "https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/message_template_status_update";
export const REJECTION_REASONS: { code: string; meaning: string }[] = [
  { code: "INCORRECT_CATEGORY", meaning: "The content doesn't match the category chosen at creation." },
  { code: "TAG_CONTENT_MISMATCH", meaning: "The content doesn't match the category chosen at creation." },
  { code: "INVALID_FORMAT", meaning: "The template has an invalid format." },
  { code: "PROMOTIONAL", meaning: "The template contains content that violates WhatsApp policies." },
  { code: "ABUSIVE_CONTENT", meaning: "The template contains content that violates WhatsApp policies." },
  { code: "SCAM", meaning: "The template contains content that violates WhatsApp policies." },
];

/** How a simulated rejection is shown: no reason unless one was chosen in the simulation. */
export function rejectionText(reason?: string): string {
  if (!reason) return "Simulated rejection: no reason given";
  const known = REJECTION_REASONS.find((r) => r.code === reason);
  return known
    ? `Simulated rejection, reason chosen in the simulation: ${known.code} (${known.meaning})`
    : `Simulated rejection: ${reason}`;
}

export const REVIEW_DELAYS: { value: string; label: string; ms: number | null }[] = [
  { value: "10", label: "after 10 seconds", ms: 10_000 },
  { value: "30", label: "after 30 seconds", ms: 30_000 },
  { value: "120", label: "after 2 minutes", ms: 120_000 },
  { value: "sync", label: "only when I press Sync templates", ms: null },
];

/** Applies the simulated decisions that are due (`force` = Sync templates: also those waiting for a sync). */
export function applyDueReviews(
  list: TemplateRecord[],
  now: number,
  force = false,
): { list: TemplateRecord[]; decided: TemplateRecord[]; waiting: TemplateRecord[] } {
  const decided: TemplateRecord[] = [];
  const waiting: TemplateRecord[] = [];
  const next = list.map((t) => {
    if (t.status !== "PENDING" || !t.review || t.review.decidedAt) return t;
    const due = t.review.decideAt === null ? force : t.review.decideAt <= now;
    if (!due) {
      waiting.push(t);
      return t;
    }
    const updated: TemplateRecord = { ...t, status: t.review.outcome, review: { ...t.review, decidedAt: now } };
    decided.push(updated);
    return updated;
  });
  return { list: decided.length ? next : list, decided, waiting };
}

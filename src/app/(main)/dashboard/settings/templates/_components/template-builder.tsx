"use client";

// M129-C (Fahad 129.9): the "New template" page, in the order respond.io (Submit Template) and WATI (New Template
// Message) use: name, category, language, then header, body with variables and their samples, footer, buttons, a
// preview of the message as WhatsApp shows it, and Meta's rules checked before submitting (each with its Meta page).
// "Submit for approval" is simulated (Fahad 129.2): the template goes to Pending and a simulated Meta decision follows.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  Plus,
  Send,
  Trash2,
  Type,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_NAME } from "@/config/app-config";
import { SimBadge } from "@/lib/cw/preview-sim-ui";

import { SettingsBreadcrumb } from "../../_components/settings-breadcrumb";
import { PageHeader } from "../../labels/_shared/settings-shell";
import {
  AUTH_BODY,
  AUTH_SECURITY,
  authExpiryLine,
  blocking,
  CATEGORY_HELP,
  type Category,
  checkTemplate,
  draftFromRecord,
  effectiveBody,
  emptyDraft,
  formatBytes,
  HEADER_MEDIA,
  type HeaderType,
  LANGUAGES,
  LIMITS,
  META_REJECTION_SOURCE,
  REJECTION_REASONS,
  REVIEW_DELAYS,
  type RuleCheck,
  type TemplateButton,
  type TemplateDraft,
  templateKey,
  variableNumbers,
} from "./template-model";
import {
  findTemplate,
  SIM_NOTE,
  saveDraft,
  submitTemplate,
  useTemplateDeletions,
  useTemplates,
  useTemplatesReady,
} from "./template-store";
import { bubbleFromDraft, WhatsAppBubble } from "./whatsapp-bubble";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

const HEADER_TYPES: { value: HeaderType; label: string; icon: React.ElementType }[] = [
  { value: "none", label: "None", icon: X },
  { value: "text", label: "Text", icon: Type },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "document", label: "Document", icon: FileText },
];

/**
 * F-9: the form's action bar, fixed to the bottom of the screen over the form's own width. CSS `position: sticky`
 * cannot be used: the dashboard's content box has `overflow-x: hidden`, which makes it the sticky element's scroll
 * box, and that box never scrolls (the window does). A spacer of the bar's height ends the form, so the last field is
 * never under the bar; the bar follows the form's left edge and width when the window or the sidebar changes.
 */
function FormActionsBar({ children }: { children: React.ReactNode }) {
  const spacer = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null);
  React.useLayoutEffect(() => {
    const form = spacer.current?.parentElement;
    if (!form) return;
    const measure = () => {
      const rect = form.getBoundingClientRect();
      setBox((old) =>
        old && old.left === rect.left && old.width === rect.width ? old : { left: rect.left, width: rect.width },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(form);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <>
      <div ref={spacer} aria-hidden="true" className="h-14 shrink-0" />
      <div
        data-form-actions=""
        style={box ? { left: box.left, width: box.width } : undefined}
        className={cn(
          "fixed bottom-0 z-20 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          !box && "invisible",
        )}
      >
        {children}
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-4">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn("text-xs tabular-nums", value > max ? "text-destructive" : "text-muted-foreground")}>
      {value} / {max}
    </span>
  );
}

function RuleRow({ check }: { check: RuleCheck }) {
  const Icon = check.ok ? (check.advisory ? Info : Check) : CircleAlert;
  return (
    <li
      data-rule={check.id}
      data-rule-ok={check.ok ? "true" : "false"}
      className="flex items-start gap-2 py-1.5 text-sm"
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          check.ok
            ? check.advisory
              ? "text-muted-foreground"
              : "text-emerald-600 dark:text-emerald-400"
            : "text-destructive",
        )}
        aria-label={check.ok ? "Passes" : "Fails"}
      />
      <div className="grid min-w-0 gap-0.5">
        <span className={cn(!check.ok && "text-destructive")}>{check.label}</span>
        {check.detail ? <span className="text-muted-foreground text-xs">{check.detail}</span> : null}
        <a
          href={check.source}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-primary text-xs underline-offset-2 hover:underline"
        >
          Source: Meta <ExternalLink className="size-3" />
        </a>
      </div>
    </li>
  );
}

function ButtonEditor({
  button,
  onChange,
  onRemove,
}: {
  button: TemplateButton;
  onChange: (button: TemplateButton) => void;
  onRemove: () => void;
}) {
  const title =
    button.type === "quick_reply"
      ? "Quick reply"
      : button.type === "url"
        ? "Visit website"
        : button.type === "phone"
          ? "Call phone number"
          : button.type === "copy_code"
            ? "Copy offer code"
            : "View catalog";
  return (
    <div data-button-row={button.type} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{title}</span>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${title} button`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      {"text" in button ? (
        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs">Button text</Label>
            <Counter value={button.text.length} max={LIMITS.buttonText} />
          </div>
          <Input
            value={button.text}
            placeholder="Button text"
            aria-label={`${title} text`}
            onChange={(e) => onChange({ ...button, text: e.target.value })}
          />
        </div>
      ) : null}
      {button.type === "url" ? (
        <div className="grid gap-2 @md:grid-cols-[1fr_160px]">
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">
              Website URL (add {"{{1}}"} at the end for a variable part)
            </Label>
            <Input
              dir="ltr"
              value={button.url}
              placeholder="https://example.com/orders/{{1}}"
              aria-label="Website URL"
              onChange={(e) => onChange({ ...button, url: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">Sample for {"{{1}}"}</Label>
            <Input
              dir="ltr"
              value={button.example}
              placeholder="ORD-8824"
              aria-label="URL variable sample"
              disabled={!button.url.includes("{{")}
              onChange={(e) => onChange({ ...button, example: e.target.value })}
            />
          </div>
        </div>
      ) : null}
      {button.type === "phone" ? (
        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs">Phone number with country code</Label>
            <Counter value={button.phone.length} max={LIMITS.phone} />
          </div>
          <Input
            dir="ltr"
            value={button.phone}
            placeholder="+974 4400 1100"
            aria-label="Phone number"
            onChange={(e) => onChange({ ...button, phone: e.target.value })}
          />
        </div>
      ) : null}
      {button.type === "copy_code" ? (
        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs">Sample offer code</Label>
            <Counter value={button.example.length} max={LIMITS.copyCode} />
          </div>
          <Input
            dir="ltr"
            value={button.example}
            placeholder="EID25"
            aria-label="Sample offer code"
            onChange={(e) => onChange({ ...button, example: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function TemplateBuilder({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const ready = useTemplatesReady();
  const [list] = useTemplates();
  const deletions = useTemplateDeletions();
  const existing = templateId ? list.find((t) => templateKey(t) === templateId) : undefined;
  const [draft, setDraft] = React.useState<TemplateDraft | null>(templateId ? null : emptyDraft());
  const [mediaUrl, setMediaUrl] = React.useState<string | undefined>();
  const [showErrors, setShowErrors] = React.useState(false);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState<"APPROVED" | "REJECTED">("APPROVED");
  // "" = a simulated rejection with no reason claimed (the default).
  const [reason, setReason] = React.useState<string>("");
  const [delay, setDelay] = React.useState("10");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // A template opened by its link: wait for the saved list, then load its draft once.
  React.useEffect(() => {
    if (draft || !ready || !templateId) return;
    const found = findTemplate(templateId);
    if (found) setDraft(draftFromRecord(found));
  }, [draft, ready, templateId]);

  React.useEffect(() => () => (mediaUrl ? URL.revokeObjectURL(mediaUrl) : undefined), [mediaUrl]);

  if (!draft) {
    return (
      <div className="flex flex-col gap-4">
        <SettingsBreadcrumb
          items={[{ label: "Templates", href: "/dashboard/settings/templates" }, { label: "Template not found" }]}
        />
        <PageHeader
          title={ready ? "Template not found" : "Loading template…"}
          description={ready ? "This template may have been deleted." : "Reading the templates saved in the preview."}
        />
      </div>
    );
  }

  const locked = existing && (existing.status === "PENDING" || existing.status === "APPROVED");
  const others = list.filter((t) => !existing || templateKey(t) !== templateKey(existing));
  const checks = checkTemplate(draft, others, deletions);
  const failing = blocking(checks);
  const isAuth = draft.category === "AUTHENTICATION";
  const isCatalog = draft.category === "MARKETING" && draft.kind === "catalog";
  const fixedLibrary = !!draft.library && !draft.library.customized;
  const bodyNumbers = variableNumbers(isAuth ? AUTH_BODY : draft.body);
  const set = (patch: Partial<TemplateDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setButton = (index: number, button: TemplateButton) =>
    set({ buttons: draft.buttons.map((b, i) => (i === index ? button : b)) });
  const count = (type: TemplateButton["type"]) => draft.buttons.filter((b) => b.type === type).length;

  function addVariable() {
    const next = (variableNumbers(draft?.body ?? "").at(-1) ?? 0) + 1;
    const token = `{{${next}}}`;
    const el = bodyRef.current;
    const body = draft?.body ?? "";
    const at = el ? el.selectionStart : body.length;
    set({ body: `${body.slice(0, at)}${token}${body.slice(at)}` });
    window.requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  }

  function addButton(type: TemplateButton["type"]) {
    const button: TemplateButton =
      type === "quick_reply"
        ? { type, text: "" }
        : type === "url"
          ? { type, text: "", url: "https://", example: "" }
          : type === "phone"
            ? { type, text: "", phone: "" }
            : type === "copy_code"
              ? { type, example: "" }
              : { type: "catalog" };
    set({ buttons: [...draft!.buttons, button] });
  }

  function pickMedia(file: File | undefined) {
    if (!file || !draft) return;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined);
    set({ headerSample: { name: file.name, size: file.size, type: file.type } });
  }

  const [saving, setSaving] = React.useState(false);

  async function onSaveDraft() {
    if (!draft?.name.trim()) {
      setShowErrors(true);
      toast.error("Enter a template name to save the draft");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const id = await saveDraft(draft, existing ? templateKey(existing) : undefined);
      toast.success(`Draft ${draft.name} saved`, {
        description: `Saved in the ${PRODUCT_NAME} preview. Not submitted to Meta.`,
      });
      if (!existing) router.replace(`/dashboard/settings/templates/new?id=${encodeURIComponent(id)}`);
    } catch {
      // saveDraft already showed the Not saved toast and rolled back the list
    } finally {
      setSaving(false);
    }
  }

  function openSubmit() {
    setShowErrors(true);
    if (failing.length) {
      toast.error(`${failing.length} of Meta's rules fail`, { description: failing.map((c) => c.label).join(" · ") });
      return;
    }
    if (fixedLibrary) {
      void confirmSubmit();
      return;
    }
    setSubmitOpen(true);
  }

  async function confirmSubmit() {
    if (!draft || saving) return;
    const ms = REVIEW_DELAYS.find((d) => d.value === delay)?.ms ?? null;
    setSaving(true);
    try {
      await submitTemplate(draft, existing ? templateKey(existing) : undefined, {
        decideAt: ms === null ? null : Date.now() + ms,
        outcome,
        reason: outcome === "REJECTED" && reason ? reason : undefined,
      });
      setSubmitOpen(false);
      const when = REVIEW_DELAYS.find((d) => d.value === delay)?.label ?? "";
      toast.success(fixedLibrary ? `${draft.name} added as Approved` : `${draft.name} submitted: Pending`, {
        description: fixedLibrary
          ? `Meta Template Library text needs no review. ${SIM_NOTE}`
          : `Simulated decision: ${outcome === "APPROVED" ? "Approved" : "Rejected"} ${when}. ${SIM_NOTE}`,
      });
      router.push("/dashboard/settings/templates");
    } catch {
      // submitTemplate already showed the Not saved toast and rolled back the list
    } finally {
      setSaving(false);
    }
  }

  const bubble = bubbleFromDraft(draft, mediaUrl);

  return (
    <div className="@container flex flex-col gap-4">
      {/* م137 round 2 (judge M137): the path above the title, as on every Settings detail page, not a back link. */}
      <SettingsBreadcrumb
        items={[
          { label: "Templates", href: "/dashboard/settings/templates" },
          { label: existing ? existing.name : "New WhatsApp template" },
        ]}
      />
      <PageHeader
        title={existing ? existing.name : "New WhatsApp template"}
        description="Write the template, check it against Meta's rules, then submit it for approval. Meta reviews it before it can be sent."
      />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 border-dashed bg-amber-500/5 px-3 py-2 text-sm">
        <SimBadge />
        <span className="text-muted-foreground">
          Submitting is simulated: the template goes to Pending, then a simulated Meta decision (you choose it, or it is
          approved after a short wait). Meta receives nothing.
        </span>
      </div>
      {locked ? (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            This template is {existing?.status === "PENDING" ? "in review" : "approved"}, so it cannot be changed here.
            Use "Duplicate as draft" in the templates list to make a new version.
          </span>
        </div>
      ) : null}
      {draft.origin ? (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>Copied from {draft.origin}.</span>
        </div>
      ) : null}

      <fieldset disabled={locked} className="grid min-w-0 items-start gap-4 @4xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <Section title="Name, category and language" description="Meta reviews the category with the content.">
            <Field data-invalid={showErrors && !checks.find((c) => c.id === "name-format")?.ok ? true : undefined}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="tpl-name">Template name</FieldLabel>
                <Counter value={draft.name.length} max={LIMITS.name} />
              </div>
              <Input
                id="tpl-name"
                dir="ltr"
                value={draft.name}
                placeholder="order_update"
                aria-invalid={showErrors && !checks.find((c) => c.id === "name-format")?.ok ? true : undefined}
                onChange={(e) => set({ name: e.target.value })}
              />
              <FieldDescription>Lowercase letters, numbers and underscores only, e.g. eid_offer_2026.</FieldDescription>
            </Field>
            <div className="grid gap-2">
              <Label>Category</Label>
              <div role="radiogroup" aria-label="Category" className="grid gap-2 @xl:grid-cols-3">
                {CATEGORIES.map((c) => (
                  // biome-ignore lint/a11y/useSemanticElements: a card that acts as one radio of an ARIA radiogroup (title + help text)
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={draft.category === c.value}
                    data-category={c.value}
                    onClick={() => set({ category: c.value, kind: c.value === "MARKETING" ? draft.kind : "standard" })}
                    className={cn(
                      "grid gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                      draft.category === c.value && "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <span className="font-medium text-sm">{c.label}</span>
                    <span className="text-muted-foreground text-xs leading-snug">{CATEGORY_HELP[c.value]}</span>
                  </button>
                ))}
              </div>
            </div>
            {draft.category === "MARKETING" ? (
              <div className="grid gap-2">
                <Label>Template type</Label>
                <div role="radiogroup" aria-label="Template type" className="grid gap-2 @xl:grid-cols-2">
                  {(
                    [
                      { value: "standard", label: "Standard", help: "Text or media header, body, footer and buttons." },
                      {
                        value: "catalog",
                        label: "Catalog",
                        help: 'Shows your product catalog inside WhatsApp with one "View catalog" button (Meta catalog templates).',
                      },
                    ] as const
                  ).map((k) => (
                    // biome-ignore lint/a11y/useSemanticElements: a card that acts as one radio of an ARIA radiogroup (title + help text)
                    <button
                      key={k.value}
                      type="button"
                      role="radio"
                      aria-checked={draft.kind === k.value}
                      data-kind={k.value}
                      onClick={() => set({ kind: k.value })}
                      className={cn(
                        "grid gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                        draft.kind === k.value && "border-primary bg-primary/5 ring-1 ring-primary",
                      )}
                    >
                      <span className="font-medium text-sm">{k.label}</span>
                      <span className="text-muted-foreground text-xs leading-snug">{k.help}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor="tpl-language">Language</FieldLabel>
              <NativeSelect
                id="tpl-language"
                className="w-full"
                value={draft.code}
                onChange={(e) => set({ code: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </NativeSelect>
              <FieldDescription>
                One language per template. Meta does not translate it; add another template for each language.
              </FieldDescription>
            </Field>
          </Section>

          {isAuth ? null : (
            <Section
              title="Header"
              description={
                isCatalog
                  ? "Catalog templates use the product thumbnail as the header, so there is nothing to add here."
                  : "Optional. Text, or an image, video or document."
              }
            >
              {isCatalog ? null : (
                <>
                  <div role="radiogroup" aria-label="Header type" className="flex flex-wrap gap-2">
                    {HEADER_TYPES.map((h) => (
                      // biome-ignore lint/a11y/useSemanticElements: a card that acts as one radio of an ARIA radiogroup (title + help text)
                      <button
                        key={h.value}
                        type="button"
                        role="radio"
                        aria-checked={draft.headerType === h.value}
                        data-header-type={h.value}
                        disabled={fixedLibrary}
                        onClick={() => set({ headerType: h.value })}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-50",
                          draft.headerType === h.value && "border-primary bg-primary/5 ring-1 ring-primary",
                        )}
                      >
                        <h.icon className="size-3.5" /> {h.label}
                      </button>
                    ))}
                  </div>
                  {draft.headerType === "text" ? (
                    <div className="grid gap-2 @xl:grid-cols-[1fr_200px]">
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="tpl-header">Header text (one {"{{1}}"} allowed)</Label>
                          <Counter value={draft.headerText.length} max={LIMITS.headerText} />
                        </div>
                        <Input
                          id="tpl-header"
                          dir="auto"
                          value={draft.headerText}
                          readOnly={fixedLibrary}
                          onChange={(e) => set({ headerText: e.target.value })}
                        />
                      </div>
                      {draft.headerText.includes("{{") ? (
                        <div className="grid gap-1">
                          <Label htmlFor="tpl-header-sample">Sample for {"{{1}}"}</Label>
                          <Input
                            id="tpl-header-sample"
                            dir="auto"
                            value={draft.headerExample}
                            onChange={(e) => set({ headerExample: e.target.value })}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {draft.headerType === "image" || draft.headerType === "video" || draft.headerType === "document" ? (
                    <div className="grid gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        hidden
                        aria-label="Header sample file"
                        data-header-file=""
                        accept={HEADER_MEDIA[draft.headerType].types.join(",")}
                        onChange={(e) => {
                          pickMedia(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                          <Plus /> Choose sample {HEADER_MEDIA[draft.headerType].label.toLowerCase()}
                        </Button>
                        {draft.headerSample ? (
                          <span className="text-sm" data-header-sample="">
                            {draft.headerSample.name} · {formatBytes(draft.headerSample.size)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Meta accepts {HEADER_MEDIA[draft.headerType].extensions} up to{" "}
                        {formatBytes(HEADER_MEDIA[draft.headerType].maxBytes)}.{" "}
                        {HEADER_MEDIA[draft.headerType].note ?? ""} The file stays in this browser: the preview keeps
                        its name and size only.
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </Section>
          )}

          <Section
            title="Body"
            description={
              isAuth
                ? "Authentication templates use Meta's fixed text. You choose the optional lines."
                : "The message. Variables are {{1}}, {{2}}… and each needs a sample value for Meta's reviewer."
            }
            action={
              !isAuth && !fixedLibrary ? (
                <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                  <Plus /> Add variable
                </Button>
              ) : fixedLibrary ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => set({ library: draft.library ? { ...draft.library, customized: true } : undefined })}
                >
                  Customize text
                </Button>
              ) : null
            }
          >
            {isAuth ? (
              <div className="grid gap-3">
                <p className="rounded-md border bg-muted/40 p-3 text-sm" dir="ltr">
                  {effectiveBody(draft)}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="tpl-auth-security" className="font-normal">
                    Add the security advice: "{AUTH_SECURITY}"
                  </Label>
                  <Checkbox
                    id="tpl-auth-security"
                    checked={draft.authSecurity}
                    onCheckedChange={(v) => set({ authSecurity: v === true })}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label htmlFor="tpl-auth-expiry" className="font-normal">
                    Add the expiry line (1 to 90 minutes): "{authExpiryLine(draft.authExpiry ?? 10)}"
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="tpl-auth-expiry"
                      type="number"
                      min={1}
                      max={90}
                      className="h-8 w-20"
                      disabled={draft.authExpiry === null}
                      value={draft.authExpiry ?? ""}
                      onChange={(e) => set({ authExpiry: e.target.value ? Number(e.target.value) : 10 })}
                    />
                    <Checkbox
                      aria-label="Add the expiry line"
                      checked={draft.authExpiry !== null}
                      onCheckedChange={(v) => set({ authExpiry: v === true ? 10 : null })}
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tpl-auth-sample">Sample code</Label>
                  <Input
                    id="tpl-auth-sample"
                    dir="ltr"
                    className="w-40"
                    value={draft.examples[0] ?? ""}
                    placeholder="123456"
                    onChange={(e) => set({ examples: [e.target.value] })}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  The button is Meta's copy-code button. Authentication templates take no links and no media.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tpl-body">Message text</Label>
                    <Counter value={draft.body.length} max={LIMITS.body} />
                  </div>
                  <Textarea
                    id="tpl-body"
                    ref={bodyRef}
                    dir="auto"
                    rows={6}
                    readOnly={fixedLibrary}
                    value={draft.body}
                    placeholder="Hi {{1}}, your order {{2}} is on its way."
                    onChange={(e) => set({ body: e.target.value })}
                  />
                  <span className="text-muted-foreground text-xs">
                    WhatsApp formatting works: *bold*, _italic_, ~strikethrough~.
                  </span>
                </div>
                {bodyNumbers.length ? (
                  <div className="grid gap-2">
                    <Label>Sample values</Label>
                    {bodyNumbers.map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <Badge variant="outline" className="w-12 justify-center font-mono">{`{{${n}}}`}</Badge>
                        <Input
                          dir="auto"
                          className="h-8"
                          aria-label={`Sample value for {{${n}}}`}
                          placeholder={`Sample for {{${n}}}`}
                          value={draft.examples[n - 1] ?? ""}
                          onChange={(e) => {
                            const examples = [...draft.examples];
                            examples[n - 1] = e.target.value;
                            set({ examples });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </Section>

          {isAuth ? null : (
            <Section title="Footer" description="Optional short line under the message, text only.">
              <div className="grid gap-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-footer">Footer text</Label>
                  <Counter value={draft.footer.length} max={LIMITS.footer} />
                </div>
                <Input
                  id="tpl-footer"
                  dir="auto"
                  value={draft.footer}
                  readOnly={fixedLibrary}
                  placeholder="Reply STOP to unsubscribe"
                  onChange={(e) => set({ footer: e.target.value })}
                />
              </div>
            </Section>
          )}

          {isAuth || isCatalog ? null : (
            <Section
              title="Buttons"
              description={`Optional. Up to ${LIMITS.buttons} in total: quick replies (${count("quick_reply")}/${LIMITS.quickReplies}), website (${count("url")}/${LIMITS.urlButtons}), phone (${count("phone")}/${LIMITS.phoneButtons}), offer code (${count("copy_code")}/${LIMITS.copyCodeButtons}).`}
              action={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={draft.buttons.length >= LIMITS.buttons}>
                      <Plus /> Add button
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Quick reply</DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={count("quick_reply") >= LIMITS.quickReplies}
                      onSelect={() => addButton("quick_reply")}
                    >
                      Quick reply
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Call to action</DropdownMenuLabel>
                    <DropdownMenuItem disabled={count("url") >= LIMITS.urlButtons} onSelect={() => addButton("url")}>
                      Visit website
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={count("phone") >= LIMITS.phoneButtons}
                      onSelect={() => addButton("phone")}
                    >
                      Call phone number
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={count("copy_code") >= LIMITS.copyCodeButtons || draft.category !== "MARKETING"}
                      onSelect={() => addButton("copy_code")}
                    >
                      Copy offer code {draft.category !== "MARKETING" ? "(marketing only)" : ""}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            >
              {draft.buttons.length ? (
                <div className="grid gap-2">
                  {draft.buttons.map((b, i) => (
                    <ButtonEditor
                      // biome-ignore lint/suspicious/noArrayIndexKey: buttons have no id; order is their identity
                      key={i}
                      button={b}
                      onChange={(next) => setButton(i, next)}
                      onRemove={() => set({ buttons: draft.buttons.filter((_, j) => j !== i) })}
                    />
                  ))}
                  {count("quick_reply") && draft.buttons.length > count("quick_reply") ? (
                    <p className="text-muted-foreground text-xs">
                      Meta keeps quick replies together, apart from the other buttons, so the preview groups them.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No buttons.</p>
              )}
            </Section>
          )}
        </div>

        <div className="grid min-w-0 gap-4">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>How the message looks in WhatsApp, with the sample values.</CardDescription>
            </CardHeader>
            <CardContent>
              <WhatsAppBubble content={bubble} />
            </CardContent>
          </Card>
          <Card className="gap-3" data-rules-card="">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                Meta's rules
                <Badge
                  variant={failing.length ? "destructive" : "secondary"}
                  className="tabular-nums"
                  data-rules-summary=""
                >
                  {failing.length ? `${failing.length} to fix` : "All pass"}
                </Badge>
              </CardTitle>
              <CardDescription>Checked before submitting. Each rule links to Meta's page.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {failing.length ? (
                <ul className="divide-y" data-failing-rules="">
                  {failing.map((c) => (
                    <RuleRow key={c.id} check={c} />
                  ))}
                </ul>
              ) : null}
              <details className="group" data-all-rules="">
                <summary className="cursor-pointer text-muted-foreground text-sm">
                  {checks.length - failing.length} of {checks.length} rules pass · show every rule with its source
                </summary>
                <ul className="mt-1 divide-y">
                  {checks
                    .filter((c) => !failing.includes(c))
                    .map((c) => (
                      <RuleRow key={c.id} check={c} />
                    ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        </div>
      </fieldset>

      {/* F-9 (sim3 step 7.8b: Save draft and Submit sat in the page header and left the screen while filling the
          fields): one bar at the bottom of the form that stays on screen while the page scrolls. Shopify Polaris Page
          actions exist because "the primary call to action is sometimes hard to access when merchants are at the
          bottom of a page" (polaris.shopify.com/components/actions/page-actions), and its successor, the App Bridge
          Save Bar, keeps Save on screen while a form is edited. */}
      <FormActionsBar>
        <span className="me-auto text-muted-foreground text-sm" data-form-actions-status="">
          {locked
            ? "This template cannot be changed here."
            : failing.length
              ? `${failing.length} of Meta's rules to fix before submitting`
              : "All of Meta's rules pass"}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/templates">Cancel</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={locked || saving}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button size="sm" onClick={openSubmit} disabled={locked || saving}>
          <Send /> {saving ? "Saving…" : "Submit for approval"}
        </Button>
      </FormActionsBar>

      <Dialog open={submitOpen} onOpenChange={(next) => !saving && setSubmitOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit {draft.name} for approval</DialogTitle>
            <DialogDescription>
              Meta reviews templates within 24 hours. In this preview the review is simulated: choose its result.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 border-dashed bg-amber-500/5 p-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {SIM_NOTE} The status becomes Pending now.
            </div>
            <Field>
              <FieldLabel htmlFor="sim-outcome">Simulated Meta decision</FieldLabel>
              <NativeSelect
                id="sim-outcome"
                className="w-full"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as "APPROVED" | "REJECTED")}
              >
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </NativeSelect>
            </Field>
            {outcome === "REJECTED" ? (
              <Field>
                <FieldLabel htmlFor="sim-reason">Rejection reason</FieldLabel>
                <NativeSelect
                  id="sim-reason"
                  className="w-full"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">No reason (simulated rejection)</option>
                  {REJECTION_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code}: {r.meaning}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  Meta's reason codes for a rejected template. {PRODUCT_NAME} does not claim one unless you choose it
                  here.{" "}
                  <a
                    href={META_REJECTION_SOURCE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Source: Meta <ExternalLink className="size-3" />
                  </a>
                </FieldDescription>
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="sim-delay">The decision arrives</FieldLabel>
              <NativeSelect id="sim-delay" className="w-full" value={delay} onChange={(e) => setDelay(e.target.value)}>
                {REVIEW_DELAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={confirmSubmit} disabled={saving} data-confirm-submit="">
              <Send /> {saving ? "Saving…" : "Submit (simulated)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

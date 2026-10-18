"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Templates (templates/Index.vue, TemplateCard.vue,
// TemplatePreviewDrawer.vue, templateUtils.js; whatsappTemplateMgmt.json) in the Studio pattern.
// M129-C (Fahad 129.9, 129.2): the list is the account's one template list (lib/cw/store.ts `whatsappTemplates`,
// saved in the preview), with "New template" (builder), "Template library" and an honest simulated "Sync templates":
// it applies the simulated Meta decisions of Pending templates and says that Meta was not contacted.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  BookOpen,
  Check,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRODUCT_NAME } from "@/config/app-config";
import { SimBadge } from "@/lib/cw/preview-sim-ui";

import { NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, type Tone, ToneBadge } from "../../labels/_shared/settings-ui";
import {
  DELETED_NAME_DAYS,
  draftFromRecord,
  freeName,
  META_SOURCES,
  rejectionText,
  type TemplateRecord,
  templateKey,
} from "./template-model";
import {
  decideNow,
  deleteTemplate,
  SIM_NOTE,
  saveDraft,
  syncTemplates,
  useTemplateReviewClock,
  useTemplates,
} from "./template-store";
import { bubbleFromRecord, WhatsAppBubble } from "./whatsapp-bubble";

type Status = TemplateRecord["status"];
type TemplateType = TemplateRecord["type"];

function statusMeta(t: TemplateRecord): { label: string; tone: Tone } {
  const map: Record<Status, { label: string; tone: Tone }> = {
    APPROVED: { label: "approved", tone: "green" },
    PENDING: { label: "pending", tone: "amber" },
    REJECTED: { label: "rejected", tone: "red" },
    UNSUBMITTED: { label: t.simulated ? "draft" : "Not submitted for WhatsApp approval", tone: "gray" },
  };
  return map[t.status];
}

const typeIcon: Record<TemplateType, React.ElementType> = {
  Text: MessageCircle,
  Image: ImageIcon,
  Video,
  Document: FileText,
  Media: ImageIcon,
  "Quick reply": MessageCircle,
  "Call to action": Phone,
  Catalog: ShoppingBag,
  "Copy code": Copy,
};

const allTypes: TemplateType[] = [
  "Text",
  "Image",
  "Video",
  "Document",
  "Media",
  "Quick reply",
  "Call to action",
  "Catalog",
  "Copy code",
];
const statusOptions = ["All statuses", "Approved", "Pending", "Rejected", "Draft or not submitted"];

function stamp(date: Date | number) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** "decision in 7 s" for a Pending template with a simulated review. */
function reviewLine(t: TemplateRecord, now: number): string | null {
  const r = t.review;
  if (!r) return null;
  if (t.status === "PENDING") {
    if (r.decideAt === null) return `Simulated decision (${r.outcome.toLowerCase()}) waits for Sync templates`;
    const left = Math.max(0, Math.ceil((r.decideAt - now) / 1000));
    return `Simulated decision (${r.outcome.toLowerCase()}) in ${left} s`;
  }
  if (r.decidedAt)
    return `${t.status === "APPROVED" ? "Approved" : "Rejected"} by the simulated review on ${stamp(r.decidedAt)}`;
  return null;
}

export function TemplatesList() {
  const router = useRouter();
  useTemplateReviewClock();
  const [templates] = useTemplates();
  const [query, setQuery] = React.useState("");
  const [inbox, setInbox] = React.useState("All inboxes");
  const [language, setLanguage] = React.useState("All languages");
  const [type, setType] = React.useState("All types");
  const [status, setStatus] = React.useState("All statuses");
  const [previewKey, setPreviewKey] = React.useState<string | undefined>();
  const [deleting, setDeleting] = React.useState<TemplateRecord | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const preview = previewKey ? templates.find((t) => templateKey(t) === previewKey) : undefined;

  const counting = templates.some((t) => t.status === "PENDING" && t.review?.decideAt);
  React.useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [counting]);

  const allInboxes = Array.from(new Set(templates.flatMap((t) => t.inboxes)));
  const q = query.trim().toLowerCase();
  const rows = templates.filter(
    (t) =>
      (inbox === "All inboxes" || t.inboxes.includes(inbox)) &&
      (language === "All languages" || t.language === language) &&
      (type === "All types" || t.type === type) &&
      (status === "All statuses" ||
        (status === "Approved" && t.status === "APPROVED") ||
        (status === "Pending" && t.status === "PENDING") ||
        (status === "Rejected" && t.status === "REJECTED") ||
        (status === "Draft or not submitted" && t.status === "UNSUBMITTED")) &&
      `${t.name} ${t.body}`.toLowerCase().includes(q),
  );

  function sync() {
    setSyncing(true);
    window.setTimeout(() => {
      const { decided, waiting, untouched } = syncTemplates();
      setSyncing(false);
      setLastSync(stamp(Date.now()));
      const approved = decided.filter((t) => t.status === "APPROVED").length;
      const rejected = decided.length - approved;
      const parts = [
        `${approved} approved`,
        `${rejected} rejected`,
        `${waiting.length + untouched.length} still pending`,
      ];
      toast.info(`Sync simulated: ${parts.join(", ")}`, {
        description: `${SIM_NOTE} Only the simulated decisions of templates submitted in this preview change a status${
          untouched.length ? `; ${untouched.map((t) => t.name).join(", ")} is sample data with no simulated review` : ""
        }.`,
        duration: 8000,
      });
    }, 900);
  }

  async function duplicate(t: TemplateRecord) {
    const draft = draftFromRecord(t);
    const name = freeName(`${t.name}_copy`, t.code, templates);
    try {
      const id = await saveDraft({ ...draft, name, library: undefined, origin: `${t.name} (${t.code})` });
      toast.success(`Draft ${name} created`, {
        description: `Saved in the ${PRODUCT_NAME} preview. Not submitted to Meta.`,
      });
      router.push(`/dashboard/settings/templates/new?id=${encodeURIComponent(id)}`);
    } catch {
      // saveDraft already showed the Not saved toast and rolled back the list
    }
  }

  return (
    <>
      <SettingsShell
        title="Templates"
        description="WhatsApp message templates. Create one and submit it for Meta's approval, or copy a ready-made one from the Template library. In this preview, submitting and syncing are simulated."
        learnMore="Learn more about WhatsApp templates"
        count={plural(rows.length, "template", "templates")}
        search={{ placeholder: "Search by content or name...", value: query, onChange: setQuery }}
        cardTitle="WhatsApp templates"
        cardDescription={
          lastSync
            ? `Last simulated sync on ${lastSync}. Meta was not contacted.`
            : "Sync is simulated in this preview: Meta is not contacted."
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings/templates/library">
                <BookOpen /> Template library
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={sync} disabled={syncing} data-sync-templates="">
              <RefreshCw className={syncing ? "animate-spin" : undefined} /> Sync templates
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/settings/templates/new">
                <Plus /> New template
              </Link>
            </Button>
          </>
        }
      >
        <ChipBar>
          <ChipSelect label="Inbox" value={inbox} options={["All inboxes", ...allInboxes]} onChange={setInbox} />
          <ChipSelect label="Status" value={status} options={statusOptions} onChange={setStatus} />
          <ChipSelect
            label="Language"
            value={language}
            options={["All languages", "English", "Arabic"]}
            onChange={setLanguage}
          />
          <ChipSelect label="Type" value={type} options={["All types", ...allTypes]} onChange={setType} />
        </ChipBar>
        {rows.length ? (
          <div className="divide-y">
            {rows.map((t) => {
              const Icon = typeIcon[t.type];
              const meta = statusMeta(t);
              const key = templateKey(t);
              const line = reviewLine(t, now);
              return (
                // biome-ignore lint/a11y/useSemanticElements: row holds a nested preview button, as TemplateCard.vue.
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  data-template-row={t.name}
                  data-template-status={t.status}
                  onClick={() => setPreviewKey(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPreviewKey(key);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-muted/40 shadow-xs">
                      <Icon className="size-5 text-muted-foreground" />
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{t.name}</span>
                        <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                        {t.simulated ? <SimBadge /> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                        <span>{t.type}</span>
                        <span className="h-3 w-px bg-border" />
                        <span>{t.category.toLowerCase()}</span>
                        <span className="h-3 w-px bg-border" />
                        <span>{t.language}</span>
                        <span className="h-3 w-px bg-border" />
                        <span className="truncate">
                          {t.inboxes[0]}
                          {t.inboxes.length > 1 ? ` +${t.inboxes.length - 1}` : ""}
                        </span>
                      </div>
                      <p className="line-clamp-1 max-w-2xl text-muted-foreground text-xs" dir="auto">
                        {t.body}
                      </p>
                      {line ? (
                        <p className="text-muted-foreground text-xs" data-review-line="">
                          {line}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Preview ${t.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewKey(key);
                        }}
                      >
                        <Eye />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Template preview</TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        ) : (
          <NoResults>
            {templates.length ? "No templates match your filters." : "No WhatsApp templates found."}
          </NoResults>
        )}
      </SettingsShell>

      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreviewKey(undefined)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Template preview</SheetTitle>
            <SheetDescription>Preview how this template appears in WhatsApp.</SheetDescription>
          </SheetHeader>
          {preview ? (
            <div className="grid gap-5 overflow-y-auto p-4">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {preview.name}
                {preview.simulated ? <SimBadge /> : null}
              </div>
              <WhatsAppBubble content={bubbleFromRecord(preview)} />
              <div className="grid gap-3">
                <span className="font-medium text-sm">Template details</span>
                <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="grid gap-1">
                    <ToneBadge tone={statusMeta(preview).tone}>{statusMeta(preview).label}</ToneBadge>
                    {reviewLine(preview, now) ? (
                      <span className="text-muted-foreground text-xs">{reviewLine(preview, now)}</span>
                    ) : null}
                  </dd>
                  {preview.status === "REJECTED" && preview.review ? (
                    <>
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd data-rejection-reason="">{rejectionText(preview.review.reason)}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Content type</dt>
                  <dd>{preview.type}</dd>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{preview.category.toLowerCase()}</dd>
                  <dt className="text-muted-foreground">Language</dt>
                  <dd>
                    {preview.language} ({preview.code})
                  </dd>
                  <dt className="text-muted-foreground">Inboxes</dt>
                  <dd className="flex flex-wrap gap-1">
                    {preview.inboxes.map((i) => (
                      <ToneBadge key={i} tone="gray" dot={false}>
                        {i}
                      </ToneBadge>
                    ))}
                  </dd>
                  {preview.draft?.origin ? (
                    <>
                      <dt className="text-muted-foreground">Copied from</dt>
                      <dd>{preview.draft.origin}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
              {preview.status === "PENDING" && preview.review ? (
                <div className="grid gap-2 rounded-lg border border-amber-500/40 border-dashed bg-amber-500/5 p-3">
                  <span className="flex items-center gap-2 font-medium text-sm">
                    <SimBadge /> Decide the simulated review now
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => decideNow(templateKey(preview), "APPROVED")}>
                      <Check /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideNow(templateKey(preview), "REJECTED", preview.review?.reason)}
                    >
                      <X /> Reject
                    </Button>
                  </div>
                  <span className="text-muted-foreground text-xs">{SIM_NOTE}</span>
                </div>
              ) : null}
              {preview.status === "PENDING" && !preview.review ? (
                <div className="grid gap-2 rounded-lg border border-amber-500/40 border-dashed bg-amber-500/5 p-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <SimBadge /> Sample template in review
                  </span>
                  <span className="text-muted-foreground text-xs">Choose its simulated decision. {SIM_NOTE}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => decideNow(templateKey(preview), "APPROVED")}>
                      <Check /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decideNow(templateKey(preview), "REJECTED")}>
                      <X /> Reject
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {preview.provider === "Meta" &&
                (preview.status === "UNSUBMITTED" || preview.status === "REJECTED") &&
                preview.simulated ? (
                  <Button size="sm" asChild>
                    <Link href={`/dashboard/settings/templates/new?id=${encodeURIComponent(templateKey(preview))}`}>
                      <Pencil /> {preview.status === "REJECTED" ? "Edit and resubmit" : "Edit draft"}
                    </Link>
                  </Button>
                ) : null}
                {preview.provider === "Meta" ? (
                  <Button size="sm" variant="outline" onClick={() => duplicate(preview)}>
                    <CopyPlus /> Duplicate as draft
                  </Button>
                ) : null}
                {preview.provider === "Meta" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeleting(preview)}
                    data-delete-template=""
                  >
                    <Trash2 /> Delete template
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleting?.name} ({deleting?.code})?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="grid gap-2" data-delete-dialog="">
                <span>The template leaves this list, and campaigns that use it can no longer send it.</span>
                {deleting?.status === "APPROVED" ? (
                  <span>
                    It is approved: Meta does not let you create a new template with the same name for{" "}
                    {DELETED_NAME_DAYS} days after deleting it.{" "}
                    <a
                      href={META_SOURCES.management}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Source: Meta <ExternalLink className="size-3" />
                    </a>
                  </span>
                ) : null}
                <span>{SIM_NOTE}</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-confirm-delete=""
              onClick={() => {
                const row = deleting;
                setDeleting(null);
                setPreviewKey(undefined);
                if (!row) return;
                // F-3: said only once the preview saved the deletion (a refused save says why itself).
                void deleteTemplate(templateKey(row)).then((deleted) => {
                  if (!deleted) return;
                  toast.success(`${row.name} (${row.code}) deleted`, {
                    description:
                      row.status === "APPROVED"
                        ? `Its name cannot be reused for ${DELETED_NAME_DAYS} days. ${SIM_NOTE}`
                        : SIM_NOTE,
                  });
                });
              }}
            >
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

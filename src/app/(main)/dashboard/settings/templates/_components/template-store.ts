"use client";

// M129-C: the WhatsApp templates are the shared list `whatsappTemplates` (lib/cw/store.ts). It is saved on the preview
// server's disk through /api/studio-preview-state (lib/cw/persistence), so drafts, submissions and their simulated
// review stay after a reload. Nothing here reaches Meta: the review is simulated and says so.
import * as React from "react";

import { toast } from "sonner";
import { create } from "zustand";

import { PRODUCT_NAME } from "@/config/app-config";
import { loadPreviewSection, SectionConflict, savePreviewSection } from "@/lib/cw/persistence/client";
import { CHANGED_ELSEWHERE, setCwList, useCwList, useCwPersistence, useCwShared, whenListsSaved } from "@/lib/cw/store";

import type { LibraryEntry } from "./template-library-data";
import {
  applyDueReviews,
  emptyDraft,
  freeName,
  newTemplateId,
  recordFromDraft,
  rejectionText,
  type SimReview,
  type TemplateDeletion,
  type TemplateDraft,
  type TemplateRecord,
  templateKey,
} from "./template-model";

export const WHATSAPP_INBOX = "WhatsApp Business";
export const SIM_NOTE = `Simulated in the ${PRODUCT_NAME} preview: Meta received nothing.`;

export function useTemplates(): [
  TemplateRecord[],
  (next: TemplateRecord[] | ((prev: TemplateRecord[]) => TemplateRecord[])) => void,
] {
  const [list, setList] = useCwList("whatsappTemplates");
  return [
    list as TemplateRecord[],
    setList as (next: TemplateRecord[] | ((prev: TemplateRecord[]) => TemplateRecord[])) => void,
  ];
}

/** True once the saved lists were read (or could not be read), so a template opened by its link can be found. */
export function useTemplatesReady(): boolean {
  return useCwPersistence((s) => s.status !== "loading");
}

const getList = () => useCwShared.getState().whatsappTemplates as TemplateRecord[];
const setList = (next: TemplateRecord[]) => setCwList("whatsappTemplates", next);

export function findTemplate(id: string): TemplateRecord | undefined {
  return getList().find((t) => templateKey(t) === id);
}

function notSavedReason(error: unknown): string {
  if (error instanceof Error && error.message === CHANGED_ELSEWHERE) return "changed in another tab or device";
  return error instanceof Error ? error.message : String(error);
}

async function persistTemplatesChange<T>(change: () => T): Promise<T> {
  const before = getList();
  const saved = whenListsSaved(["whatsappTemplates"]);
  const result = change();
  try {
    await saved;
    return result;
  } catch (error) {
    if (!(error instanceof Error && error.message === CHANGED_ELSEWHERE)) {
      setList(before);
      toast.error(`Not saved (${notSavedReason(error)})`);
    }
    throw error;
  }
}

/** Saves the draft as a row (new or replacing `id`), status Draft. Resolves with the row id after the server saves it. */
export async function saveDraft(draft: TemplateDraft, id?: string): Promise<string> {
  return persistTemplatesChange(() => {
    const list = getList();
    const current = id ? list.find((t) => templateKey(t) === id) : undefined;
    const rowId = current?.id ?? newTemplateId();
    const row = recordFromDraft(draft, { id: rowId, status: "UNSUBMITTED", review: undefined, inbox: WHATSAPP_INBOX });
    setList(current ? list.map((t) => (t === current ? row : t)) : [row, ...list]);
    return rowId;
  });
}

/** Puts the template in Pending with its simulated decision. Library text that was not customized is approved at once. */
export async function submitTemplate(
  draft: TemplateDraft,
  id: string | undefined,
  decision: Omit<SimReview, "submittedAt">,
): Promise<string> {
  return persistTemplatesChange(() => {
    const list = getList();
    const current = id ? list.find((t) => templateKey(t) === id) : undefined;
    const rowId = current?.id ?? newTemplateId();
    const now = Date.now();
    const fixedLibrary = !!draft.library && !draft.library.customized;
    const review: SimReview = fixedLibrary
      ? { submittedAt: now, decideAt: now, outcome: "APPROVED", decidedAt: now }
      : { ...decision, submittedAt: now };
    const row = recordFromDraft(draft, {
      id: rowId,
      status: fixedLibrary ? "APPROVED" : "PENDING",
      review,
      inbox: WHATSAPP_INBOX,
    });
    setList(current ? list.map((t) => (t === current ? row : t)) : [row, ...list]);
    return rowId;
  });
}

/** Sets the simulated decision of a Pending template now (the preview sheet's Approve / Reject). */
export async function decideNow(id: string, outcome: "APPROVED" | "REJECTED", reason?: string): Promise<void> {
  const now = Date.now();
  await persistTemplatesChange(() => {
    setList(
      getList().map((t) =>
        templateKey(t) === id && t.status === "PENDING"
          ? {
              ...t,
              status: outcome,
              review: { submittedAt: t.review?.submittedAt ?? now, decideAt: now, outcome, reason, decidedAt: now },
            }
          : t,
      ),
    );
  });
}

// ---------- delete (M129-C round 2) ----------
// Meta lets a business delete a template (WhatsApp Manager or the API); after an approved one is deleted, its name
// cannot be used again for 30 days (templates/template-management). The row leaves the shared list; an approved
// one's name is also kept in the preview's saved section "templateDeletions" so the builder can check the 30 days.

const DELETIONS = "templateDeletions";
interface DeletionsState {
  status: "idle" | "loading" | "ready" | "error";
  items: TemplateDeletion[];
  rev: number;
}
export const useTemplateDeletionsStore = create<DeletionsState>(() => ({ status: "idle", items: [], rev: 0 }));

async function loadDeletions() {
  const section = await loadPreviewSection<TemplateDeletion>(DELETIONS);
  useTemplateDeletionsStore.setState({ status: "ready", items: section.items ?? [], rev: section.rev });
}

/** The deleted approved templates (read once per page load). */
export function useTemplateDeletions(): TemplateDeletion[] {
  React.useEffect(() => {
    if (useTemplateDeletionsStore.getState().status !== "idle") return;
    useTemplateDeletionsStore.setState({ status: "loading" });
    loadDeletions().catch((error: Error) => {
      useTemplateDeletionsStore.setState({ status: "error" });
      console.error(`[templates] deleted names not loaded: ${error.message}`);
    });
  }, []);
  return useTemplateDeletionsStore((s) => s.items);
}

async function recordDeletion(entry: TemplateDeletion) {
  for (let conflicts = 0; ; conflicts++) {
    const { items, rev } = useTemplateDeletionsStore.getState();
    const next = [...items, entry];
    try {
      const saved = await savePreviewSection(DELETIONS, next, rev, true);
      useTemplateDeletionsStore.setState({ status: "ready", items: next, rev: saved.rev });
      return;
    } catch (error) {
      if (!(error instanceof SectionConflict) || conflicts >= 3) throw error;
      await loadDeletions();
    }
  }
}

/**
 * Deletes the template from the preview. Returns the row that was deleted, or undefined when there was none or the
 * preview did not save the deletion (F-3: e.g. this page is out of date, 409; the page already says so). The 30-day
 * name rule is kept only once the deletion itself is saved.
 */
export async function deleteTemplate(id: string): Promise<TemplateRecord | undefined> {
  const before = getList();
  const row = before.find((t) => templateKey(t) === id);
  if (!row) return undefined;
  const listSaved = whenListsSaved(["whatsappTemplates"]); // F-6B: only a conflict on the templates list itself
  setList(before.filter((t) => templateKey(t) !== id));
  const notSaved = await listSaved.then(
    () => null,
    (error: Error) => error,
  );
  if (notSaved) {
    // A 409 already has its own message (lib/cw/store.ts); any other failure rolls back and is said here.
    if (notSaved.message !== CHANGED_ELSEWHERE) {
      setList(before);
      toast.error(`${row.name} (${row.code}) not deleted`, { description: `Not saved: ${notSaved.message}` });
    }
    return undefined;
  }
  if (row.status === "APPROVED" && row.provider === "Meta") {
    if (useTemplateDeletionsStore.getState().status !== "ready") await loadDeletions();
    await recordDeletion({ name: row.name, code: row.code, deletedAt: new Date().toISOString() }).catch(
      (error: Error) => {
        toast.error("The 30-day name rule could not be saved", {
          description: `${error.message}. The template was deleted.`,
        });
      },
    );
  }
  return row;
}

/** One click in the Template library: a new draft with a free name in that language. Resolves after the server saves it. */
export async function copyToDraft(entry: LibraryEntry, code: string): Promise<{ id: string; name: string }> {
  const version = entry.versions.find((v) => v.code === code) ?? entry.versions[0];
  const list = getList();
  const name = freeName(version.draft.name, version.code, list);
  const draft: TemplateDraft = {
    ...emptyDraft(),
    ...version.draft,
    name,
    code: version.code,
    category: entry.category,
    origin: `${entry.sourceLabel}: ${entry.title}`,
  };
  const id = await saveDraft(draft);
  return { id, name };
}

function announce(decided: TemplateRecord[]) {
  for (const t of decided) {
    const approved = t.status === "APPROVED";
    toast[approved ? "success" : "error"](`${t.name} (${t.code}) ${approved ? "approved" : "rejected"}`, {
      id: `template-review-${templateKey(t)}`,
      description: `${approved ? "" : `${rejectionText(t.review?.reason)}. `}${SIM_NOTE}`,
    });
  }
}

/** Applies the simulated decisions as they come due (every second while a templates page is open). */
export function useTemplateReviewClock() {
  const ready = useTemplatesReady();
  React.useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const { list, decided } = applyDueReviews(getList(), Date.now());
      if (!decided.length) return;
      setList(list);
      announce(decided);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [ready]);
}

/** Sync templates (simulated): gives every Pending template its simulated decision that is due or waits for a sync. */
export function syncTemplates(): { decided: TemplateRecord[]; waiting: TemplateRecord[]; untouched: TemplateRecord[] } {
  const all = getList();
  const { list, decided, waiting } = applyDueReviews(all, Date.now(), true);
  if (decided.length) setList(list);
  // Pending rows with no simulated review (the sample data) keep their status: there is no decision to apply.
  const untouched = list.filter((t) => t.status === "PENDING" && !t.review);
  return { decided, waiting, untouched };
}

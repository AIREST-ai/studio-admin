// F-17 (T-91): server side of the owner's site sections. They are one section of the preview state file
// ("siteSections", lib/cw/persistence/file-store.ts), saved with its revision: a save based on an older revision is
// refused (409) and nothing is written, the same safe save as the other sections (F-3). Server only (node:fs).
import {
  DEFAULT_PREVIEW_STATE_FILE,
  type PreviewSection,
  readPreviewState,
  writePreviewSection,
} from "@/lib/cw/persistence/file-store";

import { EMPTY_SITE_SECTIONS, type SiteSectionOverride, type SiteSectionsState, sectionById } from "./site-sections";

export const SITE_SECTIONS_KEY = "siteSections";

function toState(section: PreviewSection | undefined): SiteSectionsState {
  if (!section) return EMPTY_SITE_SECTIONS;
  return {
    rev: section.rev,
    savedAt: section.savedAt,
    // A row for a section this build does not list any more is kept in the file but not applied.
    overrides: (section.items as unknown as SiteSectionOverride[]).filter((item) => sectionById(item.id)),
  };
}

/** The owner's changes as saved now. Throws when the state file cannot be read. */
export async function readSiteSections(file = DEFAULT_PREVIEW_STATE_FILE): Promise<SiteSectionsState> {
  const state = await readPreviewState(file);
  return toState(state?.sections[SITE_SECTIONS_KEY]);
}

/** For pages: the saved changes, or the defaults when the file cannot be read (the console shows the error). */
export async function readSiteSectionsSafe(): Promise<SiteSectionsState & { error?: string }> {
  try {
    return await readSiteSections();
  } catch (error) {
    return { ...EMPTY_SITE_SECTIONS, error: `saved state unreadable: ${(error as Error).message}` };
  }
}

/**
 * Sets one section shown or hidden over the revision the caller read (`baseRev`). Its row is kept only while it
 * differs from the default, so setting it back to its default leaves no trace of the change in the file.
 * Throws PreviewConflict (another tab or device saved first) or InvalidPreviewState.
 */
export async function saveSiteSection(
  id: string,
  shown: boolean,
  baseRev: number,
  by: string,
  file = DEFAULT_PREVIEW_STATE_FILE,
): Promise<SiteSectionsState> {
  const section = sectionById(id);
  if (!section) throw new Error(`unknown section: ${id}`);
  const current = await readSiteSections(file);
  const rows = current.overrides.filter((item) => item.id !== id);
  if (shown !== section.defaultShown) rows.push({ id, shown, changedAt: new Date().toISOString(), by });
  // writePreviewSection checks baseRev against the file again inside its one-at-a-time write, so two saves that read
  // the same revision cannot both pass.
  const saved = await writePreviewSection(file, SITE_SECTIONS_KEY, rows, baseRev);
  return toState(saved);
}

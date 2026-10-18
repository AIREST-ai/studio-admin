// L-2 (plan r1-chatwoot-link/خطة.md 2.2): the "Preview" / "Linked" switch, kept in .preview-state/chatwoot-link.json.
// Only the server routes under src/app/api/chatwoot/ write it (mode/route.ts), and the dashboard layout reads it so
// a linked section renders linked from the first byte. It holds no secret.
// - A missing or damaged file means "preview" (plan 2.2).
// - CHATWOOT_LINK_DISABLED=1 (or true/yes) on the preview server forces "preview" and refuses the switch: the
//   emergency off (plan 2.2, risk 13).
// - Phase 1 links conversations and contacts only; the other sections stay false until their phase.
// biome-ignore lint/correctness/noUndeclaredDependencies: Next.js resolves "server-only" itself (node_modules/next/dist/docs/01-app/02-guides/data-security.md)
import "server-only";

import {
  LINK_SECTIONS,
  type LinkMode,
  type LinkSection,
  type LinkState,
  PHASE1_SECTIONS,
} from "@/lib/chatwoot-link-types";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const LINK_FILE = path.join(process.cwd(), ".preview-state", "chatwoot-link.json");

export function linkDisabled(): boolean {
  return /^(1|true|yes)$/i.test((process.env.CHATWOOT_LINK_DISABLED ?? "").trim());
}

function noSections(): Record<LinkSection, boolean> {
  return Object.fromEntries(LINK_SECTIONS.map((section) => [section, false])) as Record<LinkSection, boolean>;
}

/** The saved switch, cleaned: unknown keys dropped, sections of later phases kept off. */
function clean(saved: unknown): Omit<LinkState, "disabled"> {
  const raw = (saved && typeof saved === "object" ? saved : {}) as {
    mode?: unknown;
    sections?: unknown;
    changedAt?: unknown;
  };
  const sections = noSections();
  const rawSections = (raw.sections && typeof raw.sections === "object" ? raw.sections : {}) as Record<string, unknown>;
  for (const section of PHASE1_SECTIONS) sections[section] = rawSections[section] === true;
  return {
    mode: raw.mode === "linked" ? "linked" : "preview",
    sections,
    changedAt: typeof raw.changedAt === "string" ? raw.changedAt : null,
  };
}

export async function readLinkState(): Promise<LinkState> {
  let saved: unknown = null;
  try {
    saved = JSON.parse(await readFile(LINK_FILE, "utf8"));
  } catch {
    saved = null; // missing or damaged: preview (plan 2.2)
  }
  const state = clean(saved);
  if (linkDisabled()) return { mode: "preview", sections: noSections(), changedAt: state.changedAt, disabled: true };
  return { ...state, disabled: false };
}

export function sectionLinked(state: LinkState, section: LinkSection): boolean {
  return !state.disabled && state.mode === "linked" && state.sections[section] === true;
}

/** Saves the switch (temp file + rename, so a crash never leaves half a file) and returns what is now in force. */
export async function writeLinkState(
  mode: LinkMode,
  sections: Partial<Record<LinkSection, boolean>>,
): Promise<LinkState> {
  const next = clean({ mode, sections, changedAt: new Date().toISOString() });
  await mkdir(path.dirname(LINK_FILE), { recursive: true });
  const temp = `${LINK_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(next)}\n`);
  await rename(temp, LINK_FILE);
  return readLinkState();
}

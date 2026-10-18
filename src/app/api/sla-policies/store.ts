// T-261 (buried 6, item 5): where the SLA policies of Settings > SLA are saved. Server only.
// One JSON file per space in .preview-state/sla-policies/ on the preview machine's disk; it never reads or writes
// .preview-state/studio-preview-state.json (the shared lists). Same contract as T-232's capacity policies:
// - the whole list carries `rev`; a save names the `baseRev` it was made from;
// - the save is refused (SlaConflictError -> 409 with the saved list) when the list was saved since, so an old tab can
//   never overwrite a newer save (the page then re-applies its own change on the saved list and saves again);
// - saves are serialised per file and written to a temporary file then renamed; a file that cannot be read is never
//   overwritten.

import { initialSlas, type Sla } from "@/app/(main)/dashboard/settings/sla/_components/sla-data";
import { PRODUCT_NAME } from "@/config/app-config";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const SLA_DIR = path.join(process.cwd(), ".preview-state", "sla-policies");
export const LOCATION_LABEL = `${PRODUCT_NAME} preview server (this Mac's disk), shared by every browser`;
const MAX_POLICIES = 200;
// Chatwoot stores thresholds as seconds (float); a year is far above any real promise.
const MAX_SECONDS = 365 * 86_400;

export interface SlaSnapshot {
  space: string;
  location: string;
  rev: number;
  savedAt: string | null;
  policies: Sla[];
}

interface SavedSlas {
  version: 1;
  space: string;
  rev: number;
  savedAt: string;
  policies: Sla[];
}

export class InvalidSla extends Error {}

export class SlaConflictError extends Error {
  constructor(readonly current: SlaSnapshot) {
    super("SLA policies were saved from another tab or device after you opened them");
  }
}

export function parseSpace(value: string | null): string | null {
  return value && /^[a-z0-9-]{1,40}$/.test(value) ? value : null;
}

const threshold = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_SECONDS);

/** The list as sent by the page, or InvalidSla. Rules of Chatwoot's SLA form (validations.js) and model. */
export function validateSlas(value: unknown): Sla[] {
  if (!Array.isArray(value) || value.length > MAX_POLICIES) throw new InvalidSla("policies must be a list");
  const ids = new Set<number>();
  const names = new Set<string>();
  return value.map((raw, i) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const where = `SLA ${i + 1}`;
    if (typeof p.id !== "number" || !Number.isSafeInteger(p.id) || p.id < 1 || ids.has(p.id))
      throw new InvalidSla(`${where}: bad id`);
    ids.add(p.id);
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (name.length < 2 || name.length > 200) throw new InvalidSla(`${where}: SLA name needs 2 to 200 characters`);
    if (names.has(name.toLowerCase())) throw new InvalidSla(`${where}: SLA name already exists`);
    names.add(name.toLowerCase());
    if (typeof p.description !== "string" || p.description.length > 2000)
      throw new InvalidSla(`${where}: bad description`);
    for (const key of ["frt", "nrt", "rt"] as const)
      if (!threshold(p[key])) throw new InvalidSla(`${where}: Threshold should be a number and greater than zero`);
    if (p.frt === null && p.nrt === null && p.rt === null)
      throw new InvalidSla(`${where}: Set at least one threshold time`);
    if (typeof p.businessHours !== "boolean") throw new InvalidSla(`${where}: bad business hours`);
    return {
      id: p.id,
      name,
      description: p.description,
      frt: p.frt as number | null,
      nrt: p.nrt as number | null,
      rt: p.rt as number | null,
      businessHours: p.businessHours,
    };
  });
}

const fileOf = (space: string) => path.join(SLA_DIR, `${space}.json`);

async function readSaved(space: string): Promise<SavedSlas | null> {
  let raw: string;
  try {
    raw = await readFile(fileOf(space), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = (JSON.parse(raw) ?? {}) as SavedSlas;
  if (parsed.version !== 1 || !Number.isInteger(parsed.rev) || !Array.isArray(parsed.policies))
    throw new Error("saved SLA policies file has an unknown format");
  return parsed;
}

const snapshotOf = (space: string, saved: SavedSlas | null): SlaSnapshot => ({
  space,
  location: LOCATION_LABEL,
  rev: saved?.rev ?? 0,
  savedAt: saved?.savedAt ?? null,
  policies: saved?.policies ?? initialSlas,
});

// One queue per space: a save reads, checks the revision and writes before the next save starts.
const queues = new Map<string, Promise<unknown>>();
function serialised<T>(space: string, work: () => Promise<T>): Promise<T> {
  const run = (queues.get(space) ?? Promise.resolve()).then(work, work);
  queues.set(
    space,
    run.catch(() => undefined),
  );
  return run;
}

export async function loadSlas(space: string): Promise<SlaSnapshot> {
  return snapshotOf(space, await readSaved(space));
}

export function saveSlas(space: string, baseRev: number, policies: Sla[]): Promise<SlaSnapshot> {
  return serialised(space, async () => {
    const saved = await readSaved(space);
    const current = snapshotOf(space, saved);
    if (current.rev !== baseRev) throw new SlaConflictError(current);
    const next: SavedSlas = { version: 1, space, rev: current.rev + 1, savedAt: new Date().toISOString(), policies };
    await mkdir(SLA_DIR, { recursive: true });
    const file = fileOf(space);
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(temp, file);
    return snapshotOf(space, next);
  });
}

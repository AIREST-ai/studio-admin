// T-232 (Fahad item 78.1): where the agent capacity policies are saved. Server only.
// One JSON file per space in .preview-state/capacity-policies/ on the preview machine's disk; it never reads or writes
// .preview-state/studio-preview-state.json (the shared lists). Same contract as T-244's tasks board (tasks-board/store.ts):
// - the whole list carries `rev`; a save names the `baseRev` it was made from;
// - the save is refused (CapacityConflictError -> 409 with the saved list) when the list was saved since, so an old
//   tab can never overwrite a newer save;
// - saves are serialised per file and written to a temporary file then renamed; a file that cannot be read is never
//   overwritten.

import {
  type CapacityPolicy,
  capacityPolicies,
} from "@/app/(main)/dashboard/settings/assignment-policy/_components/data";
import { PRODUCT_NAME } from "@/config/app-config";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const CAPACITY_DIR = path.join(process.cwd(), ".preview-state", "capacity-policies");
export const LOCATION_LABEL = `${PRODUCT_NAME} preview server (this Mac's disk), shared by every browser`;
const MAX_POLICIES = 200;

export interface CapacitySnapshot {
  space: string;
  location: string;
  rev: number;
  savedAt: string | null;
  policies: CapacityPolicy[];
}

interface SavedCapacity {
  version: 1;
  space: string;
  rev: number;
  savedAt: string;
  policies: CapacityPolicy[];
}

export class InvalidCapacity extends Error {}

export class CapacityConflictError extends Error {
  constructor(readonly current: CapacitySnapshot) {
    super("capacity policies were saved from another tab or device after you opened them");
  }
}

export function parseSpace(value: string | null): string | null {
  return value && /^[a-z0-9-]{1,40}$/.test(value) ? value : null;
}

const wholeNumber = (value: unknown, min: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min;
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max;

/** The list as sent by the page, or InvalidCapacity. Limits are whole numbers of 1 or more. */
export function validatePolicies(value: unknown): CapacityPolicy[] {
  if (!Array.isArray(value) || value.length > MAX_POLICIES) throw new InvalidCapacity("policies must be a list");
  const ids = new Set<number>();
  return value.map((raw, i) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const where = `policy ${i + 1}`;
    if (!wholeNumber(p.id, 1) || ids.has(p.id as number)) throw new InvalidCapacity(`${where}: bad id`);
    ids.add(p.id as number);
    if (!text(p.name, 200) || !(p.name as string).trim()) throw new InvalidCapacity(`${where}: name is required`);
    if (!text(p.description, 2000)) throw new InvalidCapacity(`${where}: bad description`);
    if (!Array.isArray(p.limits) || !p.limits.every((l) => wholeNumber(l?.inbox, 1) && wholeNumber(l?.max, 1)))
      throw new InvalidCapacity(`${where}: each inbox limit needs an inbox and a limit of 1 or more`);
    if (!Array.isArray(p.labels) || !p.labels.every((l) => text(l, 100)))
      throw new InvalidCapacity(`${where}: bad labels`);
    if (typeof p.excludeOlderThan !== "number" || !(p.excludeOlderThan >= 0))
      throw new InvalidCapacity(`${where}: bad exclusion age`);
    if (!Array.isArray(p.agents) || !p.agents.every((a) => wholeNumber(a, 1)))
      throw new InvalidCapacity(`${where}: bad agents`);
    return {
      id: p.id as number,
      name: (p.name as string).trim(),
      description: p.description as string,
      limits: (p.limits as { inbox: number; max: number }[]).map(({ inbox, max }) => ({ inbox, max })),
      labels: p.labels as string[],
      excludeOlderThan: p.excludeOlderThan,
      agents: p.agents as number[],
    };
  });
}

const fileOf = (space: string) => path.join(CAPACITY_DIR, `${space}.json`);

async function readSaved(space: string): Promise<SavedCapacity | null> {
  let raw: string;
  try {
    raw = await readFile(fileOf(space), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = (JSON.parse(raw) ?? {}) as SavedCapacity;
  if (parsed.version !== 1 || !Number.isInteger(parsed.rev) || !Array.isArray(parsed.policies))
    throw new Error("saved capacity policies file has an unknown format");
  return parsed;
}

const snapshotOf = (space: string, saved: SavedCapacity | null): CapacitySnapshot => ({
  space,
  location: LOCATION_LABEL,
  rev: saved?.rev ?? 0,
  savedAt: saved?.savedAt ?? null,
  policies: saved?.policies ?? capacityPolicies,
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

export async function loadCapacity(space: string): Promise<CapacitySnapshot> {
  return snapshotOf(space, await readSaved(space));
}

export function saveCapacity(space: string, baseRev: number, policies: CapacityPolicy[]): Promise<CapacitySnapshot> {
  return serialised(space, async () => {
    const saved = await readSaved(space);
    const current = snapshotOf(space, saved);
    if (current.rev !== baseRev) throw new CapacityConflictError(current);
    const next: SavedCapacity = {
      version: 1,
      space,
      rev: current.rev + 1,
      savedAt: new Date().toISOString(),
      policies,
    };
    await mkdir(CAPACITY_DIR, { recursive: true });
    const file = fileOf(space);
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(temp, file);
    return snapshotOf(space, next);
  });
}

// F-20 (Fahad, 15 Oct 15:20 and 15:25): the board is read from and saved to /api/dodge-board, the preview server's
// route to the board engine (lib/twenty/dodges.ts), instead of the "dodgeBoard" section of the preview save. The
// contract is the one the board had (F-9): items + revision, and a save over an older revision is refused (409) and
// never written over. The old section is left as it was, to go back to (board.ts BOARD_SECTION).
import { type SavedSection, SectionConflict } from "@/lib/cw/persistence/client";

const ENDPOINT = "/api/dodge-board";

async function reason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return `${response.status} ${body?.error ?? response.statusText}`;
}

/** The saved board: the cards in board order, then the column order. */
export async function loadDodgeBoard<T>(): Promise<SavedSection<T>> {
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(`load failed: ${await reason(response)}`);
  const body = (await response.json()) as { items: T[] | null; rev: number; savedAt: string | null };
  return { items: body.items, rev: body.rev, savedAt: body.savedAt };
}

/** Saves `items` over revision `baseRev`; resolves with the new revision, throws SectionConflict on 409. */
export async function saveDodgeBoard(items: unknown[], baseRev: number): Promise<{ rev: number; savedAt: string }> {
  const response = await fetch(ENDPOINT, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, baseRev }),
  }).catch((error: Error) => {
    throw new Error(`the preview server could not be reached (${error.message})`);
  });
  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as { error?: string; rev?: number } | null;
    throw new SectionConflict(`save refused: ${body?.error ?? "conflict"}`, body?.rev ?? baseRev);
  }
  if (!response.ok) throw new Error(`save failed: ${await reason(response)}`);
  return (await response.json()) as { rev: number; savedAt: string };
}

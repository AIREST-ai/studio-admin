import { NextResponse } from "next/server";

import type { AuditChange, AuditContext } from "@/lib/audit/with-audit";
import { withAudit } from "@/lib/audit/with-audit";
import { ownNames } from "@/lib/own-names";
import {
  DODGE_COLUMNS,
  type DodgeBoard,
  type DodgeCard,
  type DodgeColumn,
  DodgeConflict,
  describeDodgeModel,
  readDodgeBoard,
  saveDodgeBoard,
} from "@/lib/twenty/dodges";
import { TwentyError } from "@/lib/twenty/server";

// F-20: the Dodge board's own save route, kept in the preview's tasks engine (lib/twenty/dodges.ts), with the same
// contract the board had on /api/studio-preview-state?section=dodgeBoard (F-9):
//   GET -> { items, rev, savedAt }: the cards in board order, then { kind: "columns", ids } (the column order).
//   GET ?model=1 -> the object, fields and column groups the board is kept in (read back, no ids or addresses).
//   PUT { items, baseRev } -> { rev, savedAt }, or 409 { error, rev } (nothing written) when the board was saved
//   elsewhere since baseRev. Only the card fields the board has are accepted; anything else is refused, not ignored.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 200_000;
const MAX_CARDS = 200;
const MAX_TEXT = 4_000;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

// Errors reach the page in the product's words (F-16, lib/own-names.ts), naming this board's server.
const words = (text: string) => ownNames(text).replace(/\btasks server\b/g, "board server");

function failFrom(error: unknown) {
  if (error instanceof TwentyError) return fail(error.status, words(error.message));
  return fail(500, words((error as Error).message) || "unexpected error");
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

const CARD_KEYS = ["kind", "id", "column", "conversationId", "problem", "dodge", "betterReply", "dueDate", "ownerId"];

function cardFrom(raw: Record<string, unknown>, at: number): DodgeCard | string {
  const extra = Object.keys(raw).filter((key) => !CARD_KEYS.includes(key));
  if (extra.length) return `card ${at}: unknown fields ${extra.join(", ")}`;
  const { id, column, conversationId, problem, dodge, betterReply, dueDate, ownerId } = raw;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return `card ${at}: id is not valid`;
  if (!DODGE_COLUMNS.includes(column as DodgeColumn)) return `card ${at}: column is not valid`;
  if (typeof conversationId !== "number" || !Number.isInteger(conversationId) || conversationId < 1)
    return `card ${at}: conversationId is not valid`;
  for (const [name, value] of Object.entries({ problem, dodge, betterReply }))
    if (typeof value !== "string" || value.length > MAX_TEXT) return `card ${at}: ${name} is not valid`;
  if (
    dueDate !== "" &&
    (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)))
  )
    return `card ${at}: dueDate must be YYYY-MM-DD or ""`;
  if (ownerId !== null && (typeof ownerId !== "number" || !Number.isInteger(ownerId) || ownerId < 0))
    return `card ${at}: ownerId is not valid`;
  return {
    kind: "card",
    id,
    column: column as DodgeColumn,
    conversationId,
    problem: problem as string,
    dodge: dodge as string,
    betterReply: betterReply as string,
    dueDate: dueDate as string,
    ownerId: ownerId as number | null,
  };
}

function boardFrom(items: unknown): { cards: DodgeCard[]; columns: DodgeColumn[] | null } | string {
  if (!Array.isArray(items)) return "items must be a list";
  const cards: DodgeCard[] = [];
  let columns: DodgeColumn[] | null = null;
  for (const [at, raw] of items.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return `item ${at} must be an object`;
    const item = raw as Record<string, unknown>;
    if (item.kind === "columns") {
      const ids = item.ids;
      const extra = Object.keys(item).filter((key) => key !== "kind" && key !== "ids");
      if (extra.length) return `columns: unknown fields ${extra.join(", ")}`;
      if (
        !Array.isArray(ids) ||
        ids.length !== DODGE_COLUMNS.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => DODGE_COLUMNS.includes(id as DodgeColumn))
      )
        return "columns must name each column once";
      columns = ids as DodgeColumn[];
    } else if (item.kind === "card") {
      const card = cardFrom(item, at);
      if (typeof card === "string") return card;
      cards.push(card);
    } else return `item ${at}: kind must be "card" or "columns"`;
  }
  if (cards.length > MAX_CARDS) return `at most ${MAX_CARDS} cards`;
  if (new Set(cards.map((card) => card.id)).size !== cards.length) return "two cards have the same id";
  return { cards, columns };
}

export async function GET(request: Request) {
  try {
    // ?model=1: what the board is kept in (object, fields, column groups), read back from the engine, for checks.
    if (new URL(request.url).searchParams.get("model") === "1")
      return NextResponse.json(await describeDodgeModel(), { headers });
    return NextResponse.json(await readDodgeBoard(), { headers });
  } catch (error) {
    return failFrom(error);
  }
}

async function put(request: Request) {
  if (!sameOrigin(request)) return fail(403, "cross-origin write refused");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, "board too large");
  let body: { items?: unknown; baseRev?: unknown } | null;
  try {
    body = JSON.parse(text) as { items?: unknown; baseRev?: unknown } | null;
  } catch {
    return fail(400, "body is not JSON");
  }
  if (!body || typeof body !== "object") return fail(400, "body must be { items, baseRev }");
  if (typeof body.baseRev !== "number") return fail(409, "save refused: no baseRev (reload the board)");
  const board = boardFrom(body.items);
  if (typeof board === "string") return fail(400, board);
  try {
    const saved = await saveDodgeBoard(board.cards, board.columns, body.baseRev);
    return NextResponse.json({ rev: saved.rev, savedAt: saved.savedAt }, { headers });
  } catch (error) {
    if (error instanceof DodgeConflict)
      return NextResponse.json({ error: error.message, rev: error.rev }, { status: 409, headers });
    return failFrom(error);
  }
}

/* ------------------------------------------------------------------ activity log -------------------------------- */

const columnTitle: Record<string, string> = {
  detected: "Dodge detected",
  "in-progress": "In progress",
  waiting: "Waiting on customer",
  solved: "Solved",
};

function cardsOf(items: unknown): Map<string, DodgeCard> {
  const out = new Map<string, DodgeCard>();
  if (Array.isArray(items))
    for (const item of items as Array<Partial<DodgeCard>>)
      if (item?.kind === "card" && typeof item.id === "string") out.set(item.id, item as DodgeCard);
  return out;
}

function columnsOf(items: unknown): string {
  const item = Array.isArray(items)
    ? (items as Array<{ kind?: string; ids?: unknown }>).find((each) => each?.kind === "columns")
    : undefined;
  return Array.isArray(item?.ids) ? item.ids.join(",") : "";
}

/** One line per card added, moved, changed or deleted, and one for a new column order (lib/audit/with-audit.ts). */
function describeDodgeBoard(context: AuditContext<DodgeBoard | null>): AuditChange[] {
  if (context.status >= 400) return [];
  const json = context.json as { items?: unknown } | null;
  const before = cardsOf(context.before?.items);
  const now = cardsOf(json?.items);
  const out: AuditChange[] = [];
  const name = (card: DodgeCard) => `#${card.conversationId}: ${card.problem}`.slice(0, 80);
  const target = (card: DodgeCard) => ({ id: card.id, name: name(card), type: "dodge_card" });
  for (const [id, card] of now) {
    const prior = before.get(id);
    if (!prior) {
      out.push({
        action: "dodge_card.create",
        crud: "c",
        summary: `added the dodge card "${name(card)}" to ${columnTitle[card.column]}`,
        target: target(card),
        after: card,
      });
      continue;
    }
    const keys = (["column", "problem", "dodge", "betterReply", "dueDate", "ownerId"] as const).filter(
      (key) => prior[key] !== card[key],
    );
    if (!keys.length) continue;
    const moved = keys.includes("column");
    out.push({
      action: moved ? "dodge_card.move" : "dodge_card.update",
      crud: "u",
      summary: moved
        ? `moved the dodge card "${name(card)}" from ${columnTitle[prior.column]} to ${columnTitle[card.column]}`
        : `updated the dodge card "${name(card)}" (${keys.join(", ")})`,
      target: target(card),
      before: Object.fromEntries(keys.map((key) => [key, prior[key]])),
      after: Object.fromEntries(keys.map((key) => [key, card[key]])),
    });
  }
  for (const [id, card] of before)
    if (!now.has(id))
      out.push({
        action: "dodge_card.delete",
        crud: "d",
        summary: `deleted the dodge card "${name(card)}"`,
        target: target(card),
        before: card,
      });
  const oldOrder = columnsOf(context.before?.items);
  const newOrder = columnsOf(json?.items);
  if (newOrder && oldOrder !== newOrder)
    out.push({
      action: "dodge_board.reorder_columns",
      crud: "u",
      summary: "changed the Dodge board column order",
      target: { id: "dodge-board", name: "Dodge board", type: "dodge_board" },
      before: { columns: oldOrder },
      after: { columns: newOrder },
    });
  return out;
}

export const PUT = withAudit<DodgeBoard | null>(
  { area: "dodge_board", snapshot: () => readDodgeBoard().catch(() => null), describe: describeDodgeBoard },
  put,
);

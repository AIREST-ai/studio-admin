import { columnIds } from "./data";
import { channelTitle, conversationHref, conversationOf, type SavedCard, seedCards } from "./seed";
import type { BoardState, ColumnId, Task } from "./types";

// F-9 (sim3 step 11.2b: "Changes are saved in this browser only"): the board is kept on the preview server, in the
// "dodgeBoard" section of the preview save (lib/cw/persistence/file-store.ts), with a revision: a save from a tab that
// read an older board is refused (409) and never written over, as every other preview list (F-3). Until it is first
// saved, the board shows the dodges marked on the preview's conversations (seed.ts).
// F-20: the board is now kept in the board engine through /api/dodge-board (board-api.ts, lib/twenty/dodges.ts), with
// the same items, revision and 409. Its 15 cards were moved there as they were; the "dodgeBoard" section below is no
// longer read or written and stays as it was, to go back to (load/save it again in kanban.tsx).
export const BOARD_SECTION = "dodgeBoard";

export interface SavedColumns {
  kind: "columns";
  ids: ColumnId[];
}

export type SavedItem = SavedCard | SavedColumns;

/** The board as saved: every card in board order (column by column), then the column order. */
export function toSavedItems(board: BoardState, columnOrder: ColumnId[]): SavedItem[] {
  return [
    ...columnIds.flatMap((column) =>
      board[column].map(
        (task): SavedCard => ({
          kind: "card",
          id: task.id,
          column,
          conversationId: task.conversationId,
          problem: task.problem,
          dodge: task.dodge,
          betterReply: task.betterReply,
          dueDate: task.dueDate,
          ownerId: task.ownerId,
        }),
      ),
    ),
    { kind: "columns", ids: columnOrder },
  ];
}

/** A saved card with what its conversation says now (customer, channel, link) and its owner's current name. */
export function taskFromCard(card: SavedCard, ownerName: (id: number | null) => string): Task | null {
  const conversation = conversationOf(card.conversationId);
  if (!conversation) return null;
  return {
    id: card.id,
    conversationId: card.conversationId,
    customer: conversation.name,
    channel: channelTitle(card.conversationId),
    problem: card.problem,
    dodge: card.dodge,
    betterReply: card.betterReply,
    dueDate: card.dueDate,
    ownerId: card.ownerId,
    owner: { name: ownerName(card.ownerId), tone: "" },
    conversationHref: conversationHref(card.conversationId),
  };
}

/** Saved items (or the marked dodges when nothing was saved yet) -> the board and its column order. */
export function boardFromItems(
  items: readonly unknown[] | null,
  ownerName: (id: number | null) => string,
): { board: BoardState; columnOrder: ColumnId[] } {
  const board: BoardState = { detected: [], "in-progress": [], waiting: [], solved: [] };
  let columnOrder: ColumnId[] = [...columnIds];
  const source: readonly unknown[] = items ?? seedCards();
  for (const raw of source) {
    const item = raw as Partial<SavedItem> | null;
    if (item?.kind === "columns" && Array.isArray(item.ids) && item.ids.length === columnIds.length) {
      if (item.ids.every((id) => columnIds.includes(id))) columnOrder = item.ids as ColumnId[];
    } else if (item?.kind === "card" && columnIds.includes(item.column as ColumnId)) {
      const task = taskFromCard(item as SavedCard, ownerName);
      if (task) board[item.column as ColumnId].push(task);
    }
  }
  return { board, columnOrder };
}

export function findColumnOf(board: BoardState, id: string): ColumnId | undefined {
  return columnIds.find((columnId) => board[columnId].some((task) => task.id === id));
}

export function addTask(board: BoardState, columnId: ColumnId, task: Task): BoardState {
  return { ...board, [columnId]: [task, ...board[columnId]] };
}

export function deleteTask(board: BoardState, id: string): BoardState {
  const columnId = findColumnOf(board, id);
  if (!columnId) return board;
  return { ...board, [columnId]: board[columnId].filter((task) => task.id !== id) };
}

// Same column: replaced in place. Other column: moved to the end of it.
export function updateTask(board: BoardState, task: Task, columnId: ColumnId): BoardState {
  const from = findColumnOf(board, task.id);
  if (!from) return board;
  if (from === columnId) {
    return { ...board, [from]: board[from].map((item) => (item.id === task.id ? task : item)) };
  }
  const without = deleteTask(board, task.id);
  return { ...without, [columnId]: [...without[columnId], task] };
}

export function moveTask(board: BoardState, id: string, columnId: ColumnId): BoardState {
  const from = findColumnOf(board, id);
  const task = from && board[from].find((item) => item.id === id);
  if (!from || !task || from === columnId) return board;
  return updateTask(board, task, columnId);
}

export function shiftTask(board: BoardState, id: string, delta: -1 | 1): BoardState {
  const columnId = findColumnOf(board, id);
  if (!columnId) return board;
  const tasks = board[columnId];
  const index = tasks.findIndex((task) => task.id === id);
  const target = index + delta;
  if (target < 0 || target >= tasks.length) return board;
  const next = [...tasks];
  [next[index], next[target]] = [next[target], next[index]];
  return { ...board, [columnId]: next };
}

export function moveColumn(order: ColumnId[], columnId: ColumnId, delta: -1 | 1): ColumnId[] {
  const index = order.indexOf(columnId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function nextTaskId(conversationId: number): string {
  return `dodge-${conversationId}-${Date.now().toString(36)}`;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDueDate(iso: string): string {
  if (!iso) return "No due date";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${monthNames[Number(match[2]) - 1] ?? match[2]} ${Number(match[3])}`;
}

export type SortMode = "board" | "due" | "customer";

export type BoardView = {
  query: string;
  channels: string[];
  owners: string[];
  sort: SortMode;
};

export const defaultView: BoardView = { query: "", channels: [], owners: [], sort: "board" };

export function isViewActive(view: BoardView): boolean {
  return view.query.trim() !== "" || view.channels.length > 0 || view.owners.length > 0 || view.sort !== "board";
}

// Search/filter/sort change what is shown only; the saved board order stays as it is.
export function viewTasks(tasks: Task[], view: BoardView): Task[] {
  if (!isViewActive(view)) return tasks;
  const query = view.query.trim().toLowerCase();
  const shown = tasks.filter(
    (task) =>
      (!query || task.customer.toLowerCase().includes(query) || task.problem.toLowerCase().includes(query)) &&
      (view.channels.length === 0 || view.channels.includes(task.channel)) &&
      (view.owners.length === 0 || view.owners.includes(task.owner.name)),
  );
  // a card with no due date goes after the dated ones
  if (view.sort === "due") return [...shown].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  if (view.sort === "customer") return [...shown].sort((a, b) => a.customer.localeCompare(b.customer));
  return shown;
}

export type TaskDraft = {
  conversationId: number;
  problem: string;
  dodge: string;
  betterReply: string;
  dueDate: string;
  ownerId: number | null;
  columnId: ColumnId;
};

export type DraftErrors = Partial<Record<keyof TaskDraft, string>>;

export function validateDraft(draft: TaskDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!conversationOf(draft.conversationId)) errors.conversationId = "Pick the conversation of the dodge.";
  if (!draft.problem.trim()) errors.problem = "Problem is required.";
  if (!draft.dodge.trim()) errors.dodge = "Dodge is required.";
  if (draft.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) || Number.isNaN(Date.parse(draft.dueDate)))) {
    errors.dueDate = "Pick a due date, or leave it empty.";
  }
  if (!columnIds.includes(draft.columnId)) errors.columnId = "Pick a column.";
  return errors;
}

export function draftFromTask(task: Task, columnId: ColumnId): TaskDraft {
  return {
    conversationId: task.conversationId,
    problem: task.problem,
    dodge: task.dodge,
    betterReply: task.betterReply,
    dueDate: task.dueDate,
    ownerId: task.ownerId,
    columnId,
  };
}

export function taskFromDraft(id: string, draft: TaskDraft, ownerName: (id: number | null) => string): Task | null {
  return taskFromCard(
    {
      kind: "card",
      id,
      column: draft.columnId,
      conversationId: draft.conversationId,
      problem: draft.problem.trim(),
      dodge: draft.dodge.trim(),
      betterReply: draft.betterReply.trim(),
      dueDate: draft.dueDate,
      ownerId: draft.ownerId,
    },
    ownerName,
  );
}

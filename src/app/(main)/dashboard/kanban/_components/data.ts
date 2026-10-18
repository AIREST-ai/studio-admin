import type { BoardState, Column } from "./types";

// F-9 (sim3 step 11.2b: 13 made-up cards, "No conversation linked", saved in this browser only): the cards are now
// dodges in the preview's own conversations (seed.ts) and the board is saved on the preview server (board.ts). What a
// dodge is comes from AIREST's own site: "a reply that leaves the problem unsolved".
export const columns = [
  { id: "detected", title: "Dodge detected", hint: "A reply left the problem open" },
  { id: "in-progress", title: "In progress", hint: "Owner contacts the customer" },
  { id: "waiting", title: "Waiting on customer", hint: "Fix sent, customer to confirm" },
  { id: "solved", title: "Solved", hint: "Problem over" },
] as const satisfies readonly Column[];

export const columnIds = columns.map((column) => column.id);

// The channel names of the inbox (chat/_components/data.ts channelItems); any other channel gets the neutral tone.
const tones: Record<string, string> = {
  WhatsApp: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Messenger: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Instagram: "bg-pink-500/10 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  Email: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Chat: "bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
};
const neutralTone = "bg-zinc-500/10 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-200";
export const channelTone = (channel: string) => tones[channel] ?? neutralTone;

/** Kept for pages that still pass it (buttons-32-preview/kanban); the board itself comes from the preview server. */
export const initialBoard: BoardState = { detected: [], "in-progress": [], waiting: [], solved: [] };

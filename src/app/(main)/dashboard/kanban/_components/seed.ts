// F-9 (sim3 step 11.2b): what the Dodge board reads from the preview's own conversations (/dashboard/chat):
// - the starting cards are the dodges listed on the Summary page (default/_components/data.json: a conversation, the
//   agent message that left the problem open, and its status), so both pages show the same dodges;
// - a card's customer, channel and link are read from its conversation, its problem is the customer's message just
//   before the dodge. Nothing here is invented: a conversation or message that does not exist gives no card.
// These dodges were marked by hand for the preview (no AI reviews conversations here), and the page says so.
import { channelItems } from "@/app/(main)/chat/_components/data";
import { baseConversations, initialMeta } from "@/app/(main)/dashboard/chat/_components/cw-data";
import dodgeSeeds from "@/app/(main)/dashboard/default/_components/data.json";

import type { ColumnId } from "./types";

type DodgeSeed = { conversation: number; message: number; quote: string; status: string };

/** One saved card (the board section of the preview save). */
export interface SavedCard {
  kind: "card";
  id: string;
  column: ColumnId;
  conversationId: number;
  problem: string;
  dodge: string;
  betterReply: string;
  dueDate: string;
  ownerId: number | null;
}

const statusColumn: Record<string, ColumnId> = {
  "Dodge detected": "detected",
  "In progress": "in-progress",
  "Waiting on customer": "waiting",
  Solved: "solved",
};

export function conversationOf(id: number) {
  return baseConversations.find((conversation) => conversation.id === id);
}

export function channelTitle(id: number): string {
  const conversation = conversationOf(id);
  if (!conversation) return "";
  return channelItems.find((item) => item.id === conversation.channel)?.title ?? conversation.channel;
}

export const conversationHref = (id: number) => `/dashboard/chat/conversations/${id}`;

/** The conversations a card can be made from, newest first, as the inbox lists them. */
export function conversationChoices() {
  return baseConversations.map((conversation) => ({
    id: conversation.id,
    label: `#${conversation.id} · ${conversation.name} · ${channelTitle(conversation.id)}`,
  }));
}

/** The last agent reply of a conversation and the customer's message before it (a new card starts from them). */
export function lastExchange(id: number): { problem: string; dodge: string } {
  const messages = conversationOf(id)?.messages ?? [];
  const replyAt = messages.map((message) => message.align).lastIndexOf("end");
  const reply = replyAt >= 0 ? messages[replyAt] : undefined;
  const asked = messages
    .slice(0, replyAt >= 0 ? replyAt : messages.length)
    .filter((m) => m.align === "start")
    .at(-1);
  return { problem: asked?.text ?? "", dodge: reply?.text ?? "" };
}

/** The Summary page's dodges as cards, each in the column of its status. */
export function seedCards(): SavedCard[] {
  return (dodgeSeeds as DodgeSeed[]).flatMap((seed) => {
    const conversation = conversationOf(seed.conversation);
    const at = conversation?.messages.findIndex((message) => message.id === seed.message) ?? -1;
    if (!conversation || at < 0) return [];
    const message = conversation.messages[at];
    const asked = conversation.messages
      .slice(0, at)
      .filter((m) => m.align === "start")
      .at(-1);
    return [
      {
        kind: "card" as const,
        id: `dodge-${conversation.id}-${message.id}`,
        column: statusColumn[seed.status] ?? "detected",
        conversationId: conversation.id,
        problem: asked?.text ?? "",
        dodge: message.text.includes(seed.quote) ? seed.quote : message.text,
        betterReply: "",
        dueDate: "",
        ownerId: initialMeta[conversation.id]?.assigneeId ?? null,
      },
    ];
  });
}

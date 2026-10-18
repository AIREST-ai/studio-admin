export type ColumnId = "detected" | "in-progress" | "waiting" | "solved";

export type Column = {
  id: ColumnId;
  title: string;
  hint: string;
};

// F-9: the channel of the card's conversation (Email, Chat, WhatsApp, …), as the inbox names it.
export type Channel = string;

export type TaskOwnerProfile = {
  name: string;
  tone: string;
};

export type Task = {
  id: string;
  /** F-9: the preview conversation the dodge is in; customer, channel and link are read from it. */
  conversationId: number;
  customer: string;
  channel: Channel;
  problem: string;
  dodge: string;
  /** "" until someone writes it. */
  betterReply: string;
  // ISO date (YYYY-MM-DD); shown as "Oct 11". "" = no due date.
  dueDate: string;
  /** F-9: an agent of Settings > Agents, or null (Unassigned). */
  ownerId: number | null;
  owner: TaskOwnerProfile;
  conversationHref: string;
};

export type BoardState = Record<ColumnId, Task[]>;

export type CardActions = {
  edit: (id: string) => void;
  remove: (id: string) => void;
  move: (id: string, columnId: ColumnId) => void;
  shift: (id: string, delta: -1 | 1) => void;
};

export type ColumnActions = {
  addCard: (columnId: ColumnId) => void;
  moveColumn: (columnId: ColumnId, delta: -1 | 1) => void;
};

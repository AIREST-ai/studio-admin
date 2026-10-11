export type ColumnId = "detected" | "in-progress" | "waiting" | "solved";

export type Column = {
  id: ColumnId;
  title: string;
  hint: string;
};

export type Channel = "WhatsApp" | "Messenger" | "Instagram" | "TikTok";

export type TaskOwnerProfile = {
  name: string;
  tone: string;
};

export type Task = {
  id: string;
  customer: string;
  channel: Channel;
  problem: string;
  dodge: string;
  betterReply: string;
  dueDate: string;
  owner: TaskOwnerProfile;
  conversationHref: string;
};

export type BoardState = Record<ColumnId, Task[]>;

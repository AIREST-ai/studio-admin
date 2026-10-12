// F159: the status and delivery values shared by the brown status button, the send menu and the dashboard store
// (cw-store.ts). The per-thread state of the old standalone /chat page is gone: /chat redirects to /dashboard/chat.
export type ConversationStatus = "open" | "snoozed" | "resolved" | "closed";
export type DeliveryState = "sent" | "delivered" | "read";

export const conversationStatuses: { value: ConversationStatus; label: string; dot: string }[] = [
  { value: "open", label: "Open", dot: "bg-emerald-500" },
  { value: "snoozed", label: "Snoozed", dot: "bg-amber-500" },
  { value: "resolved", label: "Resolved", dot: "bg-sky-500" },
  { value: "closed", label: "Closed", dot: "bg-zinc-400" },
];

export const noteSendButtonClass =
  "bg-amber-500 text-amber-950 hover:bg-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400";

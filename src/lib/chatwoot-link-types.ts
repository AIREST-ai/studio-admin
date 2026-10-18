// L-2 (Chatwoot link, phase 1; plan: server-work/lobehub-team/monitor-workers/r1-chatwoot-link/خطة.md 2.1-2.3, 4).
// The shapes the browser gets from /api/chatwoot/*: types and plain constants only. Client components import this
// file and never src/lib/chatwoot/ (server-only), so nothing of the server layer or its token reaches the browser.

export type LinkMode = "preview" | "linked";

/** The sections of plan 2.2, in its order. U-2 & U-3 link conversations, contacts, lists, automation and reports. */
export const LINK_SECTIONS = ["conversations", "contacts", "lists", "automation", "reports", "notifications"] as const;
export type LinkSection = (typeof LINK_SECTIONS)[number];
export const PHASE1_SECTIONS: readonly LinkSection[] = ["conversations", "contacts", "lists", "automation", "reports"];

export interface LinkState {
  mode: LinkMode;
  sections: Record<LinkSection, boolean>;
  changedAt: string | null;
  /** CHATWOOT_LINK_DISABLED is set on the preview server: always preview, the switch is refused. */
  disabled: boolean;
}

export const READ_ONLY_TEXT = "Protected live engine link";
export const LINK_BADGE_TEXT = "Linked: Live Engine";

/** Why the server could not read the live engine. The message starts with the words the card shows. */
export type LinkProblemKind = "no-token" | "refused" | "unreachable" | "identity" | "error";
export interface LinkProblem {
  kind: LinkProblemKind;
  message: string;
}

export interface LinkIdentity {
  version: string;
  accountId: number;
  accountIdLabel?: string;
  accountName: string;
  email: string;
  checkedAt: string;
}

/** GET /api/chatwoot/status. In preview mode only the LinkState part is filled and Chatwoot is not called. */
export interface LinkStatus extends LinkState {
  /** True when mode is linked, reachable, and identity matches the target Chatwoot account. */
  connected?: boolean;
  /** host:port the server reads from (linked mode only). */
  target: string | null;
  /** GET /api answered (linked mode only; null when not asked). */
  reachable: boolean | null;
  version: string | null;
  identity: LinkIdentity | null;
  problem: LinkProblem | null;
  /** Latest webhook event timestamp from the realtime bus (`studio:cw:events:v1` / `studio:cw:realtime:stream`). */
  lastEventAt: string | null;
  checkedAt: string | null;
}

export type LinkStatusResponse = LinkStatus;

/** An error answer of /api/chatwoot/* (also 409 "preview mode" / "section not linked"). */
export interface LinkErrorBody {
  error: string;
  problem?: LinkProblem;
}

export type LinkedStatus = "open" | "resolved" | "pending" | "snoozed";
export type LinkedMessageKind = "incoming" | "outgoing" | "note" | "activity" | "template";

export interface LinkedConversation {
  /** `cw:<display_id>`: never the same key as a preview conversation (plan 5, risk 2). */
  key: string;
  /** Chatwoot's display_id (the number its own URLs use). */
  id: number;
  status: LinkedStatus;
  priority: string | null;
  labels: string[];
  unreadCount: number;
  inbox: { id: number; name: string; channelType: string };
  contact: { id: number; name: string; email: string | null; phone: string | null };
  assignee: { id: number; name: string } | null;
  team: { id: number; name: string } | null;
  lastMessage: { text: string; kind: LinkedMessageKind; at: string } | null;
  lastActivityAt: string | null;
  createdAt: string | null;
}

export interface LinkedMessage {
  key: string;
  id: number;
  kind: LinkedMessageKind;
  private: boolean;
  text: string;
  sender: { name: string; type: string } | null;
  at: string | null;
  /** Names and types only: the browser never loads a file from Chatwoot (plan 2.1). */
  attachments: { type: string; name: string }[];
}

export interface LinkedContact {
  key: string;
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  identifier: string | null;
  company: string | null;
  city: string | null;
  country: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
}

export interface LinkedConversationsBody {
  conversations: LinkedConversation[];
  total: number;
  source: string;
}
export interface LinkedConversationBody {
  conversation: LinkedConversation;
}
export interface LinkedMessagesBody {
  messages: LinkedMessage[];
}
export interface LinkedContactsBody {
  contacts: LinkedContact[];
  total: number;
}
export interface LinkedContactBody {
  contact: LinkedContact;
  conversations: LinkedConversation[];
}

/* L-3: the conversation writes. The browser posts these to /api/chatwoot/conversations/<id>(/messages). */
export const WRITE_PHASE_TEXT = "Writes go to the live engine";

/** POST /api/chatwoot/conversations/<id>/messages */
export interface LinkedReplyRequest {
  content: string;
  private: boolean;
}
export interface LinkedMessageBody {
  message: LinkedMessage;
}

/** POST /api/chatwoot/conversations/<id>: one action; the answer is the conversation read again after it. */
export type LinkedConversationAction =
  | { action: "status"; status: LinkedStatus }
  | { action: "assign"; assigneeId: number | null }
  | { action: "team"; teamId: number | null }
  | { action: "labels"; add?: string[]; remove?: string[] };

/** GET /api/chatwoot/options: what the agent, team and label pickers offer. */
export interface LinkedOptionsBody {
  agents: { id: number; name: string }[];
  teams: { id: number; name: string }[];
  labels: string[];
}

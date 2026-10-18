// Chatwoot conversations area (F159), mock data only. Names and texts follow Chatwoot v4.18
// (i18n/locale/en/chatlist.json, conversation.json, contact.json, bulkActions.json, advancedFilters.json).
// The conversations themselves are the Studio chat ones (/chat data.ts) so the existing pieces
// (labels, channels strip, status button, send and resolve, email view) keep working on the same ids.
import {
  type Conversation,
  contactIdOf,
  messageAge,
  conversations as studioConversations,
} from "@/app/(main)/chat/_components/data";
import { categoryOf, articles as helpCenterArticles } from "@/app/(main)/dashboard/help-center/_components/data";
import {
  evaluateSla,
  formatSlaTime,
  initialSlas,
  type Sla,
  type WorkingHours,
} from "@/app/(main)/dashboard/settings/sla/_components/sla-data";
import {
  CURRENT_USER_ID,
  type Agent as SharedAgent,
  type Inbox as SharedInbox,
  type Team as SharedTeam,
  type WhatsAppTemplate as SharedWhatsAppTemplate,
  sendableTemplates,
  agents as sharedAgents,
  cannedResponses as sharedCanned,
  inboxes as sharedInboxes,
  teams as sharedTeams,
} from "@/lib/cw/data";
import { linkedSession } from "@/lib/cw/persistence/client";
import { useCwShared } from "@/lib/cw/store";

export { contactIdOf, currentUser, isPersonOnline } from "@/app/(main)/chat/_components/data";
export { macros } from "@/app/(main)/dashboard/settings/macros/_components/data";

export type { Conversation };

export type CwStatus = "open" | "pending" | "snoozed" | "resolved" | "closed";
export type StatusFilter = "open" | "resolved" | "pending" | "snoozed" | "all";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";
export type AssigneeTab = "me" | "unassigned" | "all";
export type SortKey =
  | "last_activity_at_desc"
  | "last_activity_at_asc"
  | "created_at_desc"
  | "created_at_asc"
  | "priority_desc"
  | "priority_asc"
  | "waiting_since_asc"
  | "waiting_since_desc"
  | "priority_desc_created_at_asc"
  | "unread";

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: "Administrator" | "Agent";
  availability: "online" | "busy" | "offline";
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: number[];
}

export interface Inbox {
  id: string; // same ids as the Studio chat channels (email, chat, whatsapp, ...)
  name: string;
  channelType: string;
  address: string;
}

export type FilterAttribute =
  | "status"
  | "assignee_id"
  | "inbox_id"
  | "team_id"
  | "contact"
  | "display_id"
  | "campaign_id"
  | "labels"
  | "customer_path"
  | "browser_language"
  | "priority"
  | "country_code"
  | "referer"
  | "created_at"
  | "last_activity_at"
  | "order_id"
  | "feedback_type";

export type FilterOperator =
  | "equal_to"
  | "not_equal_to"
  | "contains"
  | "does_not_contain"
  | "is_present"
  | "is_not_present"
  | "is_greater_than"
  | "is_less_than"
  | "days_before";

export interface FilterRow {
  attribute: FilterAttribute;
  operator: FilterOperator;
  value: string;
  join: "and" | "or"; // how this row joins the one above it
}

export interface Folder {
  id: string;
  name: string;
  filters: FilterRow[];
}

export interface CwAttachment {
  // F159 thread: "video" (bubbles/Video.vue) and "contact" (bubbles/Contact.vue, a shared contact card) added.
  type: "image" | "file" | "audio" | "location" | "video" | "contact";
  name: string;
  size?: string;
  duration?: string;
  // Contact card: the shared phone number (Chatwoot attachment fallback_title).
  phone?: string;
  // F-5A: a file attached in the preview: its bytes kept by api/preview-sim/upload (`uploadId`), its type, why it could
  // not be kept, and the browser's own preview of a picture before the page reloads.
  uploadId?: string;
  mime?: string;
  notKept?: string;
  previewUrl?: string;
}

export type CwMessageKind = "incoming" | "outgoing" | "note" | "activity";

export interface CwMessage {
  id: string;
  kind: CwMessageKind;
  text: string;
  time: string;
  sender?: string;
  attachments?: CwAttachment[];
  reaction?: string;
  replyTo?: string;
  emailHead?: { from: string; to: string; subject: string; cc?: string };
  // Chatwoot MESSAGE_STATUS (sent, delivered, read, failed) with provider's content_attributes.external_error (MessageError.vue).
  status?: "sent" | "delivered" | "read" | "failed";
  error?: string;
  // Chatwoot CSAT survey message (bubbles/CSAT.vue) with the customer's submitted rating and feedback.
  csat?: { rating: number; feedback: string };
  // F159 thread: Chatwoot form message (bubbles/Form.vue): the bot's question and the visitor's submitted values.
  form?: { label: string; value: string }[];
  // F-5A: written in the preview: never delivered, so the footer says so instead of showing a tick.
  simulated?: boolean;
  // F-5A: when it was written (ISO), for lines kept in the preview (the thread is put back in this order).
  at?: string;
  // F-8: deleted (Chatwoot content_attributes.deleted): the line shows DELETED_MESSAGE_TEXT, without its files.
  deleted?: boolean;
}

// F-8 (sim3: a deleted message came back after a reload): the messages deleted in the preview, as
// "<conversation id>:<message id>" (sim-thread-persist.ts keeps and replays them). Chatwoot keeps a deleted message in
// the thread, with its content replaced by "This message was deleted" and its attachments destroyed
// (messages_controller.rb#destroy and config/locales/en.yml conversations.messages.deleted, v4.18.0).
export const DELETED_MESSAGE_TEXT = "This message was deleted";
const deletedKeys = new Set<string>();
export const deletedMessageKey = (convId: number, messageId: string) => `${convId}:${messageId}`;
/** Called by the store whenever its list of deleted messages changes. */
export function setDeletedMessageKeys(keys: readonly string[]) {
  deletedKeys.clear();
  for (const key of keys) deletedKeys.add(key);
}
function asDeleted(message: CwMessage): CwMessage {
  return {
    id: message.id,
    kind: message.kind,
    time: message.time,
    sender: message.sender,
    text: DELETED_MESSAGE_TEXT,
    deleted: true,
    ...(message.simulated ? { simulated: true } : {}),
    ...(message.at ? { at: message.at } : {}),
  };
}
/**
 * The lines of conversation `convId` with every deleted one shown as deleted. `deleted`: the store's list
 * (useCwStore deletedMessages); a component passes it so its output changes with it (the React Compiler memoizes on
 * the inputs). Without it, the list the store last set is used.
 */
export function withDeletions(convId: number, lines: CwMessage[], deleted?: readonly string[]): CwMessage[] {
  const keys = deleted ? new Set(deleted) : deletedKeys;
  if (!keys.size) return lines;
  return lines.map((line) =>
    !line.deleted && line.kind !== "activity" && keys.has(deletedMessageKey(convId, line.id)) ? asDeleted(line) : line,
  );
}

export interface ConversationMeta {
  status: CwStatus;
  priority: Priority;
  assigneeId: number | null;
  teamId: string | null;
  unattended: boolean;
  mentioned: boolean;
  participants: number[];
  snoozedUntil: string | null;
  // T-134: policy = the Settings > SLA policy applied, target = its threshold in minutes for this kind.
  sla: { kind: "FRT" | "NRT" | "RT"; state: "due" | "missed"; time: string; policy: string; target: number } | null;
  createdRank: number; // smaller = created earlier
  createdAt: string;
  // F-5A: when the status was last changed in the preview (sim-thread-persist.ts); unset for the sample status.
  statusAt?: string;
}

// F161: agents, teams and inboxes come from the shared layer (src/lib/cw/data.ts), the same ones as Users & Roles,
// Settings and Reports. Teams and inboxes keep their URL ids (slugs) here, as the conversation views use them.
const toAgent = (agent: SharedAgent): Agent => ({
  id: agent.id,
  name: agent.name,
  email: agent.email,
  role: agent.role === "administrator" ? "Administrator" : "Agent",
  availability: agent.availability,
});

const toTeam = (team: SharedTeam): Team => ({
  id: team.slug,
  name: team.name,
  description: team.description,
  members: team.members,
});

const toInbox = (inbox: SharedInbox): Inbox => ({
  id: inbox.slug,
  name: inbox.name,
  channelType: inbox.channelType,
  address: inbox.identifier,
});

// The start lists, copied once at load. Pickers and filters use the live ones below.
export const agents: Agent[] = sharedAgents.map(toAgent);

export const CURRENT_AGENT_ID = CURRENT_USER_ID;

export const teams: Team[] = sharedTeams.map(toTeam);

export const inboxes: Inbox[] = sharedInboxes.map(toInbox);

// T-64: the live lists, read from the shared store Settings writes (src/lib/cw/store.ts), so an agent, team or inbox
// added, renamed or removed there shows up in the assignment pickers and filters at once. Same session only: the
// shared store resets on reload. Each list is mapped once per change, so a hook returns the same array until then.
function mapOnChange<S, T>(map: (item: S) => T): (list: S[]) => T[] {
  let source: S[] | undefined;
  let mapped: T[] = [];
  return (list) => {
    if (list !== source) {
      source = list;
      mapped = list.map(map);
    }
    return mapped;
  };
}

let linkedRealAgentIds: Set<number> | null = null;

export function setLinkedAgentIds(ids: number[] | null): void {
  linkedRealAgentIds = ids ? new Set(ids) : null;
}

const agentsOf = mapOnChange((agent: SharedAgent) => toAgent(agent));
const teamsOf = mapOnChange(toTeam);
const inboxesOf = mapOnChange(toInbox);

const filterRealAgents = (list: Agent[]): Agent[] =>
  linkedRealAgentIds ? list.filter((a) => linkedRealAgentIds!.has(a.id)) : list;

/** For components: re-renders when the list changes. */
export const useLiveAgents = () => filterRealAgents(agentsOf(useCwShared((state) => state.agents)));
export const useLiveTeams = () => teamsOf(useCwShared((state) => state.teams));
export const useLiveInboxes = () => inboxesOf(useCwShared((state) => state.inboxes));

/** For plain functions (store actions, labels): the list as it is now. */
export const liveAgents = () => filterRealAgents(agentsOf(useCwShared.getState().agents));
export const liveTeams = () => teamsOf(useCwShared.getState().teams);
export const liveInboxes = () => inboxesOf(useCwShared.getState().inboxes);

export const priorities: { value: Priority; label: string; rank: number }[] = [
  { value: "none", label: "None", rank: 0 },
  { value: "low", label: "Low", rank: 1 },
  { value: "medium", label: "Medium", rank: 2 },
  { value: "high", label: "High", rank: 3 },
  { value: "urgent", label: "Urgent", rank: 4 },
];

// T-282 (item 123): All first, then the ticket lifecycle order (Zendesk Open → Pending → On-hold → Solved; Intercom
// Open → Snoozed → Closed). Order only: the default stays "open" (cw-store.ts) and every value is unchanged.
export const statusFilterItems: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "snoozed", label: "Snoozed" },
  { value: "resolved", label: "Resolved" },
];

export const sortItems: { value: SortKey; label: string }[] = [
  { value: "last_activity_at_desc", label: "Last activity: Newest first" },
  { value: "last_activity_at_asc", label: "Last activity: Oldest first" },
  { value: "created_at_desc", label: "Created at: Newest first" },
  { value: "created_at_asc", label: "Created at: Oldest first" },
  { value: "priority_desc", label: "Priority: Highest first" },
  { value: "priority_asc", label: "Priority: Lowest first" },
  { value: "waiting_since_asc", label: "Pending Response: Longest first" },
  { value: "waiting_since_desc", label: "Pending Response: Shortest first" },
  { value: "priority_desc_created_at_asc", label: "Priority: Highest first, Created: Oldest first" },
  { value: "unread", label: "Unread Count: Highest first" },
];

// T-282 (item 123): All first, then Mine before Unassigned (Intercom: Your inbox … Unassigned; Zendesk: Your unsolved
// tickets, Unassigned tickets). Order only: the selected tab stays "me" (cw-store.ts).
export const assigneeTabs: { value: AssigneeTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "me", label: "Mine" },
  { value: "unassigned", label: "Unassigned" },
];

export const filterAttributes: { value: FilterAttribute; label: string; group: string }[] = [
  { value: "status", label: "Status", group: "Standard filters" },
  { value: "assignee_id", label: "Assignee name", group: "Standard filters" },
  { value: "inbox_id", label: "Inbox name", group: "Standard filters" },
  { value: "team_id", label: "Team name", group: "Standard filters" },
  { value: "contact", label: "Contact", group: "Standard filters" },
  { value: "display_id", label: "Conversation identifier", group: "Standard filters" },
  { value: "campaign_id", label: "Campaign name", group: "Standard filters" },
  { value: "labels", label: "Labels", group: "Standard filters" },
  { value: "customer_path", label: "Customer Path", group: "Standard filters" },
  { value: "priority", label: "Priority", group: "Standard filters" },
  { value: "browser_language", label: "Browser language", group: "Additional filters" },
  { value: "country_code", label: "Country name", group: "Additional filters" },
  { value: "referer", label: "Referer link", group: "Additional filters" },
  { value: "created_at", label: "Created at", group: "Additional filters" },
  { value: "last_activity_at", label: "Last activity", group: "Additional filters" },
  { value: "order_id", label: "Order ID", group: "Custom attributes" },
  { value: "feedback_type", label: "Feedback type", group: "Custom attributes" },
];

export const filterOperators: { value: FilterOperator; label: string }[] = [
  { value: "equal_to", label: "Equal to" },
  { value: "not_equal_to", label: "Not equal to" },
  { value: "contains", label: "Contains" },
  { value: "does_not_contain", label: "Does not contain" },
  { value: "is_present", label: "Is present" },
  { value: "is_not_present", label: "Is not present" },
  { value: "is_greater_than", label: "Is greater than" },
  { value: "is_less_than", label: "Is lesser than" },
  { value: "days_before", label: "Is x days before" },
];

// T-74: the preview starts with no folders; the admin saves them from a filter (cw-store addFolder).
export const initialFolders: Folder[] = [];

type Seed = [
  id: number,
  status: CwStatus,
  priority: Priority,
  assignee: number,
  team: string,
  flags: string,
  snoozed?: string,
];

// flags: u = unattended, p = you participate, f = first response SLA (the customer still waits for a first reply),
// n = next response SLA (the customer wrote again after an agent reply). Due or missed follows the waiting time.
// Mentions and note writers come from the private notes (notesByConversation below).
const seeds: Seed[] = [
  [1, "open", "urgent", 1, "technical", "pn"],
  [2, "open", "high", 1, "billing", "p"],
  [3, "open", "medium", 0, "support", "uf"],
  [5, "open", "low", 2, "sales", ""],
  [6, "open", "high", 1, "technical", "p"],
  [7, "open", "medium", 3, "billing", ""],
  [8, "open", "none", 0, "", "u"],
  [9, "snoozed", "low", 2, "billing", "", "Snoozed until tomorrow"],
  [10, "open", "urgent", 1, "technical", "p"],
  [11, "open", "high", 4, "technical", ""],
  [12, "open", "none", 0, "sales", ""],
  [13, "open", "medium", 1, "technical", ""],
  [14, "open", "high", 5, "technical", "p"],
  [15, "open", "low", 0, "support", "u"],
  [16, "open", "urgent", 0, "technical", "uf"],
  [17, "resolved", "none", 2, "sales", ""],
  [18, "resolved", "low", 3, "support", ""],
  [19, "snoozed", "medium", 1, "sales", "", "Snoozed until next week"],
  [20, "open", "medium", 4, "support", ""],
  [21, "open", "low", 0, "support", "u"],
  [22, "pending", "high", 0, "sales", ""], // still with the bot: "Take over" banner
  [23, "resolved", "medium", 1, "technical", ""],
  [24, "open", "urgent", 3, "support", ""],
];

const createdDates = ["Oct 12", "Oct 11", "Oct 10", "Oct 9", "Oct 8", "Oct 7", "Oct 5", "Oct 3", "Sep 30", "Sep 28"];

// Private notes (with @mentions) added to the Studio sample threads. They also decide Mentions and Participants.
const notesByConversation: Record<number, { sender: string; text: string }[]> = {
  1: [
    {
      sender: "Lina Haddad",
      text: "@Arham Khan the infra team rotated the staging secrets yesterday. Could be the mismatch.",
    },
  ],
  2: [
    {
      sender: "Yousef Al-Harbi",
      text: "@Arham Khan refund for the #8823 duplicate went through in Stripe. Receipt is in their billing email.",
    },
  ],
  7: [
    {
      sender: "Lina Haddad",
      text: "@Arham Khan finance says the transfer landed on the 9th. The sync job is lagging.",
    },
  ],
  13: [{ sender: "Ravi Menon", text: "@Arham Khan reproduced it, only when the browser time zone is behind UTC." }],
  14: [{ sender: "Ravi Menon", text: "Zapier changed their retry headers last week. Checking our webhook signer." }],
};

// You are mentioned when a private note tags you, and every note writer takes part in the conversation.
function mentionsYou(id: number): boolean {
  return (notesByConversation[id] ?? []).some((note) => note.text.includes("@Arham Khan"));
}

function noteWriters(id: number): number[] {
  return (notesByConversation[id] ?? []).map((note) => agents.find((agent) => agent.name === note.sender)?.id ?? 0);
}

// T-134 (T-99, item 5): the SLA badge follows the policies of Settings > SLA (sla-data.ts), with no fixed target.
// Chatwoot shows the badge only on a conversation with an applied SLA. The policy applied here is the one whose own
// description names the inbox: Standard, "Default promise for all website and WhatsApp chats". Any other inbox has no
// policy, so no badge.
// T-261 (buried 6): the policy is held by id, as Chatwoot's applied_sla holds sla_policy_id, so an edited Standard
// still applies and a deleted one leaves no badge. The badge is counted as Chatwoot counts it (sla-data.ts
// evaluateSla): FRT and RT from the conversation's first message, NRT from the customer's first message after the
// last agent reply, in the inbox's working hours when the policy says so. The saved policies and the clock are applied
// in the browser by settings/sla/_components/sla-store.ts (startSlaBadgeSync, started at the end of this file).
const SLA_POLICY_BY_INBOX_TYPE: Record<string, number> = { Website: 5, WhatsApp: 5 };

/** An applied SLA: its policy and how many minutes ago the times Chatwoot counts from were. */
export interface AppliedSla {
  policyId: number;
  inbox: string;
  createdAgo: number;
  firstReplyAgo: number | null;
  waitingAgo: number | null;
}

function appliedSlaOf(conversation: Conversation | undefined): AppliedSla | null {
  const type = inboxes.find((inbox) => inbox.id === conversation?.channel)?.channelType ?? "";
  const policyId = SLA_POLICY_BY_INBOX_TYPE[type];
  if (!conversation || !policyId) return null;
  const ago = conversation.messages.map((message) => message.ago ?? conversation.ago ?? 0);
  const firstReply = conversation.messages.findIndex((message) => message.align === "end");
  const lastReply = conversation.messages.findLastIndex((message) => message.align === "end");
  const waiting = firstReply < 0 ? -1 : conversation.messages.findIndex((m, i) => i > lastReply && m.align === "start");
  return {
    policyId,
    inbox: conversation.channel,
    createdAgo: Math.max(conversation.ago ?? 0, ...ago),
    firstReplyAgo: firstReply < 0 ? null : ago[firstReply],
    waitingAgo: waiting < 0 ? null : ago[waiting],
  };
}

/** The badge of an applied SLA at `now` (ms), the minutes-ago counted back from `agesAt` (ms). */
export function slaBadge(
  applied: AppliedSla,
  policies: Sla[],
  hours: WorkingHours | null,
  resolved: boolean,
  now: number,
  agesAt: number,
): ConversationMeta["sla"] {
  const policy = policies.find((sla) => sla.id === applied.policyId);
  if (!policy) return null;
  const at = (minutes: number | null) => (minutes === null ? null : agesAt - minutes * 60_000);
  const status = evaluateSla(
    policy,
    {
      createdAt: agesAt - applied.createdAgo * 60_000,
      firstReplyAt: at(applied.firstReplyAgo),
      waitingSince: at(applied.waitingAgo),
      resolved,
    },
    hours,
    now,
  );
  if (!status) return null;
  return {
    kind: status.kind,
    state: status.missed ? "missed" : "due",
    time: formatSlaTime(status.left),
    policy: policy.name,
    target: status.threshold / 60,
  };
}

/** The conversations with an applied SLA (seed flags f or n, as before T-261), by id. */
export const appliedSlas: Record<number, AppliedSla> = {};

export const initialMeta: Record<number, ConversationMeta> = Object.fromEntries(
  seeds.map(([id, status, priority, assignee, team, flags, snoozed], index) => {
    // Agents who wrote a reply in the thread take part too (replies are credited to the assignee, or Arham Khan).
    const replied =
      !flags.includes("u") &&
      studioConversations.find((c) => c.id === id)?.messages.some((message) => message.align === "end");
    // A pending conversation without an agent is answered by the bot, which is not a participant.
    const writer = replied ? assignee || (status === "pending" ? 0 : CURRENT_AGENT_ID) : 0;
    const participants = [assignee, writer, flags.includes("p") ? CURRENT_AGENT_ID : 0, ...noteWriters(id)].filter(
      (value, i, list) => value > 0 && list.indexOf(value) === i,
    );
    // T-261: the first paint (server and browser alike) counts the start policies on a fixed clock with no working
    // hours, so it renders the same on both; sla-store.ts then applies the saved policies, the hours and the clock.
    const applied =
      flags.includes("f") || flags.includes("n") ? appliedSlaOf(studioConversations.find((c) => c.id === id)) : null;
    if (applied) appliedSlas[id] = applied;
    const sla = applied ? slaBadge(applied, initialSlas, null, status === "resolved", 0, 0) : null;
    // Created order is not the same as activity order, so the two sorts give different lists.
    const createdRank = (index * 7) % seeds.length;
    // A conversation whose messages are all from yesterday cannot have been created today.
    const createdDate = createdDates[createdRank % createdDates.length];
    const fromYesterday = studioConversations.find((c) => c.id === id)?.group === "Yesterday";
    return [
      id,
      {
        status,
        priority,
        assigneeId: assignee || null,
        teamId: team || null,
        unattended: flags.includes("u"),
        mentioned: mentionsYou(id),
        participants,
        snoozedUntil: snoozed ?? null,
        sla,
        createdRank,
        createdAt: fromYesterday && createdDate === "Oct 12" ? "Oct 11" : createdDate,
      },
    ];
  }),
);

export const baseConversations: Conversation[] = studioConversations;

export function inboxOf(conversation: Conversation): Inbox {
  const live = liveInboxes();
  return live.find((inbox) => inbox.id === conversation.channel) ?? live[0] ?? inboxes[0];
}

export function agentName(id: number | null | undefined): string | null {
  if (!id) return null;
  return liveAgents().find((agent) => agent.id === id)?.name ?? null;
}

export function teamName(id: string | null | undefined): string | null {
  if (!id) return null;
  return liveTeams().find((team) => team.id === id)?.name ?? null;
}

// Attachments and activity lines added to the Studio sample threads (private notes are above initialMeta).
// F159: the screenshots of #1 and #7 sit on the customer's first message, so the question just above the agent's
// last reply is short and stays in view when the thread opens at its newest message.
const attachmentsByMessage: Record<number, CwAttachment[]> = {
  101: [{ type: "image", name: "readiness-probe-logs.png", size: "284 KB" }],
  201: [{ type: "file", name: "bank-statement-oct.pdf", size: "212 KB" }],
  603: [
    { type: "image", name: "export-timeout.png", size: "176 KB" },
    // F159 thread: WhatsApp shared location (bubbles/Location.vue): the new warehouse the migration is for.
    { type: "location", name: "New warehouse · Ras Bufontas Free Zone, Doha" },
  ],
  // F159 thread: WhatsApp shared contact card (bubbles/Contact.vue): the QA lead to keep posted.
  105: [{ type: "contact", name: "Faisal Al-Kuwari", phone: "+974 5512 3480" }],
  // F159 thread: screen recording of the crash (bubbles/Video.vue).
  1601: [{ type: "video", name: "crash-after-splash.mp4", size: "2.4 MB", duration: "0:18" }],
  701: [{ type: "image", name: "transfer-confirmation.jpg", size: "98 KB" }],
  1001: [{ type: "audio", name: "voicemail-0847.m4a", duration: "0:42" }],
  1303: [{ type: "file", name: "report-export-june.csv", size: "36 KB" }],
  2403: [
    { type: "file", name: "resignation-notice.pdf", size: "120 KB" },
    { type: "file", name: "hr-confirmation.pdf", size: "88 KB" },
  ],
};

const CURRENT_NAME = "Arham Khan";

// F159: Chatwoot can_reply = false. Meta only lets a business answer within 24 hours of the customer's last message.
// Omar wrote to WhatsApp Business yesterday (#24) and Reem to Instagram yesterday (#21); both windows have closed.
// The pane shows Chatwoot's red reply-window banner; WhatsApp can still send an approved template, Instagram only
// takes private notes (ReplyBox.vue isEditorDisabled / canSendPublicReply).
const replyWindowClosed = new Set([21, 24]);

let linkedThreads: Record<number, CwMessage[]> | null = null;

export function setLinkedThreads(threads: Record<number, CwMessage[]> | null): void {
  linkedThreads = threads ? { ...threads } : null;
  if (threads) {
    requiredOnResolve.splice(0, requiredOnResolve.length);
  } else {
    requiredOnResolve.splice(0, requiredOnResolve.length, ...defaultRequiredOnResolve);
  }
}

export function setLinkedThread(convId: number, thread: CwMessage[]): void {
  linkedThreads ??= {};
  linkedThreads[convId] = thread;
}

export function getLinkedThread(convId: number): CwMessage[] | undefined {
  return linkedThreads?.[convId];
}

export function canReply(conversation: Conversation): boolean {
  if (linkedSession()) return true;
  return !replyWindowClosed.has(conversation.id);
}

// F159: one reply WhatsApp did not deliver (Chatwoot MessageError.vue): Arham's last answer to #6. The error is the
// text Meta's Cloud API returns, as Chatwoot stores it in external_error. "Retry" sends it again (cw-store).
const failedMessages: Record<number, string> = {
  604: "131026: Message undeliverable. The recipient's WhatsApp account could not be reached.",
};

// F159: Chatwoot sends its CSAT survey when a conversation is resolved. The ratings and feedback are the ones in
// Reports > CSAT (reports/_components/data.ts csatSeeds) for the three conversations that are resolved now.
const csatByConversation: Record<number, { rating: number; feedback: string }> = {
  17: { rating: 4, feedback: "Helpful overview of the reseller tiers." },
  18: { rating: 3, feedback: "The May logs arrived, but I had to ask twice for UTC timestamps." },
  23: { rating: 5, feedback: "Clear Azure AD checklist. The pilot group switched with no downtime." },
};

// F159 thread: the web widget bot asks a short form after the visitor's first message (Chatwoot content_type "form",
// bubbles/Form.vue shows the question, then each field label and the submitted value).
const formAfterMessage: Record<number, { text: string; form: { label: string; value: string }[] }> = {
  801: {
    text: "Thanks for reaching out. A few details so we can route you to the right team:",
    form: [
      { label: "Topic", value: "Developer onboarding" },
      { label: "Team size", value: "11-50" },
      { label: "Start date", value: "Monday" },
    ],
  },
};

// Chatwoot CSAT_RATINGS labels (csatMgmt.json).
export const csatRatingLabels: Record<number, string> = {
  1: "😞 Poor",
  2: "😑 Fair",
  3: "😐 Average",
  4: "😀 Good",
  5: "😍 Excellent",
};

export function buildThread(
  conversation: Conversation,
  meta: ConversationMeta | undefined,
  deleted?: readonly string[],
): CwMessage[] {
  if (linkedThreads !== null) {
    return withDeletions(conversation.id, linkedThreads[conversation.id] ?? [], deleted);
  }
  const inbox = inboxOf(conversation);
  const assignee = agentName(meta?.assigneeId);
  const thread: CwMessage[] = [];

  if (assignee) {
    thread.push({
      id: `a-${conversation.id}-assign`,
      kind: "activity",
      time: conversation.messages[0]?.time ?? "",
      text:
        meta?.assigneeId === CURRENT_AGENT_ID
          ? "Arham Khan self-assigned this conversation"
          : `Assigned to ${assignee} by Arham Khan`,
    });
  }
  // T-74: a team id that no team has (the sample ids, the teams now start empty) gets no line, not "null team".
  const team = teamName(meta?.teamId);
  if (team) {
    thread.push({
      id: `a-${conversation.id}-team`,
      kind: "activity",
      time: conversation.messages[0]?.time ?? "",
      text: `Assigned to ${team} team by Arham Khan`,
    });
  }

  if (meta?.priority === "urgent") {
    // Set when the conversation came in, with the assign activities (not "Just now" after older messages).
    thread.push({
      id: `a-${conversation.id}-priority`,
      kind: "activity",
      time: conversation.messages[0]?.time ?? "",
      text: "Arham Khan set the priority to Urgent",
    });
  }

  // Unattended threads have no agent reply in the data itself (/chat data.ts), so both pages show the same thread.
  let firstIncoming = true;
  for (const message of conversation.messages) {
    const incoming = message.align === "start";
    thread.push({
      id: String(message.id),
      kind: incoming ? "incoming" : "outgoing",
      text: message.text,
      time: message.time,
      reaction: message.reaction,
      sender: incoming ? conversation.contact.name : (assignee ?? (meta?.status === "pending" ? "Bot" : CURRENT_NAME)),
      attachments: attachmentsByMessage[message.id],
      ...(failedMessages[message.id] ? { status: "failed" as const, error: failedMessages[message.id] } : {}),
      emailHead:
        incoming && firstIncoming && inbox.id === "email"
          ? { from: conversation.contact.email, to: inbox.address, subject: conversation.subject }
          : undefined,
    });
    if (incoming) firstIncoming = false;
    const form = formAfterMessage[message.id];
    if (form) {
      thread.push({ id: `form-${message.id}`, kind: "outgoing", sender: "Bot", time: message.time, ...form });
    }
  }

  for (const [index, note] of (notesByConversation[conversation.id] ?? []).entries()) {
    thread.push({
      id: `n-${conversation.id}-${index}`,
      kind: "note",
      text: note.text,
      sender: note.sender,
      // Notes come after the last message, so a thread whose last message is a minute old has a note from just now.
      time: conversation.ago !== undefined && conversation.ago < 2 ? "Just now" : "2 min ago",
    });
  }

  // F-5A: a resolve made in the preview has its own line, with who did it and when (sim-thread-persist.ts); this one,
  // and its sample CSAT survey, belong to the sample's resolved conversations.
  if (meta?.status === "resolved" && !meta.statusAt) {
    thread.push({
      id: `a-${conversation.id}-resolved`,
      kind: "activity",
      time: "Yesterday",
      text: `Conversation was marked resolved by ${assignee ?? "Arham Khan"}`,
    });
    const csat = csatByConversation[conversation.id];
    if (csat) {
      thread.push({
        id: `csat-${conversation.id}`,
        kind: "outgoing",
        text: "Please rate the conversation",
        time: "Yesterday",
        sender: "Bot",
        csat,
      });
    }
  }
  // F-5A: a snooze made in the preview has its own line (sim-thread-persist.ts); this one is the sample's.
  if (meta?.status === "snoozed" && !meta.statusAt) {
    thread.push({
      id: `a-${conversation.id}-snoozed`,
      kind: "activity",
      time: "Today",
      text: `${assignee ?? "Arham Khan"} has snoozed this conversation`,
    });
  }
  return withDeletions(conversation.id, thread, deleted);
}

// Chatwoot getLastMessage (helper/conversationHelper.js): the last message that is not an activity, so the card and
// the Previous/Next chat pill show what was said last. Built from the same thread the pane shows plus the replies
// sent from the reply box. Chatwoot shows the text, and the
// attachment label only when the message has no text (MessagePreview.vue).
export function lastPreview(
  conversation: Conversation,
  meta: ConversationMeta | undefined,
  sent?: CwMessage[],
  deleted?: readonly string[],
): { text: string; icon?: "image" | "audio" | "file" | "location"; byAgent?: boolean } {
  // The CSAT survey is an automatic message, so the card keeps showing what the customer and the agent said.
  const said = (message: CwMessage) =>
    (message.kind === "incoming" || message.kind === "outgoing") && !message.csat && !message.form;
  const last =
    withDeletions(conversation.id, sent ?? [], deleted)
      .filter(said)
      .at(-1) ?? buildThread(conversation, meta, deleted).filter(said).at(-1);
  if (!last) return { text: "No Messages" };
  const byAgent = last.kind === "outgoing";
  const files = last.attachments;
  if (!last.text.trim() && files?.length) {
    const labels = {
      image: "Picture message",
      audio: "Audio message",
      video: "Video message",
      file: "File Attachment",
      location: "Location",
      contact: "Shared contact",
    };
    // The card has icons for these four; a video shows the picture icon and a contact card the file icon.
    const type = files[0].type;
    const icon = type === "video" ? "image" : type === "contact" ? "file" : type;
    return { text: labels[type], icon, byAgent };
  }
  return { text: last.text, byAgent };
}

// F161: one set for Settings > Canned Responses and the reply box (src/lib/cw/data.ts).
export const cannedResponses = sharedCanned.map(({ shortCode, content }) => ({ shortCode, content }));

// F161: one set of WhatsApp templates (Settings > Templates, campaigns, reply box): the approved Meta ones.
// examples: the sample values approved with each template for {{2}}, {{3}} ({{1}} is the contact's first name).
export const whatsappTemplates: {
  name: string;
  language: string;
  category: string;
  body: string;
  examples?: string[];
}[] = sendableTemplates.map((template) => ({
  name: template.name,
  language: template.code,
  category: template.category,
  body: template.body,
  examples: template.examples,
}));

// F-3: the reply box and the conversation dialogs read the account's template list as it is now (Settings > Templates,
// saved in the preview's shared lists), so a template approved there is offered at once; the list above is only the
// starting sample. Same rule as `sendableTemplates`: approved Meta templates.
const chatTemplatesOf = (rows: SharedWhatsAppTemplate[]): typeof whatsappTemplates =>
  rows
    .filter((template) => template.status === "APPROVED" && template.provider === "Meta")
    .map((template) => ({
      name: template.name,
      language: template.code,
      category: template.category,
      body: template.body,
      examples: template.examples,
    }));
export const useLiveWhatsappTemplates = () => chatTemplatesOf(useCwShared((state) => state.whatsappTemplates));
export const liveWhatsappTemplates = () => chatTemplatesOf(useCwShared.getState().whatsappTemplates);

// The published articles of the Help Center (help-center/_components/data.ts), for the reply box "Insert article"
// and the search Articles tab, so both list the same articles as Help Center > Articles.
export const helpArticles = helpCenterArticles
  .filter((article) => article.status === "published")
  .map((article) => ({
    title: article.title,
    category: categoryOf(article)?.name ?? "Uncategorized",
    views: article.views,
  }));

export const aiOptions = [
  { key: "reply_suggestion", label: "Reply Suggestion" },
  { key: "summarize", label: "Summarize" },
  { key: "rephrase", label: "Improve Writing" },
  { key: "fix_spelling_grammar", label: "Fix Spelling and Grammar" },
  { key: "shorten", label: "Shorten" },
  { key: "expand", label: "Expand" },
  { key: "make_friendly", label: "Change message tone to friendly" },
  { key: "professional", label: "Use professional tone" },
  { key: "casual", label: "Use casual tone" },
  { key: "confident", label: "Use confident tone" },
  { key: "straightforward", label: "Use straightforward tone" },
];

export const emojis = [
  ["😀", "grinning"],
  ["😂", "joy"],
  ["😊", "blush"],
  ["😍", "heart eyes"],
  ["🤔", "thinking"],
  ["😅", "sweat smile"],
  ["😢", "cry"],
  ["😡", "angry"],
  ["👍", "thumbs up"],
  ["👎", "thumbs down"],
  ["👏", "clap"],
  ["🙏", "pray"],
  ["🙌", "raised hands"],
  ["👋", "wave"],
  ["💪", "muscle"],
  ["👀", "eyes"],
  ["🎉", "tada"],
  ["🔥", "fire"],
  ["✅", "check"],
  ["❌", "cross"],
  ["⚠️", "warning"],
  ["❤️", "heart"],
  ["💯", "100"],
  ["⭐", "star"],
  ["🚀", "rocket"],
  ["📦", "package"],
  ["📎", "paperclip"],
  ["📞", "phone"],
  ["💳", "card"],
  ["🧾", "receipt"],
  ["⏰", "alarm"],
  ["📅", "calendar"],
  ["🔒", "lock"],
  ["💡", "bulb"],
  ["🛠️", "tools"],
  ["🤝", "handshake"],
] as const;

export const contactAttributeDefs = [
  { key: "plan", label: "Plan", type: "List", options: ["Starter", "Pro", "Enterprise"] },
  { key: "signup_date", label: "Signup date", type: "Date" },
  { key: "lifetime_value", label: "Lifetime value", type: "Number" },
  { key: "preferred_language", label: "Preferred language", type: "Text" },
  { key: "newsletter", label: "Newsletter", type: "Checkbox" },
  { key: "linkedin", label: "LinkedIn", type: "Link" },
] as const;

export const conversationAttributeDefs = [
  { key: "order_id", label: "Order ID", type: "Text" },
  { key: "refund_amount", label: "Refund amount", type: "Number" },
  { key: "product", label: "Product", type: "List", options: ["Studio Cloud", "Studio API", "Studio Mobile"] },
  { key: "callback_requested", label: "Callback requested", type: "Checkbox" },
  { key: "feedback_type", label: "Feedback type", type: "List", options: ["Bug", "Feature request"] },
  // F161: the two attributes Settings > Conversation workflow marks "required on resolution" by default
  // (workflow-page.tsx RequiredAttributesCard), with the same names, list values and regex as Settings > Attributes.
  { key: "order_number", label: "Order number", type: "Text" },
  {
    key: "resolution_reason",
    label: "Resolution reason",
    type: "List",
    options: ["Refund issued", "Replaced item", "Information only"],
  },
] as const;

const defaultRequiredOnResolve: { key: string; regex?: RegExp; cue?: string }[] = [
  { key: "resolution_reason" },
  { key: "order_number", regex: /^QA-[0-9]{6}$/, cue: "Order numbers look like QA-123456" },
];

// F161: Chatwoot account setting conversation_required_attributes (useConversationRequiredAttributes.js). Copied from
// the Settings default; Settings keeps its own copy in page state, so a change there does not reach this list yet.
export const requiredOnResolve: { key: string; regex?: RegExp; cue?: string }[] = [...defaultRequiredOnResolve];

// Conversations that carry product feedback (used by the "Product Feedback" folder).
const feedbackTypes: Record<number, string> = { 13: "Bug", 15: "Feature request", 16: "Bug", 19: "Feature request" };

// Contact attributes belong to the person, so both of Noura's conversations and her Contacts page show the same
// values (contact-details.tsx reads them from here too).
export function initialContactAttributes(conversation: Conversation): Record<string, string> {
  const plans = ["Starter", "Pro", "Enterprise"];
  const key = contactIdOf(conversation.id) ?? conversation.id;
  return {
    plan: plans[key % 3],
    signup_date: conversation.contact.qualifiedAt,
    lifetime_value: String(1200 + key * 215),
    preferred_language: key % 4 === 0 ? "Arabic" : "English",
    newsletter: key % 2 === 0 ? "true" : "false",
  };
}

export function initialConversationAttributes(conversation: Conversation): Record<string, string> {
  const values: Record<string, string> = {
    product: ["Studio Cloud", "Studio API", "Studio Mobile"][conversation.id % 3],
  };
  if (conversation.channel === "email") values.order_id = `ORD-${8800 + conversation.id}`;
  if (conversation.id === 2) values.refund_amount = "149";
  if (feedbackTypes[conversation.id]) values.feedback_type = feedbackTypes[conversation.id];
  return values;
}

// Started today: the age of the first message (no clock time later than now); earlier days keep a morning time.
function initiatedAt(conversation: Conversation): string {
  const date = initialMeta[conversation.id]?.createdAt ?? "Oct 12";
  const first = conversation.messages[0]?.ago;
  if (date === "Oct 12") return first !== undefined ? `Oct 12, 2026 (${messageAge(first)})` : "Oct 12, 2026";
  return `${date}, 2026 9:14 AM`;
}

export function conversationInfo(conversation: Conversation) {
  const web = conversation.channel === "chat";
  return [
    { label: "Initiated at", value: initiatedAt(conversation) },
    { label: "Initiated from", value: web ? "https://weblabs.studio/pricing" : "Not Available" },
    { label: "Browser", value: web ? "Chrome 129.0" : "Not Available" },
    { label: "Operating System", value: web ? "macOS 15.1" : "Not Available" },
    { label: "IP Address", value: web ? "37.211.84.19" : "Not Available" },
    { label: "Browser Language", value: web ? "en-US" : "Not Available" },
  ];
}

// Chatwoot warns next to a Website Chat contact's name when the widget session is not HMAC-verified
// (ConversationHeader.vue, CONVERSATION.UNVERIFIED_SESSION). Sarah #8, Khalid #12 and Fatima #20 wrote while signed
// in to the customer portal, so they are verified; Hamad #16 wrote from the public site without signing in.
const unverifiedSessions = new Set([16]);

export function isUnverifiedSession(conversation: Conversation): boolean {
  if (linkedSession()) return false;
  return conversation.channel === "chat" && unverifiedSessions.has(conversation.id);
}

// The same person's other conversations (Noura #1 and #2, Sarah #3 and #8, ...), newest first.
export function previousConversations(
  conversation: Conversation,
  meta: Record<number, ConversationMeta> = initialMeta,
  sent: Record<number, CwMessage[]> = {},
) {
  const contactId = contactIdOf(conversation.id);
  if (contactId === null) return [];
  return baseConversations
    .filter((item) => item.id !== conversation.id && contactIdOf(item.id) === contactId)
    .map((item) => ({
      id: item.id,
      channel: item.channel,
      inbox: inboxOf(item).name,
      subject: item.subject,
      preview: lastPreview(item, meta[item.id], sent[item.id]).text,
      time: item.time,
      assigneeId: initialMeta[item.id]?.assigneeId ?? null,
    }));
}

export const initialContactNotes = [
  { id: 1, author: "Priya Nair", time: "3 days ago", text: "Prefers short answers. Decision maker for renewals." },
  { id: 2, author: "Arham Khan", time: "Sep 12", text: "Asked for quarterly invoices instead of monthly." },
];

export const shopifyOrders = [
  { id: "1043", date: "Oct 8, 2026", total: "QAR 1,240.00", financial: "Paid", fulfillment: "Fulfilled", items: 3 },
  {
    id: "1017",
    date: "Sep 19, 2026",
    total: "QAR 389.00",
    financial: "Partially Refunded",
    fulfillment: "Fulfilled",
    items: 1,
  },
];

export const linearIssues = [
  { id: "WEB-482", title: "Staging readiness probe fails after env change", state: "In Progress", priority: "Urgent" },
];

export const snoozeOptions = [
  { value: "next_reply", label: "Next reply", display: "Snoozed until next reply" },
  { value: "tomorrow", label: "Tomorrow", display: "Snoozed until tomorrow" },
  { value: "next_week", label: "Next week", display: "Snoozed until next week" },
] as const;

// T-261: in the browser, keep the SLA badges on the saved Settings > SLA policies. The SLA store writes the badges into
// the conversation store, which imports this module, so it is imported only after this module has run.
if (typeof window !== "undefined")
  // biome-ignore lint/suspicious/noImportCycles: deferred import, runs after both modules are loaded.
  void import("@/app/(main)/dashboard/settings/sla/_components/sla-store").then((m) => m.startSlaBadgeSync());

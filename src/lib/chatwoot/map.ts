// L-2 (plan r1-chatwoot-link/خطة.md 2.1): pure functions from Chatwoot v4.18.0 JSON to the shapes the browser gets
// (src/lib/chatwoot-link-types.ts). Each takes only the fields it needs, so no token or private field of a Chatwoot
// answer is passed on (plan 2.3: the profile carries access_token and pubsub_token).
// Shapes (chatwoot/chatwoot tag v4.18.0):
// - conversation: app/views/api/v1/conversations/partials/_conversation.json.jbuilder (id = display_id, meta.sender,
//   meta.assignee, meta.team, inbox_id, labels, status, priority, unread_count, messages = [last message],
//   timestamps in Unix seconds)
// - message: app/views/api/v1/models/_message.json.jbuilder (message_type is the number: 0 incoming, 1 outgoing,
//   2 activity, 3 template; private; sender = push_event_data with "type"; created_at in Unix seconds)
// - contact: app/views/api/v1/models/_contact.json.jbuilder
// - inbox: app/views/api/v1/models/_inbox.json.jbuilder (id, name, channel_type)
// - profile: app/views/api/v1/models/_user.json.jbuilder (email, accounts[].id/name)
// biome-ignore lint/correctness/noUndeclaredDependencies: Next.js resolves "server-only" itself (node_modules/next/dist/docs/01-app/02-guides/data-security.md)
import type { Contact as ChatContact, Message as ChatMessage, Conversation } from "@/app/(main)/chat/_components/data";
import type {
  ConversationMeta,
  CwAttachment,
  CwMessage,
  CwStatus,
  Priority,
} from "@/app/(main)/dashboard/chat/_components/cw-data";
import type { Contact as DirectoryContact } from "@/app/(main)/dashboard/contacts/_components/data";
import type {
  LinkedContact,
  LinkedConversation,
  LinkedMessage,
  LinkedMessageKind,
  LinkedOptionsBody,
  LinkedStatus,
} from "@/lib/chatwoot-link-types";
import {
  type Agent,
  type CannedResponse,
  type ChannelKey,
  type Inbox,
  type Label,
  agents as seedAgents,
  inboxes as seedInboxes,
  type Team,
} from "@/lib/cw/data";

type Raw = Record<string, unknown>;

const obj = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Normalizes `private` field across Chatwoot versions (`Boolean(msg.private)`, handling boolean/numeric/string). */
export const normalizePrivate = (value: unknown): boolean => {
  if (value === true || value === "true" || value === 1) return true;
  if (value === false || value === "false" || value === 0 || value === "0" || value === null || value === undefined)
    return false;
  return Boolean(value);
};

/** Normalizes Unix seconds (number or numeric string), Unix milliseconds, or ISO 8601 strings to Unix seconds. */
export const toUnixSeconds = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 1e11 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n) && n > 0) return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n);
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed / 1000);
  }
  return null;
};

/** Chatwoot API sends times as Unix seconds (created_at.to_i) or ISO 8601 strings; normalizes both to ISO 8601. */
export const iso = (value: unknown): string | null => {
  const seconds = toUnixSeconds(value);
  if (seconds && seconds > 0) return new Date(seconds * 1000).toISOString();
  return null;
};

const STATUSES: LinkedStatus[] = ["open", "resolved", "pending", "snoozed"];
const KINDS: Record<number, LinkedMessageKind> = { 0: "incoming", 1: "outgoing", 2: "activity", 3: "template" };

export function messageKind(raw: Raw): LinkedMessageKind {
  if (normalizePrivate(raw.private)) return "note";
  const type = typeof raw.message_type === "number" ? raw.message_type : Number(raw.message_type);
  if (KINDS[type]) return KINDS[type];
  if (raw.message_type === "incoming") return "incoming";
  if (raw.message_type === "activity") return "activity";
  if (raw.message_type === "template") return "template";
  return "outgoing";
}

/** Chatwoot's channel_type without the "Channel::" prefix, e.g. "WebWidget". */
const channelName = (value: unknown) => (str(value) ?? "").replace(/^Channel::/, "");

export interface InboxName {
  name: string;
  channelType: string;
}

export function toInboxNames(body: unknown): Map<number, InboxName> {
  const names = new Map<number, InboxName>();
  const payload = obj(body).payload;
  for (const item of Array.isArray(payload) ? payload : []) {
    const inbox = obj(item);
    const id = num(inbox.id);
    if (id !== null)
      names.set(id, { name: str(inbox.name) ?? `Inbox ${id}`, channelType: channelName(inbox.channel_type) });
  }
  return names;
}

export function toConversation(value: unknown, inboxes: Map<number, InboxName>): LinkedConversation {
  const raw = obj(value);
  const meta = obj(raw.meta);
  const sender = obj(meta.sender);
  const assignee = obj(meta.assignee);
  const team = obj(meta.team);
  const id = num(raw.id) ?? 0;
  const inboxId = num(raw.inbox_id) ?? 0;
  const inbox = inboxes.get(inboxId);
  const last = Array.isArray(raw.messages) && raw.messages.length ? obj(raw.messages[raw.messages.length - 1]) : null;
  const status = STATUSES.includes(raw.status as LinkedStatus) ? (raw.status as LinkedStatus) : "open";
  return {
    key: `cw:${id}`,
    id,
    status,
    priority: str(raw.priority),
    labels: Array.isArray(raw.labels) ? raw.labels.filter((label): label is string => typeof label === "string") : [],
    unreadCount: num(raw.unread_count) ?? 0,
    inbox: {
      id: inboxId,
      name: inbox?.name ?? `Inbox ${inboxId}`,
      channelType: inbox?.channelType ? inbox.channelType : channelName(meta.channel),
    },
    contact: {
      id: num(sender.id) ?? 0,
      name: str(sender.name) ?? str(sender.email) ?? "Unknown contact",
      email: str(sender.email),
      phone: str(sender.phone_number),
    },
    assignee:
      num(assignee.id) !== null
        ? { id: num(assignee.id) as number, name: str(assignee.available_name) ?? str(assignee.name) ?? "Agent" }
        : null,
    team: num(team.id) !== null ? { id: num(team.id) as number, name: str(team.name) ?? "Team" } : null,
    lastMessage: last
      ? { text: str(last.content) ?? "", kind: messageKind(last), at: iso(last.created_at) ?? "" }
      : null,
    lastActivityAt: iso(raw.last_activity_at ?? raw.timestamp),
    createdAt: iso(raw.created_at),
  };
}

export function toMessage(value: unknown, conversationId: number): LinkedMessage {
  const raw = obj(value);
  const sender = obj(raw.sender);
  const id = num(raw.id) ?? 0;
  const attachments = Array.isArray(raw.attachments) ? raw.attachments.map(obj) : [];
  return {
    key: `cw:${conversationId}:${id}`,
    id,
    kind: messageKind(raw),
    private: normalizePrivate(raw.private),
    text: str(raw.content) ?? "",
    sender:
      Object.keys(sender).length > 0
        ? { name: str(sender.available_name) ?? str(sender.name) ?? "Unknown", type: str(sender.type) ?? "" }
        : null,
    at: iso(raw.created_at),
    attachments: attachments.map((file) => ({
      type: str(file.file_type) ?? "file",
      // _attachment.json.jbuilder has no file name field; data_url ends with it. Only the last path part is kept.
      name: decodeURIComponent((str(file.data_url) ?? "").split("?")[0].split("/").pop() || "attachment"),
    })),
  };
}

export function toContact(value: unknown): LinkedContact {
  const raw = obj(value);
  const extra = obj(raw.additional_attributes);
  const id = num(raw.id) ?? 0;
  return {
    key: `cw:${id}`,
    id,
    name: str(raw.name) ?? str(raw.email) ?? "Unknown contact",
    email: str(raw.email),
    phone: str(raw.phone_number),
    identifier: str(raw.identifier),
    company: str(extra.company_name),
    city: str(extra.city),
    country: str(extra.country),
    lastActivityAt: iso(raw.last_activity_at),
    createdAt: iso(raw.created_at),
  };
}

/** The two things the identity check needs from GET /api/v1/profile, and nothing else (plan 2.3). */
export function profileIdentity(value: unknown): { email: string | null; accounts: { id: number; name: string }[] } {
  const raw = obj(value);
  const accounts = Array.isArray(raw.accounts) ? raw.accounts.map(obj) : [];
  return {
    email: str(raw.email),
    accounts: accounts
      .map((account) => ({ id: num(account.id) ?? 0, name: str(account.name) ?? "" }))
      .filter((account) => account.id > 0),
  };
}

/**
 * L-3: the picker lists, names and ids only. GET /agents and GET /teams answer arrays (agents/index and
 * teams/index.json.jbuilder; _agent carries email and role, which are not passed on); GET /labels answers
 * {payload: [{title, ...}]} (labels/index.json.jbuilder).
 */
export function toOptions(agents: unknown, teams: unknown, labels: unknown): LinkedOptionsBody {
  const list = (value: unknown) => (Array.isArray(value) ? value.map(obj) : []);
  const labelRows = obj(labels).payload;
  return {
    agents: list(agents)
      .filter((agent) => num(agent.id) !== null)
      .map((agent) => ({
        id: num(agent.id) as number,
        name: str(agent.available_name) ?? str(agent.name) ?? `Agent ${agent.id}`,
      })),
    teams: list(teams)
      .filter((team) => num(team.id) !== null)
      .map((team) => ({ id: num(team.id) as number, name: str(team.name) ?? `Team ${team.id}` })),
    labels: list(labelRows)
      .map((label) => str(label.title))
      .filter((title): title is string => title !== null),
  };
}

//* ------------------------------------------------------------------ U-2 Studio Store Mappers --------------------- */

const LABEL_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#8b5cf6", "#14b8a6"];

function relativeTimeLabel(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (diffSec < 60) return "now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function contactRelativeActivity(seconds: number | null): { text: string; minutes: number } {
  if (!seconds || seconds <= 0) return { text: "---", minutes: Number.MAX_SAFE_INTEGER };
  const mins = Math.max(1, Math.floor((Date.now() / 1000 - seconds) / 60));
  if (mins < 60) return { text: mins === 1 ? "1 minute ago" : `${mins} minutes ago`, minutes: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: hours === 1 ? "1 hour ago" : `${hours} hours ago`, minutes: mins };
  const days = Math.floor(hours / 24);
  if (days === 1) return { text: "Yesterday", minutes: mins };
  if (days < 30) return { text: `${days} days ago`, minutes: mins };
  return {
    text: new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    minutes: mins,
  };
}

export function channelSlugFromType(
  rawType: string | null | undefined,
  inboxName?: string | null,
): {
  slug: string;
  inboxChannel: ChannelKey;
  channelType: string;
} {
  const lower = `${rawType ?? ""} ${inboxName ?? ""}`.toLowerCase();
  if (lower.includes("facebook") || lower.includes("messenger")) {
    return { slug: "facebook", inboxChannel: "facebook", channelType: "Messenger" };
  }
  if (lower.includes("instagram")) {
    return { slug: "instagram", inboxChannel: "instagram", channelType: "Instagram" };
  }
  if (lower.includes("whatsapp")) {
    return { slug: "whatsapp", inboxChannel: "whatsapp", channelType: "WhatsApp" };
  }
  if (lower.includes("email")) {
    return { slug: "email", inboxChannel: "email", channelType: "Email" };
  }
  if (lower.includes("sms") || lower.includes("twilio")) {
    return { slug: "sms", inboxChannel: "sms", channelType: "SMS" };
  }
  if (lower.includes("telegram")) {
    return { slug: "telegram", inboxChannel: "telegram", channelType: "Telegram" };
  }
  if (lower.includes("line")) {
    return { slug: "line", inboxChannel: "line", channelType: "LINE" };
  }
  if (lower.includes("tiktok")) {
    return { slug: "tiktok", inboxChannel: "tiktok", channelType: "TikTok" };
  }
  if (lower.includes("voice") || lower.includes("phone")) {
    return { slug: "phone", inboxChannel: "voice", channelType: "Voice" };
  }
  if (lower.includes("api")) {
    return { slug: "api", inboxChannel: "api", channelType: "API" };
  }
  return { slug: "chat", inboxChannel: "website", channelType: "Website" };
}

export function toSharedAgents(rawAgents: unknown): { agents: Agent[]; realAgentIds: number[] } {
  const list = Array.isArray(rawAgents) ? rawAgents.map(obj) : [];
  const realAgentIds: number[] = [];
  const mapped: Agent[] = [];

  for (const a of list) {
    const id = num(a.id);
    if (id === null) continue;
    realAgentIds.push(id);
    const name = str(a.available_name) ?? str(a.name) ?? `Agent ${id}`;
    const roleRaw = str(a.role) ?? "agent";
    const statusRaw = str(a.availability_status) ?? "offline";
    mapped.push({
      id,
      name,
      email: str(a.email) ?? `agent-${id}@chatwoot.local`,
      role: roleRaw === "administrator" ? "administrator" : "agent",
      customRoleId: num(a.custom_role_id),
      availability: statusRaw === "online" ? "online" : statusRaw === "busy" ? "busy" : "offline",
      confirmed: a.confirmed !== false,
      provider: str(a.provider) === "saml" ? "saml" : "email",
      joinedDate: (() => {
        const createdSec = toUnixSeconds(a.created_at);
        if (createdSec && createdSec > 0) {
          return new Date(createdSec * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
        return "";
      })(),
    });
  }

  // Condition 5: Ensure ViewAsSwitcher has Agent role personas with distinct inbox memberships
  // when the Chatwoot account only has a single Administrator user (e.g., id=1 Fahad).
  const existingIds = new Set(mapped.map((a) => a.id));
  for (const seed of seedAgents) {
    if (seed.role === "agent" && !existingIds.has(seed.id)) {
      mapped.push(seed);
      existingIds.add(seed.id);
    }
  }

  return { agents: mapped, realAgentIds };
}

export function toSharedInboxes(rawInboxes: unknown, realAgentIds: number[]): Inbox[] {
  const payload = Array.isArray(rawInboxes)
    ? rawInboxes
    : Array.isArray(obj(rawInboxes).payload)
      ? (obj(rawInboxes).payload as unknown[])
      : [];
  const inboxes: Inbox[] = [];
  const usedSlugs = new Set<string>();
  for (const item of payload) {
    const raw = obj(item);
    const id = num(raw.id);
    if (id === null) continue;
    const name = str(raw.name) ?? `Inbox ${id}`;
    const ch = channelSlugFromType(str(raw.channel_type), name);
    const slug = usedSlugs.has(ch.slug) ? `${ch.slug}-${id}` : ch.slug;
    usedSlugs.add(slug);
    const seedMatch = seedInboxes.find((s) => s.slug === ch.slug || s.channel === ch.inboxChannel);
    const memberIds = Array.from(new Set([...realAgentIds, ...(seedMatch?.agents ?? [])]));
    const providerRaw = str(raw.provider);
    inboxes.push({
      id,
      slug,
      name,
      channel: ch.inboxChannel,
      channelType: ch.channelType,
      identifier: str(raw.phone_number) ?? str(raw.website_url) ?? str(raw.channel_type) ?? name,
      agents: memberIds,
      autoAssign: raw.enable_auto_assignment !== false,
      ...(providerRaw === "whatsapp_cloud" || providerRaw === "twilio" ? { provider: providerRaw } : {}),
    });
  }
  return inboxes;
}

export function toSharedTeams(rawTeams: unknown, realAgentIds: number[]): Team[] {
  const list = Array.isArray(rawTeams)
    ? rawTeams
    : Array.isArray(obj(rawTeams).payload)
      ? (obj(rawTeams).payload as unknown[])
      : [];
  const teams: Team[] = [];
  for (const item of list) {
    const raw = obj(item);
    const id = num(raw.id);
    if (id === null) continue;
    const name = str(raw.name) ?? `team-${id}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || `team-${id}`;
    teams.push({
      id,
      slug,
      name,
      description: str(raw.description) ?? "",
      icon: "users",
      autoAssign: Boolean(raw.allow_auto_assign),
      members: realAgentIds.length > 0 ? [...realAgentIds] : [1],
    });
  }
  return teams;
}

export function toSharedLabels(rawLabels: unknown, extraLabelTitles: string[] = []): Label[] {
  const payload = Array.isArray(rawLabels)
    ? rawLabels
    : Array.isArray(obj(rawLabels).payload)
      ? (obj(rawLabels).payload as unknown[])
      : [];
  const labels: Label[] = [];
  const seen = new Set<string>();

  for (const item of payload) {
    const raw = obj(item);
    const title = str(raw.title);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    labels.push({
      id: title,
      title,
      description: str(raw.description) ?? "",
      color: str(raw.color) ?? LABEL_COLORS[labels.length % LABEL_COLORS.length],
      showOnSidebar: raw.show_on_sidebar !== false,
    });
  }

  for (const title of extraLabelTitles) {
    const clean = title.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    labels.push({
      id: clean,
      title: clean,
      description: "",
      color: LABEL_COLORS[labels.length % LABEL_COLORS.length],
      showOnSidebar: true,
    });
  }

  return labels;
}

export function toSharedCanned(rawCanned: unknown): CannedResponse[] {
  const list = Array.isArray(rawCanned)
    ? rawCanned
    : Array.isArray(obj(rawCanned).payload)
      ? (obj(rawCanned).payload as unknown[])
      : [];
  const out: CannedResponse[] = [];
  for (const item of list) {
    const raw = obj(item);
    const id = num(raw.id);
    const shortCode = str(raw.short_code);
    const content = str(raw.content);
    if (id === null || !shortCode || !content) continue;
    out.push({ id, shortCode, content });
  }
  return out;
}

export function toCwMessage(value: unknown, agentNames: Map<number, string>): CwMessage {
  const raw = obj(value);
  const id = num(raw.id) ?? 0;
  const sender = obj(raw.sender);
  const senderName = str(sender.available_name) ?? str(sender.name);
  const senderId = num(sender.id);
  const kindRaw = messageKind(raw);
  const createdSec = toUnixSeconds(raw.created_at);
  const atIso = iso(raw.created_at) ?? undefined;
  const timeStr =
    createdSec && createdSec > 0
      ? new Date(createdSec * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : atIso
        ? new Date(atIso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "Just now";

  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments.map(obj) : [];
  const attachments: CwAttachment[] = rawAttachments.map((att, idx) => {
    const dataUrl = str(att.data_url) ?? "";
    const fileType = str(att.file_type) ?? "file";
    const name = decodeURIComponent(dataUrl.split("?")[0].split("/").pop() || `attachment-${idx + 1}`);
    const typeAtt: CwAttachment["type"] =
      fileType === "image"
        ? "image"
        : fileType === "audio"
          ? "audio"
          : fileType === "video"
            ? "video"
            : fileType === "location"
              ? "location"
              : fileType === "contact"
                ? "contact"
                : "file";
    return {
      type: typeAtt,
      name,
      ...(num(att.file_size) ? { size: `${Math.max(1, Math.round((num(att.file_size) as number) / 1024))} KB` } : {}),
      ...(dataUrl ? { previewUrl: dataUrl } : {}),
      ...(typeAtt === "audio" ? { duration: "0:15" } : {}),
    };
  });

  const contentAttrs = obj(raw.content_attributes);
  const replyToId = num(contentAttrs.in_reply_to);

  // V-17: Forward Chatwoot message delivery status and external error from content_attributes.external_error
  // or the top-level status field (Chatwoot MESSAGE_STATUS values: sent, delivered, read, failed).
  const cwStatus = str(raw.status);
  const externalError = str(contentAttrs.external_error);
  // V-17 r2: forward all Chatwoot delivery statuses (sent, delivered, read, failed), not just failed.
  const deliveryStatus: CwMessage["status"] =
    cwStatus === "sent" || cwStatus === "delivered" || cwStatus === "read" || cwStatus === "failed"
      ? cwStatus
      : undefined;
  const errorText = cwStatus === "failed" ? (externalError ?? str(raw.error) ?? "Message failed to send") : undefined;

  if (kindRaw === "activity") {
    return {
      id: String(id),
      kind: "activity",
      text: str(raw.content) ?? "Activity update",
      time: timeStr,
      ...(atIso ? { at: atIso } : {}),
    };
  }

  if (kindRaw === "note") {
    return {
      id: String(id),
      kind: "note",
      sender: senderName ?? (senderId ? agentNames.get(senderId) : undefined) ?? "Agent",
      text: str(raw.content) ?? "",
      time: timeStr,
      ...(atIso ? { at: atIso } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    };
  }

  const kind: CwMessage["kind"] = kindRaw === "incoming" ? "incoming" : "outgoing";
  return {
    id: String(id),
    kind,
    sender:
      kind === "incoming"
        ? (senderName ?? "Customer")
        : (senderName ?? (senderId ? agentNames.get(senderId) : undefined) ?? "Agent"),
    text: str(raw.content) ?? "",
    time: timeStr,
    ...(atIso ? { at: atIso } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(replyToId ? { replyTo: String(replyToId) } : {}),
    ...(deliveryStatus ? { status: deliveryStatus } : {}),
    ...(errorText ? { error: errorText } : {}),
  };
}

export function toCwMessages(rawPayload: unknown, agentNames: Map<number, string>): CwMessage[] {
  const rows = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(obj(rawPayload).payload)
      ? (obj(rawPayload).payload as unknown[])
      : [];
  const sorted = [...rows].sort(
    (a, b) => (toUnixSeconds(obj(a).created_at) ?? 0) - (toUnixSeconds(obj(b).created_at) ?? 0),
  );
  return sorted.map((m) => toCwMessage(m, agentNames));
}

function mapPriority(raw: string | null): Priority {
  if (raw === "urgent" || raw === "high" || raw === "medium" || raw === "low") return raw;
  return "none";
}

export interface MappedConversationsResult {
  conversations: Conversation[];
  personOfMap: Record<number, number>;
  metaByConvId: Record<number, ConversationMeta>;
  unreadByConvId: Record<number, number>;
  tagsByConvId: Record<string, string[]>;
  threadsByConvId: Record<number, CwMessage[]>;
  conversationAttrsByConvId: Record<number, Record<string, string>>;
  contactAttrsByConvId: Record<number, Record<string, string>>;
  inboxIdByConvId: Record<number, number>;
  mutedByConvId: Record<number, boolean>;
}

export function toStudioConversations(
  rawConvs: unknown[],
  inboxes: Inbox[],
  teams: Team[],
  agentNames: Map<number, string>,
): MappedConversationsResult {
  const inboxById = new Map<number, Inbox>(inboxes.map((i) => [i.id, i]));
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));

  const conversations: Conversation[] = [];
  const personOfMap: Record<number, number> = {};
  const metaByConvId: Record<number, ConversationMeta> = {};
  const unreadMap: Record<number, number> = {};
  const tagsByConvId: Record<string, string[]> = {};
  const threadsByConvId: Record<number, CwMessage[]> = {};
  const conversationAttrsByConvId: Record<number, Record<string, string>> = {};
  const contactAttrsByConvId: Record<number, Record<string, string>> = {};
  const inboxIdByConvId: Record<number, number> = {};
  const mutedByConvId: Record<number, boolean> = {};

  for (const [index, item] of rawConvs.entries()) {
    const raw = obj(item);
    const idNum = num(raw.id);
    if (idNum === null) continue;
    const meta = obj(raw.meta);
    const sender = obj(meta.sender);
    const assignee = obj(meta.assignee);
    const team = obj(meta.team);

    const senderId = num(sender.id) ?? idNum;
    personOfMap[idNum] = senderId;

    const senderName = str(sender.name) ?? str(sender.email) ?? `Contact #${senderId}`;
    const senderEmail = str(sender.email) ?? "";
    const senderPhone = str(sender.phone_number) ?? "";
    const senderExtra = obj(sender.additional_attributes);
    const senderCompany = str(senderExtra.company_name) ?? "";
    const senderLocation = [str(senderExtra.city), str(senderExtra.country)].filter(Boolean).join(", ");
    const createdSec = toUnixSeconds(raw.created_at);
    const lastSec = toUnixSeconds(raw.last_activity_at) ?? toUnixSeconds(raw.timestamp) ?? createdSec;
    const agoMins = lastSec ? Math.max(0, Math.floor((Date.now() / 1000 - lastSec) / 60)) : 0;

    const inboxId = num(raw.inbox_id) ?? 1;
    const inbox = inboxById.get(inboxId);
    const ch = channelSlugFromType(inbox?.channelType ?? str(meta.channel), inbox?.name);
    const channelSlug = inbox?.slug ?? ch.slug;

    const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
    const mappedMsgs = toCwMessages(rawMessages, agentNames);
    threadsByConvId[idNum] = mappedMsgs;

    const nonActivity = mappedMsgs.filter((m) => m.kind === "incoming" || m.kind === "outgoing");
    const lastMsg = nonActivity.at(-1) ?? mappedMsgs.at(-1);
    const previewText = lastMsg?.text || "No Messages";
    const timeStr = relativeTimeLabel(lastSec);

    const assigneeId = num(assignee.id);
    const teamId = num(team.id);
    const matchedTeam = teamId !== null ? teamById.get(teamId) : undefined;
    const teamSlug =
      matchedTeam?.slug ??
      (str(team.name)
        ? str(team.name)!
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
        : null);

    const statusRaw = str(raw.status);
    const status: CwStatus =
      statusRaw === "resolved" || statusRaw === "pending" || statusRaw === "snoozed" ? statusRaw : "open";

    const labels = Array.isArray(raw.labels) ? raw.labels.filter((l): l is string => typeof l === "string") : [];

    const customRaw = obj(raw.custom_attributes);
    const customMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(customRaw)) {
      if (v !== null && v !== undefined) customMap[k] = String(v);
    }

    const senderCustomRaw = obj(sender.custom_attributes);
    const senderCustomMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(senderCustomRaw)) {
      if (v !== null && v !== undefined) senderCustomMap[k] = String(v);
    }

    const unreadCount = num(raw.unread_count) ?? 0;
    const chatMessages: ChatMessage[] = nonActivity.map((m, mIdx) => ({
      id: Number.parseInt(m.id, 10) || idNum * 100 + mIdx + 1,
      align: m.kind === "incoming" ? "start" : "end",
      text: m.text,
      time: m.time,
      ago: agoMins,
    }));

    const contact: ChatContact = {
      name: senderName,
      role: str(senderExtra.description) ?? "",
      company: senderCompany,
      email: senderEmail,
      phone: senderPhone,
      website: "",
      location: senderLocation,
      timezone: str(senderExtra.timezone) ?? str(senderCustomMap.timezone) ?? "",
      status: str(senderExtra.status) ?? str(senderCustomMap.status) ?? "",
      qualifiedAt:
        createdSec && createdSec > 0
          ? new Date(createdSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "",
      tags: labels,
    };

    const isTodayConv = !lastSec || Date.now() / 1000 - lastSec < 86_400;

    conversations.push({
      id: idNum,
      group: isTodayConv ? "Today" : "Yesterday",
      name: senderName,
      subject: `${inbox?.name ?? ch.channelType} · #${idNum}`,
      preview: previewText,
      time: timeStr,
      isUnread: unreadCount > 0,
      unreadCount,
      channel: channelSlug,
      contact,
      messages: chatMessages,
      ago: agoMins,
    });

    const hasAgentReply = mappedMsgs.some((m) => m.kind === "outgoing");
    const snoozedSec = toUnixSeconds(raw.snoozed_until);
    const snoozedUntil =
      status === "snoozed"
        ? snoozedSec
          ? `Snoozed until ${new Date(snoozedSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : "Snoozed until next reply"
        : null;

    metaByConvId[idNum] = {
      status,
      priority: mapPriority(str(raw.priority)),
      assigneeId,
      teamId: teamSlug,
      unattended: status === "open" && !hasAgentReply,
      mentioned: false,
      participants: assigneeId ? [assigneeId] : [],
      snoozedUntil,
      sla: null,
      createdRank: rawConvs.length - index,
      createdAt:
        createdSec && createdSec > 0
          ? new Date(createdSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "",
    };

    unreadMap[idNum] = unreadCount;
    tagsByConvId[String(idNum)] = labels;
    conversationAttrsByConvId[idNum] = customMap;
    contactAttrsByConvId[idNum] = senderCustomMap;
    inboxIdByConvId[idNum] = inboxId;
    mutedByConvId[idNum] = raw.muted === true;
  }

  return {
    conversations,
    personOfMap,
    metaByConvId,
    unreadByConvId: unreadMap,
    tagsByConvId,
    threadsByConvId,
    conversationAttrsByConvId,
    contactAttrsByConvId,
    inboxIdByConvId,
    mutedByConvId,
  };
}

export function toDirectoryContact(value: unknown): DirectoryContact {
  const raw = obj(value);
  const idNum = num(raw.id) ?? 0;
  const name = str(raw.name) ?? str(raw.email) ?? `Contact #${idNum}`;
  const email = str(raw.email) ?? "";
  const phone = str(raw.phone_number) ?? "";
  const extra = obj(raw.additional_attributes);
  const customRaw = obj(raw.custom_attributes);
  const company = str(extra.company_name) ?? str(customRaw.company) ?? "";
  const city = str(extra.city) ?? "";
  const country = str(extra.country) ?? "";
  const bio = str(extra.description) ?? str(extra.bio) ?? "";
  const lastSec = toUnixSeconds(raw.last_activity_at);
  const createdSec = toUnixSeconds(raw.created_at);
  const activity = contactRelativeActivity(lastSec);

  return {
    id: idNum,
    name,
    email,
    phone,
    company,
    city,
    country,
    bio,
    lastActivity: activity.text,
    lastActivityMinutes: activity.minutes,
    createdAt:
      createdSec && createdSec > 0
        ? new Date(createdSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "",
    labels: Array.isArray(raw.labels)
      ? raw.labels.filter((label): label is string => typeof label === "string")
      : Array.isArray(raw.label_list)
        ? raw.label_list.filter((label): label is string => typeof label === "string")
        : [],
  };
}

export function toDirectoryContacts(rawContacts: unknown[]): DirectoryContact[] {
  return rawContacts.filter((c) => num(obj(c).id) !== null).map((c) => toDirectoryContact(c));
}

/* ------------------------------------------------------------------ V-15 Portal & Campaign Mappers ----------------- */

export interface LinkedPortal {
  id: number;
  name: string;
  slug: string;
  customDomain: string;
  color: string;
  pageTitle: string;
  headerText: string;
  homePageLink: string;
  articles: number;
}

export interface LinkedArticle {
  id: number;
  title: string;
  status: "published" | "draft" | "archived";
  authorId: number;
  categoryId: number | null;
  views: number;
  updated: string;
  locale?: string;
  metaDescription?: string;
  metaTags?: string[];
}

export interface LinkedCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  articles: number;
}

export interface LinkedCampaign {
  id: number;
  title: string;
  message: string;
  enabled: boolean;
  sender: string | null;
  inbox: string;
  url: string;
  timeOnPage: number;
  businessHoursOnly: boolean;
}

export function toPortal(value: unknown): LinkedPortal {
  const raw = obj(value);
  const id = num(raw.id) ?? 0;
  return {
    id,
    name: str(raw.name) ?? `Portal ${id}`,
    slug: str(raw.slug) ?? `portal-${id}`,
    customDomain: str(raw.custom_domain) ?? "",
    color: str(raw.color) ?? "#6366f1",
    pageTitle: str(raw.page_title) ?? str(raw.name) ?? "Help Center",
    headerText: str(raw.header_text) ?? "",
    homePageLink: str(raw.home_page_link) ?? "",
    articles: num(raw.articles_count) ?? 0,
  };
}

export function toPortals(rawPayload: unknown): LinkedPortal[] {
  const payload = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(obj(rawPayload).payload)
      ? (obj(rawPayload).payload as unknown[])
      : [];
  return payload.filter((p) => num(obj(p).id) !== null).map((p) => toPortal(p));
}

export function toArticle(value: unknown): LinkedArticle {
  const raw = obj(value);
  const id = num(raw.id) ?? 0;
  const author = obj(raw.author);
  const category = obj(raw.category);
  const createdSec = toUnixSeconds(raw.updated_at) ?? toUnixSeconds(raw.created_at) ?? 0;
  const updated =
    createdSec > 0
      ? relativeTimeLabel(createdSec)
      : iso(raw.updated_at)
        ? new Date(iso(raw.updated_at)!).toLocaleDateString()
        : "Just now";

  const statusRaw = num(raw.status) ?? 0;
  const status: LinkedArticle["status"] = statusRaw === 0 ? "draft" : statusRaw === 1 ? "published" : "archived";

  const metaObj = obj(raw.meta);
  return {
    id,
    title: str(raw.title) ?? `Article ${id}`,
    status,
    authorId: num(author.id) ?? num(raw.author_id) ?? 1,
    categoryId: num(category.id) ?? num(raw.category_id) ?? null,
    views: num(raw.views) ?? 0,
    updated,
    locale: str(raw.locale) ?? undefined,
    metaDescription: str(metaObj.description) ?? str(raw.meta_description) ?? undefined,
    metaTags: Array.isArray(metaObj.tags)
      ? metaObj.tags.filter((t): t is string => typeof t === "string")
      : Array.isArray(raw.meta_tags)
        ? raw.meta_tags.filter((t): t is string => typeof t === "string")
        : undefined,
  };
}

export function toArticles(rawPayload: unknown): LinkedArticle[] {
  const payload = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(obj(rawPayload).payload)
      ? (obj(rawPayload).payload as unknown[])
      : [];
  return payload.filter((a) => num(obj(a).id) !== null).map((a) => toArticle(a));
}

export function toCategory(value: unknown): LinkedCategory {
  const raw = obj(value);
  const id = num(raw.id) ?? 0;
  return {
    id,
    name: str(raw.name) ?? `Category ${id}`,
    slug: str(raw.slug) ?? str(raw.locale) ?? `category-${id}`,
    icon: str(raw.icon) ?? "📄",
    description: str(raw.description) ?? "",
    articles: num(raw.articles_count) ?? 0,
  };
}

export function toCategories(rawPayload: unknown): LinkedCategory[] {
  const payload = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(obj(rawPayload).payload)
      ? (obj(rawPayload).payload as unknown[])
      : [];
  return payload.filter((c) => num(obj(c).id) !== null).map((c) => toCategory(c));
}

export function toCampaign(value: unknown): LinkedCampaign {
  const raw = obj(value);
  const id = num(raw.id) ?? num(raw.display_id) ?? 0;
  const inbox = obj(raw.inbox);
  return {
    id,
    title: str(raw.title) ?? `Campaign ${id}`,
    message: str(raw.message) ?? "",
    enabled: raw.enabled !== false && raw.campaign_status !== "disabled",
    sender: str(obj(raw.sender).name) ?? str(raw.campaign_sender_name) ?? null,
    inbox: str(inbox.name) ?? str(raw.inbox_name) ?? "Website Chat",
    url: str(raw.trigger_url) ?? str(raw.url) ?? "",
    timeOnPage: num(raw.trigger_time_on_page) ?? num(raw.time_on_page) ?? 10,
    businessHoursOnly: raw.trigger_only_during_business_hours === true || raw.business_hours_only === true,
  };
}

export function toCampaigns(rawPayload: unknown): LinkedCampaign[] {
  const payload = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(obj(rawPayload).payload)
      ? (obj(rawPayload).payload as unknown[])
      : [];
  return payload
    .filter((c) => {
      const id = num(obj(c).id) ?? num(obj(c).display_id);
      return id !== null;
    })
    .map((c) => toCampaign(c));
}

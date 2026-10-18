// U-4 (`u4-cw-realtime-events`, item 159) + V-2 (`v2-cw-redis-bus-and-reconcile`, item 160.4):
// Server-only singleton realtime event bus connecting `/api/cw/webhook` (Chatwoot v4.18.0 HMAC-signed webhooks)
// to `/api/cw/events` (SSE stream), backed by local Redis Streams (`XADD ... MAXLEN ~ 2000`) and 86400s TTL
// deduplication keys (`SET ... EX 86400`) plus a synchronous circular disk journal outside `.preview-state/`
// for non-destructive fallback and full sequence/event recovery across restarts or memory resets.
// biome-ignore lint/correctness/noUndeclaredDependencies: Next.js resolves "server-only" itself
import "server-only";

import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

export interface RealtimeEventEnvelope {
  seq: number;
  event: string;
  receivedAt: string;
  inboxId: number | null;
  conversationId: number | null;
  payload: Record<string, unknown>;
}

export interface PublishWebhookResult {
  accepted: boolean;
  duplicate: boolean;
  deduped: boolean;
  persisted: boolean;
  deliveryId: string | null;
  existingSeq: number | null;
  streamId: string | null;
  envelope: RealtimeEventEnvelope | null;
}

export interface ReplaySinceResult {
  events: RealtimeEventEnvelope[];
  oldestSeq: number | null;
  latestSeq: number;
  reconcileRequired: boolean;
  source: "redis" | "disk" | "memory";
}

type Listener = (envelope: RealtimeEventEnvelope) => void;

interface DedupEntry {
  seq: number;
  expiresAt: number;
}

interface RealtimeBusState {
  seq: number;
  /** Bounded LRU Map of recent event keys (max 2000) with expiry to prevent processing/broadcasting duplicates. */
  dedup: Map<string, DedupEntry>;
  /** Circular buffer of recent scrubbed events for Last-Event-ID / ?since=<seq> catch-up. */
  buffer: RealtimeEventEnvelope[];
  listeners: Set<Listener>;
  hydratedFromDisk: boolean;
  hydratedFromRedis: boolean;
}

interface DiskJournalData {
  seq: number;
  updatedAt: string;
  events: RealtimeEventEnvelope[];
  dedup: Record<string, DedupEntry>;
}

export const REDIS_STREAM_KEY = "studio:cw:realtime:stream";
export const REDIS_SEQ_KEY = "studio:cw:realtime:seq";
export const REDIS_DEDUP_PREFIX = "studio:cw:realtime:dedup:";
export const REDIS_STREAM_MAXLEN = 2000;
export const REDIS_DEDUP_TTL_SECONDS = 86_400;

const MAX_DEDUP_SIZE = 2000;
const MAX_BUFFER_SIZE = 2000;
const REDIS_TIMEOUT_MS = 1500;

/**
 * Isolated strictly outside `.preview-state/` (Supervisor constraint 2) so `.preview-state/` sha256 checksums
 * are never touched.
 */
export const DISK_JOURNAL_PATH =
  process.env.STUDIO_CW_BUS_JOURNAL_FILE?.trim() || "/tmp/studio-cw-realtime-bus-journal.json";

const globalBus = globalThis as typeof globalThis & {
  __studioCwRealtimeBus?: RealtimeBusState;
};

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/* ------------------------------------------------------------------ Redis RESP2 Client (zero-dep, node:net) ------ */

function getRedisEndpoint(): { host: string; port: number } {
  const raw = (process.env.STUDIO_REDIS_URL ?? process.env.REDIS_URL ?? "").trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      return {
        host: parsed.hostname || "127.0.0.1",
        port: Number.parseInt(parsed.port || "6379", 10) || 6379,
      };
    } catch {
      // fall through to default local Redis
    }
  }
  return { host: "127.0.0.1", port: 6379 };
}

function encodeRespCommand(args: readonly string[]): string {
  let out = `*${args.length}\r\n`;
  for (const arg of args) {
    const s = String(arg);
    out += `$${Buffer.byteLength(s, "utf8")}\r\n${s}\r\n`;
  }
  return out;
}

function parseRespValue(buf: Buffer, offset = 0): { value: unknown; offset: number } | null {
  if (offset >= buf.length) return null;
  const prefix = String.fromCharCode(buf[offset]);
  const lineEnd = buf.indexOf("\r\n", offset);
  if (lineEnd === -1) return null;
  const header = buf.subarray(offset + 1, lineEnd).toString("utf8");
  const nextOffset = lineEnd + 2;

  if (prefix === "+") return { value: header, offset: nextOffset };
  if (prefix === "-") return { value: new Error(header), offset: nextOffset };
  if (prefix === ":") return { value: Number.parseInt(header, 10), offset: nextOffset };
  if (prefix === "$") {
    const len = Number.parseInt(header, 10);
    if (len === -1) return { value: null, offset: nextOffset };
    const end = nextOffset + len;
    if (end + 2 > buf.length) return null;
    const val = buf.subarray(nextOffset, end).toString("utf8");
    return { value: val, offset: end + 2 };
  }
  if (prefix === "*") {
    const count = Number.parseInt(header, 10);
    if (count === -1) return { value: null, offset: nextOffset };
    const items: unknown[] = [];
    let cur = nextOffset;
    for (let i = 0; i < count; i++) {
      const parsed = parseRespValue(buf, cur);
      if (!parsed) return null;
      items.push(parsed.value);
      cur = parsed.offset;
    }
    return { value: items, offset: cur };
  }
  return null;
}

async function execRedisPipeline(
  commands: readonly (readonly string[])[],
  timeoutMs = REDIS_TIMEOUT_MS,
): Promise<unknown[] | null> {
  if (commands.length === 0) return [];
  const { host, port } = getRedisEndpoint();
  return new Promise((resolve) => {
    let settled = false;
    let buf = Buffer.alloc(0);
    const socket = net.createConnection({ host, port });

    const finish = (result: unknown[] | null) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore socket close errors
      }
      resolve(result);
    };

    socket.setTimeout(timeoutMs, () => finish(null));
    socket.on("error", () => finish(null));
    socket.on("close", () => finish(null));
    socket.on("connect", () => {
      try {
        socket.write(commands.map(encodeRespCommand).join(""));
      } catch {
        finish(null);
      }
    });
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const results: unknown[] = [];
      let cur = 0;
      for (let i = 0; i < commands.length; i++) {
        const parsed = parseRespValue(buf, cur);
        if (!parsed) return;
        results.push(parsed.value);
        cur = parsed.offset;
      }
      finish(results);
    });
  });
}

/* ------------------------------------------------------------------ Disk Journal Fallback (outside .preview-state) */

function readDiskJournal(): DiskJournalData | null {
  try {
    if (!existsSync(DISK_JOURNAL_PATH)) return null;
    const raw = readFileSync(DISK_JOURNAL_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const seq = typeof parsed.seq === "number" && Number.isFinite(parsed.seq) ? parsed.seq : 0;
    const events = Array.isArray(parsed.events) ? (parsed.events as RealtimeEventEnvelope[]) : [];
    const dedup =
      parsed.dedup && typeof parsed.dedup === "object" && !Array.isArray(parsed.dedup)
        ? (parsed.dedup as Record<string, DedupEntry>)
        : {};
    return {
      seq,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      events,
      dedup,
    };
  } catch {
    return null;
  }
}

function writeDiskJournal(bus: RealtimeBusState): boolean {
  try {
    const now = Date.now();
    const dir = path.dirname(DISK_JOURNAL_PATH);
    mkdirSync(dir, { recursive: true });
    const dedupObj: Record<string, DedupEntry> = {};
    for (const [k, v] of bus.dedup.entries()) {
      if (v.expiresAt > now) {
        dedupObj[k] = v;
      }
    }
    const data: DiskJournalData = {
      seq: bus.seq,
      updatedAt: new Date(now).toISOString(),
      events: bus.buffer.slice(-MAX_BUFFER_SIZE),
      dedup: dedupObj,
    };
    const tmpPath = `${DISK_JOURNAL_PATH}.${process.pid}.${now}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(data), "utf8");
    renameSync(tmpPath, DISK_JOURNAL_PATH);
    return true;
  } catch {
    return false;
  }
}

function hydrateBusFromDiskSync(bus: RealtimeBusState): void {
  if (bus.hydratedFromDisk) return;
  bus.hydratedFromDisk = true;
  const journal = readDiskJournal();
  if (!journal) return;
  const now = Date.now();
  if (journal.seq > bus.seq) {
    bus.seq = journal.seq;
  }
  const existingSeqs = new Set(bus.buffer.map((e) => e.seq));
  for (const item of journal.events) {
    if (item && typeof item.seq === "number" && !existingSeqs.has(item.seq)) {
      const safePayload = obj(scrubSecrets(item.payload));
      bus.buffer.push({
        seq: item.seq,
        event: String(item.event ?? "unknown"),
        receivedAt: String(item.receivedAt ?? new Date(now).toISOString()),
        inboxId: num(item.inboxId),
        conversationId: num(item.conversationId),
        payload: safePayload,
      });
      existingSeqs.add(item.seq);
      if (item.seq > bus.seq) bus.seq = item.seq;
    }
  }
  bus.buffer.sort((a, b) => a.seq - b.seq);
  if (bus.buffer.length > MAX_BUFFER_SIZE) {
    bus.buffer.splice(0, bus.buffer.length - MAX_BUFFER_SIZE);
  }
  for (const [k, entry] of Object.entries(journal.dedup)) {
    if (entry && typeof entry.expiresAt === "number" && entry.expiresAt > now) {
      rememberDedupKey(bus.dedup, k, entry.seq ?? 0, entry.expiresAt);
    }
  }
}

function getBus(): RealtimeBusState {
  if (!globalBus.__studioCwRealtimeBus) {
    globalBus.__studioCwRealtimeBus = {
      seq: 0,
      dedup: new Map<string, DedupEntry>(),
      buffer: [],
      listeners: new Set<Listener>(),
      hydratedFromDisk: false,
      hydratedFromRedis: false,
    };
  }
  hydrateBusFromDiskSync(globalBus.__studioCwRealtimeBus);
  return globalBus.__studioCwRealtimeBus;
}

function rememberDedupKey(map: Map<string, DedupEntry>, key: string, seq: number, expiresAt: number): void {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= MAX_DEDUP_SIZE) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, { seq, expiresAt });
}

function hasActiveDedupKey(map: Map<string, DedupEntry>, key: string, now: number): DedupEntry | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    map.delete(key);
    return null;
  }
  return entry;
}

function parseStreamEntries(rawRange: unknown, bus?: RealtimeBusState): RealtimeEventEnvelope[] {
  if (!Array.isArray(rawRange)) return [];
  const now = Date.now();
  const bySeq = new Map<number, RealtimeEventEnvelope>();

  for (const row of rawRange) {
    if (!Array.isArray(row) || row.length < 2 || !Array.isArray(row[1])) continue;
    const kv = row[1] as unknown[];
    const fields: Record<string, string> = {};
    for (let i = 0; i + 1 < kv.length; i += 2) {
      const k = String(kv[i] ?? "");
      const v = String(kv[i + 1] ?? "");
      if (k) fields[k] = v;
    }
    try {
      if (fields.envelope) {
        const parsed = JSON.parse(fields.envelope) as RealtimeEventEnvelope;
        const seq = num(parsed?.seq) ?? (fields.seq ? Number.parseInt(fields.seq, 10) : null);
        if (seq !== null && Number.isFinite(seq) && seq > 0) {
          const safeEnvelope: RealtimeEventEnvelope = {
            seq,
            event: str(parsed.event) ?? fields.event ?? "unknown",
            receivedAt: str(parsed.receivedAt) ?? fields.receivedAt ?? new Date(now).toISOString(),
            inboxId: num(parsed.inboxId),
            conversationId: num(parsed.conversationId),
            payload: obj(scrubSecrets(parsed.payload)),
          };
          bySeq.set(seq, safeEnvelope);
          if (bus) {
            const exp = now + REDIS_DEDUP_TTL_SECONDS * 1000;
            if (fields.deliveryId) {
              rememberDedupKey(bus.dedup, `delivery:${fields.deliveryId}`, seq, exp);
            }
            if (fields.dedupeKey) {
              rememberDedupKey(bus.dedup, `content:${fields.dedupeKey}`, seq, exp);
            }
          }
        }
      }
    } catch {
      // Ignore malformed stream entry
    }
  }

  return Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq);
}

async function hydrateBusFromRedis(bus: RealtimeBusState, force = false): Promise<boolean> {
  if (bus.hydratedFromRedis && !force) return true;
  const reply = await execRedisPipeline([
    ["GET", REDIS_SEQ_KEY],
    ["XRANGE", REDIS_STREAM_KEY, "-", "+"],
  ]);
  if (!reply) return false;

  bus.hydratedFromRedis = true;
  const rawSeq =
    typeof reply[0] === "string" ? Number.parseInt(reply[0], 10) : typeof reply[0] === "number" ? reply[0] : 0;
  if (Number.isFinite(rawSeq) && rawSeq > bus.seq) {
    bus.seq = rawSeq;
  }

  const streamEvents = parseStreamEntries(reply[1], bus);
  if (streamEvents.length > 0) {
    const mergedBySeq = new Map<number, RealtimeEventEnvelope>();
    for (const item of bus.buffer) mergedBySeq.set(item.seq, item);
    for (const item of streamEvents) mergedBySeq.set(item.seq, item);
    bus.buffer = Array.from(mergedBySeq.values())
      .sort((a, b) => a.seq - b.seq)
      .slice(-MAX_BUFFER_SIZE);
    const maxStreamSeq = bus.buffer[bus.buffer.length - 1]?.seq ?? 0;
    if (maxStreamSeq > bus.seq) {
      bus.seq = maxStreamSeq;
    }
  }

  return true;
}

/**
 * Resets ONLY the in-memory singleton state (`seq`, `dedup`, `buffer`) while keeping active SSE `listeners`
 * and leaving the Redis stream (`studio:cw:realtime:stream`) and disk journal untouched.
 * Used to prove live recovery from Redis after process memory wipe without restarting the 8797 server.
 */
export function resetRealtimeBusMemory(): {
  clearedMemory: true;
  previousMemorySeq: number;
  previousBufferSize: number;
} {
  const existing = globalBus.__studioCwRealtimeBus;
  const previousMemorySeq = existing?.seq ?? 0;
  const previousBufferSize = existing?.buffer.length ?? 0;
  const listeners = existing?.listeners ?? new Set<Listener>();

  globalBus.__studioCwRealtimeBus = {
    seq: 0,
    dedup: new Map<string, DedupEntry>(),
    buffer: [],
    listeners,
    // Mark hydratedFromDisk=true so the next operation hydrates directly from Redis first!
    hydratedFromDisk: true,
    hydratedFromRedis: false,
  };

  return {
    clearedMemory: true,
    previousMemorySeq,
    previousBufferSize,
  };
}

/**
 * Builds a deterministic deduplication key for a Chatwoot webhook payload so identical events
 * (or retries of the same state transition/message creation) are never processed or broadcast twice.
 */
export function buildEventDedupeKey(payload: Record<string, unknown>): string {
  const event = str(payload.event) ?? "unknown";
  const id = num(payload.id) ?? str(payload.id) ?? "no-id";

  if (event === "message_created") {
    return `msg_created:${id}`;
  }

  if (event === "message_updated") {
    const content = str(payload.content) ?? "";
    const status = str(payload.status) ?? "";
    const updatedAt = str(payload.updated_at) ?? num(payload.updated_at) ?? "";
    const hash = createHash("sha256")
      .update(`${content}|${status}|${updatedAt}|${JSON.stringify(payload.content_attributes ?? {})}`)
      .digest("hex")
      .slice(0, 16);
    return `msg_updated:${id}:${hash}`;
  }

  if (event === "conversation_created" || event === "conversation_updated" || event === "conversation_status_changed") {
    const status = str(payload.status) ?? "";
    const priority = str(payload.priority) ?? "";
    const meta = obj(payload.meta);
    const assigneeId = num(obj(meta.assignee).id) ?? "none";
    const teamId = num(obj(meta.team).id) ?? "none";
    const labels = Array.isArray(payload.labels) ? payload.labels.join(",") : "";
    const changed = JSON.stringify(payload.changed_attributes ?? []);
    const hash = createHash("sha256")
      .update(`${status}|${priority}|${assigneeId}|${teamId}|${labels}|${changed}`)
      .digest("hex")
      .slice(0, 16);
    return `${event}:${id}:${hash}`;
  }

  // V-18: Chatwoot re-sends typing_on while an agent types. A 24h content hash of the same
  // user+conversation payload would swallow every pulse after the first. Delivery-id still
  // dedupes webhook retries; the content key must be unique per pulse.
  if (
    event === "conversation_typing_on" ||
    event === "conversation_typing_off" ||
    event === "conversation.typing_on" ||
    event === "conversation.typing_off"
  ) {
    const convObj = obj(payload.conversation);
    const convId = num(convObj.id) ?? num(payload.id) ?? "no-conv";
    const userId = num(obj(payload.user).id) ?? "no-user";
    return `typing:${event}:${convId}:${userId}:${Date.now()}`;
  }

  if (event === "contact_created") {
    return `contact_created:${id}`;
  }

  if (event === "contact_updated") {
    const changed = JSON.stringify(payload.changed_attributes ?? payload);
    const hash = createHash("sha256").update(changed).digest("hex").slice(0, 16);
    return `contact_updated:${id}:${hash}`;
  }

  const fallbackHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 20);
  return `${event}:${id}:${fallbackHash}`;
}

function extractInboxId(payload: Record<string, unknown>): number | null {
  const direct = num(payload.inbox_id);
  if (direct !== null) return direct;
  const inboxObj = obj(payload.inbox);
  const fromInbox = num(inboxObj.id);
  if (fromInbox !== null) return fromInbox;
  const convObj = obj(payload.conversation);
  return num(convObj.inbox_id);
}

function extractConversationId(payload: Record<string, unknown>): number | null {
  // V-18: typing webhooks nest the conversation (`user` + `conversation` + `event`), unlike
  // conversation_created/updated which merge webhook_data at the top level. Read the nested id first
  // so `conversation_typing_on` / `conversation.typing_on` get a conversationId on the envelope.
  const convObj = obj(payload.conversation);
  const nested = num(convObj.id) ?? num(convObj.display_id);
  if (nested !== null) return nested;
  return num(payload.id) ?? num(payload.display_id) ?? num(payload.conversation_id);
}

export async function publishWebhookEvent(
  rawPayload: unknown,
  deliveryId?: string | null,
): Promise<PublishWebhookResult> {
  const bus = getBus();
  await hydrateBusFromRedis(bus);

  const scrubbed = obj(scrubSecrets(rawPayload));
  const event = str(scrubbed.event) ?? "unknown";
  const now = Date.now();
  const expiresAt = now + REDIS_DEDUP_TTL_SECONDS * 1000;

  const cleanDeliveryId = deliveryId?.trim() || null;
  const deliveryKey = cleanDeliveryId ? `delivery:${cleanDeliveryId}` : null;
  const rawContentKey = buildEventDedupeKey(scrubbed);
  const contentKey = `content:${rawContentKey}`;

  // 1. Fast in-memory deduplication check
  const memDeliveryHit = deliveryKey ? hasActiveDedupKey(bus.dedup, deliveryKey, now) : null;
  const memContentHit = hasActiveDedupKey(bus.dedup, contentKey, now);
  if (memDeliveryHit || memContentHit) {
    return {
      accepted: false,
      duplicate: true,
      deduped: true,
      persisted: true,
      deliveryId: cleanDeliveryId,
      existingSeq: memDeliveryHit?.seq ?? memContentHit?.seq ?? null,
      streamId: null,
      envelope: null,
    };
  }

  // 2. Authoritative Redis deduplication + sequence check
  const checkCmds: string[][] = [
    ["GET", REDIS_SEQ_KEY],
    ["GET", `${REDIS_DEDUP_PREFIX}${contentKey}`],
  ];
  if (deliveryKey) {
    checkCmds.push(["GET", `${REDIS_DEDUP_PREFIX}${deliveryKey}`]);
  }
  const checkReply = await execRedisPipeline(checkCmds);
  let redisSeq = 0;
  if (checkReply) {
    const parsedSeq = typeof checkReply[0] === "string" ? Number.parseInt(checkReply[0], 10) : 0;
    if (Number.isFinite(parsedSeq) && parsedSeq > 0) redisSeq = parsedSeq;

    const redisContentHit =
      typeof checkReply[1] === "string" && checkReply[1] ? Number.parseInt(checkReply[1], 10) : null;
    const redisDeliveryHit =
      deliveryKey && typeof checkReply[2] === "string" && checkReply[2] ? Number.parseInt(checkReply[2], 10) : null;

    if (redisDeliveryHit !== null || redisContentHit !== null) {
      const hitSeq = redisDeliveryHit ?? redisContentHit ?? 0;
      if (deliveryKey && redisDeliveryHit !== null) rememberDedupKey(bus.dedup, deliveryKey, hitSeq, expiresAt);
      if (redisContentHit !== null) rememberDedupKey(bus.dedup, contentKey, hitSeq, expiresAt);
      return {
        accepted: false,
        duplicate: true,
        deduped: true,
        persisted: true,
        deliveryId: cleanDeliveryId,
        existingSeq: Number.isFinite(hitSeq) && hitSeq > 0 ? hitSeq : null,
        streamId: null,
        envelope: null,
      };
    }
  } else {
    // Fallback to disk journal deduplication if Redis is temporarily unreachable
    const disk = readDiskJournal();
    if (disk) {
      if (disk.seq > redisSeq) redisSeq = disk.seq;
      const diskDelivery = deliveryKey ? disk.dedup[deliveryKey] : undefined;
      const diskContent = disk.dedup[contentKey];
      if ((diskDelivery && diskDelivery.expiresAt > now) || (diskContent && diskContent.expiresAt > now)) {
        const hitSeq = diskDelivery?.seq ?? diskContent?.seq ?? null;
        return {
          accepted: false,
          duplicate: true,
          deduped: true,
          persisted: true,
          deliveryId: cleanDeliveryId,
          existingSeq: hitSeq,
          streamId: null,
          envelope: null,
        };
      }
    }
  }

  const seq = Math.max(bus.seq, redisSeq) + 1;
  bus.seq = seq;

  if (deliveryKey) rememberDedupKey(bus.dedup, deliveryKey, seq, expiresAt);
  rememberDedupKey(bus.dedup, contentKey, seq, expiresAt);

  const envelope: RealtimeEventEnvelope = {
    seq,
    event,
    receivedAt: new Date(now).toISOString(),
    inboxId: extractInboxId(scrubbed),
    conversationId: extractConversationId(scrubbed),
    payload: scrubbed,
  };

  bus.buffer.push(envelope);
  if (bus.buffer.length > MAX_BUFFER_SIZE) {
    bus.buffer.shift();
  }

  // 3. Persist to Redis Stream (XADD MAXLEN ~ 2000) + studio:cw:events:v1 + Redis dedup keys (EX 86400) + Redis seq
  const streamFields: string[] = [
    "seq",
    String(seq),
    "event",
    event,
    "deliveryId",
    cleanDeliveryId ?? "",
    "dedupeKey",
    rawContentKey,
    "receivedAt",
    envelope.receivedAt,
    "inboxId",
    envelope.inboxId !== null ? String(envelope.inboxId) : "",
    "conversationId",
    envelope.conversationId !== null ? String(envelope.conversationId) : "",
    "envelope",
    JSON.stringify(envelope),
  ];
  const writeCmds: string[][] = [
    ["SET", REDIS_SEQ_KEY, String(seq)],
    ["XADD", REDIS_STREAM_KEY, "MAXLEN", "~", String(REDIS_STREAM_MAXLEN), "*", ...streamFields],
    ["XADD", "studio:cw:events:v1", "MAXLEN", "~", String(REDIS_STREAM_MAXLEN), "*", ...streamFields],
    ["SET", `${REDIS_DEDUP_PREFIX}${contentKey}`, String(seq), "EX", String(REDIS_DEDUP_TTL_SECONDS)],
  ];
  if (deliveryKey) {
    writeCmds.push(["SET", `${REDIS_DEDUP_PREFIX}${deliveryKey}`, String(seq), "EX", String(REDIS_DEDUP_TTL_SECONDS)]);
  }

  const writeReply = await execRedisPipeline(writeCmds);
  const streamId = writeReply && typeof writeReply[1] === "string" ? writeReply[1] : null;
  const diskSaved = writeDiskJournal(bus);

  for (const listener of bus.listeners) {
    try {
      listener(envelope);
    } catch {
      // Ignore individual subscriber errors
    }
  }

  return {
    accepted: true,
    duplicate: false,
    deduped: false,
    persisted: Boolean(streamId) || diskSaved,
    deliveryId: cleanDeliveryId,
    existingSeq: seq,
    streamId,
    envelope,
  };
}

/**
 * Replays missed events since `sinceSeq` from the persistent Redis stream (`studio:cw:realtime:stream`)
 * with automatic fallback to the disk journal and in-memory buffer.
 * Also reports whether a gap older than the earliest retained event requires immediate reconciliation.
 */
export async function replaySince(sinceSeq: number): Promise<ReplaySinceResult> {
  const bus = getBus();
  const reply = await execRedisPipeline([
    ["GET", REDIS_SEQ_KEY],
    ["XRANGE", REDIS_STREAM_KEY, "-", "+"],
  ]);

  let source: "redis" | "disk" | "memory" = "memory";
  let allEvents: RealtimeEventEnvelope[] = [];
  let latestSeq = bus.seq;

  if (reply) {
    source = "redis";
    const redisSeq =
      typeof reply[0] === "string" ? Number.parseInt(reply[0], 10) : typeof reply[0] === "number" ? reply[0] : 0;
    if (Number.isFinite(redisSeq) && redisSeq > latestSeq) {
      latestSeq = redisSeq;
    }
    const streamEvents = parseStreamEntries(reply[1], bus);
    const merged = new Map<number, RealtimeEventEnvelope>();
    for (const item of bus.buffer) merged.set(item.seq, item);
    for (const item of streamEvents) merged.set(item.seq, item);
    allEvents = Array.from(merged.values()).sort((a, b) => a.seq - b.seq);
    if (allEvents.length > 0) {
      const maxEventSeq = allEvents[allEvents.length - 1].seq;
      if (maxEventSeq > latestSeq) latestSeq = maxEventSeq;
    }
    bus.seq = latestSeq;
    bus.buffer = allEvents.slice(-MAX_BUFFER_SIZE);
    bus.hydratedFromRedis = true;
  } else {
    const disk = readDiskJournal();
    if (disk) {
      source = "disk";
      if (disk.seq > latestSeq) latestSeq = disk.seq;
      const merged = new Map<number, RealtimeEventEnvelope>();
      for (const item of bus.buffer) merged.set(item.seq, item);
      for (const item of disk.events) {
        if (item && typeof item.seq === "number") {
          merged.set(item.seq, {
            ...item,
            payload: obj(scrubSecrets(item.payload)),
          });
        }
      }
      allEvents = Array.from(merged.values()).sort((a, b) => a.seq - b.seq);
      bus.seq = latestSeq;
      bus.buffer = allEvents.slice(-MAX_BUFFER_SIZE);
    } else {
      allEvents = [...bus.buffer].sort((a, b) => a.seq - b.seq);
    }
  }

  const oldestSeq = allEvents.length > 0 ? allEvents[0].seq : null;
  const reconcileRequired =
    (sinceSeq > 0 && oldestSeq !== null && sinceSeq < oldestSeq) ||
    sinceSeq > latestSeq ||
    (sinceSeq > 0 && latestSeq > 0 && oldestSeq === null);

  const events = allEvents.filter((item) => item.seq > sinceSeq);

  return {
    events,
    oldestSeq,
    latestSeq,
    reconcileRequired,
    source,
  };
}

export function getEventsSince(sinceSeq: number): RealtimeEventEnvelope[] {
  const bus = getBus();
  return bus.buffer.filter((item) => item.seq > sinceSeq);
}

export function getLatestSeq(): number {
  return getBus().seq;
}

export async function getLatestSeqAsync(): Promise<number> {
  const bus = getBus();
  await hydrateBusFromRedis(bus);
  return bus.seq;
}

/**
 * Returns the ISO timestamp of the latest webhook event received in the realtime bus
 * (reading `XREVRANGE studio:cw:events:v1 + - COUNT 1`, `XREVRANGE studio:cw:realtime:stream + - COUNT 1`,
 * in-memory `bus.buffer`, and the persistent disk journal).
 */
export async function getLastCwEventAt(): Promise<string | null> {
  const bus = getBus();
  await hydrateBusFromRedis(bus);

  const candidates: string[] = [];
  const reply = await execRedisPipeline([
    ["XREVRANGE", "studio:cw:events:v1", "+", "-", "COUNT", "1"],
    ["XREVRANGE", REDIS_STREAM_KEY, "+", "-", "COUNT", "1"],
  ]);
  if (reply) {
    const v1Entries = parseStreamEntries(reply[0]);
    const mainEntries = parseStreamEntries(reply[1]);
    const v1Last = v1Entries[v1Entries.length - 1]?.receivedAt;
    const mainLast = mainEntries[mainEntries.length - 1]?.receivedAt;
    if (v1Last) candidates.push(v1Last);
    if (mainLast) candidates.push(mainLast);
  }

  const memLast = bus.buffer[bus.buffer.length - 1]?.receivedAt;
  if (memLast) candidates.push(memLast);

  const disk = readDiskJournal();
  const diskLast = disk?.events[disk.events.length - 1]?.receivedAt;
  if (diskLast) candidates.push(diskLast);

  let bestMs = -1;
  let bestIso: string | null = null;
  for (const iso of candidates) {
    const ms = Date.parse(iso);
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      bestIso = new Date(ms).toISOString();
    }
  }
  return bestIso;
}

export function subscribeRealtimeEvents(listener: Listener): () => void {
  const bus = getBus();
  bus.listeners.add(listener);
  return () => {
    bus.listeners.delete(listener);
  };
}

// U-4 (`u4-cw-realtime-events`, item 159) + V-2 (`v2-cw-redis-bus-and-reconcile`, item 160.4):
// Chatwoot v4.18.0 webhook receiver (`/api/cw/webhook`).
// - Mandatory HMAC-SHA256 verification of `x-chatwoot-signature` and `x-chatwoot-timestamp`
//   (`sha256=HMAC_SHA256(secret, "${timestamp}.${rawBody}")` from Chatwoot's `lib/webhooks/trigger.rb`)
//   using constant-time comparison (`crypto.timingSafeEqual`).
// - Unsigned requests return 401; invalid signatures return 403 immediately.
// - When the Studio mode is `preview` (or link disabled), returns 409 (`preview mode`) and discards the event.
// - Scrubs all secrets (`secret`, `api_access_token`, `bot_token`, etc.) via `scrubSecrets` and persists
//   into the Redis-backed realtime bus (`XADD ... MAXLEN ~ 2000` + 86400s TTL deduplication).

import { NextResponse } from "next/server";

import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import { readLinkState } from "@/lib/chatwoot/mode";
import { publishWebhookEvent, resetRealtimeBusMemory } from "@/lib/chatwoot/realtime-bus";
import { readWebhookSecrets } from "@/lib/chatwoot/server";
import { triggerAsyncJudgeOnResolved } from "@/lib/lobehub/eval-bridge";

import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 2_000_000;

function answer(status: number, body: Record<string, unknown>) {
  return NextResponse.json(scrubSecrets(body), { status, headers });
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifySignatureWithSecrets(
  secrets: readonly string[],
  signatureHeader: string,
  timestampHeader: string,
  rawBody: string,
): boolean {
  const signedPayload = `${timestampHeader}.${rawBody}`;
  for (const secret of secrets) {
    if (!secret) continue;
    const digest = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
    const expectedPrefixed = `sha256=${digest}`;
    if (constantTimeEquals(signatureHeader, expectedPrefixed) || constantTimeEquals(signatureHeader, digest)) {
      return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  const signature = (request.headers.get("x-chatwoot-signature") ?? "").trim();
  const timestamp = (request.headers.get("x-chatwoot-timestamp") ?? "").trim();

  if (!signature || !timestamp || !/^\d{1,16}$/.test(timestamp)) {
    return answer(401, {
      error: "missing or malformed x-chatwoot-signature / x-chatwoot-timestamp",
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return answer(413, { error: "webhook payload too large" });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return answer(400, { error: "unable to read request body" });
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return answer(413, { error: "webhook payload too large" });
  }

  let secrets = await readWebhookSecrets(false);
  let verified = verifySignatureWithSecrets(secrets, signature, timestamp, rawBody);
  if (!verified) {
    secrets = await readWebhookSecrets(true);
    verified = verifySignatureWithSecrets(secrets, signature, timestamp, rawBody);
  }

  if (!verified) {
    return answer(403, { error: "invalid x-chatwoot-signature" });
  }

  const linkState = await readLinkState();
  if (linkState.mode !== "linked" || linkState.disabled) {
    return answer(409, { error: "preview mode" });
  }

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return answer(400, { error: "webhook body is not valid JSON" });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return answer(400, { error: "webhook body must be a JSON object" });
  }

  const reqUrl = new URL(request.url);
  if (reqUrl.searchParams.get("resetMemory") === "1" || request.headers.get("x-studio-reset-bus-memory") === "1") {
    resetRealtimeBusMemory();
  }

  const scrubbedPayload = scrubSecrets(parsed);
  const deliveryId = request.headers.get("x-chatwoot-delivery");
  const result = await publishWebhookEvent(scrubbedPayload, deliveryId);

  void triggerAsyncJudgeOnResolved(scrubbedPayload).catch(() => {
    // Non-blocking background evaluation with 60s per-conversation deduplication
  });

  return answer(200, {
    ok: true,
    accepted: result.accepted,
    duplicate: result.duplicate,
    deduped: result.deduped,
    persisted: result.persisted,
    deliveryId: result.deliveryId,
    streamId: result.streamId,
    seq: result.envelope?.seq ?? result.existingSeq ?? null,
    event: result.envelope?.event ?? null,
  });
}

export async function GET() {
  return answer(405, { error: "method not allowed; POST signed Chatwoot webhooks only" });
}

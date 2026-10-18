// U-4 (`u4-cw-realtime-events`, item 159) + V-2 (`v2-cw-redis-bus-and-reconcile`, item 160.4):
// Server-Sent Events (`/api/cw/events`) streaming scrubbed Chatwoot realtime events to the Studio browser
// in linked mode only.
// - Strictly refuses `preview` mode with HTTP 409 (`preview mode`).
// - Supports `Last-Event-ID` header and `?since=<seq>` query parameter to replay missed events
//   from the persistent Redis stream (`replaySince(sinceSeq)`) upon reconnect or after memory reset.
// - Emits `{ type: "reconcile_required" }` when the requested `since` sequence is older than the earliest
//   retained event in the persistent log so the browser triggers an immediate reconciliation sync.
// - Scrubs all secrets via `scrubSecrets` before writing any frame.
import { NextResponse } from "next/server";

import { scrubSecrets } from "@/lib/chatwoot/gateway-policy";
import { readLinkState } from "@/lib/chatwoot/mode";
import {
  getLatestSeqAsync,
  type RealtimeEventEnvelope,
  replaySince,
  resetRealtimeBusMemory,
  subscribeRealtimeEvents,
} from "@/lib/chatwoot/realtime-bus";

export const dynamic = "force-dynamic";

function parseSinceSeq(request: Request): number | null {
  const headerVal = (request.headers.get("last-event-id") ?? "").trim();
  const queryVal = (new URL(request.url).searchParams.get("since") ?? "").trim();
  const raw = headerVal || queryVal;
  if (!raw || !/^\d{1,12}$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatSseEvent(envelope: RealtimeEventEnvelope): string {
  const safeEnvelope = scrubSecrets(envelope);
  return `id: ${envelope.seq}\ndata: ${JSON.stringify(safeEnvelope)}\n\n`;
}

export async function GET(request: Request) {
  const state = await readLinkState();
  if (state.mode !== "linked" || state.disabled) {
    return NextResponse.json({ error: "preview mode" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const reqUrl = new URL(request.url);
  const memoryReset =
    reqUrl.searchParams.get("resetMemory") === "1" || request.headers.get("x-studio-reset-bus-memory") === "1"
      ? resetRealtimeBusMemory()
      : null;

  const sinceSeq = parseSinceSeq(request);
  const replay = sinceSeq !== null ? await replaySince(sinceSeq) : null;
  const latestSeq = replay ? replay.latestSeq : await getLatestSeqAsync();

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const writeRaw = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      writeRaw(
        `retry: 2000\nevent: ready\ndata: ${JSON.stringify({
          connected: true,
          latestSeq,
          oldestSeq: replay?.oldestSeq ?? null,
          reconcileRequired: replay?.reconcileRequired ?? false,
          source: replay?.source ?? "redis",
          ...(memoryReset ? { memoryReset: true } : {}),
        })}\n\n`,
      );

      let replayedUpTo = sinceSeq ?? -1;
      if (replay) {
        if (replay.reconcileRequired) {
          const reconcilePayload = {
            type: "reconcile_required",
            event: "reconcile_required",
            sinceSeq,
            oldestSeq: replay.oldestSeq,
            latestSeq: replay.latestSeq,
          };
          writeRaw(`event: reconcile_required\ndata: ${JSON.stringify(reconcilePayload)}\n\n`);
        }
        for (const ev of replay.events) {
          writeRaw(formatSseEvent(ev));
          if (ev.seq > replayedUpTo) replayedUpTo = ev.seq;
        }
      }

      const unsubscribe = subscribeRealtimeEvents((envelope) => {
        if (closed) return;
        if (envelope.seq <= replayedUpTo) return;
        replayedUpTo = envelope.seq;
        writeRaw(formatSseEvent(envelope));
      });

      const heartbeat = setInterval(async () => {
        if (closed) return;
        const currentMode = await readLinkState().catch(() => null);
        if (!currentMode || currentMode.mode !== "linked" || currentMode.disabled) {
          cleanup?.();
          return;
        }
        writeRaw(`: ping ${Date.now()}\n\n`);
      }, 15_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", () => {
        cleanup?.();
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

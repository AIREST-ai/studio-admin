import { NextResponse } from "next/server";

import { readFile } from "node:fs/promises";
import path from "node:path";

// M129-A: Download on a sample attachment hands over a real sample file kept with the preview (media/preview-samples),
// made for this preview to match what the sample message shows. It is not the customer's file: the sample messages
// were never sent by anyone, so no original exists. GET ?name=<attachment name> -> the file as a download.
// F-1 (Fahad 129.2, no request to an outside server): the files the page itself shows (the agent's picture, the images
// and the reel of the shared Instagram posts) are also kept here and are answered inline, with byte ranges so a
// <video> can seek, instead of being loaded from github.com or wikimedia.org.
export const dynamic = "force-dynamic";

const SAMPLE_DIR = path.join(process.cwd(), "media", "preview-samples");

const SAMPLES: Record<string, string> = {
  "readiness-probe-logs.png": "image/png",
  "export-timeout.png": "image/png",
  "transfer-confirmation.jpg": "image/jpeg",
  "bank-statement-oct.pdf": "application/pdf",
  "report-export-june.csv": "text/csv; charset=utf-8",
  "crash-after-splash.mp4": "video/mp4",
  "voicemail-0847.m4a": "audio/mp4",
  // M129-A round 2: the two documents of conversation #24 (cw-data.ts message 2403).
  "resignation-notice.pdf": "application/pdf",
  "hr-confirmation.pdf": "application/pdf",
};

const SHOWN: Record<string, string> = {
  "avatar-arham-khan.png": "image/png",
  "shared-post-example.jpg": "image/jpeg",
  "shared-post-reel.webm": "video/webm",
};

/** "bytes=0-" / "bytes=100-199" / "bytes=-50" of a file of `size` bytes: [start, end], or null when it cannot be met. */
function byteRange(header: string, size: number): [number, number] | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(size - Number(match[2]), 0);
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end && start < size ? [start, end] : null;
}

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const shown = SHOWN[name];
  if (shown) {
    try {
      const bytes = await readFile(path.join(SAMPLE_DIR, name));
      const asked = request.headers.get("range");
      const headers = { "Cache-Control": "no-store", "Content-Type": shown, "Accept-Ranges": "bytes" };
      if (!asked) return new NextResponse(new Uint8Array(bytes), { headers });
      const range = byteRange(asked, bytes.length);
      if (!range)
        return new NextResponse(null, {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
        });
      const [start, end] = range;
      return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.length}` },
      });
    } catch (error) {
      return NextResponse.json({ error: `sample unreadable: ${(error as Error).message}` }, { status: 500 });
    }
  }
  const type = SAMPLES[name];
  if (!type) return NextResponse.json({ error: "no sample file for this attachment" }, { status: 404 });
  try {
    const bytes = await readFile(path.join(SAMPLE_DIR, name));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: `sample unreadable: ${(error as Error).message}` }, { status: 500 });
  }
}

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

// F-6A (sim2 problem 14: the finish step of a new inbox showed a drawn "QR code" that holds nothing): a real QR code of
// the link Chatwoot's FinishSetup.vue puts in it (WhatsApp https://wa.me/<number>, SMS sms:<number>, Messenger
// https://m.me/<page>, Telegram https://t.me/<bot>), drawn by qrencode on the preview machine. Only those link forms
// are accepted, so the route cannot be used to draw anything else. GET ?text=<link> -> image/svg+xml, or 404 when the
// machine has no qrencode (the page then says the QR code is not available).
export const dynamic = "force-dynamic";

const QRENCODE = ["/opt/homebrew/bin/qrencode", "/usr/local/bin/qrencode", "/usr/bin/qrencode"].find((file) =>
  existsSync(file),
);
const ALLOWED =
  /^(https:\/\/wa\.me\/\d{6,15}|sms:\+?\d{6,15}|https:\/\/m\.me\/[\w.-]{1,100}|https:\/\/t\.me\/\w{5,64})$/;

export async function GET(request: Request) {
  const text = new URL(request.url).searchParams.get("text") ?? "";
  if (!ALLOWED.test(text)) return new Response("not a channel link", { status: 400 });
  if (!QRENCODE) return new Response("qrencode is not installed on the preview machine", { status: 404 });
  const svg = await new Promise<string | null>((resolve) => {
    execFile(QRENCODE, ["-t", "SVG", "-m", "2", "-l", "M", "-o", "-", text], { timeout: 5_000 }, (error, stdout) =>
      resolve(error || !stdout.includes("<svg") ? null : stdout),
    );
  });
  if (!svg) return new Response("the QR code could not be drawn", { status: 500 });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
}

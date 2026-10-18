import { fail } from "../../shared";
import { readFile } from "node:fs/promises";
import path from "node:path";

// M129-D: the two fonts pdfme embeds when it fills an uploaded invoice PDF (files/ next to this route):
// - NotoSansArabic-Regular.ttf: Noto Sans Arabic 2.010, SIL OFL 1.1 (NotoSansArabic-OFL.txt), sha256 d6efa4c9...
// - Geist-Regular.ttf: Geist (Vercel), SIL OFL 1.1 (Geist-OFL.txt), copied from node_modules/geist.
const FONTS: Record<string, string> = {
  "NotoSansArabic-Regular.ttf": "NotoSansArabic-Regular.ttf",
  "Geist-Regular.ttf": "Geist-Regular.ttf",
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const file = FONTS[(await params).name];
  if (!file) return fail(404, "unknown font");
  try {
    const data = await readFile(path.join(process.cwd(), "src/app/api/invoice-bigcapital/fonts/files", file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "font/ttf", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return fail(500, "font file missing on the preview server");
  }
}

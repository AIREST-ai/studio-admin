// M129-B (item 129.1): checks one attachment against one channel's rules (sim-catalog.ts MEDIA_RULES, from the
// research table with its sources). Plain functions, no browser APIs, so the tests run them in Node. The browser's
// own part (compressing an image, uploading) is in media-upload.ts.

import { PRODUCT_NAME } from "@/config/app-config";

import type { MediaSpec, MediaType, StoredFile } from "./catalog";
import type { SimChannel } from "./model";
import { CHANNELS, MB, MEDIA_RULES, type Source } from "./sim-catalog";

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** The limit as the platform writes it ("5 MB", "512 KB"). */
export function formatLimit(bytes: number): string {
  if (bytes >= MB && bytes % MB === 0) return `${bytes / MB} MB`;
  if (bytes % 1024 === 0) return `${bytes / 1024} KB`;
  return formatBytes(bytes);
}

export function extOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

export type CheckStatus = "ok" | "compressed" | "warning" | "rejected" | "missing";

export interface ChannelCheck {
  channel: SimChannel;
  status: CheckStatus;
  /** Which copy goes out: the uploaded file, the browser's compressed copy, or nothing. */
  sends: "original" | "compressed" | null;
  /** Size of what goes out (file kinds). */
  size: number | null;
  line: string;
  notes: string[];
  source: Source;
}

/**
 * F-2: the browser cannot read the codec inside an OGG file (Vorbis or OPUS, mono or stereo), so a WhatsApp voice note
 * in OGG is never shown as a plain "Sends". The rule behind the line (OGG, OPUS, mono) is WhatsApp Cloud API: audio
 * messages (sim-catalog.ts S.waAudio), whose link the editor shows under the line.
 */
export const OGG_CODEC_LINE = "Codec not checked in the browser; WhatsApp needs OGG with OPUS, mono.";

const kindWord: Record<MediaType, string> = {
  image: "images",
  video: "video",
  voice: "voice notes",
  document: "documents",
  contact: "contact cards",
  location: "locations",
};

function fits(file: StoredFile, ext: string[] | undefined, max: number | undefined) {
  const formatOk = !ext || ext.includes(extOf(file.name));
  const sizeOk = max === undefined || file.size <= max;
  return { formatOk, sizeOk, ok: formatOk && sizeOk };
}

/** What `channel` would do with `media`: send it as it is, send the compressed copy, warn, or refuse (and why). */
export function checkMedia(media: MediaSpec, channel: SimChannel): ChannelCheck {
  const rule = MEDIA_RULES[channel][media.type];
  const name = CHANNELS[channel].label;
  const notes = rule.note ? [rule.note] : [];
  const base = { channel, notes, source: rule.source };
  if (!rule.accept) return { ...base, status: "rejected", sends: null, size: null, line: `Refused: ${rule.reason}` };
  if (media.type === "contact" || media.type === "location")
    return { ...base, status: "ok", sends: null, size: null, line: `${name} sends ${kindWord[media.type]}.` };
  const file = media.file;
  if (!file) return { ...base, status: "missing", sends: null, size: null, line: "No file uploaded yet." };
  const limit = rule.maxBytes;
  const formats = rule.ext?.map((e) => e.toUpperCase()).join(", ");
  const original = fits(file, rule.ext, limit);
  if (original.ok) {
    const voiceLimit = rule.voiceMaxBytes;
    // F-2: an OGG/OPUS file on WhatsApp: the extension fits, the codec inside cannot be read here
    const codecUnchecked =
      media.type === "voice" && channel === "whatsapp" && ["ogg", "opus"].includes(extOf(file.name));
    if (media.type === "voice" && voiceLimit !== undefined && file.size > voiceLimit) {
      const how =
        channel === "whatsapp"
          ? "it arrives without the voice-note play button"
          : "it arrives as a file, not as a voice note";
      return {
        ...base,
        status: "warning",
        sends: "original",
        size: file.size,
        line: `Sends ${formatBytes(file.size)}, but above ${formatLimit(voiceLimit)} ${how}.${codecUnchecked ? ` ${OGG_CODEC_LINE}` : ""}`,
      };
    }
    if (codecUnchecked) return { ...base, status: "warning", sends: "original", size: file.size, line: OGG_CODEC_LINE };
    if (media.type === "voice" && channel === "whatsapp" && !["ogg", "opus"].includes(extOf(file.name)))
      return {
        ...base,
        status: "warning",
        sends: "original",
        size: file.size,
        line: "Sends as audio: a WhatsApp voice note must be OGG/OPUS.",
      };
    return {
      ...base,
      status: "ok",
      sends: "original",
      size: file.size,
      line: `Sends the file as it is (${formatBytes(file.size)}${limit ? `; ${name} takes up to ${formatLimit(limit)}` : ""}).`,
    };
  }
  // an image the channel refuses as it is: the copy the browser compressed (JPEG) may fit
  if (media.type === "image" && media.compressed) {
    const copy = fits(media.compressed, rule.ext, limit);
    if (copy.ok) {
      const why = original.formatOk ? "" : ` (${extOf(file.name).toUpperCase()} converted to JPEG)`;
      return {
        ...base,
        status: "compressed",
        sends: "compressed",
        size: media.compressed.size,
        line: `Compressed in the browser${why}: ${formatBytes(file.size)} → ${formatBytes(media.compressed.size)}${limit ? `; ${name} takes images up to ${formatLimit(limit)}` : ""}.`,
      };
    }
    if (!copy.sizeOk && limit !== undefined)
      return {
        ...base,
        status: "rejected",
        sends: null,
        size: null,
        line: `Refused: even compressed the image is ${formatBytes(media.compressed.size)}; ${name} takes images up to ${formatLimit(limit)}.`,
      };
  }
  if (!original.formatOk)
    return {
      ...base,
      status: "rejected",
      sends: null,
      size: null,
      line: `Refused: ${name} takes ${kindWord[media.type]} as ${formats} only; this file is ${extOf(file.name).toUpperCase() || "without an extension"}.`,
    };
  const compressNote =
    media.type === "image"
      ? "Upload it again so the browser can compress it."
      : `${PRODUCT_NAME} does not compress ${kindWord[media.type]} in the browser, so it cannot be made to fit.`;
  return {
    ...base,
    status: "rejected",
    sends: null,
    size: null,
    line: `Refused: the file is ${formatBytes(file.size)}; ${name} takes ${kindWord[media.type]} up to ${formatLimit(limit ?? 0)}. ${compressNote}`,
  };
}

/** One line for the canvas card. */
export function mediaSummary(media: MediaSpec | undefined): string {
  if (!media) return "Nothing chosen yet";
  if (media.type === "contact")
    return `Contact card: ${media.contact?.name || "…"} ${media.contact?.phone ?? ""}`.trim();
  if (media.type === "location")
    return `Location: ${media.location?.name || `${media.location?.latitude ?? "…"}, ${media.location?.longitude ?? "…"}`}`;
  if (!media.file) return `${media.type[0].toUpperCase()}${media.type.slice(1)}: no file yet`;
  return `${media.file.name} · ${formatBytes(media.file.size)}${media.compressed ? ` (→ ${formatBytes(media.compressed.size)})` : ""}`;
}

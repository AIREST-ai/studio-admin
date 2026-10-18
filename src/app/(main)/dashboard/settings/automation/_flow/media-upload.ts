"use client";
// M129-B (item 129.1): the browser's part of "Send Attachment": upload a file to this preview (files/route.ts) and, for
// an image that a channel refuses as it is (too large, or not JPG/PNG), make a JPEG copy small enough for every channel
// that takes images (sim-catalog.ts SMALLEST_IMAGE_LIMIT, TikTok's 3 MB). The first try is the existing Chatwoot patch's
// setting (longest side 2048 px, quality 85, bahth-129 section 1); then lower quality, then a smaller size. Video,
// audio and documents are never re-encoded here: a file too large for a channel is refused with the exact limit.
import type { StoredFile } from "./catalog";
import { extOf } from "./media";
import { CHATWOOT_MAX_UPLOAD, SAFE_IMAGE_EXT, SMALLEST_IMAGE_LIMIT } from "./sim-catalog";

export const FILES_ENDPOINT = "/dashboard/settings/automation/files";

export const fileUrl = (id: string) => `${FILES_ENDPOINT}?id=${encodeURIComponent(id)}`;

export async function uploadFile(body: Blob, name: string): Promise<StoredFile> {
  if (body.size > CHATWOOT_MAX_UPLOAD)
    throw new Error(
      "The engine accepts files up to 40 MB (MAXIMUM_FILE_UPLOAD_SIZE), so the preview does not keep larger ones",
    );
  const response = await fetch(FILES_ENDPOINT, {
    method: "POST",
    headers: { "content-type": body.type || "application/octet-stream", "x-file-name": encodeURIComponent(name) },
    body,
  });
  const data = (await response.json().catch(() => null)) as (StoredFile & { error?: string }) | null;
  if (!response.ok || !data?.id) throw new Error(data?.error ?? `${response.status} ${response.statusText}`);
  return { id: data.id, name: data.name, mime: data.mime, size: data.size };
}

// F-3: the files this page deleted (Remove, Replace, another type), kept in memory with their bytes so that Undo, which
// brings the step back with the file's id, can put the file back on the preview's disk under that same id.
const deletedHere = new Map<string, { blob: Blob; name: string }>();

/**
 * F-2: deletes an uploaded file from the preview's disk. Resolves with the names of the saved automations that still
 * keep it (the server then deletes nothing); rejects when the file could not be deleted.
 * F-3: the bytes are read first and kept for this page, so Undo can restore the file (restoreDeletedFiles).
 */
export async function deleteFile(id: string): Promise<{ usedBy: string[] }> {
  const copy = await fetch(fileUrl(id), { cache: "no-store" })
    .then(async (r) => (r.ok ? { blob: await r.blob(), name: fileNameOf(r) } : null))
    .catch(() => null);
  const response = await fetch(fileUrl(id), { method: "DELETE" });
  const data = (await response.json().catch(() => null)) as { error?: string; usedBy?: string[] } | null;
  if (response.status === 409) return { usedBy: data?.usedBy ?? [] };
  if (!response.ok) throw new Error(data?.error ?? `${response.status} ${response.statusText}`);
  if (copy) deletedHere.set(id, copy);
  return { usedBy: [] };
}

function fileNameOf(response: Response): string {
  const match = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get("content-disposition") ?? "");
  try {
    return match ? decodeURIComponent(match[1]) : "file";
  } catch {
    return "file";
  }
}

/** F-3: the file ids a step or a flow refers to (an attachment and its compressed copy keep `id: "af-…"`). */
export function fileIdsIn(value: unknown): string[] {
  return [...new Set(JSON.stringify(value ?? null).match(/af-[a-z0-9]{8,40}/g) ?? [])];
}

/**
 * F-3: Undo brought back steps that point to files this page deleted: put each one back on the preview's disk under
 * its own id (files/route.ts x-restore-id). Resolves with the ids restored; a file deleted elsewhere is not known here.
 */
export async function restoreDeletedFiles(ids: string[]): Promise<string[]> {
  const restored: string[] = [];
  for (const id of ids) {
    const copy = deletedHere.get(id);
    if (!copy) continue;
    const response = await fetch(FILES_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": copy.blob.type || "application/octet-stream",
        "x-file-name": encodeURIComponent(copy.name),
        "x-restore-id": id,
      },
      body: copy.blob,
    }).catch(() => null);
    if (response?.ok) {
      deletedHere.delete(id);
      restored.push(id);
    }
  }
  return restored;
}

/** true when some channel refuses this image as it is, so a compressed JPEG copy is made. */
export function imageNeedsCopy(file: { name: string; size: number }) {
  return file.size > SMALLEST_IMAGE_LIMIT || !SAFE_IMAGE_EXT.includes(extOf(file.name));
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export interface Compressed {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
}

/** The smallest-enough JPEG copy, or the last try when even that is above `target` (the caller says it is refused). */
export async function compressImage(file: Blob, target = SMALLEST_IMAGE_LIMIT): Promise<Compressed> {
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    let best: Compressed | null = null;
    for (let round = 0; round < 8; round++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot draw the image to compress it");
      // JPEG has no transparency: transparent parts become white, as in a chat
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.85, 0.75, 0.65, 0.55]) {
        const blob = await toBlob(canvas, quality);
        if (!blob) continue;
        best = { blob, width, height, quality };
        if (blob.size <= target) return best;
      }
      scale *= 0.75;
    }
    if (!best) throw new Error("This browser could not compress the image");
    return best;
  } finally {
    bitmap.close();
  }
}

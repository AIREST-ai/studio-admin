export function recordingUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed, "https://localhost");
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}

export async function downloadRecording(source: string, callId: string): Promise<void> {
  const url = recordingUrl(source);
  if (!url) throw new Error("رابط التسجيل غير متوفر أو غير صالح");

  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`تعذر تنزيل التسجيل (HTTP ${response.status})`);
  const blob = await response.blob();
  if (!blob.size) throw new Error("ملف التسجيل فارغ");
  if (/text\/html|application\/(?:json|problem\+json)/i.test(blob.type)) {
    throw new Error("الرابط لم يُرجع ملف تسجيل");
  }

  const extension = new URL(url, window.location.href).pathname.match(/\.([a-z0-9]{1,8})$/i)?.[1];
  const audioExtensions: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
  };
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `call-${callId.replace(/[^a-z0-9_-]/gi, "_")}.${audioExtensions[blob.type] ?? extension ?? "audio"}`;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Allow the browser to consume the blob before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

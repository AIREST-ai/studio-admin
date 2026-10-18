"use client";
// M129-B (item 129.1): "Send Attachment" as it works now. Pick what to send (image, video, voice note, document,
// contact card, location); a file is uploaded to this preview and saved (files/route.ts), and checked right away for
// every channel by format and size (media.ts), each line with its source. An image that a channel refuses as it is
// gets a compressed JPEG copy made in the browser (media-upload.ts), shown with its size before and after.
import * as React from "react";

import { cn } from "cn";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  Paperclip,
  ShieldX,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import type { Action, MediaSpec, MediaType, StoredFile } from "./catalog";
import { type ChannelCheck, checkMedia, formatBytes } from "./media";
import { compressImage, deleteFile, fileUrl, imageNeedsCopy, restoreDeletedFiles, uploadFile } from "./media-upload";
import type { SimChannel } from "./model";
import { CHANNELS, mediaAccept, mediaTypeLabels, SIM_CHANNELS } from "./sim-catalog";

const STATUS_LOOK: Record<ChannelCheck["status"], { icon: React.ElementType; tone: string; word: string }> = {
  ok: { icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-400", word: "Sends" },
  compressed: { icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-400", word: "Sends compressed" },
  warning: { icon: TriangleAlert, tone: "text-amber-700 dark:text-amber-400", word: "Sends, with a warning" },
  rejected: { icon: ShieldX, tone: "text-destructive", word: "Refused" },
  missing: { icon: CircleAlert, tone: "text-muted-foreground", word: "No file yet" },
};

/** "a video", "an image": the article follows the sound of the word that comes after it. */
const withArticle = (word: string) => `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;

/** The per-channel check, one row per channel, each with its source. */
export function ChannelChecks({ media, channels = SIM_CHANNELS }: { media: MediaSpec; channels?: SimChannel[] }) {
  return (
    <ul className="grid gap-1.5" aria-label="Channel check" data-testid="channel-checks">
      {channels.map((channel) => {
        const check = checkMedia(media, channel);
        const look = STATUS_LOOK[check.status];
        return (
          <li
            key={channel}
            className="grid gap-0.5 rounded-md border p-2 text-xs leading-relaxed"
            data-channel={channel}
            data-status={check.status}
          >
            <span className={cn("flex items-center gap-1.5 font-medium", look.tone)}>
              <look.icon className="size-3.5 shrink-0" />
              {CHANNELS[channel].label}: {look.word}
            </span>
            <span className="text-foreground/90">{check.line}</span>
            {check.notes.map((note) => (
              <span key={note} className="text-muted-foreground">
                {note}
              </span>
            ))}
            {check.source.url ? (
              <a
                href={check.source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1 text-primary underline-offset-4 hover:underline"
                data-source
              >
                Source: {check.source.label} <ExternalLink className="size-3" />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function MediaPicker({
  action,
  onChange,
  invalid,
}: {
  action: Action;
  onChange: (action: Action) => void;
  invalid: boolean;
}) {
  const media: MediaSpec = action.media ?? { type: "image" };
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  // F-2: what the last "Remove" did on the preview's disk, said as it happened (deleted, kept, or not deleted).
  const [removed, setRemoved] = React.useState("");
  // F-2: false when the preview no longer has the file this step points to (e.g. after Remove and then Undo).
  const [fileThere, setFileThere] = React.useState(true);
  const fileId = media.file?.id;
  const compressedId = media.compressed?.id;
  React.useEffect(() => {
    setFileThere(true);
    if (!fileId) return;
    setRemoved("");
    let current = true;
    // F-3: a file this page deleted (Remove, Replace, another type) and that Undo brought back is put back first
    restoreDeletedFiles([fileId, ...(compressedId ? [compressedId] : [])])
      .then(() => fetch(fileUrl(fileId), { method: "HEAD", cache: "no-store" }))
      .then((response) => {
        if (current && response.status === 404) setFileThere(false);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [fileId, compressedId]);
  const set = (next: MediaSpec) =>
    onChange({
      ...action,
      media: next,
      values: next.file && next.type !== "contact" && next.type !== "location" ? [next.file.id] : [],
    });

  // F-2: deletes files this step no longer uses from the preview's disk (files/route.ts DELETE). The server refuses a
  // file a saved flow still keeps; then it only leaves this step. Says what happened to each file.
  // F-3: also the file a Replace or another "What to send" leaves behind; Undo puts a deleted file back (above).
  const dropFiles = async (files: StoredFile[]) => {
    const outcome: string[] = [];
    for (const file of files) {
      try {
        const { usedBy } = await deleteFile(file.id);
        if (usedBy.length)
          outcome.push(
            `${file.name} stays in the preview: the saved automation “${usedBy.join("”, “")}” still uses it.`,
          );
        else outcome.push(`${file.name} was deleted from the preview.`);
      } catch (reason) {
        outcome.push(`${file.name} was not deleted from the preview: ${(reason as Error).message}`);
      }
    }
    return outcome.join(" ");
  };
  const filesOf = (spec: MediaSpec): StoredFile[] => [
    ...(spec.file ? [spec.file] : []),
    ...(spec.compressed ? [spec.compressed] : []),
  ];

  // F-2: Remove takes the file out of this step and deletes it from the preview's disk, the compressed copy too.
  const remove = async () => {
    if (!media.file) return;
    const files = filesOf(media);
    setError("");
    setRemoved("");
    set({ type: media.type, caption: media.caption });
    setRemoved(`Removed from this step. ${await dropFiles(files)} Undo puts it back.`);
  };

  // F-3: another "What to send" leaves the file behind: it is deleted like Remove does.
  const changeType = async (type: MediaType) => {
    const old = filesOf(media);
    setError("");
    setRemoved("");
    set({ type, caption: media.caption });
    if (old.length) setRemoved(`The previous file left this step. ${await dropFiles(old)} Undo puts it back.`);
  };

  const choose = async (file: File) => {
    setError("");
    setRemoved("");
    try {
      setBusy("Uploading…");
      const stored = await uploadFile(file, file.name);
      let compressed: MediaSpec["compressed"];
      if (media.type === "image" && imageNeedsCopy(file)) {
        setBusy("Compressing in the browser…");
        try {
          const copy = await compressImage(file);
          const base = file.name.replace(/\.[^.]+$/, "");
          setBusy("Uploading the compressed copy…");
          const saved = await uploadFile(copy.blob, `${base}-compressed.jpg`);
          compressed = { ...saved, width: copy.width, height: copy.height, quality: copy.quality };
        } catch (reason) {
          setError(`The image could not be compressed: ${(reason as Error).message}`);
        }
      }
      const old = filesOf(media);
      set({ ...media, file: stored, compressed });
      // F-3: Replace: the file it replaced is deleted like Remove does
      if (old.length) setRemoved(`Replaced. ${await dropFiles(old)} Undo puts it back.`);
    } catch (reason) {
      setError(`Not uploaded: ${(reason as Error).message}`);
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const fileKind = media.type !== "contact" && media.type !== "location";
  return (
    <div className="grid gap-3" data-testid="media-picker" data-media-type={media.type}>
      <div className="grid gap-1.5">
        <Label htmlFor="media-type">What to send</Label>
        <NativeSelect
          id="media-type"
          className="w-full"
          value={media.type}
          onChange={(e) => void changeType(e.target.value as MediaType)}
        >
          {(Object.keys(mediaTypeLabels) as MediaType[]).map((type) => (
            <option key={type} value={type}>
              {mediaTypeLabels[type]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {fileKind ? (
        <div className="grid gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={mediaAccept[media.type]}
            data-testid="media-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void choose(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-invalid={invalid && !media.file}
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
            data-testid="media-upload"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Paperclip />}
            {busy ||
              (media.file
                ? `Replace the ${mediaTypeLabels[media.type].toLowerCase()}`
                : `Upload ${withArticle(mediaTypeLabels[media.type].toLowerCase())}`)}
          </Button>
          {media.file ? (
            <div className="flex items-start justify-between gap-2 rounded-md bg-muted/50 p-2 text-xs">
              <p className="grid min-w-0 gap-0.5" data-testid="media-file">
                <a
                  href={fileUrl(media.file.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-medium text-primary"
                >
                  {media.file.name}
                </a>
                <span className="text-muted-foreground">
                  {fileThere ? "Saved in this preview" : "No longer in this preview: upload it again"} ·{" "}
                  {formatBytes(media.file.size)} · {media.file.mime}
                </span>
                {media.compressed ? (
                  <span className="text-muted-foreground" data-testid="media-compressed">
                    Compressed copy made in the browser: {formatBytes(media.file.size)} →{" "}
                    {formatBytes(media.compressed.size)} ({media.compressed.width}×{media.compressed.height} JPEG,
                    quality {Math.round(media.compressed.quality * 100)})
                  </span>
                ) : null}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="shrink-0 text-destructive"
                aria-label={`Remove ${media.file.name}`}
                disabled={!!busy}
                onClick={() => void remove()}
                data-testid="media-remove"
              >
                <Trash2 /> Remove
              </Button>
            </div>
          ) : null}
          {removed ? (
            <p role="status" className="text-muted-foreground text-xs" data-testid="media-removed">
              {removed}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          ) : null}
          {media.type !== "voice" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="media-caption">Caption (optional)</Label>
              <Textarea
                id="media-caption"
                rows={2}
                value={media.caption ?? ""}
                onChange={(e) => set({ ...media, caption: e.target.value })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {media.type === "contact" ? (
        <div className="grid gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="media-contact-name">Contact's name</Label>
            <Input
              id="media-contact-name"
              aria-invalid={invalid && !media.contact?.name}
              value={media.contact?.name ?? ""}
              onChange={(e) => set({ ...media, contact: { name: e.target.value, phone: media.contact?.phone ?? "" } })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="media-contact-phone">Phone number</Label>
            <Input
              id="media-contact-phone"
              type="tel"
              placeholder="+966…"
              aria-invalid={invalid && !media.contact?.phone}
              value={media.contact?.phone ?? ""}
              onChange={(e) => set({ ...media, contact: { name: media.contact?.name ?? "", phone: e.target.value } })}
            />
          </div>
        </div>
      ) : null}
      {media.type === "location" ? (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            {(["latitude", "longitude"] as const).map((key) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={`media-${key}`}>{key === "latitude" ? "Latitude" : "Longitude"}</Label>
                <Input
                  id={`media-${key}`}
                  inputMode="decimal"
                  aria-invalid={invalid && !media.location?.[key]}
                  value={media.location?.[key] ?? ""}
                  onChange={(e) =>
                    set({
                      ...media,
                      location: {
                        latitude: media.location?.latitude ?? "",
                        longitude: media.location?.longitude ?? "",
                        name: media.location?.name ?? "",
                        address: media.location?.address ?? "",
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
          {(["name", "address"] as const).map((key) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={`media-${key}`}>{key === "name" ? "Place name (optional)" : "Address (optional)"}</Label>
              <Input
                id={`media-${key}`}
                value={media.location?.[key] ?? ""}
                onChange={(e) =>
                  set({
                    ...media,
                    location: {
                      latitude: media.location?.latitude ?? "",
                      longitude: media.location?.longitude ?? "",
                      name: media.location?.name ?? "",
                      address: media.location?.address ?? "",
                      [key]: e.target.value,
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <p className="font-medium text-sm">Channel check</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Each channel's own limits for {mediaTypeLabels[media.type].toLowerCase()}s, from the platforms' documents. The
          dry run applies the same check.
        </p>
        <ChannelChecks media={fileThere ? media : { ...media, file: undefined, compressed: undefined }} />
      </div>
    </div>
  );
}

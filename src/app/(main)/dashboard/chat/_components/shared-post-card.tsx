"use client";

// T-264 (item 77.10): a shared Instagram/Facebook post, as Chatwoot shows it (bubbles/Fallback.vue: the text, then the
// title as a link to the post; bubbles/Image.vue: the image, or "unavailable" when it fails). The media comes straight
// from Meta's own URL: a plain <img>/<video> the browser loads itself. No Next image optimizer, no proxy, no download,
// no local thumbnail, nothing stored in Studio. No image is invented: a Facebook post without a media URL stays text.
// (The preview's sample posts, which were never sent by Meta, point at files kept with the preview, see mediaSrc.)
import { useState } from "react";

import { CircleOff } from "lucide-react";

export type SharedPostChannel = "instagram" | "facebook";

export interface SharedPost {
  // Where it arrived, and Meta's own type (Facebook "post" is not Instagram "ig_post").
  channel: SharedPostChannel;
  sourceType: "ig_post" | "ig_reel" | "share" | "post" | "reel" | "unsupported";
  // What the URL is, from the payload's type, never guessed from a signed URL's extension.
  renderKind: "image" | "video" | "link" | "unknown";
  title?: string;
  text?: string;
  // A post page URL that came from Meta; null when none came.
  postUrl?: string | null;
  // The media URL exactly as Meta sent it (signature kept); null when none came.
  mediaUrl?: string | null;
  // A separate still image Meta sent for a video; never a frame taken from the video.
  posterUrl?: string | null;
}

const CHANNEL_LABEL: Record<SharedPostChannel, string> = { instagram: "Instagram", facebook: "Facebook" };

// Only an https URL is put in src/href, kept exactly as it came.
function httpsUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// F-1 (Fahad 129.2, no request to an outside server): what the browser loads for the media is an https URL, or a path
// on this same server (one starting with a single "/"): the preview's sample posts use its own files, see
// shared-post-samples.ts.
function mediaSrc(url?: string | null): string | null {
  return url && /^\/(?!\/)/.test(url) ? url : httpsUrl(url);
}

function Unavailable({ label }: { label: string }) {
  return (
    <div data-media-state="failed" className="flex items-center gap-1 text-muted-foreground text-sm">
      <CircleOff className="size-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function SharedMedia({ post }: { post: SharedPost }) {
  const [failed, setFailed] = useState(false);
  const src = mediaSrc(post.mediaUrl);
  if (!src || (post.renderKind !== "image" && post.renderKind !== "video")) return null;
  // The browser's error says nothing about why (expired, deleted, blocked), so the wording does not guess.
  if (failed)
    return <Unavailable label={post.renderKind === "video" ? "Couldn't load the video" : "Couldn't load the image"} />;
  const alt = post.title ? post.title : `Shared ${CHANNEL_LABEL[post.channel]} post`;
  if (post.renderKind === "video") {
    return (
      // biome-ignore lint/a11y/useMediaCaption: Meta sends no captions track for a shared post.
      <video
        data-media-state="ready"
        src={src}
        poster={mediaSrc(post.posterUrl) ?? undefined}
        controls
        preload="metadata"
        aria-label={alt}
        onError={() => setFailed(true)}
        className="aspect-video w-full rounded-md bg-muted object-contain"
      />
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: next/image would fetch and resize it on our server; it must come from Meta.
    <img
      data-media-state="ready"
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-56 w-full rounded-md bg-muted object-cover"
    />
  );
}

export function SharedPostCard({ post }: { post: SharedPost }) {
  const link = httpsUrl(post.postUrl);
  const label = post.title ? post.title : link;
  const empty = !post.text && !label && !mediaSrc(post.mediaUrl);
  return (
    <div
      data-bubble-name="shared-post"
      data-channel={post.channel}
      data-source-type={post.sourceType}
      className="grid w-72 gap-2 rounded-lg border bg-background p-3"
    >
      <div className="text-muted-foreground text-xs">Shared {CHANNEL_LABEL[post.channel]} post</div>
      <SharedMedia post={post} />
      {post.text && <p className="whitespace-pre-wrap break-words text-sm">{post.text}</p>}
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-primary text-sm underline"
        >
          {label}
        </a>
      ) : (
        label && <span className="truncate text-muted-foreground text-sm">{label}</span>
      )}
      {empty && <Unavailable label="Shared post data isn't available" />}
    </div>
  );
}

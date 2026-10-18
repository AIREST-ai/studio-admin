"use client";

// Chatwoot message bubbles for media and shared items: Audio.vue, Video.vue, Location.vue and Contact.vue
// (Location and Contact use BaseAttachment.vue: a colored icon tile, "{sender} has shared a …", the title,
// the detail line and one full-width action). Mock media: nothing is loaded, play runs a timer.
import { type ReactNode, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Download, Navigation, Pause, Play, UserRound } from "lucide-react";
import { toast } from "sonner";

import { useContactsStore } from "@/app/(main)/dashboard/contacts/_components/contacts-store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIMULATED } from "@/lib/cw/preview-sim";
import { downloadSample, SimBadge } from "@/lib/cw/preview-sim-ui";

import type { CwAttachment } from "./cw-data";
import { simSaveContact } from "./sim-actions";

// "0:42" -> 42 seconds.
function seconds(duration?: string) {
  const [m, s] = (duration ?? "0:30").split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

function clock(total: number) {
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, "0")}`;
}

// Play/pause with a ticking position, stopped at the end like a real player.
function usePlayer(duration?: string) {
  const length = seconds(duration);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPosition((p) => {
        if (p + 1 >= length) {
          setPlaying(false);
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, length]);
  return { playing, toggle: () => setPlaying((v) => !v), position, length };
}

const WAVE = [3, 6, 4, 8, 5, 9, 4, 7, 3, 6, 8, 4, 5, 7, 3, 5, 6, 4];

export function AudioAttachment({ file }: { file: CwAttachment }) {
  const { playing, toggle, position, length } = usePlayer(file.duration);
  const played = Math.round((position / length) * WAVE.length);
  return (
    <div data-bubble-name="audio" className="flex w-64 items-center gap-2 rounded-lg border bg-background p-2">
      <Button size="icon-sm" variant="secondary" aria-label={playing ? "Pause audio" : "Play audio"} onClick={toggle}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="flex h-6 flex-1 items-center gap-0.5">
        {WAVE.map((h, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: decorative waveform bars
            key={i}
            className={cn("w-1 rounded-full", i < played ? "bg-primary" : "bg-muted-foreground/50")}
            style={{ height: `${h * 2.5}px` }}
          />
        ))}
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {playing || position ? clock(position) : file.duration}
      </span>
    </div>
  );
}

export function VideoAttachment({ file }: { file: CwAttachment }) {
  const { playing, toggle, position, length } = usePlayer(file.duration);
  return (
    <div data-bubble-name="video" className="w-64 overflow-hidden rounded-lg border bg-background">
      <button
        type="button"
        aria-label={playing ? `Pause ${file.name}` : `Play ${file.name}`}
        onClick={toggle}
        className="group/video relative block aspect-video w-full overflow-hidden bg-linear-to-br from-zinc-800 to-zinc-950"
      >
        {/* A phone screen with the app's splash, the moment the recording shows the crash. */}
        <span className="absolute inset-y-3 start-1/2 w-16 -translate-x-1/2 rounded-md border border-zinc-600 bg-zinc-900 p-1.5">
          <span className="mx-auto mt-4 block size-5 rounded-md bg-sky-500/80" />
          <span className="mx-auto mt-2 block h-1 w-8 rounded bg-zinc-700" />
        </span>
        <span
          className={cn(
            "absolute inset-0 grid place-items-center bg-black/20 transition-opacity",
            playing && "opacity-0 group-hover/video:opacity-100",
          )}
        >
          <span className="grid size-10 place-items-center rounded-full bg-white/90 text-zinc-900 shadow">
            {playing ? <Pause className="size-4" /> : <Play className="ms-0.5 size-4" />}
          </span>
        </span>
        <span className="absolute end-1.5 bottom-2 rounded bg-black/60 px-1 text-[10px] text-white tabular-nums">
          {playing || position ? `${clock(position)} / ${file.duration}` : file.duration}
        </span>
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
          <span
            className="block h-full bg-primary transition-[width]"
            style={{ width: `${(position / length) * 100}%` }}
          />
        </span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-t px-2 py-1.5 text-xs">
        <span className="truncate">{file.name}</span>
        <span className="ms-auto shrink-0 text-muted-foreground">{file.size}</span>
        {/* M129-A (Fahad 129.2, replaces T-281's disabled button): downloads the sample video kept with the preview. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Download ${file.name}`}
              onClick={() => downloadSample(file.name)}
            >
              <Download />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download sample file — {SIMULATED}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// Chatwoot BaseAttachment.vue layout.
function SharedItem({
  icon,
  tile,
  heading,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  tile: string;
  heading: string;
  title?: string;
  detail?: string;
  action: ReactNode;
}) {
  return (
    <div className="grid w-64 gap-4 rounded-lg border bg-background p-3">
      <div className="grid gap-3">
        <div className={cn("grid size-8 place-content-center rounded-lg text-white", tile)}>{icon}</div>
        <div className="space-y-1 overflow-hidden">
          <div className="text-sm leading-5">{heading}</div>
          {title && <div className="truncate text-sm">{title}</div>}
          {detail && <div className="truncate text-muted-foreground text-sm">{detail}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function LocationAttachment({ file, sender }: { file: CwAttachment; sender?: string }) {
  return (
    <SharedItem
      icon={<Navigation className="size-4 fill-current" />}
      tile="bg-[#0D9B8A]"
      heading={`${sender ?? "Contact"} has shared a location`}
      detail={file.name}
      // F-16 (Fahad 15 Oct: no links that take the user to another site): "See on map" opened Google Maps; the place
      // is shown here as text and the map view is said to be unavailable, honestly.
      action={<p className="text-muted-foreground text-xs">A map view is not available on this page yet.</p>}
    />
  );
}

export function ContactAttachment({ file, sender }: { file: CwAttachment; sender?: string }) {
  const router = useRouter();
  const open = (id: number) => router.push(`/dashboard/contacts/${id}`);
  // M129-A (Fahad 129.2, replaces T-291's disabled button): Chatwoot's Contact.vue looks the number up and creates the
  // contact when it is new, then opens it. Here it goes into the preview's Contacts (sim-actions.ts simSaveContact) and
  // stays after a reload; the toast offers to open it.
  // F-3: once the number is in Contacts (saved here, before a reload, or already there) the button is "View contact"
  // and opens that contact's page, like the toast's action.
  const digits = (file.phone ?? "").replace(/\D/g, "");
  const inContacts = useContactsStore((s) =>
    digits ? s.list.find((c) => c.phone.replace(/\D/g, "") === digits)?.id : undefined,
  );
  const [savedHere, setSavedHere] = useState<number | undefined>();
  const contactId = inContacts ?? savedHere;
  const save = () => {
    const { id, existed } = simSaveContact(file.name, file.phone ?? "");
    setSavedHere(id);
    const action = { label: "Open contact", onClick: () => open(id) };
    if (existed) toast.info(`${file.name} is already in Contacts`, { description: SIMULATED, action });
    else
      toast.success("Contact added to Contacts", {
        description: `${SIMULATED}: saved in this preview's Contacts, not in the engine.`,
        action,
      });
  };
  return (
    <SharedItem
      icon={<UserRound className="size-4" />}
      tile="bg-[#D6409F]"
      heading={`${sender ?? "Contact"} has shared a contact`}
      title={file.name}
      detail={file.phone}
      action={
        <div className="grid justify-items-center gap-1">
          {contactId === undefined ? (
            <Button variant="outline" size="sm" className="w-full" onClick={save}>
              Save Contact
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => open(contactId)}
              data-contact-saved=""
            >
              View contact
            </Button>
          )}
          <SimBadge />
        </div>
      }
    />
  );
}

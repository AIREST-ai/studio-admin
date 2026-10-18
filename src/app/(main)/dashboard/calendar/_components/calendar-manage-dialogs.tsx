"use client";
// M129-G (Fahad 129.8): "New calendar" and "Share", as in Google Calendar ("Create new calendar", "Share with specific
// people" with four levels) and Outlook ("Add calendar", "Share"). Both are saved in Davis by /api/calendar-davis.
// F-5B: "Delete calendar", for the owner only, as Google Calendar's "Remove calendar > Delete" and Outlook's "Delete
// calendar"; the primary calendar cannot be deleted in either (see PRIMARY_URI in lib/davis/server.ts).
import * as React from "react";

import { Check, Trash2, UserPlus } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PRODUCT_NAME } from "@/config/app-config";

import type { CalendarPerson, CalendarShare, Outcome, ShareLevel } from "./use-davis-calendar";

const NAME_MAX = 64;

export function NewCalendarDialog({
  open,
  colors,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  colors: string[];
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, color: string) => Promise<Outcome<{ id: string }>>;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(colors[0] ?? "#2563EB");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setColor(colors[0] ?? "#2563EB");
    setError(null);
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed.length > NAME_MAX) {
      setError(`Name must be ${NAME_MAX} characters or fewer`);
      return;
    }
    setBusy(true);
    const result = await onCreate(trimmed, color);
    setBusy(false);
    if (result.ok) onOpenChange(false);
    else setError(`Not created: ${result.message}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-4" onSubmit={(e) => void submit(e)} noValidate>
          <DialogHeader>
            <DialogTitle>New calendar</DialogTitle>
            <DialogDescription>
              A calendar of your own on the calendar server. Share it with your team afterwards from “Share”.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="calendar-name">Name</Label>
            <Input
              id="calendar-name"
              dir="auto"
              placeholder="e.g. Sales team"
              maxLength={NAME_MAX + 10}
              value={name}
              aria-invalid={!!error}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {colors.map((value) => (
                <label
                  key={value}
                  className="relative grid size-8 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-background has-focus-visible:ring-2 has-focus-visible:ring-ring"
                  style={{ background: value }}
                >
                  <input
                    type="radio"
                    name="calendar-color"
                    value={value}
                    checked={color === value}
                    onChange={() => setColor(value)}
                    className="sr-only"
                    aria-label={`Colour ${value}`}
                  />
                  {color === value ? <Check aria-hidden className="size-4 text-white" /> : null}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              Create calendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ShareableCalendar {
  id: string;
  label: string;
  ownerId: number | null;
}

export function ShareDialog({
  open,
  calendars,
  initialCalendar,
  people,
  viewerId,
  levels,
  onOpenChange,
  load,
  save,
  remove,
}: {
  open: boolean;
  calendars: ShareableCalendar[];
  initialCalendar: string;
  people: CalendarPerson[];
  viewerId: number;
  levels: { value: ShareLevel; label: string; where: string }[];
  onOpenChange: (open: boolean) => void;
  load: (calendarId: string) => Promise<Outcome<{ shares: CalendarShare[] }>>;
  save: (calendarId: string, personId: number, level: ShareLevel) => Promise<Outcome<{ shares: CalendarShare[] }>>;
  remove: (calendarId: string, personId: number) => Promise<Outcome<{ shares: CalendarShare[] }>>;
}) {
  const [calendarId, setCalendarId] = React.useState(initialCalendar);
  const [shares, setShares] = React.useState<CalendarShare[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [person, setPerson] = React.useState("");
  const [level, setLevel] = React.useState<ShareLevel>("details");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setCalendarId(initialCalendar);
    setPerson("");
    setLevel("details");
    setNotice(null);
  }, [open]);

  React.useEffect(() => {
    if (!open || !calendarId) return;
    let live = true;
    setShares(null);
    setError(null);
    void load(calendarId).then((result) => {
      if (!live) return;
      if (result.ok) setShares(result.value.shares);
      else setError(result.message);
    });
    return () => {
      live = false;
    };
  }, [open, calendarId, load]);

  const calendar = calendars.find((c) => c.id === calendarId);
  const nameOf = (id: number) => people.find((p) => p.id === id)?.name ?? `Employee ${id}`;
  const shared = new Set((shares ?? []).map((s) => s.personId));
  const candidates = people.filter((p) => p.id !== viewerId && p.id !== calendar?.ownerId && !shared.has(p.id));

  const run = async (work: () => Promise<Outcome<{ shares: CalendarShare[] }>>, done: string) => {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (result.ok) {
      setShares(result.value.shares);
      setNotice(done);
    } else setError(`Not saved: ${result.message}`);
    return result.ok;
  };

  const davisText = (share: CalendarShare) =>
    share.davis === "none"
      ? `No share on the calendar server (${PRODUCT_NAME} shows busy times only)`
      : `Calendar server: ${share.davis}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share calendar</DialogTitle>
          <DialogDescription>
            Choose who sees this calendar and what they can do, with the four levels of Google Calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="share-calendar">Calendar</Label>
          <NativeSelect
            id="share-calendar"
            className="w-full"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <section aria-label="Shared with" className="grid gap-2">
          <h3 className="font-medium text-sm">Shared with</h3>
          {shares === null && !error ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
          {shares && !shares.length ? (
            <p className="text-muted-foreground text-sm">Nobody yet. Only the owner sees this calendar.</p>
          ) : null}
          <ul className="grid gap-2">
            {(shares ?? []).map((share) => (
              <li
                key={share.personId}
                data-share-person={share.personId}
                className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[1fr_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{nameOf(share.personId)}</div>
                  <div className="text-muted-foreground text-xs">{davisText(share)}</div>
                </div>
                <NativeSelect
                  aria-label={`Permission for ${nameOf(share.personId)}`}
                  value={share.level}
                  disabled={busy}
                  onChange={(e) =>
                    void run(
                      () => save(calendarId, share.personId, e.target.value as ShareLevel),
                      `${nameOf(share.personId)} can now: ${levels.find((l) => l.value === e.target.value)?.label}.`,
                    )
                  }
                >
                  {levels.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={busy}
                  aria-label={`Stop sharing with ${nameOf(share.personId)}`}
                  onClick={() =>
                    void run(
                      () => remove(calendarId, share.personId),
                      `${nameOf(share.personId)} no longer sees this calendar.`,
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <form
          className="grid gap-2 rounded-md border border-dashed p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const id = Number(person);
            if (!id) {
              setError("Choose an employee to share with");
              return;
            }
            void run(
              () => save(calendarId, id, level),
              `Shared with ${nameOf(id)}: ${levels.find((l) => l.value === level)?.label}.`,
            ).then((ok) => ok && setPerson(""));
          }}
        >
          <h3 className="font-medium text-sm">Add people</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <NativeSelect
              aria-label="Employee"
              className="w-full"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="">Choose an employee</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Permission"
              className="w-full"
              value={level}
              onChange={(e) => setLevel(e.target.value as ShareLevel)}
            >
              {levels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" disabled={busy || !calendarId}>
              <UserPlus />
              Share
            </Button>
          </div>
        </form>

        <dl className="grid gap-1 text-muted-foreground text-xs">
          {levels.map((l) => (
            <div key={l.value}>
              <dt className="inline font-medium text-foreground">{l.label}: </dt>
              <dd className="inline">{l.where}</dd>
            </div>
          ))}
        </dl>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {notice && !error ? (
          <p role="status" className="text-emerald-700 text-sm dark:text-emerald-400">
            {notice}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface DeletableCalendar {
  id: string;
  label: string;
  primary: boolean;
}

/**
 * F-5B: deletes one of the viewer's own calendars, with all its events, in Davis. Only calendars the viewer owns are
 * listed (the server refuses the rest too); the primary calendar is listed but cannot be chosen.
 */
export function DeleteCalendarDialog({
  open,
  calendars,
  initialCalendar,
  onOpenChange,
  onDelete,
}: {
  open: boolean;
  calendars: DeletableCalendar[];
  initialCalendar: string;
  onOpenChange: (open: boolean) => void;
  onDelete: (calendarId: string) => Promise<Outcome<unknown>>;
}) {
  const [calendarId, setCalendarId] = React.useState(initialCalendar);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setCalendarId(initialCalendar);
    setError(null);
  }, [open]);

  const calendar = calendars.find((c) => c.id === calendarId);

  const submit = async () => {
    if (!calendar || calendar.primary) return;
    setBusy(true);
    setError(null);
    const result = await onDelete(calendar.id);
    setBusy(false);
    // a refusal or failure keeps the dialog open with Davis's own answer
    if (result.ok) onOpenChange(false);
    else setError(`Not deleted: ${result.message}`);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent data-testid="delete-calendar-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete calendar</AlertDialogTitle>
          <AlertDialogDescription>
            {calendar && !calendar.primary ? (
              <>
                “<bdi>{calendar.label}</bdi>” and all its events will be deleted from the calendar server, for you and
                for everyone it is shared with. This cannot be undone.
              </>
            ) : (
              "Choose one of your calendars. Its events are deleted with it."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="delete-calendar">Calendar</Label>
          <NativeSelect
            id="delete-calendar"
            className="w-full"
            value={calendarId}
            disabled={busy}
            onChange={(e) => {
              setCalendarId(e.target.value);
              setError(null);
            }}
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id} disabled={c.primary}>
                {c.primary ? `${c.label} (primary, can't be deleted)` : c.label}
              </option>
            ))}
          </NativeSelect>
          <p className="text-muted-foreground text-xs">
            Only calendars you own are listed. Your primary calendar can't be deleted, as in Google Calendar and
            Outlook.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={busy || !calendar || calendar.primary} onClick={() => void submit()}>
            <Trash2 />
            {busy ? "Deleting…" : "Delete calendar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

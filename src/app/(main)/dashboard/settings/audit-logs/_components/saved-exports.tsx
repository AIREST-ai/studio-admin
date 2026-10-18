"use client";
// F-22 (Fahad 15 Oct: "I mean the whole system … I want my own system"): saved exports of the Audit Logs page, as the
// audit log system offers them in its own viewer (a named, saved search exported again later). The page's current
// filters are saved under a name on the audit log server (POST /api/audit-log/exports), the list comes back from it
// after a reload (GET /api/audit-log/exports), and "Export CSV" on a saved one runs its filters again on the log as it
// is then (GET /api/audit-log/exports/<id>). The server has no way to delete a saved export, and the panel says so.
import * as React from "react";

import { Bookmark, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SavedExport {
  id: string;
  name: string;
  savedAt: string | null;
  filters: Record<string, string>;
}

const CRUD_TEXT: Record<string, string> = { c: "Created", r: "Read", u: "Changed", d: "Deleted" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The saved filters in words, e.g. "Invoices · Deleted · From Oct 8". */
export function filtersText(
  filters: Record<string, string>,
  sections: { key: string; label: string }[],
  actors: { id: string; name: string }[],
  actionLabel: (action: string) => string,
): string {
  const parts: string[] = [sections.find((s) => s.key === filters.section)?.label ?? "All activity"];
  if (filters.action) parts.push(actionLabel(filters.action));
  if (filters.crud)
    parts.push(
      filters.crud
        .split(",")
        .map((letter) => CRUD_TEXT[letter] ?? letter)
        .join(" or "),
    );
  if (filters.failed === "1") parts.push("Failed only");
  if (filters.actor) parts.push(actors.find((a) => a.id === filters.actor)?.name ?? filters.actor);
  if (filters.from && filters.to) {
    const last = new Date(Date.parse(filters.to) - 1);
    parts.push(`${day(filters.from)} – ${day(last.toISOString())}`);
  } else if (filters.from) parts.push(`From ${day(filters.from)}`);
  if (filters.q) parts.push(`“${filters.q}”`);
  if (filters.sort === "oldest") parts.push("Oldest first");
  return parts.join(" · ");
}

export function SavedExports({
  filters,
  sections,
  actors,
  actionLabel,
}: {
  /** The page's filters now (the same ones the list and "Export CSV" use). */
  filters: Record<string, string>;
  sections: { key: string; label: string }[];
  actors: { id: string; name: string }[];
  actionLabel: (action: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<SavedExport[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/audit-log/exports", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { exports?: SavedExport[]; error?: string } | null;
      if (!response.ok || !body?.exports)
        throw new Error(body?.error ?? `the preview server answered ${response.status}`);
      setItems(body.exports);
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/audit-log/exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, filters }),
      });
      const body = (await response.json().catch(() => null)) as { export?: SavedExport; error?: string } | null;
      if (response.status !== 201 || !body?.export)
        throw new Error(body?.error ?? `the preview server answered ${response.status}`);
      toast.success(`Saved “${body.export.name}”`, { description: "Export it again from this list at any time." });
      setName("");
      await load();
    } catch (reason) {
      toast.error("Not saved", { description: (reason as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const now = filtersText(filters, sections, actors, actionLabel);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="audit-saved-exports">
          <Bookmark /> Saved exports
          {items?.length ? (
            <Badge variant="secondary" className="px-1.5 tabular-nums">
              {items.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
        data-testid="audit-saved-exports-panel"
      >
        <div className="flex flex-col gap-1">
          <span className="font-medium text-sm">Saved exports</span>
          <span className="text-muted-foreground text-xs leading-snug">
            Save the filters shown now under a name, then export them again with one click. Each export runs the saved
            filters on the log as it is at that moment.
          </span>
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name, e.g. Deleted invoices"
              maxLength={80}
              aria-label="Name of the saved export"
              className="h-8 min-w-0 flex-1"
              data-testid="audit-saved-export-name"
            />
            <Button type="submit" size="sm" disabled={!name.trim() || saving} data-testid="audit-saved-export-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          <span className="break-words text-muted-foreground text-xs" data-testid="audit-saved-export-now">
            Filters now: {now}
          </span>
        </form>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="font-medium text-muted-foreground text-xs">
            {items ? `${items.length} saved` : "Saved on the audit log server"}
          </span>
          <Button variant="ghost" size="icon-xs" aria-label="Refresh saved exports" onClick={() => void load()}>
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-xs">
            The saved exports could not be read: {error}
          </p>
        ) : null}
        <ul className="-mx-1 flex max-h-72 flex-col overflow-y-auto" data-testid="audit-saved-export-list">
          {items?.length ? (
            items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-md px-1 py-2 hover:bg-muted/40"
                data-testid="audit-saved-export-item"
                data-name={item.name}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="break-words font-medium text-sm">{item.name}</span>
                  <span className="break-words text-muted-foreground text-xs">
                    {filtersText(item.filters, sections, actors, actionLabel)}
                  </span>
                  {item.savedAt ? (
                    <span className="text-muted-foreground text-xs">
                      Saved{" "}
                      {new Date(item.savedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/api/audit-log/exports/${encodeURIComponent(item.id)}`}
                    download
                    data-testid="audit-saved-export-download"
                  >
                    <Download /> Export CSV
                  </a>
                </Button>
              </li>
            ))
          ) : (
            <li className="px-1 py-2 text-muted-foreground text-xs">
              {items ? "No saved exports yet." : loading ? "Reading the saved exports…" : ""}
            </li>
          )}
        </ul>
        <p className="border-t pt-3 text-muted-foreground text-xs leading-snug">
          Saved exports are kept on the audit log server. It has no way to delete a saved export, so there is no Delete
          here.
        </p>
      </PopoverContent>
    </Popover>
  );
}

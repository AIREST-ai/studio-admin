"use client";
// F-18b (Fahad, 15 Oct 15:20: "المهام يجب أن تنقل كلها لدي"): the parts of a task's own page in the tasks server that
// the task window did not show: History (who changed what, and when), Related (the person or company the task is about)
// and Files. The tasks server's task page has Home, Note, Timeline and Files tabs:
// https://github.com/twentyhq/twenty/blob/twenty/v2.46.0/packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/constants/standard-page-layout-tabs.template.ts
// Read only, from /api/tasks-twenty/<id>/activity (the Next.js server reads the tasks server, src/lib/twenty/extras.ts).
import * as React from "react";

import { cn } from "cn";
import { Building2, FileText, History, Link2, UserRound } from "lucide-react";

import type { TaskActivity } from "@/lib/twenty/extras";

const timeFmt = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const ACTION_TEXT: Record<string, string> = {
  created: "Created",
  updated: "Changed",
  deleted: "Deleted",
  restored: "Restored",
  linked: "Linked",
  unlinked: "Unlinked",
};

type Tab = "history" | "related" | "files";

export function TaskActivityPanel({ taskId, version }: { taskId: string; version?: string }) {
  const [data, setData] = React.useState<TaskActivity | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("history");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` (the task's updatedAt) reloads after a save.
  React.useEffect(() => {
    let live = true;
    setError(null);
    fetch(`/api/tasks-twenty/${encodeURIComponent(taskId)}/activity`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!live) return;
        if (response.ok) setData(json as TaskActivity);
        else setError(json.error ?? `HTTP ${response.status}`);
      })
      .catch((reason: Error) => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [taskId, version]);

  const tabs: { key: Tab; label: string; count: number | null; icon: React.ReactNode }[] = [
    { key: "history", label: "History", count: data?.history.length ?? null, icon: <History className="size-3.5" /> },
    { key: "related", label: "Related", count: data?.relations.length ?? null, icon: <Link2 className="size-3.5" /> },
    { key: "files", label: "Files", count: data?.files.length ?? null, icon: <FileText className="size-3.5" /> },
  ];

  return (
    <div data-task-activity className="rounded-lg border">
      <div role="tablist" aria-label="Task details" className="flex items-center gap-1 border-b px-2 py-1.5">
        {tabs.map((each) => (
          <button
            key={each.key}
            type="button"
            role="tab"
            aria-selected={tab === each.key}
            data-activity-tab={each.key}
            onClick={() => setTab(each.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === each.key ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {each.icon}
            {each.label}
            {each.count !== null ? <span className="text-muted-foreground tabular-nums">{each.count}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="max-h-56 overflow-y-auto px-3 py-2 text-sm">
        {error ? (
          <p role="alert" className="text-destructive">{`Could not be loaded: ${error}`}</p>
        ) : !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : tab === "history" ? (
          data.history.length ? (
            <ol className="space-y-2" data-activity-list="history">
              {data.history.map((entry) => (
                <li key={entry.id} className="space-y-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{ACTION_TEXT[entry.action] ?? entry.action}</span>
                    {entry.linked ? <span className="[unicode-bidi:plaintext]">{entry.linked}</span> : null}
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {timeFmt.format(new Date(entry.happensAt))}
                      {entry.by ? ` · ${entry.by}` : ""}
                    </span>
                  </div>
                  {entry.changes.length ? (
                    <ul className="text-muted-foreground text-xs">
                      {entry.changes.map((change) => (
                        <li key={change} className="[unicode-bidi:plaintext]">
                          {change}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">No history yet.</p>
          )
        ) : tab === "related" ? (
          data.relations.length ? (
            <ul className="space-y-1.5" data-activity-list="related">
              {data.relations.map((relation) => (
                <li key={`${relation.kind}:${relation.name}`} className="flex items-start gap-2">
                  {relation.kind === "company" ? (
                    <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium [unicode-bidi:plaintext]">{relation.name}</span>
                    {relation.detail ? (
                      <span className="block truncate text-muted-foreground text-xs">{relation.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Not linked to a contact. A task made from a chat message links its contact here.
            </p>
          )
        ) : data.files.length ? (
          <ul className="space-y-1" data-activity-list="files">
            {data.files.map((file) => (
              <li key={file.id} className="flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{file.name}</span>
                {file.type ? <span className="text-muted-foreground text-xs uppercase">{file.type}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No files attached to this task.</p>
        )}
      </div>
    </div>
  );
}

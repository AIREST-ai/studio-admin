"use client";
// T-244 round 2 (Fahad item 96): the table view of the same tasks the cards show; the title opens the same editor.
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { priorities, statuses } from "../_components/data";
import { type BoardTask, personName, TASK_LABELS, TASK_STATUSES } from "./model";
import { formatDueDate } from "./task-card";

const statusRank = new Map<string, number>(TASK_STATUSES.map((status, index) => [status.id, index]));

export function TaskTableView({ tasks, onOpen }: { tasks: BoardTask[]; onOpen: (id: string) => void }) {
  const rows = [...tasks].sort(
    (a, b) => (statusRank.get(a.status) ?? 0) - (statusRank.get(b.status) ?? 0) || a.order - b.order,
  );

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-4 lg:px-6">
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Task</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Followers</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((task) => {
              const status = statuses.find((s) => s.value === task.status);
              const priority = priorities.find((p) => p.value === task.priority);
              const label = TASK_LABELS.find((l) => l.id === task.label)?.label;
              return (
                <TableRow key={task.id} data-row-id={task.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{task.id}</TableCell>
                  <TableCell className="max-w-[28rem]">
                    <div className="flex min-w-0 items-center gap-2">
                      {label ? (
                        <Badge variant="outline" className="shrink-0 rounded-md px-1.5">
                          {label}
                        </Badge>
                      ) : null}
                      <button
                        type="button"
                        data-task-open={task.id}
                        className="min-w-0 truncate rounded-sm text-start font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={() => onOpen(task.id)}
                      >
                        <span dir="auto">{task.title}</span>
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {status ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <status.icon className="size-3.5 text-muted-foreground" />
                        {status.label}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {priority ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <priority.icon className="size-3.5 text-muted-foreground" />
                        {priority.label}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{personName(task.ownerId) ?? "No owner"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {task.followerIds.map((id) => personName(id)).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {task.dueDate ? formatDueDate(task.dueDate) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";
// M129-F (Fahad 129.6: "هل يمكن تحويل الرساله إلى مهمة؟"): "Create task" in a message's menu. It creates a task in
// Twenty (the system behind /dashboard/tasks) holding the message text, the conversation link and the contact, and
// links the contact as a Twenty Person. Standard pattern: Zendesk -> Jira "Create issue", Front -> Asana "Create task"
// (sources in monitor/notes/بحث-الأنظمة-الجاهزة-129.md, section 3). The browser only calls this preview's own route.
// F-8 (sim3 8.12b and 11.1c): the task's Channel and Order number fields take the conversation's channel and order
// number (shown before creating, and what Twenty got is shown after), and the Assignee list has the site's agents
// (Settings > Agents) first, then the Twenty users who are not one of them. A site agent who is not a Twenty user is
// kept in the task's "Studio agent" field, and the window says so (lib/twenty/agents.ts).
import * as React from "react";

import Link from "next/link";

import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCwShared } from "@/lib/cw/store";
import { assigneeChoices, assigneeFields } from "@/lib/twenty/agents";
import type { BoardMember, MessageTaskFields } from "@/lib/twenty/server";

import { AssigneeSelect } from "../../tasks/_twenty/twenty-task-dialog";

interface TaskSource {
  conversationId: number;
  channel: string;
  /** F-8: the inbox's channel type ("Email", "WhatsApp", "Website", ...) and name. */
  channelType: string;
  inboxName: string;
  /** F-8: the conversation's "Order number" attribute, else its "Order ID" ("" when it has neither). */
  orderNumber: string;
  contact: { name: string; email: string; phone: string; company: string };
  message: { id: string; text: string; sender: string; time: string };
}

let current: TaskSource | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

/** Opens the Create task dialog for one message. */
export function openCreateTask(source: TaskSource) {
  current = source;
  emit();
}

function useSource() {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

export function CreateTaskDialog() {
  const source = useSource();
  const [title, setTitle] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [members, setMembers] = React.useState<BoardMember[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ id: string; title: string; fields: MessageTaskFields | null } | null>(
    null,
  );
  const agents = useCwShared((state) => state.agents);
  const owner = assigneeFields(assignee, agents, members ?? []);

  React.useEffect(() => {
    if (!source) return;
    setTitle(source.message.text.split("\n")[0].slice(0, 120));
    setAssignee("");
    setError(null);
    setCreated(null);
    let live = true;
    fetch("/api/tasks-twenty", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        if (live) setMembers(body.members as BoardMember[]);
      })
      .catch((e: Error) => live && setError(`The tasks server is not answering: ${e.message}`));
    return () => {
      live = false;
    };
  }, [source]);

  const close = () => {
    current = null;
    emit();
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks-twenty/from-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assigneeId: owner.assigneeId,
          agentName: owner.agentName,
          message: source.message,
          conversation: {
            id: source.conversationId,
            channel: source.channel,
            channelType: source.channelType,
            orderNumber: source.orderNumber,
          },
          contact: source.contact,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setCreated({ id: body.task.id, title: body.task.title, fields: (body.fields as MessageTaskFields) ?? null });
      toast.success("Task created");
    } catch (e) {
      setError(`Not created: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const conversationUrl =
    source && typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/chat/conversations/${source.conversationId}`
      : "";

  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            A task on the Tasks page with this message, a link to the conversation and the contact.
          </DialogDescription>
        </DialogHeader>
        {source && created ? (
          <div role="status" className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-emerald-600" /> {`"${created.title}" is in Tasks (To do).`}
            </p>
            {created.fields ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" data-task-fields="">
                <dt className="text-muted-foreground">Channel</dt>
                <dd>{created.fields.channel ?? "Not set"}</dd>
                <dt className="text-muted-foreground">Order number</dt>
                <dd>{created.fields.orderNumber ?? "Not set"}</dd>
                <dt className="text-muted-foreground">Assignee</dt>
                <dd>
                  {created.fields.agent ?? (members?.find((m) => m.id === owner.assigneeId)?.name || "Unassigned")}
                </dd>
              </dl>
            ) : null}
            {[...(created.fields?.notes ?? []), ...(owner.note ? [owner.note] : [])].map((note) => (
              <p key={note} className="text-muted-foreground text-xs">
                {note}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href="/dashboard/tasks" onClick={close}>
                  View in Tasks
                </Link>
              </Button>
            </div>
          </div>
        ) : source ? (
          <form id="create-task-form" onSubmit={submit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="create-task-title">Title</FieldLabel>
              <Input
                id="create-task-title"
                dir="auto"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="create-task-assignee">Assignee</FieldLabel>
              <AssigneeSelect
                id="create-task-assignee"
                value={assignee}
                disabled={!members}
                choices={assigneeChoices(agents, members ?? [])}
                onChange={setAssignee}
                className="w-full"
              />
              {owner.note ? <p className="text-muted-foreground text-xs">{owner.note}</p> : null}
            </Field>
            <section
              className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm"
              aria-label="Saved with the task"
            >
              <p className="text-muted-foreground text-xs">Saved with the task</p>
              <blockquote dir="auto" className="line-clamp-4 border-s-2 ps-3">
                {source.message.text}
              </blockquote>
              <p className="text-muted-foreground text-xs">{`From ${source.message.sender} · ${source.message.time}`}</p>
              <p className="truncate text-xs">
                <span className="text-muted-foreground">Conversation: </span>
                {conversationUrl}
              </p>
              <p className="truncate text-xs" data-task-channel="">
                <span className="text-muted-foreground">Channel: </span>
                {`${source.channelType || source.channel} (${source.inboxName})`}
              </p>
              <p className="truncate text-xs" data-task-order="">
                <span className="text-muted-foreground">Order number: </span>
                {source.orderNumber || "None in this conversation"}
              </p>
              <p className="truncate text-xs">
                <span className="text-muted-foreground">Contact: </span>
                {[source.contact.name, source.contact.email, source.contact.phone].filter(Boolean).join(" · ")}
              </p>
            </section>
            {error ? <FieldError>{error}</FieldError> : null}
          </form>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              {created ? "Close" : "Cancel"}
            </Button>
          </DialogClose>
          {!created ? (
            <Button type="submit" form="create-task-form" disabled={busy || !title.trim()}>
              Create task
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

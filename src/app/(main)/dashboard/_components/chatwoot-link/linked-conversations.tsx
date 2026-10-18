"use client";

// L-2 (plan r1-chatwoot-link/خطة.md 4, phase 1): the conversations page when "Conversations" is linked to the
// Chatwoot test copy. The list and each thread come from /api/chatwoot/* (useLinkedConversations, useLinkedMessages).
// L-3 (phase 2): reply / private note, status (Open, Resolved, Pending, Snoozed), agent and team, and labels write to
// the test copy through /api/chatwoot/conversations/<id>(/messages) (postLinked). A control shows the new value only
// from the server's answer (the conversation read again from Chatwoot), and a failure shows its words. Nothing here
// reads the preview stores or the simulation records, and nothing is written to .preview-state.
// Same frame as conversations-workspace.tsx: one card, the list (21rem) and the thread side by side from 1024 px.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { Link2, Lock, MessagesSquare, RefreshCw, Send, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  LINK_BADGE_TEXT,
  type LinkedConversation,
  type LinkedConversationAction,
  type LinkedConversationBody,
  type LinkedConversationsBody,
  type LinkedMessage,
  type LinkedMessageBody,
  type LinkedReplyRequest,
  WRITE_PHASE_TEXT,
} from "@/lib/chatwoot-link-types";

import { type Linked, postLinked, useLinkedMessages, useLinkedOptions } from "./use-linked";

const STATUS_LABEL: Record<LinkedConversation["status"], string> = {
  open: "Open",
  resolved: "Resolved",
  pending: "Pending",
  snoozed: "Snoozed",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

function when(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The words of a failure, e.g. "not linked: no token", with a way back to the switch. */
export function LinkProblemPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" data-chatwoot-problem>
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <Link2 className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">{message}</p>
      <p className="max-w-md text-muted-foreground text-xs">
        This section is linked to the live engine, so it shows no preview data. Turn the link off in Settings →
        Integrations to see the preview again.
      </p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/settings/integrations">Open the link settings</Link>
        </Button>
      </div>
    </div>
  );
}

export function LinkedLoading({ what }: { what: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-muted-foreground text-sm">
      Reading {what} from the live engine…
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onOpen,
}: {
  conversation: LinkedConversation;
  active: boolean;
  onOpen: () => void;
}) {
  const last = conversation.lastMessage;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-linked-conversation={conversation.key}
      className={cn(
        "flex w-full gap-3 border-b px-4 py-3 text-start hover:bg-muted/50",
        active && "bg-muted/60 hover:bg-muted/60",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-medium text-xs">
        {initials(conversation.contact.name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <span className="truncate">{conversation.inbox.name}</span>
          {conversation.assignee && <span className="truncate">· {conversation.assignee.name}</span>}
          <span className="ms-auto shrink-0">#{conversation.id}</span>
        </span>
        <span className="truncate font-medium text-sm">{conversation.contact.name}</span>
        {last && (
          <span className="truncate text-muted-foreground text-xs">
            {last.kind === "note" ? "Private note: " : ""}
            {last.text}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-1 pt-0.5">
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {STATUS_LABEL[conversation.status]}
          </Badge>
          {conversation.labels.map((label) => (
            <Badge key={label} variant="secondary" className="h-4 px-1.5 text-[10px]">
              {label}
            </Badge>
          ))}
          {conversation.unreadCount > 0 && (
            <span className="ms-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {conversation.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function MessageLine({ message }: { message: LinkedMessage }) {
  if (message.kind === "activity")
    return (
      <div className="flex justify-center">
        <span className="rounded-md border px-2 py-1 text-muted-foreground text-xs">
          {message.text} {message.at && <span className="opacity-70">· {when(message.at)}</span>}
        </span>
      </div>
    );
  const outgoing = message.kind !== "incoming";
  return (
    <div className={cn("flex", outgoing ? "justify-end" : "justify-start")} data-linked-message={message.key}>
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1 rounded-xl border px-3 py-2 text-sm",
          message.kind === "note" && "border-amber-500/40 bg-amber-500/10",
          message.kind === "outgoing" && "bg-muted",
          message.kind === "template" && "bg-muted",
        )}
      >
        {message.kind === "note" && (
          <span className="flex items-center gap-1 font-medium text-amber-700 text-xs dark:text-amber-400">
            <Lock className="size-3" /> Private Note{message.sender ? ` · ${message.sender.name}` : ""}
          </span>
        )}
        <span className="whitespace-pre-wrap break-words">{message.text}</span>
        {message.attachments.map((file) => (
          <span key={`${file.type}:${file.name}`} className="text-muted-foreground text-xs">
            Attachment ({file.type}): {file.name}
          </span>
        ))}
        <span className="text-muted-foreground text-[11px]">
          {message.kind !== "note" && message.sender ? `${message.sender.name} · ` : ""}
          {when(message.at)}
        </span>
      </div>
    </div>
  );
}

/** Reply or private note, sent to the live engine; the thread is read again after Chatwoot answers. */
function ReplyBox({ conversationId, onSent }: { conversationId: number; onSent: () => void }) {
  const [text, setText] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const send = async () => {
    const content = text.trim();
    if (!content || sending) return; // one send at a time: a double click does not post twice
    setSending(true);
    setError(null);
    try {
      const request: LinkedReplyRequest = { content, private: isPrivate };
      await postLinked<LinkedMessageBody>(`/api/chatwoot/conversations/${conversationId}/messages`, request);
      setText("");
      onSent();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSending(false);
    }
  };
  const label = isPrivate ? "Private note to the live engine" : "Reply to the live engine";
  let sendText = isPrivate ? "Add note" : "Send";
  if (sending) sendText = "Sending…";
  return (
    <div className="border-t p-3" data-linked-reply>
      <div
        className={cn("flex flex-col gap-2 rounded-lg border p-2", isPrivate && "border-amber-500/40 bg-amber-500/5")}
      >
        <div className="flex gap-1">
          <Button
            variant={isPrivate ? "ghost" : "secondary"}
            size="sm"
            aria-pressed={!isPrivate}
            onClick={() => setIsPrivate(false)}
          >
            Reply
          </Button>
          <Button
            variant={isPrivate ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={isPrivate}
            onClick={() => setIsPrivate(true)}
          >
            Private Note
          </Button>
        </div>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send();
          }}
          placeholder={isPrivate ? "Write a private note (only agents see it)" : "Write a reply"}
          className="min-h-16 resize-none"
          aria-label={label}
          disabled={sending}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 text-xs" role={error ? "alert" : undefined}>
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Link2 className="size-3" /> {WRITE_PHASE_TEXT}
              </span>
            )}
          </span>
          <Button size="sm" onClick={() => void send()} disabled={sending || !text.trim()} data-linked-send>
            <Send /> {sendText}
          </Button>
        </div>
      </div>
    </div>
  );
}

const NONE = "none";

/**
 * Status, agent, team and labels of one linked conversation. Each change posts one action; the controls show the
 * conversation the server read back from Chatwoot after it (onChanged), never the value that was only asked for.
 */
function ConversationActions({
  conversation,
  onChanged,
}: {
  conversation: LinkedConversation;
  onChanged: (next: LinkedConversation) => void;
}) {
  const options = useLinkedOptions();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (action: LinkedConversationAction) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await postLinked<LinkedConversationBody>(`/api/chatwoot/conversations/${conversation.id}`, action);
      onChanged(answer.conversation);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const agents = [...(options.data?.agents ?? [])];
  const teams = [...(options.data?.teams ?? [])];
  // the current agent/team stay choosable even before the lists load
  if (conversation.assignee && !agents.some((agent) => agent.id === conversation.assignee?.id))
    agents.unshift(conversation.assignee);
  if (conversation.team && !teams.some((team) => team.id === conversation.team?.id)) teams.unshift(conversation.team);
  const addable = (options.data?.labels ?? []).filter((label) => !conversation.labels.includes(label));
  const idOf = (value: string) => (value === NONE ? null : Number(value));
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-2" data-linked-actions aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          size="sm"
          aria-label="Status"
          value={conversation.status}
          disabled={busy}
          onChange={(event) =>
            void run({ action: "status", status: event.target.value as LinkedConversation["status"] })
          }
          data-linked-status
        >
          {(Object.keys(STATUS_LABEL) as LinkedConversation["status"][]).map((status) => (
            <NativeSelectOption key={status} value={status}>
              {STATUS_LABEL[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size="sm"
          aria-label="Assigned agent"
          value={conversation.assignee ? String(conversation.assignee.id) : NONE}
          disabled={busy}
          onChange={(event) => void run({ action: "assign", assigneeId: idOf(event.target.value) })}
          className="max-w-48"
          data-linked-assignee
        >
          <NativeSelectOption value={NONE}>No agent</NativeSelectOption>
          {agents.map((agent) => (
            <NativeSelectOption key={agent.id} value={String(agent.id)}>
              {agent.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size="sm"
          aria-label="Team"
          value={conversation.team ? String(conversation.team.id) : NONE}
          disabled={busy}
          onChange={(event) => void run({ action: "team", teamId: idOf(event.target.value) })}
          className="max-w-48"
          data-linked-team
        >
          <NativeSelectOption value={NONE}>No team</NativeSelectOption>
          {teams.map((team) => (
            <NativeSelectOption key={team.id} value={String(team.id)}>
              {team.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-wrap items-center gap-1" data-linked-labels>
        {conversation.labels.map((label) => (
          <Badge key={label} variant="secondary" className="gap-1 pe-1">
            {label}
            <button
              type="button"
              className="rounded-sm opacity-70 hover:opacity-100 disabled:pointer-events-none"
              aria-label={`Remove label ${label}`}
              disabled={busy}
              onClick={() => void run({ action: "labels", remove: [label] })}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <NativeSelect
          size="sm"
          aria-label="Add label"
          value=""
          disabled={busy || addable.length === 0}
          onChange={(event) => event.target.value && void run({ action: "labels", add: [event.target.value] })}
          data-linked-add-label
        >
          <NativeSelectOption value="">{addable.length ? "Add label" : "No more labels"}</NativeSelectOption>
          {addable.map((label) => (
            <NativeSelectOption key={label} value={label}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {busy && <span className="text-muted-foreground text-xs">Saving to the live engine…</span>}
      </div>
      {(error ?? options.error) && (
        <p className="text-destructive text-xs" role="alert">
          {error ?? `The agent, team and label lists could not be read: ${options.error}`}
        </p>
      )}
    </div>
  );
}

function Thread({
  conversation,
  onChanged,
}: {
  conversation: LinkedConversation;
  onChanged: (next?: LinkedConversation) => void;
}) {
  const messages = useLinkedMessages(conversation.id);
  const end = React.useRef<HTMLDivElement>(null);
  const count = messages.data?.messages.length ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the newest message when the thread loads
  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count, conversation.id]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-medium text-xs">
          {initials(conversation.contact.name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-sm">{conversation.contact.name}</span>
          <span className="truncate text-muted-foreground text-xs">
            #{conversation.id} · {conversation.inbox.name}
            {conversation.contact.email ? ` · ${conversation.contact.email}` : ""}
          </span>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-1">
          <Badge variant="outline">{STATUS_LABEL[conversation.status]}</Badge>
        </div>
      </div>
      <ConversationActions conversation={conversation} onChanged={onChanged} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.error ? (
          <LinkProblemPanel message={messages.error} onRetry={messages.reload} />
        ) : messages.loading ? (
          <LinkedLoading what="the messages" />
        ) : (
          <div className="flex flex-col gap-3">
            {messages.data?.messages.map((message) => (
              <MessageLine key={message.key} message={message} />
            ))}
            <div ref={end} />
          </div>
        )}
      </div>
      <ReplyBox
        conversationId={conversation.id}
        onSent={() => {
          messages.refresh();
          onChanged();
        }}
      />
    </div>
  );
}

/**
 * The whole conversations area while "Conversations" is linked. `list` is useLinkedConversations() of the workspace;
 * `viewName` is set for views that show all linked conversations.
 */
export function LinkedConversations({ list, viewName }: { list: Linked<LinkedConversationsBody>; viewName?: string }) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const [showThread, setShowThread] = React.useState(false);
  // L-3: the conversation the server read back after a write, shown until the list is read again.
  const [fresh, setFresh] = React.useState<Record<number, LinkedConversation>>({});
  const data = list.data;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new list answer replaces the read-back copies
  React.useEffect(() => setFresh({}), [data]);
  const rows = (data?.conversations ?? []).map((row) => fresh[row.id] ?? row);
  const changed = (next?: LinkedConversation) => {
    if (next) setFresh((all) => ({ ...all, [next.id]: next }));
    list.refresh();
  };
  const active = rows.find((row) => row.id === selected) ?? rows[0];

  return (
    <div className="flex h-[calc(100svh-var(--dashboard-header-height)-5rem)] flex-col gap-4 md:h-[calc(100svh-var(--dashboard-header-height)-3rem)]">
      <Card className="min-h-[24rem] flex-1 gap-0 overflow-hidden p-0" data-chatwoot-linked="conversations">
        <div className="grid h-full min-h-0 grid-cols-1 *:min-h-0 *:min-w-0 lg:grid-cols-[21rem_minmax(0,1fr)]">
          <div className={cn("flex min-h-0 flex-col lg:border-e", showThread && "hidden lg:flex")}>
            <div className="flex flex-col gap-1 border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-base">Conversations</h2>
                <Badge variant="outline" className="gap-1" title={WRITE_PHASE_TEXT}>
                  <Link2 /> {LINK_BADGE_TEXT}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {list.data ? `${list.data.total} in the live engine (all statuses) · ` : ""}
                {WRITE_PHASE_TEXT}
              </p>
              {viewName && (
                <p className="text-muted-foreground text-xs">
                  “{viewName}” shows all conversations of the live engine.
                </p>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {list.error ? (
                <LinkProblemPanel message={list.error} onRetry={list.reload} />
              ) : list.loading ? (
                <LinkedLoading what="the conversations" />
              ) : rows.length ? (
                rows.map((row) => (
                  <ConversationRow
                    key={row.key}
                    conversation={row}
                    active={row.id === active?.id}
                    onOpen={() => {
                      setSelected(row.id);
                      setShowThread(true);
                    }}
                  />
                ))
              ) : (
                <p className="p-6 text-center text-muted-foreground text-sm">The live engine has no conversations.</p>
              )}
            </div>
          </div>
          <div className={cn("min-h-0", !showThread && "hidden lg:block")}>
            {active ? (
              <div className="flex h-full min-h-0 flex-col">
                <Button
                  variant="ghost"
                  size="sm"
                  className="m-2 self-start lg:hidden"
                  onClick={() => setShowThread(false)}
                >
                  Back to the list
                </Button>
                <div className="min-h-0 flex-1">
                  <Thread key={active.key} conversation={active} onChanged={changed} />
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="grid size-12 place-items-center rounded-full bg-muted">
                  <MessagesSquare className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">
                  {list.error ? "Nothing is shown from the preview while linked." : "No conversation selected"}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

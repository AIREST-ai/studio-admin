"use client";

// M129-A (Fahad 129.2): Linear issues and Copilot in the conversation's contact panel work as simulations instead of
// disabled "after linking" buttons. Both are kept in the preview's saved record (lib/cw/preview-sim.ts), so they are
// still there after a reload, and both say plainly that nothing reaches Linear or an AI engine.
// - Linear: Chatwoot's "Create/link linear issue" dialog (components/widgets/conversation/linear/CreateOrLinkIssue.vue,
//   CreateIssue.vue, LinkIssue.vue; texts from i18n/locale/en/integrations.json, v4.18.0): Title and Team required.
//   Linear's priorities (https://linear.app/docs/priority) and a new issue's first state Todo
//   (https://linear.app/docs/configuring-workflows). The teams and the issues to link are sample data.
// - Copilot: the three prompts and "Ask Copilot" get ready-made sample answers built from this conversation's data,
//   each marked as a sample, not written by AI.
import { useState } from "react";

import { Link2, Plus, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { recordSim, SIMULATED, type SimIssue, simId, usePreviewSim } from "@/lib/cw/preview-sim";
import { SimBadge } from "@/lib/cw/preview-sim-ui";

import { buildThread, type Conversation, inboxOf, linearIssues } from "./cw-data";
import { useContactOf, useCwStore } from "./cw-store";

// ---- Linear ----

const LINEAR_TEAMS = [
  { name: "Web", key: "WEB" },
  { name: "Mobile", key: "MOB" },
  { name: "Billing", key: "BIL" },
];
const LINEAR_PRIORITIES = ["No priority", "Urgent", "High", "Medium", "Low"];
// Sample issues offered by "Link issue" (a linked Linear workspace would list its own).
const LINKABLE_ISSUES = [
  { key: "WEB-471", title: "Health check returns 502 behind the load balancer", state: "Todo", priority: "High" },
  {
    key: "WEB-479",
    title: "Export job times out for histories over 1M rows",
    state: "In Progress",
    priority: "Medium",
  },
  { key: "BIL-212", title: "Duplicate charge when the payment webhook retries", state: "Todo", priority: "Urgent" },
  { key: "MOB-118", title: "Android 14 crash right after the splash screen", state: "Backlog", priority: "High" },
];

function IssueCard({
  issue,
  simulated,
}: {
  issue: { key: string; title: string; state: string; priority?: string };
  simulated?: string;
}) {
  return (
    <div className="rounded-md border p-2 text-sm" data-linear-issue={issue.key}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>{issue.key}</span>
        <Badge variant="outline" className="text-[10px]">
          {issue.state}
        </Badge>
      </div>
      <div className="mt-1">{issue.title}</div>
      {simulated && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
          <SimBadge />
          <span>{simulated}</span>
        </div>
      )}
    </div>
  );
}

export function SimLinearIssues({ conversation }: { conversation: Conversation }) {
  const all = usePreviewSim((s) => s.linearIssues);
  const issues = all.filter((issue) => issue.convId === conversation.id);
  const [dialog, setDialog] = useState<"create" | "link" | null>(null);
  const sample = conversation.id === 1 ? linearIssues : [];
  return (
    <div className="flex flex-col gap-2">
      {sample.map((issue) => (
        <IssueCard key={issue.id} issue={{ key: issue.id, title: issue.title, state: issue.state }} />
      ))}
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          simulated={issue.kind === "created" ? "Created in this preview" : "Linked in this preview"}
        />
      ))}
      {sample.length + issues.length === 0 && <p className="text-muted-foreground text-xs">No linked issues found</p>}
      <p className="text-muted-foreground text-xs">
        Sample issues. Issues you create or link stay in this preview; Linear is not contacted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialog("link")}>
          <Link2 /> Link issue
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog("create")}>
          <Plus /> Create issue
        </Button>
      </div>
      {dialog && (
        <LinearIssueDialog
          conversation={conversation}
          tab={dialog}
          linked={[...sample.map((i) => i.id), ...issues.map((i) => i.key)]}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function LinearIssueDialog({
  conversation,
  tab: initialTab,
  linked,
  onClose,
}: {
  conversation: Conversation;
  tab: "create" | "link";
  linked: string[];
  onClose: () => void;
}) {
  const contact = useContactOf(conversation);
  const issues = usePreviewSim((s) => s.linearIssues);
  const created = issues.filter((i) => i.kind === "created");
  const [tab, setTab] = useState(initialTab);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [team, setTeam] = useState("");
  const [priority, setPriority] = useState("No priority");
  const [touched, setTouched] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");

  const save = (issue: Omit<SimIssue, "id" | "convId" | "at">) => {
    void recordSim("linearIssues", {
      ...issue,
      id: simId("lin"),
      convId: conversation.id,
      at: new Date().toISOString(),
    });
  };

  const create = () => {
    setTouched(true);
    const teamInfo = LINEAR_TEAMS.find((t) => t.name === team);
    if (!title.trim() || !teamInfo) return;
    const used = created.filter((i) => i.key.startsWith(`${teamInfo.key}-`)).length;
    const key = `${teamInfo.key}-${(teamInfo.key === "WEB" ? 483 : 101) + used}`;
    save({ kind: "created", key, title: title.trim(), description: description.trim(), team, priority, state: "Todo" });
    toast.success("Issue created successfully", {
      description: `${SIMULATED}: ${key} is kept in this preview only; Linear was not contacted.`,
    });
    onClose();
  };

  const link = () => {
    const issue = LINKABLE_ISSUES.find((i) => i.key === picked);
    if (!issue) return;
    const teamName = LINEAR_TEAMS.find((t) => issue.key.startsWith(t.key))?.name ?? "";
    save({
      kind: "linked",
      key: issue.key,
      title: issue.title,
      description: "",
      team: teamName,
      priority: issue.priority,
      state: issue.state,
    });
    toast.success("Issue linked successfully", {
      description: `${SIMULATED}: ${issue.key} is linked in this preview only; Linear was not contacted.`,
    });
    onClose();
  };

  const matches = LINKABLE_ISSUES.filter(
    (i) => !linked.includes(i.key) && `${i.key} ${i.title}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create/link linear issue</DialogTitle>
          <DialogDescription>
            Create Linear issues from conversations, or link existing ones for seamless tracking.
          </DialogDescription>
          <SimBadge />
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as "create" | "link")}>
          <TabsList variant="line">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="grid gap-3 pt-3">
            <div className="grid gap-1.5">
              <Label htmlFor="linear-title">Title</Label>
              <Input
                id="linear-title"
                placeholder="Enter title"
                value={title}
                aria-invalid={touched && !title.trim()}
                onChange={(event) => setTitle(event.target.value)}
              />
              {touched && !title.trim() && <span className="text-destructive text-xs">Title is required</span>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="linear-description">Description</Label>
              <Textarea
                id="linear-description"
                placeholder="Enter description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="linear-team">Team</Label>
                <NativeSelect
                  id="linear-team"
                  className="w-full"
                  value={team}
                  aria-invalid={touched && !team}
                  onChange={(event) => setTeam(event.target.value)}
                >
                  <option value="" disabled>
                    Select team
                  </option>
                  {LINEAR_TEAMS.map((t) => (
                    <option key={t.key}>{t.name}</option>
                  ))}
                </NativeSelect>
                {touched && !team && <span className="text-destructive text-xs">Team is required</span>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="linear-priority">Priority</Label>
                <NativeSelect
                  id="linear-priority"
                  className="w-full"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  {LINEAR_PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Sample teams. Conversation (#{conversation.id}) with {contact.name}.
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={create}>Create</Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="link" className="grid gap-3 pt-3">
            <Input
              aria-label="Search issues"
              placeholder="Search issues"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-1">
              {matches.length === 0 && <p className="p-2 text-muted-foreground text-xs">No linear issues found</p>}
              {matches.map((issue) => (
                <button
                  key={issue.key}
                  type="button"
                  onClick={() => setPicked(issue.key)}
                  className={`rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted ${picked === issue.key ? "bg-muted" : ""}`}
                >
                  <span className="me-2 text-muted-foreground text-xs">{issue.key}</span>
                  {issue.title}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">Sample Linear issues.</p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button disabled={!picked} onClick={link}>
                Link
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---- Copilot ----

const COPILOT_PROMPTS = ["Summarize this conversation", "Suggest an answer", "Rate this conversation"] as const;

const short = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function sampleAnswer(
  prompt: string,
  conversation: Conversation,
  contactName: string,
  status: string,
  said: { kind: string; text: string }[],
) {
  const first = contactName.split(" ")[0];
  const lastIncoming = said.filter((m) => m.kind === "incoming").at(-1);
  switch (prompt) {
    case "Summarize this conversation":
      return `${contactName} wrote on ${inboxOf(conversation).name} about "${conversation.subject}". ${said.length} messages so far; the latest from the customer: "${short(lastIncoming?.text ?? "none")}". Status: ${status}.`;
    case "Suggest an answer":
      return `Hi ${first}, thank you for your patience. I'm looking into "${short(conversation.subject, 80)}" now and will update you here as soon as I have news.`;
    case "Rate this conversation":
      return "Example rating: 4/5. This number is an example, not an evaluation of this conversation.";
    default:
      return `Your question stayed in this preview; no AI was asked. With Captain linked, Copilot answers questions like "${short(prompt, 80)}" from this conversation and the knowledge base.`;
  }
}

export function SimCopilot({ conversation }: { conversation: Conversation }) {
  const contact = useContactOf(conversation);
  const meta = useCwStore((s) => s.meta[conversation.id]);
  const sent = useCwStore((s) => s.sent[conversation.id]);
  const all = usePreviewSim((s) => s.copilot);
  const entries = all.filter((entry) => entry.convId === conversation.id);
  const [question, setQuestion] = useState("");

  const ask = (prompt: string) => {
    const said = [...buildThread(conversation, meta), ...(sent ?? [])].filter(
      (m) => m.kind === "incoming" || m.kind === "outgoing",
    );
    const at = new Date().toISOString();
    void recordSim("copilot", { id: simId("cop"), convId: conversation.id, role: "user", text: prompt, at });
    void recordSim("copilot", {
      id: simId("cop"),
      convId: conversation.id,
      role: "assistant",
      text: sampleAnswer(prompt, conversation, contact.name, meta?.status ?? "open", said),
      at,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 rounded-md border border-dashed p-3 text-muted-foreground text-xs">
        <SimBadge />
        <span>Copilot answers here are ready-made samples built from this conversation's data. No AI is called.</span>
      </div>
      {entries.length > 0 && (
        <div className="flex flex-col gap-2" data-copilot-thread="">
          {entries.map((entry) =>
            entry.role === "user" ? (
              <div key={entry.id} className="ms-6 rounded-md bg-muted px-3 py-2 text-sm">
                {entry.text}
              </div>
            ) : (
              <div
                key={entry.id}
                className="me-2 grid gap-1.5 rounded-md border px-3 py-2 text-sm"
                data-copilot-answer=""
              >
                <span className="flex flex-wrap items-center gap-1.5 font-medium text-muted-foreground text-xs">
                  <Sparkles className="size-3.5" /> Sample answer, not written by AI
                  <SimBadge />
                </span>
                {entry.text}
              </div>
            ),
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {COPILOT_PROMPTS.map((prompt) => (
          <Button key={prompt} variant="outline" size="sm" className="justify-start" onClick={() => ask(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!question.trim()) return;
          ask(question.trim());
          setQuestion("");
        }}
      >
        <Textarea
          aria-label="Ask Copilot"
          placeholder="Ask Copilot"
          className="min-h-9"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" size="icon-sm" aria-label="Send to Copilot" disabled={!question.trim()}>
          <Send />
        </Button>
      </form>
    </div>
  );
}

"use client";
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { AlertTriangle, MessageSquare, PartyPopper, SmilePlus, Trash2, Users, UserX } from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CHANGED_ELSEWHERE } from "@/lib/cw/store";

import { SettingsBreadcrumb } from "../../_components/settings-breadcrumb";
import { SettingsCard } from "../../_components/settings-card";
import { useAgentRoster } from "../../inboxes/_components/inboxes-store";
import { AgentAvatar, ConfirmDeleteDialog, WizardSteps } from "../../inboxes/_components/settings-ui";
import { CountTabs, PageHeader } from "../../labels/_shared/settings-shell";
import { type Team, teamStats } from "./data";
import { deleteTeamWithNotice, saveTeamsChange, teamsStore, useTeams } from "./teams-store";

const createSteps = [
  { title: "Create", body: "Create a new team of agents." },
  { title: "Add Agents", body: "Add agents to the team." },
  { title: "Finish", body: "You are all set to go!" },
];

const editSteps = [
  { title: "Team details", body: "Change name, description and other details." },
  { title: "Edit Agents", body: "Edit agents in your team." },
  { title: "Finish", body: "You are all set to go!" },
];

type TeamDraft = Pick<Team, "name" | "description" | "icon" | "autoAssign">;

// F-6B: a step moves on (and the page says "updated" or "ready") only after the preview server saved the change.
function useSaveStep() {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (task: () => void | Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

function SaveFailed({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm"
    >
      Not saved: {error}
    </p>
  );
}

// Emoji part of Chatwoot's EmojiIconPicker (TeamForm.vue): pick an emoji for the team, or Remove it.
const teamEmojis = [
  "💼",
  "🎧",
  "💳",
  "🛠️",
  "🚀",
  "📣",
  "🤝",
  "🧾",
  "📦",
  "🌍",
  "⭐",
  "🔥",
  "💡",
  "🧑‍💻",
  "📞",
  "💬",
  "🛒",
  "🏷️",
  "📊",
  "🎯",
  "🧪",
  "🔒",
  "❤️",
  "🌱",
];

function TeamIconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Team icon" className="shrink-0 text-lg">
          {value || <SmilePlus className="size-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="mb-2 flex items-center justify-between text-muted-foreground text-xs">
          <span>Emojis</span>
          {value ? (
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-8 gap-1">
          {teamEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={cn("grid size-7 place-items-center rounded hover:bg-muted", emoji === value && "bg-muted")}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DetailsStep({
  team,
  draft,
  onDraft,
  onNext,
  bare,
}: {
  team?: Team;
  draft: TeamDraft;
  onDraft: (draft: TeamDraft) => void;
  onNext: () => void | Promise<void>;
  bare?: boolean;
}) {
  const [submitted, setSubmitted] = React.useState(false);
  const nameError = submitted && !draft.name.trim();
  const step = useSaveStep();
  return (
    <div className="grid max-w-xl gap-6">
      {bare ? null : (
        <div className="grid gap-1">
          <h2 className="font-medium text-lg">{team ? "Edit your team details" : "Create a new team"}</h2>
          <p className="text-muted-foreground text-sm">
            {team ? "Edit title and description to your team." : "Add a title and description to your new team."}
          </p>
        </div>
      )}
      <FieldGroup className="gap-4">
        <Field data-invalid={nameError || undefined}>
          <FieldLabel htmlFor="team-name">Team name</FieldLabel>
          <div className="flex gap-2">
            <TeamIconPicker value={draft.icon} onChange={(icon) => onDraft({ ...draft, icon })} />
            <Input
              id="team-name"
              placeholder="Example: Sales, Customer Support"
              value={draft.name}
              aria-invalid={nameError || undefined}
              onChange={(e) => onDraft({ ...draft, name: e.target.value })}
            />
          </div>
          {nameError ? <FieldError>This field is required</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="team-desc">Team Description</FieldLabel>
          <Textarea
            id="team-desc"
            placeholder="Short description about this team."
            value={draft.description}
            onChange={(e) => onDraft({ ...draft, description: e.target.value })}
          />
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id="team-auto-assign"
            checked={draft.autoAssign}
            onCheckedChange={(c) => onDraft({ ...draft, autoAssign: c === true })}
          />
          <label htmlFor="team-auto-assign">Allow auto assign for this team.</label>
        </div>
      </FieldGroup>
      <SaveFailed error={step.error} />
      <div>
        <Button
          disabled={step.saving}
          onClick={() => {
            setSubmitted(true);
            if (!draft.name.trim()) return;
            void step.run(async () => {
              if (team) {
                await saveTeamsChange(() => teamsStore.update(team.id, { ...draft, name: draft.name.trim() }));
                toast.success("Team updated successfully.");
              }
              await onNext();
            });
          }}
        >
          {step.saving ? "Saving…" : `${team ? "Update" : "Create"} team`}
        </Button>
      </div>
    </div>
  );
}

function AgentsStep({
  team,
  name,
  onNext,
  bare,
}: {
  team?: Team;
  name: string;
  onNext: (members: number[]) => void | Promise<void>;
  bare?: boolean;
}) {
  const step = useSaveStep();
  const agents = useAgentRoster(); // F-6B: the live agents (an invited agent too), not the seed
  const [selected, setSelected] = React.useState<number[]>(team?.members ?? []);
  const [query, setQuery] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  // F159: the heading shows the name typed in step 1 (the old fallback was a clinic team not in Conversations).
  const teamName = name.trim() || team?.name || "New team";
  let saveLabel = team ? "Update agents in team" : "Add agents";
  if (step.saving) saveLabel = "Saving…";
  const rows = agents.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));
  const all = selected.length === agents.length;
  return (
    <div className="grid max-w-3xl gap-5">
      {bare ? null : (
        <div className="grid gap-1">
          <h2 className="font-medium text-lg">Add agents to team - {teamName}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {team
              ? "Add Agents to your newly created team. All the added agents will be notified when a conversation is assigned to this team."
              : "Add Agents to your newly created team. This lets you collaborate as a team on conversations, get notified on new events in the same conversation."}
          </p>
        </div>
      )}
      {/* F-13 round 2 (Fahad 125.4): a lens only; a click opens the box, closing it brings back the lens. */}
      <div className="flex">
        <ExpandingSearch
          name="team-agents"
          label="Search agents"
          placeholder="Search"
          size="default"
          className="w-full md:w-72"
          value={query}
          onChange={setQuery}
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="select all agents"
                  checked={all}
                  onCheckedChange={(c) => setSelected(c ? agents.map((a) => a.id) : [])}
                />
              </TableHead>
              <TableHead className="font-normal">Agent</TableHead>
              <TableHead className="font-normal">Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((agent) => (
              <TableRow key={agent.id} data-state={selected.includes(agent.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label="select"
                    checked={selected.includes(agent.id)}
                    onCheckedChange={(c) =>
                      setSelected((prev) => (c ? [...prev, agent.id] : prev.filter((x) => x !== agent.id)))
                    }
                  />
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <AgentAvatar id={agent.id} name={agent.name} className="size-7" />
                    <span className="font-medium">{agent.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{agent.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="grid gap-1 text-muted-foreground text-sm tabular-nums">
          {selected.length} out of {agents.length} agents selected.
          {submitted && !selected.length ? <span className="text-destructive">Select at least one agent.</span> : null}
        </span>
        <Button
          disabled={step.saving}
          onClick={() => {
            setSubmitted(true);
            if (selected.length) void step.run(() => onNext(selected));
          }}
        >
          {saveLabel}
        </Button>
      </div>
      <SaveFailed error={step.error} />
    </div>
  );
}

function FinishStep() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary/10">
        <PartyPopper className="size-7 text-primary" />
      </div>
      <h2 className="font-semibold text-xl">Your team is ready!</h2>
      <p className="text-muted-foreground text-sm">
        You can now collaborate as a team on conversations. Happy supporting 🎉
      </p>
      <Button asChild>
        <Link href="/dashboard/settings/teams">Finish</Link>
      </Button>
    </div>
  );
}

// م137 round 2 (judge M137): the same path as every other Settings detail page (settings-breadcrumb.tsx).
function TeamBreadcrumb({ current }: { current: string }) {
  return <SettingsBreadcrumb items={[{ label: "Teams", href: "/dashboard/settings/teams" }, { label: current }]} />;
}

// Stat cards copied from the Contacts detail page (Studio metric cards).
function TeamStatCards({ team }: { team: Team }) {
  const stats = teamStats(team);
  const items = [
    {
      icon: MessageSquare,
      label: "Open conversations",
      value: stats.open,
      note: `${stats.total} assigned to this team`,
    },
    { icon: UserX, label: "Unassigned", value: stats.unassigned, note: "Open and waiting for an agent" },
    { icon: AlertTriangle, label: "High priority", value: stats.urgent, note: "Open with urgent or high priority" },
    {
      icon: Users,
      label: "Agents",
      value: team.members.length,
      note: team.autoAssign ? "Auto assign is on" : "Auto assign is off",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {items.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardTitle>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <stat.icon className="size-4" />
              </div>
            </CardTitle>
            <CardDescription>{stat.label}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{stat.value}</div>
            <p className="text-muted-foreground text-sm">{stat.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Team detail page in the Studio pattern: breadcrumb, big title, stat cards, then tabs over Chatwoot's edit steps. */
function TeamDetails({ team }: { team: Team }) {
  const [tab, setTab] = React.useState<"details" | "agents">("details");
  const [done, setDone] = React.useState(false);
  const [draft, setDraft] = React.useState<TeamDraft>({
    name: team.name,
    description: team.description,
    icon: team.icon,
    autoAssign: team.autoAssign,
  });
  const name = draft.name;
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const router = useRouter();
  const step = tab === "details" ? editSteps[0] : editSteps[1];
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3">
        <TeamBreadcrumb current={team.name} />
        {/* م137 round 2 (judge M137): the buttons at the top right, level with the title, as in PageHeader. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-xl border bg-muted/40 text-2xl">
              {team.icon}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl leading-none tracking-tight">{team.name}</h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 border px-2 py-1 font-medium",
                    team.autoAssign
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", team.autoAssign ? "bg-emerald-500" : "bg-muted-foreground")}
                  />
                  {team.autoAssign ? "Auto assign on" : "Auto assign off"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {team.description} · {team.members.length} {team.members.length === 1 ? "agent" : "agents"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild>
              <Link href={`/dashboard/chat/teams/${team.slug}`}>
                <MessageSquare /> View conversations
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <TeamStatCards team={team} />

      <CountTabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "details" | "agents");
          setDone(false);
        }}
        items={[
          { value: "details", label: "Team details" },
          { value: "agents", label: "Agents", count: team.members.length },
        ]}
      />

      <Card>
        {done ? (
          <CardContent>
            <FinishStep />
          </CardContent>
        ) : (
          <>
            <CardHeader className="border-b">
              <CardTitle className="text-xl leading-none">
                {tab === "details" ? "Edit your team details" : `Edit agents in ${name.trim() || team.name}`}
              </CardTitle>
              <CardDescription className="leading-snug">{step.body}</CardDescription>
            </CardHeader>
            <CardContent>
              {tab === "details" ? (
                <DetailsStep team={team} draft={draft} onDraft={setDraft} onNext={() => setTab("agents")} bare />
              ) : (
                <AgentsStep
                  team={team}
                  name={name}
                  onNext={async (members) => {
                    await saveTeamsChange(() => teamsStore.update(team.id, { members }));
                    setDone(true);
                  }}
                  bare
                />
              )}
            </CardContent>
          </>
        )}
      </Card>

      {/* م137 (Fahad 137): deleting the whole team is the page's danger action, so it sits in a red card at the bottom
          (GitHub's Danger Zone at the foot of its settings page; Chatwoot's AccountDelete after AccountId), no longer
          in the header beside View conversations. Same dialog and name check. */}
      <SettingsCard
        tone="danger"
        title="Delete team"
        description="Deleting the team will remove the team assignment from the conversations assigned to this team."
        action={
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Delete team
          </Button>
        }
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete team"
        message="Deleting the team will remove the team assignment from the conversations assigned to this team."
        confirmValue={team.name}
        onConfirm={() => {
          // F-25: "Team deleted successfully." after the server saved the deletion; a refused delete puts the team back.
          void deleteTeamWithNotice(team).then((deleted) => {
            if (deleted) router.push("/dashboard/settings/teams");
          });
        }}
      />
    </div>
  );
}

/** /teams/[id]: reads the team from the shared teams store so a team created in this session opens too. */
export function TeamDetailRoute({ id }: { id: string }) {
  const teams = useTeams();
  const team = teams.find((t) => String(t.id) === id);
  if (!team) {
    return (
      <div className="flex flex-col gap-4">
        <TeamBreadcrumb current="Team not found" />
        <p className="text-muted-foreground text-sm">This team does not exist or was deleted.</p>
      </div>
    );
  }
  return <TeamDetails key={team.id} team={team} />;
}

export function TeamWizard() {
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<TeamDraft>({ name: "", description: "", icon: "", autoAssign: true });
  const [createdId, setCreatedId] = React.useState<number | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <TeamBreadcrumb current="Create new team" />
        <PageHeader
          title="Create new team"
          description="Teams allow you to organize agents into groups based on their responsibilities. Add a name, then pick the agents who work in it."
        />
      </div>
      <Card className="gap-0 py-0">
        <div className="grid md:grid-cols-[260px_1fr]">
          <aside className="border-b p-4 md:border-r md:border-b-0">
            <WizardSteps steps={createSteps} current={step} />
          </aside>
          <div className="p-6">
            {step === 0 ? (
              <DetailsStep
                draft={draft}
                onDraft={setDraft}
                onNext={async () => {
                  const id = createdId ?? teamsStore.nextId();
                  const name = draft.name.trim();
                  // F161: slug = the team's conversation view URL (/dashboard/chat/teams/<slug>) in the sidebar.
                  const slug =
                    name
                      .toLowerCase()
                      .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
                      .replace(/^-|-$/g, "") || `team-${id}`;
                  // F-6B: step 2 opens only once the team is saved; a failed save says why and keeps this step.
                  await saveTeamsChange(() => teamsStore.save({ id, ...draft, name, slug, members: [] })).catch(
                    (error: Error) => {
                      const unsaved = createdId === null && teamsStore.find(id)?.name === name;
                      if (error.message !== CHANGED_ELSEWHERE && unsaved) teamsStore.remove(id);
                      throw error;
                    },
                  );
                  setCreatedId(id);
                  setStep(1);
                }}
              />
            ) : null}
            {step === 1 ? (
              <AgentsStep
                name={draft.name}
                onNext={async (members) => {
                  if (createdId !== null) await saveTeamsChange(() => teamsStore.update(createdId, { members }));
                  setStep(2);
                }}
              />
            ) : null}
            {step === 2 ? <FinishStep /> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

"use client";
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { AlertTriangle, MessageSquare, PartyPopper, Search, Trash2, Users, UserX } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { agents } from "../../inboxes/_components/data";
import { AgentAvatar, ConfirmDeleteDialog, WizardSteps } from "../../inboxes/_components/settings-ui";
import { CountTabs, PageHeader } from "../../labels/_shared/settings-shell";
import { type Team, teamStats } from "./data";

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

function DetailsStep({
  team,
  name,
  onName,
  onNext,
  bare,
}: {
  team?: Team;
  name: string;
  onName: (name: string) => void;
  onNext: () => void;
  bare?: boolean;
}) {
  const [submitted, setSubmitted] = React.useState(false);
  const nameError = submitted && !name.trim();
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
          <Input
            id="team-name"
            placeholder="Example: Sales, Customer Support"
            value={name}
            aria-invalid={nameError || undefined}
            onChange={(e) => onName(e.target.value)}
          />
          {nameError ? <FieldError>This field is required</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="team-desc">Team Description</FieldLabel>
          <Textarea id="team-desc" placeholder="Short description about this team." defaultValue={team?.description} />
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox id="team-auto-assign" defaultChecked={team?.autoAssign ?? true} />
          <label htmlFor="team-auto-assign">Allow auto assign for this team.</label>
        </div>
      </FieldGroup>
      <div>
        <Button
          onClick={() => {
            setSubmitted(true);
            if (!name.trim()) return;
            if (team) toast.success("Team updated successfully.");
            onNext();
          }}
        >
          {team ? "Update team" : "Create team"}
        </Button>
      </div>
    </div>
  );
}

function AgentsStep({ team, name, onNext, bare }: { team?: Team; name: string; onNext: () => void; bare?: boolean }) {
  const [selected, setSelected] = React.useState<number[]>(team?.members ?? []);
  const [query, setQuery] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  // F159: the heading shows the name typed in step 1 (the old fallback was a clinic team not in Conversations).
  const teamName = name.trim() || team?.name || "New team";
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
      <InputGroup className="h-8 w-full md:w-72">
        <InputGroupAddon align="inline-start">
          <Search className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          className="h-8"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
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
          {submitted && !selected.length ? (
            <span className="text-destructive">Select at least one agent.</span>
          ) : null}
        </span>
        <Button
          onClick={() => {
            setSubmitted(true);
            if (selected.length) onNext();
          }}
        >
          {team ? "Update agents in team" : "Add agents"}
        </Button>
      </div>
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

function TeamBreadcrumb({ current }: { current: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard/settings/teams">Teams</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
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
  const [name, setName] = React.useState(team.name);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const router = useRouter();
  const step = tab === "details" ? editSteps[0] : editSteps[1];
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3">
        <TeamBreadcrumb current={team.name} />
        <div className="flex flex-wrap items-end justify-between gap-3">
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
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Delete team
            </Button>
            <Button size="sm" asChild>
              <Link href={`/dashboard/chat/teams/${team.name.toLowerCase()}`}>
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
                <DetailsStep team={team} name={name} onName={setName} onNext={() => setTab("agents")} bare />
              ) : (
                <AgentsStep team={team} name={name} onNext={() => setDone(true)} bare />
              )}
            </CardContent>
          </>
        )}
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Are you sure you want to delete the team?"
        message="Deleting the team will remove the team assignment from the conversations assigned to this team."
        confirmValue={team.name}
        placeholder={`Please type ${team.name} to confirm`}
        confirmText={`Delete ${team.name}`}
        rejectText="Cancel"
        onConfirm={() => {
          toast.success("Team deleted successfully.");
          router.push("/dashboard/settings/teams");
        }}
      />
    </div>
  );
}

export function TeamWizard({ team }: { team?: Team }) {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState(team?.name ?? "");
  if (team) return <TeamDetails team={team} />;
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
            {step === 0 ? <DetailsStep name={name} onName={setName} onNext={() => setStep(1)} /> : null}
            {step === 1 ? <AgentsStep name={name} onNext={() => setStep(2)} /> : null}
            {step === 2 ? <FinishStep /> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

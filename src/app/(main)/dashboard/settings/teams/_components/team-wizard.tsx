"use client";
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, PartyPopper, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { agents } from "../../inboxes/_components/data";
import { AgentAvatar, WizardSteps } from "../../inboxes/_components/settings-ui";
import type { Team } from "./data";

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

function DetailsStep({ team, onNext }: { team?: Team; onNext: () => void }) {
  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-1">
        <h2 className="font-medium text-lg">{team ? "Edit your team details" : "Create a new team"}</h2>
        <p className="text-muted-foreground text-sm">
          {team ? "Edit title and description to your team." : "Add a title and description to your new team."}
        </p>
      </div>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="team-name">Team name</FieldLabel>
          <Input id="team-name" placeholder="Example: Sales, Customer Support" defaultValue={team?.name} />
        </Field>
        <Field>
          <FieldLabel htmlFor="team-desc">Team Description</FieldLabel>
          <Textarea
            id="team-desc"
            placeholder="Short description about this team."
            defaultValue={team?.description}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox defaultChecked={team?.autoAssign ?? true} />
          Allow auto assign for this team.
        </label>
      </FieldGroup>
      <div>
        <Button onClick={onNext}>{team ? "Update team" : "Create team"}</Button>
      </div>
    </div>
  );
}

function AgentsStep({ team, onNext }: { team?: Team; onNext: () => void }) {
  const [selected, setSelected] = React.useState<number[]>(team?.members ?? []);
  const [query, setQuery] = React.useState("");
  const teamName = team?.name ?? "Patient Support";
  const rows = agents.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));
  const all = selected.length === agents.length;
  return (
    <div className="grid max-w-3xl gap-5">
      <div className="grid gap-1">
        <h2 className="font-medium text-lg">Add agents to team - {teamName}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {team
            ? "Add Agents to your newly created team. All the added agents will be notified when a conversation is assigned to this team."
            : "Add Agents to your newly created team. This lets you collaborate as a team on conversations, get notified on new events in the same conversation."}
        </p>
      </div>
      <InputGroup className="h-8 w-full md:w-72">
        <InputGroupAddon align="inline-start">
          <Search className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput className="h-8" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
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
        <span className="text-muted-foreground text-sm tabular-nums">
          {selected.length} out of {agents.length} agents selected.
        </span>
        <Button onClick={onNext} disabled={!selected.length}>
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

export function TeamWizard({ team }: { team?: Team }) {
  const [step, setStep] = React.useState(0);
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="icon-sm" aria-label="Back" asChild>
          <Link href="/dashboard/settings/teams">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="font-semibold text-xl leading-none">{team ? team.name : "Teams"}</h1>
      </div>
      <div className="grid md:grid-cols-[260px_1fr]">
        <aside className="border-b p-4 md:border-r md:border-b-0">
          <WizardSteps steps={team ? editSteps : createSteps} current={step} />
        </aside>
        <div className="p-6">
          {step === 0 ? <DetailsStep team={team} onNext={() => setStep(1)} /> : null}
          {step === 1 ? <AgentsStep team={team} onNext={() => setStep(2)} /> : null}
          {step === 2 ? <FinishStep /> : null}
        </div>
      </div>
    </Card>
  );
}

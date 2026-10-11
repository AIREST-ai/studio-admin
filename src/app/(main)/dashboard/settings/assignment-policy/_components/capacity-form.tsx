"use client";
import * as React from "react";

import { Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

import { agents, inboxes } from "../../inboxes/_components/data";
import { AgentAvatar, Section } from "../../inboxes/_components/settings-ui";
import { FormShell } from "./assignment-form";
import type { CapacityPolicy } from "./data";

export function CapacityPolicyForm({ policy }: { policy?: CapacityPolicy }) {
  const [limits, setLimits] = React.useState(policy?.limits ?? []);
  const [labels, setLabels] = React.useState(policy?.labels ?? []);
  const [linked, setLinked] = React.useState<number[]>(policy?.agents ?? []);
  const availableAgents = agents.filter((a) => !linked.includes(a.id));
  const availableLabels = ["vip", "follow-up", "spam", "billing", "appointment"].filter((l) => !labels.includes(l));

  return (
    <FormShell
      title={policy ? "Edit agent capacity policy" : "Create agent capacity policy"}
      backHref="/dashboard/settings/assignment-policy/capacity"
      submit={policy ? "Update policy" : "Create policy"}
    >
      <Section title="Policy details">
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="c-name">Policy name:</FieldLabel>
            <Input id="c-name" placeholder="Enter policy name" defaultValue={policy?.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-desc">Description:</FieldLabel>
            <Input id="c-desc" placeholder="Enter description" defaultValue={policy?.description} />
          </Field>
        </div>
      </Section>

      <Section
        title="Inbox capacity limits"
        action={
          <Button variant="outline" size="sm" onClick={() => setLimits((prev) => [...prev, { inbox: 0, max: 5 }])}>
            <Plus /> Add inbox
          </Button>
        }
      >
        {limits.length ? (
          <div className="grid gap-2">
            {limits.map((limit, index) => (
              <div key={`${limit.inbox}-${index}`} className="flex items-center gap-2">
                <NativeSelect className="w-full" defaultValue={limit.inbox || ""}>
                  <option value="">Select inbox</option>
                  {inboxes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </NativeSelect>
                <Input type="number" defaultValue={limit.max} placeholder="Set limit" className="w-28" />
                <span className="whitespace-nowrap text-muted-foreground text-xs">Max conversations</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  onClick={() => setLimits((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed py-6 text-center text-muted-foreground text-sm">
            No inbox limit set
          </div>
        )}
      </Section>

      <Section
        title="Exclusion rules"
        description="Conversations that satisfy the following conditions would not count towards agent capacity"
      >
        <div className="grid gap-5">
          <div className="grid gap-2">
            <span className="text-sm">Exclude conversations tagged with specific labels</span>
            <div className="flex flex-wrap items-center gap-2">
              {labels.map((label) => (
                <Badge key={label} variant="outline" className="gap-1 font-normal">
                  {label}
                  <X
                    className="size-3 cursor-pointer"
                    onClick={() => setLabels((prev) => prev.filter((l) => l !== label))}
                  />
                </Badge>
              ))}
              <NativeSelect
                size="sm"
                value=""
                aria-label="add tag"
                onChange={(e) => e.target.value && setLabels((prev) => [...prev, e.target.value])}
              >
                <option value="">add tag</option>
                {availableLabels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-2">
            <span className="text-sm">Exclude conversations older than a specified duration</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Set time"
                defaultValue={policy?.excludeOlderThan ?? ""}
                className="h-8 w-24"
              />
              <NativeSelect size="sm" defaultValue="hours">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </NativeSelect>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Assigned agents"
        description="Add agents for which this policy will be applicable."
        action={
          <NativeSelect
            size="sm"
            value=""
            aria-label="Add agent"
            onChange={(e) => e.target.value && setLinked((prev) => [...prev, Number(e.target.value)])}
          >
            <option value="">Add agent</option>
            {availableAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        }
      >
        {linked.length ? (
          <div className="divide-y rounded-lg border">
            {agents
              .filter((a) => linked.includes(a.id))
              .map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex items-center gap-3 text-sm">
                    <AgentAvatar id={agent.id} name={agent.name} className="size-7" />
                    <span className="grid">
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-muted-foreground text-xs">{agent.email}</span>
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    onClick={() => setLinked((prev) => prev.filter((x) => x !== agent.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed py-6 text-center text-muted-foreground text-sm">
            No agents added
          </div>
        )}
      </Section>
    </FormShell>
  );
}

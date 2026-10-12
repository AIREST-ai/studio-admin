"use client";
// Chatwoot AgentCapacityCreatePage / AgentCapacityEditPage + AgentCapacityPolicyForm.vue, in the Studio pattern.
import * as React from "react";

import { useRouter } from "next/navigation";

import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { LabelBadge } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { SettingsCard } from "../../_components/settings-card";
import { agents, inboxes } from "../../inboxes/_components/data";
import { AgentAvatar } from "../../inboxes/_components/settings-ui";
import { accountLabels, type CapacityPolicy, capacityPolicies } from "./data";
import { AddDropdown, ConfirmDialog, EmptyBox, POLICY_HOME, PolicyFormShell } from "./policy-ui";

function agentLinkedElsewhere(agentId: number, policyId?: number) {
  return capacityPolicies.find((p) => p.id !== policyId && p.agents.includes(agentId));
}

let nextKey = 100;

export function CapacityPolicyForm({ policy }: { policy?: CapacityPolicy }) {
  const router = useRouter();
  const [name, setName] = React.useState(policy?.name ?? "");
  const [description, setDescription] = React.useState(policy?.description ?? "");
  const [limits, setLimits] = React.useState(
    (policy?.limits ?? []).map((l, i) => ({ key: i, inbox: String(l.inbox), max: String(l.max) })),
  );
  const [labels, setLabels] = React.useState(policy?.labels ?? []);
  const [olderThan, setOlderThan] = React.useState(String(policy?.excludeOlderThan ?? ""));
  const [olderUnit, setOlderUnit] = React.useState("hours");
  const [linked, setLinked] = React.useState<number[]>(policy?.agents ?? []);
  const [pending, setPending] = React.useState<number | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const nameError = submitted && !name.trim();
  const pendingAgent = agents.find((a) => a.id === pending);
  const pendingOwner = pending !== null ? agentLinkedElsewhere(pending, policy?.id) : undefined;
  const usedInboxes = limits.map((l) => l.inbox);

  const addAgent = (id: number) => {
    setLinked((prev) => [...prev, id]);
    toast.success(policy ? "Agent added to policy successfully" : "Agent successfully added to policy");
  };

  return (
    <>
      <PolicyFormShell
        crumbs={[
          { label: "Agent assignment", href: POLICY_HOME },
          { label: "Agent capacity", href: `${POLICY_HOME}/capacity` },
          { label: policy ? policy.name : "New policy" },
        ]}
        title={policy ? "Edit agent capacity policy" : "Create agent capacity policy"}
        description="Manage workload for agents."
        backHref={`${POLICY_HOME}/capacity`}
        submit={policy ? "Update policy" : "Create policy"}
        onSubmit={() => {
          setSubmitted(true);
          if (!name.trim()) return;
          toast.success(
            policy ? "Agent capacity policy updated successfully" : "Agent capacity policy created successfully",
          );
          router.push(`${POLICY_HOME}/capacity`);
        }}
      >
        <SettingsCard title="Policy details">
          <FieldGroup className="gap-4">
            <Field data-invalid={nameError || undefined}>
              <FieldLabel htmlFor="c-name">Policy name:</FieldLabel>
              <Input
                id="c-name"
                placeholder="Enter policy name"
                value={name}
                aria-invalid={nameError || undefined}
                onChange={(e) => setName(e.target.value)}
              />
              {nameError ? <FieldError>This field is required</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="c-desc">Description:</FieldLabel>
              <Input
                id="c-desc"
                placeholder="Enter description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </SettingsCard>

        <SettingsCard
          title="Inbox capacity limits"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={limits.length >= inboxes.length}
              onClick={() => setLimits((prev) => [...prev, { key: nextKey++, inbox: "", max: "" }])}
            >
              Add inbox
            </Button>
          }
        >
          {limits.length ? (
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_8rem_2rem] gap-2 px-1 text-muted-foreground text-xs">
                <span>Select inbox</span>
                <span>Max conversations</span>
              </div>
              {limits.map((limit) => (
                <div key={limit.key} className="grid grid-cols-[1fr_8rem_2rem] items-center gap-2">
                  <NativeSelect
                    className="w-full"
                    aria-label="Select inbox"
                    value={limit.inbox}
                    onChange={(e) =>
                      setLimits((prev) => prev.map((l) => (l.key === limit.key ? { ...l, inbox: e.target.value } : l)))
                    }
                  >
                    <NativeSelectOption value="">Select inbox</NativeSelectOption>
                    {inboxes
                      .filter((i) => String(i.id) === limit.inbox || !usedInboxes.includes(String(i.id)))
                      .map((i) => (
                        <NativeSelectOption key={i.id} value={i.id}>
                          {i.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                  <Input
                    type="number"
                    min={1}
                    aria-label="Max conversations"
                    placeholder="Set limit"
                    value={limit.max}
                    onChange={(e) =>
                      setLimits((prev) => prev.map((l) => (l.key === limit.key ? { ...l, max: e.target.value } : l)))
                    }
                    onBlur={() => limit.inbox && limit.max && toast.success("Inbox limit updated successfully")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove inbox limit"
                    onClick={() => {
                      setLimits((prev) => prev.filter((l) => l.key !== limit.key));
                      toast.success("Inbox limit deleted successfully");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBox>No inbox limit set</EmptyBox>
          )}
        </SettingsCard>

        <SettingsCard
          title="Exclusion rules"
          description="Conversations that satisfy the following conditions would not count towards agent capacity"
        >
          <div className="grid gap-5">
            <div className="grid gap-2">
              <span className="text-sm">Exclude conversations tagged with specific labels</span>
              <div className="flex flex-wrap items-center gap-2">
                {labels.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1">
                    <LabelBadge label={label} />
                    <button
                      type="button"
                      aria-label={`Remove ${label}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setLabels((prev) => prev.filter((l) => l !== label))}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                {labels.length === 0 ? (
                  <span className="text-muted-foreground text-sm">No tags added to this policy.</span>
                ) : null}
                <AddDropdown
                  size="xs"
                  label="add tag"
                  placeholder="Search and select tags to add"
                  options={accountLabels.filter((l) => !labels.includes(l)).map((l) => ({ value: l, label: l }))}
                  onPick={(value) => setLabels((prev) => [...prev, value])}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-sm">Exclude conversations older than a specified duration</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  aria-label="Exclude conversations older than"
                  placeholder="Set time"
                  value={olderThan}
                  onChange={(e) => setOlderThan(e.target.value)}
                  className="h-8 w-24"
                />
                <NativeSelect size="sm" aria-label="Unit" value={olderUnit} onChange={(e) => setOlderUnit(e.target.value)}>
                  <NativeSelectOption value="minutes">Minutes</NativeSelectOption>
                  <NativeSelectOption value="hours">Hours</NativeSelectOption>
                  <NativeSelectOption value="days">Days</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Assigned agents"
          description="Add agents for which this policy will be applicable."
          action={
            <AddDropdown
              label="Add agent"
              placeholder="Search and select agents to add"
              options={agents
                .filter((a) => !linked.includes(a.id))
                .map((a) => ({
                  value: String(a.id),
                  label: a.name,
                  hint: agentLinkedElsewhere(a.id, policy?.id) ? "Linked" : a.role,
                  icon: <AgentAvatar id={a.id} name={a.name} className="size-5" />,
                }))}
              onPick={(value) => {
                const id = Number(value);
                if (agentLinkedElsewhere(id, policy?.id)) setPending(id);
                else addAgent(id);
              }}
            />
          }
        >
          {linked.length ? (
            <div className="divide-y rounded-lg border">
              {agents
                .filter((a) => linked.includes(a.id))
                .map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex items-center gap-3 text-sm">
                      <AgentAvatar id={agent.id} name={agent.name} className="size-8" />
                      <span className="grid">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-muted-foreground text-xs">{agent.email}</span>
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${agent.name}`}
                      onClick={() => {
                        setLinked((prev) => prev.filter((x) => x !== agent.id));
                        toast.success("Agent removed from policy successfully");
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyBox>No agents added</EmptyBox>
          )}
        </SettingsCard>
      </PolicyFormShell>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Add agent"
        description={`${pendingAgent?.name ?? ""} is already linked to another policy (${pendingOwner?.name ?? ""}). Are you sure you want to link it to this policy? It will be unlinked from the other policy.`}
        confirm="Continue"
        onConfirm={() => {
          if (pending !== null) addAgent(pending);
          setPending(null);
        }}
      />
    </>
  );
}

"use client";
// Chatwoot AgentAssignmentCreatePage / AgentAssignmentEditPage + AgentAssignmentPolicyForm.vue, ConfirmInboxDialog.vue
// and InboxLinkDialog.vue, in the Studio pattern (breadcrumb, big title, form in cards).
import * as React from "react";

import { useRouter } from "next/navigation";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { SettingsCard } from "../../_components/settings-card";
import { SAVED_IN_PREVIEW } from "../../_components/settings-preview-client";
import { channelFor } from "../../inboxes/_components/data";
import { useInboxes } from "../../inboxes/_components/inboxes-store";
import type { AssignmentPolicy } from "./data";
import { assignmentPoliciesStore, linkInboxToPolicy, withInboxesLinked } from "./policies-store";
import { AddDropdown, ConfirmDialog, EmptyBox, POLICY_HOME, PolicyFormShell } from "./policy-ui";

export function OptionCards({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; description: string; badge?: string }[];
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid gap-3 md:grid-cols-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
        >
          <RadioGroupItem value={opt.value} className="mt-0.5" />
          <div className="grid gap-1">
            <span className="flex items-center gap-2 font-medium text-sm">
              {opt.label}
              {opt.badge ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/20 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400"
                >
                  {opt.badge}
                </Badge>
              ) : null}
            </span>
            <span className="text-muted-foreground text-xs">{opt.description}</span>
          </div>
        </label>
      ))}
    </RadioGroup>
  );
}

/** Which other policy an inbox is already linked to (one policy per inbox). */
function linkedElsewhere(inboxId: number, policyId?: number) {
  return assignmentPoliciesStore.get().find((p) => p.id !== policyId && p.inboxes.includes(inboxId));
}

export function AssignmentPolicyForm({ policy, linkInboxId }: { policy?: AssignmentPolicy; linkInboxId?: number }) {
  const router = useRouter();
  const inboxes = useInboxes();
  const [name, setName] = React.useState(policy?.name ?? "");
  const [description, setDescription] = React.useState(policy?.description ?? "");
  const [active, setActive] = React.useState(policy?.active ?? true);
  const [order, setOrder] = React.useState<string>(policy?.order ?? "round_robin");
  const [priority, setPriority] = React.useState<string>(policy?.priority ?? "earliest_created");
  const [maxPerAgent, setMaxPerAgent] = React.useState(String(policy?.maxPerAgent ?? 100));
  const [windowValue, setWindowValue] = React.useState(String(policy?.window ?? 60));
  const [windowUnit, setWindowUnit] = React.useState("minutes");
  const [stale, setStale] = React.useState(String((policy?.staleDays ?? 7) * 24));
  const [linked, setLinked] = React.useState<number[]>(policy?.inboxes ?? []);
  const [pending, setPending] = React.useState<number | null>(null);
  // Chatwoot AgentAssignmentEditPage.vue: opened with ?inboxId= (from an inbox's "Create new policy"), the edit page
  // asks once whether to link that inbox to the policy.
  const linkInbox = inboxes.find((i) => i.id === linkInboxId);
  const [linkPrompt, setLinkPrompt] = React.useState(
    Boolean(policy && linkInbox && !policy.inboxes.includes(linkInbox.id)),
  );
  const [submitted, setSubmitted] = React.useState(false);

  const nameError = submitted && !name.trim();
  const maxError = submitted && !(Number(maxPerAgent) >= 1);
  const windowError = submitted && !(Number(windowValue) >= 1);
  const pendingInbox = inboxes.find((i) => i.id === pending);
  const pendingOwner = pending !== null ? linkedElsewhere(pending, policy?.id) : undefined;

  // F-6A (sim2 problem 1: "Inbox successfully added to policy" before the policy existed): adding or removing an inbox
  // here changes the form only; it is saved with Create policy / Update policy, which say so after the save.
  const [saving, setSaving] = React.useState(false);
  const addInbox = (id: number) => {
    setLinked((prev) => [...prev, id]);
  };

  return (
    <>
      <PolicyFormShell
        crumbs={[
          { label: "Agent Assignment", href: POLICY_HOME },
          { label: "Assignment policy", href: `${POLICY_HOME}/assignment` },
          { label: policy ? policy.name : "New policy" },
        ]}
        title={policy ? "Edit assignment policy" : "Create assignment policy"}
        description="Manage how conversations get assigned in inboxes."
        backHref={`${POLICY_HOME}/assignment`}
        submit={policy ? "Update policy" : "Create policy"}
        onSubmit={() => {
          setSubmitted(true);
          if (!name.trim() || !(Number(maxPerAgent) >= 1) || !(Number(windowValue) >= 1)) return;
          const unit = windowUnit === "hours" ? 60 : windowUnit === "days" ? 1440 : 1;
          const saved: AssignmentPolicy = {
            id: policy?.id ?? assignmentPoliciesStore.nextId(),
            name: name.trim(),
            description: description.trim(),
            active,
            order: order as AssignmentPolicy["order"],
            priority: priority as AssignmentPolicy["priority"],
            maxPerAgent: Number(maxPerAgent),
            window: Number(windowValue) * unit,
            staleDays: Math.round((Number(stale) || 0) / 24),
            inboxes: policy?.inboxes ?? [],
          };
          if (saving) return;
          setSaving(true);
          // One save: the policy, its inboxes, and those inboxes taken off any other policy (one policy per inbox).
          assignmentPoliciesStore
            .apply((items) => {
              const others = items.filter((p) => p.id !== saved.id);
              const next = policy ? items.map((p) => (p.id === saved.id ? saved : p)) : [...others, saved];
              return withInboxesLinked(next, saved.id, linked).map((p) =>
                p.id !== saved.id ? p : { ...p, inboxes: [...linked] },
              );
            })
            .then(
              () => {
                if (policy) {
                  toast.success("Assignment policy updated successfully", { description: SAVED_IN_PREVIEW });
                  router.push(`${POLICY_HOME}/assignment`);
                } else {
                  // Chatwoot AgentAssignmentCreatePage.vue: after create, open the new policy's edit page (keeping ?inboxId).
                  toast.success("Assignment policy created successfully", { description: SAVED_IN_PREVIEW });
                  router.push(`${POLICY_HOME}/assignment/${saved.id}${linkInboxId ? `?inboxId=${linkInboxId}` : ""}`);
                }
              },
              (error: Error) => toast.error("Assignment policy not saved", { description: error.message }),
            )
            .finally(() => setSaving(false));
        }}
      >
        <SettingsCard title="Policy details">
          <FieldGroup className="gap-4">
            <Field data-invalid={nameError || undefined}>
              <FieldLabel htmlFor="p-name">Policy name:</FieldLabel>
              <Input
                id="p-name"
                placeholder="Enter policy name"
                value={name}
                aria-invalid={nameError || undefined}
                onChange={(e) => setName(e.target.value)}
              />
              {nameError ? <FieldError>This field is required</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="p-desc">Description:</FieldLabel>
              <Input
                id="p-desc"
                placeholder="Enter description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="flex items-center gap-3">
              <FieldLabel htmlFor="p-status">Status:</FieldLabel>
              <Checkbox id="p-status" checked={active} onCheckedChange={(v) => setActive(v === true)} />
              <span className="text-muted-foreground text-sm">
                {active ? "Policy is active" : "Policy is inactive"}
              </span>
            </div>
          </FieldGroup>
        </SettingsCard>

        <SettingsCard title="Assignment order">
          <OptionCards
            value={order}
            onChange={setOrder}
            options={[
              { value: "round_robin", label: "Round robin", description: "Assign conversations evenly among agents." },
              {
                value: "balanced",
                label: "Balanced",
                description: "Assign conversations based on available capacity.",
                badge: "Premium",
              },
            ]}
          />
        </SettingsCard>

        <SettingsCard title="Assignment priority">
          <OptionCards
            value={priority}
            onChange={setPriority}
            options={[
              {
                value: "earliest_created",
                label: "Earliest created",
                description: "The conversation that was created first gets assigned first.",
              },
              {
                value: "longest_waiting",
                label: "Longest waiting",
                description: "The conversation waiting the longest gets assigned first.",
              },
            ]}
          />
        </SettingsCard>

        <SettingsCard
          title="Fair distribution policy"
          description="Cap conversations per agent within a time window to avoid overload. Defaults to 100 per hour."
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Assign max</span>
            <Input
              type="number"
              min={1}
              aria-label="Assign max"
              value={maxPerAgent}
              aria-invalid={maxError || undefined}
              onChange={(e) => setMaxPerAgent(e.target.value)}
              className="h-8 w-20"
            />
            <span>Conversations per agent in every</span>
            <Input
              type="number"
              min={1}
              aria-label="Window"
              value={windowValue}
              aria-invalid={windowError || undefined}
              onChange={(e) => setWindowValue(e.target.value)}
              className="h-8 w-20"
            />
            <NativeSelect
              size="sm"
              aria-label="Window unit"
              value={windowUnit}
              onChange={(e) => setWindowUnit(e.target.value)}
            >
              <NativeSelectOption value="minutes">Minutes</NativeSelectOption>
              <NativeSelectOption value="hours">Hours</NativeSelectOption>
              <NativeSelectOption value="days">Days</NativeSelectOption>
            </NativeSelect>
          </div>
          {maxError || windowError ? <FieldError>Please enter a value greater than 0</FieldError> : null}
        </SettingsCard>

        <SettingsCard
          title="Skip stale conversations"
          description="Skip unassigned conversations older than this. Defaults to 7 days; clear to disable."
        >
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="number"
              min={0}
              aria-label="Skip conversations older than"
              placeholder="168"
              value={stale}
              onChange={(e) => setStale(e.target.value)}
              className="h-8 w-24"
            />
            <span className="text-muted-foreground">hours</span>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Added inboxes"
          description="Add inboxes for which this policy will be applicable."
          action={
            <AddDropdown
              label="Add inbox"
              placeholder="Search and select inboxes to add"
              options={inboxes
                .filter((i) => !linked.includes(i.id))
                .map((i) => {
                  const Icon = channelFor(i.channel).icon;
                  return {
                    value: String(i.id),
                    label: i.name,
                    hint: linkedElsewhere(i.id, policy?.id) ? "Linked" : channelFor(i.channel).name,
                    icon: <Icon className="size-4 text-muted-foreground" />,
                  };
                })}
              onPick={(value) => {
                const id = Number(value);
                if (linkedElsewhere(id, policy?.id)) setPending(id);
                else addInbox(id);
              }}
            />
          }
        >
          {linked.length ? (
            <div className="divide-y rounded-lg border">
              {inboxes
                .filter((i) => linked.includes(i.id))
                .map((inbox) => {
                  const channel = channelFor(inbox.channel);
                  const Icon = channel.icon;
                  return (
                    <div key={inbox.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="flex items-center gap-3 text-sm">
                        <span className="grid size-8 place-items-center rounded-lg border bg-muted/50">
                          <Icon className="size-4 text-muted-foreground" />
                        </span>
                        <span className="grid">
                          <span className="font-medium">{inbox.name}</span>
                          <span className="text-muted-foreground text-xs">{channel.name}</span>
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${inbox.name}`}
                        onClick={() => setLinked((prev) => prev.filter((x) => x !== inbox.id))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
            </div>
          ) : (
            <EmptyBox>No inboxes added to this policy, add an inbox to get started</EmptyBox>
          )}
        </SettingsCard>
      </PolicyFormShell>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Add inbox"
        description={`${pendingInbox?.name ?? ""} inbox is already linked to another policy (${pendingOwner?.name ?? ""}). Are you sure you want to link it to this policy? It will be unlinked from the other policy.`}
        confirm="Continue"
        onConfirm={() => {
          if (pending !== null) addInbox(pending);
          setPending(null);
        }}
      />

      <ConfirmDialog
        open={linkPrompt}
        onOpenChange={setLinkPrompt}
        title="Link inbox to policy"
        description={`Would you like to link this inbox to the assignment policy? (${linkInbox?.name ?? ""})`}
        confirm="Link inbox"
        cancel="Skip"
        onConfirm={() => {
          if (!policy || !linkInbox) return;
          linkInboxToPolicy(linkInbox.id, policy.id).then(
            () => {
              setLinked((prev) => (prev.includes(linkInbox.id) ? prev : [...prev, linkInbox.id]));
              toast.success("Inbox successfully added to policy", { description: SAVED_IN_PREVIEW });
              router.replace(`${POLICY_HOME}/assignment/${policy.id}`);
            },
            (error: Error) => toast.error("Inbox not linked", { description: error.message }),
          );
        }}
      />
    </>
  );
}

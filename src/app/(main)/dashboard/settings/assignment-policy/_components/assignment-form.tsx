"use client";
import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

import { channelFor, inboxes } from "../../inboxes/_components/data";
import { Section } from "../../inboxes/_components/settings-ui";
import type { AssignmentPolicy } from "./data";

function OptionCards({
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
              {opt.badge ? <Badge variant="secondary">{opt.badge}</Badge> : null}
            </span>
            <span className="text-muted-foreground text-xs">{opt.description}</span>
          </div>
        </label>
      ))}
    </RadioGroup>
  );
}

export function FormShell({
  title,
  backHref,
  children,
  submit,
}: {
  title: string;
  backHref: string;
  children: React.ReactNode;
  submit: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card className="gap-0 py-0">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <Button variant="ghost" size="icon-sm" aria-label="Back" asChild>
            <Link href={backHref}>
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="font-semibold text-xl leading-none">{title}</h1>
        </div>
        {children}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" asChild>
            <Link href={backHref}>Cancel</Link>
          </Button>
          <Button>{submit}</Button>
        </div>
      </Card>
    </div>
  );
}

export function AssignmentPolicyForm({ policy }: { policy?: AssignmentPolicy }) {
  const [active, setActive] = React.useState(policy?.active ?? true);
  const [order, setOrder] = React.useState<string>(policy?.order ?? "round_robin");
  const [priority, setPriority] = React.useState<string>(policy?.priority ?? "earliest_created");
  const [linked, setLinked] = React.useState<number[]>(policy?.inboxes ?? []);
  const available = inboxes.filter((i) => !linked.includes(i.id));

  return (
    <FormShell
      title={policy ? "Edit assignment policy" : "Create assignment policy"}
      backHref="/dashboard/settings/assignment-policy/assignment"
      submit={policy ? "Update policy" : "Create policy"}
    >
      <Section title="Policy details">
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="p-name">Policy name:</FieldLabel>
            <Input id="p-name" placeholder="Enter policy name" defaultValue={policy?.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="p-desc">Description:</FieldLabel>
            <Input id="p-desc" placeholder="Enter description" defaultValue={policy?.description} />
          </Field>
          <div className="flex items-center gap-3">
            <FieldLabel htmlFor="p-status">Status:</FieldLabel>
            <Switch id="p-status" checked={active} onCheckedChange={setActive} />
            <span className="text-muted-foreground text-sm">{active ? "Policy is active" : "Policy is inactive"}</span>
          </div>
        </div>
      </Section>
      <Section title="Assignment order">
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
      </Section>
      <Section title="Assignment priority">
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
      </Section>
      <Section
        title="Fair distribution policy"
        description="Cap conversations per agent within a time window to avoid overload. Defaults to 100 per hour."
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Assign max</span>
          <Input type="number" defaultValue={policy?.maxPerAgent ?? 100} className="h-8 w-20" />
          <span>Conversations per agent in every</span>
          <Input type="number" defaultValue={policy?.window ?? 60} className="h-8 w-20" />
          <NativeSelect size="sm" defaultValue="minutes">
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </NativeSelect>
        </div>
      </Section>
      <Section
        title="Skip stale conversations"
        description="Skip unassigned conversations older than this. Defaults to 7 days; clear to disable."
      >
        <div className="flex items-center gap-2 text-sm">
          <Input type="number" defaultValue={policy?.staleDays ?? 7} className="h-8 w-20" />
          <span className="text-muted-foreground">days</span>
        </div>
      </Section>
      <Section
        title="Added inboxes"
        description="Add inboxes for which this policy will be applicable."
        action={
          <NativeSelect
            size="sm"
            value=""
            onChange={(e) => e.target.value && setLinked((prev) => [...prev, Number(e.target.value)])}
            aria-label="Add inbox"
          >
            <option value="">Add inbox</option>
            {available.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </NativeSelect>
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
                      <Icon className="size-4 text-muted-foreground" />
                      {inbox.name}
                      <span className="text-muted-foreground text-xs">{channel.name}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove"
                      onClick={() => setLinked((prev) => prev.filter((x) => x !== inbox.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground text-sm">
            <Plus className="size-4" />
            No inboxes added to this policy, add an inbox to get started
          </div>
        )}
        <FieldDescription>One policy per inbox.</FieldDescription>
      </Section>
    </FormShell>
  );
}

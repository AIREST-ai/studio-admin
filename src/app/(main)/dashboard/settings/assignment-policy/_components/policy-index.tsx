"use client";
import Link from "next/link";

import { ArrowRight, Check, FlaskConical, Gauge, Shuffle } from "lucide-react";

import { Card } from "@/components/ui/card";

import { PageHeader } from "../../labels/_shared/settings-shell";
import { useAssignmentPolicies, useCapacityPolicies } from "./policies-store";
import { POLICY_HOME } from "./policy-ui";

const options = [
  {
    href: "/dashboard/settings/assignment-policy/assignment",
    icon: Shuffle,
    title: "Assignment policy",
    description: "Manage how conversations get assigned in inboxes.",
    features: [
      "Assign by conversations evenly or by available capacity",
      "Add fair distribution rules to avoid overloading any agent",
      "Add inboxes to a policy - one policy per inbox",
    ],
  },
  {
    href: "/dashboard/settings/assignment-policy/capacity",
    icon: Gauge,
    title: "Agent capacity policy",
    description: "Manage workload for agents.",
    features: [
      "Define maximum conversations per inbox",
      "Create exceptions based on labels and time",
      "Add agents to a policy - one policy per agent",
    ],
  },
];

export function PolicyIndex() {
  const counts = [useAssignmentPolicies().length, useCapacityPolicies().length];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Agent Assignment"
        description="Define policies to effectively manage workload and route conversations based on the needs of inboxes and agents."
        learnMore="Learn more here"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((option, index) => {
          const Icon = option.icon;
          const count = counts[index];
          return (
            <Card key={option.href} className="p-0 transition-colors hover:border-primary/50">
              <Link href={option.href} className="group flex h-full flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-10 place-items-center rounded-lg border bg-muted/50">
                    <Icon className="size-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="grid gap-1">
                  <h2 className="flex items-center gap-2 font-medium text-lg">
                    {option.title}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-normal text-muted-foreground text-xs tabular-nums">
                      {count} {count === 1 ? "policy" : "policies"}
                    </span>
                  </h2>
                  <p className="text-muted-foreground text-sm">{option.description}</p>
                </div>
                <ul className="grid gap-2 border-t pt-4 text-sm">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </Link>
            </Card>
          );
        })}
      </div>
      {/* T-70: dry run of the policies above on fixed sample conversations. */}
      <Card className="p-0 transition-colors hover:border-primary/50">
        <Link href={`${POLICY_HOME}/trial`} className="group flex items-center gap-4 p-4" data-trial-link>
          <div className="grid size-10 place-items-center rounded-lg border bg-muted/50">
            <FlaskConical className="size-5 text-muted-foreground group-hover:text-primary" />
          </div>
          <div className="grid flex-1 gap-0.5">
            <h2 className="font-medium">Trial assignment</h2>
            <p className="text-muted-foreground text-sm">
              See who these policies would assign sample conversations to. Nothing is assigned in Inbox.
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Card>
    </div>
  );
}

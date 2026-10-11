import Link from "next/link";

import { ArrowRight, Check, Gauge, Shuffle } from "lucide-react";

import { Card } from "@/components/ui/card";

import { SettingsHeader } from "../../inboxes/_components/settings-ui";

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
  return (
    <Card className="gap-0 py-0">
      <SettingsHeader
        title="Agent assignment"
        description="Define policies to effectively manage workload and route conversations based on the needs of inboxes and agents."
        linkText="Learn more here"
      />
      <div className="grid gap-4 p-6 md:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <Link
              key={option.href}
              href={option.href}
              className="group flex flex-col gap-4 rounded-xl border p-5 transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-10 place-items-center rounded-lg border bg-muted/50">
                  <Icon className="size-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="grid gap-1">
                <h2 className="font-medium text-base">{option.title}</h2>
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
          );
        })}
      </div>
    </Card>
  );
}

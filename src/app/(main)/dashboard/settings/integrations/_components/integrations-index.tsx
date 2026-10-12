"use client";
// Chatwoot settings/integrations/Index.vue + IntegrationItem.vue in the Studio pattern: big title and line
// outside the card, line tabs with counts, search in the card header, app cards inside the card.
import * as React from "react";

import Link from "next/link";

import { MoreHorizontal, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { NoResults, SettingsShell } from "../../labels/_shared/settings-shell";
import { integrations } from "./data";
import { EnabledBadge, IntegrationMark } from "./integration-ui";

type View = "all" | "enabled" | "disabled";

const views: { value: View; label: string; match: (enabled: boolean) => boolean }[] = [
  { value: "all", label: "All integrations", match: () => true },
  { value: "enabled", label: "Enabled", match: (e) => e },
  { value: "disabled", label: "Disabled", match: (e) => !e },
];

export function IntegrationsIndex() {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<View>("all");
  const q = query.trim().toLowerCase();
  const match = views.find((v) => v.value === view)?.match ?? (() => true);
  const rows = integrations.filter(
    (i) =>
      match(i.enabled) && (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
  );

  return (
    <SettingsShell
      title="Integrations"
      description="Weblabs Studio integrates with multiple tools and services to improve your team's efficiency. Explore the list below to configure your favorite apps."
      learnMore="Learn more about integrations"
      tabs={{
        value: view,
        onValueChange: (v) => setView(v as View),
        items: views.map((v) => ({
          value: v.value,
          label: v.label,
          count: integrations.filter((i) => v.match(i.enabled)).length,
        })),
      }}
      cardTitle="Applications"
      cardDescription="Connect your favourite tools and services to this account."
      count={`${rows.length} ${rows.length === 1 ? "integration" : "integrations"}`}
      search={{ placeholder: "Search integrations...", value: query, onChange: setQuery }}
    >
      {rows.length ? (
        <div className="grid grid-cols-1 gap-4 px-6 py-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <IntegrationMark item={item} />
                <div className="flex items-center gap-1">
                  <EnabledBadge enabled={item.enabled} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Open actions for ${item.name}`}
                        className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                        size="icon-sm"
                        variant="ghost"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={item.href}>
                          <Settings /> Configure
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="https://www.chatwoot.com/hc/user-guide/en" target="_blank" rel="noreferrer">
                          Learn more
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Link href={item.href} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <Button variant="link" size="xs" className="px-0" asChild>
                    <Link href={item.href}>
                      <Settings /> Configure
                    </Link>
                  </Button>
                </div>
                <p className="line-clamp-4 text-muted-foreground text-sm">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <NoResults>No integrations found matching your search</NoResults>
      )}
    </SettingsShell>
  );
}

"use client";
// Settings home in the Studio pattern: big title and description outside, then one card per settings group with a
// row per page (icon, name, one line). Chatwoot itself opens Account Settings at /settings; this page lists them all.
import * as React from "react";

import Link from "next/link";

import { ChevronRight, Search } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

import { PageHeader } from "../labels/_shared/settings-shell";
import { settingsGroups } from "./settings-nav";

export function SettingsIndex() {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const groups = settingsGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !q || item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
      ),
    }))
    .filter((group) => group.items.length);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        description="Manage your account, channels, team and the rules your conversations follow."
        actions={
          <InputGroup className="h-8 w-full md:w-72">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-8"
              type="search"
              placeholder="Search settings..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        }
      />
      {groups.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.label} className="gap-0 pb-0">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl leading-none">{group.label}</CardTitle>
                <CardDescription>
                  {group.items.length} {group.items.length === 1 ? "page" : "pages"}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <ul className="divide-y">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.url}>
                        <Link
                          href={item.url}
                          className="group flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-muted/40"
                        >
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/50">
                            <Icon className="size-4 text-muted-foreground group-hover:text-foreground" />
                          </div>
                          <div className="grid min-w-0 flex-1 gap-0.5">
                            <span className="font-medium text-sm">{item.title}</span>
                            <span className="truncate text-muted-foreground text-xs">{item.description}</span>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground text-sm">
            No settings match your search
          </CardContent>
        </Card>
      )}
    </div>
  );
}

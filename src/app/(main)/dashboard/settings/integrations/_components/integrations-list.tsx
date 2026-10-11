"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { ExternalLink, Search, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

import { integrations } from "./data";

export function IntegrationsList() {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const rows = q
    ? integrations.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    : integrations;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid max-w-2xl gap-1.5">
          <h1 className="font-semibold text-xl">Integrations</h1>
          <p className="text-muted-foreground text-sm">
            Chatwoot integrates with multiple tools and services to improve your team's efficiency. Explore the list
            below to configure your favorite apps.
          </p>
          <Button variant="link" size="sm" className="h-auto w-fit px-0">
            Learn more about integrations <ExternalLink />
          </Button>
        </div>
        <InputGroup className="h-8 w-full md:w-72">
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search integrations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
      </div>

      {rows.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <Card key={item.id} className="gap-3">
              <CardHeader className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-md border font-semibold text-sm shadow-xs",
                    item.tone,
                  )}
                >
                  {item.mark}
                </div>
                <Badge
                  variant={item.enabled ? "secondary" : "outline"}
                  className={cn(
                    "font-normal",
                    item.enabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "text-muted-foreground",
                  )}
                >
                  {item.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <Button variant="link" size="xs" className="px-0" asChild>
                    <Link href={item.href}>
                      <Settings /> Configure
                    </Link>
                  </Button>
                </div>
                <p className="line-clamp-4 text-muted-foreground text-sm">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-muted-foreground">No integrations found matching your search</div>
      )}
    </div>
  );
}

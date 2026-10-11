"use client";
import * as React from "react";

import { cn } from "cn";
import { Lightbulb, Search, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";

import { exampleScenarios, scenarios } from "./data";
import { ScenarioDialog } from "./dialogs";
import { CaptainCardHeader } from "./shared";

export function ScenariosList() {
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [enabled, setEnabled] = React.useState<Record<number, boolean>>(
    Object.fromEntries(scenarios.map((s) => [s.id, s.enabled])),
  );
  const rows = scenarios.filter((s) => !query || s.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Card>
        <CaptainCardHeader
          title="Scenarios"
          description="Give your assistant some context—like “what to do when a user is stuck,” or “how to act during a refund request.”"
        >
          <Button size="sm" onClick={() => setCreating(true)}>
            Add a scenario
          </Button>
        </CaptainCardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 rounded-xl border border-dashed bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-medium text-sm">
                <Lightbulb className="size-4 text-amber-500" /> Example scenarios
              </span>
              <Button variant="ghost" size="sm">
                Add all
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {exampleScenarios.map((e) => (
                <div key={e.title} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                  <div className="grid flex-1 gap-0.5">
                    <span className="font-medium text-sm">{e.title}</span>
                    <span className="text-muted-foreground text-xs">{e.description}</span>
                  </div>
                  <Button variant="outline" size="xs">
                    Add this
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <InputGroup className="h-8 md:w-72">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </InputGroup>

          {rows.length ? (
            <div className="grid gap-3">
              {rows.map((s) => (
                <div key={s.id} className={cn("grid gap-3 rounded-xl border p-4", !enabled[s.id] && "bg-muted/30")}>
                  <div className="flex items-start gap-3">
                    <div className="grid flex-1 gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.title}</span>
                        <Badge variant={enabled[s.id] ? "secondary" : "outline"} className="font-normal">
                          {enabled[s.id] ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground text-sm">{s.description}</span>
                    </div>
                    <Switch
                      checked={enabled[s.id]}
                      aria-label={`Toggle ${s.title}`}
                      onCheckedChange={(v) => setEnabled((p) => ({ ...p, [s.id]: v }))}
                    />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <span className="mb-1 block font-medium text-muted-foreground text-xs">How to handle</span>
                    {s.instruction}
                  </div>
                  {s.tools.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                      Tools used :
                      {s.tools.map((t) => (
                        <Badge key={t} variant="outline" className="gap-1 font-normal">
                          <Wrench className="size-3" /> {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border py-10 text-center text-muted-foreground text-sm">
              No scenarios found for this search.
            </div>
          )}
        </CardContent>
      </Card>
      <ScenarioDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

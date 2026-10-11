"use client";
import * as React from "react";

import Link from "next/link";

import { Settings, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { agents } from "../../inboxes/_components/data";
import { AgentAvatar, ConfirmDeleteDialog, SettingsHeader } from "../../inboxes/_components/settings-ui";
import { type Team, teams } from "./data";

export function TeamsList() {
  const [query, setQuery] = React.useState("");
  const [toDelete, setToDelete] = React.useState<Team | null>(null);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? teams.filter((t) => [t.name, t.description].some((v) => v.toLowerCase().includes(q))) : teams;
  }, [query]);

  return (
    <>
      <Card className="gap-0 py-0">
        <SettingsHeader
          title="Teams"
          description="Teams allow you to organize agents into groups based on their responsibilities. An agent can belong to multiple teams. When working collaboratively, you can assign conversations to specific teams."
          linkText="Learn more about teams"
          search={query}
          onSearch={setQuery}
          searchPlaceholder="Search teams..."
          count={`${teams.length} teams`}
          actions={
            <Button size="sm" asChild>
              <Link href="/dashboard/settings/teams/new">Create new team</Link>
            </Button>
          }
        />
        {rows.length ? (
          <div className="divide-y px-6">
            {rows.map((team) => {
              const members = agents.filter((a) => team.members.includes(a.id));
              return (
                <div key={team.id} className="flex items-start justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl border text-lg">{team.icon}</div>
                    <div className="grid min-w-0 gap-1">
                      <span className="font-medium">{team.name}</span>
                      <p className="text-muted-foreground text-sm">{team.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex -space-x-1">
                          {members.map((m) => (
                            <AgentAvatar key={m.id} id={m.id} name={m.name} className="size-7 ring-2 ring-card" />
                          ))}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {members.length} {members.length === 1 ? "agent" : "agents"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon-sm" aria-label="Settings" asChild>
                          <Link href={`/dashboard/settings/teams/${team.id}`}>
                            <Settings />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Settings</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Delete"
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setToDelete(team)}
                        >
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-muted-foreground">No teams found matching your search</div>
        )}
      </Card>

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Are you sure you want to delete the team?"
        message="Deleting the team will remove the team assignment from the conversations assigned to this team."
        confirmValue={toDelete?.name ?? ""}
        placeholder={`Please type ${toDelete?.name ?? ""} to confirm`}
        confirmText={`Delete ${toDelete?.name ?? ""}`}
        rejectText="Cancel"
      />
    </>
  );
}

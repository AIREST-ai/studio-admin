"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { MessageSquare, MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useAgentRoster } from "../../inboxes/_components/inboxes-store";
import { AgentAvatar, ConfirmDeleteDialog } from "../../inboxes/_components/settings-ui";
import { NoResults, SettingsShell } from "../../labels/_shared/settings-shell";
import { openConversations, type Team } from "./data";
import { deleteTeamWithNotice, useTeams } from "./teams-store";

// Tabs from Chatwoot's "Allow auto assign for this team" setting.
type TeamView = "all" | "auto" | "manual";
const teamViews: Record<TeamView, { label: string; match: (team: Team) => boolean }> = {
  all: { label: "All teams", match: () => true },
  auto: { label: "Auto assign on", match: (team) => team.autoAssign },
  manual: { label: "Auto assign off", match: (team) => !team.autoAssign },
};

export function TeamsList() {
  const agents = useAgentRoster(); // F-6B: a team's agents count an invited agent too
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<TeamView>("all");
  const [toDelete, setToDelete] = React.useState<Team | null>(null);
  const teams = useTeams();

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter(
      (t) => teamViews[view].match(t) && (!q || [t.name, t.description].some((v) => v.toLowerCase().includes(q))),
    );
  }, [query, view, teams]);

  return (
    <>
      <SettingsShell
        title="Teams"
        description="Teams allow you to organize agents into groups based on their responsibilities. An agent can belong to multiple teams. When working collaboratively, you can assign conversations to specific teams."
        learnMore="Learn more about teams"
        count={`${rows.length} ${rows.length === 1 ? "team" : "teams"}`}
        search={{ placeholder: "Search teams...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard/settings/teams/new">
              <Plus /> Create new team
            </Link>
          </Button>
        }
        tabs={{
          value: view,
          onValueChange: (v) => setView(v as TeamView),
          items: (Object.keys(teamViews) as TeamView[]).map((key) => ({
            value: key,
            label: teamViews[key].label,
            count: teams.filter(teamViews[key].match).length,
          })),
        }}
        cardDescription="Groups of agents you can assign conversations to."
      >
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Team</TableHead>
                <TableHead className="py-3 font-normal">Agents</TableHead>
                <TableHead className="py-3 font-normal">Open conversations</TableHead>
                <TableHead className="py-3 font-normal">Auto assign</TableHead>
                <TableHead className="w-16 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((team) => {
                const members = agents.filter((a) => team.members.includes(a.id));
                return (
                  <TableRow key={team.id} className="border-border/60">
                    <TableCell className="py-3.5 whitespace-normal">
                      <Link href={`/dashboard/settings/teams/${team.id}`} className="flex min-w-0 items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg border text-base">
                          {team.icon}
                        </div>
                        <div className="grid min-w-0 gap-0.5">
                          <span className="font-medium">{team.name}</span>
                          <span className="text-muted-foreground text-xs">{team.description}</span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {members.map((m) => (
                            <AgentAvatar key={m.id} id={m.id} name={m.name} className="size-7 ring-2 ring-card" />
                          ))}
                        </div>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {members.length} {members.length === 1 ? "agent" : "agents"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Link
                        href={`/dashboard/chat/teams/${team.slug}`}
                        className="inline-flex items-center gap-1.5 tabular-nums hover:underline"
                      >
                        <MessageSquare className="size-3.5 text-muted-foreground" />
                        {openConversations(team).length}
                      </Link>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 border px-2 py-1 font-medium",
                          team.autoAssign
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-muted/50 text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            team.autoAssign ? "bg-emerald-500" : "bg-muted-foreground",
                          )}
                        />
                        {team.autoAssign ? "On" : "Off"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Team actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/settings/teams/${team.id}`}>
                              <Settings /> Edit team
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/chat/teams/${team.slug}`}>
                              <MessageSquare /> View conversations
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(team)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {teams.length ? "No teams found matching your search" : "There are no teams created on this account."}
          </NoResults>
        )}
      </SettingsShell>

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete team"
        message="Deleting the team will remove the team assignment from the conversations assigned to this team."
        confirmValue={toDelete?.name ?? ""}
        onConfirm={() => {
          if (toDelete) void deleteTeamWithNotice(toDelete);
        }}
      />
    </>
  );
}

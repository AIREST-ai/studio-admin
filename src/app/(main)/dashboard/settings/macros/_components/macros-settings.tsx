"use client";
import * as React from "react";

import Link from "next/link";

import { Globe, Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { type Macro, macros } from "./data";

function Person({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function MacrosSettings() {
  const [query, setQuery] = React.useState("");
  const [deleting, setDeleting] = React.useState<Macro | undefined>();

  const q = query.trim().toLowerCase();
  const rows = macros.filter((m) => m.name.toLowerCase().includes(q));

  return (
    <>
      <SettingsShell
        title="Macros"
        description="A macro is a set of saved actions that help customer service agents easily complete tasks. The agents can define a set of actions like tagging a conversation with a label, sending an email transcript, updating a custom attribute, etc., and they can run these actions in a single click."
        learnMore="Learn more about macros"
        count={plural(rows.length, "macro", "macros")}
        search={{ placeholder: "Search macros...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard/settings/macros/new">
              <Plus /> Add a new macro
            </Link>
          </Button>
        }
      >
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="py-3 font-normal">Created by</TableHead>
                <TableHead className="py-3 font-normal">Last updated by</TableHead>
                <TableHead className="py-3 font-normal">Visibility</TableHead>
                <TableHead className="w-28 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id} className="border-border/60">
                  <TableCell className="py-3.5">
                    <div className="grid gap-0.5">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {plural(m.actions.length, "action", "actions")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Person name={m.createdBy} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Person name={m.updatedBy} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className="font-normal">
                      {m.visibility === "Public" ? <Globe /> : <Lock />}
                      {m.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Edit macro" asChild>
                            <Link href={`/dashboard/settings/macros/new?id=${m.id}`}>
                              <Pencil />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit macro</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete macro"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleting(m)}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete macro</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>No macros found matching your search</NoResults>
        )}
      </SettingsShell>

      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm Deletion"
        message={`Are you sure to delete ${deleting?.name ?? ""}?`}
        yes="Yes, Delete"
        no="No"
      />
    </>
  );
}

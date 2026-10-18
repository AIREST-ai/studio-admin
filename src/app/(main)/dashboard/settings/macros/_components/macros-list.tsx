"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Macros list (macros/Index.vue, MacrosTableRow.vue) in the Studio pattern.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Globe, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageMacro, visibleMacros } from "@/lib/cw/macro-visibility";
import { CHANGED_ELSEWHERE, setCwList, useCwShared } from "@/lib/cw/store";
import { useViewer } from "@/lib/cw/view-as";
import { getInitials } from "@/lib/utils";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, RowMenu, ToneBadge, tableClass } from "../../labels/_shared/settings-ui";
import type { Macro } from "./data";
import { macrosStore, notSavedReason, saveMacrosChange, useMacros } from "./macros-store";

// F159: each agent's own initials colour, as in the conversations and Settings > Teams.
function Person({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar className={cn("size-6 font-medium", personToneClass(name))}>
        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

// Tabs from the macro visibility of Chatwoot (Public: every agent, Private: only its creator).
type MacroView = "all" | "public" | "private";
const macroViews: Record<MacroView, { label: string; match: (m: Macro) => boolean }> = {
  all: { label: "All macros", match: () => true },
  public: { label: "Public", match: (m) => m.visibility === "Public" },
  private: { label: "Private", match: (m) => m.visibility === "Private" },
};

/**
 * F-24 (F-19's note): "Macro deleted successfully" only after the preview server saved the deletion. Until then a
 * toast says it is deleting; when it was not saved the macro comes back to the list and the toast says
 * "Not saved (reason)".
 */
function deleteMacro(macro: Macro) {
  const toastId = `macro-delete-${macro.id}-${Date.now()}`;
  toast.loading(`Deleting “${macro.name}”…`, { id: toastId });
  const index = macrosStore.get().findIndex((m) => m.id === macro.id);
  saveMacrosChange(
    () => macrosStore.remove(macro.id),
    // Put it back where it was, unless it is already back (a newer change on this page).
    () =>
      setCwList("macros", (list) => {
        if (list.some((m) => m.id === macro.id)) return list;
        const next = [...list];
        next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, macro);
        return next;
      }),
  ).then(
    () => toast.success("Macro deleted successfully", { id: toastId }),
    (error: unknown) => {
      // A 409 already said "Not saved: changed in another tab or device" (lib/cw/store.ts).
      if (error instanceof Error && error.message === CHANGED_ELSEWHERE) toast.dismiss(toastId);
      else
        toast.error(`Not saved (${notSavedReason(error)})`, {
          id: toastId,
          description: `“${macro.name}” was not deleted. It is back in the list.`,
        });
    },
  );
}

export function MacrosList() {
  const router = useRouter();
  // F-24 (F-19's note): a private macro shows to its creator only, also when the page is viewed as another agent
  // (Chatwoot v4.18.0 Macro.with_visibility; lib/cw/macro-visibility.ts).
  const viewer = useViewer();
  const agents = useCwShared((state) => state.agents);
  const saved = useMacros();
  const macros = visibleMacros(saved, viewer, agents);
  const [view, setView] = React.useState<MacroView>("all");
  const [query, setQuery] = React.useState("");
  const [creator, setCreator] = React.useState("All");
  const [deleting, setDeleting] = React.useState<Macro | undefined>();

  const q = query.trim().toLowerCase();
  const creators = Array.from(new Set(macros.map((m) => m.createdBy)));
  const rows = macros.filter(
    (m) =>
      macroViews[view].match(m) && (creator === "All" || m.createdBy === creator) && m.name.toLowerCase().includes(q),
  );

  return (
    <>
      <SettingsShell
        title="Macros"
        description="A macro is a set of saved actions that help customer service agents easily complete tasks. The agents can define a set of actions like tagging a conversation with a label, sending an email transcript, updating a custom attribute, etc., and they can run these actions in a single click."
        learnMore="Learn more about macros"
        count={plural(rows.length, "macro", "macros")}
        search={{ placeholder: "Search macros...", value: query, onChange: setQuery }}
        tabs={{
          value: view,
          onValueChange: (v) => setView(v as MacroView),
          items: (Object.keys(macroViews) as MacroView[]).map((key) => ({
            value: key,
            label: macroViews[key].label,
            count: macros.filter(macroViews[key].match).length,
          })),
        }}
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard/settings/macros/new">
              <Plus /> Add a new macro
            </Link>
          </Button>
        }
      >
        <ChipBar>
          <ChipSelect label="Created by" value={creator} options={["All", ...creators]} onChange={setCreator} />
        </ChipBar>
        {rows.length ? (
          <Table
            className={cn(
              tableClass,
              "max-xl:**:data-[slot='table-cell']:px-4 max-xl:**:data-[slot='table-head']:px-4",
            )}
          >
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="py-3 font-normal">Created by</TableHead>
                <TableHead className="py-3 font-normal">Last updated by</TableHead>
                <TableHead className="py-3 font-normal">Visibility</TableHead>
                <TableHead className="sticky right-0 w-20 bg-card py-3 text-right font-normal shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((macro) => {
                const editable = canManageMacro(macro, viewer, agents);
                return (
                  <TableRow key={macro.id} className="border-border/60">
                    <TableCell className="py-3.5">
                      {editable ? (
                        <Link
                          href={`/dashboard/settings/macros/${macro.id}/edit`}
                          className="grid gap-0.5 hover:underline"
                        >
                          <span className="font-medium">{macro.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {plural(macro.actions.length, "action", "actions")}
                          </span>
                        </Link>
                      ) : (
                        <div className="grid gap-0.5">
                          <span className="font-medium">{macro.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {plural(macro.actions.length, "action", "actions")}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Person name={macro.createdBy} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Person name={macro.updatedBy} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      {macro.visibility === "Public" ? (
                        <ToneBadge tone="sky" dot={false}>
                          <Globe className="size-3" /> Public
                        </ToneBadge>
                      ) : (
                        <ToneBadge tone="gray" dot={false}>
                          <Lock className="size-3" /> Private
                        </ToneBadge>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card py-3.5 text-right shadow-[inset_1px_0_0_var(--border),-6px_0_6px_-6px_rgb(0_0_0/0.45)]">
                      {editable ? (
                        <RowMenu
                          name={macro.name}
                          items={[
                            {
                              label: "Edit macro",
                              icon: Pencil,
                              onSelect: () => router.push(`/dashboard/settings/macros/${macro.id}/edit`),
                            },
                            {
                              label: "Delete macro",
                              icon: Trash2,
                              destructive: true,
                              separatorBefore: true,
                              onSelect: () => setDeleting(macro),
                            },
                          ]}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs" data-macro-readonly="">
                          Admin only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <NoResults>{q || creator !== "All" ? "No macros found matching your search" : "No macros found"}</NoResults>
        )}
      </SettingsShell>

      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Delete macro"
        message={`Are you sure to delete ${deleting?.name ?? ""}?`}
        yes="Yes, Delete"
        no="No"
        onConfirm={() => {
          if (deleting) deleteMacro(deleting);
        }}
      />
    </>
  );
}

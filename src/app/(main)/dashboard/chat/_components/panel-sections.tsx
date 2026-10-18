"use client";

// Contact panel sections that follow Chatwoot v4.18 closely:
// - ContactNotes (routes/dashboard/conversation/contact/ContactNotes.vue + components-next ContactNoteItem.vue):
//   "Add contact note" opens a dialog, notes read "<name> wrote <time>", long notes collapse, delete on hover.
// - MacrosList (Macros/List.vue, MacroItem.vue, MacroPreview.vue): drag to reorder, info button opens the preview
//   timeline, play button runs the macro.
import { type DragEvent, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import { ChevronDown, ChevronUp, GripVertical, Info, Play, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVisibleMacros } from "@/lib/cw/macro-visibility";

import { type Conversation, currentUser, initialContactNotes, useLiveTeams } from "./cw-data";
import { macroTeam } from "./cw-dialog-store";
import { openDialog, runMacro } from "./cw-dialogs";
import { cw, useCwStore } from "./cw-store";
import { AgentAvatar } from "./cw-ui";
import { previewOnly } from "./panel-attributes";
import { applyOrder, moveKey, usePanelSetting } from "./panel-settings";

function NoteItem({
  note,
  onDelete,
}: {
  note: { id: number; author: string; time: string; text: string };
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = note.text.length > 180;
  const you = note.author === currentUser.name;
  return (
    <div className="group/note flex flex-col gap-1.5 border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <AgentAvatar name={note.author} size="sm" className="size-4" />
          <span className="min-w-0 truncate text-muted-foreground">
            <span className="font-medium text-foreground">{you ? "You" : note.author}</span> wrote{" "}
            <span className="font-medium text-foreground">{note.time}</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete note"
          className="text-destructive opacity-0 hover:text-destructive group-hover/note:opacity-100 focus-visible:opacity-100"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <p className={cn("whitespace-pre-line text-sm leading-relaxed", long && !expanded && "line-clamp-4")}>
        {note.text}
      </p>
      {long && (
        <Button variant="ghost" size="xs" className="w-fit text-primary" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
          {expanded ? "Collapse" : "Expand"}
        </Button>
      )}
    </div>
  );
}

export function ContactNotes({ conversation }: { conversation: Conversation }) {
  const notes = useCwStore((s) => s.notes[conversation.id]) ?? initialContactNotes;
  return (
    <div className="flex flex-col">
      <Button
        variant="ghost"
        size="xs"
        className="w-fit"
        onClick={() => openDialog({ type: "contact-note", convId: conversation.id })}
      >
        <Plus /> Add contact note
      </Button>
      {notes.length > 0 ? (
        <div className="flex max-h-[300px] flex-col overflow-y-auto">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onDelete={() => {
                cw.deleteNote(conversation.id, note.id);
                previewOnly("Note deleted");
              }}
            />
          ))}
        </div>
      ) : (
        <p className="px-2 py-4 text-center text-muted-foreground text-sm leading-6">
          There are no notes yet. Use the Add note button to create one.
        </p>
      )}
    </div>
  );
}

function MacroPreview({ macroId }: { macroId: number }) {
  const teams = useLiveTeams(); // F-8: a missing team is marked below
  // F-19: the macro as Settings > Macros saved it (the one runMacro runs), not the sample copy.
  // F-24: only one the person the page is viewed as may see (a private macro is its creator's).
  const macro = useVisibleMacros().find((m) => m.id === macroId);
  if (!macro) return null;
  return (
    <div className="flex max-h-[22.5rem] flex-col overflow-y-auto">
      <h6 className="mb-3 font-medium text-sm">{macro.name}</h6>
      {macro.actions.map((action, index) => (
        <div key={`${action.action}-${action.value}`} className="relative ps-4 pb-2 last:pb-0">
          {index !== macro.actions.length - 1 && (
            <div className="absolute start-[3px] top-2 -bottom-1 w-px bg-border" />
          )}
          <div className="absolute start-0 top-1 size-2 rounded-full border-2 bg-background" />
          <p className="mb-0.5 text-muted-foreground text-xs">{action.action}</p>
          {action.value && <p className="text-sm">{action.value}</p>}
          {/* F-8 (sim3 8.14e): a team that does not exist is named; running the macro skips this action. */}
          {action.action === "Assign a Team" && macroTeam(action.value, teams).kind === "missing" && (
            <p className="text-destructive text-xs" data-macro-missing-team="">
              {`Team “${action.value.trim()}” does not exist. This action will be skipped.`}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function MacrosList({ conversation }: { conversation: Conversation }) {
  const [savedOrder, setSavedOrder] = usePanelSetting<string[]>("macros_order", []);
  const [dragKey, setDragKey] = useState<string | null>(null);
  // F-19 (F-8's note): the macros Settings > Macros saved (the shared list, lib/cw/store.ts), so a macro added there
  // shows here after a reload; it was the fixed sample list.
  // F-24 (F-19's note): without other people's private macros (Chatwoot Macro.with_visibility), also under View as.
  const macros = useVisibleMacros();
  const ordered = applyOrder(macros, (macro) => String(macro.id), savedOrder);

  if (ordered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 p-3 text-sm">
        <p>No macros found</p>
        <Button variant="outline" size="xs" asChild>
          <Link href="/dashboard/settings/macros">
            <Plus /> Add a new macro
          </Link>
        </Button>
      </div>
    );
  }

  const onDrop = (event: DragEvent, target: string) => {
    event.preventDefault();
    if (dragKey)
      setSavedOrder(
        moveKey(
          ordered.map((macro) => String(macro.id)),
          dragKey,
          target,
        ),
      );
    setDragKey(null);
  };

  return (
    <div className="flex flex-col">
      {ordered.map((macro) => {
        const key = String(macro.id);
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: drop target for mouse reordering of macros; the row is not a control
          <div
            key={macro.id}
            draggable
            onDragStart={(event) => {
              setDragKey(key);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => dragKey && event.preventDefault()}
            onDragEnd={() => setDragKey(null)}
            onDrop={(event) => onDrop(event, key)}
            className={cn(
              "group/macro relative flex h-10 cursor-grab items-center justify-between gap-2 rounded-md ps-4 pe-1 hover:bg-muted/50",
              dragKey === key && "opacity-50",
            )}
          >
            <GripVertical
              aria-hidden="true"
              className="absolute start-0.5 size-3 text-muted-foreground opacity-0 group-hover/macro:opacity-100"
            />
            <span className="truncate font-medium text-sm">{macro.name}</span>
            <div className="flex shrink-0 items-center gap-1">
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon-xs" aria-label="Preview Macro">
                        <Info />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="left">Preview Macro</TooltipContent>
                </Tooltip>
                <PopoverContent side="left" align="start" className="w-64">
                  <MacroPreview macroId={macro.id} />
                </PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Execute"
                    onClick={() => runMacro(macro.id, conversation.id)}
                  >
                    <Play />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Execute</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

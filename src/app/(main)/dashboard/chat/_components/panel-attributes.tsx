"use client";

// Chatwoot v4.18 CustomAttributes.vue + CustomAttribute.vue for the conversation sidebar: every attribute defined in
// Settings > Custom Attributes is listed ("---" when empty, the pencil adds a value), static rows can be mixed in
// (Conversation Information), the first 5 show until "Show all attributes", and rows can be dragged into another
// order while all are shown. Studio look: zebra rows, ghost icon buttons, shadcn inputs.
import { type DragEvent, type ReactNode, useState } from "react";

import { cn } from "cn";
import { format, isValid, parseISO } from "date-fns";
import { Check, ChevronDown, ChevronUp, Copy, GripVertical, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIMULATED } from "@/lib/cw/preview-sim";

import { applyOrder, moveKey, usePanelSetting } from "./panel-settings";
import { panelEditsSaving } from "./sim-panel-persist";

export type AttributeDef = { key: string; label: string; type: string; options?: readonly string[] };
export type StaticRow = { key: string; label: string; value: string; href?: string };

type AttrElement = ({ kind: "static" } & StaticRow) | ({ kind: "custom" } & AttributeDef);

// T-277 said "preview only, lost on refresh" (in Arabic). M129-A round 2 (Fahad 124.8, 129.2): the panel edits are
// now kept in the preview's saved copy (sim-panel-persist.ts) and come back after a reload, so the message says that,
// in English, and says plainly when this page could not load the saved copy and therefore does not save.
export const PREVIEW_ONLY = `${SIMULATED}: saved in this preview, not in the engine`;
export function previewOnly(what: string) {
  if (panelEditsSaving() === "off")
    toast.warning(what, {
      description: `${SIMULATED}: not saved, the preview's saved copy could not be loaded. Gone after a reload.`,
    });
  else toast.success(what, { description: `${PREVIEW_ONLY}.` });
}
// On plain http (the preview address) the browser gives no clipboard, so say it was not copied instead of "copied".
export function copyToClipboard(value: string) {
  if (!navigator.clipboard) {
    toast.error("Not copied: the browser allows copying only on a secure (https) page");
    return;
  }
  navigator.clipboard.writeText(value).then(
    () => toast.success("Copied to clipboard successfully"),
    () => toast.error("Not copied: the browser refused access to the clipboard"),
  );
}

// Dates are stored as ISO (yyyy-MM-dd) or as "Oct 3, 2026" in the mock data; both display as "Oct 3, 2026".
function toIsoDate(value: string): string {
  if (!value) return "";
  const iso = parseISO(value);
  if (isValid(iso)) return format(iso, "yyyy-MM-dd");
  const loose = new Date(value);
  return Number.isNaN(loose.getTime()) ? "" : format(loose, "yyyy-MM-dd");
}

function displayDate(value: string): string {
  const iso = toIsoDate(value);
  return iso ? format(parseISO(iso), "MMM d, yyyy") : value;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(def: AttributeDef, value: string): string | null {
  if (!value.trim()) return "Valid value is required";
  if (def.type === "Link" && !isValidUrl(value.trim())) return "Invalid URL";
  if (def.type === "Number" && Number.isNaN(Number(value))) return "Valid value is required";
  return null;
}

function HoverAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ListValue({ def, value, onPick }: { def: AttributeDef; value: string; onPick: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-full items-center justify-between gap-2 rounded-md border bg-background px-2 text-left text-sm hover:bg-muted/50"
        >
          <span className={value ? "truncate" : "truncate text-muted-foreground"}>{value || "Select value"}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Search value" />
          <CommandList>
            <CommandEmpty>No result found</CommandEmpty>
            <CommandGroup>
              {(def.options ?? []).map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onPick(option);
                    setOpen(false);
                  }}
                >
                  {option}
                  {value === option && <Check className="ms-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CustomAttributeRow({
  def,
  value,
  onSet,
}: {
  def: AttributeDef;
  value: string;
  onSet: (key: string, value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasValue = value !== "";

  const update = (next: string) => {
    onSet(def.key, next);
    previewOnly("Attribute updated");
  };
  const save = () => {
    const stored = def.type === "Date" ? toIsoDate(draft) || draft : draft.trim();
    const problem = validate(def, stored);
    if (problem) {
      setError(problem);
      return;
    }
    update(stored);
    setEditing(false);
    setError(null);
  };
  const startEdit = () => {
    setDraft(def.type === "Date" ? toIsoDate(value) : value);
    setError(null);
    setEditing(true);
  };

  return (
    <div className="group/attr flex flex-col gap-1">
      <div className="flex min-h-6 items-center gap-2">
        {def.type === "Checkbox" && (
          <Checkbox
            aria-label={def.label}
            checked={value === "true"}
            onCheckedChange={(checked) => update(checked ? "true" : "false")}
          />
        )}
        <span className={cn("min-w-0 flex-1 truncate font-medium text-sm", error && "text-destructive")}>
          {def.label}
        </span>
        {hasValue && (
          <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/attr:opacity-100">
            <HoverAction
              label="Delete attribute"
              onClick={() => {
                onSet(def.key, null);
                setEditing(false);
                previewOnly("Attribute deleted");
              }}
            >
              <Trash2 />
            </HoverAction>
          </span>
        )}
      </div>

      {def.type === "List" && <ListValue def={def} value={value} onPick={update} />}

      {def.type !== "Checkbox" &&
        def.type !== "List" &&
        (editing ? (
          <form
            className="flex flex-col gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="flex items-center">
              <Input
                autoFocus
                aria-label={def.label}
                aria-invalid={Boolean(error)}
                className="h-8 rounded-e-none"
                type={
                  def.type === "Link" ? "url" : def.type === "Number" ? "number" : def.type === "Date" ? "date" : "text"
                }
                value={draft}
                placeholder={def.type === "Link" ? "https://" : undefined}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setEditing(false);
                    setError(null);
                  }
                }}
              />
              <Button type="submit" size="icon-sm" className="h-8 rounded-s-none" aria-label="Save">
                <Check />
              </Button>
            </div>
            {error && <span className="text-destructive text-xs">{error}</span>}
          </form>
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            {def.type === "Link" && hasValue && isValidUrl(value) ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 break-all rounded-sm px-1 py-0.5 text-primary text-sm underline-offset-2 hover:underline group-hover/attr:bg-muted"
              >
                {value}
              </a>
            ) : (
              <p className="min-w-0 break-all rounded-sm px-1 py-0.5 text-sm group-hover/attr:bg-muted">
                {hasValue ? (def.type === "Date" ? displayDate(value) : value) : "---"}
              </p>
            )}
            <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/attr:opacity-100">
              {hasValue && (
                <HoverAction label="Copy attribute" onClick={() => copyToClipboard(value)}>
                  <Copy />
                </HoverAction>
              )}
              <HoverAction label="Edit attribute" onClick={startEdit}>
                <PenLine />
              </HoverAction>
            </span>
          </div>
        ))}
    </div>
  );
}

function StaticAttributeRow({ row }: { row: StaticRow }) {
  const missing = row.value === "Not Available";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-sm">{row.label}</span>
      {row.href && !missing ? (
        <a
          href={row.href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all px-1 text-primary text-sm underline-offset-2 hover:underline"
        >
          {row.value}
        </a>
      ) : (
        <span className={cn("break-words px-1 text-sm", missing && "text-muted-foreground")}>{row.value}</span>
      )}
    </div>
  );
}

export function CustomAttributes({
  defs,
  values,
  onSet,
  staticRows = [],
  attributeFrom,
  emptyStateMessage,
}: {
  defs: readonly AttributeDef[];
  values: Record<string, string>;
  onSet: (key: string, value: string | null) => void;
  staticRows?: StaticRow[];
  attributeFrom: string;
  emptyStateMessage?: string;
}) {
  const [savedOrder, setSavedOrder] = usePanelSetting<string[]>(`conversation_elements_order_${attributeFrom}`, []);
  const [showAll, setShowAll] = usePanelSetting<boolean>(`show_all_attributes_${attributeFrom}`, false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const all: AttrElement[] = [
    ...staticRows.map((row) => ({ kind: "static" as const, ...row })),
    ...defs.map((def) => ({ kind: "custom" as const, ...def })),
  ];
  const elements = applyOrder(all, (element) => element.key, savedOrder);
  const displayed = showAll || elements.length <= 5 ? elements : elements.slice(0, 5);
  const canDrag = showAll && elements.length > 1;

  const onDrop = (event: DragEvent, target: string) => {
    event.preventDefault();
    if (dragKey) {
      setSavedOrder(
        moveKey(
          elements.map((element) => element.key),
          dragKey,
          target,
        ),
      );
    }
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <div className="flex flex-col">
      <div className="overflow-hidden rounded-md border">
        {displayed.map((element) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: drop target for mouse reordering of attributes; the row is not a control
          <div
            key={element.key}
            draggable={canDrag}
            onDragStart={(event) => {
              setDragKey(element.key);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              if (!dragKey) return;
              event.preventDefault();
              setOverKey(element.key);
            }}
            onDragEnd={() => {
              setDragKey(null);
              setOverKey(null);
            }}
            onDrop={(event) => onDrop(event, element.key)}
            className={cn(
              "group/row relative border-b px-3 py-2 last:border-b-0 odd:bg-muted/30",
              canDrag && "cursor-grab",
              dragKey === element.key && "opacity-50",
              overKey === element.key && dragKey !== element.key && "ring-2 ring-primary/40 ring-inset",
            )}
          >
            {canDrag && (
              <GripVertical
                aria-hidden="true"
                className="absolute top-2.5 left-0.5 size-3 text-muted-foreground opacity-0 group-hover/row:opacity-100"
              />
            )}
            {element.kind === "static" ? (
              <StaticAttributeRow row={element} />
            ) : (
              <CustomAttributeRow def={element} value={values[element.key] ?? ""} onSet={onSet} />
            )}
          </div>
        ))}
      </div>
      {displayed.length === 0 && emptyStateMessage && (
        <p className="p-3 text-center text-muted-foreground text-sm">{emptyStateMessage}</p>
      )}
      {elements.length > 5 && (
        <Button variant="ghost" size="xs" className="mt-1.5 w-fit" onClick={() => setShowAll(!showAll)}>
          {showAll ? <ChevronUp /> : <ChevronDown />}
          {showAll ? "Show less attributes" : "Show all attributes"}
        </Button>
      )}
    </div>
  );
}

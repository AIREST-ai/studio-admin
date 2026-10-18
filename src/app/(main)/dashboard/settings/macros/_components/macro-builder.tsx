"use client";
// F159 settings-b: Chatwoot v4.18 macro editor (MacroEditor.vue, MacroForm.vue, MacroNodes.vue, MacroNode.vue,
// MacroProperties.vue, constants.js) as a full page in the Studio pattern: flow canvas left, properties right.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowDown, ArrowUp, CircleDot, CircleStop, GripVertical, Info, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canChoosePublicMacro, canManageMacro, canSeeMacro } from "@/lib/cw/macro-visibility";
import { addSavedSim, SIMULATED, type SimUpload, usePreviewSim } from "@/lib/cw/preview-sim";
import { downloadUpload, SimBadge } from "@/lib/cw/preview-sim-ui";
import { CHANGED_ELSEWHERE, useCwPersistence, useCwShared } from "@/lib/cw/store";
import { useViewer } from "@/lib/cw/view-as";

import { SettingsBreadcrumb } from "../../_components/settings-breadcrumb";
import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import { pickerNames, priorityNames } from "../../labels/_shared/settings-data";
import { PageHeader } from "../../labels/_shared/settings-shell";
import { FieldError, MultiPick } from "../../labels/_shared/settings-ui";
import { type Macro, type MacroAction, macroActionTypes } from "./data";
import { macrosStore, notSavedReason, saveMacrosChange } from "./macros-store";

type InputKind = "select" | "multi" | "email" | "url" | "attachment" | "textarea" | null;

// macros/constants.js MACRO_ACTION_TYPES inputType per action.
// F-6B: teams, agents and labels are the live shared lists (a team, agent or label added since the page loaded).
const actionInput: Record<string, { input: InputKind; options?: string[] }> = {
  "Assign a Team": {
    input: "select",
    get options() {
      return ["None", ...pickerNames().teams];
    },
  },
  "Assign an Agent": {
    input: "select",
    get options() {
      return ["None", "Self", ...pickerNames().agents];
    },
  },
  "Add a Label": {
    input: "multi",
    get options() {
      return pickerNames().labels;
    },
  },
  "Remove a Label": {
    input: "multi",
    get options() {
      return pickerNames().labels;
    },
  },
  "Remove Assigned Agent": { input: null },
  "Remove Assigned Team": { input: null },
  "Send an Email Transcript": { input: "email" },
  "Mute Conversation": { input: null },
  "Snooze Conversation": { input: null },
  "Resolve Conversation": { input: null },
  "Send Attachment": { input: "attachment" },
  "Send a Message": { input: "textarea" },
  "Add a Private Note": { input: "textarea" },
  "Change Priority": { input: "select", options: priorityNames },
  "Send Webhook Event": { input: "url" },
};

interface Node {
  uid: number;
  action: string;
  values: string[];
}

let uidSeed = 1;
const nextUid = () => uidSeed++;

function toNodes(actions: MacroAction[]): Node[] {
  return actions.map((a) => ({
    uid: nextUid(),
    action: a.action,
    values: a.value ? (actionInput[a.action]?.input === "multi" ? a.value.split(", ") : [a.value]) : [],
  }));
}

function nodeError(node: Node) {
  if (!actionInput[node.action]?.input) return "";
  return node.values.filter(Boolean).length ? "" : "Action parameters are required";
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// M129-A (Fahad 129.2, replaces T-281's disabled button): Chatwoot's AutomationFileInput.vue uploads the file the moment
// it is picked ("Uploading...", then "Successfully Uploaded" or "Upload Failed"). Here the file is saved on the preview
// machine (api/preview-sim/upload, with Chatwoot's attachment limits) and stays there after a reload; its name is the
// action's value, and the saved copy can be downloaded back.
function MacroAttachmentInput({
  value,
  invalid,
  onChange,
}: {
  value?: string;
  invalid: boolean;
  onChange: (name: string) => void;
}) {
  const uploads = usePreviewSim((s) => s.uploads);
  const saved = value ? uploads.findLast((upload) => upload.name === value) : undefined;
  const [state, setState] = React.useState<"idle" | "uploading" | "failed">("idle");
  const input = React.useRef<HTMLInputElement>(null);

  let buttonLabel = value ? "Replace attachment" : "Upload Attachment";
  if (state === "uploading") buttonLabel = "Uploading...";

  async function upload(file: File) {
    setState("uploading");
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/preview-sim/upload", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as (SimUpload & { error?: string }) | null;
      if (!response.ok || !body?.id) throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
      addSavedSim("uploads", { id: body.id, name: body.name, size: body.size, type: body.type, at: body.at });
      onChange(body.name);
      setState("idle");
      toast.success("Successfully Uploaded", {
        description: `${SIMULATED}: ${body.name} is saved in this preview, not in the engine.`,
      });
    } catch (error) {
      setState("failed");
      toast.error("Could not upload attachment, Please try again", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          hidden
          aria-label="Attachment file"
          data-macro-attachment-input=""
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-invalid={invalid}
          disabled={state === "uploading"}
          onClick={() => input.current?.click()}
        >
          <Paperclip /> {buttonLabel}
        </Button>
        <SimBadge />
        {state === "failed" && <span className="text-destructive text-xs">Upload Failed</span>}
      </div>
      {saved && (
        <button
          type="button"
          className="w-fit truncate text-left text-primary text-xs underline-offset-2 hover:underline"
          onClick={() => downloadUpload(saved.id, saved.name)}
        >
          {saved.name} ({formatSize(saved.size)}), saved in the preview
        </button>
      )}
      {value && !saved && <span className="truncate text-muted-foreground text-xs">{value}</span>}
      <span className="text-muted-foreground text-xs">
        Up to 40 MB. Images, video, audio, PDF, Office, text, CSV, JSON, XML and archives (the engine's attachment
        rules).
      </span>
    </div>
  );
}

function NodeValue({
  node,
  onChange,
  invalid,
}: {
  node: Node;
  onChange: (values: string[]) => void;
  invalid: boolean;
}) {
  const def = actionInput[node.action];
  useLivePickerNames(); // F-6B: draw again when the live teams, agents or labels change
  if (!def?.input) return null;
  if (def.input === "select") {
    // F-8 (sim3 8.14e): a saved team (or agent) that no longer exists is shown by its name and marked, instead of the
    // empty "Select" a value missing from the list showed. Running the macro skips that action and says so.
    const value = node.values[0] ?? "";
    const options = def.options ?? [];
    const missing = value !== "" && !options.some((o) => o.toLowerCase() === value.toLowerCase());
    const what = node.action === "Assign a Team" ? "team" : node.action === "Assign an Agent" ? "agent" : "value";
    return (
      <div className="grid gap-1.5">
        <NativeSelect
          className="w-full"
          aria-invalid={invalid || missing}
          value={value}
          onChange={(e) => onChange([e.target.value])}
        >
          <option value="" disabled>
            Select
          </option>
          {missing && (
            <option value={value} disabled>
              {`${value} (${what} not found)`}
            </option>
          )}
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
        {missing && (
          <p role="alert" className="text-destructive text-xs" data-macro-missing-value="">
            {`The ${what} “${value}” does not exist (it may have been deleted). When this macro runs, this action is skipped and the macro says so. Choose another ${what}${node.action === "Change Priority" ? "" : " or None"}.`}
          </p>
        )}
      </div>
    );
  }
  if (def.input === "multi")
    return <MultiPick options={def.options ?? []} value={node.values} onChange={onChange} invalid={invalid} />;
  if (def.input === "textarea")
    return (
      <Textarea
        rows={3}
        aria-invalid={invalid}
        placeholder="Enter your message here"
        value={node.values[0] ?? ""}
        onChange={(e) => onChange([e.target.value])}
      />
    );
  if (def.input === "attachment")
    return <MacroAttachmentInput value={node.values[0]} invalid={invalid} onChange={(name) => onChange([name])} />;
  return (
    <Input
      type={def.input === "email" ? "email" : "url"}
      aria-invalid={invalid}
      placeholder={def.input === "email" ? "Enter email" : "Enter URL"}
      value={node.values[0] ?? ""}
      onChange={(e) => onChange([e.target.value])}
    />
  );
}

function Connector({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="relative flex h-10 items-center justify-center">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      {onAdd ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Add new action"
              className="relative z-10 size-6 rounded-full bg-background"
              onClick={onAdd}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add new action</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

// The Radix trigger opens on pointerdown and calls preventDefault, which stops native HTML dragging (T-204).
// Keep its ref, ARIA and key handling, drop only that pointerdown; the menu opens on click instead.
const NativeGrip = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(function NativeGrip(
  { onPointerDown: _radixPointerDown, ...props },
  ref,
) {
  return <button type="button" ref={ref} {...props} />;
});

function FlowPill({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 font-medium text-muted-foreground text-xs">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

// F-24: an edit page opened directly (or reloaded) waits for the saved macros before it fills the form, so it neither
// says "Macro not found" for a macro that is saved nor opens with an empty form, and it checks the creator of the saved
// macro (a private macro opens for its creator only).
export function MacroBuilder({ macroId }: { macroId?: number }) {
  const status = useCwPersistence((state) => state.status);
  if (macroId && status === "loading")
    return (
      <div className="flex flex-col gap-4">
        <SettingsBreadcrumb
          items={[{ label: "Macros", href: "/dashboard/settings/macros" }, { label: "Edit macro" }]}
        />
        <p role="status" className="text-muted-foreground text-sm">
          Loading the saved macro…
        </p>
      </div>
    );
  return <MacroEditor macroId={macroId} />;
}

function MacroEditor({ macroId }: { macroId?: number }) {
  const router = useRouter();
  const viewer = useViewer();
  const agents = useCwShared((state) => state.agents);
  const found = macroId ? macrosStore.find(macroId) : undefined;
  // F-24: another person's private macro does not open (Chatwoot MacroPolicy#show?: global or its author).
  const existing = found && canSeeMacro(found, viewer, agents) ? found : undefined;
  // F-26 (judge F-24 note 1): Chatwoot MacroPolicy#update? allows only administrators to edit a Public macro, and
  // Macro#set_visibility forces `visibility = :personal if user.agent?`.
  const canChoosePublic = canChoosePublicMacro(viewer);
  const canEditExisting = existing ? canManageMacro(existing, viewer, agents) : true;
  const [name, setName] = React.useState(existing?.name ?? "");
  const [visibility, setVisibility] = React.useState<Macro["visibility"]>(
    existing ? existing.visibility : canChoosePublic ? "Public" : "Private",
  );
  React.useEffect(() => {
    if (!canChoosePublic && visibility === "Public") setVisibility("Private");
  }, [canChoosePublic, visibility]);
  const [nodes, setNodes] = React.useState<Node[]>(() =>
    existing ? toNodes(existing.actions) : [{ uid: nextUid(), action: "Assign a Team", values: [] }],
  );
  const [submitted, setSubmitted] = React.useState(false);
  // F-24: "saving" until the preview server answers; `saveError` is the reason it did not save.
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [menuFor, setMenuFor] = React.useState<number | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const dragFrom = React.useRef<number | null>(null);
  const grips = React.useRef(new Map<number, HTMLButtonElement>());
  const helpId = React.useId();
  const focusAfterMove = React.useRef<number | null>(null);

  // Back to the moved action's handle as soon as the new order is on screen, however the move was chosen.
  React.useLayoutEffect(() => {
    if (focusAfterMove.current === null) return;
    grips.current.get(focusAfterMove.current)?.focus();
    focusAfterMove.current = null;
  });

  if (macroId && !existing) {
    return (
      <div className="flex flex-col gap-4">
        <SettingsBreadcrumb
          items={[{ label: "Macros", href: "/dashboard/settings/macros" }, { label: "Macro not found" }]}
        />
        <PageHeader
          title="Macro not found"
          description={
            found
              ? "This macro is private: only the agent who created it can see it."
              : "This macro may have been deleted."
          }
        />
      </div>
    );
  }

  if (existing && !canEditExisting) {
    return (
      <div className="flex flex-col gap-4">
        <SettingsBreadcrumb
          items={[{ label: "Macros", href: "/dashboard/settings/macros" }, { label: existing.name }]}
        />
        <PageHeader
          title="Public macro (read-only for agents)"
          description="Only administrators can edit or delete a public macro. Agents can create and edit their own private macros."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings/macros">Back to Macros</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const nameError = name.trim() ? "" : "Name is required for creating a macro";
  const actionsError = nodes.length ? "" : "At least one action is required";

  const insertAt = (index: number) =>
    setNodes((prev) => [
      ...prev.slice(0, index),
      { uid: nextUid(), action: "Add a Label", values: [] },
      ...prev.slice(index),
    ]);
  const update = (uid: number, patch: Partial<Node>) =>
    setNodes((prev) => prev.map((n) => (n.uid === uid ? { ...n, ...patch } : n)));

  function move(source: number, target: number) {
    if (source === target) return;
    setNodes((prev) => {
      const from = prev.findIndex((n) => n.uid === source);
      const to = prev.findIndex((n) => n.uid === target);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function moveTo(target: number) {
    if (dragging !== null) move(dragging, target);
  }

  // Draft only: moves never save; the message says so for screen readers.
  const announce = (action: string, index: number) =>
    setAnnouncement(`${action} moved to position ${index + 1} of ${nodes.length}. Unsaved changes.`);

  function step(uid: number, delta: -1 | 1) {
    const from = nodes.findIndex((n) => n.uid === uid);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= nodes.length) return;
    move(uid, nodes[to].uid);
    announce(nodes[from].action, to);
    focusAfterMove.current = uid;
  }

  // F-24 (F-19's note): "added/updated successfully" only after the preview server saved the macro; until then the
  // button says "Saving…". When it was not saved the page stays here with the draft, says "Not saved (reason)", and the
  // list does not keep the unsaved change (macros-store.ts saveMacrosChange).
  // Creator and editor are the person the page is viewed as (Chatwoot macros_controller.rb: created_by_id and
  // updated_by_id are current_user), so a private macro made while viewing as an agent is that agent's.
  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (nameError || actionsError || nodes.some(nodeError)) {
      toast.error("Something went wrong. Please try again");
      return;
    }
    const effectiveVisibility: Macro["visibility"] = canChoosePublic ? visibility : "Private";
    const macro: Macro = {
      id: existing?.id ?? Date.now(),
      name: name.trim(),
      createdBy: existing?.createdBy ?? viewer.name,
      createdById: existing ? existing.createdById : viewer.id,
      updatedBy: viewer.name,
      visibility: effectiveVisibility,
      actions: nodes.map((n) => ({ action: n.action, value: n.values.join(", ") })),
    };
    const previous = existing;
    setSaving(true);
    setSaveError(null);
    try {
      await saveMacrosChange(
        () => macrosStore.save(macro),
        () => {
          // Take back only this page's change (not a newer one made meanwhile).
          if (macrosStore.find(macro.id) !== macro) return;
          if (previous) macrosStore.save(previous);
          else macrosStore.remove(macro.id);
        },
      );
    } catch (error) {
      const reason = notSavedReason(error);
      setSaveError(reason);
      setSaving(false);
      // A 409 already said "Not saved: changed in another tab or device" (lib/cw/store.ts); anything else is said here.
      if (!(error instanceof Error && error.message === CHANGED_ELSEWHERE))
        toast.error(`Not saved (${reason})`, {
          description: previous
            ? "The macro was not updated. Your changes are still on this page: try Save macro again."
            : "The macro was not added. Your draft is still on this page: try Save macro again.",
        });
      return;
    }
    toast.success(previous ? "Macro updated successfully" : "Macro added successfully");
    router.push("/dashboard/settings/macros");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* م137 round 2 (Fahad 137, judge M137): the path above the title like every Settings detail page, and the page's
          Save beside Cancel in the header at the right, as in the other full-page editors (New WhatsApp template,
          Edit assignment policy; Polaris Page: page actions in the page header). It was at the foot of the side card. */}
      <SettingsBreadcrumb
        items={[
          { label: "Macros", href: "/dashboard/settings/macros" },
          { label: existing ? existing.name : "Add a new macro" },
        ]}
      />
      <PageHeader
        title={existing ? existing.name : "Add a new macro"}
        description="A macro is a set of saved actions that help customer service agents easily complete tasks."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings/macros">Cancel</Link>
            </Button>
            <Button size="sm" onClick={save} disabled={saving} aria-busy={saving || undefined}>
              {saving ? "Saving…" : "Save macro"}
            </Button>
          </>
        }
      />
      {saveError && (
        <p role="alert" data-macro-save-error="" className="text-destructive text-sm">
          Not saved ({saveError}). {existing ? "The macro was not updated." : "The macro was not added."}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px]">
          <CardHeader className="border-b bg-card">
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <div className="mx-auto max-w-xl">
              <p id={helpId} className="sr-only">
                Drag to reorder, or press Enter to choose Move up or Move down. Changes stay unsaved until you save the
                macro.
              </p>
              <output aria-live="polite" aria-atomic="true" className="sr-only">
                {announcement}
              </output>
              <FlowPill icon={CircleDot}>Start Flow</FlowPill>
              <Connector onAdd={() => insertAt(0)} />
              {nodes.map((node, index) => {
                const error = submitted ? nodeError(node) : "";
                // While the menu fades out under the pointer, stop its items pulling focus back from the handle.
                const keepFocus = (e: React.PointerEvent) => {
                  if (menuFor !== node.uid) e.preventDefault();
                };
                return (
                  <React.Fragment key={node.uid}>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        moveTo(node.uid);
                      }}
                      onDrop={() => setDragging(null)}
                      data-dragging={dragging === node.uid}
                      data-error={!!error}
                      className="flex gap-2 rounded-xl border bg-card p-3 shadow-xs data-[dragging=true]:opacity-50 data-[error=true]:border-destructive/50"
                    >
                      <div className="flex flex-col items-center gap-2 pt-0.5 text-muted-foreground">
                        <DropdownMenu
                          modal={false}
                          open={menuFor === node.uid}
                          onOpenChange={(open) => setMenuFor(open ? node.uid : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <NativeGrip
                              ref={(el) => {
                                if (el) grips.current.set(node.uid, el);
                                else grips.current.delete(node.uid);
                              }}
                              draggable
                              onClick={() => {
                                if (dragFrom.current === null) setMenuFor(menuFor === node.uid ? null : node.uid);
                              }}
                              onDragStart={() => {
                                dragFrom.current = index;
                                setMenuFor(null);
                                setDragging(node.uid);
                              }}
                              onDragEnd={() => {
                                setDragging(null);
                                if (dragFrom.current !== index) announce(node.action, index);
                                setTimeout(() => {
                                  dragFrom.current = null;
                                });
                              }}
                              className="flex size-8 cursor-grab items-center justify-center rounded-md outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
                              aria-label={`Reorder action ${index + 1} of ${nodes.length}: ${node.action}`}
                              aria-describedby={helpId}
                            >
                              <GripVertical className="size-4" />
                            </NativeGrip>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-36">
                            <DropdownMenuItem
                              disabled={index === 0}
                              onSelect={() => step(node.uid, -1)}
                              onPointerMove={keepFocus}
                              onPointerLeave={keepFocus}
                            >
                              <ArrowUp /> Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={index === nodes.length - 1}
                              onSelect={() => step(node.uid, 1)}
                              onPointerMove={keepFocus}
                              onPointerLeave={keepFocus}
                            >
                              <ArrowDown /> Move down
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <span className="flex size-5 items-center justify-center rounded-full bg-muted font-medium text-[11px] tabular-nums">
                          {index + 1}
                        </span>
                      </div>
                      <div className="grid flex-1 gap-2">
                        <NativeSelect
                          className="w-full"
                          aria-label="Action"
                          value={node.action}
                          onChange={(e) => update(node.uid, { action: e.target.value, values: [] })}
                        >
                          {macroActionTypes.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </NativeSelect>
                        <NodeValue node={node} invalid={!!error} onChange={(values) => update(node.uid, { values })} />
                        <FieldError>{error}</FieldError>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete Action"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setNodes((prev) => prev.filter((n) => n.uid !== node.uid))}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Action</TooltipContent>
                      </Tooltip>
                    </div>
                    <Connector onAdd={() => insertAt(index + 1)} />
                  </React.Fragment>
                );
              })}
              <FlowPill icon={CircleStop}>End Flow</FlowPill>
              {submitted && actionsError ? (
                <p className="mt-3 text-center text-destructive text-xs">{actionsError}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="macro-name">Macro name</Label>
              <Input
                id="macro-name"
                placeholder="Enter a name for your macro"
                value={name}
                aria-invalid={submitted && !!nameError}
                onChange={(e) => setName(e.target.value)}
              />
              <FieldError>{submitted ? nameError : ""}</FieldError>
            </div>
            <div className="grid gap-2">
              <Label>Macro Visibility</Label>
              <RadioGroup
                value={canChoosePublic ? visibility : "Private"}
                onValueChange={(v) => {
                  if (v === "Public" && !canChoosePublic) return;
                  setVisibility(v as Macro["visibility"]);
                }}
                className="grid gap-2"
              >
                {[
                  {
                    value: "Public",
                    label: "Public",
                    desc: canChoosePublic
                      ? "This macro is available publicly for all agents in this account."
                      : "Only administrators can create public macros. Agents create private macros.",
                    disabled: !canChoosePublic,
                  },
                  {
                    value: "Private",
                    label: "Private",
                    desc: "This macro will be private to you and not be available to others.",
                    disabled: false,
                  },
                ].map((o) => (
                  <Label
                    key={o.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-disabled:cursor-not-allowed has-disabled:opacity-60 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={o.value} disabled={o.disabled} className="mt-0.5" />
                    <div className="grid gap-1">
                      <span className="font-medium">{o.label}</span>
                      <span className="text-muted-foreground text-xs leading-relaxed">{o.desc}</span>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <p className="flex gap-2 rounded-lg bg-muted/50 p-3 text-muted-foreground text-xs leading-relaxed">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Macros will run in the order you add your actions. You can rearrange them by dragging them by the handle
              beside each node.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

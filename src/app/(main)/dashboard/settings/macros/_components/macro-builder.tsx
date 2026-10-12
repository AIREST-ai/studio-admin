"use client";
// F159 settings-b: Chatwoot v4.18 macro editor (MacroEditor.vue, MacroForm.vue, MacroNodes.vue, MacroNode.vue,
// MacroProperties.vue, constants.js) as a full page in the Studio pattern: flow canvas left, properties right.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronLeft, CircleDot, CircleStop, GripVertical, Info, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { PageHeader } from "../../labels/_shared/settings-shell";
import { agentNames, labelNames, priorityNames, teamNames } from "../../labels/_shared/settings-data";
import { FieldError, MultiPick } from "../../labels/_shared/settings-ui";
import { type Macro, type MacroAction, macroActionTypes } from "./data";
import { macrosStore } from "./macros-store";

type InputKind = "select" | "multi" | "email" | "url" | "attachment" | "textarea" | null;

// macros/constants.js MACRO_ACTION_TYPES inputType per action.
const actionInput: Record<string, { input: InputKind; options?: string[] }> = {
  "Assign a Team": { input: "select", options: ["None", ...teamNames] },
  "Assign an Agent": { input: "select", options: ["None", "Self", ...agentNames] },
  "Add a Label": { input: "multi", options: labelNames },
  "Remove a Label": { input: "multi", options: labelNames },
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

function NodeValue({ node, onChange, invalid }: { node: Node; onChange: (values: string[]) => void; invalid: boolean }) {
  const def = actionInput[node.action];
  const fileRef = React.useRef<HTMLInputElement>(null);
  if (!def?.input) return null;
  if (def.input === "select")
    return (
      <NativeSelect
        className="w-full"
        aria-invalid={invalid}
        value={node.values[0] ?? ""}
        onChange={(e) => onChange([e.target.value])}
      >
        <option value="" disabled>
          Select
        </option>
        {def.options?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </NativeSelect>
    );
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
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const name = e.target.files?.[0]?.name;
            if (name) onChange([name]);
          }}
        />
        <Button type="button" variant="outline" size="sm" aria-invalid={invalid} onClick={() => fileRef.current?.click()}>
          <Paperclip /> {node.values[0] ? "Successfully Uploaded" : "Upload Attachment"}
        </Button>
        {node.values[0] ? <span className="truncate text-muted-foreground text-xs">{node.values[0]}</span> : null}
      </div>
    );
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

function FlowPill({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 font-medium text-muted-foreground text-xs">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

export function MacroBuilder({ macroId }: { macroId?: number }) {
  const router = useRouter();
  const existing = macroId ? macrosStore.find(macroId) : undefined;
  const [name, setName] = React.useState(existing?.name ?? "");
  const [visibility, setVisibility] = React.useState<Macro["visibility"]>(existing?.visibility ?? "Public");
  const [nodes, setNodes] = React.useState<Node[]>(() =>
    existing ? toNodes(existing.actions) : [{ uid: nextUid(), action: "Assign a Team", values: [] }],
  );
  const [submitted, setSubmitted] = React.useState(false);
  const [dragging, setDragging] = React.useState<number | null>(null);

  if (macroId && !existing) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Macro not found" description="This macro may have been deleted." />
        <Button variant="outline" size="sm" className="w-fit" asChild>
          <Link href="/dashboard/settings/macros">
            <ChevronLeft /> Macros
          </Link>
        </Button>
      </div>
    );
  }

  const nameError = name.trim() ? "" : "Name is required for creating a macro";
  const actionsError = nodes.length ? "" : "At least one action is required";

  const insertAt = (index: number) =>
    setNodes((prev) => [...prev.slice(0, index), { uid: nextUid(), action: "Add a Label", values: [] }, ...prev.slice(index)]);
  const update = (uid: number, patch: Partial<Node>) =>
    setNodes((prev) => prev.map((n) => (n.uid === uid ? { ...n, ...patch } : n)));

  function moveTo(target: number) {
    if (dragging === null || dragging === target) return;
    setNodes((prev) => {
      const from = prev.findIndex((n) => n.uid === dragging);
      const to = prev.findIndex((n) => n.uid === target);
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function save() {
    setSubmitted(true);
    if (nameError || actionsError || nodes.some(nodeError)) {
      toast.error("Something went wrong. Please try again");
      return;
    }
    const macro: Macro = {
      id: existing?.id ?? Date.now(),
      name: name.trim(),
      createdBy: existing?.createdBy ?? "Arham Khan",
      updatedBy: "Arham Khan",
      visibility,
      actions: nodes.map((n) => ({ action: n.action, value: n.values.join(", ") })),
    };
    macrosStore.save(macro);
    toast.success(existing ? "Macro updated successfully" : "Macro added successfully");
    router.push("/dashboard/settings/macros");
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground" asChild>
        <Link href="/dashboard/settings/macros">
          <ChevronLeft /> Macros
        </Link>
      </Button>
      <PageHeader
        title={existing ? existing.name : "Add a new macro"}
        description="A macro is a set of saved actions that help customer service agents easily complete tasks."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings/macros">Cancel</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px]">
          <CardHeader className="border-b bg-card">
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <div className="mx-auto max-w-xl">
              <FlowPill icon={CircleDot}>Start Flow</FlowPill>
              <Connector onAdd={() => insertAt(0)} />
              {nodes.map((node, index) => {
                const error = submitted ? nodeError(node) : "";
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
                      <div className="flex flex-col items-center gap-2 pt-1.5 text-muted-foreground">
                        <span
                          draggable
                          onDragStart={() => setDragging(node.uid)}
                          onDragEnd={() => setDragging(null)}
                          className="cursor-grab active:cursor-grabbing"
                          role="button"
                          tabIndex={0}
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="size-4" />
                        </span>
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
                value={visibility}
                onValueChange={(v) => setVisibility(v as Macro["visibility"])}
                className="grid gap-2"
              >
                {[
                  {
                    value: "Public",
                    label: "Public",
                    desc: "This macro is available publicly for all agents in this account.",
                  },
                  {
                    value: "Private",
                    label: "Private",
                    desc: "This macro will be private to you and not be available to others.",
                  },
                ].map((o) => (
                  <Label
                    key={o.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={o.value} className="mt-0.5" />
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
            <Button className="w-full" onClick={save}>
              Save macro
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

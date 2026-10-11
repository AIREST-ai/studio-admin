"use client";
import * as React from "react";

import Link from "next/link";

import { ChevronLeft, GripVertical, Info, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

import { type Macro, type MacroAction, macroActionTypes } from "./data";

const valueOptions: Record<string, string[]> = {
  "Assign a Team": ["Doha Support", "Dubai Sales", "Riyadh Showroom"],
  "Assign an Agent": ["Noura Al-Thani", "Faisal Al-Otaibi", "Mariam Al-Kuwari"],
  "Add a Label": ["billing", "delivery-delay", "vip-customer", "lead-uae", "arabic"],
  "Remove a Label": ["billing", "delivery-delay", "vip-customer"],
  "Change Priority": ["Urgent", "High", "Medium", "Low", "None"],
  "Snooze Conversation": ["Next reply", "Tomorrow", "Next week"],
  "Send an Email Transcript": ["Customer email", "Team email"],
};

const textActions = new Set(["Send a Message", "Add a Private Note"]);

function ActionCard({ item, index, onRemove }: { item: MacroAction; index: number; onRemove: () => void }) {
  const options = valueOptions[item.action];
  return (
    <div className="flex gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-col items-center gap-2 pt-1.5 text-muted-foreground">
        <GripVertical className="size-4 cursor-grab" />
        <span className="flex size-5 items-center justify-center rounded-full bg-muted font-medium text-[11px] tabular-nums">
          {index + 1}
        </span>
      </div>
      <div className="grid flex-1 gap-2">
        <NativeSelect className="w-full" defaultValue={item.action}>
          {macroActionTypes.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </NativeSelect>
        {textActions.has(item.action) ? (
          <Textarea defaultValue={item.value} rows={3} />
        ) : options ? (
          <NativeSelect className="w-full" defaultValue={item.value}>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </NativeSelect>
        ) : null}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Delete Action" onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}

export function MacroEditor({ macro }: { macro?: Macro }) {
  const [actions, setActions] = React.useState<MacroAction[]>(
    macro?.actions ?? [{ action: "Assign a Team", value: "Doha Support" }],
  );

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/dashboard/settings/macros">
          <ChevronLeft /> Macros
        </Link>
      </Button>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <span className="w-fit rounded-full border px-3 py-1 text-muted-foreground text-xs">Start Flow</span>
            {actions.map((item, index) => (
              <ActionCard
                key={`${item.action}-${index}`}
                item={item}
                index={index}
                onRemove={() => setActions((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setActions((prev) => [...prev, { action: "Add a Label", value: "billing" }])}
            >
              <Plus /> Add new action
            </Button>
            <span className="w-fit rounded-full border px-3 py-1 text-muted-foreground text-xs">End Flow</span>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="macro-name">Macro name</Label>
              <Input id="macro-name" placeholder="Enter a name for your macro" defaultValue={macro?.name} />
            </div>
            <div className="grid gap-2">
              <Label>Macro Visibility</Label>
              <RadioGroup defaultValue={macro?.visibility === "Private" ? "personal" : "global"} className="grid gap-2">
                <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
                  <RadioGroupItem value="global" className="mt-0.5" />
                  <div className="grid gap-1">
                    <span className="font-medium">Public</span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      This macro is available publicly for all agents in this account.
                    </span>
                  </div>
                </Label>
                <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
                  <RadioGroupItem value="personal" className="mt-0.5" />
                  <div className="grid gap-1">
                    <span className="font-medium">Private</span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      This macro will be private to you and not be available to others.
                    </span>
                  </div>
                </Label>
              </RadioGroup>
            </div>
            <p className="flex gap-2 rounded-lg bg-muted/50 p-3 text-muted-foreground text-xs leading-relaxed">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Macros will run in the order you add your actions. You can rearrange them by dragging them by the handle
              beside each node.
            </p>
            <Button className="w-full">Save macro</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

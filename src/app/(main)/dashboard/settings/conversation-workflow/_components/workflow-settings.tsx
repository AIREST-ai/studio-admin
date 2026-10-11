"use client";
import * as React from "react";

import { CircleCheck, CirclePlus, Hash, List, Search, Trash2, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface RequiredAttr {
  name: string;
  attrKey: string;
  type: "List" | "Text" | "Number";
}

const allAttributes: RequiredAttr[] = [
  { name: "Resolution reason", attrKey: "resolution_reason", type: "List" },
  { name: "Order number", attrKey: "order_number", type: "Text" },
  { name: "Refund amount (QAR)", attrKey: "refund_amount_qar", type: "Number" },
  { name: "Delivery city", attrKey: "delivery_city", type: "List" },
];

const typeIcon = { List, Text: Type, Number: Hash };

function AutoResolveCard() {
  const [enabled, setEnabled] = React.useState(true);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-resolve conversations</CardTitle>
        <CardDescription>
          This configuration would allow you to automatically resolve the conversation after a certain period of
          inactivity.
        </CardDescription>
        <CardAction>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Auto-resolve conversations" />
        </CardAction>
      </CardHeader>
      {enabled ? (
        <CardContent className="grid gap-5 border-t pt-5">
          <div className="grid gap-2">
            <Label htmlFor="ar-duration">Inactivity duration</Label>
            <div className="flex max-w-sm gap-2">
              <Input id="ar-duration" type="number" defaultValue={7} placeholder="30" />
              <NativeSelect className="w-32" defaultValue="days">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </NativeSelect>
            </div>
            <span className="text-muted-foreground text-xs">
              Time period of inactivity after which conversation is auto-resolved
            </span>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ar-message">Custom auto-resolution message</Label>
            <Textarea
              id="ar-message"
              rows={3}
              placeholder="Conversation was marked resolved by system due to 15 days of inactivity"
              defaultValue="We have closed this chat after 7 days without a reply. Message us any time and we will be happy to help."
            />
            <span className="text-muted-foreground text-xs">
              Message sent to the customer after conversation is auto-resolved
            </span>
          </div>
          <div className="grid gap-2">
            <Label>Preferences</Label>
            <div className="divide-y rounded-lg border">
              <div className="flex items-center justify-between gap-4 p-3">
                <span className="text-sm">Skip conversations waiting for agent’s reply</span>
                <Switch defaultChecked aria-label="Skip conversations waiting for agent’s reply" />
              </div>
              <div className="flex items-center justify-between gap-4 p-3">
                <span className="text-sm">Add label after auto-resolution</span>
                <NativeSelect size="sm" className="w-44" defaultValue="auto-closed">
                  <option value="" disabled>
                    Select a label
                  </option>
                  <option value="auto-closed">auto-closed</option>
                  <option value="feedback">feedback</option>
                  <option value="billing">billing</option>
                </NativeSelect>
              </div>
            </div>
          </div>
          <Button className="w-fit">Save Changes</Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

function RequiredAttributesCard() {
  const [required, setRequired] = React.useState<string[]>(["resolution_reason", "order_number"]);
  const chosen = allAttributes.filter((a) => required.includes(a.attrKey));
  const options = allAttributes.filter((a) => !required.includes(a.attrKey));

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="py-5">
        <CardTitle>Attributes required on resolution</CardTitle>
        <CardDescription>
          When resolving a conversation, agents will be prompted to fill these attributes if they haven&apos;t yet.
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={!options.length}>
                <CirclePlus /> Add Attributes
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground text-sm">
                <Search className="size-3.5" /> Search attributes
              </div>
              <DropdownMenuSeparator />
              {options.map((a) => (
                <DropdownMenuItem key={a.attrKey} onSelect={() => setRequired((p) => [...p, a.attrKey])}>
                  {a.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <Separator />
      {chosen.length ? (
        <div className="divide-y">
          {chosen.map((a) => {
            const Icon = typeIcon[a.type];
            return (
              <div key={a.attrKey} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg border bg-muted/40">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="grid gap-0.5">
                    <span className="font-medium text-sm">{a.name}</span>
                    <span className="font-mono text-muted-foreground text-xs">{a.attrKey}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete"
                  onClick={() => setRequired((p) => p.filter((k) => k !== a.attrKey))}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center gap-2 text-muted-foreground text-sm">
          <CircleCheck className="size-4" /> No attributes added yet
        </div>
      )}
    </Card>
  );
}

export function WorkflowSettings() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-3xl gap-1.5">
        <h1 className="font-semibold text-xl leading-none">Conversation Workflows</h1>
        <p className="text-muted-foreground text-sm">
          Configure rules and required fields for conversation resolution.
        </p>
      </div>
      <AutoResolveCard />
      <RequiredAttributesCard />
    </div>
  );
}

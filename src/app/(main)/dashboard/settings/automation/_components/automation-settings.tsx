"use client";
import * as React from "react";

import { Clock, Copy, Info, Pencil, Plus, Trash2, X, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";

type RunType = "instant" | "delayed";

interface Rule {
  id: number;
  name: string;
  description: string;
  active: boolean;
  createdOn: string;
  runType: RunType;
  delay?: string;
}

const rules: Rule[] = [
  { id: 1, name: "Route Arabic chats to Doha team", description: "Assign conversations with browser language Arabic to the Doha Support team", active: true, createdOn: "Sep 14, 2026", runType: "instant" },
  { id: 2, name: "Tag delivery complaints", description: "Add label delivery-delay when message content contains late, delay or تأخير", active: true, createdOn: "Sep 02, 2026", runType: "instant" },
  { id: 3, name: "VIP priority", description: "Set priority to urgent for contacts with label vip-customer", active: true, createdOn: "Aug 21, 2026", runType: "instant" },
  { id: 4, name: "UAE leads to Dubai sales", description: "Assign the Dubai Sales team when country is United Arab Emirates", active: false, createdOn: "Aug 10, 2026", runType: "instant" },
  { id: 5, name: "Refund requests SLA", description: "Apply the Refund 24h SLA when label billing is added", active: true, createdOn: "Jul 29, 2026", runType: "instant" },
  { id: 6, name: "Follow up after silence", description: "Send a reminder when the customer hasn't replied", active: true, createdOn: "Sep 20, 2026", runType: "delayed", delay: "24 hours" },
  { id: 7, name: "Escalate unanswered chats", description: "Assign the shift lead when no teammate has replied", active: true, createdOn: "Sep 18, 2026", runType: "delayed", delay: "30 minutes" },
  { id: 8, name: "Close stale pending", description: "Resolve conversations that stay pending", active: false, createdOn: "Aug 30, 2026", runType: "delayed", delay: "3 days" },
];

const events = ["Conversation Created", "Conversation Updated", "Message Created", "Conversation Resolved", "Conversation Opened"];
const conditionAttributes = ["Message Content", "Status", "Browser Language", "Country", "Inbox", "Team", "Priority", "Labels", "Email", "Phone Number"];
const actionTypes = ["Assign a Team", "Assign to Agent", "Add a Label", "Change Priority", "Send a Message", "Add a Private Note", "Add SLA", "Resolve Conversation", "Send an Email Transcript"];

function ConditionRow({ attribute, operator, value, join }: { attribute: string; operator: string; value: string; join?: string }) {
  return (
    <div className="grid gap-2">
      {join ? (
        <NativeSelect size="sm" className="w-20" defaultValue={join}>
          <option>AND</option>
          <option>OR</option>
        </NativeSelect>
      ) : null}
      <div className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
        <NativeSelect className="w-full" defaultValue={attribute}>
          {conditionAttributes.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </NativeSelect>
        <NativeSelect className="w-full" defaultValue={operator}>
          <option>Equal to</option>
          <option>Not equal to</option>
          <option>Contains</option>
          <option>Does not contain</option>
        </NativeSelect>
        <Input defaultValue={value} />
        <Button variant="ghost" size="icon" aria-label="Remove">
          <X />
        </Button>
      </div>
    </div>
  );
}

function ActionRow({ action, value }: { action: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
      <NativeSelect className="w-full" defaultValue={action}>
        {actionTypes.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </NativeSelect>
      <NativeSelect className="w-full" defaultValue={value}>
        <option>{value}</option>
        <option>Dubai Sales</option>
        <option>Riyadh Showroom</option>
      </NativeSelect>
      <Button variant="ghost" size="icon" aria-label="Remove">
        <X />
      </Button>
    </div>
  );
}

function RuleDialog({ open, onOpenChange, rule }: { open: boolean; onOpenChange: (o: boolean) => void; rule?: Rule }) {
  const [runType, setRunType] = React.useState<RunType>(rule?.runType ?? "instant");
  React.useEffect(() => setRunType(rule?.runType ?? "instant"), [rule]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Automation Rule" : "Add Automation Rule"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input id="rule-name" placeholder="Enter rule name" defaultValue={rule?.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rule-desc">Description</Label>
            <Textarea id="rule-desc" placeholder="Enter rule description" defaultValue={rule?.description} />
          </div>
          <div className="grid gap-2">
            <Label>When should this rule run?</Label>
            <RadioGroup value={runType} onValueChange={(v) => setRunType(v as RunType)} className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "instant", icon: Zap, label: "Run instantly", desc: "Runs the moment an event happens, as long as the conditions match." },
                { value: "delayed", icon: Clock, label: "Run after a wait", desc: "Waits for a set time and runs only if things are still the same. If they change, the rule is skipped." },
              ].map((o) => (
                <Label
                  key={o.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary"
                >
                  <RadioGroupItem value={o.value} className="mt-0.5" />
                  <div className="grid gap-1">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <o.icon className="size-3.5" /> {o.label}
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">{o.desc}</span>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>
          {runType === "instant" ? (
            <div className="grid gap-2">
              <Label>Event</Label>
              <NativeSelect className="w-full" defaultValue="Message Created">
                {events.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
              <Label>Wait condition</Label>
              <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr]">
                <div className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs">When</span>
                  <NativeSelect className="w-full" defaultValue="customer">
                    <option value="status">Conversation stays in a status</option>
                    <option value="customer">Customer hasn&apos;t replied</option>
                    <option value="agent">No teammate has replied</option>
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs">For</span>
                  <div className="flex gap-2">
                    <Input defaultValue="24" className="w-20" />
                    <NativeSelect className="w-full" defaultValue="hours">
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </NativeSelect>
                  </div>
                </div>
              </div>
              <p className="flex gap-2 text-muted-foreground text-xs leading-relaxed">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                The clock starts when a teammate replies. If the customer hasn&apos;t written back 24 hours later, the
                actions below run. If they do reply, nothing happens, and the next teammate reply starts the clock
                again.
              </p>
            </div>
          )}
          <div className="grid gap-3">
            <Label>Conditions</Label>
            <div className="grid gap-3 rounded-lg border p-3">
              <ConditionRow attribute="Browser Language" operator="Equal to" value="Arabic (ar)" />
              <ConditionRow attribute="Inbox" operator="Equal to" value="Website Live Chat" join="AND" />
              <Button variant="outline" size="sm" className="w-fit">
                <Plus /> Add Condition
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            <Label>Actions</Label>
            <div className="grid gap-3 rounded-lg border p-3">
              <ActionRow action="Assign a Team" value="Doha Support" />
              <ActionRow action="Add a Label" value="arabic" />
              <Button variant="outline" size="sm" className="w-fit">
                <Plus /> Add Action
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{rule ? "Edit" : "Create"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutomationSettings() {
  const [tab, setTab] = React.useState<RunType>("instant");
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState<Record<number, boolean>>(
    Object.fromEntries(rules.map((r) => [r.id, r.active])),
  );
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Rule | undefined>();
  const [deleting, setDeleting] = React.useState<Rule | undefined>();

  const q = query.trim().toLowerCase();
  const rows = rules.filter((r) => r.runType === tab && `${r.name} ${r.description}`.toLowerCase().includes(q));

  return (
    <>
      <SettingsShell
        title="Automation"
        description="Automation can replace and streamline existing processes that require manual effort, such as adding labels and assigning conversations to the most suitable agent. This allows the team to focus on their strengths while reducing time spent on routine tasks."
        learnMore="Learn more about automation"
        count={plural(rows.length, "automation", "automations")}
        search={{ placeholder: "Search automation rules...", value: query, onChange: setQuery }}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Create Automation
          </Button>
        }
      >
        <div className="px-6 pt-4 pb-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as RunType)}>
            <TabsList>
              <TabsTrigger value="instant">
                <Zap /> Runs instantly
              </TabsTrigger>
              <TabsTrigger value="delayed">
                <Clock /> Runs after a wait
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {rows.length ? (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="w-24 py-3 font-normal">Active</TableHead>
                <TableHead className="w-36 py-3 font-normal">Created on</TableHead>
                <TableHead className="w-32 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rule) => (
                <TableRow key={rule.id} className="border-border/60">
                  <TableCell className="py-3.5 whitespace-normal">
                    <div className="grid gap-0.5">
                      <span className="flex items-center gap-2 font-medium">
                        {rule.name}
                        {rule.delay ? (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            <Clock /> Runs after {rule.delay}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground text-xs">{rule.description}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Switch
                      checked={active[rule.id]}
                      onCheckedChange={(c) => setActive((prev) => ({ ...prev, [rule.id]: c }))}
                      aria-label="Active"
                    />
                  </TableCell>
                  <TableCell className="py-3.5 text-muted-foreground tabular-nums">{rule.createdOn}</TableCell>
                  <TableCell className="py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(rule)}>
                            <Pencil />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Clone">
                            <Copy />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clone</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleting(rule)}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>{tab === "delayed" ? "No rules run after a wait yet" : "No automation rules found"}</NoResults>
        )}
      </SettingsShell>

      <RuleDialog open={adding} onOpenChange={setAdding} />
      <RuleDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} rule={editing} />
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm Deletion"
        message={`Are you sure to delete ${deleting?.name ?? ""}?`}
        yes={`Yes, Delete ${deleting?.name ?? ""}`}
        no={`No, Keep ${deleting?.name ?? ""}`}
      />
    </>
  );
}

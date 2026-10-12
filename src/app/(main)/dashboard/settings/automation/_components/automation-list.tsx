"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Automation (automation/Index.vue, AutomationRuleRow.vue) in the Studio pattern.
import * as React from "react";

import { Clock, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, RowMenu, tableClass, ToneBadge } from "../../labels/_shared/settings-ui";
import { durationText, eventLabels, type Rule, RuleDialog, type RunType } from "./rule-form";

const initialRules: Rule[] = [
  {
    id: 1,
    name: "Route Arabic chats to Support",
    description: "Assign conversations with browser language Arabic to the Support team",
    active: true,
    createdOn: "Sep 14, 2026",
    runType: "instant",
    event: "conversation_created",
    conditions: [
      { attribute: "browser_language", operator: "Equal to", values: ["Arabic (ar)"], join: "and" },
      { attribute: "inbox_id", operator: "Equal to", values: ["Website Chat"], join: "and" },
    ],
    actions: [
      { action: "assign_team", values: ["Support"] },
      { action: "add_label", values: ["support"] },
    ],
  },
  {
    id: 2,
    name: "Tag billing questions",
    description: "Add label billing when message content contains invoice, refund or payment",
    active: true,
    createdOn: "Sep 02, 2026",
    runType: "instant",
    event: "message_created",
    conditions: [
      { attribute: "message_type", operator: "Equal to", values: ["Incoming Message"], join: "and" },
      { attribute: "content", operator: "Contains", values: ["invoice", "refund", "payment"], join: "and" },
    ],
    actions: [
      { action: "add_label", values: ["billing"] },
      { action: "assign_team", values: ["Billing"] },
    ],
  },
  {
    id: 3,
    name: "VIP priority",
    description: "Set priority to urgent for contacts with label vip",
    active: true,
    createdOn: "Aug 21, 2026",
    runType: "instant",
    event: "conversation_updated",
    conditions: [{ attribute: "labels", operator: "Equal to", values: ["vip"], join: "and" }],
    actions: [
      { action: "change_priority", values: ["Urgent"] },
      { action: "add_sla", values: ["VIP Doha"] },
    ],
  },
  {
    id: 4,
    name: "UAE leads to Sales",
    description: "Assign the Sales team and add label lead when country is United Arab Emirates",
    active: false,
    createdOn: "Aug 10, 2026",
    runType: "instant",
    event: "conversation_created",
    conditions: [{ attribute: "country_code", operator: "Equal to", values: ["United Arab Emirates"], join: "and" }],
    actions: [
      { action: "assign_team", values: ["Sales"] },
      { action: "add_label", values: ["lead"] },
    ],
  },
  {
    id: 5,
    name: "Transcript on resolve",
    description: "Email the conversation transcript to the customer when it is resolved",
    active: true,
    createdOn: "Jul 29, 2026",
    runType: "instant",
    event: "conversation_resolved",
    conditions: [{ attribute: "inbox_id", operator: "Equal to", values: ["Support Email"], join: "and" }],
    actions: [{ action: "send_email_transcript", values: ["{{contact.email}}"] }],
  },
  {
    id: 6,
    name: "Follow up after silence",
    description: "Send a reminder when the customer hasn't replied",
    active: true,
    createdOn: "Sep 20, 2026",
    runType: "delayed",
    event: "message_created",
    conditions: [],
    actions: [
      {
        action: "send_message",
        values: ["Hi {{contact.first_name}}, just checking in. Is there anything else we can help you with?"],
      },
    ],
    wait: { trigger: "customer_unresponsive", status: "Open", amount: 24, unit: "hours", inboxes: ["WhatsApp Business"] },
  },
  {
    id: 7,
    name: "Escalate unanswered chats",
    description: "Assign the shift lead when no teammate has replied",
    active: true,
    createdOn: "Sep 18, 2026",
    runType: "delayed",
    event: "message_created",
    conditions: [],
    actions: [
      { action: "assign_agent", values: ["Arham Khan"] },
      { action: "change_priority", values: ["High"] },
    ],
    wait: { trigger: "agent_unresponsive", status: "Open", amount: 30, unit: "minutes", inboxes: [] },
  },
  {
    id: 8,
    name: "Close stale pending",
    description: "Resolve conversations that stay pending",
    active: false,
    createdOn: "Aug 30, 2026",
    runType: "delayed",
    event: "conversation_updated",
    conditions: [],
    actions: [{ action: "resolve_conversation", values: [] }],
    wait: { trigger: "conversation_status", status: "Pending", amount: 3, unit: "days", inboxes: [] },
  },
];

function today() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function AutomationList() {
  const [rules, setRules] = React.useState(initialRules);
  const [tab, setTab] = React.useState<RunType>("instant");
  const [query, setQuery] = React.useState("");
  const [eventFilter, setEventFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Rule | undefined>();
  const [deleting, setDeleting] = React.useState<Rule | undefined>();
  const [toggling, setToggling] = React.useState<Rule | undefined>();

  const q = query.trim().toLowerCase();
  const rows = rules.filter(
    (r) =>
      r.runType === tab &&
      (eventFilter === "All" || eventLabels[r.event] === eventFilter) &&
      (statusFilter === "All" || (statusFilter === "Active") === r.active) &&
      `${r.name} ${r.description}`.toLowerCase().includes(q),
  );
  const filtered = q || eventFilter !== "All" || statusFilter !== "All";

  return (
    <>
      <SettingsShell
        title="Automation"
        description="Automation can replace and streamline existing processes that require manual effort, such as adding labels and assigning conversations to the most suitable agent. This allows the team to focus on their strengths while reducing time spent on routine tasks."
        learnMore="Learn more about automation"
        count={plural(rows.length, "automation", "automations")}
        search={{ placeholder: "Search automation rules...", value: query, onChange: setQuery }}
        tabs={{
          value: tab,
          onValueChange: (v) => setTab(v as RunType),
          items: [
            { value: "instant", label: "Runs instantly", count: rules.filter((r) => r.runType === "instant").length },
            { value: "delayed", label: "Runs after a wait", count: rules.filter((r) => r.runType === "delayed").length },
          ],
        }}
        cardDescription={
          tab === "delayed" ? "Rules that wait for a set time before they run." : "Rules that run as soon as their event happens."
        }
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Create Automation
          </Button>
        }
      >
        <ChipBar>
          {tab === "instant" ? (
            <ChipSelect
              label="Event"
              value={eventFilter}
              options={["All", ...Object.values(eventLabels)]}
              onChange={setEventFilter}
            />
          ) : null}
          <ChipSelect label="Active" value={statusFilter} options={["All", "Active", "Inactive"]} onChange={setStatusFilter} />
        </ChipBar>
        {rows.length ? (
          <Table className={tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="w-20 py-3 font-normal">Active</TableHead>
                <TableHead className="w-32 py-3 font-normal">Created on</TableHead>
                <TableHead className="w-20 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rule) => (
                <TableRow key={rule.id} className="border-border/60">
                  <TableCell className="whitespace-normal py-3.5">
                    <div className="grid gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {rule.name}
                        {rule.wait ? (
                          <ToneBadge tone="amber" dot={false}>
                            <Clock className="size-3" /> Runs after {durationText(rule.wait.amount, rule.wait.unit)}
                          </ToneBadge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground text-xs">{rule.description}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Switch checked={rule.active} onCheckedChange={() => setToggling(rule)} aria-label="Active" />
                  </TableCell>
                  <TableCell className="py-3.5 text-muted-foreground tabular-nums">{rule.createdOn}</TableCell>
                  <TableCell className="py-3.5 text-right">
                    <RowMenu
                      name={rule.name}
                      items={[
                        { label: "Edit", icon: Pencil, onSelect: () => setEditing(rule) },
                        {
                          label: "Clone",
                          icon: Copy,
                          onSelect: () => {
                            setRules((prev) => [
                              ...prev,
                              { ...rule, id: Date.now(), name: `${rule.name} (copy)`, createdOn: today() },
                            ]);
                            toast.success("Automation cloned successfully");
                          },
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          destructive: true,
                          separatorBefore: true,
                          onSelect: () => setDeleting(rule),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <NoResults>
            {filtered
              ? "No automation rules found matching your search"
              : tab === "delayed"
                ? "No rules run after a wait yet"
                : "No automation rules found"}
          </NoResults>
        )}
      </SettingsShell>

      <RuleDialog
        open={adding}
        onOpenChange={setAdding}
        onSave={(draft) => {
          setRules((prev) => [...prev, { ...draft, id: Date.now(), active: true, createdOn: today() }]);
          setTab(draft.runType);
          toast.success("Automation rule added successfully");
        }}
      />
      <RuleDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        rule={editing}
        onSave={(draft) => {
          setRules((prev) => prev.map((r) => (r.id === editing?.id ? { ...r, ...draft } : r)));
          setTab(draft.runType);
          toast.success("Automation rule updated successfully");
        }}
      />
      <AlertDialog open={!!toggling} onOpenChange={(o) => !o && setToggling(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggling?.active ? "Deactivate Automation Rule" : "Activate Automation Rule"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will {toggling?.active ? "deactivate" : "activate"} the automation rule &apos;{toggling?.name}
              &apos;. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const wasActive = toggling?.active;
                setRules((prev) => prev.map((r) => (r.id === toggling?.id ? { ...r, active: !r.active } : r)));
                toast.success(
                  wasActive ? "Automation Rule Deactivated Successfully" : "Automation Rule Activated Successfully",
                );
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title="Confirm Deletion"
        message={`Are you sure to delete ${deleting?.name ?? ""}?`}
        yes={`Yes, Delete ${deleting?.name ?? ""}`}
        no={`No, Keep ${deleting?.name ?? ""}`}
        onConfirm={() => {
          setRules((prev) => prev.filter((r) => r.id !== deleting?.id));
          toast.success("Automation rule deleted successfully");
        }}
      />
    </>
  );
}

"use client";
// F159 settings-b: Chatwoot v4.18 Settings > Automation (automation/Index.vue, AutomationRuleRow.vue) in the Studio pattern.
// T-139: the rules are saved (section "automation" of the preview save, with a revision: a save from a stale tab is
// refused, never written over) instead of living in this page's memory, so they survive a reload; every rule also
// opens in the visual editor (automation/flow/[id]). Search, tabs, filters, on/off with confirm,
// clone and delete work as before. The sample rules show only until something is saved, never over saved rules.
// M129-B: every rule (instant or after a wait) has "Simulate", which opens it in the editor with the Studio
// simulator's dry run open; flows with simulator steps are listed as simulator flows, approved or draft.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Clock, Copy, FlaskConical, LayoutTemplate, Pencil, Plus, Trash2, Workflow } from "lucide-react";
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
import { PRODUCT_NAME } from "@/config/app-config";

import { ConfirmDelete, NoResults, plural, SettingsShell } from "../../labels/_shared/settings-shell";
import { ChipBar, ChipSelect, RowMenu, ToneBadge, tableClass } from "../../labels/_shared/settings-ui";
import { approvalState } from "../_flow/compile";
import { type AutomationItem, type FlowRecord, flowOfRule, flowsOf, rulesOf, withRules } from "../_flow/model";
import { isSimDoc } from "../_flow/sim-catalog";
import { loadAutomation, SectionConflict, saveAutomation } from "../_flow/storage";
import { durationText, eventLabels, type Rule, RuleDialog, type RunType } from "./rule-form";

// The eight sample rules moved unchanged to ../_flow/sample-rules.ts (loadAutomation shows them until a save).

function today() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

const flowHref = (id: string) => `/dashboard/automation/flow/${id}`;

export function AutomationList() {
  const router = useRouter();
  const [items, setItems] = React.useState<AutomationItem[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = React.useState("");
  const [deletingDraft, setDeletingDraft] = React.useState<FlowRecord | undefined>();
  const itemsRef = React.useRef<AutomationItem[]>([]);
  const revRef = React.useRef(0);
  const queue = React.useRef<Promise<void>>(Promise.resolve());
  const rules = React.useMemo(() => rulesOf(items), [items]);
  const flows = React.useMemo(() => flowsOf(items), [items]);

  const load = React.useCallback(async () => {
    setStatus("loading");
    try {
      const loaded = await loadAutomation();
      itemsRef.current = loaded.items;
      revRef.current = loaded.rev;
      setItems(loaded.items);
      setStatus("ready");
    } catch (error) {
      setLoadError((error as Error).message);
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // One save at a time, each on top of the revision the previous one returned. The page shows the change at once;
  // the success message waits for the server, and a refused or failed save reloads what is really saved.
  const save = (nextItems: AutomationItem[], success: string) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
    queue.current = queue.current.then(async () => {
      try {
        const saved = await saveAutomation(nextItems, revRef.current);
        revRef.current = saved.rev;
        toast.success(success);
      } catch (error) {
        toast.error(
          error instanceof SectionConflict
            ? "Not saved: Automation was changed in another tab. The latest rules are loaded now."
            : `Not saved: ${(error as Error).message}. The saved rules are loaded again.`,
        );
        await load();
      }
    });
  };
  const setRules = (change: (prev: Rule[]) => Rule[], success: string) =>
    save(withRules(itemsRef.current, change(rulesOf(itemsRef.current))), success);
  const [tab, setTab] = React.useState<RunType>("instant");
  const [query, setQuery] = React.useState("");
  const [eventFilter, setEventFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");
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
  const ruleIds = new Set(rules.map((r) => r.id));
  const drafts = flows.filter((flow) => !Object.values(flow.ruleIds).some((id) => ruleIds.has(id)));

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
            {
              value: "delayed",
              label: "Runs after a wait",
              count: rules.filter((r) => r.runType === "delayed").length,
            },
          ],
        }}
        cardDescription={
          tab === "delayed"
            ? "Rules that wait for a set time before they run."
            : "Rules that run as soon as their event happens."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/automation/templates">
                <LayoutTemplate /> Templates
              </Link>
            </Button>
            <Button size="sm" onClick={() => router.push(flowHref("new"))} disabled={status !== "ready"}>
              <Plus /> Create Automation
            </Button>
          </div>
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
          <ChipSelect
            label="Active"
            value={statusFilter}
            options={["All", "Active", "Inactive"]}
            onChange={setStatusFilter}
          />
        </ChipBar>
        {/* loading or failed: never show the sample in place of rules that could not be read */}
        {status !== "ready" ? (
          <NoResults>
            {status === "loading" ? (
              "Loading automation rules…"
            ) : (
              <span className="flex flex-col items-center gap-2 text-center">
                Automation rules could not be loaded: {loadError}. Nothing was changed.
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Try again
                </Button>
              </span>
            )}
          </NoResults>
        ) : null}
        {status === "ready" &&
          (rows.length ? (
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
                {rows.map((rule) => {
                  const flow = flowOfRule(flows, rule.id);
                  const flowState = flow ? approvalState(flow, rules) : null;
                  return (
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
                            {flow ? (
                              <ToneBadge tone="violet" dot={false}>
                                <Workflow className="size-3" /> Visual flow
                              </ToneBadge>
                            ) : null}
                            {flowState === "changed" ? (
                              <ToneBadge tone="sky">Flow changes not approved</ToneBadge>
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
                            {
                              label: "Edit",
                              icon: Pencil,
                              onSelect: () => router.push(flowHref(flow ? flow.id : `rule-${rule.id}`)),
                            },
                            {
                              label: "Simulate",
                              icon: FlaskConical,
                              onSelect: () => router.push(`${flowHref(flow ? flow.id : `rule-${rule.id}`)}?simulate=1`),
                            },
                            {
                              label: "Clone",
                              icon: Copy,
                              onSelect: () => {
                                setRules(
                                  (prev) => [
                                    ...prev,
                                    { ...rule, id: Date.now(), name: `${rule.name} (copy)`, createdOn: today() },
                                  ],
                                  "Automation cloned successfully",
                                );
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
                  );
                })}
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
          ))}
        {status === "ready" && drafts.length ? (
          <div className="grid gap-2 border-t px-6 py-4" data-slot="visual-drafts">
            <div className="grid gap-0.5">
              <p className="font-medium text-sm">Visual drafts and simulator flows</p>
              <p className="text-muted-foreground text-xs">
                Saved in this preview with no engine rule: drafts not approved yet, and flows with {PRODUCT_NAME}{" "}
                simulator steps, which run in the simulator's dry run and send nothing to real customers.
              </p>
            </div>
            <ul className="grid gap-1.5">
              {drafts.map((flow) => (
                <li
                  key={flow.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <span className="grid gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium text-sm">
                      {flow.name || "Untitled flow"}
                      {isSimDoc(flow.doc) ? (
                        <ToneBadge tone="violet" dot={false} data-sim-flow={flow.id}>
                          <FlaskConical className="size-3" />{" "}
                          {flow.simApprovedAt
                            ? flow.updatedAt === flow.simApprovedAt
                              ? "Approved for the simulator"
                              : "Simulator · changes not approved"
                            : "Simulator · draft"}
                        </ToneBadge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {flow.doc.nodes.length - 1} step{flow.doc.nodes.length === 2 ? "" : "s"} · saved{" "}
                      {new Date(flow.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={flowHref(flow.id)}>
                        <Workflow /> Open
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`${flowHref(flow.id)}?simulate=1`}>
                        <FlaskConical /> Simulate
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeletingDraft(flow)}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SettingsShell>

      {/* Legacy form code retained; the interface has no entry that opens it. */}
      <RuleDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
        rule={editing}
        onSave={(draft) => {
          setRules(
            (prev) => prev.map((r) => (r.id === editing?.id ? { ...r, ...draft } : r)),
            "Automation rule updated successfully",
          );
          setTab(draft.runType);
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
                setRules(
                  (prev) => prev.map((r) => (r.id === toggling?.id ? { ...r, active: !r.active } : r)),
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
          setRules((prev) => prev.filter((r) => r.id !== deleting?.id), "Automation rule deleted successfully");
        }}
      />
      <ConfirmDelete
        open={!!deletingDraft}
        onOpenChange={(o) => !o && setDeletingDraft(undefined)}
        title="Delete visual draft"
        message={`Delete the drawing “${deletingDraft?.name.trim() ? deletingDraft.name : "Untitled flow"}”? It made no rule, so the list does not change.`}
        yes="Yes, delete the draft"
        no="No, keep it"
        onConfirm={() => {
          save(
            itemsRef.current.filter((item) => !(item.kind === "flow" && item.flow.id === deletingDraft?.id)),
            "Visual draft deleted",
          );
        }}
      />
    </>
  );
}

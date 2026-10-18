// T-139: canvas <-> Chatwoot rules, as plain functions (no React) so they are tested outside the browser.
// decompile(rule) draws one rule as trigger -> [wait] -> [condition] -> actions; compile(doc) walks every path from
// the trigger and gives back one rule per path, plus the problems that must be fixed before approval.
// A path drawn through ONE condition's Yes keeps that condition's rows exactly as drawn (any length, any AND/OR).
// Only Else and conditions under conditions make the converter write new rows; those rows are checked against
// Chatwoot's real SQL (chatwoot.ts) and refused when they would not mean the same thing.

import { PRODUCT_NAME } from "@/config/app-config";

import {
  type Action,
  actionDefs,
  actionError,
  attributeDefs,
  type Condition,
  conditionError,
  customConditions,
  type EventKey,
  eventConditions,
  eventLabels,
  minutesPer,
  type Rule,
  type RunType,
  type Trigger,
} from "./catalog";
import { negationOf, storeOf, writesOf } from "./chatwoot";
import {
  type ActionNode,
  type ConditionNode,
  exitsOf,
  type FlowDoc,
  type FlowEdge,
  type FlowNode,
  type FlowRecord,
  type Handle,
  type WaitData,
  type WaitNode,
} from "./model";
import { baseEvent, isSimDoc } from "./sim-catalog";

/** Most rows the converter may WRITE for one path (Else and nested conditions). Rows drawn as they are have no limit. */
export const MAX_GENERATED_ROWS = 40;

export const WAIT_EVENT: Record<Trigger, EventKey> = {
  conversation_status: "conversation_updated",
  customer_unresponsive: "message_created",
  agent_unresponsive: "message_created",
};

/** Fields a message wait sets itself (AutomationWaitCondition.vue:63-67); a status wait takes no other rows. */
const WAIT_MANAGED = ["inbox_id", "message_type", "private_note"];

export interface Issue {
  level: "error" | "warning";
  /** The step to jump to; null = the flow's own settings (name, description). */
  nodeId: string | null;
  message: string;
}

export interface CompiledPath {
  /** Stable across edits: the condition steps and exits it goes through ("main" when there are none). */
  key: string;
  /** "Yes", "Else", "Condition 1: Yes › Condition 2: Else"; empty when the flow has no condition. */
  label: string;
  nodeIds: string[];
  runType: RunType;
  event: EventKey;
  conditions: Condition[];
  actions: Action[];
  wait?: WaitData;
  /** true when the rows were rebuilt (Else / nested), false when they are a condition's rows as drawn. */
  restructured: boolean;
  /** true when the path cannot become a rule yet (see the errors); its conditions are then not usable. */
  blocked: boolean;
}

export interface CompileResult {
  paths: CompiledPath[];
  issues: Issue[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const labelOf = (attribute: string) => attributeDefs[attribute]?.label ?? attribute;
const minutesOf = (wait: WaitData) => wait.amount * minutesPer[wait.unit];

// ---------------------------------------------------------------------------------------------------------------
// Rule -> canvas

const STEP_Y = 170;

/** The rule drawn on the canvas, or why it cannot be drawn without changing it (then the form still edits it). */
export function decompile(rule: Rule): { doc: FlowDoc } | { reason: string } {
  if (!(rule.event in eventLabels)) return { reason: `The event “${rule.event}” is not one the engine has.` };
  if (rule.runType !== "instant" && rule.runType !== "delayed")
    return { reason: "This rule has no run type (instant or after a wait). Open it in the form." };
  if (rule.runType === "delayed" && !rule.wait)
    return { reason: "This rule runs after a wait but has no wait settings. Open it in the form to set them." };
  if (rule.runType === "instant" && rule.wait)
    return { reason: "This rule runs instantly but still carries wait settings. Open it in the form." };
  if (rule.runType === "delayed" && rule.wait && WAIT_EVENT[rule.wait.trigger] !== rule.event)
    return {
      reason: `The rule's event (${eventLabels[rule.event]}) does not match its wait, which runs on ${eventLabels[WAIT_EVENT[rule.wait.trigger]]}. Open it in the form.`,
    };
  const nodes: FlowNode[] = [{ id: "trigger", kind: "trigger", position: { x: 0, y: 0 }, event: rule.event }];
  if (rule.runType === "delayed" && rule.wait)
    nodes.push({ id: "wait", kind: "wait", position: { x: 0, y: 0 }, wait: clone(rule.wait) });
  if (rule.conditions.length)
    nodes.push({ id: "condition", kind: "condition", position: { x: 0, y: 0 }, rows: clone(rule.conditions) });
  rule.actions.forEach((action, index) => {
    nodes.push({ id: `action-${index + 1}`, kind: "action", position: { x: 0, y: 0 }, action: clone(action) });
  });
  nodes.forEach((node, index) => {
    node.position = { x: 0, y: index * STEP_Y };
  });
  const edges: FlowEdge[] = nodes.slice(1).map((node, index) => {
    const source = nodes[index];
    return {
      id: `e-${source.id}-${node.id}`,
      source: source.id,
      handle: source.kind === "condition" ? "yes" : "out",
      target: node.id,
    };
  });
  return { doc: { nodes, edges } };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing rules (also used while the user drags a line)

function nodeMap(doc: FlowDoc) {
  return new Map(doc.nodes.map((node) => [node.id, node]));
}

function reaches(doc: FlowDoc, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop() as string;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of doc.edges) if (edge.source === id) stack.push(edge.target);
  }
  return false;
}

/** Why this new line is not allowed, or null. Checked before the line is added, so a wrong line never appears. */
export function connectionProblem(
  doc: FlowDoc,
  line: { source: string; handle: Handle; target: string },
): string | null {
  const nodes = nodeMap(doc);
  const source = nodes.get(line.source);
  const target = nodes.get(line.target);
  if (!source || !target) return "That step no longer exists.";
  if (line.source === line.target) return "A step cannot connect to itself.";
  if (target.kind === "trigger") return "Nothing can come before the trigger.";
  // M129-B: each step has its own exits (model.ts exitsOf); "Go to another flow" has none
  if (source.kind === "goto") return "“Go to another flow” ends its path: the other flow continues from there.";
  if (!exitsOf(source).includes(line.handle)) return "Use the step's own exit to connect it.";
  if (doc.edges.some((edge) => edge.source === line.source && edge.handle === line.handle))
    return "This exit is already connected. Delete its line first.";
  if (doc.edges.some((edge) => edge.target === line.target))
    return "That step already has a step before it. A flow is a tree: each step follows exactly one step.";
  if (reaches(doc, line.target, line.source))
    return "This would make a loop. The engine runs a rule once per event, so a flow cannot go back to an earlier step.";
  if (target.kind === "wait" && source.kind !== "trigger")
    return "An engine rule's wait comes right after the trigger only; anywhere else, use “Wait between steps”.";
  // M129-B: the Studio simulator runs steps in order, so there a condition may follow an action
  if (source.kind === "action" && target.kind === "condition" && !isSimDoc(doc))
    return `In the engine's rules a condition cannot follow an action; in the ${PRODUCT_NAME} simulator it can (add a simulator step first).`;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Canvas -> rules

type Group = Condition[];

const rowKey = (row: Condition) => JSON.stringify([row.attribute, row.operator, row.values]);

function groupsOf(rows: Condition[]): Group[] {
  const groups: Group[] = [];
  rows.forEach((row, index) => {
    // AND binds tighter than OR in the SQL text, so each OR starts a new AND-group. Row 0's join is never read.
    if (index === 0 || row.join === "or") groups.push([]);
    groups[groups.length - 1].push(row);
  });
  return groups;
}

function emit(groups: Group[]): Condition[] {
  return groups.flatMap((group, g) =>
    group.map((row, r): Condition => ({ ...clone(row), join: g > 0 && r === 0 ? "or" : "and" })),
  );
}

function simplify(groups: Group[], event: EventKey): Group[] {
  const seen = new Set<string>();
  const out: Group[] = [];
  for (const group of groups) {
    const keys = new Set<string>();
    const rows = group.filter((row) => {
      const key = rowKey(row);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
    // "x AND not x" can never be TRUE (for empty values both are NULL, also not TRUE), so the group is dropped.
    const contradiction = rows.some((row) => {
      const opposite = negationOf(row, event);
      return "row" in opposite && keys.has(rowKey(opposite.row));
    });
    const groupKey = [...keys].sort().join("|");
    if (contradiction || seen.has(groupKey)) continue;
    seen.add(groupKey);
    out.push(rows);
  }
  return out;
}

interface Step {
  node: FlowNode;
  /** The exit taken from this step on this path. */
  handle: Handle | null;
}

function walk(doc: FlowDoc, issues: Issue[]): Step[][] {
  const nodes = nodeMap(doc);
  const trigger = doc.nodes.find((node) => node.kind === "trigger");
  if (!trigger) return [];
  const paths: Step[][] = [];
  const go = (node: FlowNode, before: Step[]) => {
    if (before.some((step) => step.node.id === node.id)) {
      issues.push({
        level: "error",
        nodeId: node.id,
        message: "This step is part of a loop. Delete one of its lines.",
      });
      return;
    }
    const exits: Handle[] = exitsOf(node);
    const next = exits.flatMap((handle) => {
      const edge = doc.edges.find((e) => e.source === node.id && e.handle === handle);
      const target = edge ? nodes.get(edge.target) : undefined;
      return target ? [{ handle, target }] : [];
    });
    if (!next.length) {
      paths.push([...before, { node, handle: null }]);
      return;
    }
    for (const { handle, target } of next) go(target, [...before, { node, handle }]);
  };
  go(trigger, []);
  return paths;
}

function push(issues: Issue[], issue: Issue) {
  if (!issues.some((i) => i.nodeId === issue.nodeId && i.message === issue.message && i.level === issue.level))
    issues.push(issue);
}

/** The event the rule runs on: the trigger's, or the one a wait forces (rule-form.tsx submit does the same). */
export function effectiveEvent(doc: FlowDoc): EventKey {
  const trigger = doc.nodes.find((node) => node.kind === "trigger");
  const first = trigger && doc.edges.find((edge) => edge.source === trigger.id);
  const wait = first && doc.nodes.find((node) => node.id === first.target && node.kind === "wait");
  if (wait && wait.kind === "wait") return WAIT_EVENT[wait.wait.trigger];
  // M129-B: a simulator event's conditions are those of the Chatwoot event it stands on (sim-catalog.ts baseEvent)
  return trigger?.kind === "trigger" ? baseEvent(trigger.event) : "conversation_created";
}

function checkNodes(doc: FlowDoc, event: EventKey, wait: WaitNode | undefined, issues: Issue[]) {
  const reachable = new Set<string>();
  const trigger = doc.nodes.find((node) => node.kind === "trigger");
  if (trigger) {
    const stack = [trigger.id];
    while (stack.length) {
      const id = stack.pop() as string;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const edge of doc.edges) if (edge.source === id) stack.push(edge.target);
    }
  }
  const available = new Set([...eventConditions[event], ...customConditions.conversation, ...customConditions.contact]);
  for (const node of doc.nodes) {
    if (!reachable.has(node.id))
      push(issues, {
        level: "error",
        nodeId: node.id,
        message: "Not connected to the trigger. Connect it or delete it.",
      });
    if (node.kind === "condition") {
      if (!node.rows.length)
        push(issues, { level: "error", nodeId: node.id, message: "Add at least one condition row." });
      for (const row of node.rows) {
        const error = conditionError(row);
        if (error) push(issues, { level: "error", nodeId: node.id, message: error });
        const def = attributeDefs[row.attribute];
        if (!def) {
          if (row.attribute)
            push(issues, {
              level: "error",
              nodeId: node.id,
              message: `“${row.attribute}” is not a field the engine knows.`,
            });
          continue;
        }
        if (!def.ops.includes(row.operator) && row.operator)
          push(issues, {
            level: "error",
            nodeId: node.id,
            message: `“${row.operator}” is not an operator of ${def.label}.`,
          });
        if (!available.has(row.attribute))
          push(issues, {
            level: "error",
            nodeId: node.id,
            message: `${def.label} is not available for ${eventLabels[event]}.`,
          });
        if (wait && wait.wait.trigger !== "conversation_status" && WAIT_MANAGED.includes(row.attribute))
          push(issues, {
            level: "error",
            nodeId: node.id,
            message: `${def.label} is set by the wait itself (its inboxes and who sent the message). Remove this row.`,
          });
        if (storeOf(row.attribute)?.table === "custom" && row.operator === "Not equal to")
          push(issues, {
            level: "warning",
            nodeId: node.id,
            message: `“Not equal to” on ${def.label} also matches conversations where it is empty, and if it is not the last row the engine's SQL breaks and the rule never runs (custom_attribute_filter_helper.rb:59-65).`,
          });
        if (row.attribute === "priority" && row.values.includes("None") && row.operator.includes("qual"))
          push(issues, {
            level: "warning",
            nodeId: node.id,
            message:
              "The engine has no “None” priority value: this row reads it as empty and never matches (filter_helper.rb:127-129).",
          });
      }
    }
    if (node.kind === "action") {
      if (!actionDefs[node.action.action])
        push(issues, { level: "error", nodeId: node.id, message: `“${node.action.action}” is not an engine action.` });
      else {
        const error = actionError(node.action);
        if (error) push(issues, { level: "error", nodeId: node.id, message: error });
      }
    }
    if (node.kind === "wait") {
      const minutes = minutesOf(node.wait);
      if (!Number.isFinite(minutes) || minutes < 10 || minutes > 43200)
        push(issues, { level: "error", nodeId: node.id, message: "The wait must be between 10 minutes and 30 days" });
      else if (!Number.isInteger(minutes))
        push(issues, {
          level: "error",
          nodeId: node.id,
          message: "The wait must be whole minutes: the engine stores it in minutes (automation_rule.rb:39).",
        });
    }
  }
}

function pathConditions(
  steps: Step[],
  event: EventKey,
  issues: Issue[],
): { conditions: Condition[]; restructured: boolean } | null {
  const decisions = steps.filter((step) => step.node.kind === "condition" && step.handle) as {
    node: ConditionNode;
    handle: Handle;
  }[];
  if (!decisions.length) return { conditions: [], restructured: false };
  if (decisions.length === 1 && decisions[0].handle === "yes")
    return { conditions: clone(decisions[0].node.rows), restructured: false };
  let ok = true;
  for (const { node } of decisions) {
    const custom = node.rows.find((row) => storeOf(row.attribute)?.table === "custom");
    if (custom) {
      ok = false;
      push(issues, {
        level: "error",
        nodeId: node.id,
        message: `Rows on a custom attribute (${labelOf(custom.attribute)}) work only in a single condition step without Else: the engine reads the rows after a custom attribute differently (filter_service.rb:63-69), so rebuilding them into other rows could change the rule.`,
      });
    }
  }
  const parts: Group[][] = [];
  for (const { node, handle } of decisions) {
    const groups = groupsOf(node.rows);
    if (handle === "yes") {
      parts.push(groups);
      continue;
    }
    const alternatives: Group[][] = [];
    for (const group of groups) {
      const negated: Group = [];
      for (const row of group) {
        const opposite = negationOf(row, event);
        if ("reason" in opposite) {
          ok = false;
          push(issues, { level: "error", nodeId: node.id, message: `Else is locked here. ${opposite.reason}` });
          break;
        }
        negated.push(opposite.row);
      }
      // not (a AND b) = (not a) OR (not b): one single-row group per row
      alternatives.push(negated.map((row) => [row]));
    }
    // not (g1 OR g2) = (not g1) AND (not g2)
    parts.push(...alternatives);
  }
  if (!ok) return null;
  // Rows before simplifying: (number of groups) x (rows in one group), counted without building them.
  const upper =
    parts.reduce((count, groups) => count * groups.length, 1) *
    parts.reduce((rows, groups) => rows + Math.max(...groups.map((group) => group.length)), 0);
  const owner = decisions[decisions.length - 1].node.id;
  if (upper > MAX_GENERATED_ROWS * 50) {
    push(issues, {
      level: "error",
      nodeId: owner,
      message: `This path becomes ${upper} condition rows in the engine (the editor writes at most ${MAX_GENERATED_ROWS}). Split it into simpler conditions.`,
    });
    return null;
  }
  let product: Group[] = [[]];
  for (const groups of parts) product = product.flatMap((left) => groups.map((right) => [...left, ...right]));
  const groups = simplify(product, event);
  if (!groups.length) {
    push(issues, {
      level: "error",
      nodeId: owner,
      message: "This path can never run: its conditions contradict each other.",
    });
    return null;
  }
  const rows = emit(groups);
  if (rows.length > MAX_GENERATED_ROWS) {
    push(issues, {
      level: "error",
      nodeId: owner,
      message: `This path becomes ${rows.length} condition rows in the engine (the editor writes at most ${MAX_GENERATED_ROWS}). Split it into simpler conditions.`,
    });
    return null;
  }
  return { conditions: rows, restructured: true };
}

export function compile(doc: FlowDoc, meta: { name: string; description: string }): CompileResult {
  const issues: Issue[] = [];
  if (!meta.name.trim()) push(issues, { level: "error", nodeId: null, message: "Name is required" });
  if (!meta.description.trim()) push(issues, { level: "error", nodeId: null, message: "Description is required" });
  const triggers = doc.nodes.filter((node) => node.kind === "trigger");
  if (triggers.length !== 1)
    push(issues, { level: "error", nodeId: triggers[1]?.id ?? null, message: "A flow has exactly one trigger." });
  const trigger = triggers[0];
  if (!trigger) return { paths: [], issues };
  if (!doc.edges.some((edge) => edge.source === trigger.id))
    push(issues, { level: "error", nodeId: trigger.id, message: "Add a step under the trigger." });
  const event = effectiveEvent(doc);
  const firstWait = doc.nodes.find(
    (node) => node.kind === "wait" && doc.edges.some((e) => e.source === trigger.id && e.target === node.id),
  ) as WaitNode | undefined;
  checkNodes(doc, event, firstWait, issues);

  const conditionNumber = new Map(
    doc.nodes.filter((node) => node.kind === "condition").map((node, index) => [node.id, index + 1]),
  );
  const single = conditionNumber.size === 1;
  const paths: CompiledPath[] = [];
  for (const steps of walk(doc, issues)) {
    let blocked = false;
    let seenAction = false;
    steps.forEach((step, index) => {
      if (step.node.kind === "wait" && index !== 1) {
        blocked = true;
        push(issues, {
          level: "error",
          nodeId: step.node.id,
          message:
            "A wait can only come right after the trigger: the engine waits once, before the conditions. Waiting between steps needs an extra engine.",
        });
      }
      if (step.node.kind === "condition" && seenAction) {
        blocked = true;
        push(issues, {
          level: "error",
          nodeId: step.node.id,
          message:
            "A condition cannot come after an action: the engine checks every condition before it runs any action. Move it above the actions.",
        });
      }
      if (step.node.kind === "action") seenAction = true;
    });
    const last = steps[steps.length - 1];
    const actions = steps.filter((step) => step.node.kind === "action").map((step) => (step.node as ActionNode).action);
    if (!actions.length) {
      blocked = true;
      if (steps.length > 1 || doc.edges.some((edge) => edge.source === trigger.id))
        push(issues, {
          level: "error",
          nodeId: last.node.id,
          message:
            last.node.kind === "condition"
              ? "Nothing happens after this condition. Connect its Yes or Else to an action."
              : "Nothing happens on this path. Add an action at its end.",
        });
    }
    const wait = steps[1]?.node.kind === "wait" ? (steps[1].node as WaitNode) : undefined;
    const decisions = steps.filter((step) => step.node.kind === "condition" && step.handle);
    const key = decisions.map((step) => `${step.node.id}:${step.handle}`).join("|") || "main";
    const label = decisions
      .map((step) => {
        const exit = step.handle === "yes" ? "Yes" : "Else";
        return single ? exit : `Condition ${conditionNumber.get(step.node.id)}: ${exit}`;
      })
      .join(" › ");
    const built = pathConditions(steps, event, issues);
    if (!built) blocked = true;
    const conditions = built?.conditions ?? [];
    if (wait?.wait.trigger === "conversation_status")
      for (const step of decisions)
        push(issues, {
          level: "error",
          nodeId: step.node.id,
          message:
            "A status wait takes no other conditions in the engine: only the status and inboxes set on the wait (automation_rule.rb:119-126). Remove this condition step.",
        });
    if (!wait && built && !conditions.length && actions.length) {
      const firstAction = steps.find((step) => step.node.kind === "action");
      push(issues, {
        level: "error",
        nodeId: firstAction?.node.id ?? null,
        message:
          "A rule that runs instantly needs at least one condition (as in the form). Add a condition above this step.",
      });
    }
    paths.push({
      key,
      label,
      nodeIds: steps.map((step) => step.node.id),
      runType: wait ? "delayed" : "instant",
      event,
      conditions,
      actions: clone(actions),
      ...(wait ? { wait: clone(wait.wait) } : {}),
      restructured: built?.restructured ?? true,
      blocked,
    });
  }

  if (paths.length > 1) {
    const waitPath = paths.find((path) => path.wait);
    if (waitPath)
      push(issues, {
        level: "error",
        nodeId: waitPath.nodeIds[1],
        message:
          "Branches are locked on a rule that waits: each path would become its own rule with its own timer, and the engine re-checks each rule when its timer ends, so both paths could run. Remove the Else line or the wait.",
      });
    const nodes = nodeMap(doc);
    const reads = paths.map((path) => {
      const fields = new Set<string>();
      for (const id of path.nodeIds) {
        const node = nodes.get(id);
        if (node?.kind === "condition") for (const row of node.rows) fields.add(row.attribute);
      }
      return fields;
    });
    paths.forEach((path, i) => {
      for (const id of path.nodeIds) {
        const node = nodes.get(id);
        if (node?.kind !== "action") continue;
        const writes = writesOf(node.action.action);
        paths.forEach((other, j) => {
          if (i === j) return;
          const hit = writes.includes("*") ? [...reads[j]] : writes.filter((field) => reads[j].has(field));
          if (!hit.length) return;
          push(issues, {
            level: "error",
            nodeId: node.id,
            message: `This step changes ${hit.map(labelOf).join(" and ")}, which the path “${other.label}” checks. The engine makes each path its own rule and runs them one after another, in no fixed order, so both paths could run. Use another action here, or branch on a field this flow does not change.`,
          });
        });
      }
    });
  }
  return { paths, issues };
}

/** `base` with what the path says; every other field of the rule (id, on/off, created date, unknown ones) stays. */
export function applyPath(base: Rule, path: CompiledPath, name: string, description: string): Rule {
  const next: Rule = {
    ...base,
    name,
    description,
    runType: path.runType,
    event: path.event,
    conditions: clone(path.conditions),
    actions: clone(path.actions),
  };
  if (path.wait) next.wait = clone(path.wait);
  else if (next.wait !== undefined) delete next.wait;
  return next;
}

/**
 * Where a flow stands against the rules in the list: "draft" (it made no rule yet), "approved" (approving it now
 * would change nothing) or "changed" (the drawing, or a rule edited in the form, differs).
 */
export function approvalState(
  flow: Pick<FlowRecord, "name" | "description" | "ruleIds" | "doc">,
  rules: Rule[],
): "draft" | "approved" | "changed" {
  const ids = new Set(rules.map((rule) => rule.id));
  if (!Object.values(flow.ruleIds).some((id) => ids.has(id))) return "draft";
  const result = compile(flow.doc, flow);
  if (result.issues.some((issue) => issue.level === "error")) return "changed";
  const plan = planApproval(flow, result, rules, "", () => -1);
  if (plan.created.length || plan.removed.length) return "changed";
  return JSON.stringify(plan.rules) === JSON.stringify(rules) ? "approved" : "changed";
}

export interface ApprovalPlan {
  rules: Rule[];
  ruleIds: Record<string, number>;
  created: number[];
  updated: number[];
  removed: number[];
}

/**
 * The rules after approving `flow`: a path keeps the rule it made last time (same id, created date, on/off); a new
 * path makes a new rule that starts turned off; a rule whose path is gone is listed in `removed` (the dialog shows it).
 */
export function planApproval(
  flow: Pick<FlowRecord, "name" | "description" | "ruleIds">,
  result: CompileResult,
  rules: Rule[],
  today: string,
  newId: () => number,
): ApprovalPlan {
  const multi = result.paths.length > 1;
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const keys = new Set(result.paths.map((path) => path.key));
  const leftovers = Object.entries(flow.ruleIds)
    .filter(([key, id]) => !keys.has(key) && byId.has(id))
    .map(([, id]) => id);
  const used = new Set<number>();
  const replaced = new Map<number, Rule>();
  const added: Rule[] = [];
  const plan: ApprovalPlan = { rules: [], ruleIds: {}, created: [], updated: [], removed: [] };
  for (const path of result.paths) {
    const name = multi ? `${flow.name} (${path.label})` : flow.name;
    let id: number | undefined = flow.ruleIds[path.key];
    if (id === undefined || !byId.has(id) || used.has(id)) id = leftovers.shift();
    const existing = id === undefined ? undefined : byId.get(id);
    if (existing && id !== undefined) {
      used.add(id);
      replaced.set(id, applyPath(existing, path, name, flow.description));
      plan.updated.push(id);
    } else {
      let fresh = newId();
      while (byId.has(fresh) || used.has(fresh)) fresh += 1;
      id = fresh;
      used.add(id);
      const base: Rule = {
        id,
        name,
        description: flow.description,
        active: false,
        createdOn: today,
        runType: path.runType,
        event: path.event,
        conditions: [],
        actions: [],
      };
      added.push(applyPath(base, path, name, flow.description));
      plan.created.push(id);
    }
    plan.ruleIds[path.key] = id;
  }
  plan.removed = Object.values(flow.ruleIds).filter(
    (id, index, all) => byId.has(id) && !used.has(id) && all.indexOf(id) === index,
  );
  plan.rules = [
    ...rules.filter((rule) => !plan.removed.includes(rule.id)).map((rule) => replaced.get(rule.id) ?? rule),
    ...added,
  ];
  return plan;
}

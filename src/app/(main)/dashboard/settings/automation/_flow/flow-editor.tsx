"use client";
// T-139 (item 53): the visual automation editor, a page under Settings > Automation. A canvas of steps (trigger,
// wait, conditions with Yes/Else, actions) drawn top to bottom, steps dragged from the palette and lines dragged
// between steps, a side panel with the text form's own fields, undo/redo, keyboard, problems that jump to their step.
// It edits the SAME rules as the list and the text form (section "automation" of the preview save):
//   - "Save draft" keeps the drawing only; the rules do not change.
//   - "Approve as preview rules" writes the rules the drawing makes into this preview's Automation list.
// Neither sends anything to Chatwoot or to a customer: Studio is not linked to Chatwoot yet, and nothing runs here.
// M129-B (items 129.1, 129.2): a drawing that uses a Studio simulator step (sim-catalog.ts simFeatures) runs in the
// simulator: its checks are checkSimFlow's, "Approve" keeps it as an approved simulator flow (it makes no Chatwoot
// rule), and the Dry run plays the whole flow per channel (sim-dry-run.tsx). A drawing without one works as before.
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStoreApi,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "cn";
import {
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  LayoutGrid,
  ListPlus,
  MoreHorizontal,
  Redo2,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PRODUCT_NAME } from "@/config/app-config";
import { loadPreviewSection } from "@/lib/cw/persistence/client";
import { useCwList } from "@/lib/cw/store";

import { useLivePickerNames } from "../../labels/_shared/live-picker-names";
import { ToneBadge } from "../../labels/_shared/settings-ui";
import {
  CanvasActionsContext,
  KIND_LOOK,
  PALETTE_DRAG_TYPE,
  Palette,
  parseChoice,
  STEP_CHOICES,
  type StepData,
  StepEdge,
  StepNode,
  summaryOf,
} from "./canvas-parts";
import { actionDefs, durationText, eventLabels } from "./catalog";
import { type IdDirectory, toChatwootRule } from "./chatwoot";
import {
  type ApprovalPlan,
  approvalState,
  compile,
  connectionProblem,
  decompile,
  effectiveEvent,
  type Issue,
  planApproval,
} from "./compile";
import { dryRun, ruleForPath } from "./dry-run";
import { addAfter, addLoose, arrange, connect, emptyDoc, freeExits, moveNodes, NODE_WIDTH, remove } from "./edit";
import { FlowInspector, StepInspector } from "./inspector";
import { fileIdsIn, restoreDeletedFiles } from "./media-upload";
import {
  type AutomationItem,
  EXIT_LABELS,
  type FlowDoc,
  type FlowNode,
  type FlowRecord,
  flowOfRule,
  flowsOf,
  type Handle,
  type NodeKind,
  newFlowId,
  type Rule,
  rulesOf,
  type TriggerNode,
  withRules,
  type XY,
} from "./model";
import { drySamples } from "./samples";
import { SIM_HONEST_LINE, simFeatures, stepTitles } from "./sim-catalog";
import { SimDryRun } from "./sim-dry-run";
import { type BusinessHours, checkSimFlow, type SimContext, type SimFolder } from "./sim-engine";
import { defaultSimOptions, SimOptionsContext } from "./sim-options";
import { loadAutomation, SectionConflict, saveAutomation, today } from "./storage";
import { TemplateNotice } from "./template-notice";
import { findTemplate, instantiateTemplate, templateBlocker, templateDescription, templateRef } from "./templates";

const LIST_HREF = "/dashboard/automation";
const flowHref = (id: string) => `${LIST_HREF}/flow/${id}`;
// F-6B: name -> id from the live inboxes, agents and teams (their own ids), so an invited agent or a new team picked in
// a step has its id in the dry run and the Chatwoot payload. Seed rows keep the ids they had (1 Support Email, ...).
function liveDirectory(lists: { inboxes: Row[]; agents: Row[]; teams: Row[] }): IdDirectory {
  const by = (rows: Row[]) => (name: string) => rows.find((row) => row.name === name)?.id ?? null;
  return { inbox: by(lists.inboxes), agent: by(lists.agents), team: by(lists.teams) };
}
type Row = { id: number; name: string };
const nodeTypes = { step: StepNode };
const EXIT_WORD = (handle: Handle) => (EXIT_LABELS[handle] ? ` ${EXIT_LABELS[handle]}` : "");

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** The hours Settings > Inboxes > Business Hours starts with before anything is saved (inbox-settings.tsx
 * businessHoursFor): the simulator reads the same, so "Within business hours" means what that page shows. */
const INBOX_PAGE_HOURS: BusinessHours = {
  enabled: true,
  timezone: "Asia/Qatar",
  days: DAYS.map((day) => ({
    day,
    open: day !== "Friday",
    allDay: false,
    from: day === "Saturday" ? "10:00" : "08:00",
    to: day === "Saturday" ? "18:00" : "21:00",
  })),
};
const edgeTypes = { step: StepEdge };

interface Snapshot {
  name: string;
  description: string;
  doc: FlowDoc;
}

// ------------------------------------------------------------------------------------------------ undo / redo
interface History {
  past: Snapshot[];
  present: Snapshot | null;
  future: Snapshot[];
  coalesce: { key: string; at: number } | null;
}
type HistoryAction =
  | { type: "reset"; snapshot: Snapshot }
  | { type: "set"; next: Snapshot; coalesce?: string; now: number }
  | { type: "live"; next: Snapshot }
  | { type: "settle"; from: Snapshot }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 50;

function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "reset":
      return { past: [], present: action.snapshot, future: [], coalesce: null };
    case "set": {
      if (!state.present) return state;
      // typing in one field is one undo step, not one per letter
      const same =
        !!action.coalesce && state.coalesce?.key === action.coalesce && action.now - state.coalesce.at < 1200;
      return {
        past: same ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: action.next,
        future: [],
        coalesce: action.coalesce ? { key: action.coalesce, at: action.now } : null,
      };
    }
    case "live":
      return { ...state, present: action.next };
    case "settle":
      return { ...state, past: [...state.past, action.from].slice(-HISTORY_LIMIT), future: [], coalesce: null };
    case "undo": {
      if (!state.past.length || !state.present) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        coalesce: null,
      };
    }
    case "redo": {
      if (!state.future.length || !state.present) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        coalesce: null,
      };
    }
  }
}

/** A dragged line as source -> target, also when it was dragged from a step's input back to an exit. */
const lineOf = (
  from: { nodeId: string; handleId: string | null },
  to: { nodeId: string; handleId: string | null },
  reverse: boolean,
) =>
  reverse
    ? { source: to.nodeId, handle: (to.handleId ?? "out") as Handle, target: from.nodeId }
    : { source: from.nodeId, handle: (from.handleId ?? "out") as Handle, target: to.nodeId };

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Width of the editor itself (not the window): the Settings bars take part of the screen. The editor box mounts
 * only after the flow loads, so it is observed from the moment it exists (callback ref), not from the first render. */
function useWidth(element: HTMLElement | null) {
  const [width, setWidth] = React.useState(1200);
  React.useEffect(() => {
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    !!target.closest("[role=dialog]"));

type Loaded =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "missing"; message: string }
  | { state: "refused"; rule: Rule; reason: string }
  | { state: "ready" };

export function FlowEditor({ id }: { id: string }) {
  return (
    <ReactFlowProvider>
      <Editor id={id} />
    </ReactFlowProvider>
  );
}

function Editor({ id }: { id: string }) {
  const router = useRouter();
  const flowApi = useReactFlow();
  const flowStore = useStoreApi();
  const reduced = useReducedMotion();
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null);
  const width = useWidth(root);
  const wide = width >= 1024;
  const phone = width < 672;
  // the mini map sits top-right (132x88, 15px from the edge) only when wide: keep the fitted drawing out of that strip,
  // with the map's own 15px edge spacing between it and the drawing (15 + 132 + 15)
  const fitPadding = React.useCallback(
    (side: number) => (wide ? { top: side, right: "162px" as const, bottom: side, left: side } : side),
    [wide],
  );

  const [loaded, setLoaded] = React.useState<Loaded>({ state: "loading" });
  const [items, setItems] = React.useState<AutomationItem[]>([]);
  const [rev, setRev] = React.useState(0);
  const [record, setRecord] = React.useState<FlowRecord | null>(null);
  const [history, dispatch] = React.useReducer(historyReducer, { past: [], present: null, future: [], coalesce: null });
  const present = history.present;
  // F-3: Undo / Redo can bring back a step whose attachment this page deleted (Remove, Replace, another type): the file
  // is put back on the preview's disk under its own id, also when that step is not the one open in the side panel.
  const presentFiles = fileIdsIn(present?.doc).join(" ");
  React.useEffect(() => {
    if (presentFiles) void restoreDeletedFiles(presentFiles.split(" "));
  }, [presentFiles]);
  const [savedSnapshot, setSavedSnapshot] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [selectedEdges, setSelectedEdges] = React.useState<string[]>([]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [stepsOpen, setStepsOpen] = React.useState(false);
  const [problemsOpen, setProblemsOpen] = React.useState(false);
  const [dryOpen, setDryOpen] = React.useState(false);
  const [plan, setPlan] = React.useState<ApprovalPlan | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const dragFrom = React.useRef<Snapshot | null>(null);
  const sizes = React.useRef<Record<string, { width: number; height: number }>>({});
  // M129-B: what the simulator reads from the rest of the preview
  const [folders, setFolders] = React.useState<SimFolder[]>([]);
  const [simApproving, setSimApproving] = React.useState(false);
  const [cwInboxes] = useCwList("inboxes");
  const [cwAgents] = useCwList("agents");
  const [cwTeams] = useCwList("teams");
  const [cwTemplates] = useCwList("whatsappTemplates");
  const names = useLivePickerNames(); // F-6B: the step pickers and the checks read the live lists
  const ids = React.useMemo(
    () => liveDirectory({ inboxes: cwInboxes, agents: cwAgents, teams: cwTeams }),
    [cwInboxes, cwAgents, cwTeams],
  );
  React.useEffect(() => {
    loadPreviewSection<SimFolder>("folders")
      .then((section) => setFolders(section.items ?? []))
      .catch(() => setFolders([]));
  }, []);

  // ------------------------------------------------------------------------------------------- load
  // what the address names now: "new" or "rule-…" becomes the flow's own id once it is saved (see persist)
  const currentId = React.useRef(id);
  const open = React.useCallback(async () => {
    const id = currentId.current;
    setLoaded({ state: "loading" });
    try {
      const data = await loadAutomation();
      setItems(data.items);
      setRev(data.rev);
      const flows = flowsOf(data.items);
      const rules = rulesOf(data.items);
      let next: FlowRecord | null = null;
      // T-243: "Use template" opens flow/new?template=<id>: a new draft from that library template. It is not saved
      // (and counts as unsaved changes) until Save draft; a template the editor cannot draw is refused here too.
      let fromTemplate = false;
      if (id === "new") {
        const templateId = new URLSearchParams(window.location.search).get("template");
        const template = findTemplate(templateId);
        if (templateId && !template) {
          setLoaded({ state: "missing", message: "This template is not in the template library." });
          return;
        }
        if (template && templateBlocker(template)) {
          setLoaded({
            state: "missing",
            message: `“${template.title_en}” cannot be drawn in the editor today. ${templateBlocker(template)}`,
          });
          return;
        }
        fromTemplate = !!template;
        next = {
          id: newFlowId(),
          name: template?.title_en ?? "",
          description: template ? templateDescription(template, "en") : "",
          doc: template ? arrange(instantiateTemplate(template).doc) : emptyDoc(),
          ruleIds: {},
          createdAt: "",
          updatedAt: "",
          approvedAt: null,
          ...(template ? { template: templateRef(template) } : {}),
        };
      } else if (/^rule-\d+$/.test(id)) {
        const ruleId = Number(id.slice(5));
        const rule = rules.find((r) => r.id === ruleId);
        if (!rule) {
          setLoaded({ state: "missing", message: "This rule is not in the Automation list (deleted?)." });
          return;
        }
        const owner = flowOfRule(flows, ruleId);
        if (owner) {
          router.replace(flowHref(owner.id));
          next = owner;
        } else {
          const opened = decompile(rule);
          if ("reason" in opened) {
            setLoaded({ state: "refused", rule, reason: opened.reason });
            return;
          }
          const doc = arrange(opened.doc);
          const first = compile(doc, rule).paths[0];
          next = {
            id: newFlowId(),
            name: rule.name,
            description: rule.description,
            doc,
            ruleIds: { [first?.key ?? "main"]: rule.id },
            createdAt: "",
            updatedAt: "",
            approvedAt: null,
          };
        }
      } else {
        next = flows.find((flow) => flow.id === id) ?? null;
        if (!next) {
          setLoaded({ state: "missing", message: "This flow is not saved in this preview (deleted, or never saved)." });
          return;
        }
      }
      const snapshot = { name: next.name, description: next.description, doc: next.doc };
      setRecord(next);
      dispatch({ type: "reset", snapshot });
      setSavedSnapshot(JSON.stringify(fromTemplate ? { name: "", description: "", doc: emptyDoc() } : snapshot));
      setSelected(null);
      setLoaded({ state: "ready" });
      // M129-B: "Simulate" in the Automation list opens the editor with the dry run already open
      if (new URLSearchParams(window.location.search).get("simulate") === "1") setDryOpen(true);
    } catch (error) {
      setLoaded({ state: "error", message: (error as Error).message });
    }
  }, [router]);

  React.useEffect(() => {
    currentId.current = id;
    void open();
  }, [id, open]);

  // ------------------------------------------------------------------------------------------- derived
  const doc = present?.doc;
  // biome-ignore lint/correctness/useExhaustiveDependencies: F-6B: the checks compare values with the live names
  const result = React.useMemo(
    () => (present ? compile(present.doc, present) : null),
    [present, names.agents, names.teams, names.inboxes, names.labels, names.slas],
  );
  const savedFlows = React.useMemo(() => flowsOf(items), [items]);
  const approvedTemplates = React.useMemo(
    () => cwTemplates.filter((t) => t.status === "APPROVED").map((t) => t.name),
    [cwTemplates],
  );
  // F-3 item 6: their text, so a template step fills its {{n}} from the contact (template-vars.ts)
  const approvedBodies = React.useMemo(
    () => Object.fromEntries(cwTemplates.filter((t) => t.status === "APPROVED").map((t) => [t.name, t.body])),
    [cwTemplates],
  );
  const simReasons = React.useMemo(() => (present ? simFeatures(present.doc) : []), [present]);
  const simMode = simReasons.length > 0;
  const flowId = record?.id ?? "";
  const simIssues = React.useMemo(
    () =>
      present && simMode
        ? checkSimFlow(present.doc, present, {
            flows: savedFlows,
            flowId,
            folders,
            templates: approvedTemplates,
            templateBodies: approvedBodies,
          })
        : [],
    [present, simMode, savedFlows, flowId, folders, approvedTemplates, approvedBodies],
  );
  // M129-B: a simulator flow is checked by the simulator; a Chatwoot flow by the converter, as before
  const issues: Issue[] = simMode ? simIssues : (result?.issues ?? []);
  const errors = issues.filter((issue) => issue.level === "error");
  const simContext = React.useMemo<SimContext>(
    () => ({
      ids,
      agents: cwAgents.map((agent) => ({ name: agent.name, availability: String(agent.availability) })),
      hoursOf: (name) => {
        const inbox = cwInboxes.find((i) => i.name === name);
        if (!inbox) return null;
        const saved = (inbox as { config?: { businessHours?: BusinessHours } }).config?.businessHours;
        return saved ?? INBOX_PAGE_HOURS;
      },
      folders,
      flows: savedFlows,
      flowId,
      flowName: present?.name ?? "",
      templates: approvedTemplates,
      templateBodies: approvedBodies,
    }),
    [ids, cwAgents, cwInboxes, folders, savedFlows, flowId, present?.name, approvedTemplates, approvedBodies],
  );
  const simOptions = React.useMemo(
    () => ({
      ...defaultSimOptions,
      folders: folders.map((f) => f.name),
      templates: approvedTemplates.length ? approvedTemplates : defaultSimOptions.templates,
      templateBodies: approvedTemplates.length ? approvedBodies : defaultSimOptions.templateBodies,
      flows: savedFlows.map((flow) => ({ id: flow.id, name: flow.name })),
      currentFlowId: flowId,
    }),
    [folders, approvedTemplates, approvedBodies, savedFlows, flowId],
  );
  const flowName = React.useCallback(
    (id: string) => savedFlows.find((flow) => flow.id === id)?.name || "a flow that is not saved",
    [savedFlows],
  );
  const event = doc ? effectiveEvent(doc) : "conversation_created";
  const dirty = !!present && JSON.stringify(present) !== savedSnapshot;
  const rules = React.useMemo(() => rulesOf(items), [items]);
  const state = present && record ? approvalState({ ...record, ...present }, rules) : "draft";
  const trigger = doc?.nodes.find((node) => node.kind === "trigger");
  const waitFirst =
    !!doc &&
    !!trigger &&
    doc.edges.some((e) => e.source === trigger.id && doc.nodes.find((n) => n.id === e.target)?.kind === "wait");

  const titles = React.useMemo(() => stepTitles(doc ?? { nodes: [], edges: [] }), [doc]);

  const issuesOf = React.useCallback(
    (nodeId: string | null) => issues.filter((issue) => issue.nodeId === nodeId),
    [issues],
  );

  const nodes: Node[] = React.useMemo(
    () =>
      (doc?.nodes ?? []).map((node) => {
        const own = issuesOf(node.id);
        const data: StepData = {
          node,
          title: titles.get(node.id) ?? node.kind,
          summary: summaryOf(node, waitFirst ? eventLabels[event] : undefined, flowName),
          errors: own.filter((i) => i.level === "error").map((i) => i.message),
          warnings: own.filter((i) => i.level === "warning").map((i) => i.message),
          free: doc ? freeExits(doc, node) : [],
        };
        return {
          id: node.id,
          type: "step",
          position: node.position,
          data,
          deletable: node.kind !== "trigger",
          selected: node.id === selected,
          ariaLabel: `${data.title}. ${data.summary.join(". ")}${data.errors.length ? `. ${data.errors.length} problem${data.errors.length === 1 ? "" : "s"}` : ""}`,
        };
      }),
    [doc, titles, issuesOf, selected, waitFirst, event, flowName],
  );

  const edges: Edge[] = React.useMemo(
    () =>
      (doc?.edges ?? []).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.handle,
        targetHandle: "in",
        type: "step",
        selected: selectedEdges.includes(edge.id),
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        ariaLabel: `Line from ${titles.get(edge.source)}${EXIT_WORD(edge.handle)} to ${titles.get(edge.target)}`,
      })),
    [doc, selectedEdges, titles],
  );

  // ------------------------------------------------------------------------------------------- editing
  const change = React.useCallback(
    (next: Partial<Snapshot>, coalesce?: string) => {
      if (!present) return;
      dispatch({ type: "set", next: { ...present, ...next }, coalesce, now: Date.now() });
    },
    [present],
  );

  const focusPanel = React.useCallback(() => {
    window.setTimeout(() => document.getElementById("inspector-title")?.focus(), 50);
  }, []);

  const select = React.useCallback(
    (nodeId: string | null, openPanel = true) => {
      setSelected(nodeId);
      setSelectedEdges([]);
      if (openPanel && !wide) setPanelOpen(true);
    },
    [wide],
  );

  const centerOn = React.useCallback(
    (nodeId: string) => {
      const node = flowApi.getNode(nodeId);
      if (!node) return;
      const w = node.measured?.width ?? NODE_WIDTH;
      const h = node.measured?.height ?? 110;
      void flowApi.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: Math.max(flowApi.getZoom(), 0.85),
        duration: reduced ? 0 : 300,
      });
    },
    [flowApi, reduced],
  );

  const jumpTo = React.useCallback(
    (issue: Issue) => {
      setProblemsOpen(false);
      select(issue.nodeId);
      if (issue.nodeId) centerOn(issue.nodeId);
      focusPanel();
    },
    [select, centerOn, focusPanel],
  );

  /** Where "add" from the palette goes when no step is selected: the first free exit down the first path. */
  const anchor = React.useCallback((): { id: string; handle: Handle } | null => {
    if (!doc) return null;
    const start = selected ? doc.nodes.find((n) => n.id === selected) : doc.nodes.find((n) => n.kind === "trigger");
    let node: FlowNode | undefined = start;
    const seen = new Set<string>();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      const free = freeExits(doc, node);
      if (free.length) return { id: node.id, handle: free[0] };
      if (selected) return null;
      const current: FlowNode = node;
      const next = doc.edges.find((e) => e.source === current.id);
      node = next ? doc.nodes.find((n) => n.id === next.target) : undefined;
    }
    return null;
  }, [doc, selected]);

  const canAddAfter = React.useCallback(
    (sourceId: string, handle: Handle, kind: NodeKind, variant?: string) => {
      if (!doc) return "Not ready";
      const tried = addAfter(doc, sourceId, handle, kind, event, sizes.current, variant);
      return "problem" in tried ? tried.problem : null;
    },
    [doc, event],
  );

  const addStepAfter = React.useCallback(
    (sourceId: string, handle: Handle, kind: NodeKind, variant?: string) => {
      if (!doc) return;
      const tried = addAfter(doc, sourceId, handle, kind, event, sizes.current, variant);
      if ("problem" in tried) {
        toast.error(tried.problem);
        return;
      }
      change({ doc: tried.doc });
      select(tried.id);
      window.setTimeout(() => centerOn(tried.id), 30);
      focusPanel();
    },
    [doc, event, change, select, centerOn, focusPanel],
  );

  const paletteProblem = React.useCallback(
    (kind: NodeKind, variant?: string) => {
      const at = anchor();
      if (at) return canAddAfter(at.id, at.handle, kind, variant);
      return selected ? "The selected step has no free exit." : null;
    },
    [anchor, canAddAfter, selected],
  );

  const addFromPalette = React.useCallback(
    (kind: NodeKind, variant?: string) => {
      if (!doc) return;
      setStepsOpen(false);
      const at = anchor();
      if (at) {
        // where the step would go is not allowed: say why, add nothing
        const problem = canAddAfter(at.id, at.handle, kind, variant);
        if (problem) toast.error(problem);
        else addStepAfter(at.id, at.handle, kind, variant);
        return;
      }
      // nowhere to attach it: put it on the canvas, unconnected, and say so
      const viewport = flowApi.getViewport();
      const box = root?.querySelector(".react-flow")?.getBoundingClientRect();
      const centre = box
        ? flowApi.screenToFlowPosition({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
        : { x: -viewport.x, y: -viewport.y };
      const placed = addLoose(doc, kind, { x: centre.x - NODE_WIDTH / 2, y: centre.y }, event, sizes.current, variant);
      change({ doc: placed.doc });
      select(placed.id);
      const label = STEP_CHOICES.find((c) => c.kind === kind && c.variant === variant)?.label ?? KIND_LOOK[kind].label;
      toast.message(`${label} added, not connected yet. Drag a line to it from the step it should follow.`);
    },
    [doc, anchor, canAddAfter, addStepAfter, flowApi, event, change, select, root],
  );

  /** M129-B: the palette's "Once per contact": set on the trigger, which opens so it can be changed back. */
  const oncePerContact = React.useCallback(() => {
    if (!present) return;
    setStepsOpen(false);
    const trigger = present.doc.nodes.find((n): n is TriggerNode => n.kind === "trigger");
    if (!trigger) return;
    change({
      doc: {
        ...present.doc,
        nodes: present.doc.nodes.map((n) => (n.id === trigger.id ? { ...trigger, repeat: "once_per_contact" } : n)),
      },
    });
    select(trigger.id);
    centerOn(trigger.id);
    focusPanel();
    toast.success("Set on the trigger: this flow now runs once per contact. Choose “Every time” there to undo.");
  }, [present, change, select, centerOn, focusPanel]);

  const onNodesChange = React.useCallback(
    (changes: NodeChange[]) => {
      if (!present) return;
      const positions: Record<string, XY> = {};
      let dragging = false;
      let ended = false;
      for (const c of changes) {
        if (c.type === "position") {
          if (c.position) positions[c.id] = c.position;
          if (c.dragging) dragging = true;
          else ended = true;
        }
        if (c.type === "dimensions" && c.dimensions) sizes.current[c.id] = c.dimensions;
        if (c.type === "select") {
          // a click, a tap or Enter on a focused step: on narrow screens this opens its settings sheet
          if (c.selected) select(c.id);
          else setSelected((current) => (current === c.id ? null : current));
        }
      }
      if (!Object.keys(positions).length && !ended) return;
      const next = { ...present, doc: moveNodes(present.doc, positions) };
      if (dragging) {
        dragFrom.current ??= present;
        dispatch({ type: "live", next });
      } else if (dragFrom.current) {
        const from = dragFrom.current;
        dragFrom.current = null;
        dispatch({ type: "live", next });
        if (JSON.stringify(from.doc) !== JSON.stringify(next.doc)) dispatch({ type: "settle", from });
      } else if (Object.keys(positions).length) {
        // arrow keys move a focused step: one undo step per step moved
        dispatch({ type: "set", next, coalesce: `move-${Object.keys(positions).join(",")}`, now: Date.now() });
      }
    },
    [present, select],
  );

  const onEdgesChange = React.useCallback((changes: EdgeChange[]) => {
    for (const c of changes)
      if (c.type === "select")
        setSelectedEdges((current) =>
          c.selected ? [...new Set([...current, c.id])] : current.filter((e) => e !== c.id),
        );
  }, []);

  const onDelete = React.useCallback(
    ({ nodes: goneNodes, edges: goneEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (!present) return;
      const nodeIds = goneNodes.map((n) => n.id);
      // lines that only disappear because their step is deleted are bridged by remove(), not cut here
      const edgeIds = goneEdges
        .filter((e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target))
        .map((e) => e.id);
      change({ doc: remove(present.doc, nodeIds, edgeIds) });
      setSelected(null);
      setSelectedEdges([]);
    },
    [present, change],
  );

  const onConnect = React.useCallback(
    (connection: { source: string; sourceHandle?: string | null; target: string }) => {
      if (!present) return;
      const done = connect(present.doc, {
        source: connection.source,
        handle: (connection.sourceHandle ?? "out") as Handle,
        target: connection.target,
      });
      if ("problem" in done) toast.error(done.problem);
      else change({ doc: done.doc });
    },
    [present, change],
  );

  const isValidConnection = React.useCallback(
    (connection: { source: string; sourceHandle?: string | null; target: string }) =>
      !!present &&
      connectionProblem(present.doc, {
        source: connection.source,
        handle: (connection.sourceHandle ?? "out") as Handle,
        target: connection.target,
      }) === null,
    [present],
  );

  // a refused line: say why (the line itself was never added)
  const onConnectEnd = React.useCallback(
    (_event: MouseEvent | TouchEvent, connection: FinalConnectionState) => {
      if (!present || connection.isValid || !connection.fromHandle || !connection.toNode) return;
      const reverse = connection.fromHandle.type === "target";
      const line = lineOf(
        { nodeId: connection.fromHandle.nodeId, handleId: connection.fromHandle.id ?? null },
        { nodeId: connection.toNode.id, handleId: connection.toHandle?.id ?? null },
        reverse,
      );
      const problem = connectionProblem(present.doc, line);
      if (problem) toast.error(problem);
    },
    [present],
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      const choice = parseChoice(e.dataTransfer.getData(PALETTE_DRAG_TYPE));
      if (!choice || !doc) return;
      const { kind, variant } = choice;
      e.preventDefault();
      // dropped on a step: put it under that step's first free exit
      const target = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-step-id]");
      const onStep = target?.getAttribute("data-step-id");
      if (onStep) {
        const node = doc.nodes.find((n) => n.id === onStep);
        const exit = node && freeExits(doc, node)[0];
        if (exit) {
          addStepAfter(onStep, exit, kind, variant);
          return;
        }
      }
      const point = flowApi.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const wanted = { x: point.x - NODE_WIDTH / 2, y: point.y - 30 };
      const placed = addLoose(doc, kind, wanted, event, sizes.current, variant);
      change({ doc: placed.doc });
      select(placed.id);
      // the spot was taken, so the step went to the nearest free one: bring it into view
      const spot = placed.doc.nodes.find((n) => n.id === placed.id)?.position;
      if (spot && (spot.x !== Math.round(wanted.x) || spot.y !== Math.round(wanted.y)))
        window.setTimeout(() => centerOn(placed.id), 30);
    },
    [doc, flowApi, event, change, select, addStepAfter, centerOn],
  );

  const tidy = React.useCallback(() => {
    if (!present) return;
    change({ doc: arrange(present.doc, sizes.current) });
    window.setTimeout(
      () => void flowApi.fitView({ padding: fitPadding(0.2), maxZoom: 1, duration: reduced ? 0 : 300 }),
      30,
    );
  }, [present, change, flowApi, reduced, fitPadding]);

  // ------------------------------------------------------------------------------------------- saving
  const upsert = (list: AutomationItem[], flow: FlowRecord): AutomationItem[] =>
    list.some((item) => item.kind === "flow" && item.flow.id === flow.id)
      ? list.map((item) => (item.kind === "flow" && item.flow.id === flow.id ? { kind: "flow", flow } : item))
      : [...list, { kind: "flow", flow }];

  const persist = async (nextItems: AutomationItem[], nextRecord: FlowRecord, success: string) => {
    if (!present) return false;
    setBusy(true);
    try {
      const saved = await saveAutomation(nextItems, rev);
      setRev(saved.rev);
      setItems(nextItems);
      setRecord(nextRecord);
      setSavedSnapshot(JSON.stringify(present));
      toast.success(success);
      // the address now names the saved flow (a reload opens it); replaceState keeps this editor and its undo history
      const hasSavedFlow = nextItems.some((item) => item.kind === "flow" && item.flow.id === nextRecord.id);
      if (hasSavedFlow) currentId.current = nextRecord.id;
      if (hasSavedFlow && !window.location.pathname.endsWith(`/flow/${nextRecord.id}`))
        window.history.replaceState(null, "", flowHref(nextRecord.id));
      return true;
    } catch (error) {
      if (error instanceof SectionConflict) setConflict(true);
      else toast.error(`Not saved: ${(error as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!present || !record) return;
    // An unchanged existing rule is a real revision-checked save, without creating a
    // drawing or changing its timestamps/template metadata merely by opening it.
    if (!dirty && Object.keys(record.ruleIds).length) {
      await persist(items, record, "Saved unchanged in this preview.");
      return;
    }
    const now = new Date().toISOString();
    const next: FlowRecord = { ...record, ...present, createdAt: record.createdAt || now, updatedAt: now };
    await persist(
      upsert(items, next),
      next,
      "Draft saved in this preview. The rules in the list do not change until you approve.",
    );
  };

  const askApprove = () => {
    if (!present || !record || !result) return;
    if (errors.length) {
      toast.error(`Fix ${errors.length} problem${errors.length === 1 ? "" : "s"} before approving.`);
      setProblemsOpen(true);
      jumpTo(errors[0]);
      return;
    }
    if (simMode) {
      setSimApproving(true);
      return;
    }
    setPlan(planApproval({ ...record, ...present }, result, rules, today(), () => Date.now()));
  };

  /** M129-B: approves a simulator flow: saved with its approval time; it makes no Chatwoot rule. */
  const confirmSimApprove = async () => {
    if (!present || !record) return;
    const now = new Date().toISOString();
    const next: FlowRecord = {
      ...record,
      ...present,
      createdAt: record.createdAt || now,
      updatedAt: now,
      simApprovedAt: now,
    };
    const ok = await persist(
      upsert(items, next),
      next,
      `Approved for the ${PRODUCT_NAME} simulator and saved in this preview. Nothing was sent to customers.`,
    );
    if (ok) setSimApproving(false);
  };

  const confirmApprove = async () => {
    if (!present || !record || !plan) return;
    if (!dirty && JSON.stringify(plan.rules) === JSON.stringify(rules)) {
      const ok = await persist(items, record, "Approved unchanged preview rules. Nothing was sent.");
      if (ok) setPlan(null);
      return;
    }
    const now = new Date().toISOString();
    const next: FlowRecord = {
      ...record,
      ...present,
      ruleIds: plan.ruleIds,
      createdAt: record.createdAt || now,
      updatedAt: now,
      approvedAt: now,
    };
    const ok = await persist(
      upsert(withRules(items, plan.rules), next),
      next,
      `Approved as preview rules: ${plan.updated.length + plan.created.length} rule${plan.updated.length + plan.created.length === 1 ? "" : "s"} saved in this preview's list. Nothing was sent.`,
    );
    if (ok) setPlan(null);
  };

  const keepMineAsCopy = async () => {
    if (!present || !record) return;
    setConflict(false);
    try {
      const latest = await loadAutomation();
      const now = new Date().toISOString();
      const copy: FlowRecord = {
        ...record,
        ...present,
        id: newFlowId(),
        name: `${present.name || "Flow"} (my copy)`,
        ruleIds: {},
        createdAt: now,
        updatedAt: now,
        approvedAt: null,
      };
      const saved = await saveAutomation([...latest.items, { kind: "flow", flow: copy }], latest.rev);
      setItems([...latest.items, { kind: "flow", flow: copy }]);
      setRev(saved.rev);
      setRecord(copy);
      dispatch({ type: "reset", snapshot: { name: copy.name, description: copy.description, doc: copy.doc } });
      setSavedSnapshot(JSON.stringify({ name: copy.name, description: copy.description, doc: copy.doc }));
      toast.success("Your version is saved as a new draft. The other tab's save is kept as it was.");
      currentId.current = copy.id;
      window.history.replaceState(null, "", flowHref(copy.id));
    } catch (error) {
      toast.error(`Not saved: ${(error as Error).message}`);
    }
  };

  const deleteFlow = async () => {
    if (!record) return;
    setDeleting(false);
    const exists = items.some((item) => item.kind === "flow" && item.flow.id === record.id);
    if (!exists) {
      router.push(LIST_HREF);
      return;
    }
    setBusy(true);
    try {
      await saveAutomation(
        items.filter((item) => !(item.kind === "flow" && item.flow.id === record.id)),
        rev,
      );
      setSavedSnapshot(JSON.stringify(present));
      toast.success("Flow drawing deleted. Rules it made before stay in the Automation list.");
      router.push(LIST_HREF);
    } catch (error) {
      if (error instanceof SectionConflict) setConflict(true);
      else toast.error(`Not deleted: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------------------------------- keyboard / leaving
  // Shortcuts listen on the window: after dragging a step with the mouse the focus is back on the page, and
  // Ctrl/⌘+Z must still undo it. Typing in a field or working in a dialog keeps the browser's own keys.
  React.useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector("[role=dialog],[role=alertdialog]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveDraft();
      } else if (e.key === "Escape") {
        setSelected(null);
        setSelectedEdges([]);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // the canvas changes size when the layout switches (side panel, rail, phone): fit the drawing again
  // biome-ignore lint/correctness/useExhaustiveDependencies: wide and phone are the trigger, not values read inside.
  React.useEffect(() => {
    if (loaded.state !== "ready") return;
    let timer = 0;
    let tries = 0;
    const fit = () => {
      // React Flow re-measures the canvas a frame later; until it has the new size, a fit would centre for the old one
      const { width, domNode } = flowStore.getState();
      if (domNode && Math.abs(domNode.offsetWidth - width) > 1 && tries++ < 10) {
        timer = window.setTimeout(fit, 80);
        return;
      }
      void flowApi.fitView({ padding: fitPadding(0.25), maxZoom: 1, duration: 0 });
    };
    timer = window.setTimeout(fit, 80);
    return () => window.clearTimeout(timer);
  }, [wide, phone, loaded.state, flowApi]);

  // a step undone away is no longer selected
  React.useEffect(() => {
    if (selected && doc && !doc.nodes.some((n) => n.id === selected)) setSelected(null);
  }, [doc, selected]);

  const canvasActions = React.useMemo(() => ({ addAfter: addStepAfter, canAddAfter }), [addStepAfter, canAddAfter]);

  // ------------------------------------------------------------------------------------------- render
  if (loaded.state !== "ready" || !present || !record || !result) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href={LIST_HREF}
          className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Automation
        </Link>
        <div
          className="grid min-h-60 place-items-center rounded-xl border bg-card p-6 text-center text-sm"
          role="status"
        >
          {loaded.state === "loading" ? <p className="text-muted-foreground">Opening the flow…</p> : null}
          {loaded.state === "error" ? (
            <div className="grid gap-3">
              <p>Automation could not be loaded: {loaded.message}. Nothing was changed.</p>
              <Button variant="outline" size="sm" className="mx-auto" onClick={() => void open()}>
                Try again
              </Button>
            </div>
          ) : null}
          {loaded.state === "missing" ? <p>{loaded.message}</p> : null}
          {loaded.state === "refused" ? (
            <div className="grid max-w-lg gap-2">
              <p className="font-medium">“{loaded.rule.name}” cannot be drawn without changing it.</p>
              <p className="text-muted-foreground">{loaded.reason}</p>
              <p className="text-muted-foreground">The text form still edits it in the Automation list.</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const selectedNode = selected ? present.doc.nodes.find((n) => n.id === selected) : undefined;
  const flowIssues = issuesOf(null);
  const ruleState = Object.values(record.ruleIds)
    .map((ruleId) => rules.find((r) => r.id === ruleId))
    .filter((r): r is Rule => !!r)
    .map((r) => ({ name: r.name, active: r.active }));

  const inspector = selectedNode ? (
    <StepInspector
      key={selectedNode.id}
      node={selectedNode}
      title={titles.get(selectedNode.id) ?? ""}
      issues={issuesOf(selectedNode.id)}
      event={event}
      waitFirst={waitFirst}
      inSheet={!wide}
      onChange={(node) =>
        change(
          { doc: { ...present.doc, nodes: present.doc.nodes.map((n) => (n.id === node.id ? node : n)) } },
          `node-${node.id}`,
        )
      }
      onDelete={() => {
        change({ doc: remove(present.doc, [selectedNode.id]) });
        setSelected(null);
        setPanelOpen(false);
      }}
    />
  ) : (
    <FlowInspector
      name={present.name}
      description={present.description}
      onName={(name) => change({ name }, "name")}
      onDescription={(description) => change({ description }, "description")}
      issues={flowIssues}
      paths={result.paths}
      ruleState={ruleState}
      inSheet={!wide}
      simReasons={simReasons.map((r) => r.reason)}
      settings={present.doc.settings ?? {}}
      onSettings={(settings) => change({ doc: { ...present.doc, settings } }, "settings")}
    />
  );

  const badges = {
    approved: <ToneBadge tone="green">Approved · matches the rules</ToneBadge>,
    changed: <ToneBadge tone="sky">Changes not approved yet</ToneBadge>,
    draft: <ToneBadge tone="gray">Draft · not approved</ToneBadge>,
  };
  // M129-B: a simulator flow is approved for the simulator, not as Chatwoot rules
  const simState = !record.simApprovedAt ? "draft" : record.updatedAt === record.simApprovedAt ? "approved" : "changed";
  const simBadges = {
    approved: <ToneBadge tone="green">Approved for the simulator</ToneBadge>,
    changed: <ToneBadge tone="sky">Changes not approved yet</ToneBadge>,
    draft: <ToneBadge tone="gray">Draft · not approved</ToneBadge>,
  };
  const statusBadge = dirty ? (
    <ToneBadge tone="amber">Unsaved changes</ToneBadge>
  ) : simMode ? (
    simBadges[simState]
  ) : (
    badges[state]
  );

  const problemsButton = (
    <Popover open={problemsOpen} onOpenChange={setProblemsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={errors.length ? "destructive" : "outline"}
          size="sm"
          data-testid="problems-button"
          aria-label={errors.length ? `${errors.length} problems` : "No problems"}
        >
          {errors.length ? <TriangleAlert /> : <CheckCircle2 />}
          {errors.length ? `${errors.length} problem${errors.length === 1 ? "" : "s"}` : "No problems"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-3 py-2 font-medium text-sm">Problems to fix before approving</div>
        {issues.length ? (
          <ul className="max-h-80 overflow-y-auto p-1">
            {issues.map((issue, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: problems have no id; order is stable per drawing.
              <li key={index}>
                <button
                  type="button"
                  data-issue-node={issue.nodeId ?? "flow"}
                  onClick={() => jumpTo(issue)}
                  className="flex w-full gap-2 rounded-md p-2 text-left text-xs leading-relaxed hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <TriangleAlert
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      issue.level === "error" ? "text-destructive" : "text-amber-600",
                    )}
                  />
                  <span>
                    <span className="font-medium">{issue.nodeId ? titles.get(issue.nodeId) : "Flow settings"}: </span>
                    {issue.message}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-3 text-muted-foreground text-sm">
            {simMode
              ? `Nothing to fix. The flow can be approved for the ${PRODUCT_NAME} simulator.`
              : "Nothing to fix. The drawing can become engine rules."}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );

  const compactBar = width < 860;
  const dryResults = dryOpen ? dryRun(result, drySamples, ids, present) : [];

  return (
    <SimOptionsContext.Provider value={simOptions}>
      <CanvasActionsContext.Provider value={canvasActions}>
        <div
          ref={setRoot}
          className="automation-flow flex h-[calc(100dvh-7rem)] min-h-[34rem] flex-col overflow-hidden rounded-xl border bg-card"
          data-testid="flow-editor"
        >
          <style>{`
          .automation-flow .react-flow__node:focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; border-radius: 0.85rem; }
          .automation-flow .react-flow__edge:focus-visible .react-flow__edge-path,
          .automation-flow .react-flow__edge.selected .react-flow__edge-path { stroke: var(--primary); }
          .automation-flow .react-flow__connection-path { stroke: var(--primary); stroke-width: 2; }
          @media (prefers-reduced-motion: reduce) { .automation-flow *, .automation-flow *::before, .automation-flow *::after { transition: none !important; animation: none !important; } }
        `}</style>
          <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (dirty ? setLeaving(true) : router.push(LIST_HREF))}
              aria-label="Back to Automation"
            >
              <ArrowLeft /> {compactBar ? null : "Automation"}
            </Button>
            <div className="grid min-w-0 basis-48 flex-1 gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate font-semibold text-base" dir="auto">
                  {present.name || "Untitled flow"}
                </h1>
                {statusBadge}
              </div>
              <p className="text-muted-foreground text-xs leading-snug" data-testid="honest-line">
                {SIM_HONEST_LINE}
              </p>
            </div>
            <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1.5">
              {!compactBar ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Undo"
                    title="Undo (Ctrl/⌘ Z)"
                    disabled={!history.past.length}
                    onClick={() => dispatch({ type: "undo" })}
                  >
                    <Undo2 />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Redo"
                    title="Redo (Shift Ctrl/⌘ Z)"
                    disabled={!history.future.length}
                    onClick={() => dispatch({ type: "redo" })}
                  >
                    <Redo2 />
                  </Button>
                  <Button variant="outline" size="sm" onClick={tidy}>
                    <LayoutGrid /> Arrange
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDryOpen(true)}>
                    <FlaskConical /> Dry run
                  </Button>
                </>
              ) : null}
              {problemsButton}
              {!wide ? (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Flow settings"
                  onClick={() => {
                    setSelected(null);
                    setPanelOpen(true);
                  }}
                >
                  <Settings2 />
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => void saveDraft()} disabled={busy}>
                <Save /> Save draft
              </Button>
              <Button size="sm" onClick={askApprove} disabled={busy} data-testid="approve-button">
                <ShieldCheck />{" "}
                {compactBar ? "Approve" : simMode ? "Approve for the simulator" : "Approve as preview rules"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {compactBar ? (
                    <>
                      <DropdownMenuItem disabled={!history.past.length} onSelect={() => dispatch({ type: "undo" })}>
                        <Undo2 /> Undo
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!history.future.length} onSelect={() => dispatch({ type: "redo" })}>
                        <Redo2 /> Redo
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={tidy}>
                        <LayoutGrid /> Arrange
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDryOpen(true)}>
                        <FlaskConical /> Dry run
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                    <Trash2 /> Delete this flow drawing
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          {record.template ? (
            <TemplateNotice
              template={record.template}
              doc={present.doc}
              compact={compactBar}
              onJump={(nodeId) => {
                select(nodeId);
                centerOn(nodeId);
              }}
            />
          ) : null}

          <div className="flex min-h-0 flex-1">
            {!phone ? (
              <aside
                aria-label="Steps"
                className={cn("shrink-0 overflow-y-auto border-r", wide ? "w-60 p-3" : "w-[4.25rem] p-2")}
              >
                <Palette
                  compact={!wide}
                  onAdd={addFromPalette}
                  canAdd={paletteProblem}
                  onOncePerContact={oncePerContact}
                />
                {!wide ? (
                  <Button
                    variant="ghost"
                    className="mt-4 h-auto w-full flex-col gap-0.5 border border-dashed px-0 py-1.5 text-[10px] text-muted-foreground"
                    aria-label="All steps, with what each one does"
                    title="All steps"
                    onClick={() => setStepsOpen(true)}
                  >
                    <ListPlus /> All steps
                  </Button>
                ) : null}
              </aside>
            ) : null}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target for steps dragged from the palette. */}
            <div
              className="relative min-w-0 flex-1"
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={onDrop}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onDelete={onDelete}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                isValidConnection={isValidConnection}
                onPaneClick={() => {
                  setSelected(null);
                  setSelectedEdges([]);
                }}
                deleteKeyCode={["Delete", "Backspace"]}
                fitView
                fitViewOptions={{ padding: fitPadding(0.25), maxZoom: 1 }}
                // Item 147 (Fahad: no links to their sites): hide the reactflow.dev attribution link. The library is MIT, which does not require it.
                proOptions={{ hideAttribution: true }}
                minZoom={0.2}
                maxZoom={1.75}
                nodesFocusable
                edgesFocusable
                autoPanOnNodeFocus
                selectNodesOnDrag={false}
                multiSelectionKeyCode={null}
                style={
                  {
                    "--xy-background-color": "transparent",
                    "--xy-background-pattern-color": "var(--border)",
                    "--xy-edge-stroke": "color-mix(in oklch, var(--muted-foreground) 70%, transparent)",
                    "--xy-edge-stroke-selected": "var(--primary)",
                    "--xy-connectionline-stroke": "var(--primary)",
                    "--xy-handle-background-color": "var(--background)",
                    "--xy-handle-border-color": "var(--muted-foreground)",
                    "--xy-controls-button-background-color": "var(--card)",
                    "--xy-controls-button-background-color-hover": "var(--muted)",
                    "--xy-controls-button-color": "var(--foreground)",
                    "--xy-controls-button-color-hover": "var(--foreground)",
                    "--xy-controls-button-border-color": "var(--border)",
                    "--xy-minimap-background-color": "var(--card)",
                    "--xy-minimap-mask-background-color": "color-mix(in oklch, var(--muted) 60%, transparent)",
                    "--xy-minimap-node-background-color": "var(--muted)",
                    "--xy-attribution-background-color": "transparent",
                  } as React.CSSProperties
                }
                aria-label="Flow canvas"
              >
                <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
                <Controls
                  showInteractive={false}
                  position="bottom-left"
                  fitViewOptions={{ padding: fitPadding(0.25), maxZoom: 1, duration: reduced ? 0 : 300 }}
                />
                {wide ? (
                  <MiniMap
                    pannable
                    zoomable
                    position="top-right"
                    ariaLabel="Map of the whole flow"
                    style={{ width: 132, height: 88 }}
                    className="!rounded-lg !border"
                  />
                ) : null}
              </ReactFlow>
              <p className="pointer-events-none absolute top-2 left-1/2 hidden -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1 text-muted-foreground text-xs shadow-xs sm:block">
                Steps: {present.doc.nodes.length - 1} ·{" "}
                {simMode
                  ? `${PRODUCT_NAME} simulator`
                  : `${result.paths.length} rule${result.paths.length === 1 ? "" : "s"}`}
              </p>
              {phone ? (
                <Button className="absolute right-3 bottom-3 shadow-md" size="sm" onClick={() => setStepsOpen(true)}>
                  <ListPlus /> Add step
                </Button>
              ) : null}
            </div>
            {wide ? (
              <aside aria-label="Step settings" className="w-[22rem] shrink-0 overflow-y-auto border-l p-4">
                {inspector}
              </aside>
            ) : null}
          </div>
        </div>

        {!wide ? (
          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetContent
              side={phone ? "bottom" : "right"}
              className={cn("overflow-y-auto", phone ? "max-h-[85dvh]" : "w-[24rem] sm:max-w-[24rem]")}
            >
              <SheetHeader>
                <SheetTitle>{selectedNode ? titles.get(selectedNode.id) : "Flow settings"}</SheetTitle>
                <SheetDescription>Changes show on the canvas right away. Save draft keeps them.</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">{inspector}</div>
            </SheetContent>
          </Sheet>
        ) : null}

        <Sheet open={stepsOpen} onOpenChange={setStepsOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add a step</SheetTitle>
              <SheetDescription>
                Added under the selected step, or under the last step of the first path.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <Palette
                compact={false}
                onAdd={addFromPalette}
                canAdd={paletteProblem}
                onOncePerContact={oncePerContact}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={dryOpen} onOpenChange={setDryOpen}>
          <SheetContent
            side={phone ? "bottom" : "right"}
            // the sheet's own width classes carry data-[side=right]: so the wider dry run sets the same variant
            className={cn(
              "overflow-y-auto",
              phone ? "max-h-[85dvh]" : "data-[side=right]:w-[36rem] data-[side=right]:sm:max-w-[36rem]",
            )}
          >
            <SheetHeader>
              <SheetTitle>Dry run in the {PRODUCT_NAME} simulator</SheetTitle>
              <SheetDescription>
                Plays the whole flow on a made-up conversation for each channel: what it would send and when, the waits
                (the clock moves forward), the branches and the attachment checks. Nothing is sent, nothing changes, and
                none of them is a real customer.
              </SheetDescription>
            </SheetHeader>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 px-4" data-testid="sim-dry-run-wrap">
              {ruleState.some((rule) => !rule.active) ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-amber-700 text-xs dark:text-amber-400">
                  {ruleState
                    .filter((rule) => !rule.active)
                    .map((rule) => rule.name)
                    .join(", ")}{" "}
                  is turned off in the Automation list, so it would not run until it is turned on there. The dry run
                  plays it anyway.
                </p>
              ) : null}
              <SimDryRun
                doc={present.doc}
                ctx={simContext}
                onJump={(nodeId) => {
                  setDryOpen(false);
                  select(nodeId);
                  centerOn(nodeId);
                }}
              />
            </div>
            <div className="grid gap-3 px-4 pt-2 pb-6" data-testid="dry-run">
              <p className="border-t pt-3 font-medium text-sm">Which made-up conversations match (engine rules)</p>
              {simMode ? (
                <p className="text-muted-foreground text-xs" data-dry-match="simulator">
                  This flow runs in the {PRODUCT_NAME} simulator, so the engine's rule matching does not apply: see the
                  timelines above.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Pretends “{eventLabels[event]}” just happened on each conversation below, read the way the engine's
                  rules read it.
                </p>
              )}
              {errors.length && !simMode ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-amber-700 text-xs dark:text-amber-400">
                  {errors.length} problem{errors.length === 1 ? "" : "s"} left: paths that cannot become rules yet are
                  left out.
                </p>
              ) : null}
              {(simMode ? [] : dryResults).map(({ sample, message, matched }) => (
                <div key={sample.id} className="grid gap-1.5 rounded-lg border p-3" data-dry-sample={sample.id}>
                  <p className="font-medium text-sm" dir="auto">
                    {sample.title}
                  </p>
                  <p className="text-muted-foreground text-xs">{sample.summary}</p>
                  {message ? (
                    <p className="text-muted-foreground text-xs" dir="auto">
                      New message ({message.private ? "private note" : message.message_type}): “
                      {message.content ?? "attachment, no text"}”
                    </p>
                  ) : null}
                  {matched.length ? (
                    matched.map((path) => {
                      const rule = ruleForPath(path, present.name, present.description);
                      return (
                        <div
                          key={path.key}
                          className="grid gap-1 rounded-md bg-emerald-500/5 p-2 text-xs"
                          data-dry-match={path.key}
                        >
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {path.label ? `Path ${path.label} matches` : "Matches"}
                            {rule.runType === "delayed" && rule.wait
                              ? `: a wait of ${durationText(rule.wait.amount, rule.wait.unit)} would start, then the engine checks again`
                              : ""}
                          </span>
                          <ol className="list-decimal pl-4 text-muted-foreground">
                            {rule.actions.map((action, index) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: actions have no id; order is the identity.
                              <li key={index}>
                                {actionDefs[action.action]?.label ?? action.action}
                                {action.values.length ? `: ${action.values.join(", ")}` : ""}
                              </li>
                            ))}
                          </ol>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-muted-foreground text-xs" data-dry-match="none">
                      No path matches: nothing would happen.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={!!plan} onOpenChange={(o) => !o && setPlan(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Approve as preview rules</DialogTitle>
              <DialogDescription>
                The rules below are saved in this preview's Automation list only. Nothing is sent to the engine or to
                any customer, and nothing runs in this preview.
              </DialogDescription>
            </DialogHeader>
            {plan ? (
              <div className="grid gap-3 text-sm" data-testid="approve-plan">
                {plan.updated.length ? (
                  <p>
                    <span className="font-medium">Updates:</span>{" "}
                    {plan.updated.map((ruleId) => plan.rules.find((r) => r.id === ruleId)?.name).join(", ")} (same rule,
                    same on/off).
                  </p>
                ) : null}
                {plan.created.length ? (
                  <p>
                    <span className="font-medium">New:</span>{" "}
                    {plan.created.map((ruleId) => plan.rules.find((r) => r.id === ruleId)?.name).join(", ")}. New rules
                    start turned off; turn them on in the list.
                  </p>
                ) : null}
                {plan.removed.length ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                    Removes: {plan.removed.map((ruleId) => rules.find((r) => r.id === ruleId)?.name).join(", ")} (its
                    path is no longer in the drawing).
                  </p>
                ) : null}
                {plan.updated.some((ruleId) => {
                  const before = rules.find((r) => r.id === ruleId);
                  const after = plan.rules.find((r) => r.id === ruleId);
                  return JSON.stringify(before) !== JSON.stringify(after);
                }) ? (
                  <p className="text-muted-foreground text-xs">
                    Rules that changed since the last approval (here or in the form) take the drawing's version.
                  </p>
                ) : null}
                <details className="rounded-lg border p-2">
                  <summary className="cursor-pointer font-medium text-sm">
                    The rules as the engine's API takes them (JSON)
                  </summary>
                  <pre
                    className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-[11px] leading-relaxed"
                    dir="ltr"
                  >
                    {JSON.stringify(
                      plan.rules
                        .filter((r) => [...plan.updated, ...plan.created].includes(r.id))
                        .map((r) => toChatwootRule(r, ids)),
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={() => void confirmApprove()} disabled={busy} data-testid="confirm-approve">
                <ShieldCheck /> Approve {plan ? plan.updated.length + plan.created.length : 0} preview rule
                {plan && plan.updated.length + plan.created.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={simApproving} onOpenChange={setSimApproving}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Approve for the {PRODUCT_NAME} simulator</DialogTitle>
              <DialogDescription>
                This flow uses steps the engine's (v4.18) rules cannot run, so it makes no engine rule. It is saved as
                an approved simulator flow: the dry run plays it, and nothing is sent to real customers.
              </DialogDescription>
            </DialogHeader>
            <ul className="grid list-disc gap-1 pl-5 text-sm" data-testid="sim-approve-reasons">
              {[...new Set(simReasons.map((r) => r.reason))].map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {Object.keys(record.ruleIds).length ? (
              <p className="text-muted-foreground text-xs">
                The rules this flow made before stay in the Automation list as they are; turn them off or delete them
                there.
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={() => void confirmSimApprove()} disabled={busy} data-testid="confirm-sim-approve">
                <ShieldCheck /> Approve for the simulator
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={conflict} onOpenChange={setConflict}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Saved from another tab</AlertDialogTitle>
              <AlertDialogDescription>
                Automation was saved from another tab or device after you opened this flow, so this save was refused and
                nothing was overwritten.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setConflict(false);
                  void open();
                }}
              >
                Load the latest (drop my changes)
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => void keepMineAsCopy()}>Keep mine as a new draft</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={leaving} onOpenChange={setLeaving}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
              <AlertDialogDescription>The changes to this flow are not saved yet.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setSavedSnapshot(JSON.stringify(present));
                  router.push(LIST_HREF);
                }}
              >
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleting} onOpenChange={setDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this flow drawing?</AlertDialogTitle>
              <AlertDialogDescription>
                Only the drawing is deleted. Rules it made before stay in the Automation list, where the text form edits
                them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={() => void deleteFlow()}>Delete drawing</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CanvasActionsContext.Provider>
    </SimOptionsContext.Provider>
  );
}

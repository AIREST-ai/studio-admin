// T-139: the edits the canvas makes, as plain functions on a FlowDoc (no React), so undo/redo is just "keep the
// previous doc" and the tests can run them outside the browser. Every new line goes through connectionProblem().
import { blankAction, blankCondition, type EventKey } from "./catalog";
import { connectionProblem } from "./compile";
import { exitsOf, type FlowDoc, type FlowEdge, type FlowNode, type Handle, type NodeKind, type XY } from "./model";

export const NODE_WIDTH = 272;
export const NODE_HEIGHT = 116;
/** Room checked around a card when placing one (a condition with three rows is about this tall). */
const PLACE_HEIGHT = 150;
const GAP_X = 48;
/** Under a step with two exits there are the exit labels (Yes/Else, Replied/No reply…) and the "+" buttons, so its
 * children sit lower. */
const gapBelow = (node: FlowNode) => (exitsOf(node).length === 2 ? 104 : 72);

export type Sizes = Record<string, { width: number; height: number }>;
const widthOf = (sizes: Sizes, id: string) => sizes[id]?.width ?? NODE_WIDTH;
const heightOf = (sizes: Sizes, id: string) => sizes[id]?.height ?? NODE_HEIGHT;
/** Where the exit sits across a card: the first of two exits (Yes, Replied, A, Success) at 28 %, the second (Else, No
 * reply, B, Failure) at 72 %, the single exit in the middle (canvas-parts.tsx). */
const EXIT_AT: Record<Handle, number> = {
  out: 0.5,
  yes: 0.28,
  no: 0.72,
  replied: 0.28,
  noreply: 0.72,
  a: 0.28,
  b: 0.72,
  success: 0.28,
  failure: 0.72,
};
/** The first of two exits goes left, the second right. */
const leftExit = (handle: Handle) => EXIT_AT[handle] < 0.5;

function isFree(doc: FlowDoc, sizes: Sizes, spot: XY, ignore: string): boolean {
  const margin = 24;
  return doc.nodes.every((n) => {
    if (n.id === ignore) return true;
    const w = widthOf(sizes, n.id);
    const h = Math.max(heightOf(sizes, n.id), PLACE_HEIGHT);
    return (
      spot.x + NODE_WIDTH + margin <= n.position.x ||
      n.position.x + w + margin <= spot.x ||
      spot.y + PLACE_HEIGHT + margin <= n.position.y ||
      n.position.y + h + margin <= spot.y
    );
  });
}

/**
 * The nearest free spot to `wanted`: half-card steps sideways and down, nearest first, with `direction` (Else and
 * single exits look right first, Yes left first) winning a tie. So a step lands next to where it was put, not far off.
 */
export function freeSpot(doc: FlowDoc, wanted: XY, direction: 1 | -1 = 1, sizes: Sizes = {}, ignore = ""): XY {
  const stepX = (NODE_WIDTH + GAP_X) / 2;
  const stepY = (PLACE_HEIGHT + 32) / 2;
  const candidates: { spot: XY; cost: number }[] = [];
  for (let down = 0; down <= 16; down++)
    for (let side = -12; side <= 12; side++)
      candidates.push({
        spot: { x: Math.round(wanted.x + side * stepX), y: Math.round(wanted.y + down * stepY) },
        cost: Math.abs(side) + down * 1.25 + (side !== 0 && Math.sign(side) !== direction ? 0.5 : 0),
      });
  candidates.sort((x, y) => x.cost - y.cost);
  return candidates.find((c) => isFree(doc, sizes, c.spot, ignore))?.spot ?? wanted;
}

export { exitsOf };

export function freeExits(doc: FlowDoc, node: FlowNode): Handle[] {
  return exitsOf(node).filter((handle) => !doc.edges.some((e) => e.source === node.id && e.handle === handle));
}

export function nextId(doc: FlowDoc, kind: NodeKind): string {
  let n = doc.nodes.filter((node) => node.kind === kind).length + 1;
  while (doc.nodes.some((node) => node.id === `${kind}-${n}`)) n++;
  return `${kind}-${n}`;
}

const edgeId = (source: string, handle: Handle, target: string) => `e-${source}-${handle}-${target}`;

/**
 * A new step with the same starting values as the text form (rule-form.tsx draftFrom / blankCondition / blankAction).
 * M129-B: `variant` starts an action as a given action (the palette's "Update a contact field", "Send attachment").
 * The simulator steps start empty where the teammate must choose (question, address, flow), so the checks ask for it.
 */
export function blankNode(kind: NodeKind, id: string, position: XY, event: EventKey, variant?: string): FlowNode {
  switch (kind) {
    case "trigger":
      return { id, kind, position, event: "conversation_created" };
    case "wait":
      return {
        id,
        kind,
        position,
        wait: { trigger: "conversation_status", status: "Pending", amount: 4, unit: "hours", inboxes: [] },
      };
    case "condition":
      return { id, kind, position, rows: [blankCondition(event)] };
    case "action":
      return { id, kind, position, action: variant ? { action: variant, values: [] } : blankAction() };
    case "ask":
      // respond.io: the reply time limit is up to 7 days, and 7 days when none is set (step-ask-a-question)
      return {
        id,
        kind,
        position,
        ask: { question: "", answers: [], saveTo: "", timeout: { amount: 7, unit: "days" } },
      };
    case "delay":
      return { id, kind, position, delay: { amount: 30, unit: "seconds" } };
    case "split":
      return { id, kind, position, split: { percentA: 50 } };
    case "http":
      return {
        id,
        kind,
        position,
        http: { method: "POST", url: "", body: "", mockStatus: 200, mockBody: '{"ok":true}', saveTo: "" },
      };
    case "goto":
      return { id, kind, position, goto: { flowId: "" } };
  }
}

export function connect(
  doc: FlowDoc,
  line: { source: string; handle: Handle; target: string },
): { doc: FlowDoc } | { problem: string } {
  const problem = connectionProblem(doc, line);
  if (problem) return { problem };
  const edge: FlowEdge = { id: edgeId(line.source, line.handle, line.target), ...line };
  return { doc: { ...doc, edges: [...doc.edges, edge] } };
}

/** A step dropped on the canvas, not connected yet (the checks show "Not connected" until it is). Never on another. */
export function addLoose(
  doc: FlowDoc,
  kind: NodeKind,
  position: XY,
  event: EventKey,
  sizes: Sizes = {},
  variant?: string,
): { doc: FlowDoc; id: string } {
  const id = nextId(doc, kind);
  const spot = freeSpot(doc, position, 1, sizes);
  return { doc: { ...doc, nodes: [...doc.nodes, blankNode(kind, id, spot, event, variant)] }, id };
}

/**
 * A new step under `source`'s exit, on free space: under Yes it goes left, under Else right, under a single exit
 * straight down. If that exit already leads somewhere, the new step goes in between (source -> new -> old next) and
 * the steps below move down to make room, as respond.io's "+" on a line does.
 */
export function addAfter(
  doc: FlowDoc,
  sourceId: string,
  handle: Handle,
  kind: NodeKind,
  event: EventKey,
  sizes: Sizes = {},
  variant?: string,
): { doc: FlowDoc; id: string } | { problem: string } {
  const source = doc.nodes.find((node) => node.id === sourceId);
  if (!source) return { problem: "That step no longer exists." };
  const id = nextId(doc, kind);
  const old = doc.edges.find((e) => e.source === sourceId && e.handle === handle);
  let next: FlowDoc = {
    ...doc,
    nodes: [...doc.nodes, blankNode(kind, id, { x: 0, y: 0 }, event, variant)],
    edges: doc.edges.filter((e) => e !== old),
  };
  const first = connect(next, { source: sourceId, handle, target: id });
  if ("problem" in first) return first;
  next = first.doc;
  const direction: 1 | -1 = leftExit(handle) ? -1 : 1;
  let wanted: XY;
  if (old) {
    // the old next step hangs from the new step's first exit (Yes, Replied, A, Success, or its only one)
    const onward: Handle | undefined = exitsOf({ kind })[0];
    if (!onward) return { problem: "“Go to another flow” ends its path, so it cannot go between two steps." };
    const second = connect(next, { source: id, handle: onward, target: old.target });
    if ("problem" in second) return { problem: `Cannot put it here: ${second.problem}` };
    next = second.doc;
    // the new step takes the old next step's place; that step and everything under it move down
    const target = doc.nodes.find((n) => n.id === old.target);
    wanted = target
      ? { ...target.position }
      : { x: source.position.x, y: source.position.y + heightOf(sizes, sourceId) + 72 };
    const below = new Set<string>();
    const stack = [old.target];
    while (stack.length) {
      const at = stack.pop() as string;
      if (below.has(at)) continue;
      below.add(at);
      for (const e of next.edges) if (e.source === at) stack.push(e.target);
    }
    const shift = PLACE_HEIGHT + gapBelow(blankNode(kind, id, wanted, event, variant));
    next = {
      ...next,
      nodes: next.nodes.map((n) =>
        below.has(n.id) ? { ...n, position: { x: n.position.x, y: n.position.y + shift } } : n,
      ),
    };
  } else {
    const centre = source.position.x + widthOf(sizes, sourceId) / 2;
    // under a condition each branch gets its own column: Yes to the left, Else to the right
    const offset = handle === "out" ? 0 : (direction * (NODE_WIDTH + GAP_X)) / 2;
    wanted = {
      x: Math.round(centre + offset - NODE_WIDTH / 2),
      y: source.position.y + heightOf(sizes, sourceId) + gapBelow(source),
    };
  }
  const spot = freeSpot(next, wanted, direction, sizes, id);
  next = { ...next, nodes: next.nodes.map((n) => (n.id === id ? { ...n, position: spot } : n)) };
  return { doc: next, id };
}

/**
 * Deletes steps and lines. A deleted step that sat between two steps on a single line is bridged (before -> after)
 * when that line is allowed, so deleting the middle of a chain does not cut it. The trigger is never deleted.
 */
export function remove(doc: FlowDoc, nodeIds: string[], edgeIds: string[] = []): FlowDoc {
  const gone = new Set(nodeIds.filter((id) => doc.nodes.find((n) => n.id === id)?.kind !== "trigger"));
  let next: FlowDoc = { ...doc, nodes: doc.nodes, edges: doc.edges.filter((e) => !edgeIds.includes(e.id)) };
  for (const id of gone) {
    const incoming = next.edges.find((e) => e.target === id);
    const outgoing = next.edges.filter((e) => e.source === id);
    next = {
      ...next,
      nodes: next.nodes.filter((n) => n.id !== id),
      edges: next.edges.filter((e) => e.source !== id && e.target !== id),
    };
    if (incoming && outgoing.length === 1 && !gone.has(incoming.source)) {
      const bridged = connect(next, { source: incoming.source, handle: incoming.handle, target: outgoing[0].target });
      if ("doc" in bridged) next = bridged.doc;
    }
  }
  return next;
}

export function moveNodes(doc: FlowDoc, positions: Record<string, XY>): FlowDoc {
  return { ...doc, nodes: doc.nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n)) };
}

export function updateNode(doc: FlowDoc, id: string, change: (node: FlowNode) => FlowNode): FlowDoc {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? change(n) : n)) };
}

/**
 * Top-to-bottom tidy layout of the tree. Every condition keeps Yes on the left and Else on the right, each branch in
 * its own column (a branch never reaches into the other's), so their lines never share a strip. A branch alone
 * sits under its own exit. Steps not connected yet are laid out to the right of the tree. Only positions change.
 */
export function arrange(doc: FlowDoc, sizes: Sizes = {}): FlowDoc {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const childrenOf = (node: FlowNode) =>
    exitsOf(node).flatMap((handle) => {
      const edge = doc.edges.find((e) => e.source === node.id && e.handle === handle);
      return edge && byId.has(edge.target) ? [{ handle, id: edge.target }] : [];
    });
  interface Shape {
    left: number;
    right: number;
    kids: { id: string; dx: number }[];
  }
  const shapes = new Map<string, Shape>();
  const seen = new Set<string>();
  // extents of each subtree around its root's centre, children placed side by side
  const shape = (id: string): Shape => {
    seen.add(id);
    const node = byId.get(id) as FlowNode;
    const half = widthOf(sizes, id) / 2;
    const kids = childrenOf(node)
      .filter((kid) => !seen.has(kid.id))
      .map((kid) => ({ ...kid, shape: shape(kid.id) }));
    let placed: { id: string; dx: number; shape: Shape }[] = [];
    if (kids.length === 1) {
      const dx = exitsOf(node).length === 2 ? (EXIT_AT[kids[0].handle] - 0.5) * widthOf(sizes, id) : 0;
      placed = [{ id: kids[0].id, dx, shape: kids[0].shape }];
    } else if (kids.length === 2) {
      // kids are in exit order (Yes, then Else): the distance keeps the Yes subtree wholly left of the Else one
      const [yes, no] = kids;
      const distance = yes.shape.right + GAP_X - no.shape.left;
      placed = [
        { id: yes.id, dx: -distance / 2, shape: yes.shape },
        { id: no.id, dx: distance / 2, shape: no.shape },
      ];
    }
    const result: Shape = {
      left: Math.min(-half, ...placed.map((k) => k.dx + k.shape.left)),
      right: Math.max(half, ...placed.map((k) => k.dx + k.shape.right)),
      kids: placed.map(({ id: kid, dx }) => ({ id: kid, dx })),
    };
    shapes.set(id, result);
    return result;
  };
  const positions: Record<string, XY> = {};
  const place = (id: string, centreX: number, top: number) => {
    positions[id] = { x: Math.round(centreX - widthOf(sizes, id) / 2), y: Math.round(top) };
    const node = byId.get(id) as FlowNode;
    for (const kid of shapes.get(id)?.kids ?? [])
      place(kid.id, centreX + kid.dx, top + heightOf(sizes, id) + gapBelow(node));
  };
  const trigger = doc.nodes.find((n) => n.kind === "trigger");
  const roots = [
    ...(trigger ? [trigger.id] : []),
    ...doc.nodes.filter((n) => n.kind !== "trigger" && !doc.edges.some((e) => e.target === n.id)).map((n) => n.id),
  ];
  let cursor = 0;
  for (const root of roots) {
    if (seen.has(root)) continue;
    const s = shape(root);
    place(root, cursor - s.left, 0);
    cursor += s.right - s.left + GAP_X * 2;
  }
  // anything left (a loop drawn before it was refused): its own column on the right
  for (const node of doc.nodes)
    if (!positions[node.id]) {
      positions[node.id] = { x: cursor, y: 0 };
      cursor += widthOf(sizes, node.id) + GAP_X;
    }
  return { ...doc, nodes: doc.nodes.map((node) => ({ ...node, position: positions[node.id] })) };
}

/** A new flow: just the trigger, as respond.io starts ("Select a trigger"). */
export function emptyDoc(): FlowDoc {
  return {
    nodes: [{ id: "trigger", kind: "trigger", position: { x: 0, y: 0 }, event: "conversation_created" }],
    edges: [],
  };
}

// M129-E: what each preview route changed, as AuditChange rows for the one wrapper (./with-audit.ts).
// Every describer compares the route's saved data read before the request (`before`) with what the request asked to
// save (`json`) or what the route answered (`response`). On a failed request the same rows are logged as failures.
import { macros as seedMacros } from "@/app/(main)/dashboard/settings/macros/_components/data";
import {
  agents as seedAgents,
  cannedResponses as seedCanned,
  inboxes as seedInboxes,
  labels as seedLabels,
  teams as seedTeams,
  whatsappTemplates as seedTemplates,
} from "@/lib/cw/data";
import type { PreviewState } from "@/lib/cw/persistence/file-store";

import type { AuditChange, AuditContext } from "./with-audit";

type Row = Record<string, unknown>;
const isObject = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isObject) : []);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const text = (value: unknown, fallback = "") =>
  typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const quoted = (name: string) => `"${name}"`;

/** Top-level keys whose values differ (ignoring bookkeeping such as rev/updatedAt). */
function changedKeys(before: Row, after: Row, ignore: readonly string[] = []): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !ignore.includes(key) && !same(before[key], after[key]));
}
const pick = (row: Row, keys: string[]) => Object.fromEntries(keys.map((key) => [key, row[key]]));

interface Kind {
  type: string;
  label: string;
  key: (row: Row) => string;
  name: (row: Row) => string;
  ignore?: readonly string[];
}

/** create / delete / update rows for one list, by key. */
function diffList(kind: Kind, before: Row[], after: Row[]): AuditChange[] {
  const out: AuditChange[] = [];
  const old = new Map(before.map((row) => [kind.key(row), row]));
  const now = new Map(after.map((row) => [kind.key(row), row]));
  for (const [key, row] of now)
    if (!old.has(key))
      out.push({
        action: `${kind.type}.create`,
        crud: "c",
        summary: `added the ${kind.label} ${quoted(kind.name(row))}`,
        target: { id: key, name: kind.name(row), type: kind.type },
        after: row,
      });
  for (const [key, row] of old)
    if (!now.has(key))
      out.push({
        action: `${kind.type}.delete`,
        crud: "d",
        summary: `deleted the ${kind.label} ${quoted(kind.name(row))}`,
        target: { id: key, name: kind.name(row), type: kind.type },
        before: row,
      });
  for (const [key, row] of now) {
    const prior = old.get(key);
    if (!prior) continue;
    const keys = changedKeys(prior, row, kind.ignore);
    if (!keys.length) continue;
    out.push({
      action: `${kind.type}.update`,
      crud: "u",
      summary: `updated the ${kind.label} ${quoted(kind.name(row))} (${keys.join(", ")})`,
      target: { id: key, name: kind.name(row), type: kind.type },
      before: pick(prior, keys),
      after: pick(row, keys),
    });
  }
  return out;
}

const byId = (row: Row) => text(row.id);

// ---- shared Studio lists and sections: PUT /api/studio-preview-state -----------------------------------------

const SEED_LISTS: Record<string, Row[]> = {
  agents: seedAgents as unknown as Row[],
  inboxes: seedInboxes as unknown as Row[],
  teams: seedTeams as unknown as Row[],
  labels: seedLabels as unknown as Row[],
  cannedResponses: seedCanned as unknown as Row[],
  macros: seedMacros as unknown as Row[],
  whatsappTemplates: seedTemplates as unknown as Row[],
};

const LIST_KINDS: Record<string, Kind> = {
  // F-24 (F-10b's note): Retraced keys a target by its id alone, so the bare agent number ("7") met an older target "7"
  // of another type (contact #7). The id carries the type, as the actor's ("agent-1", ./with-audit.ts currentActor) and
  // the resend-invite event's (app/api/agent-invite/route.ts targetId) do: "agent-7".
  agents: {
    type: "agent",
    label: "agent",
    key: (r) => `agent-${text(r.id)}`,
    name: (r) => text(r.name, `#${text(r.id)}`),
  },
  // F-26 (judge F-24 note 2): like agents ("agent-7"), inboxes and teams carry their type in target.id ("inbox-10",
  // "team-1") so Retraced never merges a bare number with an older conversation or contact target.
  inboxes: {
    type: "inbox",
    label: "inbox",
    key: (r) => `inbox-${text(r.id)}`,
    name: (r) => text(r.name, `#${text(r.id)}`),
  },
  teams: {
    type: "team",
    label: "team",
    key: (r) => `team-${text(r.id)}`,
    name: (r) => text(r.name, `#${text(r.id)}`),
  },
  labels: { type: "label", label: "label", key: byId, name: (r) => text(r.title, text(r.id)) },
  cannedResponses: {
    type: "canned_response",
    label: "canned response",
    key: byId,
    name: (r) => text(r.shortCode, `#${text(r.id)}`),
  },
  macros: { type: "macro", label: "macro", key: byId, name: (r) => text(r.name, `#${text(r.id)}`) },
  whatsappTemplates: {
    type: "whatsapp_template",
    label: "WhatsApp template",
    key: (r) => `${text(r.name)}:${text(r.code)}`,
    name: (r) => `${text(r.name)} (${text(r.language, text(r.code))})`,
  },
};

function agentNames(...lists: Row[][]): Map<number, string> {
  const names = new Map<number, string>();
  for (const list of lists)
    for (const agent of list) names.set(Number(agent.id), text(agent.name, `#${text(agent.id)}`));
  return names;
}

/** Members (agent ids) added to or removed from a team or an inbox, one row per person. */
function memberChanges(
  kind: "team" | "inbox",
  name: string,
  id: string,
  before: unknown,
  after: unknown,
  names: Map<number, string>,
): AuditChange[] {
  const old = new Set(Array.isArray(before) ? before.map(Number) : []);
  const now = new Set(Array.isArray(after) ? after.map(Number) : []);
  const out: AuditChange[] = [];
  const who = (agentId: number) => names.get(agentId) ?? `agent #${agentId}`;
  for (const agentId of now)
    if (!old.has(agentId))
      out.push({
        action: `${kind}.member_add`,
        crud: "u",
        summary: `added ${who(agentId)} to the ${kind} ${quoted(name)}`,
        target: { id, name, type: kind },
        before: { agentId, member: false },
        after: { agentId, member: true },
      });
  for (const agentId of old)
    if (!now.has(agentId))
      out.push({
        action: `${kind}.member_remove`,
        crud: "u",
        summary: `removed ${who(agentId)} from the ${kind} ${quoted(name)}`,
        target: { id, name, type: kind },
        before: { agentId, member: true },
        after: { agentId, member: false },
      });
  return out;
}

function diffLists(before: Record<string, Row[]>, after: Record<string, unknown>): AuditChange[] {
  const out: AuditChange[] = [];
  const names = agentNames(before.agents ?? [], rows(after.agents));
  for (const [list, kind] of Object.entries(LIST_KINDS)) {
    if (!(list in after)) continue;
    const old = before[list] ?? [];
    const now = rows(after[list]);
    for (const change of diffList(kind, old, now)) {
      if (change.action !== `${kind.type}.update`) {
        out.push(change);
        continue;
      }
      // Split the updates Fahad named into their own actions: admin role, team and inbox members.
      const prior = old.find((row) => kind.key(row) === String(change.target.id)) ?? {};
      const row = now.find((r) => kind.key(r) === String(change.target.id)) ?? {};
      let keys = Object.keys((change.after as Row) ?? {});
      if (list === "agents" && keys.includes("role")) {
        const promoted = row.role === "administrator";
        out.push({
          action: "agent.role_change",
          crud: "u",
          summary: promoted
            ? `made ${change.target.name} an administrator (was ${text(prior.role)})`
            : `removed the administrator role from ${change.target.name} (now ${text(row.role)})`,
          target: change.target,
          before: { role: prior.role },
          after: { role: row.role },
        });
        keys = keys.filter((key) => key !== "role");
      }
      const members = list === "teams" ? "members" : list === "inboxes" ? "agents" : null;
      if (members && keys.includes(members)) {
        out.push(
          ...memberChanges(
            list === "teams" ? "team" : "inbox",
            change.target.name,
            String(change.target.id),
            prior[members],
            row[members],
            names,
          ),
        );
        keys = keys.filter((key) => key !== members);
      }
      if (keys.length)
        out.push({
          ...change,
          summary: `updated the ${kind.label} ${quoted(change.target.name)} (${keys.join(", ")})`,
          before: pick(prior, keys),
          after: pick(row, keys),
        });
    }
  }
  return out;
}

const SECTION_KINDS: Record<string, Kind> = {
  folders: { type: "folder", label: "folder", key: byId, name: (r) => text(r.name, text(r.id)) },
  automation: {
    type: "automation",
    label: "automation",
    key: (r) => (r.kind === "flow" ? `flow:${text((r.flow as Row)?.id)}` : `rule:${text((r.rule as Row)?.id)}`),
    name: (r) => text(((r.flow ?? r.rule) as Row)?.name, "untitled"),
  },
  customerPath: {
    type: "customer_path_stage",
    label: "Customer Path stage",
    // F-3: a contact's stage (`{ kind: "assignment", key, stageId }`) has no id or name: it is keyed and named by the
    // contact, else every assignment had the target id "" and Retraced refused the whole batch (400 target.id).
    key: (r) => (r.kind === "assignment" ? `assignment:${text(r.key)}` : byId(r)),
    name: (r) => (r.kind === "assignment" ? `${text(r.key)} → ${text(r.stageId)}` : text(r.name, text(r.id))),
  },
  notifications: { type: "notification", label: "notification", key: byId, name: (r) => `#${text(r.id)}` },
  campaigns: {
    type: "campaign",
    label: "campaign",
    key: byId,
    name: (r) => text(r.title, text(r.name, `#${text(r.id)}`)),
  },
};

/** Automation items are rules or flows: name the right one ("automation rule" / "automation flow"). */
function automationType(change: AuditChange): AuditChange {
  const flow = String(change.target.id).startsWith("flow:");
  const verb = change.action.split(".")[1];
  const type = flow ? "automation_flow" : "automation_rule";
  const label = flow ? "automation flow" : "automation rule";
  return {
    ...change,
    action: `${type}.${verb}`,
    summary: change.summary.replace("automation ", `${label} `),
    target: { ...change.target, type },
  };
}

export function describeStudioState(context: AuditContext<PreviewState | null>): AuditChange[] {
  const body = isObject(context.json) ? context.json : {};
  const section = context.url.searchParams.get("section");
  if (section) {
    const old = rows(context.before?.sections?.[section]?.items);
    const now = rows(body.items);
    const kind = SECTION_KINDS[section];
    if (!kind)
      return same(old, now)
        ? []
        : [
            {
              action: "section.save",
              crud: "u",
              summary: `saved the section ${quoted(section)} (${now.length} items)`,
              target: { id: section, name: section, type: "section" },
              before: { items: old.length },
              after: { items: now.length },
            },
          ];
    const changes = diffList(kind, old, now);
    return section === "automation" ? changes.map(automationType) : changes;
  }
  if (!isObject(body.lists)) return [];
  const saved = context.before?.lists as Record<string, Row[]> | null | undefined;
  return diffLists(saved ?? SEED_LISTS, body.lists);
}

// ---- simulation record: /api/preview-sim -------------------------------------------------------------------

interface SimSnapshot {
  data: Record<string, Row[]>;
}

const SIM_LABEL: Record<string, string> = {
  calls: "simulated call",
  contactOps: "saved contact change",
  linearIssues: "sample Linear issue",
  copilot: "Copilot message",
  uploads: "uploaded file",
  conversations: "conversation",
  messages: "message",
  statuses: "status change",
  messageDeletes: "message delete",
};

function describeSimItem(key: string, item: Row): AuditChange {
  const conv = `conversation #${text(item.convId)}`;
  switch (key) {
    case "contactOps": {
      if (item.op === "add") {
        const contact = (item.contact as Row) ?? {};
        return {
          action: "contact.create",
          crud: "c",
          summary: `added the contact ${quoted(text(contact.name))}`,
          target: { id: text(contact.id, text(item.id)), name: text(contact.name), type: "contact" },
          after: contact,
        };
      }
      if (item.op === "block") {
        // F-3: Block / Unblock contact is saved in the preview's record now; this is its audit line (the same action,
        // target and before/after the browser used to send to /api/audit-log for it).
        const blocked = item.blocked === true;
        const name = text(item.name, `#${text(item.contactId)}`);
        return {
          action: blocked ? "contact.block" : "contact.unblock",
          crud: "u",
          summary: `${blocked ? "blocked" : "unblocked"} the contact ${quoted(name)}`,
          target: { id: text(item.contactId), name, type: "contact" },
          before: { blocked: !blocked },
          after: { blocked },
        };
      }
      if (item.op === "merge") {
        const merged = (item.merged as Row) ?? {};
        return {
          action: "contact.merge",
          crud: "u",
          summary: `merged the contact ${quoted(text(item.deletedKey))} into ${quoted(text(item.keptKey))}`,
          target: {
            id: text(item.keptId, text(item.keptKey)),
            name: text(merged.name, text(item.keptKey)),
            type: "contact",
          },
          before: { kept: item.keptKey, deleted: item.deletedKey, conversations: item.convIds },
          after: merged,
        };
      }
      return {
        action: "contact.delete",
        crud: "d",
        summary: `deleted the contact ${quoted(text(item.key))}`,
        target: { id: text(item.profileId, text(item.key)), name: text(item.key), type: "contact" },
        before: { contact: item.key, conversations: item.convIds },
      };
    }
    case "calls":
      return {
        action: "call.simulate",
        crud: "c",
        summary: `placed a simulated ${text(item.channel)} call in ${conv} (${text(item.outcome)}, ${text(item.seconds)}s)`,
        target: { id: text(item.convId), name: conv, type: "conversation" },
        after: item,
      };
    case "linearIssues":
      return {
        action: `linear_issue.${item.kind === "linked" ? "link" : "create"}`,
        crud: "c",
        summary: `${item.kind === "linked" ? "linked" : "created"} the sample Linear issue ${text(item.key)} ${quoted(text(item.title))} in ${conv}`,
        target: { id: text(item.key, text(item.id)), name: text(item.title), type: "linear_issue" },
        after: item,
      };
    case "copilot":
      return {
        action: item.role === "user" ? "copilot.ask" : "copilot.answer",
        crud: "c",
        summary: item.role === "user" ? `asked Copilot in ${conv}` : `received a sample Copilot answer in ${conv}`,
        target: { id: text(item.convId), name: conv, type: "conversation" },
        after: { role: item.role, text: item.text },
      };
    case "conversations":
      return {
        action: "conversation.create",
        crud: "c",
        summary: `started conversation #${text(item.convId)} on ${text(item.channel)}`,
        target: { id: text(item.convId), name: `conversation #${text(item.convId)}`, type: "conversation" },
        after: { subject: item.subject, channel: item.channel, files: item.files },
      };
    // F-5A: replies and private notes written in a conversation (kept in the preview, delivered to no one).
    case "messages": {
      const files = Array.isArray(item.attachments) ? item.attachments.length : 0;
      const note = item.kind === "note";
      return {
        action: note ? "conversation.note" : "conversation.reply",
        crud: "c",
        summary: `${note ? "added a private note" : "wrote a simulated reply (not delivered)"} in ${conv}${files ? ` with ${files} attachment${files === 1 ? "" : "s"}` : ""}${item.byName ? ` as ${text(item.byName)}` : ""}`,
        target: { id: text(item.convId), name: conv, type: "conversation" },
        after: { kind: item.kind, text: item.text, attachments: item.attachments, by: item.byName },
      };
    }
    // F-5A: Resolve, Snooze, Reopen, Mark as pending.
    case "statuses":
      return {
        action: "conversation.status_change",
        crud: "u",
        summary: `changed ${conv} to ${text(item.status)}${item.snoozedUntil ? ` until ${text(item.snoozedUntil)}` : ""}${item.byName ? ` as ${text(item.byName)}` : ""}`,
        target: { id: text(item.convId), name: conv, type: "conversation" },
        after: { status: item.status, snoozedUntil: item.snoozedUntil, label: item.label },
      };
    // F-8: "Delete" on a message (it stays in the thread as "This message was deleted").
    case "messageDeletes":
      return {
        action: "conversation.message_delete",
        crud: "d",
        summary: `deleted the message ${quoted(text(item.messageId))} in ${conv}${item.byName ? ` as ${text(item.byName)}` : ""}`,
        target: { id: text(item.messageId), name: `message ${text(item.messageId)} in ${conv}`, type: "message" },
        after: { deleted: true, by: item.byName },
      };
    case "uploads":
      return {
        action: "file.upload",
        crud: "c",
        summary: `uploaded the file ${quoted(text(item.name))} (${text(item.size)} bytes)`,
        target: { id: text(item.id), name: text(item.name), type: "file" },
        after: item,
      };
    default:
      return {
        action: `preview_sim.${key}.create`,
        crud: "c",
        summary: `saved a ${key} item`,
        target: { id: text(item.id), name: text(item.id), type: key },
        after: item,
      };
  }
}

export function describePreviewSim(context: AuditContext<SimSnapshot>): AuditChange[] {
  if (context.method === "POST") {
    const body = isObject(context.json) ? context.json : {};
    const key = text(body.key);
    if (!isObject(body.item)) return [];
    const prior = rows(context.before?.data?.[key]).find((row) => row.id === (body.item as Row).id);
    if (prior && same(prior, body.item)) return [];
    return [describeSimItem(key, body.item)];
  }
  if (context.method === "DELETE") {
    const key = context.url.searchParams.get("key") ?? "";
    const id = context.url.searchParams.get("id") ?? "";
    const removed = rows(context.before?.data?.[key]).find((row) => row.id === id);
    const label = SIM_LABEL[key] ?? key;
    return [
      {
        action: `${key === "uploads" ? "file" : `preview_sim.${key}`}.delete`,
        crud: "d",
        summary: `removed the ${label} ${quoted(removed ? text(removed.name, text(removed.title, id)) : id)}`,
        target: { id, name: removed ? text(removed.name, text(removed.title, id)) : id, type: key },
        before: removed,
      },
    ];
  }
  return [];
}

export function describeSimUpload(context: AuditContext<unknown>): AuditChange[] {
  const file = isObject(context.response) ? context.response : {};
  if (context.status >= 400) return [];
  return [describeSimItem("uploads", file)];
}

// ---- conversation panel edits: /api/preview-sim/panel -------------------------------------------------------

const PANEL_LABEL: Record<string, [string, string]> = {
  conversationAttrs: ["conversation attributes", "conversation"],
  contactAttrs: ["contact attributes", "contact"],
  contactEdits: ["contact details", "contact"],
  notes: ["notes", "contact"],
  meta: ["status, assignee, team or priority", "conversation"],
  labels: ["labels", "conversation"],
};

export function describeSimPanel(context: AuditContext<{ state?: Row } | null>): AuditChange[] {
  if (context.method === "DELETE")
    return [
      {
        action: "conversation_panel.reset",
        crud: "d",
        summary: "cleared every saved conversation panel edit",
        target: { id: "conversation-panel", name: "Conversation panel edits", type: "conversation_panel" },
        before: context.before?.state,
      },
    ];
  // F-3 item 13: a save sends only its changes and the server answers with the merged copy, which is what is compared
  const answered = isObject(context.response) && isObject(context.response.state) ? context.response.state : null;
  const sent = isObject(context.json) && isObject(context.json.state) ? context.json.state : null;
  const state = answered ?? (context.status < 400 ? sent : null);
  if (!state) return [];
  const old = context.before?.state ?? {};
  const out: AuditChange[] = [];
  for (const [slice, [label, owner]] of Object.entries(PANEL_LABEL)) {
    const before = isObject(old[slice]) ? (old[slice] as Row) : {};
    const after = isObject(state[slice]) ? (state[slice] as Row) : {};
    for (const id of changedKeys(before, after)) {
      const inner = isObject(before[id]) && isObject(after[id]) ? changedKeys(before[id] as Row, after[id] as Row) : [];
      out.push({
        action: `${owner}.${slice === "notes" ? "notes_update" : slice === "labels" ? "labels_update" : "update"}`,
        crud: "u",
        summary: `changed the ${label} of ${owner} #${id}${inner.length ? ` (${inner.join(", ")})` : ""}`,
        target: { id, name: `${owner} #${id}`, type: owner },
        before: inner.length ? pick(before[id] as Row, inner) : before[id],
        after: inner.length ? pick(after[id] as Row, inner) : after[id],
      });
    }
  }
  return out;
}

// ---- policies, settings and tasks ---------------------------------------------------------------------------

export function describePolicies(type: "sla_policy" | "capacity_policy", label: string) {
  return (context: AuditContext<{ policies?: unknown } | null>): AuditChange[] => {
    const body = isObject(context.json) ? context.json : {};
    if (!Array.isArray(body.policies)) return [];
    return diffList(
      { type, label, key: byId, name: (r) => text(r.name, `#${text(r.id)}`) },
      rows(context.before?.policies),
      rows(body.policies),
    );
  };
}

export function describeGeneralSettings(context: AuditContext<Row | null>): AuditChange[] {
  const body = isObject(context.json) ? context.json : {};
  const before = context.before ?? {};
  const keys = ["name", "language"].filter((key) => key in body && !same(before[key], body[key]));
  if (!keys.length) return [];
  return [
    {
      action: "account.settings_update",
      crud: "u",
      summary: `changed the account settings (${keys.join(", ")})`,
      target: { id: "account", name: text(body.name, text(before.name, "Account")), type: "account" },
      before: pick(before, keys),
      after: pick(body, keys),
    },
  ];
}

export function describeTasks(context: AuditContext<{ tasks?: unknown } | null>): AuditChange[] {
  const body = isObject(context.json) ? context.json : {};
  const changes = isObject(body.changes) ? body.changes : {};
  const saved = isObject(context.response) && isObject(context.response.task) ? context.response.task : null;
  if (context.method === "POST") {
    const title = text(saved?.title, text(changes.title, "untitled"));
    return [
      {
        action: "task.create",
        crud: "c",
        summary: `created the task ${quoted(title)}`,
        target: { id: text(saved?.id, "new"), name: title, type: "task" },
        after: saved ?? changes,
      },
    ];
  }
  const id = text(body.id);
  const prior = rows(context.before?.tasks).find((task) => task.id === id) ?? {};
  const keys = Object.keys(changes).filter((key) => !same(prior[key], changes[key]));
  if (!keys.length) return [];
  const title = text(saved?.title, text(prior.title, id));
  const moved = keys.includes("status");
  const others = keys.filter((key) => key !== "status" && key !== "order");
  return [
    {
      action: moved ? "task.move" : "task.update",
      crud: "u",
      summary: moved
        ? `moved the task ${quoted(title)} from ${text(prior.status)} to ${text(changes.status)}${others.length ? ` (also ${others.join(", ")})` : ""}`
        : `updated the task ${quoted(title)} (${keys.join(", ")})`,
      target: { id, name: title, type: "task" },
      before: pick(prior, keys),
      after: pick(changes, keys),
    },
  ];
}

// ---- automation attachment files: /dashboard/settings/automation/files --------------------------------------

export function describeAutomationFiles(context: AuditContext<unknown>): AuditChange[] {
  const answer = isObject(context.response) ? context.response : {};
  if (context.method === "POST") {
    const name = text(answer.name, decodeURIComponent(context.request.headers.get("x-file-name") ?? "file"));
    // F-3: Undo after Remove or Replace puts the file back under its own id (files/route.ts x-restore-id)
    const restored = !!context.request.headers.get("x-restore-id");
    if (restored && context.status === 200) return []; // the preview still had it: nothing changed
    return [
      {
        action: restored ? "automation_file.restore" : "automation_file.upload",
        crud: "c",
        summary: `${restored ? "restored (Undo)" : "uploaded"} the automation attachment ${quoted(name)}`,
        target: { id: text(answer.id, name), name, type: "automation_file" },
        after: answer,
      },
    ];
  }
  const id = context.url.searchParams.get("id") ?? "";
  const saved = isObject(context.before) ? context.before : null;
  const name = text(saved?.name, id);
  return [
    {
      action: "automation_file.delete",
      crud: "d",
      summary: `removed the automation attachment ${quoted(name)}`,
      target: { id, name, type: "automation_file" },
      before: saved ?? undefined,
    },
  ];
}

// ---- invoices (Bigcapital bridge): /api/invoice-bigcapital --------------------------------------------------

export function describeInvoiceCustomer(context: AuditContext<unknown>): AuditChange[] {
  const body = isObject(context.json) ? context.json : {};
  const contact = isObject(body.contact) ? body.contact : {};
  const answer = isObject(context.response) ? context.response : {};
  const customer = isObject(answer.customer) ? answer.customer : {};
  const name = text(customer.display_name, text(contact.name, "customer"));
  if (body.mode !== "create" && answer.created !== true && context.status < 400) {
    return [
      {
        action: "invoice_customer.link",
        crud: "u",
        summary: `linked the invoice client ${quoted(name)} to invoice customer #${text(customer.id)}`,
        target: { id: text(customer.id, name), name, type: "invoice_customer" },
        after: { id: customer.id, email: contact.email },
      },
    ];
  }
  return [
    {
      action: "invoice_customer.create",
      crud: "c",
      summary: `created the invoice customer ${quoted(name)}`,
      target: { id: text(customer.id, name), name, type: "invoice_customer" },
      after: contact,
    },
  ];
}

export function describeInvoice(context: AuditContext<unknown>): AuditChange[] {
  const body = isObject(context.json) ? context.json : {};
  const answer = isObject(context.response) ? context.response : {};
  const invoice = isObject(answer.invoice) ? answer.invoice : {};
  const number = text(invoice.invoice_no, text(body.referenceNumber, "draft"));
  return [
    {
      action: "invoice.create",
      crud: "c",
      summary: `created the invoice ${number}`,
      target: { id: text(invoice.id, number), name: number, type: "invoice" },
      after: {
        customerId: body.customerId,
        items: Array.isArray(body.items) ? body.items.length : 0,
        total: invoice.total,
      },
    },
  ];
}

export function describeInvoiceSend(context: AuditContext<unknown>): AuditChange[] {
  const answer = isObject(context.response) ? context.response : {};
  const invoice = isObject(answer.invoice) ? answer.invoice : {};
  const id = context.params.id ?? text(invoice.id);
  const number = text(invoice.invoice_no, `#${id}`);
  return [
    {
      action: "invoice.send",
      crud: "u",
      summary: `marked the invoice ${number} as delivered (email simulated, nothing was emailed)`,
      target: { id, name: number, type: "invoice" },
      after: { delivered: invoice.is_delivered ?? true, emailSimulated: true },
    },
  ];
}

// ---- actions that live only in the browser: POST /api/audit-log ---------------------------------------------

/** The browser-only actions a page may report (they have no save route of their own). */
export const CLIENT_ACTIONS = {
  "contact.block": "blocked the contact",
  "contact.unblock": "unblocked the contact",
} as const;
export type ClientAction = keyof typeof CLIENT_ACTIONS;

export function describeClientAction(context: AuditContext<unknown>): AuditChange[] {
  const body = isObject(context.json) ? context.json : {};
  const action = text(body.action) as ClientAction;
  const target = isObject(body.target) ? body.target : {};
  if (!(action in CLIENT_ACTIONS) || context.status >= 400) return [];
  const name = text(target.name, `#${text(target.id)}`);
  return [
    {
      action,
      crud: "u",
      summary: `${CLIENT_ACTIONS[action]} ${quoted(name)}`,
      target: { id: text(target.id), name, type: "contact" },
      before: { blocked: action === "contact.unblock" },
      after: { blocked: action === "contact.block" },
    },
  ];
}

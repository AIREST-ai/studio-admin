"use client";

// F161: local state for the Contacts section (no backend). Lives in module state, so contacts added, edited, merged
// or deleted, labels, notes, blocks and saved segments survive moving between the Contacts views and the contact
// page, and reset on reload (same rule as the inbox store chat/_components/cw-store.ts) — except what the preview's
// saved record keeps (replayContactOps below): added, deleted and merged contacts, and blocks (F-3).
import { toast } from "sonner";
import { create } from "zustand";

import { type ContactOp, onPreviewSimLoaded, recordSim, simId } from "@/lib/cw/preview-sim";

import { type Contact, contacts as seedContacts } from "./data";

export type SocialKey =
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "linkedin"
  | "twitter"
  | "tiktok"
  | "telegram"
  | "github";

export type ContactNote = { id: number; author: string; time: string; body: string };

// Chatwoot contact filter (routes/dashboard/contacts/contactFilterItems/index.js + FilterOperatorTypes.js).
export type FilterAttribute =
  | "name"
  | "email"
  | "phone_number"
  | "identifier"
  | "country"
  | "city"
  | "company"
  | "created_at"
  | "last_activity"
  | "referer"
  | "blocked"
  | "labels";

export type FilterOperator =
  | "equal_to"
  | "not_equal_to"
  | "contains"
  | "does_not_contain"
  | "is_present"
  | "is_not_present"
  | "is_greater_than"
  | "is_less_than"
  | "days_before";

export interface ContactFilter {
  attribute: FilterAttribute;
  operator: FilterOperator;
  value: string;
  // How this row joins the one before it (Chatwoot query_operator).
  join: "and" | "or";
}

export interface Segment {
  id: number;
  name: string;
  filters: ContactFilter[];
}

export type ContactDraft = Omit<Contact, "id" | "lastActivity" | "lastActivityMinutes" | "createdAt" | "labels"> & {
  social?: Partial<Record<SocialKey, string>>;
};

export interface LinkedContactsAdapter {
  add: (draft: ContactDraft) => Contact;
  update: (id: number, draft: ContactDraft) => void;
  remove: (ids: number[]) => void;
  merge: (primaryId: number, mergedId: number) => void;
  toggleBlock: (id: number) => { blocked: boolean; saved: Promise<boolean> };
  setAttr: (id: number, key: string, value: string | null) => void;
  addLabels: (ids: number[], labels: string[]) => void;
  removeLabels: (ids: number[], labels: string[]) => void;
  addNote: (id: number, body: string) => void;
  deleteNote: (id: number, noteId: number) => void;
  addSegment: (name: string, filters: ContactFilter[]) => Segment;
  updateSegment: (id: number, filters: ContactFilter[]) => void;
  deleteSegment: (id: number) => void;
}

let linkedContactsAdapter: LinkedContactsAdapter | null = null;

export function setLinkedContactsAdapter(adapter: LinkedContactsAdapter | null): void {
  linkedContactsAdapter = adapter;
}

export function getLinkedContactsAdapter(): LinkedContactsAdapter | null {
  return linkedContactsAdapter;
}

function dismissToastNextTick() {
  queueMicrotask(() => toast.dismiss());
}

interface ContactsState {
  list: Contact[];
  blocked: number[];
  social: Record<number, Partial<Record<SocialKey, string>>>;
  notes: Record<number, ContactNote[]>;
  // Custom attribute values of contacts that have no inbox conversation (the others live in the inbox store).
  attrs: Record<number, Record<string, string>>;
  segments: Segment[];
  add(draft: ContactDraft): Contact;
  update(id: number, draft: ContactDraft): void;
  remove(ids: number[]): void;
  merge(primaryId: number, mergedId: number): void;
  /** F-3: `saved` resolves false when the preview could not keep it (that failure is shown by recordSim). */
  toggleBlock(id: number): { blocked: boolean; saved: Promise<boolean> };
  addLabels(ids: number[], labels: string[]): void;
  removeLabels(ids: number[], labels: string[]): void;
  addNote(id: number, body: string): void;
  deleteNote(id: number, noteId: number): void;
  setAttr(id: number, key: string, value: string | null): void;
  addSegment(name: string, filters: ContactFilter[]): Segment;
  updateSegment(id: number, filters: ContactFilter[]): void;
  deleteSegment(id: number): void;
}

// Notes the contact page showed before F161, kept on the first contact only (every contact used to show the same two).
const seedNotes: Record<number, ContactNote[]> = {
  1: [
    {
      id: 1,
      author: "Arham Khan",
      time: "2 days ago",
      body: "Called back, prefers Arabic. Wants a quote before the end of the month.",
    },
    { id: 2, author: "Lina Haddad", time: "1 week ago", body: "Sent the pricing sheet by email." },
  ],
};

function today() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fromDraft(draft: ContactDraft): Omit<ContactDraft, "social"> {
  const { social: _social, ...rest } = draft;
  return rest;
}

export function showLinkedContacts(list: Contact[], attrs: Record<number, Record<string, string>> = {}): void {
  useContactsStore.setState({
    list,
    blocked: [],
    social: {},
    notes: {},
    attrs,
    segments: [],
  });
}

export function restorePreviewContacts(): void {
  useContactsStore.setState({
    list: seedContacts,
    blocked: [],
    social: {},
    notes: seedNotes,
    attrs: {},
    segments: [],
  });
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  list: seedContacts,
  blocked: [],
  social: {},
  notes: seedNotes,
  attrs: {},
  segments: [],
  add(draft) {
    if (linkedContactsAdapter) {
      return linkedContactsAdapter.add(draft);
    }
    const id = Math.max(0, ...get().list.map((c) => c.id)) + 1;
    const contact: Contact = {
      ...fromDraft(draft),
      id,
      lastActivity: "---",
      // No activity yet: sorts last on "Last activity" and never counts as online.
      lastActivityMinutes: Number.MAX_SAFE_INTEGER,
      createdAt: today(),
      labels: [],
    };
    set((state) => ({ list: [contact, ...state.list], social: { ...state.social, [id]: draft.social ?? {} } }));
    return contact;
  },
  update(id, draft) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.update(id, draft);
      return;
    }
    set((state) => ({
      list: state.list.map((c) => (c.id === id ? { ...c, ...fromDraft(draft) } : c)),
      social: draft.social ? { ...state.social, [id]: draft.social } : state.social,
    }));
  },
  remove(ids) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.remove(ids);
      return;
    }
    set((state) => ({ list: state.list.filter((c) => !ids.includes(c.id)) }));
  },
  // Chatwoot ContactMerge: the primary contact is kept, the merged one is deleted; empty fields of the primary are
  // filled from the merged contact, labels and notes are combined.
  merge(primaryId, mergedId) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.merge(primaryId, mergedId);
      return;
    }
    const { list, notes } = get();
    const primary = list.find((c) => c.id === primaryId);
    const merged = list.find((c) => c.id === mergedId);
    if (!primary || !merged) return;
    const combined: Contact = {
      ...primary,
      email: primary.email || merged.email,
      phone: primary.phone || merged.phone,
      company: primary.company || merged.company,
      city: primary.city || merged.city,
      country: primary.country || merged.country,
      bio: primary.bio || merged.bio,
      labels: Array.from(new Set([...primary.labels, ...merged.labels])),
    };
    set((state) => ({
      list: state.list.filter((c) => c.id !== mergedId).map((c) => (c.id === primaryId ? combined : c)),
      notes: { ...state.notes, [primaryId]: [...(notes[primaryId] ?? []), ...(notes[mergedId] ?? [])] },
    }));
  },
  toggleBlock(id) {
    if (linkedContactsAdapter) {
      return linkedContactsAdapter.toggleBlock(id);
    }
    const isBlocked = get().blocked.includes(id);
    set((state) => ({ blocked: isBlocked ? state.blocked.filter((x) => x !== id) : [...state.blocked, id] }));
    // F-3 (rule 129.2; judge of M129-E: a block was gone after a reload): the block is kept in the preview's saved
    // record (lib/cw/preview-sim.ts) and replayed on load (below). That save is also what puts "contact.block" /
    // "contact.unblock" in the audit log (lib/audit/describe.ts), in place of the POST /api/audit-log it used to send.
    const name = get().list.find((c) => c.id === id)?.name ?? `#${id}`;
    const saved = recordSim("contactOps", {
      id: simId("op"),
      at: new Date().toISOString(),
      op: "block",
      contactId: id,
      name,
      blocked: !isBlocked,
    });
    return { blocked: !isBlocked, saved };
  },
  addLabels(ids, labels) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.addLabels(ids, labels);
      return;
    }
    set((state) => ({
      list: state.list.map((c) =>
        ids.includes(c.id) ? { ...c, labels: Array.from(new Set([...c.labels, ...labels])) } : c,
      ),
    }));
  },
  removeLabels(ids, labels) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.removeLabels(ids, labels);
      return;
    }
    set((state) => ({
      list: state.list.map((c) =>
        ids.includes(c.id) ? { ...c, labels: c.labels.filter((l) => !labels.includes(l)) } : c,
      ),
    }));
  },
  addNote(id, body) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.addNote(id, body);
      return;
    }
    const note: ContactNote = { id: Date.now(), author: "Arham Khan", time: "Just now", body };
    set((state) => ({ notes: { ...state.notes, [id]: [note, ...(state.notes[id] ?? [])] } }));
  },
  deleteNote(id, noteId) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.deleteNote(id, noteId);
      return;
    }
    set((state) => ({ notes: { ...state.notes, [id]: (state.notes[id] ?? []).filter((n) => n.id !== noteId) } }));
  },
  setAttr(id, key, value) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.setAttr(id, key, value);
      return;
    }
    set((state) => {
      const next = { ...(state.attrs[id] ?? {}) };
      if (value === null) delete next[key];
      else next[key] = value;
      return { attrs: { ...state.attrs, [id]: next } };
    });
  },
  addSegment(name, filters) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      return linkedContactsAdapter.addSegment(name, filters);
    }
    const segment: Segment = { id: Math.max(0, ...get().segments.map((s) => s.id)) + 1, name, filters };
    set((state) => ({ segments: [...state.segments, segment] }));
    return segment;
  },
  updateSegment(id, filters) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.updateSegment(id, filters);
      return;
    }
    set((state) => ({ segments: state.segments.map((s) => (s.id === id ? { ...s, filters } : s)) }));
  },
  deleteSegment(id) {
    if (linkedContactsAdapter) {
      dismissToastNextTick();
      linkedContactsAdapter.deleteSegment(id);
      return;
    }
    set((state) => ({ segments: state.segments.filter((s) => s.id !== id) }));
  },
}));

// ---- filter evaluation ----

export const filterAttributeOptions: { value: FilterAttribute; label: string; operators: FilterOperator[] }[] = [
  { value: "name", label: "Name", operators: ["equal_to", "not_equal_to"] },
  { value: "email", label: "Email", operators: ["equal_to", "not_equal_to", "contains", "does_not_contain"] },
  {
    value: "phone_number",
    label: "Phone number",
    operators: ["equal_to", "not_equal_to", "contains", "does_not_contain"],
  },
  { value: "identifier", label: "Identifier", operators: ["equal_to", "not_equal_to"] },
  { value: "country", label: "Country", operators: ["equal_to", "not_equal_to"] },
  { value: "city", label: "City", operators: ["equal_to", "not_equal_to", "contains", "does_not_contain"] },
  { value: "company", label: "Company", operators: ["equal_to", "not_equal_to", "contains", "does_not_contain"] },
  { value: "created_at", label: "Created at", operators: ["is_greater_than", "is_less_than", "days_before"] },
  { value: "last_activity", label: "Last activity", operators: ["is_greater_than", "is_less_than", "days_before"] },
  { value: "referer", label: "Referer link", operators: ["is_greater_than", "is_less_than", "days_before"] },
  { value: "blocked", label: "Blocked", operators: ["equal_to", "not_equal_to"] },
  { value: "labels", label: "Labels", operators: ["equal_to", "not_equal_to", "is_present", "is_not_present"] },
];

export const operatorLabels: Record<FilterOperator, string> = {
  equal_to: "Equal to",
  not_equal_to: "Not equal to",
  contains: "Contains",
  does_not_contain: "Does not contain",
  is_present: "Is present",
  is_not_present: "Is not present",
  is_greater_than: "Is greater than",
  is_less_than: "Is less than",
  days_before: "Is x days before",
};

export function isDateAttribute(attribute: FilterAttribute) {
  return attribute === "created_at" || attribute === "last_activity" || attribute === "referer";
}

const DAY = 24 * 60 * 60 * 1000;

function dateOf(contact: Contact, attribute: FilterAttribute): number | null {
  if (attribute === "created_at") return Date.parse(contact.createdAt) || null;
  if (attribute === "last_activity") {
    return contact.lastActivityMinutes === Number.MAX_SAFE_INTEGER
      ? null
      : Date.now() - contact.lastActivityMinutes * 60 * 1000;
  }
  return null; // no referer data on these contacts
}

function textOf(contact: Contact, attribute: FilterAttribute, blocked: number[]): string {
  switch (attribute) {
    case "name":
      return contact.name;
    case "email":
      return contact.email;
    case "phone_number":
      return contact.phone;
    case "country":
      return contact.country;
    case "city":
      return contact.city;
    case "company":
      return contact.company;
    case "blocked":
      return blocked.includes(contact.id) ? "true" : "false";
    default:
      return ""; // identifier: none of these contacts has one
  }
}

function matchesOne(contact: Contact, filter: ContactFilter, blocked: number[]): boolean {
  const { attribute, operator } = filter;
  const value = filter.value.trim().toLowerCase();
  if (attribute === "labels") {
    if (operator === "is_present") return contact.labels.length > 0;
    if (operator === "is_not_present") return contact.labels.length === 0;
    const has = contact.labels.includes(filter.value);
    return operator === "equal_to" ? has : !has;
  }
  if (isDateAttribute(attribute)) {
    const date = dateOf(contact, attribute);
    if (date === null) return false;
    if (operator === "days_before") {
      const days = Number(filter.value);
      return Number.isFinite(days) && date <= Date.now() - days * DAY;
    }
    const target = Date.parse(filter.value);
    if (Number.isNaN(target)) return false;
    return operator === "is_greater_than" ? date > target + DAY - 1 : date < target;
  }
  const text = textOf(contact, attribute, blocked).toLowerCase();
  switch (operator) {
    case "equal_to":
      return text === value;
    case "not_equal_to":
      return text !== value;
    case "contains":
      return text.includes(value);
    case "does_not_contain":
      return !text.includes(value);
    default:
      return true;
  }
}

export function matchesFilters(contact: Contact, filters: ContactFilter[], blocked: number[]): boolean {
  if (!filters.length) return true;
  let result = matchesOne(contact, filters[0], blocked);
  for (const filter of filters.slice(1)) {
    const next = matchesOne(contact, filter, blocked);
    result = filter.join === "or" ? result || next : result && next;
  }
  return result;
}

export function describeFilter(filter: ContactFilter): string {
  const attribute = filterAttributeOptions.find((a) => a.value === filter.attribute)?.label ?? filter.attribute;
  const needsValue = filter.operator !== "is_present" && filter.operator !== "is_not_present";
  return `${attribute} ${operatorLabels[filter.operator].toLowerCase()}${needsValue ? ` ${filter.value}` : ""}`;
}

export function useContact(id: number): Contact | undefined {
  return useContactsStore((s) => s.list.find((c) => c.id === id));
}

// M129-A (Fahad 129.2): contacts created by "Save Contact" and contacts deleted or merged from a conversation are kept
// in the preview's saved record (lib/cw/preview-sim.ts), so they are replayed here, in order, on every page load.
// F-3: so are contacts made with "Add contact" on /dashboard/contacts, and Block / Unblock contact.
function replayContactOps(ops: ContactOp[]) {
  for (const op of ops) {
    const state = useContactsStore.getState();
    if (op.op === "add") {
      if (!state.list.some((c) => c.id === op.contact.id))
        useContactsStore.setState({
          list: [op.contact, ...state.list],
          social: op.social ? { ...state.social, [op.contact.id]: op.social } : state.social,
        });
    } else if (op.op === "delete") {
      if (op.profileId !== null) state.remove([op.profileId]);
    } else if (op.op === "merge") {
      if (op.keptId !== null && op.deletedId !== null && op.keptId !== op.deletedId)
        state.merge(op.keptId, op.deletedId);
    } else if (op.op === "block") {
      // F-3: the last saved Block / Unblock of a contact wins (the record is in order).
      const others = state.blocked.filter((x) => x !== op.contactId);
      useContactsStore.setState({ blocked: op.blocked ? [...others, op.contactId] : others });
    }
  }
}

if (typeof window !== "undefined") onPreviewSimLoaded((saved) => replayContactOps(saved.contactOps));

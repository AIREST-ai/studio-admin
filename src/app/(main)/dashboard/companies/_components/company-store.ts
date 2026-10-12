"use client";

// Local state for Companies (no backend): the list, the edits made on a company page and which contact is linked to
// which company. Module state, so the list and the company page agree while moving between them; resets on reload.
import { create } from "zustand";

import { contacts } from "@/app/(main)/dashboard/contacts/_components/data";

import { type Company, contactNotes, initialCompanies, initialLinks } from "./company-data";

interface CompanyState {
  companies: Company[];
  links: Record<number, number | null>;
  nextId: number;
}

export const useCompanyStore = create<CompanyState>(() => ({
  companies: initialCompanies,
  links: initialLinks,
  nextId: initialCompanies.length + 1,
}));

const set = useCompanyStore.setState;
const get = useCompanyStore.getState;

export const companyActions = {
  create(input: { name: string; domain: string; description: string }): Company {
    const id = get().nextId;
    const company: Company = {
      id,
      name: input.name,
      domain: input.domain,
      description: input.description,
      createdAt: "Oct 12, 2026",
      createdOrder: 100 + id,
      ownActivity: "Just now",
      ownActivityMinutes: 0,
      attributes: {},
    };
    set((s) => ({ companies: [company, ...s.companies], nextId: id + 1 }));
    return company;
  },
  update(id: number, patch: Partial<Company>) {
    set((s) => ({ companies: s.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  },
  setAttribute(id: number, key: string, value: string | null) {
    set((s) => ({
      companies: s.companies.map((c) => {
        if (c.id !== id) return c;
        const attributes = { ...c.attributes };
        if (value === null) delete attributes[key];
        else attributes[key] = value;
        return { ...c, attributes };
      }),
    }));
  },
  remove(ids: number[]) {
    set((s) => ({
      companies: s.companies.filter((c) => !ids.includes(c.id)),
      links: Object.fromEntries(
        Object.entries(s.links).map(([contactId, companyId]) => [
          contactId,
          companyId !== null && ids.includes(companyId) ? null : companyId,
        ]),
      ),
    }));
  },
  link(contactId: number, companyId: number | null) {
    set((s) => ({ links: { ...s.links, [contactId]: companyId } }));
  },
};

export function companyContacts(links: Record<number, number | null>, companyId: number) {
  return contacts.filter((contact) => links[contact.id] === companyId);
}

// Chatwoot company last_activity_at: the latest activity of its contacts, or its own when it has none.
export function companyActivity(company: Company, links: Record<number, number | null>) {
  const people = companyContacts(links, company.id);
  if (!people.length) return { label: company.ownActivity, minutes: company.ownActivityMinutes };
  const latest = people.reduce((a, b) => (a.lastActivityMinutes <= b.lastActivityMinutes ? a : b));
  return { label: latest.lastActivity, minutes: latest.lastActivityMinutes };
}

export function companyNotesFor(links: Record<number, number | null>, companyId: number) {
  const ids = companyContacts(links, companyId).map((c) => c.id);
  return contactNotes.filter((note) => ids.includes(note.contactId));
}

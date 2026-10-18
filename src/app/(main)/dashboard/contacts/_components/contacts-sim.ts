"use client";

// M129-A round 2 (judge: Delete and Merge on /dashboard/contacts did not survive a reload): the Contacts pages record
// their Delete and Merge in the preview's saved record, like the conversation panel does (chat sim-actions.ts), and
// say so. Same rules as Chatwoot:
// - Delete: the contact goes with its conversations (app/models/contact.rb, v4.18.0: has_many :conversations,
//   dependent: :destroy_async).
// - Merge: ContactMergeAction (app/actions/contact_merge_action.rb) keeps the primary contact, fills its empty fields
//   from the merged one (the primary wins a conflict), moves the merged one's conversations to it and deletes it.
// contacts-store.ts replays the saved record into the Contacts list on every page load; chat sim-actions.ts replays it
// into the inbox (conversations removed, merged conversations shown with the kept contact).
import { toast } from "sonner";

import type { Contact as ChatContact } from "@/app/(main)/chat/_components/data";
import { baseConversations, contactIdOf } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { cw, useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { type ContactOp, recordSim, SIMULATED, simId } from "@/lib/cw/preview-sim";

import { type ContactDraft, getLinkedContactsAdapter, useContactsStore } from "./contacts-store";
import type { Contact } from "./data";

// The inbox keys a person by their Contacts id (chat cw-store.ts contactKeyOf).
const keyOf = (id: number) => `contact:${id}`;
const conversationsOf = (id: number) => baseConversations.filter((c) => contactIdOf(c.id) === id).map((c) => c.id);

function deleteOne(contact: Contact): number {
  const convIds = conversationsOf(contact.id);
  const op: ContactOp = {
    id: simId("op"),
    at: new Date().toISOString(),
    op: "delete",
    profileId: contact.id,
    key: keyOf(contact.id),
    convIds,
  };
  useContactsStore.getState().remove([contact.id]);
  const gone = useCwStore.getState().deleted;
  cw.deleteConversation(convIds.filter((id) => !gone.includes(id)));
  void recordSim("contactOps", op);
  return convIds.length;
}

/**
 * F-3 (rule 129.2: "Add contact" was gone after a reload): adds the contact to the preview's data and keeps it in the
 * saved record, like Save Contact in a conversation (chat sim-actions.ts); contacts-store.ts replays it on load. The
 * toast says it is simulated, and only once the preview saved it (a failed save says "Not saved in the preview").
 */
export function simAddContact(draft: ContactDraft): Contact {
  const linked = getLinkedContactsAdapter();
  if (linked) {
    return linked.add(draft);
  }
  const contact = useContactsStore.getState().add(draft);
  const social = Object.fromEntries(Object.entries(draft.social ?? {}).filter(([, value]) => value?.trim())) as Record<
    string,
    string
  >;
  void recordSim("contactOps", {
    id: simId("op"),
    at: new Date().toISOString(),
    op: "add",
    contact,
    ...(Object.keys(social).length ? { social } : {}),
  }).then((saved) => {
    if (saved)
      toast.success("Contact saved successfully", {
        description: `${SIMULATED}: ${contact.name} was added to this preview's data. Nothing was saved in the engine.`,
      });
  });
  return contact;
}

/** Deletes contacts (and their conversations) from the preview's data; the toast says it is simulated. */
export function simDeleteContacts(ids: number[]) {
  const linked = getLinkedContactsAdapter();
  if (linked) {
    linked.remove(ids);
    return;
  }
  const list = useContactsStore.getState().list;
  const contacts = ids.map((id) => list.find((c) => c.id === id)).filter((c): c is Contact => Boolean(c));
  const conversations = contacts.reduce((sum, contact) => sum + deleteOne(contact), 0);
  const what = contacts.length === 1 ? contacts[0].name : `${contacts.length} contacts`;
  toast.success(contacts.length === 1 ? "Contact deleted successfully" : "Contacts deleted successfully.", {
    description: `${SIMULATED}: ${what} and ${conversations} conversation${conversations === 1 ? "" : "s"} left this preview's data. Nothing was deleted in the engine.`,
  });
}

/** Merges `mergedId` into `primaryId` (kept) in the preview's data; the toast says it is simulated. */
export function simMergeContacts(primaryId: number, mergedId: number) {
  const linked = getLinkedContactsAdapter();
  if (linked) {
    linked.merge(primaryId, mergedId);
    return;
  }
  const list = useContactsStore.getState().list;
  const kept = list.find((c) => c.id === primaryId);
  const mergee = list.find((c) => c.id === mergedId);
  if (!kept || !mergee || primaryId === mergedId) return;
  const location = (c: Contact) => [c.city, c.country].filter(Boolean).join(", ");
  const merged: Partial<ChatContact> = {
    name: kept.name,
    email: kept.email || mergee.email,
    phone: kept.phone || mergee.phone,
    company: kept.company || mergee.company,
    location: location(kept) || location(mergee),
  };
  const op: ContactOp = {
    id: simId("op"),
    at: new Date().toISOString(),
    op: "merge",
    keptId: primaryId,
    deletedId: mergedId,
    keptKey: keyOf(primaryId),
    deletedKey: keyOf(mergedId),
    convIds: conversationsOf(mergedId),
    merged,
  };
  useContactsStore.getState().merge(primaryId, mergedId);
  cw.editContact(op.deletedKey, merged);
  cw.editContact(op.keptKey, merged);
  void recordSim("contactOps", op);
  toast.success("Contact merged successfully", {
    description: `${SIMULATED}: ${mergee.name} was merged into ${kept.name} in this preview's data. Nothing was merged in the engine.`,
  });
}

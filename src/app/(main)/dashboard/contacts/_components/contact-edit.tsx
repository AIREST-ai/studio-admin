"use client";
// F161: the contact edit form used on the contact page and in the expanded row of the list (Chatwoot
// ContactDetails.vue "Edit contact details" and ContactsCard.vue's inline form). Saves to the contacts store.
import * as React from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  ContactFormFields,
  contactDraft,
  contactFormValue,
  isContactFormValid,
  SocialLinksFields,
} from "./contact-dialogs";
import { useContactsStore } from "./contacts-store";
import type { Contact } from "./data";

export function ContactEditForm({ contact }: { contact: Contact }) {
  const update = useContactsStore((s) => s.update);
  const social = useContactsStore((s) => s.social[contact.id]);
  const [value, setValue] = React.useState(() => contactFormValue(contact, social));

  // Load the stored values again when another contact is shown or the contact changes elsewhere (merge, labels).
  React.useEffect(() => {
    setValue(contactFormValue(contact, social));
  }, [contact, social]);

  return (
    <div className="grid gap-4">
      <ContactFormFields value={value} onChange={setValue} />
      <SocialLinksFields value={value} onChange={setValue} />
      <div>
        <Button
          size="sm"
          disabled={!isContactFormValid(value)}
          onClick={() => {
            update(contact.id, contactDraft(value));
            toast.success("Contact updated successfully");
          }}
        >
          Update contact
        </Button>
      </div>
    </div>
  );
}

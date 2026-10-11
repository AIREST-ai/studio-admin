import type { Metadata } from "next";

import { ContactsList } from "./_components/contacts-list";

export const metadata: Metadata = {
  title: "Contacts",
  description: "People who have talked to your team.",
};

export default function Page() {
  return <ContactsList />;
}

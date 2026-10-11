import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { ContactDetails } from "../_components/contact-details";
import { contacts } from "../_components/data";

export const metadata: Metadata = {
  title: "Contact details",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = contacts.find((c) => String(c.id) === id);
  if (!contact) notFound();
  return <ContactDetails contact={contact} />;
}

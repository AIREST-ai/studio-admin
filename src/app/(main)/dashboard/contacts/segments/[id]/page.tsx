import type { Metadata } from "next";

import { ContactsList } from "../../_components/contacts-list";

export const metadata: Metadata = {
  title: "Contacts",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactsList view={{ kind: "segment", id: Number(id) }} />;
}

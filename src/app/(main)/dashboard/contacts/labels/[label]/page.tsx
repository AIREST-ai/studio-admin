import type { Metadata } from "next";

import { ContactsList } from "../../_components/contacts-list";

export const metadata: Metadata = {
  title: "Contacts",
};

export default async function Page({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  return <ContactsList view={{ kind: "label", label: decodeURIComponent(label) }} />;
}

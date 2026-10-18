import type { Metadata } from "next";

import { ContactDetailsPage } from "../_components/contact-details";

export const metadata: Metadata = {
  title: "Contact details",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetailsPage id={Number(id)} />;
}

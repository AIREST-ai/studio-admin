import type { Metadata } from "next";

import { AttributesList } from "./_components/attributes-list";

export const metadata: Metadata = {
  title: "Custom Attributes",
  description: "Track additional details about contacts, companies and conversations.",
};

export default function Page() {
  return <AttributesList />;
}

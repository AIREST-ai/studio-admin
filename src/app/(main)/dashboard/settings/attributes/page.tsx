import type { Metadata } from "next";

import { AttributesSettings } from "./_components/attributes-settings";

export const metadata: Metadata = {
  title: "Custom Attributes",
  description: "Track additional details about contacts, companies and conversations.",
};

export default function Page() {
  return <AttributesSettings />;
}

import type { Metadata } from "next";

import { TemplatesList } from "./_components/templates-list";

export const metadata: Metadata = {
  title: "Templates",
  description: "Message templates synced from your WhatsApp inboxes.",
};

export default function Page() {
  return <TemplatesList />;
}

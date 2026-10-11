import type { Metadata } from "next";

import { TemplatesSettings } from "./_components/templates-settings";

export const metadata: Metadata = {
  title: "Templates",
  description: "Message templates synced from your WhatsApp inboxes.",
};

export default function Page() {
  return <TemplatesSettings />;
}

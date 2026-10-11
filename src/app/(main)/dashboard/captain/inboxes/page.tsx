import type { Metadata } from "next";

import { InboxesList } from "../_components/inboxes";

export const metadata: Metadata = {
  title: "Connected Inboxes",
  description: "Inboxes where Captain replies.",
};

export default function Page() {
  return <InboxesList />;
}

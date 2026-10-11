import type { Metadata } from "next";

import { InboxesList } from "./_components/inboxes-list";

export const metadata: Metadata = {
  title: "Inboxes",
  description: "Channels your customers use to reach you.",
};

export default function Page() {
  return <InboxesList />;
}

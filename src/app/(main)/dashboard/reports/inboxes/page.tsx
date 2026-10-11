import type { Metadata } from "next";

import { EntitySummary } from "../_components/entity-reports";

export const metadata: Metadata = {
  title: "Inbox reports",
};

export default function Page() {
  return <EntitySummary kind="inboxes" />;
}

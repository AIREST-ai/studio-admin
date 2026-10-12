import type { Metadata } from "next";

import { AddInboxWizard } from "../_components/add-inbox-wizard";

export const metadata: Metadata = {
  title: "Add Inbox",
};

export default function Page() {
  return <AddInboxWizard />;
}

import type { Metadata } from "next";

import { AddInbox } from "../_components/add-inbox";

export const metadata: Metadata = {
  title: "Add Inbox",
};

export default function Page() {
  return <AddInbox />;
}

import type { Metadata } from "next";

import { ConversationsWorkspace } from "../_components/conversations-workspace";

export const metadata: Metadata = {
  title: "Unattended",
};

export default function Page() {
  return <ConversationsWorkspace view={{ kind: "unattended" }} />;
}

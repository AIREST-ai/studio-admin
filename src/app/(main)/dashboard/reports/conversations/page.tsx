import type { Metadata } from "next";

import { ConversationReport } from "../_components/simple-reports";

export const metadata: Metadata = {
  title: "Conversations",
};

export default function Page() {
  return <ConversationReport />;
}

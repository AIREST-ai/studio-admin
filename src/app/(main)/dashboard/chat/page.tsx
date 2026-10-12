import type { Metadata } from "next";

import { ConversationsWorkspace } from "./_components/conversations-workspace";

export const metadata: Metadata = {
  title: "Conversations",
  robots: {
    index: false,
    follow: true,
  },
};

// F159: Chatwoot's conversations area (All Conversations). This is the only inbox: /chat redirects here.
export default function Page() {
  return <ConversationsWorkspace view={{ kind: "all" }} />;
}

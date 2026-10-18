import type { ReactNode } from "react";

import { InboxShell } from "@/app/(main)/dashboard/chat/_components/inbox-subnav";

// V-6 (item 160.8): Comments sits inside the Inbox shell and keeps its own route (/dashboard/comments).
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <InboxShell>{children}</InboxShell>;
}

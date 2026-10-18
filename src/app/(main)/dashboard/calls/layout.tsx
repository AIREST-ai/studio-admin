import type { ReactNode } from "react";

import { InboxShell } from "@/app/(main)/dashboard/chat/_components/inbox-subnav";

// T-53: Calls is inside the Inbox and keeps its own address (/dashboard/calls).
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <InboxShell>{children}</InboxShell>;
}

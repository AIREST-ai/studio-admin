import type { ReactNode } from "react";

import { InboxShell } from "./_components/inbox-subnav";

// T-53: every conversations page is inside the Inbox, with its inner bar beside the main sidebar.
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <InboxShell>{children}</InboxShell>;
}

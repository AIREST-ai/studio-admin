import type { Metadata } from "next";

import { NotificationsView } from "./_components/notifications-view";

export const metadata: Metadata = {
  title: "My Inbox",
  description: "Notifications from all subscribed inboxes.",
};

// T-49 / F-17: shown or hidden by the owner (Owner console, /super_admin; default in src/config/features.ts). While it
// is hidden a direct visit shows "My Inbox is hidden by the site owner" (dashboard/_components/view-as.tsx).
export default function Page() {
  return <NotificationsView />;
}

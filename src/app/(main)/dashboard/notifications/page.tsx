import type { Metadata } from "next";

import { NotificationsView } from "./_components/notifications-view";

export const metadata: Metadata = {
  title: "My Inbox",
  description: "Notifications from all subscribed inboxes.",
};

export default function Page() {
  return <NotificationsView />;
}

import type { Metadata } from "next";

import { NotificationsInbox } from "./_components/notifications-inbox";

export const metadata: Metadata = {
  title: "My Inbox",
  description: "Notifications from all subscribed inboxes.",
};

export default function Page() {
  return <NotificationsInbox />;
}

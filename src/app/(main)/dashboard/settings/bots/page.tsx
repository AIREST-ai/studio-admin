import type { Metadata } from "next";

import { BotsList } from "./_components/bots-list";

export const metadata: Metadata = {
  title: "Bots",
  description: "Agent bots connected to your inboxes.",
};

export default function Page() {
  return <BotsList />;
}

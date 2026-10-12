import type { Metadata } from "next";

import { BotsPage } from "./_components/bots-page";

export const metadata: Metadata = {
  title: "Bots",
  description: "Agent bots connected to your inboxes.",
};

export default function Page() {
  return <BotsPage />;
}

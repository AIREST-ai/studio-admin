import type { Metadata } from "next";

import { Kanban } from "./_components/kanban";

export const metadata: Metadata = {
  title: "Dodge board",
  description:
    "Agent replies that left a customer's problem unsolved, in this preview's conversations, followed until solved.",
  alternates: {
    canonical: "/dashboard/kanban",
  },
};

// F-9: the board reads the preview's conversations and its saved copy itself (kanban.tsx), so nothing is passed here.
export default function Page() {
  return (
    <div data-content-padding="false">
      <Kanban />
    </div>
  );
}

import type { Metadata } from "next";

import { initialBoard } from "@/app/(main)/dashboard/kanban/_components/data";
import { Kanban } from "@/app/(main)/dashboard/kanban/_components/kanban";

export const metadata: Metadata = {
  title: "Dodge board — 32px button sample",
  robots: { index: false, follow: false },
};

// T-229: the same content as /dashboard/kanban (kanban/page.tsx), shown inside the 32px sample.
export default function Page() {
  return (
    <div data-content-padding="false">
      <Kanban initialBoard={initialBoard} />
    </div>
  );
}

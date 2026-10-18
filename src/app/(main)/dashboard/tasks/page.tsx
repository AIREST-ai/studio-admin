import type { Metadata } from "next";

import { TwentyBoard } from "./_twenty/twenty-board";

export const metadata: Metadata = {
  title: "Tasks",
  description:
    "Tasks from the tasks server: running work on the board, Done, On hold and Canceled in their own sections, cards you design.",
  alternates: {
    canonical: "/dashboard/tasks",
  },
};

// M129-F (Fahad 129.6): the Tasks page now reads and writes the ready task system Twenty (local install, see
// src/lib/twenty/server.ts) instead of the template's sample tasks. The previous board (./_board, saved by
// /api/tasks-board) is no longer shown here; the calendar still reads its own copy for due dates.
export default function Page() {
  return (
    <div data-content-padding="false">
      <TwentyBoard />
    </div>
  );
}

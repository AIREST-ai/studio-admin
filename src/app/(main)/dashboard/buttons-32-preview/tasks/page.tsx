import type { Metadata } from "next";

import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { tasks } from "@/app/(main)/dashboard/tasks/_components/data";
import { Tasks } from "@/app/(main)/dashboard/tasks/_components/tasks";

export const metadata: Metadata = {
  title: "Tasks — 32px button sample",
  robots: { index: false, follow: false },
};

// T-229: the same content as /dashboard/tasks (tasks/page.tsx), shown inside the 32px sample.
export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Tasks" subtitle="Here's a list of your tasks for this month!" />
      <Tasks data={tasks} />
    </div>
  );
}

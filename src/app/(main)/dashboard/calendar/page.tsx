import type { Metadata } from "next";

import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { APP_CONFIG } from "@/config/app-config";

import { Calendar } from "./_components/calendar";

// F-9 (sim3 problem 10): the tab shows the page and the product's name, as the sign-in pages do
// ("Login · Studio Admin"), not the template's marketing title "Open Source … with shadcn/ui".
export const metadata: Metadata = {
  title: `Calendar · ${APP_CONFIG.name}`,
  description: "Your team's events and schedules.",
  alternates: {
    canonical: "/dashboard/calendar",
  },
};

// M129-G (Fahad 129.8): calendars, events and sharing are stored in Davis (CalDAV); task due dates come from Twenty,
// like the Tasks page (the old ?space= test board of /api/tasks-board is not read any more).
export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Calendar" subtitle="Your team's events and schedules." />
      <Calendar />
    </div>
  );
}

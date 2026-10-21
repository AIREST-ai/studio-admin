import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { Planner } from "./_components/planner";

export const metadata: Metadata = {
  title: `Planner · ${APP_CONFIG.name}`,
  description: "Your tasks and appointments in one place.",
  alternates: {
    canonical: "/dashboard/planner",
  },
};

// FAH-20 (Fahad FAH-12, axis 8 «تبسيط ودمج المهام والتقويم»): one place for the day. "Today" lists the appointments
// (Davis) and the task due dates (Twenty) together; "Calendar" and "Tasks" are the two full pages, unchanged, so
// nothing is rebuilt and /dashboard/calendar and /dashboard/tasks still open on their own.
export default function Page() {
  return <Planner />;
}

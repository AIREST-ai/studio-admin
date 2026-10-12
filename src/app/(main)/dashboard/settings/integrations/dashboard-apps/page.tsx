import type { Metadata } from "next";

import { DashboardAppsPage } from "../_components/dashboard-apps-page";

export const metadata: Metadata = {
  title: "Dashboard Apps",
};

export default function Page() {
  return <DashboardAppsPage />;
}

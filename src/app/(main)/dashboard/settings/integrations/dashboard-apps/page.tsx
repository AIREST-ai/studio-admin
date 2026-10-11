import type { Metadata } from "next";

import { DashboardAppsList } from "../_components/dashboard-apps-list";

export const metadata: Metadata = {
  title: "Dashboard Apps",
};

export default function Page() {
  return <DashboardAppsList />;
}

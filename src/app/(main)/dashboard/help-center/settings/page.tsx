import type { Metadata } from "next";

import { PortalSettings } from "../_components/portal-settings";

export const metadata: Metadata = {
  title: "Portal settings · Help Center",
};

export default function Page() {
  return <PortalSettings />;
}

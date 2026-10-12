import type { Metadata } from "next";

import { PortalSettings } from "../_components/portal-settings";
import { PortalGate } from "../_components/portal-title";

export const metadata: Metadata = {
  title: "Portal settings · Help Center",
};

export default function Page() {
  return (
    <PortalGate>
      <PortalSettings />
    </PortalGate>
  );
}

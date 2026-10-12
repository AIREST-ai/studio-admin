import type { Metadata } from "next";

import { LocalesList } from "../_components/locales-list";
import { PortalGate } from "../_components/portal-title";

export const metadata: Metadata = {
  title: "Locales · Help Center",
};

export default function Page() {
  return (
    <PortalGate>
      <LocalesList />
    </PortalGate>
  );
}

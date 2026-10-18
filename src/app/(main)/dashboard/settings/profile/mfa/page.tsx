import type { Metadata } from "next";

import { MfaSettings } from "../_components/mfa-settings";

export const metadata: Metadata = {
  title: "Two-Factor Authentication",
};

// F-6A: the page shows the saved state (api/settings-preview/mfa). The old ?state=enabled showed a made-up enabled
// account with made-up backup codes, so it is gone.
export default function Page() {
  return <MfaSettings />;
}

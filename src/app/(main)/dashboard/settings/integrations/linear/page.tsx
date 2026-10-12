import type { Metadata } from "next";

import { OAuthIntegration } from "../_components/oauth-integration";

export const metadata: Metadata = {
  title: "Linear",
  description: "Connect Linear to this account.",
};

export default function Page() {
  return <OAuthIntegration integrationId="linear" />;
}

import type { Metadata } from "next";

import { OAuthIntegration } from "../_components/oauth-integration";

export const metadata: Metadata = {
  title: "Notion",
  description: "Connect Notion to this account.",
};

export default function Page() {
  return <OAuthIntegration integrationId="notion" />;
}

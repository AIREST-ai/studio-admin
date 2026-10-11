import type { Metadata } from "next";

import { WebhooksList } from "../_components/webhooks-list";

export const metadata: Metadata = {
  title: "Webhooks",
};

export default function Page() {
  return <WebhooksList />;
}

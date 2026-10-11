import type { Metadata } from "next";

import { SlackIntegration } from "../_components/slack-integration";

export const metadata: Metadata = {
  title: "Slack",
};

export default function Page() {
  return <SlackIntegration />;
}

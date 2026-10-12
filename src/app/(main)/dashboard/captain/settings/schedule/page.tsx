import type { Metadata } from "next";

import { AssistantSettings } from "../../_components/assistant-settings";

export const metadata: Metadata = {
  title: "Assistant settings · Schedule",
  description: "Captain assistant settings: schedule.",
};

export default function Page() {
  return <AssistantSettings section="schedule" />;
}

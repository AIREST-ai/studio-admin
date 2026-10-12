import type { Metadata } from "next";

import { AssistantSettings } from "../../_components/assistant-settings";

export const metadata: Metadata = {
  title: "Assistant settings · System",
  description: "Captain assistant settings: system.",
};

export default function Page() {
  return <AssistantSettings section="system" />;
}

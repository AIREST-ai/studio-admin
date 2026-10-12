import type { Metadata } from "next";

import { AssistantSettings } from "../../_components/assistant-settings";

export const metadata: Metadata = {
  title: "Assistant settings · Guidelines",
  description: "Captain assistant settings: guidelines.",
};

export default function Page() {
  return <AssistantSettings section="guidelines" />;
}

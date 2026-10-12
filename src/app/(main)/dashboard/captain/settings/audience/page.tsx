import type { Metadata } from "next";

import { AssistantSettings } from "../../_components/assistant-settings";

export const metadata: Metadata = {
  title: "Assistant settings · Audience",
  description: "Captain assistant settings: audience.",
};

export default function Page() {
  return <AssistantSettings section="audience" />;
}

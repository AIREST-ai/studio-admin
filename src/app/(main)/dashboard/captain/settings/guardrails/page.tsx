import type { Metadata } from "next";

import { AssistantSettings } from "../../_components/assistant-settings";

export const metadata: Metadata = {
  title: "Assistant settings · Guardrails",
  description: "Captain assistant settings: guardrails.",
};

export default function Page() {
  return <AssistantSettings section="guardrails" />;
}

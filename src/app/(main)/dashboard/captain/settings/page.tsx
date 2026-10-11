import type { Metadata } from "next";

import { AssistantSettings } from "../_components/assistant-settings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Captain assistant settings.",
};

export default function Page() {
  return <AssistantSettings />;
}

import type { Metadata } from "next";

import { AssistantsList } from "../_components/assistants";

export const metadata: Metadata = {
  title: "Assistants",
  description: "Captain assistants in this account.",
};

export default function Page() {
  return <AssistantsList />;
}

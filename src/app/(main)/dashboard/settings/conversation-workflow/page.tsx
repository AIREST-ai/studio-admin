import type { Metadata } from "next";

import { WorkflowSettings } from "./_components/workflow-settings";

export const metadata: Metadata = {
  title: "Conversation Workflows",
  description: "Rules and required fields for conversation resolution.",
};

export default function Page() {
  return <WorkflowSettings />;
}

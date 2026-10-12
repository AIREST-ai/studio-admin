import type { Metadata } from "next";

import { WorkflowPage } from "./_components/workflow-page";

export const metadata: Metadata = {
  title: "Conversation Workflows",
  description: "Rules and required fields for conversation resolution.",
};

export default function Page() {
  return <WorkflowPage />;
}

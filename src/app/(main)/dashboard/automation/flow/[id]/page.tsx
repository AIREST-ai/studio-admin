import type { Metadata } from "next";

import { FlowEditor } from "../../../settings/automation/_flow/flow-editor";

// T-139: the visual editor for one automation flow. T-234: under Automation's own sidebar icon, not Settings.
// id: "new", "rule-<rule id>" (draw an existing rule) or a saved flow id ("flow-…"); the editor resolves it.
export const metadata: Metadata = {
  title: "Automation flow",
  description: "Draw automation rules as steps: trigger, wait, conditions and actions.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FlowEditor id={id} />;
}

import type { Metadata } from "next";

import { ToolsList } from "../_components/tools";

export const metadata: Metadata = {
  title: "Tools",
  description: "Custom tools that connect Captain to external APIs.",
};

export default function Page() {
  return <ToolsList />;
}

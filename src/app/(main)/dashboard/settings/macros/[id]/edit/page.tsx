import type { Metadata } from "next";

import { MacroBuilder } from "../../_components/macro-builder";

export const metadata: Metadata = {
  title: "Edit macro",
  description: "Change the actions, name and visibility of a macro.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MacroBuilder macroId={Number(id)} />;
}

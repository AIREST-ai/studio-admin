import type { Metadata } from "next";

import { MacroBuilder } from "../_components/macro-builder";

export const metadata: Metadata = {
  title: "Macro editor",
  description: "Build a macro from a list of actions.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  // Older links used /macros/new?id=<id>; Chatwoot's edit route is /macros/<id>/edit (both work).
  return <MacroBuilder macroId={id ? Number(id) : undefined} />;
}

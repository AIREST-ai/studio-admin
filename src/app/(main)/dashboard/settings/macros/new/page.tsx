import type { Metadata } from "next";

import { macros } from "../_components/data";
import { MacroEditor } from "../_components/macro-editor";

export const metadata: Metadata = {
  title: "Macro editor",
  description: "Build a macro from a list of actions.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const macro = macros.find((m) => String(m.id) === id);
  return <MacroEditor macro={macro} />;
}

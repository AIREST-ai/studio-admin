import type { Metadata } from "next";

import { SettingsIndex } from "./_components/settings-index";

export const metadata: Metadata = {
  title: "Settings",
  description: "Everything you can configure in this account.",
};

export default function Page() {
  return <SettingsIndex />;
}

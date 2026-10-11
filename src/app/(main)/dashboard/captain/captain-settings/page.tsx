import type { Metadata } from "next";

import { CaptainSettings } from "../_components/captain-settings";

export const metadata: Metadata = {
  title: "Captain Settings",
  description: "Captain models and features.",
};

export default function Page() {
  return <CaptainSettings />;
}

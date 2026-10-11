import type { Metadata } from "next";

import { BotReport } from "../_components/simple-reports";

export const metadata: Metadata = {
  title: "Bot Reports",
};

export default function Page() {
  return <BotReport />;
}

import type { Metadata } from "next";

import { AccountSettings } from "./_components/account-settings";

export const metadata: Metadata = {
  title: "Account settings",
  description: "General settings for this account.",
};

export default function Page() {
  return <AccountSettings />;
}

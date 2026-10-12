import type { Metadata } from "next";

import { AccountPage } from "./_components/account-page";

export const metadata: Metadata = {
  title: "Account settings",
  description: "General settings for this account.",
};

export default function Page() {
  return <AccountPage />;
}

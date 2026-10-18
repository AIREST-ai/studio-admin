import { Suspense } from "react";

import type { Metadata } from "next";

import { ProfilePage } from "./_components/profile-page";

export const metadata: Metadata = {
  title: "Profile Settings",
};

// م137 round 2 item 8: the page reads ?tab= (useSearchParams), so it renders inside Suspense.
export default function Page() {
  return (
    <Suspense>
      <ProfilePage />
    </Suspense>
  );
}

import { Suspense } from "react";

import type { Metadata } from "next";

import { UsersRoles } from "./_components/users-roles";

export const metadata: Metadata = {
  title: "Users & Roles",
  description: "Your team, and what each person can see and do.",
  alternates: {
    canonical: "/dashboard/users",
  },
};

export default function Page() {
  return (
    <Suspense>
      <UsersRoles />
    </Suspense>
  );
}

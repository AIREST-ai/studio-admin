import { Suspense } from "react";

import type { Metadata } from "next";

import { roles } from "../roles/_components/roles-table/data";
import { users } from "./_components/data";
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
      <UsersRoles users={users} roles={roles} />
    </Suspense>
  );
}

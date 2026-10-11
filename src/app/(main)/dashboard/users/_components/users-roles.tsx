"use client";
// F140 (أمر فهد): «المستخدمون والأدوار» في بند واحد — تبويبان مع العدد، والتبويب يُحفظ في الرابط (?tab=roles).
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Roles } from "../../roles/_components/roles";
import type { Role } from "../../roles/_components/roles-table/data";
import type { UserRow } from "./data";
import { Users } from "./users";

type Tab = "users" | "roles";

export function UsersRoles({ users, roles }: { users: UserRow[]; roles: Role[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<Tab>(params.get("tab") === "roles" ? "roles" : "users");

  const select = (value: string) => {
    setTab(value === "roles" ? "roles" : "users");   // يتبدّل فوراً، ثم يُحفظ في الرابط
    const next = new URLSearchParams(params.toString());
    if (value === "roles") next.set("tab", "roles");
    else next.delete("tab");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Users & Roles</h1>
        <p className="text-muted-foreground text-sm">Your team, and what each person can see and do.</p>
      </div>

      <Tabs className="h-full gap-4" value={tab} onValueChange={select}>
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          <TabsTrigger value="users">
            Users
            <Badge variant="secondary" className="ms-1 tabular-nums">
              {users.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="roles">
            Roles
            <Badge variant="secondary" className="ms-1 tabular-nums">
              {roles.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Users users={users} />
        </TabsContent>
        <TabsContent value="roles">
          <Roles roles={roles} embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

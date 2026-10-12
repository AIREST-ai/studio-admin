"use client";
// F140 (أمر فهد): «المستخدمون والأدوار» في بند واحد — تبويبان مع العدد، والتبويب يُحفظ في الرابط (?tab=roles).
// F159: Users tab = Chatwoot Agents, Roles tab = Chatwoot Custom Roles. One shared mock store lives here, so a custom
// role added in the Roles tab appears at once in Add / Edit agent and in the agents' role labels.
import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PageHeading } from "../../contacts/_components/studio-ui";
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
  const [agentList, setAgentList] = React.useState<UserRow[]>(users);
  const [roleList, setRoleList] = React.useState<Role[]>(roles);
  const [roleFilterRequest, setRoleFilterRequest] = React.useState<{ role: string; at: number } | null>(null);

  const select = React.useCallback(
    (value: string) => {
      setTab(value === "roles" ? "roles" : "users"); // يتبدّل فوراً، ثم يُحفظ في الرابط
      const next = new URLSearchParams(params.toString());
      if (value === "roles") next.set("tab", "roles");
      else next.delete("tab");
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const viewAgents = React.useCallback(
    (role: Role) => {
      setRoleFilterRequest({ role: role.name, at: Date.now() });
      select("users");
    },
    [select],
  );

  const customCount = roleList.filter((r) => r.group === "Custom roles").length;

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeading title="Users & Roles" subtitle="Your agents, and the roles that decide what each one can see and do." />

      <Tabs className="h-full gap-4" value={tab} onValueChange={select}>
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          <TabsTrigger value="users">
            Agents
            <Badge variant="secondary" className="ms-1 tabular-nums">
              {agentList.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="roles">
            Custom Roles
            <Badge variant="secondary" className="ms-1 tabular-nums">
              {customCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Users agents={agentList} setAgents={setAgentList} roles={roleList} roleFilterRequest={roleFilterRequest} />
        </TabsContent>
        <TabsContent value="roles">
          <Roles
            roles={roleList}
            setRoles={setRoleList}
            agents={agentList}
            setAgents={setAgentList}
            onViewAgents={viewAgents}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

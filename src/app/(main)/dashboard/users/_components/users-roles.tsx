"use client";
// F140 (أمر فهد): «المستخدمون والأدوار» في بند واحد — تبويبان مع العدد، والتبويب يُحفظ في الرابط (?tab=roles).
// F159: Users tab = Chatwoot Agents, Roles tab = Chatwoot Custom Roles. A custom role added in the Roles tab appears at
// once in Add / Edit agent and in the agents' role labels.
// F161: agents, teams and inboxes are the shared lists of src/lib/cw/store (an agent added, edited or deleted here, or
// moved to a team, shows in Settings, Conversations and Reports too); custom roles live in ../../roles/roles-store.
import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setCwList, useCwList, useCwShared } from "@/lib/cw/store";

import { Roles } from "../../roles/_components/roles";
import { setRoles, useRolesStore } from "../../roles/_components/roles-store";
import type { Role } from "../../roles/_components/roles-table/data";
import { PageHeader } from "../../settings/labels/_shared/settings-shell";
import { toAgent, toUserRow, type UserRow } from "./data";
import { Users } from "./users";

type Tab = "users" | "roles";

function currentRows(): UserRow[] {
  const { agents, teams, inboxes } = useCwShared.getState();
  return agents.map((a) => toUserRow(a, teams, inboxes));
}

/** Writes agent rows back to the shared store; a deleted agent also leaves its teams and inboxes. */
function setAgentRows(next: React.SetStateAction<UserRow[]>) {
  const before = currentRows();
  const after = typeof next === "function" ? next(before) : next;
  const kept = new Set(after.map((a) => a.id));
  const removed = before.filter((a) => !kept.has(a.id)).map((a) => a.id);
  setCwList(
    "agents",
    after.map((row) => toAgent(row)),
  );
  if (removed.length) {
    setCwList("teams", (list) => list.map((t) => ({ ...t, members: t.members.filter((id) => !removed.includes(id)) })));
    setCwList("inboxes", (list) => list.map((i) => ({ ...i, agents: i.agents.filter((id) => !removed.includes(id)) })));
  }
}

// F-25: adding, editing and deleting an agent, and Manage team, wait for the preview server's answer
// (./agents-store.ts); the Users tab calls those directly, so this page passes it only the lists.
export function UsersRoles() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // م137 round 2 (judge M137): the tab follows the address, so the Settings bar's Custom Roles link
  // (/dashboard/users?tab=roles) and Agents link (/dashboard/users) switch it even when this page is already open.
  const urlTab: Tab = params.get("tab") === "roles" ? "roles" : "users";
  const [tab, setTab] = React.useState<Tab>(urlTab);
  React.useEffect(() => setTab(urlTab), [urlTab]);
  // م137 round 2: the page header's action slot and the end of the tab row, filled by the open tab (portals).
  const [headerActions, setHeaderActions] = React.useState<HTMLDivElement | null>(null);
  const [viewSlot, setViewSlot] = React.useState<HTMLDivElement | null>(null);
  const [cwAgents] = useCwList("agents");
  const [cwTeams] = useCwList("teams");
  const [cwInboxes] = useCwList("inboxes");
  const roleList = useRolesStore((s) => s.roles);
  const [roleFilterRequest, setRoleFilterRequest] = React.useState<{ role: string; at: number } | null>(null);

  const agentList = React.useMemo(
    () => cwAgents.map((a) => toUserRow(a, cwTeams, cwInboxes)),
    [cwAgents, cwTeams, cwInboxes],
  );
  const teamNames = React.useMemo(() => cwTeams.map((t) => t.name), [cwTeams]);
  const inboxNames = React.useMemo(() => cwInboxes.map((i) => i.name), [cwInboxes]);

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
      {/* م137 round 2 (Fahad 137, judge M137): the Settings page template. The title is the open tab's name, as in
          the Settings bar (Agents, Custom Roles); under it Chatwoot's line for that page (agents/Index.vue,
          customRoles/Index.vue) with its Learn more link; the tab's own buttons at the right. */}
      <PageHeader
        title={tab === "roles" ? "Custom Roles" : "Agents"}
        description={
          tab === "roles"
            ? "Custom roles are roles that are created by the account owner or admin. These roles can be assigned to agents to define their access and permissions within the account. Custom roles can be created with specific permissions and access levels to suit the requirements of the organization."
            : "An agent is a member of your customer support team who can view and respond to user messages. The list below shows all the agents in your account."
        }
        learnMore={tab === "roles" ? "Learn more about custom roles" : "Learn about user roles"}
        actions={<div ref={setHeaderActions} className="flex flex-wrap items-center justify-end gap-2" />}
      />

      <Tabs className="h-full gap-4" value={tab} onValueChange={select}>
        <div className="flex items-end justify-between gap-3 border-b">
          <TabsList variant="line" className="justify-start gap-2 ps-0 *:data-[slot=tabs-trigger]:flex-none">
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
          <div ref={setViewSlot} className="pb-1.5" />
        </div>

        <TabsContent value="users">
          <Users
            agents={agentList}
            teamNames={teamNames}
            inboxNames={inboxNames}
            roles={roleList}
            roleFilterRequest={roleFilterRequest}
            onRoleFilterApplied={() => setRoleFilterRequest(null)}
            headerActions={headerActions}
          />
        </TabsContent>
        <TabsContent value="roles">
          <Roles
            roles={roleList}
            setRoles={setRoles}
            agents={agentList}
            setAgents={setAgentRows}
            onViewAgents={viewAgents}
            headerActions={headerActions}
            viewSlot={viewSlot}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

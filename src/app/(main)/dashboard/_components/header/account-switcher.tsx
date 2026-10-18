"use client";

// F-5A (sim1 persona 2: "Ammar Khan" in this menu changed nothing): the picture's menu is "View as". It lists the people
// of Settings > Agents; choosing one shows the app as that person, with their role applied as Chatwoot v4.18 applies it
// (src/lib/cw/view-as.ts), and a banner that says it is a preview without sign-in. The choice is kept in this browser
// (a cookie) until "Back to Arham Khan". Nobody is signed in or out.
import Link from "next/link";

import { cn } from "cn";
import { BadgeCheck, Castle, Check, CreditCard, Eye } from "lucide-react";

import { useRolesStore } from "@/app/(main)/dashboard/roles/_components/roles-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { profileAvatar, useSignedInProfile } from "@/lib/cw/signed-in-profile";
import { useCwShared } from "@/lib/cw/store";
import { canOpen, useViewer, viewerOf } from "@/lib/cw/view-as";
import { useSectionShown } from "@/lib/owner/site-sections-context";
import { getInitials } from "@/lib/utils";

import { LogOutMenuItem, NotificationsMenuItem } from "../preview-logout";
import { setViewAs } from "../view-as";

export function AccountSwitcher({
  users,
}: {
  readonly users: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
    readonly role: string;
  }>;
}) {
  const viewer = useViewer();
  const myInboxShown = useSectionShown("my-inbox");
  const agents = useCwShared((state) => state.agents);
  const roles = useRolesStore((state) => state.roles);
  // The picture of the signed-in sample administrator comes from data/users.ts; the other agents have none.
  const avatarOf = (email: string) => users.find((user) => user.email === email)?.avatar ?? "";
  // F-9 (sim3 step 3.1b): the signed-in person is shown with the name, email and picture saved in Profile Settings;
  // someone picked in "View as" with theirs from Settings > Agents.
  const profile = useSignedInProfile();
  const activeUser = viewer.viewingAs
    ? { name: viewer.name, email: viewer.email, avatar: avatarOf(viewer.email) }
    : {
        name: profile?.name ?? viewer.name,
        email: profile?.email ?? viewer.email,
        avatar: profileAvatar(profile, avatarOf(viewer.email)),
      };

  return (
    <DropdownMenu>
      {/* T-146: a real button, so the picture is reached and opened from the keyboard like the icons beside it. */}
      <DropdownMenuTrigger
        aria-label={`Account menu, ${viewer.viewingAs ? `viewing as ${viewer.name} (${viewer.roleName})` : activeUser.name}`}
        className={cn(
          "rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          viewer.viewingAs && "ring-2 ring-amber-400",
        )}
      >
        <Avatar className="size-8 rounded-lg">
          <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.name} />
          {/* F159: Radix only shows AvatarImage after hydration + its own load check, so a fresh page load
              (for example /chat redirecting to /dashboard/chat) showed the grey initials first. The plain img
              is in the server HTML, so the browser fetches it with the page; if it fails, the initials stay. */}
          <AvatarFallback className="relative overflow-hidden">
            {getInitials(activeUser.name)}
            {activeUser.avatar ? (
              // biome-ignore lint/performance/noImgElement: must render before hydration, see note above.
              <img src={activeUser.avatar} alt="" className="absolute inset-0 size-full rounded-full object-cover" />
            ) : null}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="max-h-[min(80vh,40rem)] min-w-64 space-y-1 overflow-y-auto rounded-lg"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        {/* F-9: who the page is shown as, on top of the menu, as Chatwoot's profile menu shows the name and email. */}
        <DropdownMenuLabel className="p-0 font-normal" data-account-menu-person="">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.name} />
              <AvatarFallback className="rounded-lg">{getInitials(activeUser.name)}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate font-medium">{activeUser.name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {viewer.viewingAs ? `Viewing as · ${viewer.roleName}` : activeUser.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Eye className="size-3.5" aria-hidden="true" />
          View as (preview, no sign-in)
        </DropdownMenuLabel>
        {agents.map((agent) => {
          const person = viewerOf(agent, roles);
          const current = agent.id === viewer.id;
          return (
            <DropdownMenuItem
              key={agent.id}
              data-view-as-agent={agent.id}
              className={cn("p-0", current && "bg-accent/50")}
              aria-current={current ? "true" : undefined}
              onClick={() => {
                if (!current) setViewAs(agent.id);
              }}
            >
              <div className="flex w-full items-center gap-2 px-1 py-1.5">
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={avatarOf(agent.email) || undefined} alt={agent.name} />
                  <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {person.viewingAs ? agent.name : (profile?.name ?? agent.name)}
                  </span>
                  <span className="truncate text-xs">{person.roleName}</span>
                </div>
                <span
                  className={cn(
                    "mr-1 flex size-5 items-center justify-center rounded-full text-primary opacity-0",
                    current && "opacity-100",
                  )}
                >
                  <Check aria-hidden="true" />
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* T-146 (T-142's follow-up): "Account" in the picture's menu is the signed-in person's own account, which is
              Profile Settings (/settings/account is the organisation's general settings), as in Chatwoot's profile
              menu. */}
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings/profile">
              <BadgeCheck />
              Account
            </Link>
          </DropdownMenuItem>
          {/* م137 round 2 item 8 (simulation: "Billing does nothing"): billing has one place, Settings > Billing, and
              this entry opens it. */}
          {/* F-5A: Billing is for administrators (Chatwoot settings/billing/billing.routes.js), so "View as" an agent
              does not offer it. */}
          {canOpen(viewer, "/dashboard/settings/billing") && (
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/billing">
                <CreditCard />
                Billing
              </Link>
            </DropdownMenuItem>
          )}
          {/* T-55 / F-17: hidden with My Inbox while the owner hides it (Owner console; default src/config/features.ts). */}
          {/* F-6A (sim2 problem 15): Notifications opens My Inbox; Log out leaves the preview (../preview-logout.tsx). */}
          {myInboxShown && <NotificationsMenuItem />}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* F-17 (T-91): Chatwoot's profile menu offers "Super Admin Console" to a super admin only, just above Log out,
            opening /super_admin in a new tab (components-next/sidebar/SidebarProfileMenu.vue v4.18.0). Not offered
            while viewing the preview as another agent. */}
        {!viewer.viewingAs && (
          <DropdownMenuItem asChild>
            <a href="/super_admin" target="_blank" rel="noreferrer" data-owner-console-link>
              <Castle />
              Owner console
            </a>
          </DropdownMenuItem>
        )}
        <LogOutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

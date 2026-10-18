"use client";

import Link from "next/link";

import { cn } from "cn";
import { Castle, CircleUser, CreditCard, EllipsisVertical, MessageSquareDot } from "lucide-react";

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
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { profileAvatar, useSignedInProfile } from "@/lib/cw/signed-in-profile";
import { canOpen, useViewer } from "@/lib/cw/view-as";
import { useSectionShown } from "@/lib/owner/site-sections-context";
import { getInitials } from "@/lib/utils";

import { LogOutMenuItem, NotificationsMenuItem } from "../preview-logout";

export function NavUser({
  user,
}: {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  // F-9 (sim3 persona 2: the sidebar's person stayed "AK" while viewing as Priya; step 3.1b: it kept the old name):
  // the person the page is shown as, as in the header picture menu. "View as" someone shows them (initials, name,
  // role); otherwise the signed-in person with the name, email and picture saved in Profile Settings.
  const viewer = useViewer();
  const profile = useSignedInProfile();
  const myInboxShown = useSectionShown("my-inbox");
  const shown = viewer.viewingAs
    ? { name: viewer.name, email: viewer.email, avatar: "" }
    : {
        name: profile?.name ?? user.name,
        email: profile?.email ?? user.email,
        avatar: profileAvatar(profile, user.avatar),
      };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* T-73: in the icon rail only the avatar shows; the name is in a tooltip on hover or focus. */}
            <SidebarMenuButton
              size="lg"
              // T-89: no tooltip in the phone drawer, where the name shows beside the avatar.
              tooltip={isMobile ? undefined : viewer.viewingAs ? `Viewing as ${shown.name}` : shown.name}
              data-nav-user={viewer.viewingAs ? `viewing-as-${viewer.id}` : "signed-in"}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className={cn("h-8 w-8 rounded-lg grayscale", viewer.viewingAs && "ring-2 ring-amber-400")}>
                <AvatarImage src={shown.avatar || undefined} alt={shown.name} />
                <AvatarFallback className="rounded-lg">{getInitials(shown.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{shown.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {viewer.viewingAs ? `Viewing as · ${viewer.roleName}` : shown.email}
                </span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={shown.avatar || undefined} alt={shown.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(shown.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{shown.name}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {viewer.viewingAs ? `Viewing as · ${viewer.roleName}` : shown.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {/* T-166 (item 54): "Account" opens the signed-in person's profile, as in the header's picture menu
                  (account-switcher.tsx). On phones nav-main.tsx closes the drawer once the page changes. */}
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/profile">
                  <CircleUser />
                  Account
                </Link>
              </DropdownMenuItem>
              {/* م137 round 2 item 8 (simulation: "Billing does nothing"): billing has one place, Settings > Billing,
                  and this entry opens it. */}
              {/* F-9: as in the header menu, Billing is for administrators, so "View as" an agent does not offer it. */}
              {canOpen(viewer, "/dashboard/settings/billing") && (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings/billing">
                    <CreditCard />
                    Billing
                  </Link>
                </DropdownMenuItem>
              )}
              {/* T-55 / F-17: hidden with My Inbox while the owner hides it (Owner console; default src/config/features.ts). */}
              {/* F-6A (sim2 problem 15): Notifications opens My Inbox, Log out leaves the preview (preview-logout.tsx). */}
              {myInboxShown && <NotificationsMenuItem icon={<MessageSquareDot />} />}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* F-17 (T-91): as Chatwoot's profile menu offers "Super Admin Console" to a super admin only, just above
                Log out, opening /super_admin in a new tab (components-next/sidebar/SidebarProfileMenu.vue v4.18.0).
                Not offered while viewing the preview as another agent. */}
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

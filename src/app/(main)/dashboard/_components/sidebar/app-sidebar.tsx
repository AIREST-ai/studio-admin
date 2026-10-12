"use client";

import Link from "next/link";

import { Command } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { rootUser } from "@/data/users";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { SupportCard } from "./support-card";

// Overrides SidebarContent's no-scrollbar: scrollbar-width must stay auto so Chrome and Safari use the
// ::-webkit-scrollbar rules (a thin, rounded thumb with no arrow buttons, transparent until hover). scroll-fade
// fades the top or bottom edge only while there is more of the list that way.
const SIDEBAR_SCROLL =
  "scroll-fade [scrollbar-width:auto]! [&::-webkit-scrollbar]:block! [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-border";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.values.sidebar_variant,
      sidebarCollapsible: s.values.sidebar_collapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href="/dashboard/default">
                <Command />
                <span className="font-semibold text-base">{APP_CONFIG.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      {/* F159: the helpdesk items make the list taller than the screen, so the support card scrolls at the end of the
          list instead of sitting in the footer over the last items. No grey browser scrollbar with arrow buttons: a
          thin rounded thumb (like the Studio ScrollArea thumb) shows only while the pointer is over the list, and the
          list fades out at its bottom edge instead of an item showing half-cut above the user footer. */}
      <SidebarContent className={SIDEBAR_SCROLL}>
        <NavMain items={sidebarItems} />
        <div className="mt-auto p-2">
          <SupportCard />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={rootUser} />
      </SidebarFooter>
    </Sidebar>
  );
}

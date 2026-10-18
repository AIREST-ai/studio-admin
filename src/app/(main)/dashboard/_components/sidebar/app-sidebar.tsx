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
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { rootUser } from "@/data/users";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { useRailShown } from "./rail-state";

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
  const { isMobile } = useSidebar();
  // T-73: Fahad: the sidebar is icons only, names on hover. On desktop it is always the collapsed icon rail whatever the
  // collapsible preference (rail-state.tsx keeps it collapsed). Phones keep the drawer, with names, since there is no
  // hover there.
  // T-89: the header button hides the rail (off canvas) and shows it again.
  const railShown = useRailShown();
  const desktopCollapsible = railShown ? "icon" : "offcanvas";

  // T-89: the rail's name tooltips wait a moment and close as soon as the pointer leaves their icon (not hoverable): the
  // logo's opened on the way to the header's sidebar button, over it, and took the click meant for it.
  return (
    <TooltipProvider delayDuration={300} disableHoverableContent>
      <Sidebar {...props} variant={variant} collapsible={isMobile ? collapsible : desktopCollapsible}>
        <SidebarHeader>
          <SidebarMenu>
            {/* T-146 (item 48): the mark is the home button. Fahad 00:45 «هذه هي زر رئيسية الرئيسية», and his decision
                01:23:54 («موافق نعم عليها»): the logo opens the home page and the duplicate «Summary» entry goes, leaving
                one way in. That entry lives in sidebar-items.ts (T-142's file) and is removed there, not here. This
                replaces T-105, where the mark was not a link because it repeated the entry below it. */}
            <SidebarMenuItem>
              {/* Its name shows below it, not to its right, where the rail's edge button now sits (layout.tsx). */}
              <SidebarMenuButton
                asChild
                tooltip={isMobile ? undefined : { children: "Home", side: "bottom" }}
                className="font-semibold text-base"
              >
                <Link href="/dashboard/default" aria-label="Home">
                  <Command aria-hidden="true" />
                  <span>{APP_CONFIG.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className={SIDEBAR_SCROLL}>
          <NavMain items={sidebarItems} />
        </SidebarContent>
        {/* T-58: Settings and Help Center stay at the bottom above the account menu, outside the scrolling list.
            T-117: the site search went back to the header (Fahad 20:41), it is no longer here. */}
        <SidebarFooter>
          <NavMain items={sidebarItems} placement="footer" />
          <NavUser user={rootUser} />
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}

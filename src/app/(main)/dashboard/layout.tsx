import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { cn } from "cn";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { RAIL_COOKIE } from "@/app/(main)/dashboard/_components/sidebar/rail-cookie";
import { RailSidebarProvider, RailTrigger } from "@/app/(main)/dashboard/_components/sidebar/rail-state";
import { HeaderInbox } from "@/app/(main)/dashboard/notifications/_components/header-inbox";
import { SidebarInset } from "@/components/ui/sidebar";
import { users } from "@/data/users";
import { readLinkState } from "@/lib/chatwoot/mode";
import { parseViewAs, VIEW_AS_COOKIE } from "@/lib/cw/view-as-cookie";
import { getPreference } from "@/server/server-actions";

import { ChatwootLinkBadge } from "./_components/chatwoot-link/link-badge";
import { ChatwootLinkProvider } from "./_components/chatwoot-link/link-context";
import { AccountSwitcher } from "./_components/header/account-switcher";
import { LayoutControls } from "./_components/header/layout-controls";
import { SearchDialog } from "./_components/header/search-dialog";
import { ThemeSwitcher } from "./_components/header/theme-switcher";
import { ViewAsBanner, ViewAsGuard, ViewAsProvider } from "./_components/view-as";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  // T-89: the desktop rail is shown unless its button hid it (rail-state.tsx).
  const railShown = cookieStore.get(RAIL_COOKIE)?.value !== "false";
  // F-5A: "View as" (account menu): the agent this browser views the app as, rendered so from the first byte.
  const viewAsId = parseViewAs(cookieStore.get(VIEW_AS_COOKIE)?.value);
  // L-2 (Chatwoot link phase 1): the "Preview" / "Linked" switch, read from its file on the server (no call to
  // Chatwoot), so a linked section renders linked from the first byte and preview renders exactly as before.
  const [variant, collapsible, chatwootLink] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
    readLinkState(),
  ]);

  return (
    <ChatwootLinkProvider initial={chatwootLink}>
      <ViewAsProvider viewAsId={viewAsId}>
        <RailSidebarProvider
          defaultShown={railShown}
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 68)",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant={variant} collapsible={collapsible} />
          <SidebarInset
            className={cn(
              "[html[data-content-layout=centered]_&>*]:mx-auto",
              "[html[data-content-layout=centered]_&>*]:w-full",
              "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
              "peer-data-[variant=inset]:border",
              "[--dashboard-header-height:--spacing(12)]",
              "min-w-0 overflow-x-clip",
              // T-146: with the rail hidden, the edge button (below) sits over the header's start; the search moves past it.
              "md:peer-data-[collapsible=offcanvas]:[&>header>div]:pl-10",
            )}
          >
            <header
              className={cn(
                "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
                // Handle sticky navbar style with conditional classes so blur, background, z-index, and rounded corners remain consistent across all SidebarVariant layouts.
                "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2 px-4 lg:px-6">
                {/* T-146 (item 51, Fahad 00:45 «حتى موقع البحث يبدو انه ذهب إلى الاتجاه الخاطئ»): the site search moved to the
                start of the header, where Chatwoot keeps its search (top of the sidebar) and Facebook keeps its own.
                Phones keep the drawer button before it (Chatwoot's #mobile-sidebar-launcher); on desktop the rail's
                button sits on the rail's edge (below). */}
                <div className="flex min-w-0 items-center gap-1 lg:gap-2">
                  <RailTrigger className="-ml-1 md:hidden" />
                  <SearchDialog />
                </div>
                {/* T-146 (item 51, «يفضل … بجنب البروفايل صورة البروفايل»): Messages and Notifications sit right beside the
                profile picture at the far end, as in Facebook's header (Fahad's own reference, item 16). The icons are
                not filled: they take the text colour, black on the light theme and white on the dark one («في الأبيض …
                تكون سوداء والعكس»). The Messages and bell buttons come from header-inbox.tsx (T-132/T-140), untouched;
                their look is set here, for the whole row. */}
                <div
                  data-header-actions
                  className="flex shrink-0 items-center gap-1 [&_button[data-variant=default]]:bg-transparent [&_button[data-variant=default]]:text-foreground [&_button[data-variant=default]]:hover:bg-muted [&_button[data-variant=default]]:aria-expanded:bg-muted"
                >
                  {/* L-2: "Linked: Chatwoot test copy", only while a section is linked (nothing in preview mode). */}
                  <ChatwootLinkBadge />
                  <LayoutControls />
                  <ThemeSwitcher />
                  <HeaderInbox />
                  <AccountSwitcher users={users} />
                </div>
              </div>
            </header>
            {/* F-5A: the honest mark while viewing as another agent (no sign-in in the preview). */}
            <ViewAsBanner />
            {/* F151: in embedded mode the header is hidden, so the layout settings panel stays reachable here (bottom-right). */}
            {/* T-146: the gear is unfilled now; here it floats over the page, so it keeps a background of its own. */}
            <div
              data-embed-only
              className="fixed right-3 bottom-3 z-50 hidden rounded-lg border bg-background shadow-sm"
            >
              <LayoutControls />
            </div>
            {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
              <ViewAsGuard>{children}</ViewAsGuard>
            </div>
          </SidebarInset>
          {/* T-146 (item 49, Fahad 00:45 «يجب أن تلتسق بالشريط الجانبي»): the desktop rail's hide/show button sits on the
          rail's own edge, as Chatwoot v4.18 keeps its sidebar collapse handle on the sidebar's edge (Sidebar.vue) and
          respond.io keeps its collapse button on the panel it folds, not in the page header. Same button, same job and
          ⌘B (rail-state.tsx); the 48px icon rail keeps its width. Hidden rail: the button waits at the screen's edge
          to bring it back, and the header's search moves past it. It shares the sticky header's z-50 and comes after it,
          so it shows above it, while dialogs and menus (portalled later) still cover it. */}
          <RailTrigger
            className={cn(
              "fixed top-3 z-50 hidden size-6 rounded-full border bg-background text-foreground shadow-sm hover:bg-muted md:inline-flex [&_svg]:size-3.5",
              "left-[calc(var(--sidebar-width-icon)-0.75rem)] transition-[left] duration-200 ease-linear",
              "peer-data-[variant=floating]:left-[calc(var(--sidebar-width-icon)+0.25rem)] peer-data-[variant=inset]:left-[calc(var(--sidebar-width-icon)+0.25rem)]",
              "peer-data-[collapsible=offcanvas]:left-1",
            )}
          />
        </RailSidebarProvider>
      </ViewAsProvider>
    </ChatwootLinkProvider>
  );
}

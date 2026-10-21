"use client";

import { type ComponentProps, createContext, useCallback, useContext, useEffect, useState } from "react";

import { cn } from "cn";

import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { RAIL_COOKIE } from "./rail-cookie";

// T-89: whether the desktop icon rail is shown, kept for later visits like the sidebar's own cookie.
const RAIL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const RailContext = createContext(true);

export function useRailShown() {
  return useContext(RailContext);
}

// T-89: the desktop sidebar is always the 3rem icon rail (T-73, Fahad: icons only), so the sidebar stays "collapsed"
// (open={false}) and never widens to show names. Its toggle (the header button, Ctrl+B) asks to open it; here that
// request shows or hides the rail instead. T-73 forced the rail shut on every open, which undid the toggle at once.
// Phones keep the drawer (openMobile), untouched.
export function RailSidebarProvider({
  defaultShown,
  children,
  ...props
}: Omit<ComponentProps<typeof SidebarProvider>, "open" | "onOpenChange" | "defaultOpen"> & { defaultShown: boolean }) {
  const [shown, setShown] = useState(defaultShown);
  const toggle = useCallback(() => setShown((value) => !value), []);

  useEffect(() => {
    document.cookie = `${RAIL_COOKIE}=${shown}; path=/; max-age=${RAIL_COOKIE_MAX_AGE}`;
  }, [shown]);

  return (
    <RailContext.Provider value={shown}>
      {/* The fixed icon rail stays on the left; reserve its space on that same side in RTL. */}
      <SidebarProvider
        {...props}
        className={cn("rtl:flex-row-reverse", props.className)}
        open={false}
        onOpenChange={toggle}
      >
        {children}
      </SidebarProvider>
    </RailContext.Provider>
  );
}

// T-89: the header button: hides or shows the rail on desktop, opens the drawer on phones. Its name and state are
// read out, and the tooltip says what a click does.
export function RailTrigger({ className }: { className?: string }) {
  const shown = useRailShown();
  const { isMobile, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : shown;
  const label = expanded ? "Hide sidebar" : "Show sidebar";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger className={className} aria-label={label} aria-expanded={expanded} />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label} (⌘B)</TooltipContent>
    </Tooltip>
  );
}

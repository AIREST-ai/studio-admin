"use client";

// T-141 (Fahad item 59): «مسار العميل» «ايضا من ضمن الفلتره والدخول لها هنا يستوحى من ريسبوند». respond.io filters the
// Inbox's conversations by Lifecycle stage; here the Inbox bar lists the stages as path steps with their number of
// conversations, and a click narrows the open list (folder, team, channel or view, with its status and the channel
// picker) to that stage; a second click or the × clears it. Many stages scroll inside the list. The advanced filter
// (Chatwoot filter rows) also has «مسار العميل» (cw-data "customer_path"), for saved folders.
// T-285 (Fahad 124.5/124.8): named Customer Path in the UI, each stage marked by its icon (customer-path.tsx StageStep).
// T-289 (Fahad 128.3): folded until the person opens it, and kept as they left it, like the bar's other sections.
import { useEffect, useMemo } from "react";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "cn";
import { ChevronRight, Route, X } from "lucide-react";

import { useInboxSectionOpen } from "@/app/(main)/dashboard/_components/sidebar/inbox-bar-folds";
import { baseConversations } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import {
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  type PathStage,
  pathKeyOf,
  setStageFilter,
  useCustomerPath,
  useHydrateCustomerPath,
  useStageFilter,
} from "@/lib/cw/customer-path";

import { CUSTOMER_PATH, StageStep } from "./customer-path";

/** The Inbox bar's «مسار العميل» list (see the top of this file). */
export function CustomerPathInboxGroup() {
  useHydrateCustomerPath();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useInboxSectionOpen("customer-path");
  const stages = useCustomerPath((s) => s.stages);
  const assigned = useCustomerPath((s) => s.assigned);
  const deleted = useCwStore((s) => s.deleted);
  const activeId = useStageFilter();
  const active = stages.find((stage) => stage.id === activeId);

  // A stage deleted in Settings (here or in another browser) stops narrowing the list.
  useEffect(() => {
    if (activeId && !active) setStageFilter(null);
  }, [activeId, active]);

  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const conversation of baseConversations) {
      if (deleted.includes(conversation.id)) continue;
      const id = assigned[pathKeyOf(conversation.id)];
      if (id) out.set(id, (out.get(id) ?? 0) + 1);
    }
    return out;
  }, [assigned, deleted]);

  // The open list (a folder, team, channel or view) stays and is narrowed; from any other page, All Conversations.
  const show = (stage: PathStage) => {
    setStageFilter(stage.id === activeId ? null : stage.id);
    const onList = pathname.startsWith("/dashboard/chat") && !pathname.startsWith("/dashboard/chat/search");
    if (!onList) router.push("/dashboard/chat");
  };

  return (
    <SidebarMenuItem data-slot="customer-path-inbox-group">
      <SidebarMenuButton aria-expanded={open} className={active ? "pe-8" : undefined} onClick={() => setOpen(!open)}>
        <Route />
        <span>{CUSTOMER_PATH}</span>
        <ChevronRight className={cn("ms-auto transition-transform", open && "rotate-90")} />
      </SidebarMenuButton>
      {active && (
        <SidebarMenuAction
          aria-label={`Clear stage filter (${active.name})`}
          title={`Clear stage filter (${active.name})`}
          onClick={() => setStageFilter(null)}
        >
          <X />
        </SidebarMenuAction>
      )}
      {open && (
        <SidebarMenuSub className="max-h-56 overflow-y-auto [scrollbar-width:thin]">
          {stages.map((stage, index) => (
            <SidebarMenuSubItem key={stage.id} className="relative">
              <SidebarMenuSubButton asChild isActive={activeId === stage.id}>
                <button
                  type="button"
                  data-stage={stage.name}
                  aria-pressed={activeId === stage.id}
                  title={activeId === stage.id ? `Show every stage` : `Only ${stage.name} in this list`}
                  className="w-full pe-8"
                  onClick={() => show(stage)}
                >
                  <StageStep stage={stage} index={index} />
                  <span dir="auto">{stage.name}</span>
                </button>
              </SidebarMenuSubButton>
              <SidebarMenuBadge className="top-1 right-1">{counts.get(stage.id) ?? 0}</SidebarMenuBadge>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

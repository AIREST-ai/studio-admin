"use client";
import * as React from "react";

import { CalendarDays, CheckSquare, Sun } from "lucide-react";

import { Calendar } from "@/app/(main)/dashboard/calendar/_components/calendar";
import { PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { TwentyBoard } from "@/app/(main)/dashboard/tasks/_twenty/twenty-board";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { TodayAgenda } from "./today-agenda";

export type PlannerView = "today" | "calendar" | "tasks";
const VIEWS: PlannerView[] = ["today", "calendar", "tasks"];

// FAH-20: the open view is kept in the address (?view=), next to the calendar's ?hide= and the board's ?section=, which
// those pages already write with replaceState, so a reload or a shared link opens the same view.
function viewFromAddress(): PlannerView {
  if (typeof window === "undefined") return "today";
  const view = new URL(window.location.href).searchParams.get("view");
  return VIEWS.includes(view as PlannerView) ? (view as PlannerView) : "today";
}

export function Planner() {
  const [view, setView] = React.useState<PlannerView | null>(null);
  // Wait for the address before mounting data sources or formatting local dates.
  React.useEffect(() => {
    const syncView = () => setView(viewFromAddress());
    syncView();
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  const open = React.useCallback((next: PlannerView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "today") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return (
    <div dir="rtl" className="flex min-w-0 flex-col gap-4">
      <PageHeading title="المخطط" subtitle="مهامك ومواعيدك في مكان واحد." />
      {view === null ? (
        <div role="status" aria-label="جارٍ تحميل المخطط">
          <Skeleton className="h-32" />
        </div>
      ) : (
        <Tabs dir="rtl" value={view} onValueChange={(next) => open(next as PlannerView)} className="min-w-0 gap-4">
          <TabsList aria-label="عرض المخطط" className="w-fit max-w-full">
            <TabsTrigger value="today">
              <Sun /> اليوم
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays /> التقويم
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <CheckSquare /> المهام
            </TabsTrigger>
          </TabsList>
          {/* each view loads its data only while it is open */}
          <TabsContent value="today">{view === "today" && <TodayAgenda onOpen={open} />}</TabsContent>
          <TabsContent value="calendar">{view === "calendar" && <Calendar />}</TabsContent>
          <TabsContent value="tasks" data-content-padding="false">
            {view === "tasks" && <TwentyBoard />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

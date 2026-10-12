"use client";
// F159: one period state per report page, as Chatwoot v4.18 ReportFilters.vue + components/ui/DatePicker:
// date range (Last 7 days ... Custom date range), Previous/Next period for "This week" and "This month",
// Group By (only when the range is 29 days or more), Business Hours. The charts, the KPI cards and the drilldown
// read it, so changing the range redraws everything.
import * as React from "react";

import {
  addMonths,
  addWeeks,
  differenceInDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isValid,
  min as minDate,
  parse,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type GroupBy = "Day" | "Week" | "Month" | "Year";
export type RangeType =
  | "last7days"
  | "last30days"
  | "last3months"
  | "last6months"
  | "lastYear"
  | "thisWeek"
  | "monthToDate"
  | "custom";

// The sample data ends today (Oct 12, 2026), the same day as the inbox conversations.
export const TODAY = new Date(2026, 9, 12);

// DatePickerHelper.js dateRanges (separator = a line above the item).
export const rangeItems: { value: RangeType; label: string; separator?: boolean }[] = [
  { value: "last7days", label: "Last 7 days" },
  { value: "last30days", label: "Last 30 days" },
  { value: "last3months", label: "Last 3 months", separator: true },
  { value: "last6months", label: "Last 6 months" },
  { value: "lastYear", label: "Last year" },
  { value: "thisWeek", label: "This week", separator: true },
  { value: "monthToDate", label: "This month" },
  { value: "custom", label: "Custom date range", separator: true },
];

export interface Bucket {
  label: string;
  long: string;
  start: Date;
  days: number;
}

export interface PeriodState {
  rangeType: RangeType;
  from: Date;
  to: Date;
  offset: number;
  group: GroupBy;
  groupOptions: GroupBy[];
  businessHours: boolean;
  buckets: Bucket[];
  label: string;
  // The period of the same length just before (what the change % compares with).
  previousLabel: string;
  salt: number;
  apply:(type: RangeType, from: Date, to: Date) => void;
  navigate: (step: -1 | 1) => void;
  setGroup: (group: GroupBy) => void;
  setBusinessHours: (on: boolean) => void;
}

export function presetDates(type: RangeType, offset = 0): { from: Date; to: Date } {
  const to = TODAY;
  switch (type) {
    case "last30days":
      return { from: subDays(to, 29), to };
    case "last3months":
      return { from: subDays(to, 89), to };
    case "last6months":
      return { from: subDays(to, 179), to };
    case "lastYear":
      return { from: subDays(to, 364), to };
    case "thisWeek": {
      const start = startOfWeek(addWeeks(to, offset), { weekStartsOn: 1 });
      return { from: start, to: minDate([endOfWeek(start, { weekStartsOn: 1 }), to]) };
    }
    case "monthToDate": {
      const start = startOfMonth(addMonths(to, offset));
      return { from: start, to: minDate([endOfMonth(start), to]) };
    }
    default:
      return { from: subDays(to, 6), to };
  }
}

// ReportFilters.vue fetchFilterItems / isGroupByPossible.
export function groupOptionsFor(from: Date, to: Date): GroupBy[] {
  const days = differenceInDays(to, from);
  if (days < 29) return [];
  if (days >= 364) return ["Week", "Month", "Year"];
  if (days >= 90) return ["Day", "Week", "Month"];
  return ["Day", "Week"];
}

export function makeBuckets(from: Date, to: Date, group: GroupBy): Bucket[] {
  const interval = { start: from, end: to };
  // Days of a bucket that fall inside the range (the first and last week or month can be partial).
  const span = (start: Date, end: Date) => {
    const s = start < from ? from : start;
    const e = end > to ? to : end;
    return { start: s, days: Math.max(1, differenceInDays(e, s) + 1) };
  };
  if (group === "Week") {
    return eachWeekOfInterval(interval, { weekStartsOn: 1 }).map((d) => {
      const b = span(d, endOfWeek(d, { weekStartsOn: 1 }));
      return { label: format(b.start, "MMM d"), long: `Week of ${format(b.start, "MMM d, yyyy")}`, ...b };
    });
  }
  if (group === "Month") {
    return eachMonthOfInterval(interval).map((d) => ({
      label: format(d, "MMM yyyy"),
      long: format(d, "MMMM yyyy"),
      ...span(d, endOfMonth(d)),
    }));
  }
  if (group === "Year") {
    return eachYearOfInterval(interval).map((d) => ({
      label: format(d, "yyyy"),
      long: format(d, "yyyy"),
      ...span(d, new Date(d.getFullYear(), 11, 31)),
    }));
  }
  return eachDayOfInterval(interval).map((d) => ({
    label: format(d, "MMM d"),
    long: format(d, "EEE, MMM d, yyyy"),
    start: d,
    days: 1,
  }));
}

function buildState(
  rangeType: RangeType,
  from: Date,
  to: Date,
  offset: number,
  groupRaw: GroupBy,
  businessHours: boolean,
  showGroupBy: boolean,
) {
  const groupOptions = showGroupBy ? groupOptionsFor(from, to) : [];
  const group = groupOptions.includes(groupRaw) ? groupRaw : (groupOptions[0] ?? "Day");
  const buckets = makeBuckets(from, to, group);
  const label = `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`;
  const length = differenceInDays(to, from) + 1;
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(from, length);
  const previousLabel = `${format(prevFrom, "MMM d, yyyy")} - ${format(prevTo, "MMM d, yyyy")}`;
  let salt = 0;
  for (const ch of `${label}${group}${businessHours}`) salt = (salt * 31 + ch.charCodeAt(0)) % 100003;
  if (rangeType === "last7days" && !businessHours) salt = 0;
  return { groupOptions, group, buckets, label, previousLabel, salt };
}

const PeriodContext = React.createContext<PeriodState | null>(null);

export function ReportPeriodProvider({
  children,
  showGroupBy = true,
}: {
  children: React.ReactNode;
  showGroupBy?: boolean;
}) {
  const [rangeType, setRangeType] = React.useState<RangeType>("last7days");
  const [dates, setDates] = React.useState(() => presetDates("last7days"));
  const [offset, setOffset] = React.useState(0);
  const [groupRaw, setGroup] = React.useState<GroupBy>("Day");
  const [businessHours, setBusinessHours] = React.useState(false);

  const derived = buildState(rangeType, dates.from, dates.to, offset, groupRaw, businessHours, showGroupBy);

  const value: PeriodState = {
    rangeType,
    from: dates.from,
    to: dates.to,
    offset,
    businessHours,
    ...derived,
    apply: (type, from, to) => {
      setRangeType(type);
      setOffset(0);
      setDates(type === "custom" ? { from, to } : presetDates(type));
    },
    navigate: (step) => {
      const next = Math.min(0, offset + step);
      setOffset(next);
      setDates(presetDates(rangeType, next));
    },
    setGroup,
    setBusinessHours,
  };
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

const fallbackDates = presetDates("last7days");
const fallback: PeriodState = {
  rangeType: "last7days",
  ...fallbackDates,
  offset: 0,
  businessHours: false,
  ...buildState("last7days", fallbackDates.from, fallbackDates.to, 0, "Day", false, true),
  apply: () => undefined,
  navigate: () => undefined,
  setGroup: () => undefined,
  setBusinessHours: () => undefined,
};

export function usePeriod(): PeriodState {
  return React.useContext(PeriodContext) ?? fallback;
}

function navigationLabel(p: PeriodState) {
  if (p.rangeType === "monthToDate") return format(p.from, "MMMM");
  if (p.rangeType === "thisWeek") return `Week #${getISOWeek(p.from)}`;
  return rangeItems.find((r) => r.value === p.rangeType)?.label ?? "";
}

function DateInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: Date | undefined;
  disabled: boolean;
  onCommit: (d: Date) => void;
}) {
  const [text, setText] = React.useState(value ? format(value, "dd/MM/yyyy") : "");
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    setText(value ? format(value, "dd/MM/yyyy") : "");
    setError(false);
  }, [value]);
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input
        value={text}
        disabled={disabled}
        aria-invalid={error}
        placeholder="dd/mm/yyyy"
        className="h-8"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const d = parse(text, "dd/MM/yyyy", TODAY);
          if (isValid(d) && d <= TODAY) onCommit(d);
          else setError(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

// WootDatePicker: one button (range name + dates), Previous/Next period for This week / This month, and a panel
// with the DATE RANGE list, Start Date / End Date inputs, two months, Clear and Apply.
export function ReportDatePicker() {
  const p = usePeriod();
  const [open, setOpen] = React.useState(false);
  const [draftType, setDraftType] = React.useState<RangeType>(p.rangeType);
  const [draft, setDraft] = React.useState<DateRange | undefined>({ from: p.from, to: p.to });
  const navigable = p.rangeType === "thisWeek" || p.rangeType === "monthToDate";

  const reset = () => {
    setDraftType(p.rangeType);
    setDraft({ from: p.from, to: p.to });
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) reset();
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 font-normal">
            <CalendarRange className="text-muted-foreground" />
            <span className="font-medium">{navigationLabel(p)}</span>
            <span className="text-muted-foreground">{p.label}</span>
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto max-w-[calc(100vw-2rem)] flex-col p-0 md:flex-row">
          <div className="flex shrink-0 flex-col gap-0.5 border-b p-2 md:w-44 md:border-r md:border-b-0">
            <span className="px-2 py-1.5 font-medium text-[11px] text-muted-foreground tracking-wide">DATE RANGE</span>
            {rangeItems.map((r) => (
              <React.Fragment key={r.value}>
                {r.separator ? <div className="my-1 border-t" /> : null}
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    draftType === r.value && "bg-muted font-medium",
                  )}
                  onClick={() => {
                    setDraftType(r.value);
                    if (r.value !== "custom") {
                      const d = presetDates(r.value);
                      setDraft({ from: d.from, to: d.to });
                    }
                  }}
                >
                  {r.label}
                </button>
              </React.Fragment>
            ))}
          </div>
          <div className="flex flex-col">
            <div className="flex gap-3 border-b p-3">
              <DateInput
                label="Start Date"
                value={draft?.from}
                disabled={draftType !== "custom"}
                onCommit={(d) => setDraft((x) => ({ from: d, to: x?.to && x.to >= d ? x.to : d }))}
              />
              <DateInput
                label="End Date"
                value={draft?.to}
                disabled={draftType !== "custom"}
                onCommit={(d) => setDraft((x) => ({ from: x?.from && x.from <= d ? x.from : d, to: d }))}
              />
            </div>
            <Calendar
              mode="range"
              defaultMonth={addMonths(draft?.to ?? TODAY, -1)}
              selected={draft}
              onSelect={(r) => {
                setDraftType("custom");
                setDraft(r);
              }}
              numberOfMonths={2}
              disabled={{ after: TODAY }}
            />
            <div className="flex items-center justify-end gap-2 border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraftType("last7days");
                  const d = presetDates("last7days");
                  setDraft({ from: d.from, to: d.to });
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                disabled={!draft?.from}
                onClick={() => {
                  if (!draft?.from) return;
                  p.apply(draftType, draft.from, draft.to ?? draft.from);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {navigable ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Previous period" onClick={() => p.navigate(-1)}>
                <ChevronLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous period</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next period"
                disabled={p.offset >= 0}
                onClick={() => p.navigate(1)}
              >
                <ChevronRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next period</TooltipContent>
          </Tooltip>
        </>
      ) : null}
    </div>
  );
}


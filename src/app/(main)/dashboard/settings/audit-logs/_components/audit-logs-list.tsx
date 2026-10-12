"use client";
import * as React from "react";

import { cn } from "cn";
import { ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, ListFilter, Search, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

import { CountTabs, PageHeader } from "../../labels/_shared/settings-shell";

const tones = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
];

const eventGroups = [
  { label: "Access", types: ["Sign in / sign out"] },
  { label: "Agents & teams", types: ["Agents", "Teams", "Team members", "Inbox collaborators"] },
  { label: "Configuration", types: ["Account settings", "Inboxes", "Webhooks", "Automation rules", "Macros"] },
  { label: "Conversations", types: ["Conversation deletions", "Message deletions"] },
];

interface Log {
  id: number;
  agent: string;
  text: string;
  type: string;
  time: string;
  location: string;
}

const logs: Log[] = [
  { id: 1, agent: "Arham Khan", text: "Arham Khan signed in", type: "Sign in / sign out", time: "Oct 12, 9:42 AM", location: "Doha, Qatar" },
  { id: 2, agent: "Priya Nair", text: "Priya Nair created a new automation rule (#38)", type: "Automation rules", time: "Oct 12, 9:15 AM", location: "Doha, Qatar" },
  { id: 3, agent: "Arham Khan", text: "Arham Khan invited Ravi Menon to the account as an agent", type: "Agents", time: "Oct 12, 8:58 AM", location: "Doha, Qatar" },
  { id: 4, agent: "Yousef Al-Harbi", text: "Yousef Al-Harbi updated a webhook (#4)", type: "Webhooks", time: "Oct 11, 6:21 PM", location: "Dubai, United Arab Emirates" },
  { id: 5, agent: "Lina Haddad", text: "Lina Haddad added Priya Nair to the team(#3)", type: "Team members", time: "Oct 11, 4:07 PM", location: "Riyadh, Saudi Arabia" },
  { id: 6, agent: "Priya Nair", text: "Priya Nair deleted conversation #2841", type: "Conversation deletions", time: "Oct 11, 2:33 PM", location: "Doha, Qatar" },
  { id: 7, agent: "Arham Khan", text: "Arham Khan updated the account configuration (#1)", type: "Account settings", time: "Oct 11, 11:10 AM", location: "Doha, Qatar" },
  { id: 8, agent: "Yousef Al-Harbi", text: "Yousef Al-Harbi created a new inbox (#12)", type: "Inboxes", time: "Oct 10, 5:45 PM", location: "Dubai, United Arab Emirates" },
  { id: 9, agent: "Lina Haddad", text: "Lina Haddad changed availability of Ravi Menon to busy", type: "Agents", time: "Oct 10, 3:12 PM", location: "Riyadh, Saudi Arabia" },
  { id: 10, agent: "Ravi Menon", text: "Ravi Menon signed out", type: "Sign in / sign out", time: "Oct 10, 1:02 PM", location: "Al Wakrah, Qatar" },
  { id: 11, agent: "Priya Nair", text: "Priya Nair updated a macro (#7)", type: "Macros", time: "Oct 10, 10:26 AM", location: "Doha, Qatar" },
  { id: 12, agent: "Arham Khan", text: "Arham Khan added Lina Haddad to the inbox(#5)", type: "Inbox collaborators", time: "Oct 9, 7:48 PM", location: "Doha, Qatar" },
  { id: 13, agent: "Yousef Al-Harbi", text: "Yousef Al-Harbi deleted a message in conversation #2790", type: "Message deletions", time: "Oct 9, 4:30 PM", location: "Abu Dhabi, United Arab Emirates" },
  { id: 14, agent: "Lina Haddad", text: "Lina Haddad created a new team (#4)", type: "Teams", time: "Oct 9, 9:05 AM", location: "Riyadh, Saudi Arabia" },
];

// Mock request details per event (Chatwoot shows remote_address and the geocoded location).
const ips = ["37.210.14.82", "37.210.88.5", "37.210.14.82", "94.200.31.117", "188.48.22.9", "37.210.88.5", "37.210.14.82", "94.200.31.117", "188.48.22.9", "89.211.4.63", "37.210.88.5", "37.210.14.82", "94.56.120.40", "188.48.22.9"];
const hoursAgo = [2, 3, 3, 18, 20, 22, 25, 42, 44, 46, 49, 62, 65, 72];
const emails: Record<string, string> = {
  "Arham Khan": "arham.khan@weblabs.studio",
  "Priya Nair": "priya.nair@weblabs.studio",
  "Yousef Al-Harbi": "yousef.harbi@weblabs.studio",
  "Lina Haddad": "lina.haddad@weblabs.studio",
  "Ravi Menon": "ravi.menon@weblabs.studio",
};

const agentIds = Array.from(new Set(logs.map((l) => l.agent)));
const groupOf = (type: string) => eventGroups.find((g) => g.types.includes(type))?.label ?? "Other";
const tabs = [{ value: "all", label: "All events" }, ...eventGroups.map((g) => ({ value: g.label, label: g.label }))];
const PAGE_SIZE = 8;

export function AuditLogsList() {
  const [query, setQuery] = React.useState("");
  const [types, setTypes] = React.useState<string[]>([]);
  const [since, setSince] = React.useState("all");
  const [sort, setSort] = React.useState("newest");
  const [page, setPage] = React.useState(0);
  const [tab, setTab] = React.useState("all");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const ranges: Record<string, number> = { all: Infinity, "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
    const maxHours = ranges[since] ?? Infinity;
    let list = logs.filter((l) =>
      q ? `${l.agent} ${emails[l.agent] ?? ""} ${l.text}`.toLowerCase().includes(q) : true,
    );
    if (tab !== "all") list = list.filter((l) => groupOf(l.type) === tab);
    if (types.length) list = list.filter((l) => types.includes(l.type));
    list = list.filter((l) => hoursAgo[l.id - 1] <= maxHours);
    return sort === "oldest" ? [...list].reverse() : list;
  }, [query, types, sort, since, tab]);

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const hasFilters = Boolean(query || types.length || since !== "all" || sort !== "newest" || tab !== "all");
  const sinceLabels: Record<string, string> = {
    all: "Date range",
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
  };
  const sinceLabel = sinceLabels[since];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Audit Logs"
        description="Audit Logs maintain a record of activities in your account, allowing you to track and audit your account, team, or services."
        learnMore="Learn more about audit logs"
      />
      <CountTabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(0);
        }}
        items={tabs.map((t) => ({
          value: t.value,
          label: t.label,
          count: t.value === "all" ? logs.length : logs.filter((l) => groupOf(l.type) === t.value).length,
        }))}
      />

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b pb-4 has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Manage Audit Logs</CardTitle>
          <CardDescription className="max-w-md leading-snug">
            Audit Logs are trails for events and actions in your account.
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto self-center md:col-start-2 md:row-span-2 md:row-start-1">
            <span className="text-muted-foreground text-sm tabular-nums">
              {rows.length} {rows.length === 1 ? "event" : "events"}
            </span>
          </CardAction>
        </CardHeader>
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <InputGroup className="h-8 w-full md:w-72">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </InputGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ListFilter /> {types.length ? `${types.length} selected` : "All events"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 w-60 overflow-y-auto">
              {eventGroups.map((group, i) => (
                <React.Fragment key={group.label}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                  {group.types.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={types.includes(type)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) =>
                        setTypes((prev) => (checked ? [...prev, type] : prev.filter((t) => t !== type)))
                      }
                    >
                      {type}
                    </DropdownMenuCheckboxItem>
                  ))}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays /> {sinceLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuRadioGroup value={since} onValueChange={(v) => {
                  setSince(v);
                  setPage(0);
                }}>
                <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="24h">Last 24 hours</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowDownUp /> {sort === "newest" ? "Newest first" : "Oldest first"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setTypes([]);
                setSince("all");
                setSort("newest");
                setTab("all");
              }}
            >
              <X /> Clear filters
            </Button>
          )}
        </div>
        <CardContent className="px-0">
          <Table className="**:data-[slot='table-cell']:px-5 **:data-[slot='table-head']:px-5">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Activity</TableHead>
                <TableHead className="w-44 py-3 font-normal">Time</TableHead>
                <TableHead className="w-36 py-3 font-normal">IP address</TableHead>
                <TableHead className="w-64 py-3 font-normal">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? (
                pageRows.map((log) => (
                  <TableRow key={log.id} className="border-border/60">
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-7">
                          <AvatarFallback
                            className={cn("font-medium text-[11px]", tones[agentIds.indexOf(log.agent) % tones.length])}
                          >
                            {getInitials(log.agent)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{log.text}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-muted-foreground tabular-nums">{log.time}</TableCell>
                    <TableCell className="py-3.5 font-mono text-muted-foreground text-xs">{ips[log.id - 1]}</TableCell>
                    <TableCell className="py-3.5 text-muted-foreground">{log.location}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    There are no items matching this query
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-muted-foreground text-sm tabular-nums">
              Showing {rows.length ? current * PAGE_SIZE + 1 : 0} - {current * PAGE_SIZE + pageRows.length} of{" "}
              {rows.length} events
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="text-sm tabular-nums">
                {current + 1} <span className="text-muted-foreground">of</span> {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

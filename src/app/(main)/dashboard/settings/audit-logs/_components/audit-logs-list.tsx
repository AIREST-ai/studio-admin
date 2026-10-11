"use client";
import * as React from "react";

import { cn } from "cn";
import { ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, ListFilter, Search, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  { id: 1, agent: "Fahad Al-Kuwari", text: "Fahad Al-Kuwari signed in", type: "Sign in / sign out", time: "Oct 12, 9:42 AM", location: "Doha, Qatar" },
  { id: 2, agent: "Mariam Al-Sulaiti", text: "Mariam Al-Sulaiti created a new automation rule (#38)", type: "Automation rules", time: "Oct 12, 9:15 AM", location: "Doha, Qatar" },
  { id: 3, agent: "Fahad Al-Kuwari", text: "Fahad Al-Kuwari invited Omar Haddad to the account as an agent", type: "Agents", time: "Oct 12, 8:58 AM", location: "Doha, Qatar" },
  { id: 4, agent: "Khalid Al-Mansoori", text: "Khalid Al-Mansoori updated a webhook (#4)", type: "Webhooks", time: "Oct 11, 6:21 PM", location: "Dubai, United Arab Emirates" },
  { id: 5, agent: "Reem Al-Otaibi", text: "Reem Al-Otaibi added Sara Nasser to the team(#3)", type: "Team members", time: "Oct 11, 4:07 PM", location: "Riyadh, Saudi Arabia" },
  { id: 6, agent: "Mariam Al-Sulaiti", text: "Mariam Al-Sulaiti deleted conversation #2841", type: "Conversation deletions", time: "Oct 11, 2:33 PM", location: "Doha, Qatar" },
  { id: 7, agent: "Fahad Al-Kuwari", text: "Fahad Al-Kuwari updated the account configuration (#1)", type: "Account settings", time: "Oct 11, 11:10 AM", location: "Doha, Qatar" },
  { id: 8, agent: "Khalid Al-Mansoori", text: "Khalid Al-Mansoori created a new inbox (#12)", type: "Inboxes", time: "Oct 10, 5:45 PM", location: "Dubai, United Arab Emirates" },
  { id: 9, agent: "Reem Al-Otaibi", text: "Reem Al-Otaibi changed availability of Omar Haddad to busy", type: "Agents", time: "Oct 10, 3:12 PM", location: "Riyadh, Saudi Arabia" },
  { id: 10, agent: "Omar Haddad", text: "Omar Haddad signed out", type: "Sign in / sign out", time: "Oct 10, 1:02 PM", location: "Al Wakrah, Qatar" },
  { id: 11, agent: "Mariam Al-Sulaiti", text: "Mariam Al-Sulaiti updated a macro (#7)", type: "Macros", time: "Oct 10, 10:26 AM", location: "Doha, Qatar" },
  { id: 12, agent: "Fahad Al-Kuwari", text: "Fahad Al-Kuwari added Reem Al-Otaibi to the inbox(#5)", type: "Inbox collaborators", time: "Oct 9, 7:48 PM", location: "Doha, Qatar" },
  { id: 13, agent: "Khalid Al-Mansoori", text: "Khalid Al-Mansoori deleted a message in conversation #2790", type: "Message deletions", time: "Oct 9, 4:30 PM", location: "Abu Dhabi, United Arab Emirates" },
  { id: 14, agent: "Reem Al-Otaibi", text: "Reem Al-Otaibi created a new team (#4)", type: "Teams", time: "Oct 9, 9:05 AM", location: "Riyadh, Saudi Arabia" },
];

const agentIds = Array.from(new Set(logs.map((l) => l.agent)));
const PAGE_SIZE = 8;

export function AuditLogsList() {
  const [query, setQuery] = React.useState("");
  const [types, setTypes] = React.useState<string[]>([]);
  const [since, setSince] = React.useState("all");
  const [sort, setSort] = React.useState("newest");
  const [page, setPage] = React.useState(0);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = logs.filter((l) => (q.length >= 3 ? l.text.toLowerCase().includes(q) : true));
    if (types.length) list = list.filter((l) => types.includes(l.type));
    return sort === "oldest" ? [...list].reverse() : list;
  }, [query, types, sort]);

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const hasFilters = Boolean(query || types.length || since !== "all" || sort !== "newest");
  const sinceLabel = { all: "Date range", "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days" }[since];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-2xl gap-1.5">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-xl">Audit Logs</h1>
          <Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">
            {rows.length} events
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Audit Logs maintain a record of activities in your account, allowing you to track and audit your account,
          team, or services.
        </p>
        <Button variant="link" size="sm" className="h-auto w-fit px-0">
          Learn more about audit logs <ExternalLink />
        </Button>
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
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
              <DropdownMenuRadioGroup value={since} onValueChange={setSince}>
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
                    <TableCell className="py-3.5 text-muted-foreground">{log.location}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
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

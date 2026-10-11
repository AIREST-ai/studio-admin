"use client";
import * as React from "react";

import { ListFilter, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { agents, dateRangeOptions, inboxes, labels, slaRows, teams } from "./data";
import { DownloadButton, ReportHeader, StatCard } from "./report-ui";

const policies = ["VIP patients – 15 min", "Standard – 1 hr", "Insurance claims – 4 hr"];

const filterGroups = [
  { key: "SLA Policy", options: policies },
  { key: "Agent", options: agents.map((a) => a.name) },
  { key: "Inbox", options: inboxes.map((i) => i.name) },
  { key: "Team", options: teams.map((t) => t.name) },
  { key: "Label", options: labels.map((l) => l.name) },
];

type Row = (typeof slaRows)[number];

export function SlaReport() {
  const [range, setRange] = React.useState("Last 7 days");
  const [filter, setFilter] = React.useState<{ key: string; value: string } | null>(null);
  const [details, setDetails] = React.useState<Row | null>(null);

  const rows = slaRows.filter((r) => {
    if (!filter) return true;
    if (filter.key === "SLA Policy") return r.policy === filter.value;
    if (filter.key === "Agent") return r.agent === filter.value;
    return true;
  });

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        <ReportHeader title="SLA Reports">
          <DownloadButton label="Download SLA reports" />
        </ReportHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger size="sm" className="w-44" aria-label="Duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filter ? (
            <Badge variant="secondary" className="h-7 gap-1 pr-1">
              {filter.key} <span className="text-muted-foreground">with</span> {filter.value}
              <button
                type="button"
                aria-label="Clear filter"
                className="rounded-sm p-0.5 hover:bg-background"
                onClick={() => setFilter(null)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ListFilter />
                Add filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {filterGroups.map((g) => (
                <DropdownMenuSub key={g.key}>
                  <DropdownMenuSubTrigger>{g.key}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {g.options.map((o) => (
                      <DropdownMenuItem key={o} onSelect={() => setFilter({ key: g.key, value: o })}>
                        {o}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {filter ? (
            <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>
              Clear all
            </Button>
          ) : null}
        </div>

        <Card className="py-0">
          <CardContent className="grid grid-cols-1 divide-y px-0 md:grid-cols-3 md:divide-x md:divide-y-0">
            <StatCard label="Hit Rate" value="81.6%" tooltip="Percentage of SLAs created were completed successfully" />
            <StatCard label="Number of Misses" value="23" tooltip="Total SLA misses in a certain period" />
            <StatCard label="Number of Conversations" value="125" tooltip="Total number of conversations with SLA" />
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Conversation</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="pr-5 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            <span className="text-primary">#{r.conversation}</span> · {r.contact}
                          </span>
                          <span className="text-muted-foreground text-xs">{r.subject}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{r.policy}</span>
                          {r.missed.length ? (
                            <Badge variant="destructive">Missed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">
                              Hit
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.agent ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarFallback className="text-[10px]">{getInitials(r.agent)}</AvatarFallback>
                            </Avatar>
                            {r.agent}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {r.missed.length ? (
                          <Button variant="ghost" size="sm" onClick={() => setDetails(r)}>
                            View Details
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      SLA applied conversations are not available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conversation #{details?.conversation}</DialogTitle>
              <DialogDescription>{details?.policy}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col divide-y rounded-lg border">
              {["First Response Time", "Next Response Time", "Resolution Time"].map((t) => {
                const missed = details?.missed.includes(t);
                return (
                  <div key={t} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{t}</span>
                    {missed ? (
                      <Badge variant="destructive">Missed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">
                        Hit
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetails(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

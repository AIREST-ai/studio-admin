"use client";
import * as React from "react";

import { cn } from "cn";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

import { type AgentStatus, agentLive, DAYS, heatmap, teamLive } from "./data";
import { ReportHeader } from "./report-ui";

const statusDot: Record<AgentStatus, string> = {
  online: "bg-emerald-500",
  busy: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

const statusLabel: Record<AgentStatus, string> = { online: "Online", busy: "Busy", offline: "Offline" };

function LiveBadge() {
  return (
    <Badge variant="outline" className="gap-1.5 text-emerald-700 dark:text-emerald-400">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </Badge>
  );
}

function OpenConversations() {
  const [team, setTeam] = React.useState("all");
  const stats = [
    { label: "Open", value: 40 },
    { label: "Unattended", value: 7 },
    { label: "Unassigned", value: 5 },
    { label: "Pending", value: 3 },
  ];
  const online = agentLive.filter((a) => a.status === "online").length;
  const busy = agentLive.filter((a) => a.status === "busy").length;
  const offline = agentLive.filter((a) => a.status === "offline").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Open Conversations <LiveBadge />
          </CardTitle>
          <CardAction>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger size="sm" className="w-44" aria-label="Team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamLive.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 rounded-lg border p-4">
              <span className="text-muted-foreground text-sm">{s.label}</span>
              <span className="font-semibold text-3xl tabular-nums">{s.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Agent status <LiveBadge />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {[
            { label: "Online", value: online, dot: statusDot.online },
            { label: "Busy", value: busy, dot: statusDot.busy },
            { label: "Offline", value: offline, dot: statusDot.offline },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1 rounded-lg border p-4">
              <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <span className={cn("size-2 rounded-full", s.dot)} />
                {s.label}
              </span>
              <span className="font-semibold text-3xl tabular-nums">{s.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Heatmap({ title, seed, tone }: { title: string; seed: number; tone: "blue" | "green" }) {
  const [range, setRange] = React.useState("Last 7 days");
  const grid = React.useMemo(() => heatmap(seed), [seed]);
  const max = Math.max(...grid.flat());
  const color = tone === "blue" ? "var(--chart-1)" : "var(--chart-2)";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger size="sm" className="w-36" aria-label="Duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Last 7 days">Last 7 days</SelectItem>
              <SelectItem value="Last 14 days">Last 14 days</SelectItem>
              <SelectItem value="Last 30 days">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => toast.success("Report download started (sample)")}>
            <Download />
            Download report
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-[96px_repeat(24,minmax(0,1fr))] gap-1">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[10px] text-muted-foreground">
              {h % 3 === 0 ? `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "a" : "p"}` : ""}
            </span>
          ))}
          {grid.map((row, d) => (
            <React.Fragment key={DAYS[d]}>
              <span className="flex items-center text-muted-foreground text-xs">{DAYS[d]}</span>
              {row.map((v, h) => (
                <Tooltip key={h}>
                  <TooltipTrigger asChild>
                    <span
                      className="h-7 rounded-[4px] border border-border/40"
                      style={{
                        backgroundColor: v
                          ? `color-mix(in oklab, ${color} ${Math.round((v / max) * 90 + 8)}%, transparent)`
                          : undefined,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {DAYS[d]}, {h}:00 · {v ? `${v} ${v === 1 ? "conversation" : "conversations"}` : "No conversations"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations by agents</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Unattended</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentLive.map((a) => (
              <TableRow key={a.email}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">{getInitials(a.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground text-xs">{a.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.open}</TableCell>
                <TableCell className="text-right tabular-nums">{a.unattended}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className={cn("size-2 rounded-full", statusDot[a.status])} />
                    {statusLabel[a.status]}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TeamTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations by teams</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Unattended</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamLive.map((t) => (
              <TableRow key={t.name}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-right tabular-nums">{t.open}</TableCell>
                <TableCell className="text-right tabular-nums">{t.unattended}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className={cn("size-2 rounded-full", t.unattended > 2 ? "bg-amber-500" : "bg-emerald-500")} />
                    {t.unattended > 2 ? "Busy" : "Online"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function OverviewReport() {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col gap-4">
        <ReportHeader title="Overview" />
        <OpenConversations />
        <Heatmap title="Conversation Traffic" seed={11} tone="blue" />
        <Heatmap title="Resolutions" seed={23} tone="green" />
        <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <AgentTable />
          <TeamTable />
        </div>
      </div>
    </TooltipProvider>
  );
}

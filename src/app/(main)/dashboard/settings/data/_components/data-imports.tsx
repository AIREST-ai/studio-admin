"use client";
import * as React from "react";

import { cn } from "cn";
import { Download, Plus, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Stage = "contacts" | "conversations" | "completed" | "completed_with_errors" | "failed" | "abandoned";

const stageLabel: Record<Stage, string> = {
  contacts: "Importing contacts",
  conversations: "Importing conversations",
  completed: "Completed",
  completed_with_errors: "Completed with errors",
  failed: "Failed",
  abandoned: "Abandoned",
};

const stageTone: Record<Stage, string> = {
  contacts: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  conversations: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  completed_with_errors: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  abandoned: "bg-muted text-muted-foreground",
};

const imports: {
  id: number;
  name: string;
  source: string;
  types: string[];
  stage: Stage;
  imported: number;
  total: number;
  created: string;
}[] = [
  {
    id: 1,
    name: "October support migration",
    source: "Intercom",
    types: ["Contacts", "Conversations"],
    stage: "conversations",
    imported: 6240,
    total: 9800,
    created: "Oct 12, 2026",
  },
  {
    id: 2,
    name: "Dubai branch helpdesk",
    source: "Freshdesk",
    types: ["Contacts", "Conversations"],
    stage: "completed_with_errors",
    imported: 4112,
    total: 4180,
    created: "Oct 4, 2026",
  },
  {
    id: 3,
    name: "Riyadh customer list",
    source: "Intercom",
    types: ["Contacts"],
    stage: "completed",
    imported: 2875,
    total: 2875,
    created: "Sep 22, 2026",
  },
  {
    id: 4,
    name: "Intercom import",
    source: "Intercom",
    types: ["Conversations"],
    stage: "failed",
    imported: 310,
    total: 5200,
    created: "Sep 15, 2026",
  },
  {
    id: 5,
    name: "Old Doha store tickets",
    source: "Freshdesk",
    types: ["Contacts", "Conversations"],
    stage: "abandoned",
    imported: 0,
    total: 1450,
    created: "Aug 30, 2026",
  },
];

function NewImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [source, setSource] = React.useState("intercom");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New import</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Source</Label>
            <NativeSelect className="w-full" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="intercom">Intercom</option>
              <option value="freshdesk">Freshdesk</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label>Import name</Label>
            <Input placeholder="July support migration" />
          </div>
          {source === "freshdesk" && (
            <div className="grid gap-2">
              <Label>Freshdesk domain</Label>
              <Input placeholder="acme.freshdesk.com" />
            </div>
          )}
          <div className="grid gap-2">
            <Label>{source === "freshdesk" ? "Freshdesk API key" : "Intercom access key"}</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={source === "freshdesk" ? "Paste your Freshdesk API key" : "Paste your Intercom access key"}
            />
          </div>
          <div className="grid gap-2">
            <Label>Data to import</Label>
            <div className="flex gap-6">
              <Label className="font-normal">
                <Checkbox defaultChecked /> Contacts
              </Label>
              <Label className="font-normal">
                <Checkbox defaultChecked /> Conversations
              </Label>
            </div>
          </div>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800 text-xs dark:bg-amber-500/10 dark:text-amber-300">
            Wait for the active import to finish before starting another one.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button disabled>Import</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DataImports() {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("import");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-3xl gap-1.5">
        <h1 className="font-semibold text-xl">Data</h1>
        <p className="text-muted-foreground text-sm">
          Bring your existing contacts and past conversations into this account from another support tool. Each import
          runs in the background, so you can keep working while it finishes, track its progress, and review anything
          that was skipped along the way.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          {tab === "import" && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Live updates every 10s</span>
              <Button variant="ghost" size="sm">
                <RefreshCw /> Refresh
              </Button>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus /> Import
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="import">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2">
                Recent imports
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {imports.length} imports
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table className="**:data-[slot='table-cell']:px-5 **:data-[slot='table-head']:px-5">
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-3 font-normal">Name</TableHead>
                    <TableHead className="py-3 font-normal">Type</TableHead>
                    <TableHead className="py-3 font-normal">Status</TableHead>
                    <TableHead className="w-56 py-3 font-normal">Imported</TableHead>
                    <TableHead className="py-3 font-normal">Created</TableHead>
                    <TableHead className="w-32 py-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((row) => {
                    const pct = Math.round((row.imported / row.total) * 100);
                    return (
                      <TableRow key={row.id} className="border-border/60">
                        <TableCell className="py-4">
                          <div className="grid gap-0.5">
                            <span className="font-medium">{row.name}</span>
                            <span className="text-muted-foreground text-xs">{row.source}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex gap-1">
                            {row.types.map((t) => (
                              <Badge key={t} variant="outline" className="font-normal">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant="secondary" className={cn("font-normal", stageTone[row.stage])}>
                            {stageLabel[row.stage]}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="grid gap-1.5">
                            <Progress value={pct} className="h-1.5" />
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {row.imported.toLocaleString()} of {row.total.toLocaleString()} imported
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-muted-foreground tabular-nums">{row.created}</TableCell>
                        <TableCell className="py-4 text-right">
                          {row.stage === "failed" ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm">
                                Abandon
                              </Button>
                              <Button variant="outline" size="sm">
                                Retry
                              </Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm">
                              View import
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardContent>
              <Empty className="py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Download />
                  </EmptyMedia>
                  <EmptyTitle>Exports are on the way</EmptyTitle>
                  <EmptyDescription>
                    Export your contacts and conversations out of this account. This workflow is coming soon.
                  </EmptyDescription>
                </EmptyHeader>
                <Badge variant="outline">Coming soon</Badge>
              </Empty>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewImportDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

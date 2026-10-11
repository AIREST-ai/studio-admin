"use client";
import * as React from "react";

import Link from "next/link";

import { ChevronLeft, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { type DashboardApp, dashboardApps } from "./data";

function AppDialog({
  app,
  open,
  onOpenChange,
}: {
  app?: DashboardApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{app ? "Edit dashboard app" : "Add a new dashboard app"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input placeholder="Enter a name for your dashboard app" defaultValue={app?.title} />
          </div>
          <div className="grid gap-2">
            <Label>Endpoint</Label>
            <Input placeholder="Enter the endpoint URL where your app is hosted" defaultValue={app?.url} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{app ? "Update" : "Submit"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardAppsList() {
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<DashboardApp | null>(null);
  const [deleting, setDeleting] = React.useState<DashboardApp | null>(null);

  const q = query.trim().toLowerCase();
  const rows = q ? dashboardApps.filter((a) => `${a.title} ${a.url}`.toLowerCase().includes(q)) : dashboardApps;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit px-1.5 text-muted-foreground" asChild>
        <Link href="/dashboard/settings/integrations">
          <ChevronLeft /> Integrations
        </Link>
      </Button>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid max-w-2xl gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-xl">Dashboard Apps</h1>
            <Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">
              {dashboardApps.length} dashboard apps
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Dashboard Apps allow organizations to embed an application inside the dashboard to provide the context for
            customer support agents. This feature allows you to create an application independently and embed that to
            provide user information, their orders, or their previous payment history.
          </p>
          <Button variant="link" size="sm" className="h-auto w-fit px-0">
            Learn more about Dashboard Apps <ExternalLink />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <InputGroup className="h-8 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search dashboard apps..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add a new dashboard app
          </Button>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table className="**:data-[slot='table-cell']:px-5 **:data-[slot='table-head']:px-5">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Name</TableHead>
                <TableHead className="py-3 font-normal">Endpoint</TableHead>
                <TableHead className="w-24 py-3 text-right font-normal">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((app) => (
                  <TableRow key={app.id} className="border-border/60">
                    <TableCell className="py-4 font-medium">{app.title}</TableCell>
                    <TableCell className="py-4 text-muted-foreground">{app.url}</TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Edit app" onClick={() => setEditing(app)}>
                              <Pencil />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit app</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete app"
                              className="hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleting(app)}
                            >
                              <Trash2 />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete app</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No dashboard apps found matching your search
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AppDialog open={adding} onOpenChange={setAdding} />
      <AppDialog app={editing} open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
            <AlertDialogDescription>Are you sure to delete the app - {deleting?.title}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Yes, delete it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";
// Chatwoot DashboardApps/Index.vue, DashboardAppsRow.vue and DashboardAppModal.vue in the Studio pattern.
import * as React from "react";

import { ExternalLink, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { NoResults, SettingsShell } from "../../labels/_shared/settings-shell";
import { type DashboardApp, dashboardApps } from "./data";
import { BackToIntegrations, ConfirmAction } from "./integration-ui";

function AppDialog({
  app,
  open,
  onOpenChange,
  onSubmit,
}: {
  app: DashboardApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { title: string; url: string }) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [errors, setErrors] = React.useState<{ title?: string; url?: string }>({});

  React.useEffect(() => {
    if (open) {
      setTitle(app?.title ?? "");
      setUrl(app?.url ?? "");
      setErrors({});
    }
  }, [open, app]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: { title?: string; url?: string } = {};
    if (!title.trim()) next.title = "A name for the dashboard app is required";
    try {
      const parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad");
    } catch {
      next.url = "A valid URL is required";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ title: title.trim(), url: url.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{app ? "Edit dashboard app" : "Add a new dashboard app"}</DialogTitle>
            <DialogDescription className="sr-only">Dashboard app name and endpoint</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="app-title">Name</Label>
            <Input
              id="app-title"
              placeholder="Enter a name for your dashboard app"
              value={title}
              aria-invalid={Boolean(errors.title)}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((p) => ({ ...p, title: undefined }));
              }}
            />
            {errors.title ? <p className="text-destructive text-xs">{errors.title}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="app-url">Endpoint</Label>
            <Input
              id="app-url"
              placeholder="Enter the endpoint URL where your app is hosted"
              value={url}
              aria-invalid={Boolean(errors.url)}
              onChange={(e) => {
                setUrl(e.target.value);
                setErrors((p) => ({ ...p, url: undefined }));
              }}
            />
            {errors.url ? <p className="text-destructive text-xs">{errors.url}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{app ? "Update" : "Submit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardAppsPage() {
  const [rows, setRows] = React.useState<DashboardApp[]>(dashboardApps);
  const [query, setQuery] = React.useState("");
  const [dialog, setDialog] = React.useState<{ open: boolean; app: DashboardApp | null }>({ open: false, app: null });
  const [deleting, setDeleting] = React.useState<DashboardApp | null>(null);

  const q = query.trim().toLowerCase();
  const visible = q ? rows.filter((a) => `${a.title} ${a.url}`.toLowerCase().includes(q)) : rows;

  function save(values: { title: string; url: string }) {
    const editing = dialog.app;
    if (editing) {
      setRows((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...values } : a)));
      toast.success("Dashboard app updated successfully");
    } else {
      setRows((prev) => [...prev, { id: Date.now(), ...values }]);
      toast.success("Dashboard app configured successfully");
    }
    setDialog({ open: false, app: null });
  }

  return (
    <div className="flex flex-col gap-4">
      <BackToIntegrations />
      <SettingsShell
        title="Dashboard Apps"
        description="Dashboard Apps allow organizations to embed an application inside the dashboard to provide the context for customer support agents. This feature allows you to create an application independently and embed that to provide user information, their orders, or their previous payment history."
        learnMore="Learn more about Dashboard Apps"
        actions={
          <Button onClick={() => setDialog({ open: true, app: null })}>
            <Plus /> Add a new dashboard app
          </Button>
        }
        cardTitle="Dashboard Apps"
        cardDescription="Apps open as a tab next to the conversation."
        count={`${rows.length} ${rows.length === 1 ? "dashboard app" : "dashboard apps"}`}
        search={{ placeholder: "Search dashboard apps...", value: query, onChange: setQuery }}
      >
        {rows.length === 0 ? (
          <NoResults>There are no dashboard apps configured on this account yet</NoResults>
        ) : (
          <Table className="**:data-[slot='table-cell']:px-6 **:data-[slot='table-head']:px-6">
            <TableHeader>
              <TableRow>
                <TableHead className="py-4 font-normal">Name</TableHead>
                <TableHead className="py-4 font-normal">Endpoint</TableHead>
                <TableHead className="py-4 font-normal">
                  <div className="text-right">Actions</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length ? (
                visible.map((app) => (
                  <TableRow key={app.id} className="border-border/60">
                    <TableCell className="py-4 font-medium">{app.title}</TableCell>
                    <TableCell className="py-4 text-muted-foreground">
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                      >
                        {app.url} <ExternalLink className="size-3.5" />
                      </a>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-label={`Open actions for ${app.title}`}
                            className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                            size="icon-sm"
                            variant="ghost"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ open: true, app })}>
                            <Pencil /> Edit app
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(app)}>
                            <Trash2 /> Delete app
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3}>
                    <NoResults>No dashboard apps found matching your search</NoResults>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </SettingsShell>

      <AppDialog
        app={dialog.app}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSubmit={save}
      />
      <ConfirmAction
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => {
          setRows((prev) => prev.filter((a) => a.id !== deleting?.id));
          toast.success("Dashboard app deleted successfully");
        }}
        title="Confirm deletion"
        message={`Are you sure to delete the app - ${deleting?.title ?? ""}?`}
        yes="Yes, delete it"
        no="No, keep it"
      />
    </div>
  );
}

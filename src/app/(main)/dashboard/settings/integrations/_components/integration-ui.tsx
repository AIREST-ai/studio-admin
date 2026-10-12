"use client";
// Shared pieces of the Integrations pages, drawn in the Studio pattern (big title outside the card, card body,
// coloured status badges). Chatwoot sources: Integration.vue, IntegrationItem.vue, NewHook.vue.
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { type HookApp, hookInboxes, type Integration, integrations } from "./data";

export function BackToIntegrations() {
  return (
    <Button variant="ghost" size="sm" className="w-fit px-1.5 text-muted-foreground" asChild>
      <Link href="/dashboard/settings/integrations">
        <ChevronLeft /> Integrations
      </Link>
    </Button>
  );
}

export function integrationById(id: string): Integration | undefined {
  return integrations.find((i) => i.id === id);
}

export function IntegrationMark({ item, size = "md" }: { item: Integration; size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border font-semibold shadow-xs",
        size === "lg" ? "size-16 text-base" : "size-12 text-sm",
        item.tone,
      )}
    >
      {item.mark}
    </div>
  );
}

export function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border px-2 py-1 font-medium",
        enabled
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-muted-foreground")} />
      {enabled ? "Enabled" : "Disabled"}
    </Badge>
  );
}

/** Chatwoot Integration.vue: logo, name, description and the Connect / Disconnect button in one bordered row. */
export function IntegrationRow({ item, action }: { item: Integration; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start justify-between gap-6 p-6 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-col items-start gap-6 lg:flex-row lg:items-center">
        <IntegrationMark item={item} size="lg" />
        <div className="grid gap-1">
          <h3 className="font-medium text-lg">{item.name}</h3>
          <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">{item.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{action}</div>
    </div>
  );
}

/** Chatwoot NewHook.vue: the app's own form fields, plus an inbox picker for inbox-level hooks. */
export function HookDialog({
  app,
  item,
  open,
  onOpenChange,
  onCreated,
}: {
  app: HookApp;
  item: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues({});
      setErrors({});
      setSaving(false);
    }
  }, [open]);

  function set(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    for (const field of app.fields) {
      if (field.required && !values[field.name]?.trim()) next[field.name] = `${field.label} is required`;
    }
    if (app.hookType === "inbox" && !values.inbox) next.inbox = "Inbox is required";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    window.setTimeout(
      () => {
        setSaving(false);
        onCreated(values);
        onOpenChange(false);
        toast.success("Integration hook added successfully");
      },
      app.id === "openai" ? 900 : 300,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{item.name}</DialogTitle>
            <DialogDescription>{app.shortDescription}</DialogDescription>
          </DialogHeader>
          {app.fields.map((field) => {
            const id = `hook-${field.name}`;
            const error = errors[field.name];
            if (field.type === "checkbox") {
              return (
                <Label key={field.name} className="font-normal">
                  <Checkbox
                    checked={values[field.name] === "true"}
                    onCheckedChange={(checked) => set(field.name, checked === true ? "true" : "")}
                  />
                  {field.label}
                </Label>
              );
            }
            return (
              <div key={field.name} className="grid gap-2">
                <Label htmlFor={id}>
                  {field.label}
                  {field.required ? <span className="text-destructive">*</span> : null}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={id}
                    rows={4}
                    className="font-mono text-xs"
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ""}
                    aria-invalid={Boolean(error)}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                ) : field.type === "select" ? (
                  <NativeSelect
                    id={id}
                    className="w-full"
                    value={values[field.name] ?? field.options?.[0]}
                    onChange={(e) => set(field.name, e.target.value)}
                  >
                    {field.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id={id}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ""}
                    aria-invalid={Boolean(error)}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                )}
                {error ? (
                  <p className="text-destructive text-xs">{error}</p>
                ) : field.help ? (
                  <p className="text-muted-foreground text-xs">{field.help}</p>
                ) : null}
              </div>
            );
          })}
          {app.hookType === "inbox" ? (
            <div className="grid gap-2">
              <Label htmlFor="hook-inbox">
                Select Inbox<span className="text-destructive">*</span>
              </Label>
              <NativeSelect
                id="hook-inbox"
                className="w-full"
                value={values.inbox ?? ""}
                aria-invalid={Boolean(errors.inbox)}
                onChange={(e) => set("inbox", e.target.value)}
              >
                <option value="" disabled>
                  Select Inbox
                </option>
                {hookInboxes.map((inbox) => (
                  <option key={inbox} value={inbox}>
                    {inbox}
                  </option>
                ))}
              </NativeSelect>
              {errors.inbox ? <p className="text-destructive text-xs">{errors.inbox}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? (app.id === "openai" ? "Validating with OpenAI..." : "Creating...") : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Alert dialog with a real confirm handler (the shared ConfirmDelete only closes). */
export function ConfirmAction({
  open,
  onOpenChange,
  onConfirm,
  title,
  message,
  yes,
  no,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  yes: string;
  no: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{no}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {yes}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

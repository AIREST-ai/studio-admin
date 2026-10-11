"use client";
import type * as React from "react";

import { Copy, GripVertical, X } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { activePortal, allLocaleOptions, articles, type Category, categories, type Locale } from "./data";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
    </div>
  );
}

function Footer({ confirm, destructive }: { confirm: string; destructive?: boolean }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <DialogClose asChild>
        <Button variant={destructive ? "destructive" : "default"}>{confirm}</Button>
      </DialogClose>
    </DialogFooter>
  );
}

export function CreatePortalDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new portal</DialogTitle>
          <DialogDescription>
            Give your portal a name and create a user-friendly URL slug. You can modify both later in the settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" help="Choose an name for your portal.">
            <Input placeholder="User Guide | Chatwoot" />
          </Field>
          <Field label="Slug">
            <Input placeholder="user-guide" />
          </Field>
        </div>
        <Footer confirm="Create" />
      </DialogContent>
    </Dialog>
  );
}

export function DeleteArticlesDialog({ open, onOpenChange, count }: DialogProps & { count: number }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{count > 1 ? `Delete ${count} articles` : "Delete article"}</AlertDialogTitle>
          <AlertDialogDescription>
            {count > 1
              ? `This will permanently delete ${count} selected articles. This action cannot be undone.`
              : "This will permanently delete the selected article. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BulkTranslateDialog({ open, onOpenChange, count }: DialogProps & { count: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{count > 1 ? `Translate ${count} articles` : "Translate article"}</DialogTitle>
          <DialogDescription>
            {count > 1
              ? "Translate the selected articles to another language."
              : "Translate the selected article to another language."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Target language">
            <NativeSelect className="w-full" defaultValue="">
              <option value="" disabled>
                Select a language
              </option>
              <option>Arabic (ar)</option>
              <option>Urdu (ur)</option>
              <option>Malayalam (ml)</option>
            </NativeSelect>
          </Field>
          <div className="grid gap-1.5">
            <Label>
              Target category <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <NativeSelect className="w-full" defaultValue="">
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Footer confirm="Translate" />
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: DialogProps & {
  category?: Category | null;
}) {
  const editing = Boolean(category);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "Create category"}</DialogTitle>
          <DialogDescription>
            Editing a category will update the category in the public facing portal.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span>
            <span className="text-muted-foreground">Portal: </span>
            {activePortal.name}
          </span>
          <span>
            <span className="text-muted-foreground">Locale: </span>English (en)
          </span>
        </div>
        <div className="grid gap-4">
          <Field label="Name">
            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Pick icon" className="text-base">
                {category?.icon ?? "🙂"}
              </Button>
              <Input placeholder="Category name" defaultValue={category?.name} />
            </div>
          </Field>
          <Field
            label="Slug"
            help={`app.chatwoot.com/hc/${activePortal.slug}/en/categories/${category?.slug ?? "my-slug"}`}
          >
            <Input placeholder="Category slug for urls" defaultValue={category?.slug} />
          </Field>
          <Field label="Description">
            <Textarea
              placeholder="Give a short description about the category."
              defaultValue={category?.description}
              className="min-h-20"
            />
          </Field>
        </div>
        <Footer confirm={editing ? "Update" : "Create"} />
      </DialogContent>
    </Dialog>
  );
}

export function AddLocaleDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new locale</DialogTitle>
          <DialogDescription>
            Select the language in which this article will be written. This will be added to your list of
            translations, and you can add more later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <NativeSelect className="w-full" defaultValue="">
            <option value="" disabled>
              Select locale...
            </option>
            {allLocaleOptions.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </NativeSelect>
          <Field label="Status">
            <NativeSelect className="w-full" defaultValue="draft">
              <option value="live">Published</option>
              <option value="draft">Draft</option>
            </NativeSelect>
          </Field>
        </div>
        <Footer confirm="Create" />
      </DialogContent>
    </Dialog>
  );
}

export function LocalizeContentDialog({ open, onOpenChange, locale }: DialogProps & { locale: Locale | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Localize content{locale ? ` — ${locale.name}` : ""}</DialogTitle>
          <DialogDescription>
            Set values specific to this locale. Anything left blank falls back to the default locale.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name">
            <Input placeholder={activePortal.name} defaultValue={locale?.code === "ar" ? "مركز مساعدة عيادات نور" : ""} />
          </Field>
          <Field label="Page title">
            <Input placeholder={activePortal.pageTitle} />
          </Field>
          <Field label="Header text">
            <Input
              placeholder={activePortal.headerText}
              defaultValue={locale?.code === "ar" ? "كيف يمكننا مساعدتك اليوم؟" : ""}
            />
          </Field>
        </div>
        <Footer confirm="Save changes" />
      </DialogContent>
    </Dialog>
  );
}

export function RecommendedContentDialog({ open, onOpenChange }: DialogProps) {
  const pickedCategories = categories.slice(0, 2);
  const pickedArticles = articles.filter((a) => a.status === "published").slice(0, 4);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recommended content</DialogTitle>
          <DialogDescription>
            Pick up to 3 categories and 6 articles to feature on this locale&apos;s help center home page. Drag them
            into the order you want visitors to see.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Recommended categories</Label>
              <span className="text-muted-foreground text-xs">1 slots left</span>
            </div>
            {pickedCategories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border px-2 py-2 text-sm">
                <GripVertical className="size-4 text-muted-foreground" />
                <span>{c.icon}</span>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">{c.articles} articles</span>
                <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Remove">
                  <X />
                </Button>
              </div>
            ))}
            <Input placeholder="Add another..." className="h-8" />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Recommended articles</Label>
              <span className="text-muted-foreground text-xs">2 slots left</span>
            </div>
            {pickedArticles.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border px-2 py-2 text-sm">
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{a.title}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  in {categories.find((c) => c.id === a.categoryId)?.name ?? "Uncategorized"}
                </span>
                <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Remove">
                  <X />
                </Button>
              </div>
            ))}
            <Input placeholder="Add another..." className="h-8" />
          </div>
        </div>
        <Footer confirm="Save recommendations" />
      </DialogContent>
    </Dialog>
  );
}

export function CustomDomainDialog({ open, onOpenChange, edit }: DialogProps & { edit?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit custom domain" : "Add custom domain"}</DialogTitle>
        </DialogHeader>
        <Field label="Custom domain">
          <Input placeholder="Portal custom domain" defaultValue={edit ? activePortal.customDomain : ""} />
        </Field>
        <Footer confirm={edit ? "Update domain" : "Add domain"} />
      </DialogContent>
    </Dialog>
  );
}

export function DnsConfigurationDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>DNS configuration</DialogTitle>
          <DialogDescription>
            Log in to the account you have with your DNS provider, and add a CNAME record for subdomain pointing to
            chatwoot.help
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm">
          <span className="truncate">{activePortal.customDomain} CNAME chatwoot.help</span>
          <Button variant="ghost" size="icon-xs" aria-label="Copy">
            <Copy />
          </Button>
        </div>
        <Separator />
        <div className="grid gap-2">
          <span className="font-medium text-sm">Send instructions</span>
          <p className="text-muted-foreground text-sm">
            If you would prefer to have someone from your development team to handle this step, you can enter email
            address below, and we will send them the required instructions.
          </p>
          <div className="flex gap-2">
            <Input placeholder="Enter their email" />
            <Button variant="outline">Send</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePortalDialog({ open, onOpenChange }: DialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sure you want to delete {activePortal.name}?</AlertDialogTitle>
          <AlertDialogDescription>This is a permanent action that cannot be reversed.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

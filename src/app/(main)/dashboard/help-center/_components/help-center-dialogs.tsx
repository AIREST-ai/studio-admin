"use client";
// Chatwoot v4.18 Help Center dialogs (components-next/HelpCenter/**), texts from i18n/locale/en/helpCenter.json.
// Every confirm button changes the shared mock store (hc-store.ts) and shows Chatwoot's success alert as a toast.
import * as React from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Copy, GripVertical, Search, X } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { type Article, allLocaleOptions, type Category, type Locale } from "./data";
import { articleLocale, hc, useActivePortal, useHelpCenter } from "./hc-store";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({
  label,
  children,
  help,
  error,
  htmlFor,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  help?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : help ? (
        <p className="text-muted-foreground text-xs">{help}</p>
      ) : null}
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreatePortalDialog({ open, onOpenChange }: DialogProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setTouched(false);
    }
  }, [open]);

  const nameError = touched && !name.trim() ? "Name is required" : null;
  const slugError =
    touched && !slug.trim()
      ? "Slug is required"
      : touched && !SLUG_RE.test(slug)
        ? "Please enter a valid slug, for eg: user-guide"
        : null;

  function submit() {
    setTouched(true);
    if (!name.trim() || !SLUG_RE.test(slug)) return;
    hc.createPortal(name.trim(), slug);
    toast.success("Portal created successfully");
    onOpenChange(false);
    router.push("/dashboard/help-center");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new portal</DialogTitle>
          <DialogDescription>
            Give your portal a name and create a user-friendly URL slug. You can modify both later in the settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="portal-name" help="Choose an name for your portal." error={nameError}>
            <Input
              id="portal-name"
              placeholder="User Guide | منصة الشركة"
              value={name}
              aria-invalid={Boolean(nameError)}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field
            label="Slug"
            htmlFor="portal-slug"
            error={slugError}
            help={`https://app.weblabs.studio/hc/${slug || "user-guide"}`}
          >
            <Input
              id="portal-slug"
              placeholder="user-guide"
              value={slug}
              aria-invalid={Boolean(slugError)}
              onChange={(e) => setSlug(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!name.trim() || !SLUG_RE.test(slug)}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteArticlesDialog({
  open,
  onOpenChange,
  ids,
  onDone,
}: DialogProps & { ids: number[]; onDone?: () => void }) {
  const count = ids.length;
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
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              hc.deleteArticles(ids);
              toast.success("Articles deleted successfully");
              onDone?.();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BulkTranslateDialog({
  open,
  onOpenChange,
  ids,
  onDone,
}: DialogProps & { ids: number[]; onDone?: () => void }) {
  const { articles, locales, categories } = useHelpCenter();
  const [locale, setLocale] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState(false);
  const count = ids.length;
  const source = articles.filter((a) => ids.includes(a.id));
  const sourceLocales = new Set(source.map(articleLocale));
  const options = locales.filter((l) => !sourceLocales.has(l.code));
  // A translation "exists" when an article with the same author and category is already in the target locale.
  const duplicates = locale
    ? source.filter((a) =>
        articles.some((o) => articleLocale(o) === locale && o.categoryId === a.categoryId && o.authorId === a.authorId),
      ).length
    : 0;

  React.useEffect(() => {
    if (open) {
      setLocale("");
      setCategory("");
      setTouched(false);
      setConfirmOverwrite(false);
    }
  }, [open]);

  function submit() {
    setTouched(true);
    if (!locale) return;
    if (duplicates && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    hc.translate(ids, locale, category ? Number(category) : null);
    toast.success("Translation in progress. The article will appear as a draft once ready.");
    onOpenChange(false);
    onDone?.();
  }

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
          <Field
            label="Target language"
            htmlFor="translate-locale"
            error={touched && !locale ? "Select a language" : null}
          >
            <NativeSelect
              id="translate-locale"
              className="w-full"
              value={locale}
              aria-invalid={touched && !locale}
              onChange={(e) => {
                setLocale(e.target.value);
                setConfirmOverwrite(false);
              }}
            >
              <option value="" disabled>
                Select a language
              </option>
              {options.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            htmlFor="translate-category"
            label={
              <>
                Target category <span className="font-normal text-muted-foreground">(optional)</span>
              </>
            }
          >
            <NativeSelect
              id="translate-category"
              className="w-full"
              disabled={!locale}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {duplicates ? (
            <div className="grid gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 text-sm dark:text-amber-400">
              <span>
                {duplicates > 1
                  ? `Translations already exist for ${duplicates} articles in the selected language.`
                  : "A translation already exists for this article in the selected language."}
              </span>
              {confirmOverwrite ? (
                <span className="text-xs">Click translate again to overwrite the existing translation.</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} variant={confirmOverwrite ? "destructive" : "default"}>
            {confirmOverwrite ? "Overwrite and translate" : "Translate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const emojiChoices = [
  "🚀",
  "💳",
  "📊",
  "🔐",
  "🔌",
  "📣",
  "📚",
  "🧭",
  "💡",
  "🛠️",
  "⚙️",
  "📦",
  "🧾",
  "👥",
  "📱",
  "🌐",
  "✉️",
  "🔔",
  "🎯",
  "🧩",
  "📝",
  "❓",
  "⭐",
  "🏷️",
];

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  localeCode = "en",
}: DialogProps & {
  category?: Category | null;
  localeCode?: string;
}) {
  const portal = useActivePortal();
  const { locales } = useHelpCenter();
  const editing = Boolean(category);
  const [icon, setIcon] = React.useState("");
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const localeName = locales.find((l) => l.code === localeCode)?.name ?? "English";

  React.useEffect(() => {
    if (open) {
      setIcon(category?.icon ?? "");
      setName(category?.name ?? "");
      setSlug(category?.slug ?? "");
      setDescription(category?.description ?? "");
      setTouched(false);
    }
  }, [open, category]);

  const errors = {
    name: touched && !name.trim() ? "Name is required" : null,
    slug: touched && !slug.trim() ? "Slug is required" : null,
  };

  function submit() {
    setTouched(true);
    if (!name.trim() || !slug.trim()) return;
    hc.saveCategory({ id: category?.id, icon, name: name.trim(), slug: slug.trim(), description: description.trim() });
    toast.success(editing ? "Category updated successfully" : "Category created successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "Create category"}</DialogTitle>
          <DialogDescription>
            Editing a category will update the category in the public facing portal.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span>
            <span className="text-muted-foreground">Portal: </span>
            {portal?.name}
          </span>
          <span>
            <span className="text-muted-foreground">Locale: </span>
            {localeName} ({localeCode})
          </span>
        </div>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="category-name" error={errors.name}>
            <div className="flex gap-2">
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Pick icon" className="shrink-0 text-base">
                    {icon || <span className="text-muted-foreground text-xs">+</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <div className="grid grid-cols-8 gap-1">
                    {emojiChoices.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md text-base hover:bg-muted",
                          icon === emoji && "bg-muted ring-1 ring-primary",
                        )}
                        onClick={() => {
                          setIcon(emoji);
                          setEmojiOpen(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {icon ? (
                    <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setIcon("")}>
                      Remove icon
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
              <Input
                id="category-name"
                placeholder="Category name"
                value={name}
                aria-invalid={Boolean(errors.name)}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editing) setSlug(slugify(e.target.value));
                }}
              />
            </div>
          </Field>
          <Field
            label="Slug"
            htmlFor="category-slug"
            error={errors.slug}
            help={`app.weblabs.studio/hc/${portal?.slug}/${localeCode}/categories/${slug || "my-slug"}`}
          >
            <Input
              id="category-slug"
              placeholder="Category slug for urls"
              disabled={editing}
              value={slug}
              aria-invalid={Boolean(errors.slug)}
              onChange={(e) => setSlug(e.target.value)}
            />
          </Field>
          <Field label="Description" htmlFor="category-description">
            <Textarea
              id="category-description"
              placeholder="Give a short description about the category."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className="min-h-20"
            />
            <span className="justify-self-end text-muted-foreground text-xs tabular-nums">
              {description.length} / 200
            </span>
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit}>{editing ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddLocaleDialog({ open, onOpenChange }: DialogProps) {
  const { locales } = useHelpCenter();
  const [value, setValue] = React.useState("");
  const [status, setStatus] = React.useState("draft");
  const [query, setQuery] = React.useState("");
  const [listOpen, setListOpen] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const taken = new Set(locales.map((l) => l.code));
  const options = allLocaleOptions
    .map((label) => ({ label, code: label.match(/\(([^)]+)\)/)?.[1] ?? label }))
    .filter((o) => !taken.has(o.code) && o.label.toLowerCase().includes(query.toLowerCase()));
  const picked = allLocaleOptions.find((label) => label.endsWith(`(${value})`));

  React.useEffect(() => {
    if (open) {
      setValue("");
      setStatus("draft");
      setQuery("");
      setTouched(false);
    }
  }, [open]);

  function submit() {
    setTouched(true);
    if (!value || !picked) return;
    hc.addLocale({
      code: value,
      name: picked.replace(/\s*\([^)]+\)$/, ""),
      articles: 0,
      categories: 0,
      isDraft: status === "draft",
    });
    toast.success("Locale added successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new locale</DialogTitle>
          <DialogDescription>
            Select the language in which this article will be written. This will be added to your list of translations,
            and you can add more later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Popover open={listOpen} onOpenChange={setListOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-between font-normal", !picked && "text-muted-foreground")}
                  aria-invalid={touched && !value}
                >
                  {picked ?? "Select locale..."}
                  <Search className="size-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1">
                <Input
                  autoFocus
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="mb-1 h-8"
                />
                <div className="max-h-52 overflow-y-auto">
                  {options.length ? (
                    options.map((o) => (
                      <button
                        key={o.code}
                        type="button"
                        onClick={() => {
                          setValue(o.code);
                          setListOpen(false);
                        }}
                        className={cn(
                          "flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted",
                          value === o.code && "bg-muted font-medium",
                        )}
                      >
                        {o.label}
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-3 text-center text-muted-foreground text-sm">No matching results</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {touched && !value ? <p className="text-destructive text-xs">Select locale...</p> : null}
          </div>
          <Field label="Status" htmlFor="locale-status">
            <NativeSelect
              id="locale-status"
              className="w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="live">Published</option>
              <option value="draft">Draft</option>
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LocalizeContentDialog({ open, onOpenChange, locale }: DialogProps & { locale: Locale | null }) {
  const portal = useActivePortal();
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
          <Field label="Name" htmlFor="localize-name">
            <Input
              id="localize-name"
              placeholder={portal?.name}
              defaultValue={locale?.code === "ar" ? "مركز مساعدة منصة الشركة" : ""}
            />
          </Field>
          <Field label="Page title" htmlFor="localize-title">
            <Input id="localize-title" placeholder={portal?.pageTitle} />
          </Field>
          <Field label="Header text" htmlFor="localize-header">
            <Input
              id="localize-header"
              placeholder={portal?.headerText}
              defaultValue={locale?.code === "ar" ? "كيف يمكننا مساعدتك اليوم؟" : ""}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              toast.success("Locale content updated successfully");
              onOpenChange(false);
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAnother<T extends { id: number }>({
  items,
  label,
  render,
  onPick,
  disabled,
}: {
  items: T[];
  label: (item: T) => string;
  render: (item: T) => React.ReactNode;
  onPick: (item: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const shown = items.filter((i) => label(i).toLowerCase().includes(query.toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="justify-start font-normal text-muted-foreground"
          disabled={disabled}
        >
          Add another...
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <Input
          autoFocus
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-1 h-8"
        />
        <div className="max-h-56 overflow-y-auto">
          {shown.length ? (
            shown.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onPick(item);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {render(item)}
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-center text-muted-foreground text-sm">No matching results</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RecommendedContentDialog({ open, onOpenChange, locale }: DialogProps & { locale?: Locale | null }) {
  const { articles, categories } = useHelpCenter();
  const code = locale?.code ?? "en";
  const localeArticles = articles.filter((a) => articleLocale(a) === code && a.status === "published");
  const [catIds, setCatIds] = React.useState<number[]>([]);
  const [articleIds, setArticleIds] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (open) {
      setCatIds(categories.slice(0, 2).map((c) => c.id));
      setArticleIds(localeArticles.slice(0, 4).map((a) => a.id));
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens
  }, [open]);

  const pickedCats = catIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as Category[];
  const pickedArticles = articleIds.map((id) => articles.find((a) => a.id === id)).filter(Boolean) as Article[];
  const countIn = (c: Category) => articles.filter((a) => a.categoryId === c.id && articleLocale(a) === code).length;
  const catSlots = 3 - pickedCats.length;
  const articleSlots = 6 - pickedArticles.length;

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
        {locale && !locale.isDefault ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-muted-foreground text-xs">
            Overriding defaults for this locale
          </p>
        ) : null}
        <div className="grid gap-5">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Recommended categories</Label>
              <span className="text-muted-foreground text-xs tabular-nums">{catSlots} slots left</span>
            </div>
            {pickedCats.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border px-2 py-2 text-sm">
                <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                <span>{c.icon}</span>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">
                  {countIn(c) === 0 ? "No articles" : `${countIn(c)} ${countIn(c) === 1 ? "article" : "articles"}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label="Remove"
                  onClick={() => setCatIds((ids) => ids.filter((x) => x !== c.id))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <AddAnother
              items={categories.filter((c) => !catIds.includes(c.id))}
              label={(c) => c.name}
              render={(c) => (
                <>
                  <span>{c.icon}</span> {c.name}
                </>
              )}
              onPick={(c) => setCatIds((ids) => [...ids, c.id])}
              disabled={catSlots <= 0}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Recommended articles</Label>
              <span className="text-muted-foreground text-xs tabular-nums">{articleSlots} slots left</span>
            </div>
            {pickedArticles.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border px-2 py-2 text-sm">
                <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
                <span className="truncate font-medium">{a.title}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  in {categories.find((c) => c.id === a.categoryId)?.name ?? "Uncategorized"}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label="Remove"
                  onClick={() => setArticleIds((ids) => ids.filter((x) => x !== a.id))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <AddAnother
              items={localeArticles.filter((a) => !articleIds.includes(a.id))}
              label={(a) => a.title}
              render={(a) => <span className="truncate">{a.title}</span>}
              onPick={(a) => setArticleIds((ids) => [...ids, a.id])}
              disabled={articleSlots <= 0}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              toast.success("Recommended content updated successfully");
              onOpenChange(false);
            }}
          >
            Save recommendations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomDomainDialog({ open, onOpenChange, edit }: DialogProps & { edit?: boolean }) {
  const portal = useActivePortal();
  const [domain, setDomain] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDomain(edit ? (portal?.customDomain ?? "") : "");
      setTouched(false);
    }
  }, [open, edit, portal?.customDomain]);

  const error =
    touched && !domain.trim()
      ? "Custom domain is required"
      : touched && !DOMAIN_RE.test(domain.trim())
        ? "Please enter a valid domain URL e.g. docs.yourdomain.com"
        : null;

  function submit() {
    setTouched(true);
    if (!DOMAIN_RE.test(domain.trim()) || !portal) return;
    hc.updatePortal(portal.id, { customDomain: domain.trim() });
    toast.success("Portal updated successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit custom domain" : "Add custom domain"}</DialogTitle>
        </DialogHeader>
        <Field label="Custom domain" htmlFor="custom-domain" error={error}>
          <Input
            id="custom-domain"
            placeholder="Portal custom domain"
            value={domain}
            aria-invalid={Boolean(error)}
            onChange={(e) => setDomain(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit}>{edit ? "Update domain" : "Add domain"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DnsConfigurationDialog({ open, onOpenChange }: DialogProps) {
  const portal = useActivePortal();
  const [email, setEmail] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const error = touched && !EMAIL_RE.test(email) ? "Enter a valid email address" : null;
  const record = `${portal?.customDomain || "docs.yourdomain.com"} CNAME hc.weblabs.studio`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>DNS configuration</DialogTitle>
          <DialogDescription>
            Log in to the account you have with your DNS provider, and add a CNAME record for subdomain pointing to
            hc.weblabs.studio
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm">
          <span className="truncate">{record}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy"
            onClick={() => {
              navigator.clipboard?.writeText(record).catch(() => undefined);
              toast.success("Successfully copied CNAME");
            }}
          >
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
            <Input
              placeholder="Enter their email"
              value={email}
              aria-invalid={Boolean(error)}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => {
                setTouched(true);
                if (!EMAIL_RE.test(email)) return;
                toast.success(`Instructions sent to ${email}`);
                setEmail("");
                setTouched(false);
              }}
            >
              Send
            </Button>
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePortalDialog({ open, onOpenChange }: DialogProps) {
  const portal = useActivePortal();
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sure you want to delete {portal?.name}?</AlertDialogTitle>
          <AlertDialogDescription>This is a permanent action that cannot be reversed.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (!portal) return;
              hc.deletePortal(portal.id);
              toast.success("Portal deleted successfully");
              router.push("/dashboard/help-center/portals");
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** ArticleDiffPanel: the draft against the live version of a published article with unpublished edits. */
export function ArticleDiffDialog({
  open,
  onOpenChange,
  liveTitle,
  draftTitle,
  liveBody,
  draftBody,
}: DialogProps & { liveTitle: string; draftTitle: string; liveBody: string[]; draftBody: string[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Unpublished changes</DialogTitle>
          <DialogDescription>Compare your draft against the version that&apos;s currently live.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Title</Label>
            <div className="grid gap-1 rounded-lg border p-3 text-sm">
              {liveTitle !== draftTitle ? (
                <>
                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-700 line-through dark:text-red-400">
                    {liveTitle}
                  </span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
                    {draftTitle}
                  </span>
                </>
              ) : (
                <span>{draftTitle}</span>
              )}
            </div>
          </div>
          <div className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border p-3 text-sm leading-6">
            {draftBody.map((line, i) =>
              liveBody[i] === line ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs
                <p key={i}>{line}</p>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs
                <React.Fragment key={i}>
                  {liveBody[i] ? (
                    <p className="rounded bg-red-500/10 px-1.5 text-red-700 line-through dark:text-red-400">
                      {liveBody[i]}
                    </p>
                  ) : null}
                  <p className="rounded bg-emerald-500/10 px-1.5 text-emerald-700 dark:text-emerald-400">{line}</p>
                </React.Fragment>
              ),
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

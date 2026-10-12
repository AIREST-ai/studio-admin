"use client";
// Company page in the Studio pattern, like the approved contact page (contacts/_components/contact-details.tsx):
// breadcrumb, big heading with avatar, stat cards, a details card and an Activity card with line tabs and counts.
// Chatwoot v4.18 parts kept (components-next/Companies/CompanyDetail): avatar upload / remove, Edit company details
// (Name, Domain, Description 280 + Update company), Danger zone + Delete company? dialog, and the sidebar tabs
// Attributes (used + "n unused attributes" with search, inline edit), Contacts (search, Link contact confirm step,
// Remove contact), History (its contacts' conversations) and Notes (its contacts' notes). Unknown id shows
// "Company not found".
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Building2,
  Camera,
  Check,
  ChevronsUpDown,
  Contact as ContactIcon,
  Globe,
  Inbox,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  Timer,
  Trash2,
  Unlink,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";

import { baseConversations, contactIdOf, inboxOf, lastPreview } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { useCwStore } from "@/app/(main)/dashboard/chat/_components/cw-store";
import { ChannelIcon, StatusPill } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { type Contact, contacts } from "@/app/(main)/dashboard/contacts/_components/data";
import { ContactAvatar, personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { type AttributeDef, type Company, companyAttributeDefs, companyDisplayName, contactsCountLabel } from "./company-data";
import { DeleteCompanyDialog, DescriptionField } from "./company-dialogs";
import { companyActions, companyActivity, companyContacts, companyNotesFor, useCompanyStore } from "./company-store";

type TabKey = "attributes" | "contacts" | "history" | "notes";

function contactMeta(contact: Contact) {
  return [contact.email, contact.phone].filter(Boolean).join(" • ");
}

// ---------- Attributes ----------

function displayValue(def: AttributeDef, value: string) {
  if (def.type === "checkbox") return value === "true" ? "True" : "False";
  if (def.type === "date" && value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return value || "---";
}

function AttributeItem({
  def,
  value,
  used,
  onSave,
  onDelete,
}: {
  def: AttributeDef;
  value: string;
  used: boolean;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const invalid =
    (def.type === "number" && draft !== "" && Number.isNaN(Number(draft))) ||
    (def.type === "link" && draft !== "" && !/^https?:\/\/\S+\.\S+/.test(draft));

  function start() {
    setDraft(value || (def.type === "list" ? (def.options?.[0] ?? "") : def.type === "checkbox" ? "false" : ""));
    setEditing(true);
  }

  function save() {
    if (invalid || (def.type !== "checkbox" && !draft.trim())) return;
    onSave(draft.trim());
    setEditing(false);
  }

  if (def.type === "checkbox" && used) {
    return (
      <div className="group/attr flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
        <Label className="flex items-center gap-2 font-normal text-muted-foreground">
          <Checkbox checked={value === "true"} onCheckedChange={(c) => onSave(c === true ? "true" : "false")} />
          {def.label}
        </Label>
        <div className="flex items-center gap-1">
          <span className="font-medium">{displayValue(def, value)}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${def.label}`}
            className="opacity-70 sm:opacity-0 sm:group-hover/attr:opacity-100"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="grid gap-2 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">{def.label}</span>
        <div className="flex items-center gap-1.5">
          {def.type === "list" ? (
            <NativeSelect size="sm" className="w-full" value={draft} onChange={(e) => setDraft(e.target.value)}>
              {def.options?.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </NativeSelect>
          ) : def.type === "checkbox" ? (
            <NativeSelect size="sm" className="w-full" value={draft} onChange={(e) => setDraft(e.target.value)}>
              <option value="true">True</option>
              <option value="false">False</option>
            </NativeSelect>
          ) : (
            <Input
              className="h-8"
              autoFocus
              type={def.type === "number" ? "number" : def.type === "date" ? "date" : def.type === "link" ? "url" : "text"}
              placeholder={def.type === "link" ? "https://" : `Enter ${def.label.toLowerCase()}`}
              value={draft}
              aria-invalid={invalid || undefined}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          )}
          <Button size="icon-sm" aria-label="Save" onClick={save} disabled={invalid}>
            <Check />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Cancel" onClick={() => setEditing(false)}>
            <X />
          </Button>
        </div>
        {invalid ? (
          <span className="text-destructive text-xs">
            {def.type === "number" ? "Enter a valid number" : "Enter a valid URL"}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="group/attr flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{def.label}</span>
      {used ? (
        <div className="flex min-w-0 items-center gap-1">
          {def.type === "link" ? (
            <a href={value} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
              {value}
            </a>
          ) : (
            <span className="truncate font-medium">{displayValue(def, value)}</span>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit ${def.label}`}
            className="opacity-70 sm:opacity-0 sm:group-hover/attr:opacity-100"
            onClick={start}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${def.label}`}
            className="opacity-70 sm:opacity-0 sm:group-hover/attr:opacity-100"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={start}>
          <Plus /> Add
        </Button>
      )}
    </div>
  );
}

function AttributesTab({ company }: { company: Company }) {
  const [query, setQuery] = React.useState("");
  const used = companyAttributeDefs.filter((def) => def.key in company.attributes);
  const unused = companyAttributeDefs.filter((def) => !(def.key in company.attributes));
  const shownUnused = unused.filter((def) => def.label.toLowerCase().includes(query.trim().toLowerCase()));

  function save(def: AttributeDef, value: string) {
    companyActions.setAttribute(company.id, def.key, value);
    toast.success("Company attribute updated.");
  }

  function remove(def: AttributeDef) {
    companyActions.setAttribute(company.id, def.key, null);
    toast.success("Company attribute removed.");
  }

  return (
    <div className="grid gap-4">
      {used.length ? (
        <div className="divide-y rounded-lg border">
          {used.map((def) => (
            <AttributeItem
              key={`${company.id}-${def.key}`}
              def={def}
              value={company.attributes[def.key] ?? ""}
              used
              onSave={(v) => save(def, v)}
              onDelete={() => remove(def)}
            />
          ))}
        </div>
      ) : null}
      {unused.length ? (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-medium text-muted-foreground text-sm">
              {unused.length} unused {unused.length === 1 ? "attribute" : "attributes"}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <InputGroup className="h-8">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search attributes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          {shownUnused.length ? (
            <div className="divide-y rounded-lg border border-dashed">
              {shownUnused.map((def) => (
                <AttributeItem
                  key={`${company.id}-${def.key}-unused`}
                  def={def}
                  value=""
                  used={false}
                  onSave={(v) => save(def, v)}
                  onDelete={() => undefined}
                />
              ))}
            </div>
          ) : (
            <p className="flex h-11 items-center text-muted-foreground text-sm">No matching attributes found.</p>
          )}
        </>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Company attributes are managed in{" "}
        <Link href="/dashboard/settings/attributes" className="underline underline-offset-2 hover:text-foreground">
          Settings → Custom attributes
        </Link>
        .
      </p>
    </div>
  );
}

// ---------- Contacts ----------

function SummaryRow({
  label,
  badge,
  avatar,
  name,
  secondary,
}: {
  label: string;
  badge?: string;
  avatar: React.ReactNode;
  name: string;
  secondary?: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex h-5 items-center justify-between gap-2">
        <span className="text-sm">{label}</span>
        {badge ? (
          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 font-normal text-amber-600 dark:text-amber-400">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
        {avatar}
        <div className="grid min-w-0 gap-1">
          <span className="truncate font-medium text-sm leading-4">{name}</span>
          {secondary ? <span className="truncate text-muted-foreground text-sm leading-4">{secondary}</span> : null}
        </div>
      </div>
    </div>
  );
}

function ContactsTab({ company, linked }: { company: Company; linked: Contact[] }) {
  const companies = useCompanyStore((s) => s.companies);
  const links = useCompanyStore((s) => s.links);
  const [selected, setSelected] = React.useState<Contact | null>(null);
  const [comboOpen, setComboOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const PER_PAGE = 15;
  const pageCount = Math.max(Math.ceil(linked.length / PER_PAGE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = linked.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const options = contacts.filter((c) => links[c.id] !== company.id);
  const currentCompany = (contact: Contact) => companies.find((c) => c.id === links[contact.id]);

  return (
    <div className="grid gap-6">
      {selected ? (
        <div className="grid gap-4 rounded-lg border p-4">
          <div className="grid gap-1">
            <span className="font-medium">Link contact</span>
            <span className="text-muted-foreground text-sm">Confirm the company and contact before linking them.</span>
          </div>
          <SummaryRow
            label="Company"
            avatar={<CompanyAvatarSmall company={company} />}
            name={companyDisplayName(company)}
            secondary={company.domain}
          />
          <SummaryRow
            label="Contact"
            avatar={<ContactAvatar contact={selected} size="default" />}
            name={selected.name}
            secondary={contactMeta(selected)}
            badge={
              currentCompany(selected) ? `Currently linked to ${companyDisplayName(currentCompany(selected) as Company)}` : undefined
            }
          />
          <div className="mt-1 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const reassigned = Boolean(currentCompany(selected));
                companyActions.link(selected.id, company.id);
                setSelected(null);
                toast.success(reassigned ? "Contact reassigned to company." : "Contact linked to company.");
              }}
            >
              Link contact
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1">
            <span className="font-medium">Add contact</span>
            <span className="text-muted-foreground text-sm">
              Search for an existing contact and link it to this company.
            </span>
          </div>
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <UserPlus /> Add contact
                </span>
                <ChevronsUpDown className="opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
              <Command>
                <CommandInput placeholder="Search contacts..." />
                <CommandList>
                  <CommandEmpty>No contacts found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.name} ${c.email} ${c.phone}`}
                        onSelect={() => {
                          setSelected(c);
                          setComboOpen(false);
                        }}
                      >
                        <ContactAvatar contact={c} size="sm" className="[&_[data-slot=avatar-badge]]:hidden" />
                        <span className="min-w-0 flex-1 truncate">
                          {c.name} <span className="text-muted-foreground">· {c.email}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-sm">Contacts</span>
          {linked.length ? (
            <span className="text-muted-foreground text-xs tabular-nums">{contactsCountLabel(linked.length)}</span>
          ) : null}
        </div>
        {linked.length ? (
          <div className="divide-y rounded-lg border">
            {pageRows.map((contact) => (
              <div key={contact.id} className="group/contact flex items-center gap-2 px-3 py-2.5">
                <Link
                  href={`/dashboard/contacts/${contact.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary"
                >
                  <ContactAvatar contact={contact} size="default" />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm leading-5">{contact.name}</div>
                    <p className="truncate text-muted-foreground text-sm leading-5">{contactMeta(contact)}</p>
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Remove contact"
                  aria-label={`Remove ${contact.name}`}
                  className="opacity-70 sm:opacity-0 sm:group-hover/contact:opacity-100"
                  onClick={() => {
                    companyActions.link(contact.id, null);
                    toast.success("Contact removed from company.");
                  }}
                >
                  <Unlink />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {pageCount > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span className="text-muted-foreground tabular-nums">
              {current + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="xs"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
        {linked.length ? null : (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
            No contacts are linked to this company yet.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- History & Notes ----------

function useCompanyConversations(linked: Contact[]) {
  const meta = useCwStore((s) => s.meta);
  const sent = useCwStore((s) => s.sent);
  const deleted = useCwStore((s) => s.deleted);
  return baseConversations
    .filter((c) => !deleted.includes(c.id))
    .map((c) => ({ conversation: c, contact: linked.find((p) => p.id === contactIdOf(c.id)) }))
    .filter((row): row is { conversation: (typeof baseConversations)[number]; contact: Contact } => Boolean(row.contact))
    .map((row) => ({
      ...row,
      meta: meta[row.conversation.id],
      preview: lastPreview(row.conversation, meta[row.conversation.id], sent[row.conversation.id]).text,
    }));
}

type CompanyConversation = ReturnType<typeof useCompanyConversations>[number];

function HistoryTab({ own }: { own: CompanyConversation[] }) {
  if (own.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-muted-foreground text-sm">
        No conversations found for this company's contacts yet.
      </p>
    );
  }
  return (
    <div className="divide-y rounded-lg border">
      {own.map(({ conversation: c, contact, meta, preview }) => (
        <Link
          key={c.id}
          href={`/dashboard/chat?conversation=${c.id}`}
          className="grid gap-1 px-3 py-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 truncate font-medium">
              <ContactAvatar contact={contact} size="sm" className="[&_[data-slot=avatar-badge]]:hidden" />
              {contact.name} <span className="text-muted-foreground">#{c.id}</span>
            </span>
            <span className="shrink-0 text-muted-foreground text-xs">{c.time}</span>
          </div>
          <span className="truncate">{c.subject}</span>
          <span className="truncate text-muted-foreground">{preview}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 font-normal">
              <ChannelIcon channel={c.channel} className="size-3" />
              {inboxOf(c).name}
            </Badge>
            {meta && <StatusPill status={meta.status} />}
          </div>
        </Link>
      ))}
    </div>
  );
}

function NotesTab({ notes }: { notes: ReturnType<typeof companyNotesFor> }) {
  if (!notes.length) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-muted-foreground text-sm">
        No notes found for this company's contacts yet.
      </p>
    );
  }
  return (
    <div className="divide-y rounded-lg border">
      {notes.map((note) => {
        const contact = contacts.find((c) => c.id === note.contactId) as Contact;
        return (
          <div key={note.id} className="grid gap-2 px-3 py-3 text-sm">
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar size="sm" className={`size-4 ${personToneClass(contact.name)}`}>
                <AvatarFallback className="text-[8px]">{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="flex w-full min-w-0 items-center justify-between gap-1 text-muted-foreground">
                <Link
                  href={`/dashboard/contacts/${contact.id}`}
                  className="truncate font-medium text-foreground hover:underline"
                >
                  {contact.name}
                </Link>
                <span className="truncate text-xs">
                  <span className="font-medium">{note.author}</span> wrote{" "}
                  <span className="font-medium">{note.time}</span>
                </span>
              </div>
            </div>
            <p className="leading-relaxed">{note.body}</p>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Header pieces ----------

function CompanyAvatarSmall({ company }: { company: Company }) {
  const name = companyDisplayName(company);
  return (
    <Avatar className={`rounded-lg after:rounded-lg ${personToneClass(name)}`}>
      <AvatarFallback className="rounded-lg text-xs">{getInitials(name).slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}

function AvatarEditor({ company }: { company: Company }) {
  const [src, setSrc] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const name = companyDisplayName(company);
  return (
    <div className="group relative">
      <Avatar className={`size-18 rounded-xl after:rounded-xl ${personToneClass(name)}`}>
        {src ? <AvatarImage src={src} alt={name} className="rounded-xl" /> : null}
        <AvatarFallback className="rounded-xl font-medium text-2xl">{getInitials(name).slice(0, 2)}</AvatarFallback>
      </Avatar>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Change company avatar"
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Camera className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
            <Camera /> Upload avatar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!src}
            onSelect={() => {
              setSrc(null);
              toast.success("Company avatar removed.");
            }}
          >
            <Trash2 /> Remove avatar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setSrc(URL.createObjectURL(file));
          toast.success("Company avatar updated.");
          event.target.value = "";
        }}
      />
    </div>
  );
}

type Stat = { icon: typeof Inbox; label: string; value: string; note: string };

function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardTitle>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <stat.icon className="size-4" />
              </div>
            </CardTitle>
            <CardDescription>{stat.label}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{stat.value}</div>
            <p className="text-muted-foreground text-sm">{stat.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProfileForm({ company }: { company: Company }) {
  const [name, setName] = React.useState(company.name);
  const [domain, setDomain] = React.useState(company.domain);
  const [description, setDescription] = React.useState(company.description);
  const dirty = name !== company.name || domain !== company.domain || description !== company.description;

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !dirty) return;
        companyActions.update(company.id, { name: name.trim(), domain: domain.trim(), description: description.trim() });
        toast.success("Company updated.");
      }}
    >
      <span className="font-medium text-sm">Edit company details</span>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="edit-company-name">Name</Label>
          <Input
            id="edit-company-name"
            placeholder="Name"
            value={name}
            aria-invalid={!name.trim() || undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {!name.trim() ? <span className="text-destructive text-xs">Name is required</span> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-company-domain">Domain</Label>
          <Input
            id="edit-company-domain"
            placeholder="Domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Description</Label>
        <DescriptionField value={description} onChange={setDescription} />
      </div>
      <div>
        <Button size="sm" type="submit" disabled={!dirty || !name.trim()}>
          Update company
        </Button>
      </div>
    </form>
  );
}

// ---------- Page ----------

function NotFound() {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/companies">Companies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Building2 className="size-5" />
          </div>
          <span className="font-medium">Company not found</span>
          <span className="max-w-sm text-muted-foreground text-sm">
            This company may have been removed or is no longer available in this account.
          </span>
          <Button size="sm" variant="outline" asChild className="mt-2">
            <Link href="/dashboard/companies">Back to companies</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function CompanyProfile({ id, initialTab }: { id: number; initialTab?: string }) {
  const router = useRouter();
  const company = useCompanyStore((s) => s.companies.find((c) => c.id === id));
  const links = useCompanyStore((s) => s.links);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>(
    (["history", "notes", "contacts", "attributes"] as const).find((t) => t === initialTab) ?? "history",
  );
  const linked = company ? companyContacts(links, company.id) : [];
  const own = useCompanyConversations(linked);

  if (!company) return <NotFound />;

  const name = companyDisplayName(company);
  const activity = companyActivity(company, links);
  const notes = companyNotesFor(links, company.id);
  const open = own.filter(({ meta }) => meta?.status === "open").length;
  const inboxNames = [...new Set(own.map(({ conversation }) => inboxOf(conversation).name))];
  const attributeCount = companyAttributeDefs.filter((d) => d.key in company.attributes).length;

  const stats: Stat[] = [
    {
      icon: ContactIcon,
      label: "Contacts",
      value: String(linked.length),
      note: linked.length ? linked.map((c) => c.name).join(", ") : "No contacts linked yet",
    },
    {
      icon: MessagesSquare,
      label: "Conversations",
      value: String(own.length),
      note: own.length ? `Across ${inboxNames.join(", ")}` : "No conversations yet",
    },
    {
      icon: Inbox,
      label: "Open",
      value: String(open),
      note: open ? "Waiting on your team" : "Nothing waiting on your team",
    },
    {
      icon: Timer,
      label: "Last activity",
      value: activity.label || "--",
      note: `Created ${company.createdAt}`,
    },
  ];

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard/companies">Companies</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-4">
            <AvatarEditor company={company} />
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl leading-none tracking-tight">{name}</h1>
              <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
                {company.domain ? (
                  <>
                    <Globe className="size-3.5" />
                    <a
                      href={`https://${company.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground hover:underline"
                    >
                      {company.domain}
                    </a>
                    <span>•</span>
                  </>
                ) : null}
                <span>Created {company.createdAt}</span>
                {activity.label ? (
                  <>
                    <span>•</span>
                    <span>Last active {activity.label}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setTab("contacts")}>
              <UserPlus /> Add contact
            </Button>
          </div>
        </div>
      </div>

      <StatCards stats={stats} />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_480px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl leading-none">Company details</CardTitle>
            <CardDescription className="leading-snug">
              {company.description || "Add a short description so your team knows who this company is."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ProfileForm key={`${company.id}-${company.name}-${company.domain}-${company.description}`} company={company} />

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-1">
                <span className="font-medium text-sm">Danger zone</span>
                <span className="max-w-md text-muted-foreground text-sm">
                  Delete this company and unlink its contacts. The contacts will remain in the account.
                </span>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete company
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl leading-none">{name}</CardTitle>
            <CardDescription className="leading-snug">
              Conversations, notes and contacts of the people who work here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-4">
              <TabsList
                variant="line"
                className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
              >
                <TabsTrigger value="history">
                  History
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {own.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="notes">
                  Notes
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {notes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="contacts">
                  Contacts
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {linked.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="attributes">
                  Attributes
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {attributeCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="history">
                <HistoryTab own={own} />
              </TabsContent>
              <TabsContent value="notes">
                <NotesTab notes={notes} />
              </TabsContent>
              <TabsContent value="contacts">
                <ContactsTab company={company} linked={linked} />
              </TabsContent>
              <TabsContent value="attributes">
                <AttributesTab company={company} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <DeleteCompanyDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        companyName={name}
        onConfirm={() => {
          companyActions.remove([company.id]);
          toast.success("Company deleted.");
          router.push("/dashboard/companies");
        }}
      />
    </div>
  );
}

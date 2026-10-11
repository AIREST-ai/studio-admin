"use client";
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { Camera, ChevronsUpDown, Unlink } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";

import { DeleteCompanyDialog, DescriptionField } from "./company-dialogs";
import {
  type Company,
  type CompanyContact,
  companyContacts,
  companyConversations,
  companyNotes,
  contactSearchPool,
  contactsCountLabel,
  toneFor,
} from "./data";

function statusVariant(status: string) {
  if (status === "Open") return "default" as const;
  if (status === "Pending") return "outline" as const;
  return "secondary" as const;
}

function HistoryTab() {
  return (
    <div className="divide-y">
      {companyConversations.map((c) => (
        <Link
          key={c.id}
          href="/dashboard/chat"
          className="grid gap-1.5 rounded-lg px-2 py-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <Avatar className="size-5">
                <AvatarFallback className={cn("text-[9px]", toneFor(c.id))}>{getInitials(c.contact)}</AvatarFallback>
              </Avatar>
              {c.contact} <span className="font-normal text-muted-foreground">#{c.id}</span>
            </span>
            <span className="text-muted-foreground text-xs">{c.time}</span>
          </div>
          <span className="truncate text-muted-foreground">{c.preview}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-normal">
              {c.inbox}
            </Badge>
            <Badge variant={statusVariant(c.status)} className="font-normal">
              {c.status}
            </Badge>
            {c.labels.map((label) => (
              <Badge key={label} variant="secondary" className="font-normal">
                {label}
              </Badge>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

function NotesTab() {
  return (
    <div className="divide-y">
      {companyNotes.map((note) => (
        <div key={note.id} className="grid gap-2 py-4 text-sm first:pt-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-4">
              <AvatarFallback className={cn("text-[8px]", toneFor(note.id))}>
                {getInitials(note.contact)}
              </AvatarFallback>
            </Avatar>
            <div className="flex w-full min-w-0 items-center justify-between gap-1 text-muted-foreground">
              <Link href="/dashboard/contacts" className="truncate font-medium text-foreground hover:underline">
                {note.contact}
              </Link>
              <span className="truncate text-xs">
                <span className="font-medium">{note.author}</span> wrote{" "}
                <span className="font-medium">{note.time}</span>
              </span>
            </div>
          </div>
          <p className="leading-relaxed">{note.body}</p>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({
  label,
  badge,
  name,
  secondary,
  tone,
}: {
  label: string;
  badge?: string;
  name: string;
  secondary?: string;
  tone: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex h-5 items-center justify-between gap-2">
        <span className="text-sm">{label}</span>
        {badge ? (
          <Badge variant="secondary" className="font-normal">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
        <Avatar className="size-8">
          <AvatarFallback className={cn("text-xs", tone)}>{getInitials(name).slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 gap-1">
          <span className="truncate font-medium text-sm leading-4">{name}</span>
          {secondary ? <span className="truncate text-muted-foreground text-sm leading-4">{secondary}</span> : null}
        </div>
      </div>
    </div>
  );
}

function contactMeta(contact: CompanyContact) {
  return [contact.email, contact.phone].filter(Boolean).join(" • ");
}

function ContactsTab({ company }: { company: Company }) {
  const [linked, setLinked] = React.useState<CompanyContact[]>(companyContacts);
  const [selected, setSelected] = React.useState<(typeof contactSearchPool)[number] | null>(null);
  const [comboOpen, setComboOpen] = React.useState(false);

  const options = contactSearchPool.filter((c) => !linked.some((l) => l.id === c.id));

  return (
    <div className="grid gap-6">
      {selected ? (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <span className="font-medium">Link contact</span>
            <span className="text-muted-foreground text-sm">Confirm the company and contact before linking them.</span>
          </div>
          <SummaryRow label="Company" name={company.name} secondary={company.domain} tone={toneFor(company.id)} />
          <SummaryRow
            label="Contact"
            name={selected.name}
            secondary={contactMeta(selected)}
            badge={selected.company ? `Currently linked to ${selected.company}` : undefined}
            tone={toneFor(selected.id)}
          />
          <div className="mt-1 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setLinked((prev) => [selected, ...prev]);
                setSelected(null);
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
                Add contact
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
                        <span className="truncate">{[c.name, c.email, c.phone].filter(Boolean).join(" · ")}</span>
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
          <div className="divide-y">
            {linked.map((contact) => (
              <div key={contact.id} className="group/contact flex items-center gap-2 py-3">
                <Link
                  href={`/dashboard/contacts/${contact.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className={cn("text-xs", toneFor(contact.id))}>
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm leading-5">{contact.name}</div>
                    <p className="truncate text-muted-foreground text-sm leading-5">{contactMeta(contact)}</p>
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Remove contact"
                  aria-label="Remove contact"
                  className="opacity-70 sm:opacity-0 sm:group-hover/contact:opacity-100"
                  onClick={() => setLinked((prev) => prev.filter((c) => c.id !== contact.id))}
                >
                  <Unlink />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
            No contacts are linked to this company yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function CompanyDetails({ company }: { company: Company }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/companies">Companies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{company.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardContent className="grid gap-8">
            <div className="grid justify-items-start gap-3">
              <div className="group relative">
                <Avatar className="size-18 rounded-xl">
                  <AvatarFallback className={cn("rounded-xl font-medium text-xl", toneFor(company.id))}>
                    {getInitials(company.name).slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  aria-label="Upload avatar"
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Camera className="size-5" />
                </button>
              </div>
              <div className="grid gap-1">
                <h1 className="font-medium text-base">{company.name}</h1>
                <span className="text-muted-foreground text-sm leading-6">
                  Created {company.createdAt} • Last active {company.lastActivity}
                </span>
              </div>
            </div>

            <div className="grid gap-6">
              <span className="font-medium text-sm">Edit company details</span>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input placeholder="Name" defaultValue={company.name} />
                <Input placeholder="Domain" defaultValue={company.domain} />
              </div>
              <DescriptionField defaultValue={company.description} />
              <div>
                <Button size="sm">Update company</Button>
              </div>
            </div>

            <Separator />

            <div className="grid justify-items-start gap-4">
              <div className="grid gap-2">
                <span className="font-medium text-base">Danger zone</span>
                <span className="text-muted-foreground text-sm">
                  Delete this company and unlink its contacts. The contacts will remain in the account.
                </span>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete company
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardContent className="px-4">
            <Tabs defaultValue="history">
              <TabsList className="w-full">
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="contacts">Contacts ({company.contactsCount})</TabsTrigger>
              </TabsList>
              <TabsContent value="history" className="pt-2">
                <HistoryTab />
              </TabsContent>
              <TabsContent value="notes" className="pt-2">
                <NotesTab />
              </TabsContent>
              <TabsContent value="contacts" className="pt-3">
                <ContactsTab company={company} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <DeleteCompanyDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        companyName={company.name}
        onConfirm={() => router.push("/dashboard/companies")}
      />
    </div>
  );
}

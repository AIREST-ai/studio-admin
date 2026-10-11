"use client";
// Layout mirrors users/_components/users-roles.tsx (page heading + line tabs with count pills),
// users/_components/users.tsx (card header, action row, filter chips, selected + view toggle)
// and users/_components/users-table.tsx (table + pagination). Chatwoot features kept:
// search, advanced filter, sort/order, add / import / export dialogs, row selection.
import * as React from "react";

import Link from "next/link";

import {
  Cog,
  Download,
  Grid,
  ListFilter,
  MapPin,
  MoreHorizontal,
  Plus,
  Rows3,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AddContactDialog, ExportContactsDialog, ImportContactsDialog } from "./contact-dialogs";
import { type Contact, contacts, sortOptions } from "./data";
import { ContactAvatar, contactStatus, LabelBadge, PageHeading, StatusBadge } from "./studio-ui";

type SortKey = "name" | "email" | "phone_number" | "company" | "country" | "city" | "last_activity_at" | "created_at";
type View = "all" | "active" | "tagged" | "untagged";
type ColumnKey = "phone" | "company" | "location" | "labels" | "status" | "lastActivity";

const columnLabels: Record<ColumnKey, string> = {
  phone: "Phone number",
  company: "Company",
  location: "City",
  labels: "Labels",
  status: "Status",
  lastActivity: "Last activity",
};

const countryOptions = ["All", ...Array.from(new Set(contacts.map((c) => c.country)))];
const labelOptions = ["All", ...Array.from(new Set(contacts.flatMap((c) => c.labels)))];
const activityOptions = ["Any", "Last 24 hours", "Last 7 days", "Older"];
const inboxOptions = ["All", "WhatsApp", "Instagram", "Website", "Email"];

const views: { value: View; label: string; match: (c: Contact) => boolean }[] = [
  { value: "all", label: "All contacts", match: () => true },
  { value: "active", label: "Active", match: (c) => contactStatus(c) === "Active" },
  { value: "tagged", label: "Tagged", match: (c) => c.labels.length > 0 },
  { value: "untagged", label: "Untagged", match: (c) => c.labels.length === 0 },
];

function sortValue(contact: Contact, key: SortKey): string | number {
  switch (key) {
    case "email":
      return contact.email;
    case "phone_number":
      return contact.phone;
    case "company":
      return contact.company;
    case "country":
      return contact.country;
    case "city":
      return contact.city;
    case "last_activity_at":
      return contact.lastActivityMinutes;
    case "created_at":
      return contact.id;
    default:
      return contact.name;
  }
}

function matchesActivity(contact: Contact, value: string) {
  if (value === "Last 24 hours") return contact.lastActivityMinutes < 24 * 60;
  if (value === "Last 7 days") return contact.lastActivityMinutes < 7 * 24 * 60;
  if (value === "Older") return contact.lastActivityMinutes >= 7 * 24 * 60;
  return true;
}

function ChipSelect({
  label,
  value,
  options,
  onChange,
  align = "start",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  align?: "start" | "end";
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align={align}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function FilterPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter /> Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="grid gap-3">
          <span className="font-medium text-sm">Filter contacts</span>
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
            <NativeSelect size="sm" className="w-full" defaultValue="country">
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="phone_number">Phone number</option>
              <option value="identifier">Identifier</option>
              <option value="country">Country</option>
              <option value="city">City</option>
              <option value="company">Company</option>
              <option value="created_at">Created at</option>
              <option value="last_activity">Last activity</option>
              <option value="blocked">Blocked</option>
            </NativeSelect>
            <NativeSelect size="sm" className="w-full" defaultValue="equal_to">
              <option value="equal_to">Equal to</option>
              <option value="not_equal_to">Not equal to</option>
              <option value="contains">Contains</option>
            </NativeSelect>
            <NativeSelect size="sm" className="w-full" defaultValue="Qatar">
              <option>Qatar</option>
              <option>United Arab Emirates</option>
              <option>Saudi Arabia</option>
            </NativeSelect>
          </div>
          <Button variant="link" size="sm" className="w-fit px-0">
            Add filter
          </Button>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm">
              Clear filters
            </Button>
            <Button size="sm">Apply filters</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RowActions({ contact }: { contact: Contact }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${contact.name}`}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/contacts/${contact.id}`}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/chat">Send message</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/contacts/${contact.id}`}>Merge contact</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" asChild>
          <Link href={`/dashboard/contacts/${contact.id}`}>Delete contact</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ContactsList() {
  const [view, setView] = React.useState<View>("all");
  const [query, setQuery] = React.useState("");
  const [country, setCountry] = React.useState("All");
  const [label, setLabel] = React.useState("All");
  const [activity, setActivity] = React.useState("Any");
  const [inbox, setInbox] = React.useState("All");
  const [sort, setSort] = React.useState<SortKey>("last_activity_at");
  const [order, setOrder] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [layout, setLayout] = React.useState("list");
  const [hidden, setHidden] = React.useState<ColumnKey[]>([]);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [dialog, setDialog] = React.useState<"add" | "import" | "export" | null>(null);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const viewMatch = views.find((v) => v.value === view)?.match ?? (() => true);
    const filtered = contacts.filter(
      (c) =>
        viewMatch(c) &&
        (!q || [c.name, c.email, c.phone, c.company].some((v) => v.toLowerCase().includes(q))) &&
        (country === "All" || c.country === country) &&
        (label === "All" || c.labels.includes(label)) &&
        matchesActivity(c, activity),
    );
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort);
      const bv = sortValue(b, sort);
      const result = typeof av === "number" ? av - (bv as number) : av.localeCompare(bv as string);
      return order === "asc" ? result : -result;
    });
  }, [view, query, country, label, activity, sort, order]);

  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));
  const show = (key: ColumnKey) => !hidden.includes(key);

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function chip(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(0);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Contacts" subtitle="Everyone who has talked to your team, across every inbox." />

      <Tabs
        className="gap-4"
        value={view}
        onValueChange={(value) => {
          setView(value as View);
          setPage(0);
        }}
      >
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          {views.map((v) => (
            <TabsTrigger key={v.value} value={v.value}>
              {v.label}
              <Badge variant="secondary" className="ms-1 tabular-nums">
                {contacts.filter(v.match).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Contacts</CardTitle>
          <CardDescription className="max-w-sm leading-snug">Manage your customers and leads.</CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                placeholder="Search contacts..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
              <InputGroupAddon align="inline-end">
                <Kbd className="h-4 text-[10px]">⌘K</Kbd>
              </InputGroupAddon>
            </InputGroup>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal /> Hide
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                {(Object.keys(columnLabels) as ColumnKey[]).map((key) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={show(key)}
                    onCheckedChange={(checked) =>
                      setHidden((prev) => (checked ? prev.filter((k) => k !== key) : [...prev, key]))
                    }
                  >
                    {columnLabels[key]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Cog /> Customize
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  {sortOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Ordering</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={order} onValueChange={(v) => setOrder(v as "asc" | "desc")}>
                  <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setDialog("export")}>
                  <Download /> Export contacts
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("import")}>
                  <Upload /> Import contacts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={() => setDialog("add")}>
              <Plus /> Add contact
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <ChipSelect label="Country" value={country} options={countryOptions} onChange={chip(setCountry)} />
              <ChipSelect label="Label" value={label} options={labelOptions} onChange={chip(setLabel)} />
              <ChipSelect
                label="Last activity"
                value={activity}
                options={activityOptions}
                onChange={chip(setActivity)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterPopover />
              <ChipSelect label="Inbox" value={inbox} options={inboxOptions} onChange={setInbox} align="end" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4">
            <div className="text-muted-foreground text-sm tabular-nums">{selected.length} selected</div>
            <Tabs value={layout} onValueChange={setLayout}>
              <TabsList>
                <TabsTrigger value="list" aria-label="List view">
                  <Rows3 />
                </TabsTrigger>
                <TabsTrigger value="grid" aria-label="Grid view">
                  <Grid />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {layout === "grid" ? (
            <div className="grid gap-3 border-t px-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              {pageRows.map((contact) => (
                <div key={contact.id} className="flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/contacts/${contact.id}`} className="flex min-w-0 items-center gap-3">
                      <ContactAvatar contact={contact} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm">{contact.name}</div>
                        <div className="truncate text-muted-foreground text-sm">{contact.email}</div>
                      </div>
                    </Link>
                    <RowActions contact={contact} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={contactStatus(contact)} />
                    {contact.labels.map((l) => (
                      <LabelBadge key={l} label={l} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader className="[&_tr]:border-t">
                <TableRow>
                  <TableHead className="w-10 py-4 font-normal">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        aria-label="Select all contacts"
                        checked={allOnPage}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? Array.from(new Set([...prev, ...pageRows.map((r) => r.id)]))
                              : prev.filter((id) => !pageRows.some((r) => r.id === id)),
                          )
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="py-4 font-normal">Contact</TableHead>
                  {show("phone") ? <TableHead className="py-4 font-normal">Phone number</TableHead> : null}
                  {show("company") ? <TableHead className="py-4 font-normal">Company / City</TableHead> : null}
                  {show("labels") ? <TableHead className="py-4 font-normal">Labels</TableHead> : null}
                  {show("status") ? <TableHead className="py-4 font-normal">Status</TableHead> : null}
                  {show("lastActivity") ? <TableHead className="py-4 font-normal">Last activity</TableHead> : null}
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length ? (
                  pageRows.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="border-border/60 hover:bg-white/2.5"
                      data-state={selected.includes(contact.id) ? "selected" : undefined}
                    >
                      <TableCell className="px-3 py-4 align-middle">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            aria-label={`Select ${contact.name}`}
                            checked={selected.includes(contact.id)}
                            onCheckedChange={(checked) => toggle(contact.id, checked === true)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-4 align-middle">
                        <Link href={`/dashboard/contacts/${contact.id}`} className="flex items-center gap-3">
                          <ContactAvatar contact={contact} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground text-sm">{contact.name}</div>
                            <div className="truncate text-muted-foreground text-sm">{contact.email}</div>
                          </div>
                        </Link>
                      </TableCell>
                      {show("phone") ? (
                        <TableCell className="px-3 py-4 align-middle">
                          <span className="whitespace-nowrap text-sm tabular-nums">{contact.phone}</span>
                        </TableCell>
                      ) : null}
                      {show("company") ? (
                        <TableCell className="px-3 py-4 align-middle">
                          <div className="grid gap-0.5">
                            <span className="whitespace-nowrap">
                              {contact.company || <span className="text-muted-foreground">---</span>}
                            </span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                              <MapPin className="size-3" />
                              {contact.city}, {contact.country}
                            </span>
                          </div>
                        </TableCell>
                      ) : null}
                      {show("labels") ? (
                        <TableCell className="px-3 py-4 align-middle">
                          <div className="flex flex-wrap gap-1.5">
                            {contact.labels.length ? (
                              contact.labels.map((l) => <LabelBadge key={l} label={l} />)
                            ) : (
                              <span className="text-muted-foreground text-sm">---</span>
                            )}
                          </div>
                        </TableCell>
                      ) : null}
                      {show("status") ? (
                        <TableCell className="px-3 py-4 align-middle">
                          <StatusBadge status={contactStatus(contact)} />
                        </TableCell>
                      ) : null}
                      {show("lastActivity") ? (
                        <TableCell className="px-3 py-4 align-middle">
                          <div className="text-foreground text-sm">{contact.lastActivity}</div>
                        </TableCell>
                      ) : null}
                      <TableCell className="px-3 py-4 align-middle">
                        <div className="text-right">
                          <RowActions contact={contact} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No contacts matches your search
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <Separator />

          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(0);
                  }}
                >
                  <SelectTrigger size="sm" className="w-20" id="contacts-rows-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectGroup>
                      {[5, 10, 20, 50].map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <span>
                Page {current + 1} of {pageCount}
              </span>
            </div>

            <Pagination className="mx-0 w-auto justify-start md:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text=""
                    className={current === 0 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage(current - 1);
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={i === current}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(i);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text=""
                    className={current >= pageCount - 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage(current + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <AddContactDialog open={dialog === "add"} onOpenChange={(open) => setDialog(open ? "add" : null)} />
      <ImportContactsDialog open={dialog === "import"} onOpenChange={(open) => setDialog(open ? "import" : null)} />
      <ExportContactsDialog open={dialog === "export"} onOpenChange={(open) => setDialog(open ? "export" : null)} />
    </div>
  );
}

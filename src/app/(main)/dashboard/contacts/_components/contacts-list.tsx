"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  EllipsisVertical,
  ListFilter,
  MapPin,
  Phone,
  Search,
  Upload,
  UserPlus,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

import { AddContactDialog, ExportContactsDialog, ImportContactsDialog } from "./contact-dialogs";
import { type Contact, contacts, sortOptions, toneFor } from "./data";

const PAGE_SIZE = 8;

type SortKey = "name" | "email" | "phone_number" | "company" | "country" | "city" | "last_activity_at" | "created_at";

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

function FilterPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Filter contacts">
          <ListFilter />
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

export function ContactsList() {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("last_activity_at");
  const [order, setOrder] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [dialog, setDialog] = React.useState<"add" | "import" | "export" | null>(null);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? contacts.filter((c) => [c.name, c.email, c.phone, c.company].some((v) => v.toLowerCase().includes(q)))
      : contacts;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort);
      const bv = sortValue(b, sort);
      const result = typeof av === "number" ? av - (bv as number) : av.localeCompare(bv as string);
      return order === "asc" ? result : -result;
    });
  }, [query, sort, order]);

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const start = rows.length ? current * PAGE_SIZE + 1 : 0;
  const end = current * PAGE_SIZE + pageRows.length;
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="self-center text-xl leading-none">Contacts</CardTitle>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                type="search"
                placeholder="Search..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </InputGroup>
            <FilterPopover />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Sort by">
                  <ArrowDownUp />
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
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setDialog("add")}>
                  <UserPlus /> Add contact
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("export")}>
                  <Download /> Export contacts
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("import")}>
                  <Upload /> Import contacts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="mx-1 h-4 data-[orientation=vertical]:h-4" />
            <Button size="sm" asChild>
              <Link href="/dashboard/chat">Message</Link>
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          <div className="px-4 text-muted-foreground text-sm tabular-nums">{selected.length} selected</div>
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader className="[&_tr]:border-t">
              <TableRow>
                <TableHead className="w-10 py-4">
                  <Checkbox
                    aria-label="Select all"
                    checked={allOnPage}
                    onCheckedChange={(checked) =>
                      setSelected((prev) =>
                        checked
                          ? Array.from(new Set([...prev, ...pageRows.map((r) => r.id)]))
                          : prev.filter((id) => !pageRows.some((r) => r.id === id)),
                      )
                    }
                  />
                </TableHead>
                <TableHead className="py-4 font-normal">Name</TableHead>
                <TableHead className="py-4 font-normal">Phone number</TableHead>
                <TableHead className="py-4 font-normal">Company</TableHead>
                <TableHead className="py-4 font-normal">City</TableHead>
                <TableHead className="py-4 font-normal">Last activity</TableHead>
                <TableHead className="w-28 py-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? (
                pageRows.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className="border-border/60"
                    data-state={selected.includes(contact.id) ? "selected" : undefined}
                  >
                    <TableCell className="py-4">
                      <Checkbox
                        aria-label={`Select ${contact.name}`}
                        checked={selected.includes(contact.id)}
                        onCheckedChange={(checked) => toggle(contact.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell className="py-4">
                      <Link href={`/dashboard/contacts/${contact.id}`} className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className={cn("font-medium text-xs", toneFor(contact.id))}>
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <span className="font-medium">{contact.name}</span>
                          <span className="text-muted-foreground text-xs">{contact.email}</span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                        <Phone className="size-3.5 text-muted-foreground" />
                        {contact.phone}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      {contact.company || <span className="text-muted-foreground">---</span>}
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        {contact.city}, {contact.country}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {contact.lastActivity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/contacts/${contact.id}`}>View details</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No contacts matches your search
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex items-center justify-between px-4">
            <span className="text-muted-foreground text-sm tabular-nums">
              Showing {start} - {end} of {rows.length} contacts
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="text-sm tabular-nums">
                {current + 1} <span className="text-muted-foreground">of</span> {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddContactDialog open={dialog === "add"} onOpenChange={(open) => setDialog(open ? "add" : null)} />
      <ImportContactsDialog open={dialog === "import"} onOpenChange={(open) => setDialog(open ? "import" : null)} />
      <ExportContactsDialog open={dialog === "export"} onOpenChange={(open) => setDialog(open ? "export" : null)} />
    </>
  );
}

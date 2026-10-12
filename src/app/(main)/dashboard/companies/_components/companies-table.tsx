"use client";
// Companies in the Studio pattern, built like the approved Contacts page (contacts/_components/contacts-list.tsx):
// page heading, line tabs with counts, card with search + actions, filter chips, table with a "..." menu per row,
// list / grid toggle and pagination. Chatwoot v4.18 features kept: search companies, Sort by (Name, Domain,
// Created at, Last activity, Contacts count) + Order, Add company dialog, company cards (grid view), "Showing x – y
// of n companies" footer, "No companies found" empty state.
import * as React from "react";

import Link from "next/link";

import { Building2, Cog, Contact, EllipsisVertical, Globe, Grid, MoreHorizontal, Plus, Rows3, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ContactAvatar, PageHeading } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { type Company, companyDisplayName, contactsCountLabel, type SortKey, sortOptions } from "./company-data";
import { CreateCompanyDialog, DeleteCompanyDialog } from "./company-dialogs";
import { companyActions, companyActivity, companyContacts, useCompanyStore } from "./company-store";
import { CompanyAvatar, IndustryBadge } from "./company-ui";

type View = "all" | "with" | "without";
type ColumnKey = "description" | "contacts" | "industry" | "created" | "lastActivity";

const columnLabels: Record<ColumnKey, string> = {
  description: "Description",
  contacts: "Contacts",
  industry: "Industry",
  created: "Created at",
  lastActivity: "Last activity",
};

const activityOptions = ["Any", "Last 24 hours", "Last 7 days", "Older"];
const contactsOptions = ["Any", "1 or more", "None"];

type Row = Company & { contactsCount: number; activity: { label: string; minutes: number } };

const views: { value: View; label: string; match: (c: Row) => boolean }[] = [
  { value: "all", label: "All companies", match: () => true },
  { value: "with", label: "With contacts", match: (c) => c.contactsCount > 0 },
  { value: "without", label: "No contacts", match: (c) => c.contactsCount === 0 },
];

function sortValue(company: Row, key: SortKey): string | number {
  switch (key) {
    case "domain":
      return company.domain;
    case "created_at":
      return company.createdOrder;
    case "last_activity_at":
      return company.activity.minutes;
    case "contacts_count":
      return company.contactsCount;
    default:
      return companyDisplayName(company);
  }
}

function matchesActivity(minutes: number, value: string) {
  if (value === "Last 24 hours") return minutes < 24 * 60;
  if (value === "Last 7 days") return minutes < 7 * 24 * 60;
  if (value === "Older") return minutes >= 7 * 24 * 60;
  return true;
}

// Chatwoot shows the relative time with the exact timestamp in a tooltip (useExactTimestamp).
function exactTimestamp(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ActivityTime({ activity }: { activity: { label: string; minutes: number } }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="whitespace-nowrap text-sm">{activity.label}</span>
      </TooltipTrigger>
      <TooltipContent>{exactTimestamp(activity.minutes)}</TooltipContent>
    </Tooltip>
  );
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

function RowActions({ company, onDelete }: { company: Row; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${companyDisplayName(company)}`}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/companies/${company.id}`}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/companies/${company.id}?tab=contacts`}>Add contact</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Delete company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContactsStack({ company }: { company: Row }) {
  const links = useCompanyStore((s) => s.links);
  const people = companyContacts(links, company.id);
  if (!people.length) return <span className="text-muted-foreground text-sm">---</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2 *:ring-2 *:ring-card">
        {people.slice(0, 3).map((person) => (
          <ContactAvatar key={person.id} contact={person} size="sm" className="[&_[data-slot=avatar-badge]]:hidden" />
        ))}
      </div>
      <span className="whitespace-nowrap text-sm">{contactsCountLabel(people.length)}</span>
    </div>
  );
}

// Chatwoot CompaniesCard: name, contacts count, domain and last activity, clicking opens the company.
function CompanyCard({ company, onDelete }: { company: Row; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/dashboard/companies/${company.id}`} className="flex min-w-0 items-center gap-3">
          <CompanyAvatar company={company} />
          <div className="min-w-0">
            <div className="truncate font-medium text-sm">{companyDisplayName(company)}</div>
            <div className="flex items-center gap-1 truncate text-muted-foreground text-sm">
              {company.domain ? (
                <>
                  <Globe className="size-3.5 shrink-0" />
                  <span className="truncate">{company.domain}</span>
                </>
              ) : (
                "---"
              )}
            </div>
          </div>
        </Link>
        <RowActions company={company} onDelete={onDelete} />
      </div>
      <div className="flex items-center justify-between gap-2 text-muted-foreground text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Contact className="size-3.5" />
          {company.contactsCount ? contactsCountLabel(company.contactsCount) : "No contacts"}
        </span>
        <ActivityTime activity={company.activity} />
      </div>
      {company.attributes.industry ? (
        <div>
          <IndustryBadge industry={company.attributes.industry} />
        </div>
      ) : null}
    </div>
  );
}

export function CompaniesTable() {
  const companies = useCompanyStore((s) => s.companies);
  const links = useCompanyStore((s) => s.links);
  const [view, setView] = React.useState<View>("all");
  const [query, setQuery] = React.useState("");
  const [activity, setActivity] = React.useState("Any");
  const [industry, setIndustry] = React.useState("All");
  const [hasContacts, setHasContacts] = React.useState("Any");
  const [sort, setSort] = React.useState<SortKey>("last_activity_at");
  const [order, setOrder] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);
  const [layout, setLayout] = React.useState("list");
  const [hidden, setHidden] = React.useState<ColumnKey[]>([]);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  const all: Row[] = React.useMemo(
    () =>
      companies.map((c) => ({
        ...c,
        contactsCount: companyContacts(links, c.id).length,
        activity: companyActivity(c, links),
      })),
    [companies, links],
  );

  const industryOptions = React.useMemo(
    () => ["All", ...Array.from(new Set(all.map((c) => c.attributes.industry).filter(Boolean))).sort()],
    [all],
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const viewMatch = views.find((v) => v.value === view)?.match ?? (() => true);
    const filtered = all.filter(
      (c) =>
        viewMatch(c) &&
        (!q || [c.name, c.domain].some((v) => v.toLowerCase().includes(q))) &&
        matchesActivity(c.activity.minutes, activity) &&
        (industry === "All" || c.attributes.industry === industry) &&
        (hasContacts === "Any" || (hasContacts === "None" ? c.contactsCount === 0 : c.contactsCount > 0)),
    );
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort);
      const bv = sortValue(b, sort);
      const result = typeof av === "number" ? av - (bv as number) : av.localeCompare(bv as string);
      return order === "asc" ? result : -result;
    });
  }, [all, view, query, activity, industry, hasContacts, sort, order]);

  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);
  const start = rows.length ? current * pageSize + 1 : 0;
  const end = current * pageSize + pageRows.length;
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));
  const show = (key: ColumnKey) => !hidden.includes(key);
  const filtersOn = activity !== "Any" || industry !== "All" || hasContacts !== "Any" || query.trim() !== "";

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function chip(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(0);
    };
  }

  function clearFilters() {
    setQuery("");
    setActivity("Any");
    setIndustry("All");
    setHasContacts("Any");
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Companies" subtitle="The businesses your contacts work for, with their people and history." />

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
                {all.filter(v.match).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Companies</CardTitle>
          <CardDescription className="max-w-sm leading-snug">
            Link contacts to a company to see all of its conversations in one place.
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <InputGroup className="h-7 w-full md:w-64">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-7"
                type="search"
                placeholder="Search companies..."
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
                <DropdownMenuLabel>Order</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={order} onValueChange={(v) => setOrder(v as "asc" | "desc")}>
                  <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                  <Plus /> Add company
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> Add company
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <ChipSelect label="Industry" value={industry} options={industryOptions} onChange={chip(setIndustry)} />
              <ChipSelect label="Contacts" value={hasContacts} options={contactsOptions} onChange={chip(setHasContacts)} />
              <ChipSelect
                label="Last activity"
                value={activity}
                options={activityOptions}
                onChange={chip(setActivity)}
              />
            </div>
            {filtersOn ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
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

          {pageRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 border-t px-4 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <Building2 className="size-5" />
              </div>
              <span className="font-medium text-sm">No companies found</span>
              {filtersOn ? (
                <Button variant="link" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : layout === "grid" ? (
            <div className="grid gap-3 border-t px-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              {pageRows.map((company) => (
                <CompanyCard key={company.id} company={company} onDelete={() => setDeleting(company)} />
              ))}
            </div>
          ) : (
            <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader className="[&_tr]:border-t">
                <TableRow>
                  <TableHead className="w-10 py-4 font-normal">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        aria-label="Select all companies"
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
                  <TableHead className="py-4 font-normal">Company</TableHead>
                  {show("description") ? <TableHead className="py-4 font-normal">Description</TableHead> : null}
                  {show("contacts") ? <TableHead className="py-4 font-normal">Contacts</TableHead> : null}
                  {show("industry") ? <TableHead className="py-4 font-normal">Industry</TableHead> : null}
                  {show("created") ? <TableHead className="py-4 font-normal">Created at</TableHead> : null}
                  {show("lastActivity") ? <TableHead className="py-4 font-normal">Last activity</TableHead> : null}
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((company) => (
                  <TableRow
                    key={company.id}
                    className="border-border/60 hover:bg-white/2.5"
                    data-state={selected.includes(company.id) ? "selected" : undefined}
                  >
                    <TableCell className="px-3 py-4 align-middle">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          aria-label={`Select ${companyDisplayName(company)}`}
                          checked={selected.includes(company.id)}
                          onCheckedChange={(checked) => toggle(company.id, checked === true)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-4 align-middle">
                      <Link href={`/dashboard/companies/${company.id}`} className="flex items-center gap-3">
                        <CompanyAvatar company={company} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground text-sm">
                            {companyDisplayName(company)}
                          </div>
                          <div className="flex items-center gap-1 truncate text-muted-foreground text-sm">
                            {company.domain ? (
                              <>
                                <Globe className="size-3 shrink-0" />
                                {company.domain}
                              </>
                            ) : (
                              "---"
                            )}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    {show("description") ? (
                      <TableCell className="max-w-72 px-3 py-4 align-middle">
                        <p className="line-clamp-2 whitespace-normal text-muted-foreground text-sm">
                          {company.description || "---"}
                        </p>
                      </TableCell>
                    ) : null}
                    {show("contacts") ? (
                      <TableCell className="px-3 py-4 align-middle">
                        <ContactsStack company={company} />
                      </TableCell>
                    ) : null}
                    {show("industry") ? (
                      <TableCell className="px-3 py-4 align-middle">
                        {company.attributes.industry ? (
                          <IndustryBadge industry={company.attributes.industry} />
                        ) : (
                          <span className="text-muted-foreground text-sm">---</span>
                        )}
                      </TableCell>
                    ) : null}
                    {show("created") ? (
                      <TableCell className="px-3 py-4 align-middle">
                        <span className="whitespace-nowrap text-sm">{company.createdAt}</span>
                      </TableCell>
                    ) : null}
                    {show("lastActivity") ? (
                      <TableCell className="px-3 py-4 align-middle">
                        <ActivityTime activity={company.activity} />
                      </TableCell>
                    ) : null}
                    <TableCell className="px-3 py-4 align-middle">
                      <div className="text-right">
                        <RowActions company={company} onDelete={() => setDeleting(company)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
              <span className="tabular-nums">
                Showing {start} – {end} of {rows.length} {rows.length === 1 ? "company" : "companies"}
              </span>
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(0);
                  }}
                >
                  <SelectTrigger size="sm" className="w-20" id="companies-rows-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectGroup>
                      {[5, 10, 25, 50].map((size) => (
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

      <CreateCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(input) => {
          companyActions.create(input);
          setView("all");
          setSort("last_activity_at");
          setOrder("asc");
          setPage(0);
          toast.success("Company created.");
        }}
      />
      <DeleteCompanyDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        companyName={deleting ? companyDisplayName(deleting) : ""}
        onConfirm={() => {
          if (!deleting) return;
          companyActions.remove([deleting.id]);
          setSelected((prev) => prev.filter((id) => id !== deleting.id));
          setDeleting(null);
          toast.success("Company deleted.");
        }}
      />
    </div>
  );
}

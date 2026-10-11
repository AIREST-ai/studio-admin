"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { ArrowDownUp, ChevronLeft, ChevronRight, Contact, EllipsisVertical, Globe, Plus, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/utils";

import { CreateCompanyDialog } from "./company-dialogs";
import { type Company, companies, contactsCountLabel, type SortKey, sortOptions, toneFor } from "./data";

const PAGE_SIZE = 8;

function sortValue(company: Company, key: SortKey): string | number {
  switch (key) {
    case "domain":
      return company.domain;
    case "created_at":
      return company.createdOrder;
    case "last_activity_at":
      return company.lastActivityMinutes;
    case "contacts_count":
      return company.contactsCount;
    default:
      return company.name;
  }
}

function SortMenu({
  sort,
  order,
  onSort,
  onOrder,
}: {
  sort: SortKey;
  order: "" | "-";
  onSort: (value: SortKey) => void;
  onOrder: (value: "" | "-") => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Sort by">
          <ArrowDownUp />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">Sort by</span>
            <NativeSelect size="sm" value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">Order</span>
            <NativeSelect size="sm" value={order} onChange={(event) => onOrder(event.target.value as "" | "-")}>
              <option value="">Ascending</option>
              <option value="-">Descending</option>
            </NativeSelect>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CompanyCard({ company }: { company: Company }) {
  const name = company.name || "Unnamed Company";
  return (
    <Link
      href={`/dashboard/companies/${company.id}`}
      className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:bg-muted/50"
    >
      <Avatar className="size-10 rounded-lg">
        <AvatarFallback className={cn("rounded-lg font-medium text-sm", toneFor(company.id))}>
          {getInitials(name).slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <span className="truncate font-medium">{name}</span>
          {company.contactsCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
              <Contact className="size-3.5" />
              {contactsCountLabel(company.contactsCount)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm">
            {company.domain ? (
              <>
                <Globe className="size-3.5 shrink-0" />
                <span className="truncate">{company.domain}</span>
              </>
            ) : null}
          </span>
          <span className="shrink-0 text-muted-foreground text-sm">{company.lastActivity}</span>
        </div>
      </div>
    </Link>
  );
}

export function CompaniesList() {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("last_activity_at");
  const [order, setOrder] = React.useState<"" | "-">("");
  const [page, setPage] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? companies.filter((c) => [c.name, c.domain].some((v) => v.toLowerCase().includes(q)))
      : companies;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort);
      const bv = sortValue(b, sort);
      const result = typeof av === "number" ? av - (bv as number) : av.localeCompare(bv as string);
      return order === "" ? result : -result;
    });
  }, [query, sort, order]);

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const start = rows.length ? current * PAGE_SIZE + 1 : 0;
  const end = current * PAGE_SIZE + pageRows.length;

  return (
    <>
      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="self-center text-xl leading-none">Companies</CardTitle>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap items-center justify-start gap-2 justify-self-stretch md:col-start-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
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
            </InputGroup>
            <SortMenu sort={sort} order={order} onSort={setSort} onOrder={setOrder} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                  <Plus /> Add company
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {pageRows.length ? (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
              {pageRows.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center p-8 text-muted-foreground">No companies found</div>
          )}
          {rows.length ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm tabular-nums">
                  Showing {start} – {end} of {rows.length} {rows.length === 1 ? "company" : "companies"}
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
            </>
          ) : null}
        </CardContent>
      </Card>

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

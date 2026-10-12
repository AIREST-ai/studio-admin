"use client";
// F159: the table footer of contacts/_components/contacts-list.tsx (Rows per page, Page x of y, pages), for the
// Chatwoot report tables that have a Pagination with a page size selector (overview AgentTable, CsatTable, SLATable).
import * as React from "react";

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

export function usePager<T>(rows: T[], initialSize = 10) {
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(initialSize);
  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);
  return { page: current, setPage, pageSize, setPageSize, pageCount, pageRows, total: rows.length };
}

export function TablePager({
  pager,
  sizes = [5, 10, 20, 50],
}: {
  pager: ReturnType<typeof usePager<unknown>>;
  sizes?: number[];
}) {
  const { page, setPage, pageSize, setPageSize, pageCount, total } = pager;
  const first = total ? page * pageSize + 1 : 0;
  const last = Math.min(total, (page + 1) * pageSize);
  return (
    <>
      <Separator />
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(0);
              }}
            >
              <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {sizes.map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span>
            Showing {first} to {last} of {total} results
          </span>
        </div>
        <Pagination className="mx-0 w-auto justify-start md:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text=""
                className={page === 0 ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setPage(page - 1);
                }}
              />
            </PaginationItem>
            {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={i === page}
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
                className={page >= pageCount - 1 ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setPage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </>
  );
}

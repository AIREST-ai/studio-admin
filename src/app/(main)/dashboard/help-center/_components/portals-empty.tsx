"use client";
import * as React from "react";

import { Eye, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getInitials } from "@/lib/utils";

import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";

import { articles, authorOf, categoryOf, statusLabel, statusTone } from "./data";
import { CreatePortalDialog } from "./help-center-dialogs";

export function PortalsEmpty() {
  const [open, setOpen] = React.useState(false);
  const sample = articles.slice(0, 8);

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="relative min-h-[36rem]">
        <div aria-hidden className="pointer-events-none grid select-none grid-cols-1 gap-3 opacity-60 md:grid-cols-2">
          {sample.map((article) => {
            const author = authorOf(article);
            const category = categoryOf(article);
            return (
              <div key={article.id} className="grid gap-2 rounded-xl border px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 font-medium text-sm">{article.title}</span>
                  <span className={`inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs ${statusTone[article.status]}`}>
                    {statusLabel[article.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1">
                    <Avatar className={`size-4 font-medium ${author ? personToneClass(author.name) : ""}`}>
                      <AvatarFallback className="text-[8px]">{getInitials(author?.name ?? "-")}</AvatarFallback>
                    </Avatar>
                    {author?.name}
                  </span>
                  <span>
                    {category?.icon} {category?.name ?? "Uncategorised"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" /> {article.views.toLocaleString("en-US")} views
                  </span>
                  <span className="ml-auto">{article.updated}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-card via-card/95 to-card/40 px-6">
          <div className="grid max-w-lg justify-items-center gap-3 text-center">
            <h2 className="font-semibold text-2xl">Help Center</h2>
            <p className="text-muted-foreground text-sm leading-6">
              Create self-service help center portals for your customers. Help them find answers quickly, without
              waiting. Streamline inquiries, boost agent efficiency, and elevate customer support.
            </p>
            <Button className="mt-2" onClick={() => setOpen(true)}>
              <Plus /> Create Portal
            </Button>
          </div>
        </div>
      </CardContent>
      <CreatePortalDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

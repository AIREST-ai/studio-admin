"use client";
// Settings home in the Studio pattern: big title and description outside, then one card per settings group with a
// row per page (icon, name, one line). Chatwoot itself opens Account Settings at /settings; this page lists them all.
// م137 (Fahad 137): the seven parts of the Settings inner bar, in its order; each card has the part's title, its
// one-line description and its page count, and the cards run down two columns so the reading order is the bar's.
// م137 round 2 item 8 (user simulation): the search reads each page's content words (settings-nav.ts keywords), not only
// its name; while searching, the person's own settings (Profile Settings tabs) are found too, marked as living in the
// account menu (never listed otherwise, item 54); Automation is listed as a pointer to its own place (item 88).
import * as React from "react";

import Link from "next/link";

import { ArrowUpRight, ChevronRight } from "lucide-react";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canOpen, useViewer } from "@/lib/cw/view-as";
import { isShown, sectionOfUrl } from "@/lib/owner/site-sections";
import { useSiteSections } from "@/lib/owner/site-sections-context";
import dictionary from "@/lingo/dom-ar.json";

import { PageHeader } from "../labels/_shared/settings-shell";
import { personalLinks, type SettingsLink, settingsGroups } from "./settings-nav";

// Every word of the search starts a word of the page's name, line, content words or part name ("tag" finds Labels,
// not the "stages" of Customer Path).
function matches(item: SettingsLink, part: string, words: string[]) {
  const translations = dictionary as Record<string, string>;
  const fields = [item.title, item.description, item.keywords ?? "", part];
  const text = fields
    .flatMap((field) => [field, translations[field] ?? ""])
    .join(" ")
    .toLowerCase();
  return words.every((word) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u").test(text),
  );
}

// A pointer to a page that lives elsewhere (Automation) is listed but not counted as one of the part's pages.
const pageCount = (items: SettingsLink[]) => items.filter((item) => !item.elsewhere).length;

export function SettingsIndex() {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  // F-5A "View as": only the settings the viewed person may open (Chatwoot route permissions, src/lib/cw/view-as.ts).
  const viewer = useViewer();
  // F-17 (T-91): a link to a section the owner hid (Settings > Captain while Captain is hidden, the Automation pointer)
  // is not listed, as in the Settings bar (nav-main.tsx withLiveLists).
  const siteSections = useSiteSections();
  const sectionShown = (url: string) => {
    const section = sectionOfUrl(url);
    return !section || isShown(siteSections, section.id);
  };
  const words = q.split(/\s+/).filter(Boolean);
  const personal = {
    label: "Personal",
    description: "Your own settings. They live in the account menu (your picture, then Account).",
    items: personalLinks,
  };
  const groups = [...settingsGroups, ...(words.length ? [personal] : [])]
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          canOpen(viewer, item.url.split("?")[0]) &&
          sectionShown(item.url) &&
          (!words.length || matches(item, group.label, words)),
      ),
    }))
    .filter((group) => group.items.length);

  return (
    <div className="flex flex-col gap-4">
      {/* م137 round 2 (judge M137): the title is the page's name in the Settings bar, All Settings. */}
      <PageHeader
        title="All Settings"
        description="Manage your account, channels, team and the rules your conversations follow."
        actions={
          <ExpandingSearch
            name="settings"
            label="Search settings"
            placeholder="Search settings..."
            size="default"
            className="w-full md:w-72"
            value={query}
            onChange={setQuery}
          />
        }
      />
      {groups.length ? (
        <div data-settings-parts className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {groups.map((group) => (
            <Card key={group.label} data-settings-part={group.label} className="gap-0 pb-0">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl leading-none">{group.label}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
                <CardAction>
                  <Badge variant="secondary" className="tabular-nums">
                    {pageCount(group.items)} {pageCount(group.items) === 1 ? "page" : "pages"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                <ul className="divide-y">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const away = item.elsewhere ?? (group.label === "Personal" ? "In your account menu" : undefined);
                    return (
                      <li key={item.url}>
                        <Link
                          href={item.url}
                          data-settings-elsewhere={away ? "" : undefined}
                          className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 sm:px-6"
                        >
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/50">
                            <Icon
                              aria-hidden="true"
                              className="size-4 text-muted-foreground group-hover:text-foreground"
                            />
                          </div>
                          <div className="grid min-w-0 flex-1 gap-0.5">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-sm [overflow-wrap:anywhere]">
                              {item.title}
                              {away ? (
                                <Badge
                                  variant="outline"
                                  className="max-w-full whitespace-normal font-normal text-muted-foreground"
                                >
                                  {away}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="truncate text-muted-foreground text-xs">{item.description}</span>
                          </div>
                          {away ? (
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-4 shrink-0 text-muted-foreground rtl:-rotate-90"
                            />
                          ) : (
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4 shrink-0 text-muted-foreground transition-transform ltr:group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground text-sm">
            No settings match your search
          </CardContent>
        </Card>
      )}
    </div>
  );
}

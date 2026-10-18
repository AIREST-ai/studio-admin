"use client";
// Layout mirrors users/_components/users-roles.tsx (page heading + line tabs with count pills),
// users/_components/users.tsx (card header, action row, filter chips, selected + view toggle)
// and users/_components/users-table.tsx (table + pagination). Chatwoot features kept:
// views All contacts / Segments / Tagged With (routes/dashboard/contacts/routes.js), search, advanced
// filter + active filters + save as segment, sort/order, add / import / export dialogs, row selection with the
// bulk bar (ContactsBulkActionBar.vue), the expandable row with the edit form (ContactsCard.vue).
// T-94/T-95 (Fahad 21:21): no Active view and no Unknown status; the tabs split contacts by channel type instead, from
// the live inboxes the T-97 channel picker lists (chat-channel-picker.tsx), with the same channel icons.
// T-137 (item 56, standard first): respond.io Contacts shows a Channel(s) column (up to 3 icons, then "+N") and
// filters by Channel (respond.io/help/contacts/contacts-overview); Chatwoot keeps Segments and Tagged With
// (Sidebar.vue) and titles the list after the pick (ContactsIndex.vue headerTitle). So: a Channels column, the
// titles follow the channel tab, the tabs wrap instead of hiding, and the Inbox chip only appears inside a channel
// type that has more than one inbox (one inbox per type would repeat the tab).
// T-137 round 2 (monitor 01:20): labels are picked in one place, the Contacts bar (Chatwoot «Tagged With», the labels
// shown on the sidebar), so the page has no second Tagged With menu and no Label chip of its own; the pick is the path
// (/contacts/labels/<label>) plus ?channel=<type>, and the titles follow both. Every label, also those kept off the
// bar, stays pickable in the advanced Filter (Labels) and at its own path, as in Chatwoot. Round 3: a Filter of just
// "Labels equal to X" opens that label's path too; any other filter stays a filter and the titles show it.
// T-177: one title, as in Chatwoot (ContactHeader.vue shows headerTitle once). The card repeated the page heading word
// for word once a channel, label or segment was picked, so the card keeps its description and actions, no title.
// T-285 (Fahad 125.10): the Country and Last activity chips repeated two attributes of the Filter beside them
// (Country, Last activity), so they are gone and both stay in the Filter, as in Chatwoot (contactFilterItems). Sorting
// by Last activity (newest / oldest first) stays in Sort: ordering is not a period filter. 125.4: the search is a lens.
import * as React from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ArrowDownUp,
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Grid,
  ListFilter,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { isContactOnline } from "@/app/(main)/chat/_components/data";
import { LinkedContacts } from "@/app/(main)/dashboard/_components/chatwoot-link/linked-contacts";
import { useLinkedContacts } from "@/app/(main)/dashboard/_components/chatwoot-link/use-linked";
import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { baseConversations, contactIdOf } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { ChannelIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  CeUnavailableNotice,
  createLinkedCustomFilter,
  deleteLinkedCustomFilter,
  fetchLinkedCustomFilters,
} from "@/lib/chatwoot/settings-adapter";
import { enableLinkedStoreAdapter, linkedSession, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
import { useCwList, useCwShared } from "@/lib/cw/store";
import { canDeleteContacts, useViewer } from "@/lib/cw/view-as";

import { AddContactDialog, DeleteContactDialog } from "./contact-dialogs";
import { ContactEditForm } from "./contact-edit";
import { simDeleteContacts } from "./contacts-sim";
import {
  type ContactFilter,
  describeFilter,
  type FilterAttribute,
  type FilterOperator,
  filterAttributeOptions,
  isDateAttribute,
  matchesFilters,
  operatorLabels,
  useContactsStore,
} from "./contacts-store";
import { CountrySelect } from "./country-select";
import { type Contact, sortOptions } from "./data";
import { ContactAvatar, LabelBadge, PageHeading, StatusBadge } from "./studio-ui";

export type ContactsView = { kind: "all" } | { kind: "label"; label: string } | { kind: "segment"; id: number };

type SortKey = "name" | "email" | "phone_number" | "company" | "country" | "city" | "last_activity_at" | "created_at";
type ColumnKey = "channels" | "phone" | "company" | "location" | "labels" | "lastActivity";

const columnLabels: Record<ColumnKey, string> = {
  channels: "Channels",
  phone: "Phone number",
  company: "Company",
  location: "City",
  labels: "Labels",
  lastActivity: "Last activity",
};

// Channels (inbox slugs) each person has written on, computed dynamically from baseConversations so both preview and
// linked mode conversations show their channel icons in the Channels column and channel tabs.
function channelsOfContact(contactId: number): Set<string> {
  const set = new Set<string>();
  for (const conversation of baseConversations) {
    if (contactIdOf(conversation.id) === contactId) {
      set.add(conversation.channel);
    }
  }
  return set;
}

const noSubscribe = () => () => undefined;
const isClient = () => true;
const isServer = () => false;

const inChannelTab = (contact: Contact, tab: { slugs: string[] }) => {
  const channels = channelsOfContact(contact.id);
  return tab.slugs.some((slug) => channels.has(slug));
};

// The conversation icons key phone calls as "phone"; the inbox list keys them as "voice" (as chat-channel-picker.tsx).
const iconKey = (channel: string) => (channel === "voice" ? "phone" : channel);

type LiveInbox = { slug: string; name: string; channel: string; channelType: string };

// respond.io Channel(s) column: up to 3 channel icons, the rest as "+N"; the names show on hover.
function ContactChannels({ contactId, inboxes }: { contactId: number; inboxes: LiveInbox[] }) {
  const onClient = React.useSyncExternalStore<boolean>(noSubscribe, isClient, isServer);
  useLinkedAdapterStatus((s) => s.lastSyncedAt);
  const slugs = onClient ? channelsOfContact(contactId) : new Set<string>();
  const mine = inboxes.filter((inbox) => slugs.has(inbox.slug));
  if (!mine.length) return <span className="text-muted-foreground text-sm">---</span>;
  return (
    <span className="inline-flex items-center -space-x-1.5" title={mine.map((inbox) => inbox.name).join(", ")}>
      {mine.slice(0, 3).map((inbox) => (
        <span
          key={inbox.slug}
          role="img"
          aria-label={inbox.channelType}
          data-channel={inbox.channel}
          data-channel-type={inbox.channelType}
          className="inline-flex size-6 items-center justify-center rounded-full border bg-muted text-muted-foreground ring-2 ring-card"
        >
          <ChannelIcon channel={iconKey(inbox.channel)} />
        </span>
      ))}
      {mine.length > 3 ? (
        <span className="ps-2.5 text-muted-foreground text-xs tabular-nums">+{mine.length - 3}</span>
      ) : null}
    </span>
  );
}

function latestConversationOf(contactId: number) {
  return baseConversations.find((c) => contactIdOf(c.id) === contactId);
}

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
      // Most recent activity = highest value, so "Descending" lists the latest first (Chatwoot -last_activity_at).
      return -contact.lastActivityMinutes;
    case "created_at":
      return Date.parse(contact.createdAt) || contact.id;
    default:
      return contact.name;
  }
}

// ---- Filter contacts (Chatwoot ContactListHeaderWrapper / FilterInput) ----

// F-1: the bar above the list (CardAction below) is pushed to the right edge from xl (1280px) up and starts at the left
// edge below it, so the Filter popover hangs from the button's right edge (align end) above 1280px and from its left
// edge below. With "end" at 1024 the 36rem popover reached past the left edge, was pushed there by Radix and sat over
// the sidebar instead of under the button.
const BAR_AT_RIGHT = "(min-width: 1280px)";
const subscribeBarSide = (notify: () => void) => {
  const query = window.matchMedia(BAR_AT_RIGHT);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const popoverAlign = (): "start" | "end" => (window.matchMedia(BAR_AT_RIGHT).matches ? "end" : "start");
const popoverAlignOnServer = (): "start" | "end" => "end";

function newFilter(): ContactFilter {
  return { attribute: "name", operator: "equal_to", value: "", join: "and" };
}

function FilterValueInput({
  filter,
  labelTitles,
  onChange,
}: {
  filter: ContactFilter;
  labelTitles: string[];
  onChange: (value: string) => void;
}) {
  if (filter.operator === "is_present" || filter.operator === "is_not_present") return <div />;
  if (filter.attribute === "country") return <CountrySelect size="sm" value={filter.value} onChange={onChange} />;
  if (filter.attribute === "blocked" || filter.attribute === "labels") {
    const options =
      filter.attribute === "blocked"
        ? [
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]
        : labelTitles.map((l) => ({ value: l, label: l }));
    return (
      <NativeSelect size="sm" className="w-full" value={filter.value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Select
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  if (isDateAttribute(filter.attribute)) {
    return filter.operator === "days_before" ? (
      <Input
        className="h-8"
        type="number"
        min={0}
        placeholder="Days"
        value={filter.value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <Input className="h-8" type="date" value={filter.value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  return (
    <Input className="h-8" placeholder="Enter value" value={filter.value} onChange={(e) => onChange(e.target.value)} />
  );
}

function needsValue(filter: ContactFilter) {
  return filter.operator !== "is_present" && filter.operator !== "is_not_present";
}

// T-290 (Fahad 128.1 «هو فلتر واحد»): the Inbox choice, the last filter that had its own chip beside the Filter, is
// picked inside it. It is a further choice of the channel picked in the Contacts bar, shown only when that channel has
// more than one inbox, and it applies at once, as the chip did.
type InboxPick = { value: string; options: string[]; onChange: (value: string) => void };

function FilterPopover({
  applied,
  labelTitles,
  segmentName,
  inbox,
  onApply,
  onClear,
}: {
  applied: ContactFilter[];
  labelTitles: string[];
  segmentName?: string;
  inbox?: InboxPick;
  onApply: (filters: ContactFilter[]) => void;
  onClear: () => void;
}) {
  const inboxOn = Boolean(inbox && inbox.value !== "All");
  const align = React.useSyncExternalStore(subscribeBarSide, popoverAlign, popoverAlignOnServer);
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ContactFilter[]>([newFilter()]);
  const valid = rows.every((r) => !needsValue(r) || r.value.trim());

  function setRow(index: number, patch: Partial<ContactFilter>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setRows(applied.length ? applied : [newFilter()]);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          {segmentName ? <Pencil /> : <ListFilter />} {segmentName ? "Edit segment" : "Filter"}
          {(applied.length && !segmentName) || inboxOn ? (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(36rem,calc(100vw-2rem))]">
        <div className="grid gap-3">
          <span className="font-medium text-sm">{segmentName ? "Edit segment" : "Filter contacts"}</span>
          {segmentName ? (
            <div className="grid gap-1">
              <Label className="text-muted-foreground text-xs">Segment name</Label>
              <Input className="h-8" value={segmentName} readOnly />
            </div>
          ) : null}
          {inbox ? (
            <div className="grid gap-1">
              <Label htmlFor="contacts-filter-inbox" className="text-muted-foreground text-xs">
                Inbox
              </Label>
              <NativeSelect
                id="contacts-filter-inbox"
                size="sm"
                className="w-full"
                value={inbox.value}
                onChange={(e) => inbox.onChange(e.target.value)}
              >
                {inbox.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {rows.map((row, index) => {
            const attribute = filterAttributeOptions.find((a) => a.value === row.attribute);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: filter rows have no id; order is their identity
              <div key={index} className="grid gap-2">
                {index > 0 ? (
                  <NativeSelect
                    size="sm"
                    className="w-24"
                    value={row.join}
                    onChange={(e) => setRow(index, { join: e.target.value as "and" | "or" })}
                  >
                    <option value="and">And</option>
                    <option value="or">Or</option>
                  </NativeSelect>
                ) : null}
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                  <NativeSelect
                    size="sm"
                    className="w-full"
                    value={row.attribute}
                    onChange={(e) => {
                      const next = filterAttributeOptions.find((a) => a.value === e.target.value);
                      setRow(index, {
                        attribute: e.target.value as FilterAttribute,
                        operator: next?.operators[0] ?? "equal_to",
                        value: "",
                      });
                    }}
                  >
                    {filterAttributeOptions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    size="sm"
                    className="w-full"
                    value={row.operator}
                    onChange={(e) => setRow(index, { operator: e.target.value as FilterOperator })}
                  >
                    {(attribute?.operators ?? []).map((op) => (
                      <option key={op} value={op}>
                        {operatorLabels[op]}
                      </option>
                    ))}
                  </NativeSelect>
                  <FilterValueInput
                    filter={row}
                    labelTitles={labelTitles}
                    onChange={(value) => setRow(index, { value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove filter"
                    disabled={rows.length === 1}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            variant="link"
            size="sm"
            className="w-fit px-0"
            onClick={() => setRows((prev) => [...prev, newFilter()])}
          >
            Add filter
          </Button>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRows([newFilter()]);
                onClear();
                setOpen(false);
              }}
            >
              Clear filters
            </Button>
            <Button
              size="sm"
              disabled={!valid}
              onClick={() => {
                onApply(rows);
                setOpen(false);
              }}
            >
              {segmentName ? "Update segment" : "Apply filters"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---- dialogs for segments and bulk delete ----

function SaveSegmentDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const invalid = !name.trim();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setName("");
          setTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Do you want to save this filter?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="segment-name">Name</Label>
          <Input
            id="segment-name"
            placeholder="Enter the name of the filter"
            value={name}
            aria-invalid={touched && invalid}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {touched && invalid ? <span className="text-destructive text-xs">Enter a valid name</span> : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={invalid}
            onClick={() => {
              onSave(name.trim());
              setName("");
              setTouched(false);
            }}
          >
            Save filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  cancel = "Cancel",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirm: string;
  cancel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LabelsMenu({
  trigger,
  labelTitles,
  onPick,
}: {
  trigger: React.ReactNode;
  labelTitles: string[];
  onPick: (label: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
        {labelTitles.length ? (
          labelTitles.map((l) => (
            <DropdownMenuItem key={l} onSelect={() => onPick(l)}>
              <LabelBadge label={l} />
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuLabel className="font-normal text-muted-foreground">No labels available yet.</DropdownMenuLabel>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActions({
  contact,
  expanded,
  onToggle,
  onDelete,
}: {
  contact: Contact;
  expanded?: boolean;
  onToggle?: () => void;
  onDelete: () => void;
}) {
  const latest = latestConversationOf(contact.id);
  // F-5A "View as": deleting contacts is for administrators (Chatwoot ContactPolicy#destroy?, ContactsBulkActionBar.vue).
  const canDelete = canDeleteContacts(useViewer());
  return (
    <div className="inline-flex items-center gap-1">
      {onToggle ? (
        <Button
          aria-label={expanded ? `Collapse ${contact.name}` : `Edit ${contact.name}`}
          aria-expanded={expanded}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
          onClick={onToggle}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
      ) : null}
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
            <Link href={latest ? `/dashboard/chat?conversation=${latest.id}` : "/dashboard/chat"}>Send message</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/contacts/${contact.id}?tab=merge`}>Merge contact</Link>
          </DropdownMenuItem>
          {canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete contact
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const PATH = "/dashboard/contacts";

// useSearchParams needs a Suspense boundary on the statically built /dashboard/contacts.
// L-2 (Chatwoot link phase 1, plan r1-chatwoot-link/خطة.md 4): when "Contacts" is linked to the Chatwoot test copy,
// the parallel read path (useLinkedContacts, /api/chatwoot/*) renders instead, read-only. In preview mode the hook
// asks nothing and the list below renders exactly as before.
export function ContactsList(props: { view?: ContactsView }) {
  const linked = useLinkedContacts();
  const linkedStatus = useLinkedAdapterStatus();
  if (linked.active) {
    const view = props.view;
    let viewName: string | undefined;
    if (view?.kind === "label") viewName = `Label ${view.label}`;
    if (view?.kind === "segment") viewName = "Segment";
    return <LinkedContacts list={linked} viewName={viewName} />;
  }
  return (
    <div className="flex flex-col gap-3">
      {linkedStatus.active && linkedStatus.error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs"
        >
          <span>Linked Chatwoot connection error: {linkedStatus.error}</span>
          <Button size="sm" variant="outline" onClick={() => void enableLinkedStoreAdapter()}>
            Retry
          </Button>
        </div>
      ) : null}
      <React.Suspense fallback={null}>
        <ContactsListView {...props} />
      </React.Suspense>
    </div>
  );
}

function ContactsListView({ view = { kind: "all" } }: { view?: ContactsView }) {
  const viewer = useViewer();
  const router = useRouter();
  const searchParams = useSearchParams();
  const list = useContactsStore((s) => s.list);
  const blocked = useContactsStore((s) => s.blocked);
  const segments = useContactsStore((s) => s.segments);
  const lastSyncedAt = useLinkedAdapterStatus((s) => s.lastSyncedAt);
  // T-268: presence is client-only (a widget heartbeat), so the server render never has a dot.
  const onClient = React.useSyncExternalStore<boolean>(noSubscribe, isClient, isServer);
  const { addLabels, removeLabels, addSegment, updateSegment, deleteSegment } = useContactsStore.getState();
  const [sharedLabels] = useCwList("labels");
  const labelTitles = sharedLabels.map((l) => l.title);
  const segment = view.kind === "segment" ? segments.find((s) => s.id === view.id) : undefined;
  // One tab per channel type of the connected inboxes (Settings > Inboxes), in their order.
  const liveInboxes = useCwShared((state) => state.inboxes);
  const channelTabs = React.useMemo(() => {
    const tabs: { type: string; channel: string; slugs: string[] }[] = [];
    for (const inbox of liveInboxes) {
      const tab = tabs.find((t) => t.type === inbox.channelType);
      if (tab) tab.slugs.push(inbox.slug);
      else tabs.push({ type: inbox.channelType, channel: inbox.channel, slugs: [inbox.slug] });
    }
    return tabs;
  }, [liveInboxes]);

  const [query, setQuery] = React.useState("");
  const [inbox, setInbox] = React.useState("All");
  // The channel pick lives in the address (?channel=WhatsApp), with the label or segment in the path.
  const channelTab = channelTabs.find((t) => t.type === searchParams.get("channel"));
  const channelType = channelTab?.type ?? null;
  // A specific inbox is only a further choice when the picked channel type has more than one inbox.
  const typeInboxes = channelTab ? liveInboxes.filter((i) => i.channelType === channelTab.type) : [];
  const inboxSlug = typeInboxes.length > 1 ? typeInboxes.find((i) => i.name === inbox)?.slug : undefined;
  const [applied, setApplied] = React.useState<ContactFilter[]>([]);
  // Chatwoot default: -last_activity_at (ContactsIndex.vue:20) = latest activity first.
  const [sort, setSort] = React.useState<SortKey>("last_activity_at");
  const [order, setOrder] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  // A channel picked in the Contacts bar starts from its first page with all its inboxes, as the tabs did.
  const [shownChannel, setShownChannel] = React.useState(channelType);
  if (shownChannel !== channelType) {
    setShownChannel(channelType);
    setPage(0);
    setInbox("All");
  }
  const [layout, setLayout] = React.useState("list");
  const [hidden, setHidden] = React.useState<ColumnKey[]>([]);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [dialog, setDialog] = React.useState<"add" | "save-segment" | "delete-segment" | "bulk-delete" | null>(null);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);

  const viewMatch = React.useCallback(
    (c: Contact) => {
      if (view.kind === "label") return c.labels.includes(view.label);
      if (view.kind === "segment") return segment ? matchesFilters(c, segment.filters, blocked) : false;
      return true;
    },
    [view, segment, blocked],
  );

  const inView = React.useMemo(() => list.filter(viewMatch), [list, viewMatch]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSyncedAt triggers recomputation when linked conversations arrive
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = inView.filter(
      (c) =>
        (!q || [c.name, c.email, c.phone, c.company].some((v) => v.toLowerCase().includes(q))) &&
        (!inboxSlug || channelsOfContact(c.id).has(inboxSlug)) &&
        (!channelTab || inChannelTab(c, channelTab)) &&
        matchesFilters(c, applied, blocked),
    );
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort);
      const bv = sortValue(b, sort);
      const result = typeof av === "number" ? av - (bv as number) : av.localeCompare(bv as string);
      return order === "asc" ? result : -result;
    });
  }, [inView, query, inboxSlug, channelTab, applied, blocked, sort, order, lastSyncedAt]);

  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);
  const visibleSelected = selected.filter((id) => list.some((c) => c.id === id));
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => visibleSelected.includes(r.id));
  const show = (key: ColumnKey) => !hidden.includes(key);
  const start = rows.length ? current * pageSize + 1 : 0;
  const end = Math.min(rows.length, (current + 1) * pageSize);

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  const inboxPick: InboxPick | undefined =
    typeInboxes.length > 1
      ? {
          value: inbox,
          options: ["All", ...typeInboxes.map((i) => i.name)],
          onChange: (value) => {
            setInbox(value);
            setPage(0);
          },
        }
      : undefined;

  // M129-A round 2: Delete is recorded in the preview's saved record (contacts-sim.ts), so it survives a reload, and
  // its toast says it is simulated.
  function deleteOne(id: number) {
    simDeleteContacts([id]);
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  const viewTitle =
    view.kind === "label" ? `#${view.label}` : view.kind === "segment" ? (segment?.name ?? "Segment not found") : null;
  // The title follows the pick (Chatwoot ContactsIndex.vue headerTitle), adding the channel tab when one is picked.
  const pickTitle = viewTitle
    ? channelTab
      ? `${viewTitle} · ${channelTab.type}`
      : viewTitle
    : channelTab
      ? `${channelTab.type} contacts`
      : null;
  // An advanced filter of several conditions stays a filter (Chatwoot), and the title says it is on.
  const filtered =
    applied.length && !segment ? ` · ${applied.length} ${applied.length === 1 ? "filter" : "filters"}` : "";
  const title = `${pickTitle ?? "Contacts"}${filtered}`;
  // What "Save filter as segment" saves: the applied conditions plus the label being viewed (a one-label Filter opens
  // its path, so this keeps it savable). matchesFilters folds left to right, so the label goes LAST with "and":
  // (applied, whole, with its own and/or) and label = exactly what the label view shows (viewMatch && applied).
  const segmentFilters: ContactFilter[] = [
    ...applied,
    ...(view.kind === "label"
      ? [{ attribute: "labels", operator: "equal_to", value: view.label, join: "and" } as const]
      : []),
  ];

  const emptyText = query.trim()
    ? "No contacts matches your search 🔍"
    : list.length === 0
      ? "No contacts found in this account"
      : "No contacts available in this view 📋";

  React.useEffect(() => {
    if (!linkedSession()) return;
    void fetchLinkedCustomFilters("contact")
      .then((filters) => {
        const mapped = filters.map((f) => {
          const vals = Array.isArray((f.query as { payload?: unknown })?.payload)
            ? ((f.query as { payload: Record<string, unknown>[] }).payload ?? [])
            : [];
          return {
            id: f.id,
            name: f.name,
            filters: vals.map((item) => ({
              attribute: String(item.attribute_key ?? "name") as FilterAttribute,
              operator: String(item.filter_operator ?? "equal_to") as FilterOperator,
              value: Array.isArray(item.values) ? String(item.values[0] ?? "") : String(item.values ?? ""),
              join: (String(item.query_operator ?? "and").toLowerCase() === "or" ? "or" : "and") as "and" | "or",
            })),
          };
        });
        useContactsStore.setState({ segments: mapped });
      })
      .catch(() => undefined);
  }, [lastSyncedAt]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title={title} subtitle="Everyone who has talked to your team, across every inbox." />
      {sort === "company" || applied.some((f) => f.attribute === "company") ? (
        <CeUnavailableNotice
          area="companies"
          title="Standalone Companies API (/companies) is unavailable in Chatwoot Community Edition (501)"
        />
      ) : null}

      {/* T-285 (Fahad 125.8): the channels are picked in the Contacts bar, right after All contacts
          (contacts-subnav.tsx), so the row of channel tabs that wrapped onto two lines is gone; the pick stays
          ?channel=<type> and the title follows it. */}
      <div className="flex flex-wrap items-end gap-2 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-active={view.kind === "segment" || undefined}
              className="mb-1 data-active:font-medium data-active:text-foreground text-muted-foreground"
            >
              Segments
              {view.kind === "segment" && segment ? `: ${segment.name}` : ""}
              <Badge variant="secondary" className="tabular-nums">
                {segments.length}
              </Badge>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {segments.length ? (
              segments.map((s) => (
                <DropdownMenuItem key={s.id} asChild>
                  <Link href={`${PATH}/segments/${s.id}`}>{s.name}</Link>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                No segments yet. Apply a filter and save it.
              </DropdownMenuLabel>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 xl:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardDescription className="max-w-sm leading-snug">Manage your customers and leads.</CardDescription>
          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:w-auto xl:flex-nowrap xl:justify-end xl:justify-self-end">
            <ExpandingSearch
              name="contacts"
              label="Search contacts"
              placeholder="Search contacts…"
              className="w-full md:w-56 xl:w-64"
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(0);
              }}
            />

            {/* T-282 round 2 (Fahad 123): one bar in the standard order, filter → sort → view → primary action, as
                Chatwoot's contacts header (ContactHeader.vue: filter, save/delete segment, sort, more, add), Twenty's
                view bar (ViewBar.tsx: filter, sort, options) and the shadcn/ui tasks toolbar (filters, View, Add).
                Filter used to sit alone on a second row under Sort. Below 1280px the bar takes its own line under the
                description (as users.tsx), so the opened search never pushes it out of the card at 1024. */}
            {segment ? (
              <>
                <FilterPopover
                  applied={segment.filters}
                  labelTitles={labelTitles}
                  segmentName={segment.name}
                  inbox={inboxPick}
                  onApply={(filters) => {
                    updateSegment(segment.id, filters);
                    toast.success("Filter saved successfully");
                  }}
                  onClear={() => undefined}
                />
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Delete segment"
                  onClick={() => setDialog("delete-segment")}
                >
                  <Trash2 />
                </Button>
              </>
            ) : (
              <>
                <FilterPopover
                  applied={applied}
                  labelTitles={labelTitles}
                  inbox={inboxPick}
                  onApply={(filters) => {
                    // Filter → Labels equal to <label> on its own is the same pick as the bar's label: its path,
                    // with the channel kept, so the titles and the bar follow it.
                    const only = filters.length === 1 ? filters[0] : null;
                    if (only?.attribute === "labels" && only.operator === "equal_to" && only.value) {
                      setApplied([]);
                      const channel = channelType ? `?channel=${encodeURIComponent(channelType)}` : "";
                      router.push(`${PATH}/labels/${encodeURIComponent(only.value)}${channel}`);
                      return;
                    }
                    setApplied(filters);
                    setPage(0);
                  }}
                  onClear={() => setApplied([])}
                />
                {segmentFilters.length ? (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Save filter as segment"
                    onClick={() => setDialog("save-segment")}
                  >
                    <BookmarkPlus />
                  </Button>
                ) : null}
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowDownUp /> Sort
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

            {/* The view: which columns show, then list or grid (the layout switch ends the bar, as in the
                conversations header). It was on the third row, under the filter. */}
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

            {/* T-290 (Fahad 128.5, 128.6): no Export or Import here; both are in Settings > Import & Export, together,
                as HubSpot (Data Management > Import & Export), Intercom (Settings > Data > Imports & exports), Zoho CRM
                (Setup > Data Administration) and Pipedrive (Tools and apps > Import data / Export data). */}
            <Button size="sm" onClick={() => setDialog("add")}>
              <Plus /> Add contact
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-0">
          {inboxPick && inbox !== "All" ? (
            <div className="flex flex-wrap items-center gap-2 px-4 text-sm">
              <Badge variant="outline" className="px-2 py-1 font-normal">
                Inbox equal to {inbox}
              </Badge>
              <Button variant="link" size="sm" className="h-auto px-0" onClick={() => inboxPick.onChange("All")}>
                Clear inbox
              </Button>
            </div>
          ) : null}

          {applied.length && !segment ? (
            <div className="flex flex-wrap items-center gap-2 px-4 text-sm">
              {applied.slice(0, 2).map((f, i) => (
                <React.Fragment key={`${f.attribute}-${i}`}>
                  {i > 0 ? <span className="text-muted-foreground text-xs uppercase">{f.join}</span> : null}
                  <Badge variant="outline" className="px-2 py-1 font-normal">
                    {describeFilter(f)}
                  </Badge>
                </React.Fragment>
              ))}
              {applied.length > 2 ? (
                <span className="text-muted-foreground">+ {applied.length - 2} more filters</span>
              ) : null}
              <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setApplied([])}>
                Clear filters
              </Button>
            </div>
          ) : null}

          <div className="flex min-h-8 flex-wrap items-center justify-between gap-3 px-4">
            {visibleSelected.length ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <Checkbox
                    checked={rows.length > 0 && rows.every((r) => visibleSelected.includes(r.id))}
                    onCheckedChange={(checked) => setSelected(checked ? rows.map((r) => r.id) : [])}
                  />
                  Select all ({rows.length})
                </label>
                <span className="text-muted-foreground tabular-nums">{visibleSelected.length} selected</span>
                <Button variant="link" size="sm" className="h-auto px-1" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
                <LabelsMenu
                  labelTitles={labelTitles}
                  onPick={(l) => {
                    addLabels(visibleSelected, [l]);
                    toast.success("Labels assigned successfully.");
                  }}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Tag /> Assign Labels
                    </Button>
                  }
                />
                <LabelsMenu
                  labelTitles={labelTitles.filter((l) =>
                    list.some((c) => visibleSelected.includes(c.id) && c.labels.includes(l)),
                  )}
                  onPick={(l) => {
                    removeLabels(visibleSelected, [l]);
                    toast.success("Labels removed successfully.");
                  }}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Tag /> Remove Labels
                    </Button>
                  }
                />
                {canDeleteContacts(viewer) && (
                  <Button variant="destructive" size="sm" onClick={() => setDialog("bulk-delete")}>
                    <Trash2 /> Delete
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm tabular-nums">0 selected</div>
            )}
          </div>

          {view.kind === "segment" && !segment ? (
            <div className="grid place-items-center gap-2 border-t px-4 py-12 text-center text-muted-foreground text-sm">
              This segment does not exist (segments last until the page is reloaded).
              <Link href={PATH} className="text-primary underline-offset-4 hover:underline">
                Back to all contacts
              </Link>
            </div>
          ) : list.length === 0 ? (
            <div className="grid place-items-center gap-3 border-t px-4 py-12 text-center">
              <span className="font-medium">No contacts found in this account</span>
              <span className="text-muted-foreground text-sm">
                Start adding new contacts by clicking on the button below
              </span>
              <Button size="sm" onClick={() => setDialog("add")}>
                <Plus /> Add contact
              </Button>
            </div>
          ) : layout === "grid" ? (
            <div className="grid gap-3 border-t px-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              {pageRows.length === 0 ? (
                <div className="col-span-full py-8 text-center text-muted-foreground text-sm">{emptyText}</div>
              ) : null}
              {pageRows.map((contact) => (
                <div key={contact.id} className="flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`${PATH}/${contact.id}`} className="flex min-w-0 items-center gap-3">
                      <ContactAvatar
                        contact={contact}
                        status={blocked.includes(contact.id) ? "Blocked" : undefined}
                        online={onClient && isContactOnline(contact.id)}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm">{contact.name}</div>
                        <div className="truncate text-muted-foreground text-sm">{contact.email}</div>
                      </div>
                    </Link>
                    <RowActions contact={contact} onDelete={() => setDeleteId(contact.id)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ContactChannels contactId={contact.id} inboxes={liveInboxes} />
                    {blocked.includes(contact.id) ? <StatusBadge status="Blocked" /> : null}
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
                  {show("channels") ? <TableHead className="!px-2 py-4 font-normal">Channels</TableHead> : null}
                  {show("phone") ? <TableHead className="py-4 font-normal">Phone number</TableHead> : null}
                  {show("company") ? <TableHead className="py-4 font-normal">Company / City</TableHead> : null}
                  {show("labels") ? <TableHead className="py-4 font-normal">Labels</TableHead> : null}
                  {show("lastActivity") ? <TableHead className="py-4 font-normal">Last activity</TableHead> : null}
                  <TableHead className="py-4 font-normal">
                    <div className="text-right">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length ? (
                  pageRows.map((contact) => (
                    <React.Fragment key={contact.id}>
                      <TableRow
                        className="border-border/60 hover:bg-white/2.5"
                        data-state={visibleSelected.includes(contact.id) ? "selected" : undefined}
                      >
                        <TableCell className="px-3 py-4 align-middle">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              aria-label={`Select ${contact.name}`}
                              checked={visibleSelected.includes(contact.id)}
                              onCheckedChange={(checked) => toggle(contact.id, checked === true)}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-4 align-middle">
                          <Link href={`${PATH}/${contact.id}`} className="flex items-center gap-3">
                            <ContactAvatar
                              contact={contact}
                              status={blocked.includes(contact.id) ? "Blocked" : undefined}
                              online={onClient && isContactOnline(contact.id)}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground text-sm">{contact.name}</div>
                              <div className="truncate text-muted-foreground text-sm">{contact.email}</div>
                            </div>
                          </Link>
                        </TableCell>
                        {show("channels") ? (
                          <TableCell className="!px-2 py-4 align-middle">
                            <ContactChannels contactId={contact.id} inboxes={liveInboxes} />
                          </TableCell>
                        ) : null}
                        {show("phone") ? (
                          <TableCell className="px-3 py-4 align-middle">
                            <span className="whitespace-nowrap text-sm tabular-nums">{contact.phone || "---"}</span>
                          </TableCell>
                        ) : null}
                        {show("company") ? (
                          <TableCell className="px-3 py-4 align-middle">
                            <div className="grid gap-0.5">
                              <span className="whitespace-nowrap">
                                {contact.company || <span className="text-muted-foreground">---</span>}
                              </span>
                              {show("location") && (contact.city || contact.country) ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                                  <MapPin className="size-3" />
                                  {[contact.city, contact.country].filter(Boolean).join(", ")}
                                </span>
                              ) : null}
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
                        {show("lastActivity") ? (
                          <TableCell className="px-3 py-4 align-middle">
                            <div className="text-foreground text-sm">{contact.lastActivity}</div>
                          </TableCell>
                        ) : null}
                        <TableCell className="px-3 py-4 align-middle">
                          <div className="text-right">
                            <RowActions
                              contact={contact}
                              expanded={expanded === contact.id}
                              onToggle={() => setExpanded((prev) => (prev === contact.id ? null : contact.id))}
                              onDelete={() => setDeleteId(contact.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded === contact.id ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="whitespace-normal bg-muted/20 px-4 py-5">
                            <div className="grid max-w-2xl gap-5">
                              <span className="font-medium text-sm">Edit contact details</span>
                              <ContactEditForm contact={contact} />
                              <Separator />
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="text-muted-foreground text-sm">
                                  This action is permanent and irreversible.
                                </span>
                                <Button variant="destructive" size="sm" onClick={() => setDeleteId(contact.id)}>
                                  Delete now
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {emptyText}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
              <span className="tabular-nums">
                Showing {start} - {end} of {rows.length} {rows.length === 1 ? "contact" : "contacts"}
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
      <SaveSegmentDialog
        open={dialog === "save-segment"}
        onOpenChange={(open) => setDialog(open ? "save-segment" : null)}
        onSave={(name) => {
          if (linkedSession()) {
            const payload = segmentFilters.map((f, idx) => ({
              attribute_key: f.attribute,
              filter_operator: f.operator,
              values: [f.value],
              query_operator: idx < segmentFilters.length - 1 ? f.join : null,
            }));
            void createLinkedCustomFilter(name, { payload }, "contact")
              .then((created) => {
                const seg = { id: created.id, name: created.name, filters: segmentFilters };
                useContactsStore.setState((s) => ({ segments: [...s.segments, seg] }));
                setDialog(null);
                setApplied([]);
                toast.success("Filter saved successfully");
                router.push(`${PATH}/segments/${seg.id}`);
              })
              .catch(() => undefined);
            return;
          }
          const created = addSegment(name, segmentFilters);
          setDialog(null);
          setApplied([]);
          toast.success("Filter saved successfully");
          router.push(`${PATH}/segments/${created.id}`);
        }}
      />
      <ConfirmDialog
        open={dialog === "delete-segment"}
        onOpenChange={(open) => setDialog(open ? "delete-segment" : null)}
        title="Confirm Deletion"
        description="Are you sure you want to delete this filter?"
        confirm="Yes, Delete"
        cancel="No, Cancel"
        onConfirm={() => {
          if (segment && linkedSession()) {
            const prevSegments = useContactsStore.getState().segments;
            deleteSegment(segment.id);
            void deleteLinkedCustomFilter(segment.id)
              .then(() => {
                toast.success("Filter deleted successfully");
                router.push(PATH);
              })
              .catch(() => {
                useContactsStore.setState({ segments: prevSegments });
              });
            return;
          }
          if (segment) deleteSegment(segment.id);
          toast.success("Filter deleted successfully");
          router.push(PATH);
        }}
      />
      <ConfirmDialog
        open={dialog === "bulk-delete"}
        onOpenChange={(open) => setDialog(open ? "bulk-delete" : null)}
        title={visibleSelected.length === 1 ? "Delete selected contact" : "Delete selected contacts"}
        description={
          visibleSelected.length === 1
            ? "This will permanently delete the selected contact. This action cannot be undone."
            : `This will permanently delete ${visibleSelected.length} selected contacts. This action cannot be undone.`
        }
        confirm={visibleSelected.length === 1 ? "Delete contact" : "Delete contacts"}
        onConfirm={() => {
          simDeleteContacts(visibleSelected);
          setSelected([]);
        }}
      />
      <DeleteContactDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId !== null) deleteOne(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}

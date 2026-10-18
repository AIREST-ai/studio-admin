"use client";
// M129-E (Fahad 129.5): the Audit Logs page shows the real, append-only log kept by Retraced (a ready-made audit log
// system, retracedhq/retraced 1.13.1, self-hosted). It is read through the preview server (GET /api/audit-log), which
// asks Retraced's own search for the page, so the filters (actor, action, date, text) are applied by Retraced.
// Nothing on this page can edit or delete an entry. What writes the entries: lib/audit/with-audit.ts.
// F-18a (Fahad 15 Oct 15:20: "the activity log ... almost the same as before"): the page now shows the log as a system:
// its totals on top (all, last 24 hours, last 7 days, failed, deletions), its sections as tabs with their counts, the
// created / changed / deleted filter of the audit log viewer, and a CSV export of what the filters show. No name of the
// system behind the page in the text (F-16).
// F-22 (Fahad 15 Oct: "I mean the whole system … I want my own system"): the rest of the system on the same page:
// saved exports (./saved-exports.tsx), read tokens for a customer or team (./read-tokens.tsx), and the IP location of
// an event, which says plainly that it is not enabled (no IP-location database on this server, nothing looked up online).
import * as React from "react";

import { cn } from "cn";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  ListFilter,
  RefreshCw,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CeUnavailableNotice, probeCeArea } from "@/lib/chatwoot/settings-adapter";
import { linkedSession } from "@/lib/chatwoot/store-adapter";
import { getInitials } from "@/lib/utils";

import { PageHeader } from "../../labels/_shared/settings-shell";
import { ReadTokens } from "./read-tokens";
import { SavedExports } from "./saved-exports";

interface AuditEvent {
  id: string;
  action: string;
  crud: string | null;
  time: string;
  received: string;
  description: string;
  actor: { id: string; name: string; role: string | null };
  target: { id: string; name: string | null; type: string | null } | null;
  ip: string | null;
  location: string | null;
  result: string;
  failed: boolean;
  before: string | null;
  after: string | null;
  route: string | null;
  requestId: string | null;
  userAgent: string | null;
  signIn: string | null;
}

interface AuditSummary {
  total: number;
  scanned: number;
  last24h: number;
  last7d: number;
  failed: number;
  deleted: number;
  people: number;
}

interface AuditPage {
  events: AuditEvent[];
  total: number;
  all: number;
  facets: { actors: { id: string; name: string }[]; actions: { action: string; count: number }[] };
  summary?: AuditSummary;
  sections?: { key: string; label: string; count: number }[];
  pending: number;
  source: { system: string; url: string };
}

/** Prefixes of each section (same as lib/audit/query.ts AUDIT_SECTIONS), to list a section's own actions. */
const SECTION_PREFIXES: Record<string, string[]> = {
  team: [
    "agent.",
    "agent_bot.",
    "team.",
    "inbox.",
    "assignment_policy.",
    "profile.",
    "mfa.",
    "saml.",
    "settings_preview_mfa.",
    "audit_log.",
  ],
  conversations: ["contact.", "conversation.", "conversation_panel.", "call.", "file.", "copilot.", "preview_sim."],
  settings: [
    "account.",
    "label.",
    "folder.",
    "canned_response.",
    "macro.",
    "whatsapp_template.",
    "automation",
    "customer_path_stage.",
    "notification.",
    "campaign.",
    "section.",
    "sla_policy.",
    "capacity_policy.",
    "integration",
    "webhook.",
    "slack_integration.",
    "billing.",
    "captain_settings.",
    "conversation_workflow.",
    "chatwoot_link.",
    "settings_preview.",
    "studio_state.",
    "dodge_board.",
    "dodge_card.",
  ],
  invoices: ["invoice"],
  tasks: ["task.", "linear_issue."],
  system: ["service."],
};

/** The audit log viewer's create / update / delete filter (Retraced "crud"). */
const CRUD_FILTERS = [
  { value: "c", label: "Created" },
  { value: "u", label: "Changed" },
  { value: "d", label: "Deleted" },
];

function SummaryTile({
  label,
  value,
  note,
  tone,
  onClick,
  testId,
}: {
  label: string;
  value: number;
  note: string;
  tone?: "danger";
  onClick?: () => void;
  testId: string;
}) {
  const body = (
    <>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={cn(
          "font-medium text-2xl tabular-nums leading-tight",
          tone === "danger" && value > 0 && "text-destructive",
        )}
        data-testid={`${testId}-value`}
      >
        {value.toLocaleString("en-US")}
      </span>
      {/* round 2: the note wraps instead of being cut at 1024 */}
      <span className="text-muted-foreground text-xs leading-snug">{note}</span>
    </>
  );
  const className = "flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4 text-left";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
      data-testid={testId}
    >
      {body}
    </button>
  ) : (
    <div className={className} data-testid={testId}>
      {body}
    </div>
  );
}

const PAGE_SIZE = 20;
const REFRESH_MS = 15_000;

const tones = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
];
const toneOf = (id: string) => tones[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % tones.length];

const VERBS: Record<string, string> = {
  create: "created",
  delete: "deleted",
  update: "updated",
  save: "saved",
  role_change: "role changed",
  member_add: "member added",
  member_remove: "member removed",
  block: "blocked",
  unblock: "unblocked",
  merge: "merged",
  move: "moved",
  upload: "uploaded",
  send: "sent",
  deliver: "delivered",
  link: "linked",
  simulate: "simulated",
  ask: "asked",
  answer: "answered",
  reset: "reset",
  settings_update: "settings changed",
  notes_update: "notes changed",
  labels_update: "labels changed",
  export_save: "export saved",
  token_create: "read token created",
  token_revoke: "read token revoked",
  token_read: "read with a token",
};

/** "agent.role_change" -> "Agent role changed". */
/**
 * F-16 round 2: the action keys stay as recorded (filters match them), but the page names their objects in the
 * product's words: "chatwoot_link" is the link to the test server, "studio_state" the site's saved state.
 */
const OWN_OBJECTS: Record<string, string> = { chatwoot_link: "test_server_link", studio_state: "site_state" };
export function shownAction(action: string): string {
  const [object, ...rest] = action.split(".");
  return [OWN_OBJECTS[object] ?? object, ...rest].join(".");
}

export function actionLabel(action: string): string {
  const [object, ...rest] = shownAction(action).split(".");
  const verb = rest.join(".");
  const noun = object.replace(/_/g, " ");
  const text = `${noun} ${VERBS[verb] ?? verb.replace(/_/g, " ")}`.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type RangeKind = "all" | "24h" | "7d" | "30d" | "custom";
const RANGES: { value: RangeKind; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];
const HOURS: Record<string, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const shortDay = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const timeText = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fullTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

function pretty(value: string | null): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function DateFilter({
  kind,
  range,
  onApply,
}: {
  kind: RangeKind;
  range: DateRange | undefined;
  onApply: (kind: RangeKind, range: DateRange | undefined) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [draftKind, setDraftKind] = React.useState<RangeKind>(kind);
  const [draft, setDraft] = React.useState<DateRange | undefined>(range);
  const label =
    kind === "custom" && range?.from
      ? `${shortDay(range.from)} – ${shortDay(range.to ?? range.from)}`
      : (RANGES.find((r) => r.value === kind)?.label ?? "All time");
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraftKind(kind);
          setDraft(range);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Date range">
          <CalendarDays /> {label}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto max-w-[calc(100vw-2rem)] flex-col p-0 sm:flex-row">
        <div className="flex shrink-0 flex-col gap-0.5 border-b p-2 sm:w-40 sm:border-r sm:border-b-0">
          <span className="px-2 py-1.5 font-medium text-[11px] text-muted-foreground tracking-wide">DATE RANGE</span>
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                draftKind === r.value && "bg-muted font-medium",
              )}
              onClick={() => {
                setDraftKind(r.value);
                if (r.value !== "custom") {
                  onApply(r.value, undefined);
                  setOpen(false);
                }
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={(next) => {
              setDraftKind("custom");
              setDraft(next);
            }}
            numberOfMonths={1}
            disabled={{ after: new Date() }}
          />
          <div className="flex items-center justify-end gap-2 border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onApply("all", undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              disabled={!draft?.from}
              onClick={() => {
                if (!draft?.from) return;
                onApply("custom", { from: draft.from, to: draft.to ?? draft.from });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="min-w-0 break-words text-sm">{children}</div>
    </div>
  );
}

function EventDetails({ event }: { event: AuditEvent }) {
  return (
    <div className="grid gap-4 bg-muted/30 px-5 py-4 md:grid-cols-2">
      <Detail label="Action">
        <code className="font-mono text-xs">{shownAction(event.action)}</code> · {actionLabel(event.action)}
      </Detail>
      <Detail label="Target">
        {event.target ? (
          <>
            {event.target.name ?? event.target.id}{" "}
            <span className="text-muted-foreground">
              ({event.target.type} · id {event.target.id})
            </span>
          </>
        ) : (
          "—"
        )}
      </Detail>
      <Detail label="Actor">
        {event.actor.name}
        {event.actor.role ? <span className="text-muted-foreground"> · {event.actor.role}</span> : null}
        {event.signIn ? <div className="text-muted-foreground text-xs">{event.signIn}</div> : null}
      </Detail>
      <Detail label="Result">
        <span className={cn(event.failed && "text-destructive")}>{event.result}</span>
      </Detail>
      <Detail label="Before">
        <pre className="max-h-56 overflow-auto rounded-md border bg-background p-2 font-mono text-xs leading-relaxed">
          {pretty(event.before)}
        </pre>
      </Detail>
      <Detail label="After">
        <pre className="max-h-56 overflow-auto rounded-md border bg-background p-2 font-mono text-xs leading-relaxed">
          {pretty(event.after)}
        </pre>
      </Detail>
      <Detail label="Time">
        {fullTime(event.time)}
        <div className="text-muted-foreground text-xs">Received by the audit log server {fullTime(event.received)}</div>
      </Detail>
      <Detail label="Location">
        <span data-testid="audit-location">{event.location ?? "Not enabled"}</span>
        {event.location ? null : (
          <div className="text-muted-foreground text-xs">
            Location by IP address needs an IP-location database on this server. None is installed, and addresses are
            never looked up online.
          </div>
        )}
      </Detail>
      <Detail label="Request">
        <span className="font-mono text-xs">{event.route ?? "—"}</span>
        <div className="font-mono text-muted-foreground text-xs">
          {event.requestId ? `request ${event.requestId}` : null}
        </div>
        <div className="text-muted-foreground text-xs">{event.userAgent}</div>
      </Detail>
      <Detail label="Event ID">
        <span className="font-mono text-muted-foreground text-xs">{event.id}</span>
      </Detail>
    </div>
  );
}

export function AuditLogsList() {
  const [query, setQuery] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [actor, setActor] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [rangeKind, setRangeKind] = React.useState<RangeKind>("all");
  const [range, setRange] = React.useState<DateRange | undefined>();
  const [sort, setSort] = React.useState("newest");
  const [section, setSection] = React.useState("all");
  const [crud, setCrud] = React.useState<string[]>([]);
  // round 2: "Failed actions" opens its own filter (failed=1, the events the audit log marks is_failure).
  const [failedOnly, setFailedOnly] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [open, setOpen] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AuditPage | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  // The IP address column shows from 1280px (Tailwind xl); below that it sits under the time, so rows span 4 columns.
  const [wide, setWide] = React.useState(true);
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const columns = wide ? 5 : 4;

  // Typing waits a moment before asking Retraced.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // New entries appear by themselves while the page is open.
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // The filters as the routes take them (the list below and the CSV export use the same ones).
  const filterParams = React.useCallback(() => {
    const params = new URLSearchParams({ sort });
    if (search) params.set("q", search);
    if (section !== "all") params.set("section", section);
    if (actor !== "all") params.set("actor", actor);
    if (action !== "all") params.set("action", action);
    if (crud.length) params.set("crud", crud.join(","));
    if (failedOnly) params.set("failed", "1");
    if (rangeKind === "custom" && range?.from) {
      params.set("from", dayStart(range.from).toISOString());
      const end = dayStart(range.to ?? range.from);
      end.setDate(end.getDate() + 1);
      params.set("to", end.toISOString());
    } else if (HOURS[rangeKind]) {
      params.set("from", new Date(Date.now() - HOURS[rangeKind] * 3_600_000).toISOString());
    }
    return params;
  }, [search, section, actor, action, crud, failedOnly, rangeKind, range, sort]);

  React.useEffect(() => {
    void tick;
    const controller = new AbortController();
    setLoading(true);
    void probeCeArea("audit_logs").then((ceNotice) => {
      if (controller.signal.aborted) return;
      if (ceNotice || linkedSession()) {
        setData({
          events: [],
          total: 0,
          all: 0,
          facets: { actors: [], actions: [] },
          summary: { total: 0, scanned: 0, last24h: 0, last7d: 0, failed: 0, deleted: 0, people: 0 },
          pending: 0,
          source: { system: "chatwoot", url: "" },
        });
        setError(null);
        setLoading(false);
        return;
      }
      const params = filterParams();
      params.set("page", String(page));
      params.set("size", String(PAGE_SIZE));
      fetch(`/api/audit-log?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as (AuditPage & { error?: string }) | null;
          if (!response.ok || !body) throw new Error(body?.error ?? `the preview server answered ${response.status}`);
          setData(body);
          setError(null);
        })
        .catch((reason: Error) => {
          if (controller.signal.aborted) return;
          setError(reason.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });
    return () => controller.abort();
  }, [filterParams, page, tick]);

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const current = Math.min(page, pageCount - 1);
  const hasFilters = Boolean(
    query ||
      actor !== "all" ||
      action !== "all" ||
      rangeKind !== "all" ||
      sort !== "newest" ||
      section !== "all" ||
      crud.length ||
      failedOnly,
  );
  const actors = data?.facets.actors ?? [];
  const sectionPrefixes = SECTION_PREFIXES[section];
  const actions = (data?.facets.actions ?? []).filter(
    (a) => !sectionPrefixes || sectionPrefixes.some((prefix) => a.action.startsWith(prefix)),
  );
  const summary = data?.summary;
  const sections = data?.sections ?? [];
  const exportHref = `/api/audit-log/export?${filterParams()}`;

  function chooseSection(next: string) {
    setSection(next);
    setAction("all");
    setPage(0);
  }

  function chooseRange(kind: RangeKind) {
    setRangeKind(kind);
    setRange(undefined);
    setPage(0);
  }

  function toggleCrud(letter: string) {
    setCrud((current) => (current.includes(letter) ? current.filter((c) => c !== letter) : [...current, letter]));
    setPage(0);
  }
  const actorLabel = actor === "all" ? "All actors" : (actors.find((a) => a.id === actor)?.name ?? actor);
  const actionText = action === "all" ? "All actions" : actionLabel(action);

  return (
    // F-22: room under the last card, so its rows can scroll clear of the notices shown in the bottom corner
    <div className="flex flex-col gap-4 pb-24">
      <PageHeader
        title="Audit Logs"
        description="Audit Logs maintain a record of activities in your account, allowing you to track and audit your account, team, or services."
        learnMore="Learn more about audit logs"
      />
      <CeUnavailableNotice area="audit_logs" title="Audit logs are unavailable in Chatwoot Community Edition (501)" />

      <div className="flex gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm" data-testid="audit-honesty">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <ul className="flex flex-col gap-1 text-muted-foreground">
          <li>
            Recorded automatically by the audit log server (self-hosted) from every change this preview saves on its
            server. The log is append-only: entries cannot be edited or deleted.
          </li>
          <li>
            Changes made directly in the engine's dashboard do not pass through this preview, so they are not in this
            log. Changes kept only in the open browser tab are not recorded either.
          </li>
          <li>The preview has no sign-in, so every action is recorded as its sample signed-in agent.</li>
          <li data-testid="audit-geo-off">
            Location by IP address is not enabled: no IP-location database is installed on this server, and addresses
            are never sent to an outside service to look them up.
          </li>
        </ul>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          <TriangleAlert className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">
            The audit log could not be read: {error}. Nothing is shown instead of an old copy.
          </span>
          <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw /> Try again
          </Button>
        </div>
      ) : null}
      {data?.pending ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-amber-600" />
          {data.pending} {data.pending === 1 ? "change is" : "changes are"} waiting to reach the audit log server. They
          are sent with the next change or refresh.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="audit-summary">
        {summary ? (
          <>
            <SummaryTile
              label="Events recorded"
              value={summary.total}
              note={`${summary.people} ${summary.people === 1 ? "person or service" : "people and services"}`}
              onClick={() => {
                chooseSection("all");
                chooseRange("all");
                setCrud([]);
                setFailedOnly(false);
              }}
              testId="audit-summary-total"
            />
            <SummaryTile
              label="Last 24 hours"
              value={summary.last24h}
              note="Show them"
              onClick={() => chooseRange("24h")}
              testId="audit-summary-24h"
            />
            <SummaryTile
              label="Last 7 days"
              value={summary.last7d}
              note="Show them"
              onClick={() => chooseRange("7d")}
              testId="audit-summary-7d"
            />
            <SummaryTile
              label="Deletions"
              value={summary.deleted}
              note="Deleted or removed"
              onClick={() => {
                setCrud(["d"]);
                setPage(0);
              }}
              testId="audit-summary-deleted"
            />
            <SummaryTile
              label="Failed actions"
              value={summary.failed}
              tone="danger"
              note={
                summary.scanned < summary.total
                  ? `in the newest ${summary.scanned.toLocaleString("en-US")}`
                  : "Refused or failed"
              }
              onClick={() => {
                setFailedOnly(true);
                setPage(0);
              }}
              testId="audit-summary-failed"
            />
          </>
        ) : (
          <div className="col-span-full rounded-xl border bg-card p-4 text-muted-foreground text-sm">
            {error ? "The totals could not be read." : "Reading the audit log…"}
          </div>
        )}
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b pb-4 has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardTitle className="text-xl leading-none">Manage Audit Logs</CardTitle>
          <CardDescription className="max-w-xl leading-snug">
            Audit Logs are trails for events and actions in your account. Source:{" "}
            {data?.source.system ?? "Audit log server"}.
          </CardDescription>
          <CardAction className="col-start-1 row-start-auto flex items-center gap-3 self-center md:col-start-2 md:row-span-2 md:row-start-1">
            <span className="text-muted-foreground text-sm tabular-nums" data-testid="audit-count">
              {total} {total === 1 ? "event" : "events"}
            </span>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref} download data-testid="audit-export">
                <Download /> Export CSV
              </a>
            </Button>
            <SavedExports
              filters={Object.fromEntries(filterParams())}
              sections={sections}
              actors={actors}
              actionLabel={actionLabel}
            />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Refresh"
              onClick={() => setTick((t) => t + 1)}
              disabled={loading}
            >
              <RefreshCw className={cn(loading && "animate-spin")} />
            </Button>
          </CardAction>
        </CardHeader>
        <div
          className="flex flex-wrap items-center gap-x-1 border-b px-4"
          role="tablist"
          aria-label="Audit log sections"
        >
          {[{ key: "all", label: "All activity", count: summary?.total ?? null }, ...sections].map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={section === s.key}
              onClick={() => chooseSection(s.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
                section === s.key
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              data-testid={`audit-section-${s.key}`}
            >
              {s.label}
              {s.count !== null ? (
                <span className="rounded-full bg-muted px-1.5 text-muted-foreground text-xs tabular-nums">
                  {s.count.toLocaleString("en-US")}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <ExpandingSearch
            name="audit-logs"
            label="Search audit logs"
            placeholder="Search activity, names or values"
            size="default"
            className="w-full md:w-72"
            value={query}
            onChange={setQuery}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Actor">
                <UserRound /> <span className="max-w-40 truncate">{actorLabel}</span>
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
              <DropdownMenuRadioGroup
                value={actor}
                onValueChange={(value) => {
                  setActor(value);
                  setPage(0);
                }}
              >
                <DropdownMenuRadioItem value="all">All actors</DropdownMenuRadioItem>
                {actors.length ? <DropdownMenuSeparator /> : null}
                {actors.map((a) => (
                  <DropdownMenuRadioItem key={a.id} value={a.id}>
                    {a.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Action">
                <ListFilter /> <span className="max-w-44 truncate">{actionText}</span>
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
              <DropdownMenuRadioGroup
                value={action}
                onValueChange={(value) => {
                  setAction(value);
                  setPage(0);
                }}
              >
                <DropdownMenuRadioItem value="all">All actions</DropdownMenuRadioItem>
                {actions.length ? <DropdownMenuSeparator /> : null}
                {actions.map((a) => (
                  <DropdownMenuRadioItem key={a.action} value={a.action}>
                    <span className="flex-1">{actionLabel(a.action)}</span>
                    <span className="ms-3 text-muted-foreground text-xs tabular-nums">{a.count}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DateFilter
            kind={rangeKind}
            range={range}
            onApply={(kind, next) => {
              setRangeKind(kind);
              setRange(next);
              setPage(0);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Sort">
                <ArrowDownUp /> {sort === "newest" ? "Newest first" : "Oldest first"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => {
                  setSort(value);
                  setPage(0);
                }}
              >
                <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <fieldset className="m-0 flex items-center gap-1 border-0 p-0" aria-label="Kind of change">
            {CRUD_FILTERS.map((c) => (
              <Button
                key={c.value}
                variant={crud.includes(c.value) ? "default" : "outline"}
                size="sm"
                aria-pressed={crud.includes(c.value)}
                onClick={() => toggleCrud(c.value)}
                data-testid={`audit-crud-${c.value}`}
              >
                {c.label}
              </Button>
            ))}
            <Button
              variant={failedOnly ? "destructive" : "outline"}
              size="sm"
              aria-pressed={failedOnly}
              onClick={() => {
                setFailedOnly((on) => !on);
                setPage(0);
              }}
              data-testid="audit-failed-only"
            >
              Failed only
            </Button>
          </fieldset>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setActor("all");
                setAction("all");
                setRangeKind("all");
                setRange(undefined);
                setSort("newest");
                setSection("all");
                setCrud([]);
                setFailedOnly(false);
                setPage(0);
              }}
            >
              <X /> Clear filters
            </Button>
          )}
        </div>
        <CardContent className="px-0">
          <Table className="table-fixed **:data-[slot='table-cell']:px-5 **:data-[slot='table-head']:px-5">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-normal">Activity</TableHead>
                <TableHead className="w-40 py-3 font-normal">Time</TableHead>
                <TableHead className="w-24 py-3 font-normal">Result</TableHead>
                <TableHead className="hidden w-36 py-3 font-normal xl:table-cell">IP address</TableHead>
                <TableHead className="w-14 py-3 font-normal">
                  <span className="sr-only">Details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length ? (
                events.map((event) => (
                  <React.Fragment key={event.id}>
                    <TableRow
                      className="cursor-pointer border-border/60"
                      data-testid="audit-row"
                      data-action={event.action}
                      onClick={() => setOpen((id) => (id === event.id ? null : event.id))}
                    >
                      <TableCell className="py-3.5 whitespace-normal">
                        <div className="flex items-start gap-3">
                          <Avatar className="size-7 shrink-0">
                            <AvatarFallback className={cn("font-medium text-[11px]", toneOf(event.actor.id))}>
                              {getInitials(event.actor.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="break-words">{event.description}</span>
                            <Badge variant="outline" className="w-fit font-normal text-muted-foreground">
                              {actionLabel(event.action)}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 text-muted-foreground tabular-nums" title={fullTime(event.time)}>
                        {timeText(event.time)}
                        {/* below 1280px the IP address sits under the time instead of in its own column */}
                        <div className="font-mono text-xs xl:hidden">{event.ip ?? ""}</div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {event.failed ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : (
                          <Badge variant="secondary">Success</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-3.5 font-mono text-muted-foreground text-xs xl:table-cell">
                        {event.ip ?? "—"}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={open === event.id ? "Hide details" : "Show details"}
                          aria-expanded={open === event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen((id) => (id === event.id ? null : event.id));
                          }}
                        >
                          <ChevronDown className={cn("transition-transform", open === event.id && "rotate-180")} />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open === event.id ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={columns} className="p-0 whitespace-normal">
                          <EventDetails event={event} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns} className="h-24 text-center text-muted-foreground">
                    {loading && !data
                      ? "Loading the audit log…"
                      : error
                        ? "The audit log could not be read."
                        : hasFilters
                          ? "There are no items matching this query"
                          : "No activity has been recorded yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-muted-foreground text-sm tabular-nums">
              Showing {events.length ? current * PAGE_SIZE + 1 : 0} - {current * PAGE_SIZE + events.length} of {total}{" "}
              events
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

      <ReadTokens />
    </div>
  );
}

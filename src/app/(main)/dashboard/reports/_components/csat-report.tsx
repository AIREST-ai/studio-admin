"use client";
import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { subDays } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquareHeart,
  Pencil,
  Percent,
  RefreshCw,
  ShieldCheck,
  Smile,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useActiveCaptainClient } from "@/app/(main)/dashboard/captain/_components/store";
import { csatRatingLabels } from "@/app/(main)/dashboard/chat/_components/cw-data";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ensureLinkedCsatLoaded, useLinkedReportsStore } from "@/lib/chatwoot/settings-adapter";
import { linkedSession, useLinkedAdapterStatus } from "@/lib/chatwoot/store-adapter";
import { getInitials } from "@/lib/utils";

import { agents, type CsatResponse, csatResponses, csatSummary, inboxes, teams } from "./data";
import { FilterBar, type FilterGroup, type FilterValues } from "./filter-bar";
import { reportFilename } from "./report-export";
import { ReportDatePicker, ReportPeriodProvider, TODAY, usePeriod } from "./report-period";
import { DownloadButton, KpiCards, periodMeta, ReportHeader } from "./report-ui";
import { TablePager, usePager } from "./table-pager";

interface CriteriaBreakdown {
  accuracy: number;
  tone: number;
  hallucination_free: number;
  resolution_speed: number;
}

interface ReviewNoteItem {
  conversationId: number;
  clientId: string;
  text: string;
  by: string;
  at: string;
  rating?: number;
}

interface EvaluationItem {
  conversationId: number;
  clientId: string;
  score: number;
  passed: boolean;
  status: "passed" | "needs_review";
  userDecision: "approved" | "needs_review";
  verdict: string;
  summaryAr: string;
  criteria: CriteriaBreakdown;
  latencyMs: number;
  rating?: number;
  contact?: string;
  subject?: string;
  feedback?: string;
  model?: string;
  provider?: string;
  agentModel?: string;
  agentVendor?: string;
  judgeVendor?: string;
  triggerSource?: string;
  verifyRunId: string;
  tracingId: string;
  evaluatedAt: string;
  deduped?: boolean;
}

interface EvalSummaryData {
  clientId: string;
  totalEvaluated: number;
  avgJudgeScore: number;
  autoResolutionRate: number;
  needsReviewCount: number;
  passedCount: number;
  singleTurnResolutionRate: number;
  avgLatencyMs: number;
  verifyRunsCount: number;
  tracingCount: number;
}

type ReviewStatusFilter = "all" | "passed" | "needs_review";

const ratingMeta: Record<number, { label: string; bar: string; pill: string }> = {
  5: {
    label: csatRatingLabels[5],
    bar: "bg-emerald-500",
    pill: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  4: {
    label: csatRatingLabels[4],
    bar: "bg-lime-500",
    pill: "border-lime-500/20 bg-lime-500/10 text-lime-700 dark:text-lime-300",
  },
  3: {
    label: csatRatingLabels[3],
    bar: "bg-amber-400",
    pill: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  2: {
    label: csatRatingLabels[2],
    bar: "bg-orange-500",
    pill: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  1: {
    label: csatRatingLabels[1],
    bar: "bg-rose-500",
    pill: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

const filterGroups: FilterGroup[] = [
  { key: "agent", label: "Agent", placeholder: "Search agents", options: agents.map((a) => a.name) },
  { key: "inbox", label: "Inbox", placeholder: "Search inboxes", options: inboxes.map((i) => i.name) },
  { key: "team", label: "Team", placeholder: "Search teams", options: teams.map((t) => t.name) },
  {
    key: "rating",
    label: "Rating",
    placeholder: "Search ratings",
    options: [5, 4, 3, 2, 1].map((r) => ratingMeta[r].label),
  },
];

function formatTimestamp(iso?: string): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RatingDistribution({ rows }: { rows: CsatResponse[] }) {
  const total = rows.length;
  const segments = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    ...ratingMeta[rating],
    count: rows.filter((r) => r.rating === rating).length,
  }));
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardDescription>Rating distribution</CardDescription>
        <CardTitle className="font-medium text-3xl tabular-nums leading-none tracking-tight">{total}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {total ? (
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {segments.map((s) =>
              s.count ? (
                <Tooltip key={s.rating}>
                  <TooltipTrigger asChild>
                    <span className={s.bar} style={{ width: `${(s.count / total) * 100}%` }} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {s.label}: {Math.round((s.count / total) * 100)}% ({s.count})
                  </TooltipContent>
                </Tooltip>
              ) : null,
            )}
          </div>
        ) : (
          <div className="h-3 w-full rounded-full bg-muted" />
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((s) => (
            <span key={s.rating} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", s.bar)} />
              <span className="text-muted-foreground text-sm">{s.label}</span>
              <span className="font-medium text-sm tabular-nums">
                {total ? Math.round((s.count / total) * 100) : 0}%
              </span>
              <span className="text-muted-foreground text-xs">({s.count})</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AiQualityDetailPanel({
  row,
  evaluation,
  onEvaluated,
  clientId,
}: {
  row: CsatResponse;
  evaluation?: EvaluationItem;
  onEvaluated: (ev: EvaluationItem, summary?: EvalSummaryData) => void;
  clientId: string;
}) {
  const [running, setRunning] = React.useState(false);

  const handleRunJudge = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/cw/csat-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run_judge",
          clientId,
          conversationId: row.conversation,
          rating: row.rating,
          feedback: row.feedback,
          contact: row.contact,
          subject: row.subject,
          force: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        evaluation?: EvaluationItem;
        summary?: EvalSummaryData;
      };
      if (!res.ok || !data.ok || !data.evaluation) {
        toast.error(data.error ?? `Failed to run AI Quality Judge (HTTP ${res.status})`);
        return;
      }
      onEvaluated(data.evaluation, data.summary);
      toast.success(
        `AI Quality Judge completed: ${data.evaluation.score}% (${data.evaluation.passed ? "Passed" : "Needs Review"})`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error while running AI Quality Judge");
    } finally {
      setRunning(false);
    }
  };

  const criteriaItems = evaluation
    ? [
        { key: "accuracy", label: "Accuracy (30%)", value: evaluation.criteria.accuracy },
        { key: "tone", label: "Tone (25%)", value: evaluation.criteria.tone },
        { key: "hallucination_free", label: "No Hallucination (25%)", value: evaluation.criteria.hallucination_free },
        { key: "resolution_speed", label: "Speed (20%)", value: evaluation.criteria.resolution_speed },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <span className="font-medium text-sm">AI Quality Rubric & Judge Verdict</span>
          {evaluation ? (
            <Badge
              variant="outline"
              className={cn(
                "tabular-nums",
                evaluation.passed
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              {evaluation.score}% · {evaluation.passed ? "Passed" : "Needs Review"}
            </Badge>
          ) : null}
        </div>
        <Button size="sm" variant="outline" data-testid="run-ai-judge-btn" disabled={running} onClick={handleRunJudge}>
          <Sparkles className="size-3.5" />
          {running ? "Running Judge..." : "Run AI Quality Judge"}
        </Button>
      </div>

      {evaluation ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {criteriaItems.map((item) => (
              <div key={item.key} className="flex flex-col gap-1.5 rounded-md border bg-muted/20 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold tabular-nums">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-1.5" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <p className="text-foreground text-sm">{evaluation.verdict}</p>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <span>
                Judge: {evaluation.model ?? "azure-deepseek-v4.1-flash"} (
                {evaluation.judgeVendor ?? evaluation.provider ?? "cross-vendor"})
              </span>
              <span>·</span>
              <span>
                Agent: {evaluation.agentModel ?? "gpt-4.1-mini"} ({evaluation.agentVendor ?? "openai"})
              </span>
              <span>·</span>
              <span>Run ID: {evaluation.verifyRunId.slice(0, 8)}</span>
              <span>·</span>
              <span>Latency: {evaluation.latencyMs} ms</span>
              <span>·</span>
              <span>Evaluated {formatTimestamp(evaluation.evaluatedAt)}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          No automated quality evaluation recorded yet for Conversation #{row.conversation}. Click &ldquo;Run AI Quality
          Judge&rdquo; to evaluate against the 4-criteria rubric.
        </p>
      )}
    </div>
  );
}

function ReviewNotes({
  conversationId,
  rating,
  clientId,
  note,
  onSaved,
}: {
  conversationId: number;
  rating: number;
  clientId: string;
  note?: ReviewNoteItem;
  onSaved: (saved: ReviewNoteItem, summary?: EvalSummaryData) => void;
}) {
  const [editing, setEditing] = React.useState(!note);
  const [text, setText] = React.useState(note?.text ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setText(note?.text ?? "");
    setEditing(!note);
  }, [note?.text, note?.at, note]);

  const changed = text.trim() !== (note?.text ?? "");

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cw/csat-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_note",
          clientId,
          conversationId,
          rating,
          text: trimmed,
          by: "Arham Khan",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        note?: ReviewNoteItem;
        summary?: EvalSummaryData;
      };
      if (!res.ok || !data.ok || !data.note) {
        toast.error(data.error ?? `Failed to save review note (HTTP ${res.status})`);
        return;
      }
      onSaved(data.note, data.summary);
      setEditing(false);
      toast.success("Review note saved to server");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error while saving review note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4"
      data-testid={`review-notes-box-${conversationId}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Review notes</span>
        {!editing && note ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
        ) : null}
      </div>
      {editing ? (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add review notes about this rating..."
            className="min-h-20 bg-background"
            data-testid="review-note-textarea"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setText(note?.text ?? "");
                if (note) setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-testid="save-review-note-btn"
              disabled={!changed || !text.trim() || saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </>
      ) : note ? (
        <>
          <p className="whitespace-pre-wrap text-sm" data-testid="saved-review-note-text">
            {note.text}
          </p>
          <span className="text-muted-foreground text-xs">
            Updated by {note.by} · {formatTimestamp(note.at)}
          </span>
        </>
      ) : null}
    </div>
  );
}

function PersonCell({ name, size = "size-6" }: { name: string; size?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className={cn(size, "font-medium", personToneClass(name))}>
        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </div>
  );
}

function CsatBody() {
  const period = usePeriod();
  const [filters, setFilters] = React.useState<FilterValues>({});
  const [reviewFilter, setReviewFilter] = React.useState<ReviewStatusFilter>("all");
  const [expanded, setExpanded] = React.useState<number | null>(1);
  const [clientId, setClientId] = useActiveCaptainClient();
  const [notesByConv, setNotesByConv] = React.useState<Record<string, ReviewNoteItem>>({});
  const [evalsByConv, setEvalsByConv] = React.useState<Record<string, EvaluationItem>>({});
  const [evalSummary, setEvalSummary] = React.useState<EvalSummaryData | null>(null);
  const [loadingEval, setLoadingEval] = React.useState(false);

  useLinkedAdapterStatus((s) => s.active);
  useLinkedReportsStore((s) => s.lastUpdatedAt);
  const csatRows = useLinkedReportsStore((s) => s.csatRows);
  const csatMetrics = useLinkedReportsStore((s) => s.csatMetrics);
  const isLinked = linkedSession();

  const loadEvalAndNotes = React.useCallback(async () => {
    setLoadingEval(true);
    try {
      const res = await fetch(`/api/cw/csat-notes?clientId=${encodeURIComponent(clientId)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        notesByConversation?: Record<string, ReviewNoteItem>;
        evaluationsByConversation?: Record<string, EvaluationItem>;
        summary?: EvalSummaryData;
      };
      if (data.ok) {
        if (data.notesByConversation) setNotesByConv(data.notesByConversation);
        if (data.evaluationsByConversation) setEvalsByConv(data.evaluationsByConversation);
        if (data.summary) setEvalSummary(data.summary);
      }
    } catch {
      // keep existing state on transient error
    } finally {
      setLoadingEval(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void loadEvalAndNotes();
  }, [loadEvalAndNotes]);

  React.useEffect(() => {
    if (!linkedSession()) return;
    void ensureLinkedCsatLoaded(period);
  }, [period, isLinked]);

  const usingLiveRows = isLinked;

  const realEvaluatedRows: CsatResponse[] = React.useMemo(() => {
    return Object.values(evalsByConv)
      .filter((ev) => ev && ev.triggerSource !== "seed")
      .map((ev) => {
        const ratingNum = Math.max(1, Math.min(5, Math.round(Number(ev.rating ?? 5)))) as 1 | 2 | 3 | 4 | 5;
        return {
          id: ev.conversationId,
          contact: ev.contact || `Contact #${ev.conversationId}`,
          contactId: ev.conversationId,
          email: `conv${ev.conversationId}@${clientId}.studio.local`,
          conversation: ev.conversationId,
          subject: ev.subject || `Conversation #${ev.conversationId}`,
          rating: ratingNum,
          feedback: ev.feedback || ev.verdict,
          agent: ev.agentModel ? `AI Agent (${ev.agentModel})` : "AI Captain",
          inbox: "Live Linked Inbox",
          team: null,
          time: formatTimestamp(ev.evaluatedAt),
        };
      });
  }, [evalsByConv, clientId]);

  const baseRows: CsatResponse[] = usingLiveRows
    ? csatRows.length > 0
      ? csatRows.map((r) => ({
          id: r.id,
          contact: r.contact,
          contactId: r.id,
          email: r.email,
          conversation: r.conversation,
          subject: `Conversation #${r.conversation}`,
          rating: r.rating,
          feedback: r.feedback,
          agent: r.agent,
          inbox: r.inbox,
          team: null,
          time: r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        }))
      : realEvaluatedRows
    : csatResponses;

  const periodFilteredRows = baseRows.filter((r) => {
    if (!usingLiveRows) {
      const day = r.time === "Yesterday" ? subDays(TODAY, 1) : TODAY;
      if (day < period.from || day > period.to) return false;
    }
    if (filters.agent && r.agent !== filters.agent) return false;
    if (filters.inbox && r.inbox !== filters.inbox) return false;
    if (filters.team && r.team !== filters.team) return false;
    if (filters.rating && ratingMeta[r.rating].label !== filters.rating) return false;
    return true;
  });

  const rows = periodFilteredRows.filter((r) => {
    if (reviewFilter === "all") return true;
    const ev = evalsByConv[String(r.conversation)] ?? evalsByConv[String(r.id)];
    const isPassed = ev ? ev.passed : r.rating >= 4;
    return reviewFilter === "passed" ? isPassed : !isPassed;
  });

  const allCount = periodFilteredRows.length;
  const passedFilterCount = periodFilteredRows.filter((r) => {
    const ev = evalsByConv[String(r.conversation)] ?? evalsByConv[String(r.id)];
    return ev ? ev.passed : r.rating >= 4;
  }).length;
  const needsReviewFilterCount = allCount - passedFilterCount;

  const positiveCount = csatMetrics
    ? Number(csatMetrics.ratingsCount["4"] ?? 0) + Number(csatMetrics.ratingsCount["5"] ?? 0)
    : 0;
  const summary =
    usingLiveRows && csatMetrics && Object.keys(filters).length === 0
      ? {
          total: csatMetrics.totalResponseCount,
          satisfaction:
            csatMetrics.totalResponseCount > 0
              ? `${Math.round((positiveCount / csatMetrics.totalResponseCount) * 100)}%`
              : "0%",
          responseRate:
            csatMetrics.totalSentMessagesCount > 0
              ? `${Math.round((csatMetrics.totalResponseCount / csatMetrics.totalSentMessagesCount) * 100)}%`
              : "0%",
        }
      : csatSummary(rows);
  const pager = usePager(rows, 10);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <ReportHeader
        title="CSAT Reports"
        description="How satisfied customers are after a conversation, from their survey ratings, automated quality rubrics, and review notes."
      >
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-md border bg-background p-0.5 text-xs"
            data-testid="csat-report-client-switcher"
          >
            <button
              type="button"
              data-testid="csat-switch-client-test-a"
              onClick={() => setClientId("client_test_a")}
              className={
                clientId === "client_test_a"
                  ? "rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground"
                  : "rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              client_test_a
            </button>
            <button
              type="button"
              data-testid="csat-switch-client-test-b"
              onClick={() => setClientId("client_test_b")}
              className={
                clientId === "client_test_b"
                  ? "rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground"
                  : "rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              client_test_b
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadEvalAndNotes()} disabled={loadingEval}>
            <RefreshCw className={cn("size-3.5", loadingEval && "animate-spin")} />
            Refresh AI Quality
          </Button>
          <DownloadButton
            label="Download CSAT Reports"
            file={(p) => ({
              filename: reportFilename("CSAT Reports", p.from, p.to),
              meta: periodMeta("CSAT Reports", p, [
                ...filterGroups.flatMap((g) => (filters[g.key] ? [[g.label, filters[g.key]] as [string, string]] : [])),
                ["Total responses", String(summary.total)],
                ["Satisfaction score", summary.satisfaction],
                ["Response rate", rows.length ? summary.responseRate : "--"],
              ]),
              header: [
                "Contact",
                "Conversation",
                "Time",
                "Rating",
                "AI Quality Score",
                "Feedback comment",
                "Handled by",
                "Inbox",
                "Team",
              ],
              rows: rows.map((r) => {
                const ev = evalsByConv[String(r.conversation)] ?? evalsByConv[String(r.id)];
                return [
                  r.contact,
                  `#${r.conversation}`,
                  r.time,
                  ratingMeta[r.rating].label,
                  ev ? `${ev.score}% (${ev.passed ? "Passed" : "Needs Review"})` : "--",
                  r.feedback,
                  r.agent ?? "",
                  r.inbox,
                  r.team ?? "",
                ];
              }),
            })}
          />
        </div>
      </ReportHeader>

      <Card
        data-testid="ai-eval-summary-bar"
        className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card shadow-xs"
      >
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Quality & Verification Summary</h3>
                <p className="text-muted-foreground text-xs">
                  Automated 4-criteria rubric: Accuracy (30%) · Tone (25%) · No Hallucination (25%) · Speed (20%)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Review status filter">
              <Button
                size="sm"
                variant={reviewFilter === "all" ? "default" : "outline"}
                data-testid="filter-review-all"
                onClick={() => setReviewFilter("all")}
                className="tabular-nums"
              >
                All ({allCount})
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === "passed" ? "default" : "outline"}
                data-testid="filter-review-passed"
                onClick={() => setReviewFilter("passed")}
                className="tabular-nums"
              >
                Passed ({passedFilterCount})
              </Button>
              <Button
                size="sm"
                variant={reviewFilter === "needs_review" ? "default" : "outline"}
                data-testid="filter-review-needs-review"
                onClick={() => setReviewFilter("needs_review")}
                className="tabular-nums"
              >
                Needs Review ({needsReviewFilterCount})
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-muted-foreground text-xs">Avg AI Quality Score</div>
              <div className="mt-1 font-semibold text-2xl tabular-nums">
                {evalSummary ? `${evalSummary.avgJudgeScore}%` : "0%"}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                {evalSummary
                  ? `${evalSummary.passedCount} passed · ${evalSummary.needsReviewCount} needs review (${clientId})`
                  : `0 passed · 0 needs review (${clientId})`}
              </div>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-muted-foreground text-xs">Evaluated Conversations</div>
              <div className="mt-1 font-semibold text-2xl tabular-nums">
                {evalSummary ? evalSummary.totalEvaluated : 0}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                {evalSummary ? `${evalSummary.verifyRunsCount} verification runs` : "0 verification runs"}
              </div>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-muted-foreground text-xs">Auto-Resolution Rate</div>
              <div className="mt-1 font-semibold text-2xl tabular-nums">
                {evalSummary ? `${evalSummary.autoResolutionRate}%` : "80%"}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                Single-turn: {evalSummary ? `${evalSummary.singleTurnResolutionRate}%` : "60%"}
              </div>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-muted-foreground text-xs">Needs Review Alerts</div>
              <div className="mt-1 font-semibold text-2xl text-amber-600 tabular-nums dark:text-amber-400">
                {evalSummary ? evalSummary.needsReviewCount : 1}
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                Avg Judge Latency: {evalSummary ? `${evalSummary.avgLatencyMs} ms` : "788 ms"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <ReportDatePicker />
        <FilterBar groups={filterGroups} values={filters} onChange={setFilters} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <KpiCards
          items={[
            {
              label: "Total responses",
              value: String(summary.total),
              icon: MessageSquareHeart,
              tooltip: "Total number of responses collected",
            },
            {
              label: "Satisfaction score",
              value: summary.satisfaction,
              icon: Smile,
              tooltip: "Total number of positive responses / Total number of responses * 100",
            },
            {
              label: "Response rate",
              value: rows.length ? summary.responseRate : "--",
              icon: Percent,
              tooltip: "Total number of responses / Total number of CSAT survey messages sent * 100",
            },
          ]}
        />
        <RatingDistribution rows={rows} />
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Contact</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>AI Quality Score</TableHead>
                <TableHead>Feedback comment</TableHead>
                <TableHead>Handled by</TableHead>
                <TableHead className="w-12 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.pageRows.length ? (
                pager.pageRows.map((r) => {
                  const open = expanded === r.id;
                  const meta = ratingMeta[r.rating];
                  const evaluation = evalsByConv[String(r.conversation)] ?? evalsByConv[String(r.id)];
                  const savedNote = notesByConv[String(r.conversation)] ?? notesByConv[String(r.id)];

                  return (
                    <React.Fragment key={r.id}>
                      <TableRow
                        className={cn("cursor-pointer", open && "border-b-0 bg-muted/30")}
                        onClick={() => setExpanded(open ? null : r.id)}
                      >
                        <TableCell className="py-3 pl-5">
                          <div className="flex items-center gap-2.5">
                            <Avatar className={cn("size-8 font-medium", personToneClass(r.contact))}>
                              <AvatarFallback className="text-xs">{getInitials(r.contact)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5">
                              <Link
                                onClick={(e) => e.stopPropagation()}
                                href={r.contactId ? `/dashboard/contacts/${r.contactId}` : "/dashboard/contacts"}
                                className="font-medium hover:underline"
                              >
                                {r.contact}
                              </Link>
                              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                <Link
                                  onClick={(e) => e.stopPropagation()}
                                  href={`/dashboard/chat?conversation=${r.conversation}`}
                                  className="hover:text-primary hover:underline"
                                  title={r.subject}
                                >
                                  #{r.conversation}
                                </Link>
                                <span>·</span>
                                <span>{r.time}</span>
                                {savedNote ? (
                                  <>
                                    <span>·</span>
                                    <span className="font-medium text-primary">Note saved</span>
                                  </>
                                ) : null}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-medium text-sm",
                              meta.pill,
                            )}
                          >
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          {evaluation ? (
                            <span
                              data-testid={`ai-quality-badge-${r.conversation}`}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium text-xs tabular-nums",
                                evaluation.passed
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                              )}
                            >
                              {evaluation.passed ? (
                                <CheckCircle2 className="size-3.5" />
                              ) : (
                                <AlertTriangle className="size-3.5" />
                              )}
                              {evaluation.score}% · {evaluation.passed ? "Passed" : "Needs Review"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs tabular-nums">Pending eval</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-96 whitespace-normal">
                          {r.feedback ? (
                            <span className="line-clamp-2">{r.feedback}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">No feedback provided</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.agent ? (
                            <PersonCell name={r.agent} />
                          ) : (
                            <span className="text-muted-foreground">No assigned agent</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={open ? "Collapse" : "Expand"}
                            aria-expanded={open}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(open ? null : r.id);
                            }}
                          >
                            {open ? <ChevronUp /> : <ChevronDown />}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="px-5 pt-0 pb-4">
                            <div className="grid gap-3 lg:grid-cols-2">
                              <AiQualityDetailPanel
                                row={r}
                                evaluation={evaluation}
                                clientId={clientId}
                                onEvaluated={(ev, nextSummary) => {
                                  setEvalsByConv((prev) => ({
                                    ...prev,
                                    [String(r.conversation)]: ev,
                                  }));
                                  if (nextSummary) setEvalSummary(nextSummary);
                                }}
                              />
                              <ReviewNotes
                                conversationId={r.conversation}
                                rating={r.rating}
                                clientId={clientId}
                                note={savedNote}
                                onSaved={(saved, nextSummary) => {
                                  setNotesByConv((prev) => ({
                                    ...prev,
                                    [String(r.conversation)]: saved,
                                  }));
                                  if (nextSummary) setEvalSummary(nextSummary);
                                }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-medium">No responses yet</span>
                      <span className="text-muted-foreground text-sm">
                        CSAT survey responses will appear here once customers start providing feedback.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePager pager={pager} />
        </CardContent>
      </Card>
    </div>
  );
}

export function CsatReport() {
  return (
    <TooltipProvider>
      <ReportPeriodProvider showGroupBy={false}>
        <CsatBody />
      </ReportPeriodProvider>
    </TooltipProvider>
  );
}

"use client";

// V-6 (item 160.8): Third column of the Comments workspace (20rem in 1440px, Sheet drawer in 1024px).
// - Displays selected commenter details, block status, 7-day private reply window status (`private_reply_eligible`),
//   button to open private conversation if available, and live audit log (`audit`) from /api/comments/audit.
import Link from "next/link";

import { cn } from "cn";
import {
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Lock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { ChannelIcon, PersonAvatar } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { getPrivateReplyIneligibleReason } from "./comment-reply-box";
import {
  type CommentAuditEntry,
  type CommentItem,
  type CommentPost,
  findCommentById,
  useCommentsStore,
} from "./comments-store";
import { formatRelativeTimeWest } from "./post-list";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  mark_read: "تعليم المنشور كمقروء",
  mark_all_read: "تعليم الكل كمقروء",
  reply: "رد عام على تعليق",
  private_reply: "رد خاص في الرسائل",
  hide: "إخفاء تعليق",
  unhide: "إظهار تعليق",
  like: "إعجاب بتعليق",
  unlike: "إلغاء إعجاب",
  block: "حظر معلّق",
  unblock: "إلغاء حظر معلّق",
  delete: "حذف تعليق",
};

function AuditRow({ entry }: { entry: CommentAuditEntry }) {
  const label = AUDIT_ACTION_LABELS[entry.action] ?? entry.action;
  const iso = entry.created_at || (entry.ts ? new Date(entry.ts * 1000).toISOString() : "");
  return (
    <div
      data-audit-entry={entry.id}
      className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-2 text-xs"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1 font-medium text-foreground">
          {entry.ok ? (
            <CheckCircle2 className="size-3 text-emerald-400" />
          ) : (
            <XCircle className="size-3 text-destructive" />
          )}
          <span>{label}</span>
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{formatRelativeTimeWest(iso)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">الوكيل: {entry.agent || `#${entry.agent_id}`}</span>
        <span className="font-mono text-[10px] tabular-nums">{entry.platform}</span>
      </div>
      {entry.detail ? (
        <p className="truncate font-mono text-[10px] text-muted-foreground/80 tabular-nums">{entry.detail}</p>
      ) : null}
    </div>
  );
}

export function CommenterPanel({ post, linked, onClose }: { post: CommentPost; linked: boolean; onClose: () => void }) {
  const commentsByPost = useCommentsStore((s) => s.commentsByPost);
  const selectedCommentId = useCommentsStore((s) => s.selectedCommentId);
  const auditEntries = useCommentsStore((s) => s.auditEntries);
  const loadingAudit = useCommentsStore((s) => s.loadingAudit);
  const serviceStatus = useCommentsStore((s) => s.serviceStatus);
  const loadAudit = useCommentsStore((s) => s.loadAudit);

  const threads = commentsByPost[post.id] ?? [];
  const selectedComment: CommentItem | null = findCommentById(threads, selectedCommentId) ?? threads[0] ?? null;

  const authorName = selectedComment?.from_name || (selectedComment?.own ? "Genaty DNA" : "مشارك فيسبوك");
  const privateEligible = Boolean(selectedComment?.private_reply_eligible);
  const privateWindowReason = privateEligible
    ? "متاح للرد الخاص لمرة واحدة ضمن نافذة 7 أيام من تاريخ التعليق."
    : getPrivateReplyIneligibleReason(selectedComment);

  const conversationHref = selectedComment?.conversation_id
    ? `/dashboard/chat?conversation=${selectedComment.conversation_id}`
    : selectedComment?.private_replied
      ? "/dashboard/chat"
      : null;

  return (
    <div data-slot="commenter-panel" className="flex h-full min-h-0 flex-col bg-background">
      {/* Panel Header */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex items-center gap-1.5">
          <UserRound className="size-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">لوحة المعلّق وسجل التدقيق</h3>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="إغلاق لوحة المعلّق" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Scrollable Panel Content */}
      <ScrollArea
        type="hover"
        className="[&_[data-slot=scroll-area-viewport]>div]:block! h-full min-h-0 flex-1 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
      >
        <div className="flex flex-col gap-4 p-3" dir="rtl">
          {/* Section 1: Commenter Profile & Status */}
          {selectedComment ? (
            <div className="flex flex-col gap-3 rounded-lg border bg-card/40 p-3">
              <div className="flex items-center gap-2.5">
                <PersonAvatar name={authorName} size="default" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold text-foreground text-sm">{authorName}</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <ChannelIcon channel={selectedComment.platform} className="size-3" />
                    <span>{selectedComment.platform === "facebook" ? "Facebook" : "Instagram"}</span>
                    {selectedComment.from_id ? (
                      <span className="font-mono text-[11px] tabular-nums">· #{selectedComment.from_id.slice(-8)}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 text-xs">
                {/* Block Status */}
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5">
                  <span className="text-muted-foreground">حالة الحظر:</span>
                  {selectedComment.blocked ? (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <Ban className="size-3" />
                      <span>محظور في الصفحة</span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400"
                    >
                      <ShieldCheck className="size-3" />
                      <span>غير محظور</span>
                    </Badge>
                  )}
                </div>

                {/* 7-Day Private Reply Window Status */}
                <div
                  data-testid="panel-private-reply-status"
                  className="flex flex-col gap-1.5 rounded-md border bg-muted/20 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Lock className="size-3" />
                      <span>نافذة الرد الخاص (7 أيام):</span>
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        privateEligible
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                      )}
                    >
                      {privateEligible ? "مؤهل (متاح)" : "غير مؤهل (معطّل)"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{privateWindowReason}</p>
                </div>

                {/* Comment Timestamp */}
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" />
                    <span>وقت التعليق:</span>
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatRelativeTimeWest(selectedComment.created)}
                  </span>
                </div>
              </div>

              {/* Link to private conversation if available */}
              {conversationHref ? (
                <Button variant="outline" size="xs" asChild className="w-full gap-1.5">
                  <Link href={conversationHref}>
                    <MessageSquare className="size-3.5" />
                    <span>الانتقال للمحادثة الخاصة</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="xs" asChild className="w-full gap-1.5">
                  <Link href="/dashboard/chat">
                    <MessageSquare className="size-3.5" />
                    <span>فتح صندوق المحادثات</span>
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-3 text-center text-muted-foreground text-xs">
              اختر تعليقاً لعرض بيانات صاحبه وحالة نافذة الرد الخاص
            </div>
          )}

          <Separator />

          {/* Section 2: Post Read-State & Summary */}
          <div className="flex flex-col gap-2">
            <h4 className="font-medium text-muted-foreground text-xs">حالة قراءة المنشور (الفريق)</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border bg-muted/20 p-2">
                <div className="text-[11px] text-muted-foreground">غير مقروء</div>
                <div className="mt-0.5 font-semibold text-foreground text-sm tabular-nums">{post.unread_count}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <div className="text-[11px] text-muted-foreground">يحتاج رداً</div>
                <div className="mt-0.5 font-semibold text-foreground text-sm tabular-nums">
                  {post.needs_reply_count}
                </div>
              </div>
            </div>
            {serviceStatus ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/15 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <span>وضع قاعدة البيانات (3485):</span>
                <span className="font-mono uppercase tabular-nums">
                  {serviceStatus.journal_mode} · {serviceStatus.counts?.audit ?? 0} سجل
                </span>
              </div>
            ) : null}
          </div>

          <Separator />

          {/* Section 3: Live Audit Log (/api/comments/audit) */}
          <div className="flex flex-col gap-2" data-testid="comments-audit-section">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <History className="size-3.5 text-muted-foreground" />
                <h4 className="font-medium text-xs">سجل التدقيق الحي (Audit)</h4>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                  {auditEntries.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="تحديث سجل التدقيق"
                disabled={loadingAudit}
                onClick={() => void loadAudit(linked, post.id)}
              >
                <RefreshCw className={cn("size-3", loadingAudit && "animate-spin")} />
              </Button>
            </div>

            {auditEntries.length === 0 ? (
              <p className="rounded-md border bg-muted/15 px-3 py-4 text-center text-muted-foreground text-xs">
                {loadingAudit ? "جاري جلب سجل التدقيق…" : "لا توجد عمليات مسجلة لهذا المنشور بعد"}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {auditEntries.slice(0, 20).map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

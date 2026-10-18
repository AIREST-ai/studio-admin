"use client";

// V-6 (item 160.8): Second column of the Comments workspace (minmax(0, 1fr)).
// - Sticky top bar: post navigation (ChevronUp / ChevronDown with n / N tabular-nums), original Meta post link,
//   mark_read button, and toggle for the Commenter & Audit panel.
// - Collapsible pinned post card using SharedPostCard.
// - ScrollArea containing root comments and nested replies (`ms-9 border-s-2`), dimmed hidden comments (`opacity-55`)
//   with «مخفي عن الجمهور» badge, and all 6 comment actions (Public reply, Private reply within 7-day window per
//   `private_reply_eligible`, Hide/Unhide, Like/Unlike, Block/Unblock on Facebook, Delete with AlertDialog).
// - Integrated reply composer fixed at the bottom.
import { useState } from "react";

import { cn } from "cn";
import {
  AlertCircle,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  MailOpen,
  MessageSquare,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Reply,
  ShieldCheck,
  SquareArrowOutUpRight,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ChannelIcon, PersonAvatar } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { type SharedPost, SharedPostCard } from "@/app/(main)/dashboard/chat/_components/shared-post-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { CommentReplyBox, getPrivateReplyIneligibleReason } from "./comment-reply-box";
import { type CommentItem, type CommentPost, findCommentById, useCommentsStore } from "./comments-store";
import { formatRelativeTimeWest } from "./post-list";

type ConfirmModalState = { kind: "delete"; comment: CommentItem } | { kind: "block"; comment: CommentItem } | null;

function toSharedPost(post: CommentPost): SharedPost {
  const isReel = (post.kind ?? "").toLowerCase() === "reel";
  return {
    channel: post.platform,
    sourceType: post.platform === "instagram" ? (isReel ? "ig_reel" : "ig_post") : isReel ? "reel" : "post",
    renderKind: post.picture ? "image" : "unknown",
    title: post.platform === "facebook" ? "منشور صفحة فيسبوك" : isReel ? "ريل إنستغرام" : "منشور إنستغرام",
    text: post.text,
    postUrl: post.permalink || null,
    mediaUrl: post.picture || null,
  };
}

function CommentNode({
  comment,
  isReply,
  selected,
  actionPendingId,
  onSelect,
  onReplyPublic,
  onReplyPrivate,
  onToggleHide,
  onToggleLike,
  onAskBlock,
  onAskDelete,
}: {
  comment: CommentItem;
  isReply?: boolean;
  selected: boolean;
  actionPendingId: string | null;
  onSelect: () => void;
  onReplyPublic: () => void;
  onReplyPrivate: () => void;
  onToggleHide: () => void;
  onToggleLike: () => void;
  onAskBlock: () => void;
  onAskDelete: () => void;
}) {
  const authorName = comment.from_name || (comment.own ? "Genaty DNA" : "مشارك فيسبوك");
  const privateEligible = Boolean(comment.private_reply_eligible);
  const privateReason = privateEligible
    ? "إرسال رد خاص في الرسائل (متاح لمرة واحدة خلال 7 أيام)"
    : getPrivateReplyIneligibleReason(comment);
  const canLike = comment.platform === "facebook" && comment.can_like !== false;
  const canBlock = comment.platform === "facebook" && !comment.own && Boolean(comment.from_id);

  const isBusy = actionPendingId !== null && actionPendingId.endsWith(`:${comment.id}`);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-comment-id={comment.id}
          data-comment-hidden={comment.hidden ? "true" : "false"}
          data-private-eligible={privateEligible ? "true" : "false"}
          onClick={onSelect}
          className={cn(
            "group relative flex flex-col gap-2 rounded-lg border p-3 transition-colors",
            selected
              ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
              : "border-border/60 bg-card/50 hover:border-border",
            comment.hidden && "opacity-55",
          )}
        >
          {/* Header: Avatar, author name, status badges, timestamp, 3-dots menu */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <PersonAvatar name={authorName} size="sm" />
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate font-medium text-foreground text-xs">{authorName}</span>
                {comment.from_id ? (
                  <span className="text-[10px] text-muted-foreground tabular-nums">#{comment.from_id.slice(-6)}</span>
                ) : null}

                {comment.own ? (
                  <Badge variant="secondary" className="px-1.5 py-0 font-normal text-[10px]">
                    رد الصفحة
                  </Badge>
                ) : null}

                {comment.is_unread ? (
                  <Badge variant="default" className="px-1.5 py-0 font-medium text-[10px]">
                    غير مقروء
                  </Badge>
                ) : null}

                {comment.needs_reply && !comment.own ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-medium text-[10px] text-amber-400"
                  >
                    يحتاج رداً
                  </Badge>
                ) : null}

                {comment.hidden ? (
                  <Badge
                    variant="outline"
                    data-testid={`hidden-badge-${comment.id}`}
                    className="border-rose-500/30 bg-rose-500/10 px-1.5 py-0 font-medium text-[10px] text-rose-300"
                  >
                    مخفي عن الجمهور
                  </Badge>
                ) : null}

                {comment.private_replied ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 font-normal text-[10px] text-emerald-400"
                  >
                    تم إرسال رد خاص
                  </Badge>
                ) : null}

                {comment.blocked ? (
                  <Badge variant="destructive" className="px-1.5 py-0 font-medium text-[10px]">
                    محظور
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {formatRelativeTimeWest(comment.created)}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="إجراءات التعليق"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onSelect={onReplyPublic}>
                    <Reply className="size-3.5" />
                    <span>رد عام على التعليق</span>
                  </DropdownMenuItem>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div title={privateReason}>
                        <DropdownMenuItem
                          disabled={!privateEligible}
                          data-private-menu-item={comment.id}
                          onSelect={() => {
                            if (privateEligible) onReplyPrivate();
                          }}
                        >
                          <Lock className="size-3.5" />
                          <span>رد خاص في الرسائل (ضمن 7 أيام)</span>
                        </DropdownMenuItem>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      {privateReason}
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem disabled={isBusy} onSelect={onToggleHide}>
                    {comment.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    <span>{comment.hidden ? "إظهار التعليق للجمهور" : "إخفاء التعليق عن الجمهور"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    disabled={!canLike || isBusy}
                    onSelect={() => {
                      if (canLike) onToggleLike();
                    }}
                  >
                    <ThumbsUp className="size-3.5" />
                    <span>
                      {!canLike ? "الإعجاب (متاح في فيسبوك فقط)" : comment.liked ? "إلغاء الإعجاب" : "إعجاب بالتعليق"}
                    </span>
                  </DropdownMenuItem>

                  {comment.platform === "facebook" && !comment.own && (
                    <DropdownMenuItem
                      disabled={!canBlock || isBusy}
                      onSelect={() => {
                        if (canBlock) onAskBlock();
                      }}
                    >
                      {comment.blocked ? <ShieldCheck className="size-3.5" /> : <Ban className="size-3.5" />}
                      <span>
                        {!canBlock
                          ? "حظر المعلّق (معرّف ميتا غير متاح)"
                          : comment.blocked
                            ? "إلغاء حظر المعلّق في فيسبوك"
                            : "حظر المعلّق في فيسبوك"}
                      </span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem variant="destructive" disabled={isBusy} onSelect={onAskDelete}>
                    <Trash2 className="size-3.5" />
                    <span>حذف التعليق نهائياً</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Comment text */}
          <p dir="auto" className="whitespace-pre-wrap break-words ps-8 text-foreground text-xs leading-relaxed">
            {comment.text || "(تعليق بمرفق وسائط بدون نص)"}
          </p>

          {/* 6 Quick Actions Bar below each comment */}
          <div className="flex flex-wrap items-center gap-1 ps-8 pt-0.5" onClick={(e) => e.stopPropagation()}>
            {/* 1. Public Reply */}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              data-action="public-reply"
              onClick={onReplyPublic}
              className="h-6 gap-1 px-1.5 font-normal text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Reply className="size-3" />
              <span>رد عام</span>
            </Button>

            {/* 2. Private Reply (within 7 days) — proactively disabled when !private_reply_eligible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex" title={privateReason}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    data-action="private-reply"
                    data-private-eligible={privateEligible ? "true" : "false"}
                    disabled={!privateEligible}
                    onClick={() => {
                      if (privateEligible) onReplyPrivate();
                    }}
                    className={cn(
                      "h-6 gap-1 px-1.5 font-normal text-[11px]",
                      privateEligible
                        ? "text-muted-foreground hover:text-foreground"
                        : "cursor-not-allowed text-muted-foreground/50 opacity-50",
                    )}
                  >
                    <Lock className="size-3" />
                    <span>رد خاص (7 أيام)</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed">{privateReason}</TooltipContent>
            </Tooltip>

            {/* 3. Hide / Unhide */}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              data-action="toggle-hide"
              disabled={isBusy}
              onClick={onToggleHide}
              className="h-6 gap-1 px-1.5 font-normal text-[11px] text-muted-foreground hover:text-foreground"
            >
              {comment.hidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              <span>{comment.hidden ? "إظهار" : "إخفاء"}</span>
            </Button>

            {/* 4. Like / Unlike */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    data-action="toggle-like"
                    disabled={!canLike || isBusy}
                    onClick={() => {
                      if (canLike) onToggleLike();
                    }}
                    className={cn(
                      "h-6 gap-1 px-1.5 font-normal text-[11px] tabular-nums",
                      comment.liked ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ThumbsUp className="size-3" />
                    <span>{comment.liked ? "معجب به" : "إعجاب"}</span>
                    {comment.likes > 0 ? <span>({comment.likes})</span> : null}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {canLike ? "إعجاب أو إلغاء إعجاب بالتعليق" : "الإعجاب عبر الواجهة متاح لتعليقات فيسبوك فقط"}
              </TooltipContent>
            </Tooltip>

            {/* 5. Block / Unblock on Facebook */}
            {comment.platform === "facebook" && !comment.own && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      data-action="toggle-block"
                      disabled={!canBlock || isBusy}
                      onClick={() => {
                        if (canBlock) onAskBlock();
                      }}
                      className="h-6 gap-1 px-1.5 font-normal text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Ban className="size-3" />
                      <span>{comment.blocked ? "إلغاء الحظر" : "حظر"}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {canBlock
                    ? "حظر أو إلغاء حظر صاحب التعليق على صفحة فيسبوك"
                    : "لم ترسل ميتا معرّف صاحب التعليق، لذا لا يمكن حظره من هنا"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* 6. Delete with AlertDialog confirmation */}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              data-action="delete-comment"
              disabled={isBusy}
              onClick={onAskDelete}
              className="h-6 gap-1 px-1.5 font-normal text-[11px] text-destructive/80 hover:text-destructive"
            >
              <Trash2 className="size-3" />
              <span>حذف</span>
            </Button>

            {isReply ? <span className="ms-auto text-[10px] text-muted-foreground">رد فرعي</span> : null}
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Right-click context menu */}
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onReplyPublic}>
          <Reply className="size-3.5" />
          <span>رد عام على التعليق</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!privateEligible}
          onSelect={() => {
            if (privateEligible) onReplyPrivate();
          }}
        >
          <Lock className="size-3.5" />
          <span>رد خاص في الرسائل (ضمن 7 أيام)</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={isBusy} onSelect={onToggleHide}>
          {comment.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          <span>{comment.hidden ? "إظهار التعليق" : "إخفاء التعليق"}</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!canLike || isBusy}
          onSelect={() => {
            if (canLike) onToggleLike();
          }}
        >
          <ThumbsUp className="size-3.5" />
          <span>{comment.liked ? "إلغاء الإعجاب" : "إعجاب"}</span>
        </ContextMenuItem>
        {comment.platform === "facebook" && !comment.own && (
          <ContextMenuItem
            disabled={!canBlock || isBusy}
            onSelect={() => {
              if (canBlock) onAskBlock();
            }}
          >
            <Ban className="size-3.5" />
            <span>{comment.blocked ? "إلغاء الحظر" : "حظر المعلّق"}</span>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" disabled={isBusy} onSelect={onAskDelete}>
          <Trash2 className="size-3.5" />
          <span>حذف التعليق</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function CommentsPane({
  post,
  visiblePosts,
  linked,
  showBackButton,
  onBack,
  panelOpen,
  onTogglePanel,
  className,
}: {
  post: CommentPost;
  visiblePosts: CommentPost[];
  linked: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  className?: string;
}) {
  const [postExpanded, setPostExpanded] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);

  const commentsByPost = useCommentsStore((s) => s.commentsByPost);
  const noticeByPost = useCommentsStore((s) => s.noticeByPost);
  const selectedCommentId = useCommentsStore((s) => s.selectedCommentId);
  const loadingComments = useCommentsStore((s) => s.loadingComments);
  const actionPendingId = useCommentsStore((s) => s.actionPendingId);

  const selectPost = useCommentsStore((s) => s.selectPost);
  const selectComment = useCommentsStore((s) => s.selectComment);
  const markPostRead = useCommentsStore((s) => s.markPostRead);
  const toggleHideComment = useCommentsStore((s) => s.toggleHideComment);
  const toggleLikeComment = useCommentsStore((s) => s.toggleLikeComment);
  const toggleBlockCommenter = useCommentsStore((s) => s.toggleBlockCommenter);
  const deleteComment = useCommentsStore((s) => s.deleteComment);

  const threads = commentsByPost[post.id] ?? [];
  const notice = noticeByPost[post.id] ?? null;
  const selectedComment = findCommentById(threads, selectedCommentId) ?? threads[0] ?? null;

  const postIndex = visiblePosts.findIndex((p) => p.id === post.id);
  const totalPosts = visiblePosts.length;
  const displayIndex = postIndex >= 0 ? postIndex + 1 : 1;

  const handleMarkRead = async () => {
    const res = await markPostRead(post, linked, selectedComment?.id ?? post.id);
    if (res.ok) {
      toast.success("تم تعليم المنشور كمقروء وحفظ الحالة في الخادم (200 OK)");
    } else {
      toast.error(res.error ?? "تعذر تعليم المنشور كمقروء");
    }
  };

  const handleToggleHide = async (comment: CommentItem) => {
    const res = await toggleHideComment(post, comment, linked);
    if (res.ok) {
      toast.success(comment.hidden ? "تم إظهار التعليق للجمهور" : "تم إخفاء التعليق عن الجمهور");
    } else {
      toast.error(res.error ?? "تعذر تحديث حالة إخفاء التعليق");
    }
  };

  const handleToggleLike = async (comment: CommentItem) => {
    const res = await toggleLikeComment(post, comment, linked);
    if (res.ok) {
      toast.success(comment.liked ? "تم إلغاء الإعجاب بالتعليق" : "تم تسجيل الإعجاب بالتعليق");
    } else {
      toast.error(res.error ?? "تعذر تحديث الإعجاب بالتعليق");
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { kind, comment } = confirmModal;
    setConfirmModal(null);

    if (kind === "delete") {
      const res = await deleteComment(post, comment, linked);
      if (res.ok) {
        toast.success("تم حذف التعليق بنجاح من الخادم");
      } else {
        toast.error(res.error ?? "تعذر حذف التعليق");
      }
      return;
    }

    if (kind === "block") {
      const res = await toggleBlockCommenter(post, comment, linked);
      if (res.ok) {
        toast.success(comment.blocked ? "تم إلغاء حظر المعلّق بنجاح" : "تم حظر المعلّق على صفحة فيسبوك");
      } else {
        toast.error(res.error ?? "تعذر تحديث حالة حظر المعلّق");
      }
    }
  };

  return (
    <div data-slot="comments-pane" className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Fixed Top Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          {showBackButton && (
            <Button variant="ghost" size="icon-sm" aria-label="العودة لقائمة المنشورات" onClick={onBack}>
              <ChevronLeft className="size-4" />
            </Button>
          )}

          {/* Post navigation (ChevronUp / ChevronDown with n / N tabular-nums) */}
          <div className="flex items-center gap-1" data-testid="post-nav-controls">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="المنشور السابق"
              disabled={postIndex <= 0}
              onClick={() => {
                if (postIndex > 0) selectPost(visiblePosts[postIndex - 1].id, linked);
              }}
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="المنشور التالي"
              disabled={postIndex < 0 || postIndex >= totalPosts - 1}
              onClick={() => {
                if (postIndex >= 0 && postIndex < totalPosts - 1) {
                  selectPost(visiblePosts[postIndex + 1].id, linked);
                }
              }}
            >
              <ChevronDown className="size-3.5" />
            </Button>
            <span className="whitespace-nowrap px-1 text-xs tabular-nums">
              <span className="font-medium">{displayIndex}</span>
              <span className="text-muted-foreground"> / {Math.max(1, totalPosts)}</span>
            </span>
          </div>

          <div className="hidden min-w-0 items-center gap-1.5 border-s ps-2 xl:flex">
            <ChannelIcon channel={post.platform} className="size-3.5 shrink-0" />
            <span className="truncate font-medium text-xs">
              {post.platform === "facebook" ? "Facebook Page" : "Instagram"}
            </span>
            {post.is_isolated_test ? (
              <Badge
                variant="outline"
                className="truncate border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[10px] text-sky-400"
              >
                اختباري معزول (V-5)
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Right actions: Original Meta link, Mark as read, Toggle Commenter & Audit panel */}
        <div className="flex shrink-0 items-center gap-1.5">
          {post.permalink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="xs" asChild>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="فتح المنشور الأصلي على ميتا"
                    className="gap-1"
                  >
                    <SquareArrowOutUpRight className="size-3" />
                    <span className="hidden xl:inline">المنشور الأصلي</span>
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>فتح المنشور الأصلي على ميتا</TooltipContent>
            </Tooltip>
          ) : null}

          <Button
            variant="secondary"
            size="xs"
            data-testid="mark-post-read-btn"
            disabled={actionPendingId === `mark_read:${post.id}`}
            onClick={() => void handleMarkRead()}
            className="gap-1"
          >
            <MailOpen className="size-3" />
            <span>تعليم كمقروء</span>
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={panelOpen ? "secondary" : "ghost"}
                size="icon-sm"
                data-testid="toggle-commenter-panel"
                aria-label={panelOpen ? "إخفاء لوحة المعلّق وسجل التدقيق" : "إظهار لوحة المعلّق وسجل التدقيق"}
                onClick={onTogglePanel}
              >
                {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {panelOpen ? "إخفاء لوحة المعلّق وسجل التدقيق" : "إظهار لوحة المعلّق وسجل التدقيق"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Collapsible Pinned Post Card (using SharedPostCard) */}
      <Collapsible
        open={postExpanded}
        onOpenChange={setPostExpanded}
        className="shrink-0 border-b bg-muted/20 px-3 py-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {post.kind || "Post"}
            </Badge>
            <p dir="auto" className="truncate text-foreground text-xs">
              {post.text || `منشور #${post.id}`}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              data-testid="toggle-pinned-post"
              className="shrink-0 gap-1 text-muted-foreground text-xs"
            >
              <span>{postExpanded ? "طي المنشور" : "معاينة المنشور"}</span>
              <ChevronDown className={cn("size-3.5 transition-transform", postExpanded && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-2.5">
          <div className="flex flex-wrap items-start gap-3">
            <SharedPostCard post={toSharedPost(post)} />
            <div className="flex flex-col gap-1.5 text-muted-foreground text-xs">
              <div>
                معرّف المنشور: <span className="font-mono text-foreground tabular-nums">{post.id}</span>
              </div>
              <div>
                إجمالي التعليقات: <span className="font-medium text-foreground tabular-nums">{post.comments}</span>
              </div>
              <div>
                تعليقات غير مقروءة:{" "}
                <span className="font-medium text-foreground tabular-nums">{post.unread_count}</span>
              </div>
              <div>
                تحتاج رداً: <span className="font-medium text-foreground tabular-nums">{post.needs_reply_count}</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Permission / Webhook fallback notice if present */}
      {notice ? (
        <div className="shrink-0 px-3 pt-2">
          <Alert className="border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
            <AlertCircle className="size-4 text-amber-400" />
            <AlertDescription className="text-xs leading-relaxed">{notice}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {/* Scrollable Comment Tree (root comments + nested replies with ms-9 border-s-2) */}
      <ScrollArea
        type="hover"
        className="[&_[data-slot=scroll-area-viewport]>div]:block! h-full min-h-0 flex-1 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
      >
        <div className="flex flex-col gap-2.5 p-3">
          {loadingComments && threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground text-sm">
              <span>جاري جلب شجرة التعليقات من الجسر الخادمي…</span>
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground text-sm">لا توجد تعليقات مسجلة على هذا المنشور بعد</p>
            </div>
          ) : (
            threads.map((top) => (
              <div key={top.id} className="flex flex-col gap-2">
                <CommentNode
                  comment={top}
                  selected={selectedComment?.id === top.id}
                  actionPendingId={actionPendingId}
                  onSelect={() => selectComment(top.id)}
                  onReplyPublic={() => selectComment(top.id, "public")}
                  onReplyPrivate={() => selectComment(top.id, "private")}
                  onToggleHide={() => void handleToggleHide(top)}
                  onToggleLike={() => void handleToggleLike(top)}
                  onAskBlock={() => setConfirmModal({ kind: "block", comment: top })}
                  onAskDelete={() => setConfirmModal({ kind: "delete", comment: top })}
                />

                {/* Nested child replies (`ms-9 border-s-2`) */}
                {Array.isArray(top.replies) && top.replies.length > 0 ? (
                  <div className="ms-9 flex flex-col gap-2 border-border/60 border-s-2 ps-3">
                    {top.replies.map((replyItem) => (
                      <CommentNode
                        key={replyItem.id}
                        comment={replyItem}
                        isReply
                        selected={selectedComment?.id === replyItem.id}
                        actionPendingId={actionPendingId}
                        onSelect={() => selectComment(replyItem.id)}
                        onReplyPublic={() => selectComment(replyItem.id, "public")}
                        onReplyPrivate={() => selectComment(replyItem.id, "private")}
                        onToggleHide={() => void handleToggleHide(replyItem)}
                        onToggleLike={() => void handleToggleLike(replyItem)}
                        onAskBlock={() => setConfirmModal({ kind: "block", comment: replyItem })}
                        onAskDelete={() => setConfirmModal({ kind: "delete", comment: replyItem })}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Bottom fixed reply composer */}
      <CommentReplyBox post={post} selectedComment={selectedComment} linked={linked} />

      {/* AlertDialog for Delete / Block confirmation */}
      <AlertDialog
        open={confirmModal !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmModal(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmModal?.kind === "delete"
                ? "تأكيد حذف التعليق نهائياً"
                : confirmModal?.comment.blocked
                  ? "تأكيد إلغاء حظر المعلّق"
                  : "تأكيد حظر المعلّق على فيسبوك"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmModal?.kind === "delete"
                ? "سيتم حذف هذا التعليق عبر الجسر الخادمي ولا يتغير في الواجهة إلا بعد تأكيد الخادم برمز 200. هل أنت متأكد من المتابعة؟"
                : confirmModal?.comment.blocked
                  ? "سيتم رفع الحظر عن صاحب التعليق في صفحة فيسبوك."
                  : "سيتم حظر صاحب التعليق من التفاعل مع صفحة فيسبوك وتوثيق العملية في سجل التدقيق."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmAction()}
              className={cn(
                confirmModal?.kind === "delete" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {confirmModal?.kind === "delete"
                ? "تأكيد الحذف"
                : confirmModal?.comment.blocked
                  ? "إلغاء الحظر"
                  : "تأكيد الحظر"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

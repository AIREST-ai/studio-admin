"use client";

// V-6 (item 160.8): Integrated comment reply composer at the bottom of the Comments column.
// - Explicit toggle between «رد عام على التعليق» (Public reply) and «رد خاص في الرسائل (ضمن 7 أيام)» (Private DM reply).
// - Supervisor Rule 1: Proactively disables the private reply toggle button (`disabled`) when
//   `selectedComment.private_reply_eligible === false` with a clear Arabic tooltip explaining Meta's 7-day / once-only rule.
// - Strict honesty rule: Never clears the draft or shows a success toast until the server responds with HTTP 200 (`ok: true`).
import { useRef } from "react";

import { cn } from "cn";
import { Lock, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { type CommentItem, type CommentPost, useCommentsStore } from "./comments-store";

const CANNED_REPLIES = [
  {
    title: "ترحيب وتفاصيل الباقة",
    text: "أهلاً بك في Genaty DNA! يسعدنا تواصلك معنا، باقة الفحص الجيني متوفرة مع شحن سريع لجميع المحافظات.",
  },
  {
    title: "تحويل للخاص",
    text: "شكراً لتواصلك معنا! تم إرسال كافة التفاصيل والأسعار في رسالة خاصة.",
  },
  {
    title: "مدة ظهور النتيجة",
    text: "تظهر نتائج الفحص المخبري بدقة كاملة خلال 10 إلى 14 يوم عمل من استلام العينة.",
  },
];

export function getPrivateReplyIneligibleReason(comment: CommentItem | null): string {
  if (!comment) {
    return "اختر تعليقاً من القائمة أولاً لإرسال رد خاص.";
  }
  if (comment.own) {
    return "غير متاح للرد الخاص: هذا التعليق صادر من الصفحة نفسها وليس من عميل.";
  }
  if (comment.private_replied) {
    return "غير متاح للرد الخاص: سبق إرسال رد خاص لهذا التعليق (قيد ميتا يسمح برد خاص واحد فقط لكل تعليق خلال 7 أيام).";
  }
  return "غير متاح للرد الخاص: انتهت نافذة 7 أيام المحددة من ميتا للرد الخاص أو أن المنصة لا تسمح بالرد الخاص على هذا التعليق (يُسمح برد واحد خلال 7 أيام).";
}

export function CommentReplyBox({
  post,
  selectedComment,
  linked,
}: {
  post: CommentPost;
  selectedComment: CommentItem | null;
  linked: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyMode = useCommentsStore((s) => s.replyMode);
  const replyDraft = useCommentsStore((s) => s.replyDraft);
  const actionPendingId = useCommentsStore((s) => s.actionPendingId);

  const setReplyMode = useCommentsStore((s) => s.setReplyMode);
  const setReplyDraft = useCommentsStore((s) => s.setReplyDraft);
  const sendReply = useCommentsStore((s) => s.sendReply);

  const privateEligible = Boolean(selectedComment?.private_reply_eligible);
  const effectiveMode = replyMode === "private" && privateEligible ? "private" : "public";
  const privateTooltip = privateEligible
    ? "إرسال رسالة خاصة لصاحب التعليق في صندوق الرسائل (متاح لمرة واحدة خلال 7 أيام)"
    : getPrivateReplyIneligibleReason(selectedComment);

  const isSending =
    Boolean(selectedComment) &&
    (actionPendingId === `reply:${selectedComment?.id}` || actionPendingId === `private_reply:${selectedComment?.id}`);

  const handleSubmit = async () => {
    if (!selectedComment || isSending) return;
    if (!replyDraft.trim()) {
      toast.error("يرجى كتابة نص الرد أولاً");
      return;
    }
    if (effectiveMode === "private" && !privateEligible) {
      toast.error(getPrivateReplyIneligibleReason(selectedComment));
      return;
    }

    const res = await sendReply(post, selectedComment, effectiveMode, replyDraft, linked);
    if (res.ok) {
      toast.success(
        effectiveMode === "private"
          ? "تم إرسال الرد الخاص في الرسائل بنجاح (200 OK)"
          : "تم نشر الرد العام على التعليق بنجاح (200 OK)",
      );
    } else {
      toast.error(res.error ?? "تعذر إرسال الرد");
    }
  };

  return (
    <div data-slot="comment-reply-box" className="shrink-0 border-t bg-background/95 px-3 py-2.5 backdrop-blur-xs">
      {/* Mode switcher header */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="نوع الرد على التعليق">
          <Button
            type="button"
            size="xs"
            variant={effectiveMode === "public" ? "default" : "outline"}
            data-testid="reply-mode-public"
            aria-selected={effectiveMode === "public"}
            onClick={() => setReplyMode("public")}
            className="gap-1.5"
          >
            <MessageSquare className="size-3.5" />
            <span>رد عام على التعليق</span>
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex" title={privateTooltip}>
                <Button
                  type="button"
                  size="xs"
                  variant={effectiveMode === "private" ? "default" : "outline"}
                  data-testid="reply-mode-private"
                  data-private-eligible={privateEligible ? "true" : "false"}
                  aria-selected={effectiveMode === "private"}
                  disabled={!privateEligible}
                  onClick={() => {
                    if (privateEligible) setReplyMode("private");
                  }}
                  className={cn("gap-1.5", !privateEligible && "cursor-not-allowed opacity-55")}
                >
                  <Lock className="size-3.5" />
                  <span>رد خاص في الرسائل (ضمن 7 أيام)</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs leading-relaxed">{privateTooltip}</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          {selectedComment ? (
            <span className="truncate">
              الرد على:{" "}
              <strong className="font-medium text-foreground">{selectedComment.from_name || "مشارك فيسبوك"}</strong>
            </span>
          ) : (
            <span>اختر تعليقاً للرد عليه</span>
          )}
          {!privateEligible && selectedComment ? (
            <Badge
              variant="outline"
              data-testid="private-reply-ineligible-badge"
              className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-normal text-[10px] text-amber-300"
            >
              الرد الخاص معطّل (قيد 7 أيام / مرة واحدة)
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Input area */}
      <InputGroup className="bg-muted/20">
        <InputGroupTextarea
          ref={textareaRef}
          rows={2}
          dir="auto"
          data-testid="comment-reply-textarea"
          disabled={!selectedComment || isSending}
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          placeholder={
            !selectedComment
              ? "اختر تعليقاً من الشجرة أعلاه لكتابة رد…"
              : effectiveMode === "private"
                ? `اكتب رسالة خاصة إلى ${selectedComment.from_name || "صاحب التعليق"} (تُرسل مرة واحدة خلال 7 أيام)…`
                : `اكتب رداً عاماً على تعليق ${selectedComment.from_name || "صاحب التعليق"}…`
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          className="min-h-[3.25rem] text-xs leading-relaxed"
        />
        <InputGroupAddon align="block-end" className="justify-between border-t pt-1.5">
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={!selectedComment || isSending}
                  className="h-6 gap-1 px-1.5 text-muted-foreground text-xs"
                >
                  <Sparkles className="size-3" />
                  <span>ردود جاهزة</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs">إدراج رد سريع</DropdownMenuLabel>
                {CANNED_REPLIES.map((item) => (
                  <DropdownMenuItem
                    key={item.title}
                    onSelect={() => {
                      setReplyDraft(replyDraft ? `${replyDraft}\n${item.text}` : item.text);
                      requestAnimationFrame(() => textareaRef.current?.focus());
                    }}
                    className="flex flex-col items-start gap-0.5 text-xs"
                  >
                    <span className="font-medium">{item.title}</span>
                    <span className="line-clamp-1 text-muted-foreground text-[11px]">{item.text}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
              <span>للإرسال</span>
            </span>
          </div>

          <Button
            type="button"
            size="xs"
            data-testid="comment-reply-submit"
            disabled={!selectedComment || !replyDraft.trim() || isSending}
            onClick={() => void handleSubmit()}
            className="gap-1.5"
          >
            <Send className="size-3" />
            <span>{isSending ? "جاري الإرسال…" : effectiveMode === "private" ? "إرسال رد خاص" : "نشر الرد العام"}</span>
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

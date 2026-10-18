"use client";

// V-6 (item 160.8): First column of the Comments workspace (21rem).
// - Header with ExpandingSearch lens, refresh button, mark-all-read button, and density toggle.
// - Filter tabs always starting with «الكل» (الكل -> غير مقروء -> يحتاج رداً -> مخفي) with Western tabular-nums counts.
// - Platform dropdown at the end of the filter row starting with «الكل» (الكل -> Facebook -> Instagram).
// - Honest Instagram link notice when Instagram filter is selected and instagram === false in /api/comments/status.
// - ScrollArea containing post cards with Meta thumbnail (or Post/Reel badge without fake images), ChannelIcon, text,
//   relative timestamp, and status badges.
import { useState } from "react";

import { cn } from "cn";
import {
  AlertCircle,
  CheckCheck,
  ChevronDown,
  FileText,
  Film,
  MessageSquare,
  RefreshCw,
  Rows2,
  Rows3,
} from "lucide-react";
import { toast } from "sonner";

import { ExpandingSearch } from "@/app/(main)/dashboard/_components/search/expanding-search";
import { ChannelIcon } from "@/app/(main)/dashboard/chat/_components/cw-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  type CommentFilterTab,
  type CommentItem,
  type CommentPost,
  type PlatformFilter,
  useCommentsStore,
} from "./comments-store";

const FILTER_TABS: { value: CommentFilterTab; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "unread", label: "غير مقروء" },
  { value: "needs_reply", label: "يحتاج رداً" },
  { value: "hidden", label: "مخفي" },
];

const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];

function httpsUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function formatRelativeTimeWest(iso: string): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function postMatchesSearch(post: CommentPost, comments: CommentItem[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (post.text.toLowerCase().includes(q) || post.id.toLowerCase().includes(q)) return true;
  for (const top of comments) {
    if (top.text.toLowerCase().includes(q) || top.from_name.toLowerCase().includes(q)) return true;
    for (const r of top.replies ?? []) {
      if (r.text.toLowerCase().includes(q) || r.from_name.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

function PostThumbnail({ post, condensed }: { post: CommentPost; condensed: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = httpsUrl(post.picture);
  const isReel = (post.kind ?? "").toLowerCase() === "reel";
  const boxSize = condensed ? "size-10" : "size-12";

  if (src && !failed) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden rounded-md border bg-muted", boxSize)}>
        {/* biome-ignore lint/performance/noImgElement: direct Meta CDN URL without Next image proxy */}
        <img
          src={src}
          alt={post.text ? post.text.slice(0, 40) : `${post.platform} post`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
        <span className="absolute end-0.5 bottom-0.5 grid size-4 place-items-center rounded-full bg-background/90 shadow-xs">
          <ChannelIcon channel={post.platform} className="size-2.5" />
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border bg-muted/60 text-muted-foreground",
        boxSize,
      )}
    >
      {isReel ? <Film className="size-3.5" /> : <FileText className="size-3.5" />}
      <span className="font-medium text-[9px] uppercase tracking-tight">{isReel ? "Reel" : "Post"}</span>
      <span className="absolute end-0.5 bottom-0.5 grid size-4 place-items-center rounded-full bg-background/90 shadow-xs">
        <ChannelIcon channel={post.platform} className="size-2.5" />
      </span>
    </div>
  );
}

export function filterPostsList(
  posts: CommentPost[],
  commentsByPost: Record<string, CommentItem[]>,
  filterTab: CommentFilterTab,
  platformFilter: PlatformFilter,
  searchQuery: string,
) {
  const platformScoped = posts.filter((post) => {
    if (platformFilter !== "all" && post.platform !== platformFilter) return false;
    return postMatchesSearch(post, commentsByPost[post.id] ?? [], searchQuery);
  });

  const tabCounts: Record<CommentFilterTab, number> = {
    all: platformScoped.length,
    unread: platformScoped.filter((p) => p.is_unread || p.unread_count > 0).length,
    needs_reply: platformScoped.filter((p) => p.has_needs_reply || p.needs_reply_count > 0).length,
    hidden: platformScoped.filter((p) => p.hidden > 0).length,
  };

  const searchScoped = posts.filter((post) => postMatchesSearch(post, commentsByPost[post.id] ?? [], searchQuery));
  const platformCounts: Record<PlatformFilter, number> = {
    all: searchScoped.length,
    facebook: searchScoped.filter((p) => p.platform === "facebook").length,
    instagram: searchScoped.filter((p) => p.platform === "instagram").length,
  };

  const visible = platformScoped.filter((post) => {
    if (filterTab === "unread") return post.is_unread || post.unread_count > 0;
    if (filterTab === "needs_reply") return post.has_needs_reply || post.needs_reply_count > 0;
    if (filterTab === "hidden") return post.hidden > 0;
    return true;
  });

  return { visible, tabCounts, platformCounts };
}

export function PostList({
  linked,
  onSelectPost,
  className,
}: {
  linked: boolean;
  onSelectPost?: (post: CommentPost) => void;
  className?: string;
}) {
  const posts = useCommentsStore((s) => s.posts);
  const commentsByPost = useCommentsStore((s) => s.commentsByPost);
  const filterTab = useCommentsStore((s) => s.filterTab);
  const platformFilter = useCommentsStore((s) => s.platformFilter);
  const searchQuery = useCommentsStore((s) => s.searchQuery);
  const condensed = useCommentsStore((s) => s.condensed);
  const selectedPostId = useCommentsStore((s) => s.selectedPostId);
  const loadingPosts = useCommentsStore((s) => s.loadingPosts);
  const instagramLinked = useCommentsStore((s) => s.instagramLinked);
  const actionPendingId = useCommentsStore((s) => s.actionPendingId);

  const setFilterTab = useCommentsStore((s) => s.setFilterTab);
  const setPlatformFilter = useCommentsStore((s) => s.setPlatformFilter);
  const setSearchQuery = useCommentsStore((s) => s.setSearchQuery);
  const setCondensed = useCommentsStore((s) => s.setCondensed);
  const selectPost = useCommentsStore((s) => s.selectPost);
  const loadAll = useCommentsStore((s) => s.loadAll);
  const markAllPostsRead = useCommentsStore((s) => s.markAllPostsRead);

  const { visible, tabCounts, platformCounts } = filterPostsList(
    posts,
    commentsByPost,
    filterTab,
    platformFilter,
    searchQuery,
  );

  const selectedPlatformLabel = PLATFORM_OPTIONS.find((item) => item.value === platformFilter)?.label ?? "الكل";

  const handleMarkAllRead = async () => {
    const res = await markAllPostsRead(linked);
    if (res.ok) {
      toast.success("تم تعليم جميع المنشورات كمقروءة");
    } else {
      toast.error(res.error ?? "تعذر تعليم المنشورات كمقروءة");
    }
  };

  return (
    <div data-slot="comments-post-list" className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Top header bar */}
      <div className="flex h-13 shrink-0 items-center justify-between gap-1.5 px-3">
        {!searchQuery ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate font-medium text-base">التعليقات</h2>
            <Badge variant="secondary" className="shrink-0 font-normal text-[11px] tabular-nums">
              {tabCounts.all}
            </Badge>
          </div>
        ) : null}

        <div className={cn("flex items-center gap-0.5", searchQuery && "flex-1 justify-end")}>
          <ExpandingSearch
            name="comments"
            size="sm"
            variant="ghost"
            label="البحث في المنشورات والتعليقات"
            placeholder="ابحث في المنشورات أو التعليقات…"
            className="w-40"
            value={searchQuery}
            onChange={setSearchQuery}
            testId="comments-search"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="تعليم الكل كمقروء"
                disabled={actionPendingId === "mark_all_read" || tabCounts.unread === 0}
                onClick={() => void handleMarkAllRead()}
              >
                <CheckCheck className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>تعليم الكل كمقروء</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="تحديث المنشورات والتعليقات"
                disabled={loadingPosts}
                onClick={() => void loadAll(linked)}
              >
                <RefreshCw className={cn("size-4", loadingPosts && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>تحديث القائمة</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="تبديل كثافة العرض"
                onClick={() => setCondensed(!condensed)}
              >
                {condensed ? <Rows2 className="size-4" /> : <Rows3 className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{condensed ? "عرض مريح" : "عرض مضغوط"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Filter tabs row starting with «الكل» + Platform dropdown at the end starting with «الكل» */}
      <div data-slot="comments-filter-row" className="flex shrink-0 items-center justify-between gap-1 border-b px-1.5">
        <Tabs
          value={filterTab}
          onValueChange={(val) => setFilterTab(val as CommentFilterTab)}
          className="min-w-0 flex-1 overflow-hidden"
        >
          <TabsList
            variant="line"
            aria-label="فلتر التعليقات"
            className="w-full justify-start gap-0 *:data-[slot=tabs-trigger]:flex-none"
          >
            {FILTER_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                data-filter-tab={tab.value}
                className="gap-1 px-1.5 text-[11px]"
              >
                <span>{tab.label}</span>
                <span className="text-muted-foreground text-[10px] tabular-nums">{tabCounts[tab.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-testid="comments-platform-trigger"
              aria-label={`المنصة: ${selectedPlatformLabel}`}
              className="h-7 shrink-0 gap-1 px-1.5 font-normal text-[11px] text-muted-foreground"
            >
              {platformFilter !== "all" ? <ChannelIcon channel={platformFilter} className="size-3 shrink-0" /> : null}
              <span className="max-w-[4.5rem] truncate">{selectedPlatformLabel}</span>
              <ChevronDown className="size-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
              تصفية حسب المنصة
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={platformFilter}
              onValueChange={(val) => setPlatformFilter(val as PlatformFilter)}
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value} data-platform-option={opt.value}>
                  <span className="flex items-center gap-1.5">
                    {opt.value !== "all" ? <ChannelIcon channel={opt.value} className="size-3.5" /> : null}
                    <span>{opt.label}</span>
                  </span>
                  <span className="ms-auto text-muted-foreground text-xs tabular-nums">
                    {platformCounts[opt.value]}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Honest Instagram connection status notice when Instagram filter is active and not linked yet */}
      {platformFilter === "instagram" && !instagramLinked && (
        <div className="shrink-0 px-2.5 pt-2" dir="rtl">
          <Alert
            data-testid="instagram-unlinked-alert"
            className="border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200"
          >
            <AlertCircle className="size-4 text-amber-400" />
            <AlertTitle className="font-medium text-amber-300 text-xs">
              حساب إنستغرام غير مربوط بالصفحة حالياً
            </AlertTitle>
            <AlertDescription className="mt-0.5 text-[11px] text-amber-200/90 leading-relaxed">
              حالة الربط في الخادم (
              <code className="font-mono" dir="ltr">
                instagram: false
              </code>
              ): لم يتم ربط حساب إنستغرام الاحترافي (
              <span className="font-medium" dir="ltr">
                genatydna
              </span>
              ) بصفحة فيسبوك في إعدادات ميتا بعد. ستظهر منشورات وريلز إنستغرام هنا تلقائياً فور إتمام الربط.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Scrollable post cards list */}
      <ScrollArea
        type="hover"
        className="[&_[data-slot=scroll-area-viewport]>div]:block! h-full min-h-0 flex-1 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5"
      >
        <div className="flex flex-col gap-1 p-2">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <MessageSquare className="size-7 text-muted-foreground/60" />
              <p className="font-medium text-muted-foreground text-sm">
                {loadingPosts
                  ? "جاري جلب المنشورات من الجسر الخادمي…"
                  : platformFilter === "instagram" && !instagramLinked
                    ? "لا توجد منشورات إنستغرام مرتبطة حالياً"
                    : "لا توجد منشورات مطابقة للفلتر الحالي"}
              </p>
              {(filterTab !== "all" || platformFilter !== "all" || searchQuery.trim() !== "") && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setFilterTab("all");
                    setPlatformFilter("all");
                    setSearchQuery("");
                  }}
                >
                  إعادة ضبط الفلاتر إلى «الكل»
                </Button>
              )}
            </div>
          ) : (
            visible.map((post) => {
              const active = post.id === selectedPostId;
              return (
                <button
                  key={post.id}
                  type="button"
                  data-post-card={post.id}
                  data-active={active ? "true" : undefined}
                  onClick={() => {
                    selectPost(post.id, linked);
                    onSelectPost?.(post);
                  }}
                  className={cn(
                    "group flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-start transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent hover:border-border/70 hover:bg-muted/50",
                    condensed && "p-2",
                  )}
                >
                  <PostThumbnail post={post} condensed={condensed} />

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1 font-medium text-muted-foreground text-[11px]">
                        <span>{post.platform === "facebook" ? "Facebook" : "Instagram"}</span>
                        {post.is_isolated_test ? (
                          <Badge
                            variant="outline"
                            className="border-sky-500/30 bg-sky-500/10 px-1 py-0 text-[10px] text-sky-400"
                          >
                            اختباري معزول
                          </Badge>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-muted-foreground text-[11px] tabular-nums">
                        {formatRelativeTimeWest(post.created)}
                      </span>
                    </div>

                    <p
                      dir="auto"
                      className={cn(
                        " break-words text-foreground text-xs leading-snug",
                        condensed ? "line-clamp-1" : "line-clamp-2",
                        post.is_unread && "font-semibold",
                      )}
                    >
                      {post.text ||
                        `منشور ${post.platform === "facebook" ? "فيسبوك" : "إنستغرام"} #${post.id.slice(-6)}`}
                    </p>

                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge variant="secondary" className="gap-1 px-1.5 py-0 font-normal text-[10px] tabular-nums">
                        <MessageSquare className="size-2.5" />
                        <span>{post.comments}</span>
                      </Badge>

                      {post.is_unread && post.unread_count > 0 ? (
                        <Badge variant="default" className="px-1.5 py-0 font-medium text-[10px] tabular-nums">
                          غير مقروء {post.unread_count}
                        </Badge>
                      ) : null}

                      {post.has_needs_reply || post.needs_reply_count > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-medium text-[10px] text-amber-400 tabular-nums"
                        >
                          يحتاج رداً {post.needs_reply_count}
                        </Badge>
                      ) : null}

                      {post.hidden > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-border bg-muted/60 px-1.5 py-0 font-normal text-[10px] text-muted-foreground tabular-nums"
                        >
                          مخفي {post.hidden}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

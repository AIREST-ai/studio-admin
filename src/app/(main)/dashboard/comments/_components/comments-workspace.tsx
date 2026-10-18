"use client";

// V-6 (item 160.8): Main responsive workspace for /dashboard/comments (1440px & 1024px).
// - At 1440px (`wide = useMinWidth(1440)`): 3-column grid (`lg:grid-cols-[21rem_minmax(0,1fr)_20rem]` when panelOpen,
//   or `lg:grid-cols-[21rem_minmax(0,1fr)]` when closed).
// - At 1024px (`!wide && twoPane`): 2 visible columns (`lg:grid-cols-[21rem_minmax(0,1fr)]`) and the Commenter & Audit
//   panel opens inside a slide-over `Sheet` drawer without horizontal overflow.
// - Locked to viewport height under header (`overflow-hidden` on outer Card + internal `ScrollArea`s) to prevent any
//   double or outer scrollbar.
import { useEffect, useState } from "react";

import { cn } from "cn";
import { AlertCircle, MessagesSquare } from "lucide-react";

import { useChatwootLink } from "@/app/(main)/dashboard/_components/chatwoot-link/link-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

import { CommenterPanel } from "./commenter-panel";
import { CommentsPane } from "./comments-pane";
import { useCommentsStore } from "./comments-store";
import { filterPostsList, PostList } from "./post-list";

function useMinWidth(px: number) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [px]);
  return matches;
}

function EmptyCommentsPane() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <MessagesSquare className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">اختر منشوراً أو ريل من القائمة لعرض شجرة التعليقات والردود</p>
      <p className="max-w-xs text-muted-foreground text-xs leading-relaxed">
        يمكنك الرد العام أو إرسال رد خاص في الرسائل (لمرة واحدة خلال 7 أيام) وإدارة الإخفاء والحظر وسجل التدقيق.
      </p>
    </div>
  );
}

export function CommentsWorkspace() {
  const { state: linkState } = useChatwootLink();
  const isLinked = !linkState.disabled && linkState.mode === "linked";

  const wide = useMinWidth(1440);
  const twoPane = useMinWidth(1024);

  // Open the 3rd column at 1440px by default so commenter & audit details are immediately accessible;
  // at 1024px, keep the Sheet closed until the user clicks the panel button.
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);

  const posts = useCommentsStore((s) => s.posts);
  const commentsByPost = useCommentsStore((s) => s.commentsByPost);
  const filterTab = useCommentsStore((s) => s.filterTab);
  const platformFilter = useCommentsStore((s) => s.platformFilter);
  const searchQuery = useCommentsStore((s) => s.searchQuery);
  const selectedPostId = useCommentsStore((s) => s.selectedPostId);
  const error = useCommentsStore((s) => s.error);
  const loadAll = useCommentsStore((s) => s.loadAll);

  useEffect(() => {
    void loadAll(isLinked);
  }, [isLinked, loadAll]);

  const { visible } = filterPostsList(posts, commentsByPost, filterTab, platformFilter, searchQuery);

  const activePost = posts.find((p) => p.id === selectedPostId) ?? visible[0] ?? posts[0] ?? null;

  const togglePanel = () => {
    if (wide) {
      setPanelOpen((v) => !v);
    } else {
      setSheetOpen((v) => !v);
    }
  };

  return (
    <div
      data-slot="comments-workspace"
      className="flex h-[calc(100svh-var(--dashboard-header-height)-5rem)] flex-col gap-2 overflow-hidden md:h-[calc(100svh-var(--dashboard-header-height)-3rem)]"
    >
      {/* Honest server bridge error banner if /api/comments fails */}
      {error ? (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs"
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>خطأ في جسر التعليقات الخادمي: {error}</span>
          </span>
          <Button size="xs" variant="outline" onClick={() => void loadAll(isLinked)}>
            إعادة المحاولة
          </Button>
        </div>
      ) : null}

      <Card className="min-h-[24rem] flex-1 gap-0 overflow-hidden p-0">
        <div
          data-testid="comments-grid"
          className={cn(
            "grid h-full min-h-0 grid-cols-1 *:min-h-0 *:min-w-0",
            wide && panelOpen && activePost
              ? "lg:grid-cols-[21rem_minmax(0,1fr)_20rem]"
              : "lg:grid-cols-[21rem_minmax(0,1fr)]",
          )}
        >
          {/* Column 1: Posts & Reels list (21rem) */}
          <PostList
            linked={isLinked}
            onSelectPost={() => setShowMobileThread(true)}
            className={cn("lg:border-e", !twoPane && showMobileThread && "hidden")}
          />

          {/* Column 2: Comment tree & Reply composer (1fr) */}
          {activePost ? (
            <CommentsPane
              post={activePost}
              visiblePosts={visible.length > 0 ? visible : posts}
              linked={isLinked}
              showBackButton={!twoPane}
              onBack={() => setShowMobileThread(false)}
              panelOpen={wide ? panelOpen : sheetOpen}
              onTogglePanel={togglePanel}
              className={cn(!twoPane && !showMobileThread && "hidden")}
            />
          ) : (
            <div className={cn(!twoPane && !showMobileThread && "hidden")}>
              <EmptyCommentsPane />
            </div>
          )}

          {/* Column 3 at 1440px: Commenter & Audit panel (20rem) */}
          {wide && panelOpen && activePost ? (
            <div className="border-s" data-testid="comments-third-column">
              <CommenterPanel post={activePost} linked={isLinked} onClose={() => setPanelOpen(false)} />
            </div>
          ) : null}
        </div>
      </Card>

      {/* Slide-over Sheet at 1024px (`!wide`) for Commenter & Audit panel */}
      {!wide && activePost ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="right"
            data-testid="comments-sheet-drawer"
            className="w-[22rem] p-0 sm:max-w-[22rem]"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">لوحة المعلّق وسجل التدقيق</SheetTitle>
            <SheetDescription className="sr-only">
              تفاصيل صاحب التعليق وحالة نافذة الرد الخاص وسجل التدقيق الحي
            </SheetDescription>
            <CommenterPanel post={activePost} linked={isLinked} onClose={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

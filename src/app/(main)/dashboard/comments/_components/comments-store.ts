"use client";

// V-6 (item 160.8): Comments state and live bridge client (/api/comments/[action]).
// - In linked mode, connects to /api/comments/status, /api/comments/posts, /api/comments/comments, /api/comments/audit
//   and executes actions (mark_read, mark_all_read, reply, private_reply, hide, unhide, like, unlike, block, unblock, delete).
// - Strict honesty rule: never shows a fake success toast or mutates comment state before receiving HTTP 200 with ok: true.
// - In preview mode, uses in-memory preview fixtures without touching .preview-state/.
import { create } from "zustand";

export type CommentPlatform = "facebook" | "instagram";
export type CommentFilterTab = "all" | "unread" | "needs_reply" | "hidden";
export type PlatformFilter = "all" | "facebook" | "instagram";
export type ReplyMode = "public" | "private";

export interface CommentPost {
  id: string;
  platform: CommentPlatform;
  text: string;
  permalink: string;
  picture: string;
  created: string;
  kind?: string;
  comments: number;
  needs_reply: number;
  needs_reply_count: number;
  has_needs_reply: boolean;
  hidden: number;
  private_reply_eligible: boolean;
  private_reply_eligible_count: number;
  last_read_ts: number;
  unread_count: number;
  is_unread: boolean;
  is_isolated_test?: boolean;
}

export interface CommentItem {
  id: string;
  platform: CommentPlatform;
  post_id: string;
  parent_id: string | null;
  text: string;
  from_id: string;
  from_name: string;
  from_picture: string;
  own: boolean;
  created: string;
  created_ts: number;
  likes: number;
  liked: boolean;
  hidden: boolean;
  can_hide: boolean;
  can_remove: boolean;
  can_like: boolean;
  can_reply_privately: boolean;
  attachment: string;
  private_replied: boolean;
  private_reply_open: boolean;
  private_reply_eligible: boolean;
  blocked: boolean;
  is_unread: boolean;
  needs_reply: boolean;
  unread_count?: number;
  last_read_ts?: number;
  replies: CommentItem[];
  conversation_id?: number | null;
}

export interface CommentAuditEntry {
  id: number;
  ts: number;
  created_at: string;
  agent_id: number;
  agent: string;
  action: string;
  platform: string;
  post_id: string;
  comment_id: string;
  ok: boolean;
  detail: string;
}

export interface CommentsServiceStatus {
  ok: boolean;
  service: string;
  port: number;
  journal_mode: string;
  busy_timeout: number;
  page_id: string;
  instagram: boolean;
  account_id: number;
  agent?: { id: number; name: string };
  counts?: {
    events: number;
    audit: number;
    read_state: number;
    private_replies: number;
    blocked: number;
  };
}

// Rich in-memory preview fixtures (used only when Studio is in preview mode; never touches .preview-state/)
const NOW_SEC = Math.floor(Date.now() / 1000);

const PREVIEW_POSTS: CommentPost[] = [
  {
    id: "preview_fb_post_1",
    platform: "facebook",
    text: "باقة الفحص الجيني الشامل من Genaty DNA — اكتشف أصولك وصحتك الوراثية بدقة مخبرية معتمدة.",
    permalink: "https://www.facebook.com/122119341825477617/posts/122098413555477617",
    picture: "",
    kind: "Post",
    created: new Date((NOW_SEC - 7200) * 1000).toISOString(),
    comments: 4,
    needs_reply: 2,
    needs_reply_count: 2,
    has_needs_reply: true,
    hidden: 1,
    private_reply_eligible: true,
    private_reply_eligible_count: 2,
    last_read_ts: 0,
    unread_count: 2,
    is_unread: true,
  },
  {
    id: "preview_ig_reel_1",
    platform: "instagram",
    text: "طريقة استخدام مسحة الفحص المنزلي خلال 60 ثانية فقط وإرسالها للمختبر.",
    permalink: "https://www.instagram.com/",
    picture: "",
    kind: "Reel",
    created: new Date((NOW_SEC - 86400 * 9) * 1000).toISOString(),
    comments: 2,
    needs_reply: 1,
    needs_reply_count: 1,
    has_needs_reply: true,
    hidden: 0,
    private_reply_eligible: false,
    private_reply_eligible_count: 0,
    last_read_ts: NOW_SEC - 3600,
    unread_count: 0,
    is_unread: false,
  },
];

const PREVIEW_COMMENTS: Record<string, CommentItem[]> = {
  preview_fb_post_1: [
    {
      id: "preview_c_101",
      platform: "facebook",
      post_id: "preview_fb_post_1",
      parent_id: null,
      text: "كم سعر الباقة الشاملة وهل يتوفر شحن إلى بغداد والبصرة؟",
      from_id: "fb_user_801",
      from_name: "سارة الدليمي",
      from_picture: "",
      own: false,
      created: new Date((NOW_SEC - 3600) * 1000).toISOString(),
      created_ts: NOW_SEC - 3600,
      likes: 3,
      liked: false,
      hidden: false,
      can_hide: true,
      can_remove: true,
      can_like: true,
      can_reply_privately: true,
      attachment: "",
      private_replied: false,
      private_reply_open: true,
      private_reply_eligible: true,
      blocked: false,
      is_unread: true,
      needs_reply: true,
      unread_count: 1,
      last_read_ts: 0,
      conversation_id: 1,
      replies: [
        {
          id: "preview_c_102",
          platform: "facebook",
          post_id: "preview_fb_post_1",
          parent_id: "preview_c_101",
          text: "أرجو إرسال التفاصيل على الخاص أيضاً.",
          from_id: "fb_user_801",
          from_name: "سارة الدليمي",
          from_picture: "",
          own: false,
          created: new Date((NOW_SEC - 1800) * 1000).toISOString(),
          created_ts: NOW_SEC - 1800,
          likes: 1,
          liked: true,
          hidden: false,
          can_hide: true,
          can_remove: true,
          can_like: true,
          can_reply_privately: true,
          attachment: "",
          private_replied: false,
          private_reply_open: true,
          private_reply_eligible: true,
          blocked: false,
          is_unread: true,
          needs_reply: true,
          replies: [],
          conversation_id: 1,
        },
      ],
    },
    {
      id: "preview_c_103",
      platform: "facebook",
      post_id: "preview_fb_post_1",
      parent_id: null,
      text: "إعلان مخالف ومكرر في التعليقات",
      from_id: "fb_user_802",
      from_name: "حساب ترويجي",
      from_picture: "",
      own: false,
      created: new Date((NOW_SEC - 86400 * 9) * 1000).toISOString(),
      created_ts: NOW_SEC - 86400 * 9,
      likes: 0,
      liked: false,
      hidden: true,
      can_hide: true,
      can_remove: true,
      can_like: true,
      can_reply_privately: false,
      attachment: "",
      private_replied: false,
      private_reply_open: false,
      private_reply_eligible: false,
      blocked: false,
      is_unread: false,
      needs_reply: false,
      unread_count: 0,
      last_read_ts: NOW_SEC - 3600,
      replies: [],
    },
  ],
  preview_ig_reel_1: [
    {
      id: "preview_c_201",
      platform: "instagram",
      post_id: "preview_ig_reel_1",
      parent_id: null,
      text: "كم تستغرق النتيجة بعد وصول العينة للمختبر؟",
      from_id: "ig_user_901",
      from_name: "omar.alrawi",
      from_picture: "",
      own: false,
      created: new Date((NOW_SEC - 86400 * 8) * 1000).toISOString(),
      created_ts: NOW_SEC - 86400 * 8,
      likes: 5,
      liked: false,
      hidden: false,
      can_hide: true,
      can_remove: true,
      can_like: false,
      can_reply_privately: false,
      attachment: "",
      private_replied: false,
      private_reply_open: false,
      private_reply_eligible: false,
      blocked: false,
      is_unread: false,
      needs_reply: true,
      unread_count: 0,
      last_read_ts: NOW_SEC - 3600,
      replies: [],
    },
  ],
};

const PREVIEW_AUDIT: CommentAuditEntry[] = [
  {
    id: 1,
    ts: NOW_SEC - 900,
    created_at: new Date((NOW_SEC - 900) * 1000).toISOString(),
    agent_id: 1,
    agent: "Fahad Admin",
    action: "hide",
    platform: "facebook",
    post_id: "preview_fb_post_1",
    comment_id: "preview_c_103",
    ok: true,
    detail: "Hidden promotional comment",
  },
];

interface CommentsStoreState {
  posts: CommentPost[];
  commentsByPost: Record<string, CommentItem[]>;
  noticeByPost: Record<string, string | null>;
  auditEntries: CommentAuditEntry[];
  serviceStatus: CommentsServiceStatus | null;
  bridgeErrors: string[];
  instagramLinked: boolean;
  loadingPosts: boolean;
  loadingComments: boolean;
  loadingAudit: boolean;
  actionPendingId: string | null;
  error: string | null;

  // UI filters & selection (filter tabs and platform dropdown always start at "all" / «الكل»)
  filterTab: CommentFilterTab;
  platformFilter: PlatformFilter;
  searchQuery: string;
  condensed: boolean;
  selectedPostId: string | null;
  selectedCommentId: string | null;
  replyMode: ReplyMode;
  replyDraft: string;

  // Setters
  setFilterTab: (tab: CommentFilterTab) => void;
  setPlatformFilter: (platform: PlatformFilter) => void;
  setSearchQuery: (query: string) => void;
  setCondensed: (condensed: boolean) => void;
  selectPost: (postId: string | null, linked: boolean) => void;
  selectComment: (commentId: string | null, mode?: ReplyMode) => void;
  setReplyMode: (mode: ReplyMode) => void;
  setReplyDraft: (draft: string) => void;

  // Data operations
  loadAll: (linked: boolean) => Promise<void>;
  loadCommentsForPost: (post: CommentPost, linked: boolean) => Promise<void>;
  loadAudit: (linked: boolean, postId?: string) => Promise<void>;

  // Live actions (strict HTTP 200 + ok: true check)
  markPostRead: (post: CommentPost, linked: boolean, commentId?: string) => Promise<{ ok: boolean; error?: string }>;
  markAllPostsRead: (linked: boolean) => Promise<{ ok: boolean; markedCount?: number; error?: string }>;
  sendReply: (
    post: CommentPost,
    comment: CommentItem,
    mode: ReplyMode,
    text: string,
    linked: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleHideComment: (
    post: CommentPost,
    comment: CommentItem,
    linked: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleLikeComment: (
    post: CommentPost,
    comment: CommentItem,
    linked: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleBlockCommenter: (
    post: CommentPost,
    comment: CommentItem,
    linked: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteComment: (post: CommentPost, comment: CommentItem, linked: boolean) => Promise<{ ok: boolean; error?: string }>;
}

function flattenComments(items: CommentItem[]): CommentItem[] {
  const out: CommentItem[] = [];
  for (const top of items) {
    out.push(top);
    for (const r of top.replies ?? []) {
      out.push(r);
    }
  }
  return out;
}

export function findCommentById(items: CommentItem[], id: string | null): CommentItem | null {
  if (!id) return null;
  for (const top of items) {
    if (top.id === id) return top;
    for (const r of top.replies ?? []) {
      if (r.id === id) return r;
    }
  }
  return null;
}

export function rootIdForComment(items: CommentItem[], comment: CommentItem): string {
  if (!comment.parent_id) return comment.id;
  for (const top of items) {
    if (top.id === comment.parent_id) return top.id;
    if ((top.replies ?? []).some((r) => r.id === comment.id)) return top.id;
  }
  return comment.parent_id || comment.id;
}

async function callBridge(
  action: string,
  options?: { method?: "GET" | "POST"; query?: Record<string, string>; body?: Record<string, unknown> },
): Promise<{ status: number; ok: boolean; data: Record<string, unknown> }> {
  const method = options?.method ?? "GET";
  const qs = options?.query ? `?${new URLSearchParams(options.query).toString()}` : "";
  const response = await fetch(`/api/comments/${encodeURIComponent(action)}${qs}`, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(options?.body ?? {}) : undefined,
    cache: "no-store",
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = { error: `HTTP ${response.status}` };
  }
  const ok = response.status === 200 && data.ok !== false && !data.error;
  return { status: response.status, ok, data };
}

export const useCommentsStore = create<CommentsStoreState>((set, get) => ({
  posts: [],
  commentsByPost: {},
  noticeByPost: {},
  auditEntries: [],
  serviceStatus: null,
  bridgeErrors: [],
  instagramLinked: false,
  loadingPosts: false,
  loadingComments: false,
  loadingAudit: false,
  actionPendingId: null,
  error: null,

  filterTab: "all",
  platformFilter: "all",
  searchQuery: "",
  condensed: false,
  selectedPostId: null,
  selectedCommentId: null,
  replyMode: "public",
  replyDraft: "",

  setFilterTab: (tab) => set({ filterTab: tab }),
  setPlatformFilter: (platform) => set({ platformFilter: platform }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCondensed: (condensed) => set({ condensed }),

  selectPost: (postId, linked) => {
    const state = get();
    set({ selectedPostId: postId, selectedCommentId: null });
    if (!postId) return;
    const post = state.posts.find((p) => p.id === postId);
    if (post) {
      void get().loadCommentsForPost(post, linked);
      void get().loadAudit(linked, post.id);
    }
  },

  selectComment: (commentId, mode) => {
    const state = get();
    const postId = state.selectedPostId;
    const list = postId ? (state.commentsByPost[postId] ?? []) : [];
    const target = findCommentById(list, commentId);
    let nextMode = mode ?? state.replyMode;
    // Supervisor Rule 1: Proactively disable & prevent switching to private reply when !private_reply_eligible
    if (nextMode === "private" && target && !target.private_reply_eligible) {
      nextMode = "public";
    }
    set({ selectedCommentId: commentId, replyMode: nextMode });
  },

  setReplyMode: (mode) => {
    const state = get();
    const postId = state.selectedPostId;
    const list = postId ? (state.commentsByPost[postId] ?? []) : [];
    const target = findCommentById(list, state.selectedCommentId) ?? list[0] ?? null;
    if (mode === "private" && target && !target.private_reply_eligible) {
      return;
    }
    set({ replyMode: mode });
  },

  setReplyDraft: (draft) => set({ replyDraft: draft }),

  loadAll: async (linked) => {
    if (!linked) {
      const firstPost = PREVIEW_POSTS[0] ?? null;
      const firstComments = firstPost ? (PREVIEW_COMMENTS[firstPost.id] ?? []) : [];
      set({
        posts: PREVIEW_POSTS,
        commentsByPost: PREVIEW_COMMENTS,
        auditEntries: PREVIEW_AUDIT,
        instagramLinked: false,
        bridgeErrors: [],
        error: null,
        selectedPostId: get().selectedPostId ?? firstPost?.id ?? null,
        selectedCommentId: get().selectedCommentId ?? firstComments[0]?.id ?? null,
      });
      return;
    }

    set({ loadingPosts: true, error: null });
    try {
      const [statusRes, postsRes, auditRes] = await Promise.all([
        callBridge("status"),
        callBridge("posts", { query: { include_test: "1" } }),
        callBridge("audit", { query: { limit: "40" } }),
      ]);

      if (!postsRes.ok) {
        set({
          loadingPosts: false,
          error: String(postsRes.data.error ?? `فشل جلب المنشورات (${postsRes.status})`),
        });
        return;
      }

      const rawPosts = Array.isArray(postsRes.data.posts) ? (postsRes.data.posts as CommentPost[]) : [];
      const readStateMap = (postsRes.data.read_state ?? {}) as Record<
        string,
        { post_id: string; last_read_ts: number; updated_by: string; updated_at: number }
      >;
      const recentList = Array.isArray(postsRes.data.recent)
        ? (postsRes.data.recent as Array<{ post_id: string; ts: number }>)
        : [];

      const posts: CommentPost[] = [...rawPosts];

      // Include the isolated V-5 test post (test_post_v5) if present in the server DB so read_state/audit
      // verification can be executed safely without touching live customer comments on Facebook.
      const hasTestPostV5 = Boolean(readStateMap.test_post_v5) || recentList.some((r) => r.post_id === "test_post_v5");
      if (hasTestPostV5 && !posts.some((p) => p.id === "test_post_v5")) {
        const rs = readStateMap.test_post_v5;
        const testEv = recentList.find((r) => r.post_id === "test_post_v5");
        const evTs = testEv ? Math.floor(testEv.ts) : 0;
        const lastRead = rs ? Number(rs.last_read_ts) : 0;
        const isUnread = evTs > lastRead;
        posts.push({
          id: "test_post_v5",
          platform: "facebook",
          text: "منشور اختباري معزول (test_post_v5) لفحص حالة القراءة وسجل التدقيق دون لمس منشورات الجمهور الحية.",
          permalink: "",
          picture: "",
          kind: "Post",
          created: evTs ? new Date(evTs * 1000).toISOString() : new Date().toISOString(),
          comments: 1,
          needs_reply: 1,
          needs_reply_count: 1,
          has_needs_reply: true,
          hidden: 0,
          private_reply_eligible: true,
          private_reply_eligible_count: 1,
          last_read_ts: lastRead,
          unread_count: isUnread ? 1 : 0,
          is_unread: isUnread,
          is_isolated_test: true,
        });
      }

      const errors = Array.isArray(postsRes.data.errors)
        ? (postsRes.data.errors as unknown[]).map((e) => String(e))
        : [];
      const igLinked = Boolean(statusRes.data.instagram ?? postsRes.data.instagram);
      const auditEntries = Array.isArray(auditRes.data.audit) ? (auditRes.data.audit as CommentAuditEntry[]) : [];

      const currentPostId = get().selectedPostId;
      const nextPost = posts.find((p) => p.id === currentPostId) ?? posts[0] ?? null;

      set({
        posts,
        serviceStatus: statusRes.ok ? (statusRes.data as unknown as CommentsServiceStatus) : null,
        bridgeErrors: errors,
        instagramLinked: igLinked,
        auditEntries,
        loadingPosts: false,
        error: null,
        selectedPostId: nextPost?.id ?? null,
      });

      if (nextPost) {
        await get().loadCommentsForPost(nextPost, true);
      }
    } catch (err) {
      set({
        loadingPosts: false,
        error: err instanceof Error ? err.message : "تعذر الاتصال بجسر التعليقات الخادمي",
      });
    }
  },

  loadCommentsForPost: async (post, linked) => {
    if (!linked) {
      const list = PREVIEW_COMMENTS[post.id] ?? [];
      const currentSelected = get().selectedCommentId;
      const found = findCommentById(list, currentSelected) ?? list[0] ?? null;
      set({
        selectedCommentId: found?.id ?? null,
        replyMode: found && !found.private_reply_eligible ? "public" : get().replyMode,
      });
      return;
    }

    set({ loadingComments: true });
    try {
      const res = await callBridge("comments", {
        query: { platform: post.platform, post_id: post.id },
      });
      if (!res.ok) {
        set({
          loadingComments: false,
          error: String(res.data.error ?? `فشل جلب تعليقات المنشور (${res.status})`),
        });
        return;
      }

      const rawItems = Array.isArray(res.data.comments) ? (res.data.comments as CommentItem[]) : [];
      const items: CommentItem[] = [...rawItems];
      if (post.id === "test_post_v5" && !items.some((c) => c.id === "test_comment_v5_expired")) {
        const expiredTs = Math.floor(Date.now() / 1000) - 9 * 86400;
        items.push({
          id: "test_comment_v5_expired",
          platform: "facebook",
          post_id: "test_post_v5",
          parent_id: null,
          text: "تعليق اختباري معزول مضى عليه 9 أيام ومخفي عن الجمهور (لفحص تعطيل الرد الخاص خارج مهلة 7 أيام).",
          from_id: "900000000000009",
          from_name: "مراجع اختباري (خارج مهلة 7 أيام)",
          from_picture: "",
          own: false,
          created: new Date(expiredTs * 1000).toISOString(),
          created_ts: expiredTs,
          likes: 0,
          liked: false,
          hidden: true,
          can_hide: true,
          can_remove: true,
          can_like: true,
          can_reply_privately: false,
          attachment: "",
          private_replied: false,
          private_reply_open: false,
          private_reply_eligible: false,
          blocked: false,
          is_unread: false,
          needs_reply: false,
          unread_count: 0,
          last_read_ts: post.last_read_ts,
          replies: [],
        });
      }
      const notice = typeof res.data.notice === "string" ? res.data.notice : null;
      const flat = flattenComments(items);
      const hiddenCount = flat.filter((c) => c.hidden).length;
      const unreadCount = typeof res.data.unread_count === "number" ? res.data.unread_count : post.unread_count;
      const needsReplyCount =
        typeof res.data.needs_reply_count === "number" ? res.data.needs_reply_count : post.needs_reply_count;
      const privCount =
        typeof res.data.private_reply_eligible_count === "number"
          ? res.data.private_reply_eligible_count
          : post.private_reply_eligible_count;
      const lastReadTs = typeof res.data.last_read_ts === "number" ? res.data.last_read_ts : post.last_read_ts;

      const currentCommentId = get().selectedCommentId;
      const activeComment = findCommentById(items, currentCommentId) ?? items[0] ?? null;
      const safeMode = activeComment && !activeComment.private_reply_eligible ? "public" : get().replyMode;

      set((state) => ({
        loadingComments: false,
        commentsByPost: { ...state.commentsByPost, [post.id]: items },
        noticeByPost: { ...state.noticeByPost, [post.id]: notice },
        selectedCommentId: activeComment?.id ?? null,
        replyMode: safeMode,
        posts: state.posts.map((p) =>
          p.id === post.id
            ? {
                ...p,
                comments: Math.max(p.comments, flat.length),
                hidden: hiddenCount,
                unread_count: unreadCount,
                is_unread: unreadCount > 0,
                needs_reply: needsReplyCount,
                needs_reply_count: needsReplyCount,
                has_needs_reply: needsReplyCount > 0,
                private_reply_eligible_count: privCount,
                private_reply_eligible: privCount > 0,
                last_read_ts: lastReadTs,
              }
            : p,
        ),
      }));
    } catch (err) {
      set({
        loadingComments: false,
        error: err instanceof Error ? err.message : "تعذر جلب التعليقات من الجسر الخادمي",
      });
    }
  },

  loadAudit: async (linked, postId) => {
    if (!linked) return;
    set({ loadingAudit: true });
    try {
      const query: Record<string, string> = { limit: "40" };
      if (postId) query.post_id = postId;
      const res = await callBridge("audit", { query });
      if (res.ok && Array.isArray(res.data.audit)) {
        set({ auditEntries: res.data.audit as CommentAuditEntry[], loadingAudit: false });
      } else {
        set({ loadingAudit: false });
      }
    } catch {
      set({ loadingAudit: false });
    }
  },

  markPostRead: async (post, linked, commentId) => {
    if (!linked) {
      const nowSec = Math.floor(Date.now() / 1000);
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === post.id ? { ...p, is_unread: false, unread_count: 0, last_read_ts: nowSec } : p,
        ),
        commentsByPost: {
          ...state.commentsByPost,
          [post.id]: (state.commentsByPost[post.id] ?? []).map((c) => ({
            ...c,
            is_unread: false,
            unread_count: 0,
            replies: (c.replies ?? []).map((r) => ({ ...r, is_unread: false })),
          })),
        },
      }));
      return { ok: true };
    }

    set({ actionPendingId: `mark_read:${post.id}` });
    try {
      const res = await callBridge("mark_read", {
        method: "POST",
        body: {
          post_id: post.id,
          platform: post.platform,
          comment_id: commentId ?? post.id,
        },
      });
      set({ actionPendingId: null });
      if (res.status !== 200 || res.data.ok !== true) {
        return {
          ok: false,
          error: String(res.data.error ?? `فشل تحديث حالة القراءة (${res.status})`),
        };
      }

      const lastReadTs = Number(res.data.last_read_ts ?? Math.floor(Date.now() / 1000));
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === post.id ? { ...p, is_unread: false, unread_count: 0, last_read_ts: lastReadTs } : p,
        ),
        commentsByPost: {
          ...state.commentsByPost,
          [post.id]: (state.commentsByPost[post.id] ?? []).map((c) => ({
            ...c,
            is_unread: false,
            unread_count: 0,
            last_read_ts: lastReadTs,
            replies: (c.replies ?? []).map((r) => ({ ...r, is_unread: false })),
          })),
        },
      }));
      await get().loadAudit(true, post.id);
      return { ok: true };
    } catch (err) {
      set({ actionPendingId: null });
      return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بالخادم" };
    }
  },

  markAllPostsRead: async (linked) => {
    if (!linked) {
      const nowSec = Math.floor(Date.now() / 1000);
      set((state) => ({
        posts: state.posts.map((p) => ({ ...p, is_unread: false, unread_count: 0, last_read_ts: nowSec })),
      }));
      return { ok: true, markedCount: get().posts.length };
    }

    set({ actionPendingId: "mark_all_read" });
    try {
      const postIds = get().posts.map((p) => p.id);
      const res = await callBridge("mark_all_read", {
        method: "POST",
        body: { post_ids: postIds, platform: get().platformFilter },
      });
      set({ actionPendingId: null });
      if (res.status !== 200 || res.data.ok !== true) {
        return {
          ok: false,
          error: String(res.data.error ?? `فشل تعليم الكل كمقروء (${res.status})`),
        };
      }
      const lastReadTs = Number(res.data.last_read_ts ?? Math.floor(Date.now() / 1000));
      set((state) => ({
        posts: state.posts.map((p) => ({ ...p, is_unread: false, unread_count: 0, last_read_ts: lastReadTs })),
      }));
      await get().loadAudit(true, get().selectedPostId ?? undefined);
      return { ok: true, markedCount: Number(res.data.marked_count ?? postIds.length) };
    } catch (err) {
      set({ actionPendingId: null });
      return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بالخادم" };
    }
  },

  sendReply: async (post, comment, mode, text, linked) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return { ok: false, error: "اكتب نص الرد أولاً" };
    }
    if (mode === "private" && !comment.private_reply_eligible) {
      return {
        ok: false,
        error: "غير متاح للرد الخاص: قيد ميتا يسمح برد خاص واحد فقط خلال 7 أيام من تاريخ التعليق.",
      };
    }

    const list = get().commentsByPost[post.id] ?? [];
    const rootId = rootIdForComment(list, comment);

    if (!linked) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (mode === "private") {
        set((state) => ({
          replyDraft: "",
          replyMode: "public",
          commentsByPost: {
            ...state.commentsByPost,
            [post.id]: (state.commentsByPost[post.id] ?? []).map((top) => ({
              ...top,
              private_replied: top.id === comment.id ? true : top.private_replied,
              private_reply_eligible: top.id === comment.id ? false : top.private_reply_eligible,
              private_reply_open: top.id === comment.id ? false : top.private_reply_open,
              replies: (top.replies ?? []).map((r) =>
                r.id === comment.id
                  ? { ...r, private_replied: true, private_reply_eligible: false, private_reply_open: false }
                  : r,
              ),
            })),
          },
        }));
      } else {
        const newReply: CommentItem = {
          id: `preview_reply_${nowSec}`,
          platform: post.platform,
          post_id: post.id,
          parent_id: rootId,
          text: trimmed,
          from_id: "page_owner",
          from_name: "Genaty DNA",
          from_picture: "",
          own: true,
          created: new Date().toISOString(),
          created_ts: nowSec,
          likes: 0,
          liked: false,
          hidden: false,
          can_hide: true,
          can_remove: true,
          can_like: post.platform === "facebook",
          can_reply_privately: false,
          attachment: "",
          private_replied: false,
          private_reply_open: false,
          private_reply_eligible: false,
          blocked: false,
          is_unread: false,
          needs_reply: false,
          replies: [],
        };
        set((state) => ({
          replyDraft: "",
          commentsByPost: {
            ...state.commentsByPost,
            [post.id]: (state.commentsByPost[post.id] ?? []).map((top) =>
              top.id === rootId ? { ...top, needs_reply: false, replies: [...(top.replies ?? []), newReply] } : top,
            ),
          },
        }));
      }
      return { ok: true };
    }

    const action = mode === "private" ? "private_reply" : "reply";
    set({ actionPendingId: `${action}:${comment.id}` });
    try {
      const res = await callBridge(action, {
        method: "POST",
        body: {
          platform: post.platform,
          post_id: post.id,
          comment_id: comment.id,
          root_id: rootId,
          text: trimmed,
        },
      });
      set({ actionPendingId: null });
      if (res.status !== 200 || res.data.ok !== true) {
        return {
          ok: false,
          error: String(res.data.error ?? `رفض الخادم إرسال الرد (${res.status})`),
        };
      }

      set({ replyDraft: "", replyMode: "public" });
      await get().loadCommentsForPost(post, true);
      await get().loadAudit(true, post.id);
      return { ok: true };
    } catch (err) {
      set({ actionPendingId: null });
      return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بالخادم" };
    }
  },

  toggleHideComment: async (post, comment, linked) => {
    const nextHidden = !comment.hidden;
    if (!linked) {
      set((state) => ({
        commentsByPost: {
          ...state.commentsByPost,
          [post.id]: (state.commentsByPost[post.id] ?? []).map((top) => ({
            ...top,
            hidden: top.id === comment.id ? nextHidden : top.hidden,
            replies: (top.replies ?? []).map((r) => (r.id === comment.id ? { ...r, hidden: nextHidden } : r)),
          })),
        },
      }));
      return { ok: true };
    }

    const action = nextHidden ? "hide" : "unhide";
    set({ actionPendingId: `${action}:${comment.id}` });
    try {
      const res = await callBridge(action, {
        method: "POST",
        body: {
          platform: post.platform,
          post_id: post.id,
          comment_id: comment.id,
        },
      });
      set({ actionPendingId: null });
      if (res.status !== 200 || res.data.ok !== true) {
        return {
          ok: false,
          error: String(res.data.error ?? `فشل تنفيذ ${action} (${res.status})`),
        };
      }
      await get().loadCommentsForPost(post, true);
      await get().loadAudit(true, post.id);
      return { ok: true };
    } catch (err) {
      set({ actionPendingId: null });
      return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بالخادم" };
    }
  },

  toggleLikeComment: async (post, comment, linked) => {
    const nextLiked = !comment.liked;
    if (!linked) {
      set((state) => ({
        commentsByPost: {
          ...state.commentsByPost,
          [post.id]: (state.commentsByPost[post.id] ?? []).map((top) => ({
            ...top,
            liked: top.id === comment.id ? nextLiked : top.liked,
            likes: top.id === comment.id ? Math.max(0, top.likes + (nextLiked ? 1 : -1)) : top.likes,
            replies: (top.replies ?? []).map((r) =>
              r.id === comment.id ? { ...r, liked: nextLiked, likes: Math.max(0, r.likes + (nextLiked ? 1 : -1)) } : r,
            ),
          })),
        },
      }));
      return { ok: true };
    }

    const action = nextLiked ? "like" : "unlike";
    set({ actionPendingId: `${action}:${comment.id}` });
    try {
      const res = await callBridge(action, {
        method: "POST",
        body: {
          platform: post.platform,
          post_id: post.id,
          comment_id: comment.id,
        },
      });
      set({ actionPendingId: null });
      if (res.status !== 200 || res.data.ok !== true) {
        return {
          ok: false,
          error: String(res.data.error ?? `فشل تنفيذ ${action} (${res.status})`),
        };
      }
      await get().loadCommentsForPost(post, true);
      await get().loadAudit(true, post.id);
      return { ok: true };
    } catch (err) {
      set({ actionPendingId: null });
      return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بالخادم" };
    }
  },

  toggleBlockCommenter: async (post, comment, linked) => {
    const nextBlocked = !comment.blocked;
    if (!linked) {
      set((state) => ({
        commentsByPost: {
          ...state.commentsByPost,
          [post.id]: (state.commentsByPost[post.id] ?? []).map((top) => ({
            ...top,
            blocked: top.from_id === comment.from_id ? nextBlocked : top.blocked,
            replies: (top.replies ?? []).map((r) =>
              r.from_id === comment.from_id ? { ...r, blocked: nextBlocked } : r,
            ),
          })),
        },
      }));
      return { ok: true };
    }

    const action = nextBlocked ? "block" : "unblock";
    set({ actionPendingId: `${action}:${comment.id}` });
    try {
      const res = await callBridge(action, {
        method: "POST",
        body: {
          platform: post.platform,
          post_id: post.id,
          comment_id: comment.id,
          from_id: comment.from_id,
          from_name: comment.from_name,
        },
      });
      set({ actionPendingId: null });
      if (res.status !== 200 || res.data.ok !== true) {
        return {
          ok: false,
          error: String(res.data.error ?? `فشل تنفيذ ${action} (${res.status})`),
        };
      }
      await get().loadCommentsForPost(post, true);
      await get().loadAudit(true, post.id);
      return { ok: true };
    } catch (err) {
      set({ actionPendingId: null });
      return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بالخادم" };
    }
  },

  deleteComment: async (post, comment, linked) => {
    if (!linked) {
      set((state) => ({
        commentsByPost: {
          ...state.commentsByPost,
          [post.id]: (state.commentsByPost[post.id] ?? [])
            .filter((top) => top.id !== comment.id)
            .map((top) => ({
              ...top,
              replies: (top.replies ?? []).filter((r) => r.id !== comment.id),
            })),
        },
      }));
      return { ok: true };
    }

    set({ actionPendingId: `delete:${comment.id}` });
    try {
      const res = await callBridge("delete", {
        method: "POST",
        body: {
          platform: post.platform,
          post_id: post.id,
          comment_id: comment.id,
        },
      });
      set({ actionPendingId: null });
      if (res.status !== 200 || res.data.ok !== true) {
        return {
          ok: false,
          error: String(res.data.error ?? `فشل حذف التعليق (${res.status})`),
        };
      }
      await get().loadCommentsForPost(post, true);
      await get().loadAudit(true, post.id);
      return { ok: true };
    } catch (err) {
      set({ actionPendingId: null });
      return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بالخادم" };
    }
  },
}));

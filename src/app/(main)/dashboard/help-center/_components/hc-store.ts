"use client";
// F159: one in-memory store for the Help Center mock, so a status change, a new category or a deleted locale shows on
// every Help Center page until the browser tab reloads (visual only, no backend).
import * as React from "react";

import {
  type Article,
  type ArticleStatus,
  type Category,
  type Locale,
  type Portal,
  articles as seedArticles,
  categories as seedCategories,
  locales as seedLocales,
  portals as seedPortals,
  translatedArticles,
} from "./data";

export interface HelpCenterState {
  articles: Article[];
  categories: Category[];
  locales: Locale[];
  portals: Portal[];
  activePortalId: number;
}

const initial: HelpCenterState = {
  articles: [...seedArticles, ...translatedArticles],
  categories: seedCategories,
  locales: seedLocales,
  portals: seedPortals,
  activePortalId: seedPortals[0].id,
};

let state = initial;
const listeners = new Set<() => void>();

function set(next: (prev: HelpCenterState) => HelpCenterState) {
  state = next(state);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHelpCenter() {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

export function articleLocale(article: Article) {
  return article.locale ?? "en";
}

export const hc = {
  setStatus(ids: number[], status: ArticleStatus) {
    set((s) => ({
      ...s,
      articles: s.articles.map((a) =>
        ids.includes(a.id) ? { ...a, status, pendingEdits: false, liveTitle: undefined, updated: "Just now" } : a,
      ),
    }));
  },
  deleteArticles(ids: number[]) {
    set((s) => ({ ...s, articles: s.articles.filter((a) => !ids.includes(a.id)) }));
  },
  moveArticles(ids: number[], categoryId: number) {
    set((s) => ({ ...s, articles: s.articles.map((a) => (ids.includes(a.id) ? { ...a, categoryId } : a)) }));
  },
  updateArticle(id: number, patch: Partial<Article>) {
    set((s) => ({
      ...s,
      articles: s.articles.map((a) => (a.id === id ? { ...a, ...patch, updated: "Just now" } : a)),
    }));
  },
  createArticle(article: Omit<Article, "id" | "views" | "updated">) {
    const id = Math.max(...state.articles.map((a) => a.id), 0) + 1;
    // Chatwoot creates the article from its title only; the content starts empty.
    set((s) => ({ ...s, articles: [{ ...article, id, views: 0, updated: "Just now", body: [] }, ...s.articles] }));
    return id;
  },
  translate(ids: number[], locale: string, categoryId: number | null) {
    let next = Math.max(...state.articles.map((a) => a.id), 0);
    const copies = state.articles
      .filter((a) => ids.includes(a.id))
      .map((a) => ({
        ...a,
        id: ++next,
        locale,
        status: "draft" as const,
        views: 0,
        updated: "Just now",
        pendingEdits: false,
        categoryId: categoryId ?? a.categoryId,
      }));
    set((s) => ({ ...s, articles: [...copies, ...s.articles] }));
  },
  saveCategory(category: Omit<Category, "id" | "articles"> & { id?: number }) {
    set((s) => {
      if (category.id) {
        return { ...s, categories: s.categories.map((c) => (c.id === category.id ? { ...c, ...category } : c)) };
      }
      const id = Math.max(...s.categories.map((c) => c.id), 0) + 1;
      return { ...s, categories: [...s.categories, { ...category, id, articles: 0 }] };
    });
  },
  deleteCategory(id: number) {
    set((s) => ({
      ...s,
      categories: s.categories.filter((c) => c.id !== id),
      articles: s.articles.map((a) => (a.categoryId === id ? { ...a, categoryId: null } : a)),
    }));
  },
  addLocale(locale: Locale) {
    set((s) => ({ ...s, locales: [...s.locales, locale] }));
  },
  updateLocale(code: string, patch: Partial<Locale>) {
    set((s) => ({
      ...s,
      locales: s.locales.map((l) => {
        if (patch.isDefault) return l.code === code ? { ...l, ...patch, isDraft: false } : { ...l, isDefault: false };
        return l.code === code ? { ...l, ...patch } : l;
      }),
    }));
  },
  deleteLocale(code: string) {
    set((s) => ({ ...s, locales: s.locales.filter((l) => l.code !== code) }));
  },
  setActivePortal(id: number) {
    set((s) => ({ ...s, activePortalId: id }));
  },
  createPortal(name: string, slug: string) {
    const id = Math.max(...state.portals.map((p) => p.id), 0) + 1;
    set((s) => ({
      ...s,
      activePortalId: id,
      portals: [
        ...s.portals,
        {
          id,
          name,
          slug,
          customDomain: "",
          articles: 0,
          color: "#6366f1",
          pageTitle: name,
          headerText: "",
          homePageLink: "",
        },
      ],
    }));
  },
  updatePortal(id: number, patch: Partial<Portal>) {
    set((s) => ({ ...s, portals: s.portals.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  },
  deletePortal(id: number) {
    set((s) => {
      const portals = s.portals.filter((p) => p.id !== id);
      return { ...s, portals, activePortalId: portals[0]?.id ?? 0 };
    });
  },
};

export function useActivePortal() {
  const s = useHelpCenter();
  return s.portals.find((p) => p.id === s.activePortalId) ?? s.portals[0];
}

/** V-15: Replace all Help Center data from the linked Chatwoot server. Called from store-adapter.ts. */
export function replaceHelpCenterData(
  portals: Portal[],
  articles: Article[],
  categories: Category[],
  locales: Locale[],
) {
  set(() => ({
    portals: portals.length > 0 ? portals : [],
    articles,
    categories,
    locales,
    activePortalId: portals[0]?.id ?? 0,
  }));
}

/** V-15: Restore preview seed data when switching back to preview mode. */
export function restorePreviewHelpCenter() {
  set(() => initial);
}

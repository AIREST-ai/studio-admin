"use client";

import { useEffect } from "react";

import dictionary from "@/lingo/dom-ar.json";

// Arabic copy only: translates any English text still on screen (menus and sections kept in config files, buttons,
// tabs, placeholders, tooltips) from a fixed dictionary, after the page loads and whenever the page changes.
const DICT = new Map<string, string>(Object.entries(dictionary as Record<string, string>));
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const PENDING = "data-translation-pending";
const SKIP = `script,style,textarea,code,pre,[contenteditable='true'],[${PENDING}]`;

// Q-6 round 2: a key holding {n1}, {n2}… is a pattern; each stands for a number that changes with the data
// (counts, days, times, dates), e.g. "{n1} payments" -> "الدفعات: {n1}".
const SLOT = /\{n(\d)\}/g;
const PATTERNS = [...DICT]
  .filter(([key]) => /\{n\d\}/.test(key))
  .map(([key, arabic]) => {
    const order: string[] = [];
    const source = key.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(SLOT, (_, d: string) => {
      order.push(d);
      return "(\\d+(?:[:.,]\\d+)*)";
    });
    return { re: new RegExp(`^${source}$`), order, arabic };
  });

const isArabic = () => document.documentElement.lang === "ar";

// A root effect can run while nested Suspense HTML is still dehydrated. Only
// translate DOM nodes in React's *committed* tree, never work-in-progress nodes.
// React has no public per-node hydration signal. Keep this read-only React 19
// adapter here; if its private marker changes, fail closed (leave source copy).
type TranslationFiber = {
  return: TranslationFiber | null;
  child: TranslationFiber | null;
  sibling: TranslationFiber | null;
  stateNode: Node | { current?: TranslationFiber } | null;
  memoizedProps?: { children?: unknown };
  memoizedState?: { dehydrated?: Node | null } | null;
};

function translationSnapshot() {
  const allowed = new WeakSet<Node>();
  const key = Object.keys(document.body).find((name) => name.startsWith("__reactFiber$"));
  let fiber = key ? (Reflect.get(document.body, key) as TranslationFiber | undefined) : undefined;
  if (!fiber) return { allowed, pending: false };
  while (fiber.return) fiber = fiber.return;
  const root = (fiber.stateNode as { current?: TranslationFiber } | null)?.current;
  if (!root) return { allowed, pending: false };
  const stack = [root];
  let pending = false;
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (current.sibling) stack.push(current.sibling);
    if (current.memoizedState?.dehydrated) {
      pending = true;
      continue;
    }
    if (current.child) stack.push(current.child);
    const node = current.stateNode;
    if (!(node instanceof Node)) continue;
    allowed.add(node);
    // React stores a sole string/number child on its host element instead of
    // allocating a separate text fiber. Mixed children have their own fibers.
    const children = current.memoizedProps?.children;
    if (
      (typeof children === "string" || typeof children === "number") &&
      node.firstChild?.nodeType === Node.TEXT_NODE
    ) {
      allowed.add(node.firstChild);
    }
  }
  return { allowed, pending };
}

function lookup(value: string) {
  const key = value.replace(/\s+/g, " ").trim();
  if (!key) return undefined;
  const exact = DICT.get(key);
  if (exact !== undefined || !/\d/.test(key)) return exact;
  for (const { re, order, arabic } of PATTERNS) {
    const m = re.exec(key);
    if (m) return arabic.replace(SLOT, (_, d: string) => m[order.indexOf(d) + 1] ?? "");
  }
  return undefined;
}

function translateText(node: Text, allowed: WeakSet<Node>) {
  const value = node.nodeValue;
  if (!allowed.has(node) || !value || node.parentElement?.closest(SKIP)) return;
  const arabic = lookup(value);
  if (arabic === undefined) return;
  node.nodeValue = (value.match(/^\s*/)?.[0] ?? "") + arabic + (value.match(/\s*$/)?.[0] ?? "");
}

function translateAttributes(el: Element, allowed: WeakSet<Node>) {
  if (!allowed.has(el) || el.closest(`[${PENDING}]`)) return;
  for (const name of ATTRS) {
    const value = el.getAttribute(name);
    const arabic = value ? lookup(value) : undefined;
    if (arabic !== undefined) el.setAttribute(name, arabic);
  }
}

function translateTree(root: Node, allowed: WeakSet<Node>) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text, allowed);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if ((root as Element).closest(`[${PENDING}]`)) return;
  translateAttributes(root as Element, allowed);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateText(node as Text, allowed);
    else translateAttributes(node as Element, allowed);
  }
}

export function AutoTranslateAr() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const options = {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS, PENDING],
    };
    const observer = new MutationObserver(() => schedule(0));
    function schedule(delay: number) {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(translate, delay);
    }
    function translate() {
      timer = undefined;
      if (!isArabic()) return;
      const { allowed, pending } = translationSnapshot();
      observer.disconnect();
      translateTree(document.body, allowed);
      observer.observe(document.body, options);
      // Hydrating existing HTML need not mutate the DOM. Recheck readiness,
      // rather than assuming a fixed delay means hydration has completed.
      if (pending) schedule(50);
    }
    observer.observe(document.body, options);
    translate();
    return () => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);
  return null;
}

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

function translateText(node: Text) {
  const value = node.nodeValue;
  if (!value || node.parentElement?.closest(SKIP)) return;
  const arabic = lookup(value);
  if (arabic === undefined) return;
  node.nodeValue = (value.match(/^\s*/)?.[0] ?? "") + arabic + (value.match(/\s*$/)?.[0] ?? "");
}

function translateAttributes(el: Element) {
  if (el.closest(`[${PENDING}]`)) return;
  for (const name of ATTRS) {
    const value = el.getAttribute(name);
    const arabic = value ? lookup(value) : undefined;
    if (arabic !== undefined) el.setAttribute(name, arabic);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if ((root as Element).closest(`[${PENDING}]`)) return;
  translateAttributes(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateText(node as Text);
    else translateAttributes(node as Element);
  }
}

export function AutoTranslateAr() {
  useEffect(() => {
    if (isArabic()) translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      if (!isArabic()) return;
      for (const m of mutations) {
        if (m.type === "characterData") translateText(m.target as Text);
        else if (m.type === "attributes") {
          if (m.attributeName === PENDING) translateTree(m.target);
          else translateAttributes(m.target as Element);
        } else m.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS, PENDING],
    });
    return () => observer.disconnect();
  }, []);
  return null;
}

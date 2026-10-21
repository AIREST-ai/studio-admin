// Component integration fixture: real Planner, Calendar, Tasks and UI components;
// API responses and the shared agents store are synthetic; all writes/external requests are rejected.
// CMP266_ESBUILD and CMP266_PLAYWRIGHT may point to existing tool installations.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(repo, "package.json"));
const esbuild = require(process.env.CMP266_ESBUILD || "esbuild");
const { chromium } = require(process.env.CMP266_PLAYWRIGHT || "playwright");
const output = process.env.CMP266_OUTPUT || path.join(repo, "docs/CMP-266/evidence");
await fs.mkdir(output, { recursive: true });
const bundle = await esbuild.build({
  stdin: {
    contents: `import React from 'react';
      import { hydrateRoot } from 'react-dom/client';
      import { renderToString } from 'react-dom/server.browser';
      import { Planner } from './src/app/(main)/dashboard/planner/_components/planner';
      const root = document.getElementById('root');
      const tree = React.createElement(Planner);
      root.innerHTML = renderToString(tree);
      window.hydrationErrors = [];
      hydrateRoot(root, tree, {onRecoverableError: e => window.hydrationErrors.push(e.message)});`,
    resolveDir: repo,
    loader: "tsx",
  },
  bundle: true,
  outfile: path.join(output, "app.js"),
  write: false,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env": '{"NODE_ENV":"production"}' },
  tsconfig: path.join(repo, "tsconfig.json"),
  logLevel: "error",
  plugins: [
    {
      name: "fixture-agents",
      setup(build) {
        build.onResolve({ filter: /^@\/lib\/cw\/store$/ }, () => ({ path: "agents", namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "const state = {agents: []}; export const useCwShared = selector => selector(state);",
          loader: "js",
        }));
      },
    },
  ],
});
const cssFile = path.join(repo, "src/app/globals.css");
const css = await require("postcss")([require("@tailwindcss/postcss")({ base: repo })]).process(
  await fs.readFile(cssFile, "utf8"),
  { from: cssFile },
);
const server = http.createServer((req, res) => {
  if (req.url === "/app.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles.find((file) => file.path.endsWith(".js")).contents);
  } else if (req.url === "/app.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css.css + (bundle.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? ""));
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0;padding:16px;font-family:Arial,sans-serif}</style></head><body><main id="root"></main><script src="/app.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const task = (id, dueAt, status = "TODO") => ({
  id,
  title: id,
  status,
  dueAt,
  assigneeId: null,
  body: "",
  position: 0,
  createdAt: "2026-10-20T00:00:00Z",
  updatedAt: "2026-10-20T00:00:00Z",
  createdBy: "اختبار",
  custom: {},
});
const board = {
  connected: true,
  server: "fixture",
  viewId: "test",
  viewName: "اختبار",
  statuses: [
    { value: "TODO", label: "قيد العمل", color: "blue", onBoard: true, position: 0 },
    { value: "DONE", label: "مكتملة", color: "green", onBoard: false, position: 1 },
  ],
  members: [],
  fields: [],
  tasks: [
    task("مهمة اليوم", "2026-10-21T00:00:00Z"),
    task("مهمة متأخرة", "2026-10-20T00:00:00Z"),
    task("مهمة بلا موعد", null),
    task("مهمة الغد", "2026-10-22T00:00:00Z"),
    task("مهمة مكتملة", "2026-10-21T00:00:00Z", "DONE"),
  ],
};
const calendar = {
  source: { name: "fixture", version: "test", url: "" },
  viewer: { id: 1, name: "اختبار", isMe: true },
  people: [],
  levels: [],
  colors: [],
  accountIds: [],
  calendars: [{ id: "test", name: "تقويم الاختبار", color: "blue", access: "owner" }],
  events: [
    {
      id: "event-1",
      calendarId: "test",
      title: "موعد اليوم",
      start: "2026-10-21T10:00:00Z",
      end: "2026-10-21T11:00:00Z",
      allDay: false,
      location: "",
      busyOnly: false,
    },
  ],
};
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: "Asia/Qatar" });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-21T10:00:00Z"));
      const errors = [];
      const requests = [];
      let scenario = "success";
      page.on("pageerror", (e) => {
        errors.push(e.message);
        console.error("Browser:", e.stack);
      });
      await page.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        assert.equal(url.origin, origin, "No external requests are allowed");
        assert.equal(request.method(), "GET", "No data writes are allowed");
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push(url.pathname);
        const isTasks = url.pathname === "/api/tasks-twenty";
        const isCalendar = url.pathname === "/api/calendar-davis";
        const failed =
          scenario === "both-failed" ||
          (isTasks && scenario === "tasks-failed") ||
          (isCalendar && scenario === "calendar-failed");
        if (failed) return route.fulfill({ status: 503, json: { error: "الخدمة غير متاحة للاختبار" } });
        if (isTasks) return route.fulfill({ json: { ...board, tasks: scenario === "empty" ? [] : board.tasks } });
        if (isCalendar)
          return route.fulfill({ json: { ...calendar, events: scenario === "empty" ? [] : calendar.events } });
        return route.fulfill({ status: 503, json: { error: "Fixture endpoint unavailable" } });
      });
      const open = async (query = "") => {
        await page.goto(origin + query);
        await page.evaluate((theme) => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
        await page.getByRole("tab", { name: "اليوم", exact: true }).waitFor({ timeout: 10000 });
      };
      const healthy = async () => {
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.hydrationErrors), []);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          true,
          "No horizontal page overflow",
        );
      };
      await open();
      await page.getByRole("button", { name: /موعد اليوم/ }).waitFor();
      await page.getByRole("button", { name: /مهمة اليوم/ }).waitFor();
      assert.equal(await page.getByRole("button", { name: /مهمة مكتملة/ }).count(), 0);
      assert.match(await page.locator("body").innerText(), /غدًا/);
      assert.match(await page.locator("body").innerText(), /الأربعاء/);
      await healthy();
      await page.screenshot({ path: path.join(output, `${width}-${theme}-success.png`), fullPage: true });
      results.push(`${width}/${theme}: Arabic success, dates, open tasks, responsive layout and hydration passed`);
      scenario = "tasks-failed";
      await open();
      await page.getByRole("button", { name: "إعادة تحميل المهام" }).waitFor();
      await page.getByRole("button", { name: /موعد اليوم/ }).waitFor();
      assert.doesNotMatch(await page.locator("body").innerText(), /لا توجد مهام مفتوحة بلا تاريخ/);
      await healthy();
      await page.screenshot({ path: path.join(output, `${width}-${theme}-failure.png`), fullPage: true });
      scenario = "success";
      await page.getByRole("button", { name: "إعادة تحميل المهام" }).click();
      await page.getByRole("button", { name: /مهمة اليوم/ }).waitFor();
      assert.equal(await page.getByRole("button", { name: "إعادة تحميل المهام" }).count(), 0);
      results.push(`${width}/${theme}: task failure retained appointments; retry restored tasks`);
      scenario = "calendar-failed";
      await open();
      await page.getByRole("button", { name: "إعادة تحميل المواعيد" }).waitFor();
      await page.getByRole("button", { name: /مهمة اليوم/ }).waitFor();
      await healthy();
      scenario = "both-failed";
      await open();
      await page.getByText("الجدول غير مكتمل؛ بعض البيانات غير متاحة.").waitFor();
      assert.doesNotMatch(
        await page.locator("body").innerText(),
        /لا توجد مواعيد أو مهام مستحقة|لا توجد مهام مفتوحة بلا تاريخ/,
      );
      await healthy();
      results.push(`${width}/${theme}: calendar failure retained tasks; total failure never claimed empty data`);
      scenario = "empty";
      await open();
      await page.getByText("لا توجد مواعيد أو مهام مستحقة لهذا اليوم.").waitFor();
      await page.getByText("لا توجد مهام مفتوحة بلا تاريخ استحقاق.").waitFor();
      await healthy();
      scenario = "both-failed";
      requests.length = 0;
      await open("?view=tasks&hide=test");
      await page.getByRole("tab", { name: "المهام", exact: true }).waitFor();
      await page.getByText(/Tasks could not be loaded/).waitFor();
      assert.equal(requests.includes("/api/calendar-davis"), false, "Deep link must not mount today's sources");
      assert.equal(new URL(page.url()).searchParams.get("hide"), "test");
      await page.getByRole("tab", { name: "التقويم", exact: true }).click();
      await page.getByText(/The calendar could not be read/).waitFor();
      assert.equal(new URL(page.url()).searchParams.get("view"), "calendar");
      await page.evaluate(() => {
        window.history.pushState({}, "", "?view=today&hide=test");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.getByText("الجدول غير مكتمل؛ بعض البيانات غير متاحة.").waitFor();
      await healthy();
      results.push(
        `${width}/${theme}: empty success, real Calendar/Tasks error views, URL selection and popstate passed`,
      );
      await context.close();
    }
  }
  await fs.writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      { mode: "mock APIs and shared agents store; real components; no Next server or authentication", results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: results.length, output, results }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

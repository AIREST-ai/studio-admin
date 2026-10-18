# F160 comparison audit — protocol (read fully, then work)

Fahad's order, his exact words, is at the top of /home/fahad/ai-home/handoff/2026-10-12/f160-compare-audit.md — read that file first: it names the three templates, where each one lives, the supervisor notes and the recorded decisions.

## The three templates
1. Chatwoot original. Fahad's live inbox (inbox.airest.ai) needs a login whose file is a secrets file: do NOT read it and do NOT open inbox.airest.ai. Use: the Chatwoot v4.18 source /home/fahad/ai-home/docs/f158/ref/chatwoot-v4.18-source/app/javascript/dashboard/ (routes/, components-next/sidebar/Sidebar.vue, every component and dialog, English texts in i18n/locale/en/) and Fahad's screenshot docs/f159/audit/fahad-chatwoot-live.webp.
2. Studio before modification. Live at http://192.168.1.15:8800 (READ ONLY: never edit its files, never restart it, never touch vendor/studio-premerge or vendor/studio-ref). Code: `git -C /home/fahad/ai-home/vendor/studio-admin show dd8f5a9:<path>` and `git -C ... ls-tree -r --name-only dd8f5a9`. Fahad's screenshot: docs/f159/audit/fahad-studio-before-8800.webp.
3. Studio modified (ours). Live at http://192.168.1.15:8797 ; code at HEAD (c9dab34) in /home/fahad/ai-home/vendor/studio-admin.

## What to judge (Fahad's request)
- Everything in Chatwoot is really moved into Studio (every screen, dialog, button, tab, field, text), and it acts (opens, switches, validates) on mock data.
- The linkage between sections is complete (same people, conversations, inboxes, agents across pages; links go to real pages).
- Everything that existed in Studio before stays, unless a recorded decision merged it or built a new level (decisions are listed in the handoff file and in the JUDGE lines of docs/f159/live/*.md). Design-only Studio buttons stay by Fahad's rule.
- Record ALSO anything else you notice: duplication, design errors, broken layout, wrong texts, side notes.

## How
- Page by page, button by button, in a clear sequence. For each item write one line in YOUR file:
  `<template area> | <item> | Chatwoot: <file:line or "-"> | Studio-before: <path/route or "-"> | Ours: <route + file> | VERDICT: present-works / present-not-working / missing / different / removed-by-decision / removed-without-decision | evidence: <command output, screenshot path, or file:line>`
- Evidence is required for every verdict. No evidence = the line does not count.
- Cheap checks first: read code, curl (`curl -s -o /dev/null -w '%{http_code}' --max-time 60 <url>`). Screenshots and click scripts only under the shared lock, one at a time for the whole team:
  `flock /home/fahad/ai-home/vendor/studio-admin/docs/f159/live/.heavy.lock timeout 90 google-chrome --headless=new --no-sandbox --disable-gpu --window-size=1600,1000 --virtual-time-budget=15000 --screenshot=/home/fahad/ai-home/docs/f159/shots/audit/<your-key>/<name>.png <url>`
  For clicks, write one small Chrome DevTools (puppeteer from /home/fahad/ai-home/respond-design/node_modules) script per page that does many clicks in one browser run, under the same lock. Put your scripts in /home/fahad/ai-home/docs/f159/shots/audit/<your-key>/ — not in a shared folder.
- Independence: do NOT read any other file in docs/f159/audit/ except PROTOCOL.md, the two screenshots and your own file. Do not read docs/f159/audit/JUDGE.md. Do not message other agents.
- No code edits, no git commits, no restarts, no npm install, no next build. Memory is tight.

## Your file
docs/f159/audit/<your-key>-r<round>.md . First line: `ROUND <n> — <your-key> — started <hh:mm>`. Last line when you finish: `END ROUND <n> — checked <N> items: <a> present-works, <b> present-not-working, <c> missing, <d> different, <e> removed-without-decision`.
Your final message (to the supervisor): Arabic, short — the counts, the ten most important problems with evidence, and what you could not check and why.

## UPDATE (supervisor): Fahad's LIVE Chatwoot is now available — use it as template 1
Fahad signed in himself at 16:0x in a browser on this server. Connect to that browser (do not launch a new one for it) and open your own NEW tab; never type into, close or navigate Fahad's existing tab:
  const puppeteer = require('/home/fahad/ai-home/respond-design/node_modules/puppeteer');
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333' }); const p = await b.newPage(); await p.goto('https://inbox.airest.ai/app/accounts/1/<path>'); ... await p.screenshot({path}); await p.close(); b.disconnect();
READ ONLY on the live inbox: look, open menus and dialogs, then cancel. Never save, send, delete, create, assign, resolve or change any setting there — it is Fahad's real account. Run these scripts under the heavy lock. Compare it with the v4.18 source and with ours.

## UPDATE 2 (supervisor, 16:2x): Fahad approved the live inbox reads — use EXACTLY this command form
Put each script as a file in /home/fahad/ai-home/docs/f159/shots/audit/<your-key>/ and run it only like this (other forms will stop for approval):
  flock /home/fahad/ai-home/vendor/studio-admin/docs/f159/live/.heavy.lock node /home/fahad/ai-home/docs/f159/shots/audit/<your-key>/<script>.js
or with a time limit:
  flock /home/fahad/ai-home/vendor/studio-admin/docs/f159/live/.heavy.lock timeout 300 node /home/fahad/ai-home/docs/f159/shots/audit/<your-key>/<script>.js
Still READ ONLY on the live inbox.

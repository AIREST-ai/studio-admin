# F159 parallel build — memory brief from the supervisor (read fully before anything)

You are a copy of the supervisor session "تصميم الواجهة" (Opus, same model). This file is its memory.
Full transcript, only if you need a detail: /home/fahad/.claude/projects/-home-fahad-ai-home/6d7ccf9f-4960-4942-a4a7-e867acc86a08.jsonl

## Fahad's order now (2026-10-12, his exact words)
«فعل البناء الموازي فورا اصنع منك نسخ موازيه لنفسك بنفسك ذاكرتك واطلقهم هم للبنااء عمل فوري زودهم به الان والبناء فورا اطلق 5 لقسم الصندوق - و2 لكل قسم واحد يبني واحد يتابع فوقه وانت المشرف والقاضي على الجميع الان اطلق ذالك فورا واريد العمل امامي يحدث مباشر على الايبي نفسه بعد ان تعيد البث اطلقهم بقوة high»
Earlier tonight: «المهمة الى النهاية تصميم كامل لاعادة البناء من الالف الى الياء في ستوديو ... ونقل شات ووت بالكامل حتى المكرر الموجود افضل منه الى ستوديو وتجربته» — «الشرط الانتهاء الكامل» — «المهم عدم المماطلة» — «لا يحتاج كل هذا ... كتابه الملاحظات دقيقتين جدا كافي» (no bloat, no long preparation: start building within minutes).

## The goal
Move ALL of Chatwoot v4.18's agent dashboard into the Studio Next.js admin template, visual only (mock data, no backend). Every Chatwoot screen, dialog and control of your scope must exist and work on the page (clicks open things, tabs switch, dialogs open/close, forms validate) with realistic mock data. Where Studio already has a better duplicate, keep Studio's and add Chatwoot's missing fields to it.

## Places
- Repo: /home/fahad/ai-home/vendor/studio-admin (git). Dev server: port 8797, tmux "studio" (Next.js dev, hot reload). Fahad watches live at http://192.168.1.15:8798 (frame of :8797) and http://192.168.1.15:8797/dashboard/... — your edits appear in front of him as you save.
- Routes: src/app/(main)/dashboard/<section>/ . Sidebar: src/navigation/sidebar/sidebar-items.ts (FROZEN, do not edit; write a request in your live file if a link is missing).
- Team notes (rules of the Studio pattern + forbidden list): docs/f159/PLAYBOOK.md — read it.
- Approved model page: src/app/(main)/dashboard/contacts/ ; reuse parts from contacts/_components/studio-ui.tsx (import, do not modify).
- Studio reference look: /home/fahad/ai-home/docs/f159/shots/ref-users.png and v2-contacts-list.png (open with Read).
- Chatwoot v4.18 source (read-only, names, controls, texts): /home/fahad/ai-home/docs/f158/ref/chatwoot-v4.18-source/app/javascript/dashboard/ ; English strings: .../i18n/locale/en/

## Team protocol (23 agents run at the same time on one repo — follow exactly)
- Per-section live channel: docs/f159/live/<section-key>.md . Builder and watcher talk ONLY through it, appending lines (never delete others' lines). Use `cat >> file <<'EOF'` for appends.
  - watcher writes `WATCHER <hh:mm>: CHECKLIST ...`, `WATCHER <hh:mm>: FIX ...`, `WATCHER <hh:mm>: ACCEPTED`.
  - builder writes `BUILDER <hh:mm>: progress ...`, `BUILDER <hh:mm>: READY-FOR-CHECK`, `BUILDER <hh:mm>: FIXED ...`, `BUILDER <hh:mm>: SHARED-REQUEST ...`.
  - To wait for the other side: `timeout 600 bash -c 'until grep -q "READY-FOR-CHECK\|ACCEPTED\|FIX" <file> ...; do sleep 20; done'` (adapt the pattern; count lines to see only new ones).
- Edit only files of your own section. Never use Write to overwrite an existing file — only Edit, and Read the file again right before editing (others may have changed it). New files: Write is fine.
- Heavy commands ONLY under the shared lock, one at a time for the whole team:
  `flock /home/fahad/ai-home/vendor/studio-admin/docs/f159/live/.heavy.lock <command>` — for npx tsc, google-chrome screenshots, npx biome. Builders: do NOT run tsc/chrome at all; the watcher does testing.
  - tsc: `cd /home/fahad/ai-home/vendor/studio-admin && flock docs/f159/live/.heavy.lock npx tsc --noEmit -p . 2>&1 | grep error | grep <your section path>`
  - screenshot: `flock docs/f159/live/.heavy.lock timeout 60 google-chrome --headless=new --no-sandbox --disable-gpu --window-size=1600,1000 --virtual-time-budget=15000 --screenshot=/home/fahad/ai-home/docs/f159/shots/<key>/<name>.png http://192.168.1.15:8797<route>`
- curl check (cheap, anyone): `curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://127.0.0.1:8797<route>` must be 200. If 8797 does not answer, wait and retry; only the inbox watcher restarts the dev server.
- Git: only a WATCHER commits, only after ACCEPTED, only its section paths, under the git lock:
  `cd /home/fahad/ai-home/vendor/studio-admin && flock docs/f159/live/.git.lock sh -c 'git add -A -- <paths> && git commit --no-verify -m "F159 <section> in Studio pattern (parallel team)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PmXWqWHi7uBKpdZdhKeGvj" -- <paths>'`
  Never git stash / checkout / restore / reset / revert others' work.
- changes.md: after commit the watcher appends ONE entry at the END of /home/fahad/ai-home/changes.md under lock (`flock docs/f159/live/.changes.lock sh -c 'cat >> /home/fahad/ai-home/changes.md <<EOF ... EOF'`): what changed, hash, undo `git -C /home/fahad/ai-home/vendor/studio-admin revert <hash>`. Never edit existing lines.
- Memory on this machine is tight (16GB): no `next build`, no second dev server, no npm install.

## Forbidden
vendor/studio-ref, vendor/studio-premerge (port 8800), git stash (holds F158 work), secrets files, qayyim, inbox.airest.ai, gov/ judge/ governance files, restart_all.py.

## Lessons from tonight (do not repeat)
- Do not claim a page works without curl 200 + a screenshot you looked at.
- No inventing what Chatwoot lacks unless it is a Studio duplicate that is better; list anything invented in your final report.
- No long preparation. Build first, then fix.
- The previous team failed six review rounds on the inbox because fixes were vague; fixes must be concrete and file-level.

## Final report (your last message, it goes to the supervisor/judge)
Arabic, short: what is done, routes, files, commit hash (watcher), anything not done, anything invented.

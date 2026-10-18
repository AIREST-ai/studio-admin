# F161 — fix the Studio site after the F160 audit (brief for every builder; read fully first)

## Fahad's orders (2026-10-12 18:4x)
- «نفّذ handoff/2026-10-12/f161-fix-after-audit.md» then «ابدا بالاصلاح الان بنفس ترتيب المجموعات».
- Keep ALL features of Chatwoot 4.18 (custom roles, Captain, SLA, calls, WhatsApp campaigns) — do not hide anything.
- One language now: English. (Auto-translation later; do not translate anything.)
- Supervisor decision: current user is "Arham Khan".
- Restore everything removed from Studio without a decision (design buttons stay even if inert; important ones get wired).

## Places
- Repo: /home/fahad/ai-home/vendor/studio-admin (git, last commit c9dab34). Routes: src/app/(main)/dashboard/<section>/
- Dev server: port 8797 (tmux "studio", hot reload). Fahad watches it live. Do NOT restart it. Do NOT touch port 8800 (studio-premerge, view only — you may curl/screenshot it as the "Studio before" reference).
- Your audit file: docs/f159/audit/<your-group>-r2.md . Every line: item | Chatwoot | Studio-before | Ours | VERDICT | evidence. Fix every line whose VERDICT is not-working / missing / different / removed-without-decision, inside your scope. Its "top ten problems" first.
- Chatwoot v4.18 source (read-only): /home/fahad/ai-home/docs/f158/ref/chatwoot-v4.18-source/app/javascript/dashboard/ ; English strings: .../i18n/locale/en/
- Studio pattern rules: docs/f159/PLAYBOOK.md (read it, especially the 7 rules at the end).

## Shared data (cross-section)
- The FOUNDATION builder (group "foundation") owns: src/navigation/sidebar/**, src/app/(main)/dashboard/_components/** (sidebar/nav), and a new shared data layer src/lib/cw/** (one list each of: agents, inboxes, teams, labels, macros, canned responses, current user Arham Khan).
- Section builders: do NOT create your own copies of agents/inboxes/teams/labels. Once src/lib/cw/ exists, import from it. Before it exists, leave existing data imports alone and write a line in your channel: `BUILDER hh:mm: SHARED-REQUEST <what you need>` — foundation reads all channels.
- Something you create (team, channel, policy, campaign, contact) must appear in its list and survive tab changes (use the section's store or src/lib/cw/).

## Team protocol (several builders on one repo at the same time)
- Your channel: docs/f159/live/f161-<group>.md — append progress lines with `cat >> file <<'EOF'`.
- Edit only files of your own section. Read a file right before editing it (others may change shared files). Never git stash/checkout/restore/reset/revert.
- Heavy commands ONLY under the shared lock (memory is 16GB, Chrome got killed before):
  - tsc: `cd /home/fahad/ai-home/vendor/studio-admin && flock docs/f159/live/.heavy.lock npx tsc --noEmit -p . 2>&1 | grep 'error' | grep '<your path>'`
  - screenshot: `flock docs/f159/live/.heavy.lock timeout 60 google-chrome --headless=new --no-sandbox --disable-gpu --window-size=1600,1000 --virtual-time-budget=15000 --screenshot=/home/fahad/ai-home/docs/f159/shots/f161/<group>-<name>.png http://127.0.0.1:8797<route>` then look at it with Read.
  - No `next build`, no second dev server, no npm install.
- Cheap check: `curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://127.0.0.1:8797<route>` must be 200.
- Commit your own paths when a coherent batch is done (no --no-verify; the pre-commit hook runs biome on your staged files — fix what it reports in your files):
  `cd /home/fahad/ai-home/vendor/studio-admin && flock docs/f159/live/.git.lock sh -c 'git add -A -- <paths> && git commit -m "F161 <group>: <what>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PmXWqWHi7uBKpdZdhKeGvj" -- <paths>'`
  If the hook cannot pass for a reason outside your files, stop and write it in your channel and final report — do not bypass it.
- After each commit append ONE entry at the END of /home/fahad/ai-home/changes.md: `flock docs/f159/live/.changes.lock sh -c 'cat >> /home/fahad/ai-home/changes.md <<EOF ... EOF'` — what, hash, undo `git -C /home/fahad/ai-home/vendor/studio-admin revert <hash>`.

## Forbidden
vendor/studio-ref, studio-premerge (8800) except viewing, git stash, secrets files, qayyim, gov/ judge/ governance files, restart_all.py, Fahad's live inbox (port 8814/9333 — no reading, no clicking).

## Honesty rules
- Never say a page works without curl 200 + a screenshot you looked at.
- A button that shows "done" but does nothing is called "cosmetic" in your report.
- No inventing what Chatwoot lacks; list anything invented.

## Final report (last message, Arabic, short)
What you fixed (audit line → file), commit hashes, what is still broken or cosmetic, anything invented, any check skipped.

export const meta = {
  name: 'f159-all-sections',
  description: 'Finish every Chatwoot section in Studio pattern, one section at a time (parts in parallel), each tested and fresh-reviewed before commit; then whole-app review',
  phases: [
    { title: 'Build' }, { title: 'Test' }, { title: 'Review' }, { title: 'Close' }, { title: 'Final' },
  ],
}
const R = '/home/fahad/ai-home', S = R + '/vendor/studio-admin', CW = R + '/docs/f158/ref/chatwoot-v4.18-source'
const LOCK = 'flock /tmp/f159-heavy.lock'
const base = (sec) => `
You are on the team moving Chatwoot's agent dashboard into the Studio Next.js admin template (visual only, mock data, no backend). Repo: ${S} (git; dev server port 8797 in tmux "studio"; routes under src/app/(main)/dashboard/; sidebar src/navigation/sidebar/sidebar-items.ts).
FIRST read the short team notes ${S}/docs/f159/PLAYBOOK.md (Studio pattern rules + forbidden list). The approved model page is src/app/(main)/dashboard/contacts/ — reuse its parts from contacts/_components/studio-ui.tsx (big title outside the card + description + main button, tabs with counts, filter chips, table in a card with colored badges and a per-row "…" menu, stat cards on detail pages).
Chatwoot v4.18 source (read-only reference for screens, controls, English texts): ${CW}/app/javascript/dashboard/ (routes under routes/dashboard/, strings under i18n/locale/en/).
Mock data must be consistent across the app (same people, same company names, English UI). Avatars should look real (initials with colors or images already used by contacts), not grey blobs.
Memory is tight: never run tsc, next build or a browser unless your task says so; wrap any heavy command with "${LOCK}". Never touch vendor/studio-ref, vendor/studio-premerge, git stash, secrets/.env, gov/, judge/. Never run git add -A.
Previous stopped workers may have left partial uncommitted edits in this section's folders: check git -C ${S} status/diff for your folders first and build on them.
SECTION: ${sec.title}
SCOPE: ${sec.scope}`

const BUILD_SCHEMA = { type: 'object', properties: {
  files: { type: 'array', items: { type: 'string' } },
  routes: { type: 'array', items: { type: 'string' }, description: 'every URL path of this section to test, e.g. /dashboard/reports/overview (use a real id for [id] routes)' },
  invented: { type: 'array', items: { type: 'string' }, description: 'anything added that Chatwoot does not have' },
  notDone: { type: 'array', items: { type: 'string' } },
}, required: ['files', 'routes', 'invented', 'notDone'] }
const TEST_SCHEMA = { type: 'object', properties: {
  tscErrors: { type: 'array', items: { type: 'string' } },
  badRoutes: { type: 'array', items: { type: 'string' } },
  visualProblems: { type: 'array', items: { type: 'string' } },
  shotsDir: { type: 'string' },
}, required: ['tscErrors', 'badRoutes', 'visualProblems', 'shotsDir'] }
const REVIEW_SCHEMA = { type: 'object', properties: {
  pass: { type: 'boolean' },
  mustFix: { type: 'array', items: { type: 'string' } },
  dropInvented: { type: 'array', items: { type: 'string' } },
}, required: ['pass', 'mustFix', 'dropInvented'] }

const build = async (sec, part, extra, tag) => {
  const p = `${base(sec)}
YOUR PART: ${part}
TASK: Make this part complete in the Studio pattern: every Chatwoot screen, dialog and control of this part exists (read the Chatwoot components to list them) with realistic mock data. Keep what already works.${sec.sidebarOwner === part || part.startsWith('fix batch') ? ' You alone edit sidebar-items.ts for this section: place its items in the standard helpdesk position (order: Conversations, Contacts, Companies, Reports, Campaigns, Help Center, Captain, Notifications, Settings; Studio own pages after). Re-read the file right before editing.' : ' Do not edit sidebar-items.ts.'}
Check each route with curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8797<route> (must be 200). Do not commit.${extra || ''}`
  let r = await agent(p, { label: `${tag}:${sec.key}`, phase: 'Build', schema: BUILD_SCHEMA })
  if (!r) r = await agent(p + `\nThe previous worker on this part died midway. Check git status/diff and finish.`, { label: `${tag}:${sec.key}:retry`, phase: 'Build', schema: BUILD_SCHEMA })
  return r
}
const test = (sec, routes, round) => agent(`${base(sec)}
TASK (only tester; one heavy thing at a time):
1) If the next-server for port 8797 has RSS above 3.5GB (ps -eo rss,args | grep next-server), restart it inside tmux "studio" with the same command it runs now (read it from ps first), then wait until curl http://127.0.0.1:8797/dashboard/contacts gives 200.
2) cd ${S} && ${LOCK} npx tsc --noEmit -p . 2>&1 | grep error | head -60 — report errors in this section's files or the sidebar.
3) curl every route; report non-200: ${JSON.stringify(routes)}
4) Screenshot each route one by one: ${LOCK} timeout 60 google-chrome --headless=new --no-sandbox --disable-gpu --window-size=1600,1000 --virtual-time-budget=15000 --screenshot=${R}/docs/f159/shots/${sec.key}/r${round}-<name>.png http://192.168.1.15:8797<route> . Open each picture (Read tool) and list concrete visual problems: overflow, clipped text, scrollbars inside tabs, empty default views, grey avatars, inconsistent data, anything not matching ${R}/docs/f159/shots/ref-users.png style.
Do not edit code.`, { label: `test:${sec.key}:r${round}`, phase: 'Test', schema: TEST_SCHEMA })
const review = (sec, built, tested, round, lens) => agent(`${base(sec)}
You are a FRESH reviewer (you did not build this). Lens: ${lens}.
Fahad's words in this session: """${args.fahad}"""
Check (a) every Chatwoot screen/control of the scope exists (open the Chatwoot components), (b) Studio pattern: open the screenshots in ${tested ? tested.shotsDir : R + '/docs/f159/shots/' + sec.key} and compare with ${R}/docs/f159/shots/ref-users.png and v2-contacts-list.png, (c) nothing broken.
Builder report: ${JSON.stringify(built)}
Tester report: ${JSON.stringify(tested)}
pass=true only if nothing important is missing, broken or off-pattern. mustFix = concrete file-level fixes. dropInvented = invented items that should be removed (keep useful ones). Do not edit code.`, { label: `review:${sec.key}:r${round}`, phase: 'Review', schema: REVIEW_SCHEMA })

async function runSection(sec) {
  let built
  if (sec.prebuilt) {
    built = await build(sec, sec.parts[0], `\nTHIS SECTION IS ALREADY BUILT ON DISK. Fix these problems found by the last visual test:\n${sec.preIssues}`, 'fix0')
  } else {
    const bs = (await parallel(sec.parts.map(pt => () => build(sec, pt, '', 'build')))).filter(Boolean)
    built = { files: bs.flatMap(b => b.files), routes: [...new Set(bs.flatMap(b => b.routes))], invented: bs.flatMap(b => b.invented), notDone: bs.flatMap(b => b.notDone) }
  }
  if (!built) return { section: sec.key, status: 'blocked', why: 'builders died' }
  let passed = false, verdict = null, tested = null
  for (let round = 1; round <= 6; round++) {
    tested = await test(sec, built.routes, round)
    const lenses = round === 1 && built.invented.length ? ['chatwoot completeness', 'studio design fidelity', 'fahad words, keep or drop invented items'] : ['chatwoot completeness and studio design fidelity']
    const rs = (await parallel(lenses.map(l => () => review(sec, built, tested, round, l)))).filter(Boolean)
    const passVotes = rs.filter(r => r.pass).length
    const mustFix = [...new Set(rs.flatMap(r => r.mustFix))]
    const drop = [...new Set(rs.flatMap(r => r.dropInvented))].filter(it => rs.filter(r => r.dropInvented.includes(it)).length * 2 > rs.length)
    verdict = { round, passVotes, of: rs.length, mustFix, drop }
    log(`${sec.key} round ${round}: pass ${passVotes}/${rs.length}, mustFix ${mustFix.length}`)
    // Fixers put status notes into notDone, and the tester lists every nit; both reach the fresh reviewers, whose majority decides.
    passed = !!tested && rs.length > 0 && passVotes * 2 > rs.length && !mustFix.length && !drop.length && !tested.tscErrors.length && !tested.badRoutes.length
    if (passed || round === 6) break
    // Conversations kept failing on mismatches between two inbox copies (/chat and /dashboard/chat). Majority picks the structural fix, one fresh worker applies it.
    if (sec.key === 'conversations' && round === 4 && !sec.unified) {
      const VOTE = { type: 'object', properties: { option: { type: 'string', enum: ['shared-data', 'single-inbox'] }, why: { type: 'string' } }, required: ['option', 'why'] }
      const votes = (await parallel([1, 2, 3].map(i => () => agent(`${base(sec)}
You are voter ${i} of 3 (fresh, independent). Four review rounds failed this section, largely on mismatches between two separate inbox implementations with separate mock data: src/app/(main)/chat (full-screen Studio Chat, holds the 5 brown additions) and src/app/(main)/dashboard/chat (Chatwoot conversations). Look at both briefly and vote ONE option:
- "shared-data": keep both pages, and make both read ONE shared mock-data module so people, threads, counts, labels and presence always match.
- "single-inbox": merge into /dashboard/chat keeping every feature of /chat (including the brown additions), and make /chat redirect there.
Do not edit files.`, { label: `vote${i}:conversations`, phase: 'Review', schema: VOTE })))).filter(Boolean)
      const single = votes.filter(v => v.option === 'single-inbox').length
      const choice = single * 2 > votes.length ? 'single-inbox' : 'shared-data'
      log(`conversations structure vote: ${choice} (${votes.length - single} shared-data / ${single} single-inbox)`)
      const uni = await build(sec, 'fix batch unify', `\nSTRUCTURAL FIX chosen by majority vote (${choice}; reasons: ${JSON.stringify(votes.map(v => v.why))}). Apply it fully, then fix these reviewer items on top: ${JSON.stringify(mustFix)} and remove these invented items: ${JSON.stringify(drop)}. Route that did not return 200: ${JSON.stringify(tested ? tested.badRoutes : [])}.`, `unify${round}`)
      if (uni) { built.files.push(...uni.files); built.routes = [...new Set([...built.routes, ...uni.routes])]; built.notDone = uni.notDone }
      continue
    }
    if (round === 1) {
      const fix = await build(sec, `fix round ${round} for the whole section`, `\nFIXES REQUIRED:\n${JSON.stringify({ mustFix, removeInvented: drop, tscErrors: tested && tested.tscErrors, badRoutes: tested && tested.badRoutes, visualProblems: tested && tested.visualProblems, notDone: built.notDone })}`, `fix${round}`)
      if (fix) { built.files.push(...fix.files); built.routes = [...new Set([...built.routes, ...fix.routes])]; built.notDone = fix.notDone }
      continue
    }
    // One overloaded fixer left items undone, so from round 2 fresh fixers take small batches one after another.
    const items = [...mustFix, ...drop.map(d => 'remove invented: ' + d), ...(tested ? [...tested.tscErrors, ...tested.badRoutes.map(b => 'route not 200: ' + b), ...tested.visualProblems] : []), ...(round < 4 ? built.notDone.map(n => 'not done yet: ' + n) : [])]  // from round 4, fixers' status notes stop being re-fed as work; reviewers still see them
    const left = []
    for (let i = 0; i < items.length; i += 6) {
      const fx = await build(sec, `fix batch ${i / 6 + 1} of round ${round}`, `\nFIX EXACTLY THESE ITEMS (all of them; another fixer handles the rest):\n${JSON.stringify(items.slice(i, i + 6))}`, `fix${round}b${i / 6 + 1}`)
      if (fx) { built.files.push(...fx.files); built.routes = [...new Set([...built.routes, ...fx.routes])]; left.push(...fx.notDone) } else left.push(...items.slice(i, i + 6))
    }
    built.notDone = left
  }
  if (!passed) return { section: sec.key, status: 'blocked', verdict, notDone: built.notDone, tested }
  const closed = await agent(`${base(sec)}
TASK: close this section (it passed test and fresh review).
1) cd ${S}; npx biome check --write <changed files of this section> (ignore failures). git add ONLY this section's folders, the sidebar file if changed, and docs/f159/shots/${sec.key}. Commit "F159 ${sec.title} in Studio pattern (tested, fresh-reviewed)"; use --no-verify only if the hook fails on lint warnings. End the message with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PmXWqWHi7uBKpdZdhKeGvj
2) Append one line at the END of ${S}/docs/f159/PLAYBOOK.md: "- 2026-10-12: ${sec.title} — <hash> — <one lesson>", and commit it.
3) Append at the END of ${R}/changes.md (never edit existing lines; same format as the last entries): what changed, hash, undo: git -C ${S} revert <hash>.
4) Update ${R}/docs/f140/watch/now.json (keep its keys): url = main route of this section on :8797, title = simple Arabic "أُغلق قسم ... بعد الفحص والمراجعة".
Return the commit hash only.`, { label: `close:${sec.key}`, phase: 'Close' })
  return { section: sec.key, status: 'closed', commit: closed, verdict }
}

const results = []
for (const sec of args.sections) {
  phase('Build')
  log(`section ${sec.key} starting`)
  const r = await runSection(sec)
  results.push(r || { section: sec.key, status: 'blocked', why: 'null' })
  log(`section ${sec.key}: ${r ? r.status : 'null'}`)
  // Never move on from a failing section: stop and hand it back to the supervisor for a fresh team.
  if (!r || r.status !== 'closed') return { stoppedAt: sec.key, results: results.map(x => ({ section: x.section, status: x.status, commit: x.commit, left: x.verdict && x.verdict.mustFix })) }
}

phase('Final')
const FINAL_LENSES = ['every Chatwoot screen has a home in Studio (compare Chatwoot routes/dashboard with Studio routes and sidebar)', 'Studio design consistency across all pages and the sidebar arrangement', 'broken pages, errors, inconsistent mock data, anything Fahad would see as wrong']
const finals = (await parallel(FINAL_LENSES.map(l => () => agent(`${base({ title: 'WHOLE APP', scope: 'all Chatwoot sections inside Studio' })}
You are a FRESH final reviewer of the whole app. Lens: ${l}.
Fahad's words: """${args.fahad}"""
Section results: ${JSON.stringify(results.map(x => ({ s: x.section, status: x.status, left: x.verdict && x.verdict.mustFix })))}
curl the routes you need; open screenshots under ${R}/docs/f159/shots/. Do not edit code. Return pass and concrete mustFix list.`, { label: `final-review:${l.split(' ')[0]}`, phase: 'Final', schema: REVIEW_SCHEMA })))).filter(Boolean)
const finalFix = [...new Set(finals.flatMap(f => f.mustFix))]
let finalCommit = null
if (finalFix.length) {
  const fx = await build({ key: 'final', title: 'WHOLE APP final fixes', scope: 'fix the listed problems anywhere in the Chatwoot sections and sidebar', sidebarOwner: 'final fixes' }, 'final fixes', `\nFIXES:\n${JSON.stringify(finalFix)}`, 'final-fix')
  const ft = await test({ key: 'final', title: 'WHOLE APP', scope: 'all sections' }, fx ? fx.routes : [], 1)
  finalCommit = await agent(`${base({ title: 'WHOLE APP', scope: 'final commit' })}
TASK: if tester found no tsc errors and no bad routes (${JSON.stringify(ft && { tsc: ft.tscErrors, bad: ft.badRoutes })}), commit the final fixes (git add only the changed files under src/app/(main)/dashboard, the sidebar file and docs/f159) with message "F159 final whole-app fixes after fresh review" plus the two trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PmXWqWHi7uBKpdZdhKeGvj
Append the entry to the end of ${R}/changes.md with undo command, and set ${R}/docs/f140/watch/now.json url to :8797/dashboard/chat with an Arabic title saying the whole template is ready for review. If tester found errors, do not commit; list them. Return hash or the errors.`, { label: 'final-commit', phase: 'Final' })
}
return { results: results.map(x => ({ section: x.section, status: x.status, commit: x.commit, left: x.verdict && x.verdict.mustFix })), finalPass: finals.map(f => f.pass), finalFix, finalCommit }

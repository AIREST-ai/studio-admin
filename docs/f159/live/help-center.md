BUILDER 13:32: progress — started; reading existing help-center files + contacts model, then converting all pages to Studio pattern.
WATCHER 13:37: CHECKLIST (CW = .../components-next/HelpCenter/ ; strings = i18n/locale/en/helpCenter.json HELP_CENTER.*)
STUDIO PATTERN (PLAYBOOK + contacts model) on EVERY route: big title OUTSIDE card + one-line subtitle under it + primary button on the right side (use PageHeading from contacts/_components/studio-ui.tsx); tabs WITH counts, then filter chips; lists as table/rows inside a Card; colored status badges; one "…" menu per row (no stacked buttons); detail/editor pages: no fake KPI numbers unless declared. No iframe. Nothing invented without saying it.
A) PORTAL HEADER / SWITCHER (CW HelpCenterLayout.vue, PortalSwitcher/PortalSwitcher.vue)
 [ ] active portal name + chevron button -> switcher popover: title "Portals" + ↗ preview icon, text "Create and manage multiple portals", button "New portal", list of portals (avatar, name, custom domain with link icon, check on active); clicking a portal switches active portal everywhere
 [ ] breadcrumb after portal name: Articles / Categories / Locales / Settings
 [ ] Create portal dialog (PortalSwitcher/CreatePortalDialog.vue): title "Create new portal", description "Give your portal a name and create a user-friendly URL slug...", Name input (+ info message), Slug input with live URL preview under it, validation errors, confirm disabled until valid
 [ ] Portal empty state (EmptyState/Portal/PortalEmptyState.vue) reachable when no portal (/help-center/portals)
B) ARTICLES LIST (Pages/ArticlePage/ArticlesPage.vue, ArticleHeaderControls.vue, ArticleList.vue, ArticleCard/ArticleCard.vue)
 [ ] search "Search articles..." (filters list)
 [ ] tabs with counts: All articles / Mine / Draft / Archived (portalHelper.js ARTICLE_TABS_OPTIONS) — tab switch filters rows
 [ ] locale dropdown (searchable) + category dropdown "All categories" with emoji icons (searchable) — both filter
 [ ] "New article" primary button -> /help-center/articles/new
 [ ] each row: checkbox, title (link to /articles/[id]), "Pending edits" amber-dot badge on some published rows, status badge (Published/Draft/Archived colored), author avatar+name, category emoji+name, "N views" with eye, relative "last updated" time
 [ ] row "…" menu by status (portalHelper ARTICLE_MENU_OPTIONS): published->Draft,Archive,Translate,Delete; draft->Publish,Archive,Translate,Delete; archived->Publish,Draft,Translate,Delete; + "Discard changes" when pending edits; actions change mock state
 [ ] bulk select bar when rows checked: "N selected"/select all, Clear selection, Publish, Draft, Archive, Move to category (searchable menu), Translate, Delete -> alert dialog (DELETE_CONFIRM_TITLE/DESCRIPTION/confirm)
 [ ] Bulk translate dialog (BulkTranslateDialog.vue): locale combobox, category combobox (optional, disabled until locale), duplicate warning block
 [ ] empty states per tab (ARTICLES_PAGE.EMPTY_STATE.ALL/MINE/DRAFT/PUBLISHED/ARCHIVED texts; ALL has "New article" button), search empty state
 [ ] pagination footer (25 per page)
C) CATEGORIES (Pages/CategoryPage/*.vue, CategoryCard/CategoryCard.vue)
 [ ] locale dropdown + "N categories" count, search "Search categories", "New category" button
 [ ] each category: emoji icon, name (click -> its articles = articles list filtered with breadcrumb + "Edit category" + "New article" — CategoryHeaderControls.vue), "N articles" count, description, "…" menu Edit / Delete
 [ ] Category dialog create/edit (CategoryDialog.vue, CategoryForm.vue): header Portal + Locale "(name (code))", Name with emoji icon picker prefix (pick/color/remove), Slug (disabled in edit, help text), Description textarea with char count, Cancel + Create/Update; validation
 [ ] empty + search-empty states (CATEGORY_PAGE.CATEGORY_EMPTY_STATE / SEARCH_EMPTY_STATE)
D) LOCALES (Pages/LocalePage/*.vue, LocaleCard/LocaleCard.vue)
 [ ] "N locales" count, search, "New locale" button
 [ ] each locale: name (code), Default badge or Draft badge, "N articles", "N categories", "…" menu: Make default, Move to draft / Publish locale, Customize content, Select popular content, Delete (disabled rules per portalHelper buildLocaleMenuItems: default locale -> make default/move to draft/delete disabled)
 [ ] Add locale dialog: locale combobox + Status combobox (published/draft)
 [ ] Customize content dialog (LocaleContentDialog.vue): Name, Page title, Header text
 [ ] Popular content dialog (PopularContentDialog.vue): reorderable categories multi-select (max, "N slots left", note), articles multi-select, Add another, search
E) PORTAL SETTINGS (Pages/PortalSettingsPage/*.vue)
 [ ] vertical tabs: General / Domain / Appearance / Integrations (PORTAL_SETTINGS.NAV.*)
 [ ] General (PortalBaseSettings.vue): Avatar upload/remove, Name, Header text, Page title, Home page link, Slug, Brand color picker, Save changes; Delete portal section -> ConfirmDeletePortalDialog
 [ ] Domain (PortalConfigurationSettings.vue): custom domain header/description, Add/Edit button -> AddCustomDomainDialog; status description -> DNSConfigurationDialog (DNS instructions + send instructions email input + Send button)
 [ ] Appearance (PortalLayoutContentSettings.vue): layout RadioCards Classic / Sidebar with preview images + descriptions; Social links list (platform dropdown, URL, Add, Remove); Save
 [ ] Integrations (PortalIntegrationsSettings.vue): Live chat widget card with inbox ComboBox; Save
F) ARTICLE EDITOR new + [id] (Pages/ArticleEditorPage/*.vue)
 [ ] header: "Back to articles" link, "Pending changes" chip (opens Diff side panel) when published+pending, Saving.../Saved status, Preview button, split button Publish / "Publish changes" + chevron menu (Draft/Archive per status + Discard changes)
 [ ] big Title textarea (placeholder "Title"), controls row: author picker (avatar + searchable agents list), category picker ("Uncategorized" + emoji list), "More properties" (disabled on new) -> properties popover: Meta description, Meta title, Meta tags (tag input), close X
 [ ] rich editor area with placeholder (EDIT_ARTICLE.EDITOR_PLACEHOLDER) — toolbar acceptable
 [ ] Diff side panel (ArticleDiffPanel.vue): title + description, title diff, content diff
 [ ] Pending changes popover (ArticlePendingChangesPopover.vue): title, description, Discard (ruby) + Apply
 [ ] /articles/new starts empty; /articles/[id] loads mock article by id (invalid id -> not crash)
ROUTES TO PASS curl 200 + screenshot: /dashboard/help-center, /portals, /articles, /articles/new, /articles/1, /categories, /locales, /settings
WATCHER 13:39: CHECKLIST addendum — (1) articles list lives at /dashboard/help-center (no /articles/page.tsx); fine, route list = /dashboard/help-center, /portals, /articles/new, /articles/1, /articles/999 (must show not-found, not crash), /categories, /locales, /settings. (2) Sidebar is frozen with ONE "Help Center" link, Chatwoot sidebar has Articles/Categories/Locales/Settings sub-items -> every help-center page needs in-page navigation between Articles / Categories / Locales / Settings (e.g. Studio Tabs or links in the portal header) or those pages are unreachable for Fahad.
WATCHER 13:44: FIX (baseline look at / — header, section tabs and article cards already match Studio well, keep them): (a) _components/articles-list.tsx status tabs — Chatwoot has exactly 4 tabs All articles/Mine/Draft/Archived (portalHelper.js ARTICLE_TABS_OPTIONS); remove the "Published" tab (or list it as invented in your report). (b) row "…" menu must be exactly: status items per ARTICLE_MENU_OPTIONS + "Discard changes" only when Unpublished edits + "Delete" last (ArticleCard.vue L104-131). Editor split-button menu: Draft/Archive per status + Discard changes, NO delete (ArticleEditorHeader.vue L93-114).
WATCHER 13:38: FIX articles-list.tsx (read current code): (1) L54-60 tabs still include "Published" — Chatwoot ARTICLE_TABS_OPTIONS = all/mine/draft/archived only; remove it. (2) L328-336 "Author" ChipSelect is invented (Chatwoot ArticleHeaderControls.vue has only locale + category dropdowns) — remove. (3) RowActions L114-165: add "Discard changes" (Undo2 icon) item when article.pendingEdits, before Delete (ArticleCard.vue L120-131); the extra "Edit" link item is not in Chatwoot — keep only if you declare it, title link already opens the editor.
BUILDER 13:39: progress — shared store hc-store.ts + hc-ui.tsx; articles/categories/locales now Studio tables; all dialogs validate + change mock state + toasts; new route /dashboard/help-center/categories/[slug]. curl currently 500 because of OTHER sections' compile errors (users.tsx 'filters', reports simple-reports.tsx 'StatCard'), not help-center.
WATCHER 13:44: progress look at / (p1-articles.png): table + chips + count tabs = good Studio match, Published/Author gone — thanks. FIX portal-title.tsx L156: TabsList has "overflow-x-auto" which draws a stray scrollbar arrow at the right end of the Articles/Categories/Locales/Settings tab row; drop overflow-x-auto (users-roles.tsx L58 uses the same classes without it). Still open from 13:38: "Discard changes" row item for Unpublished-edits rows.
BUILDER 13:48: FIXED (13:38 + 13:44) — articles-list.tsx: tabs now exactly All articles/Mine/Draft/Archived; Author chip removed; row "…" = ARTICLE_MENU_OPTIONS status items + Translate + "Discard changes" (Undo2, only when Unpublished edits) + Delete last; extra Edit item removed. article-editor.tsx split menu = ARTICLE_EDITOR_STATUS_OPTIONS (published: Archive/Draft, archived: Draft, draft: Archive) + Discard changes when pending, no Delete.
BUILDER 13:48: READY-FOR-CHECK — routes (all curl 200 except 999=404 by design):
 /dashboard/help-center (articles table, 25/page, status tabs w/ counts, searchable Locale+Category chips, bulk bar, delete/translate dialogs)
 /dashboard/help-center/categories (table; name -> category articles; Edit/Delete; Category dialog w/ emoji picker, slug disabled on edit, 200-char counter, validation)
 /dashboard/help-center/categories/billing-plans (Chatwoot category articles page: breadcrumb "Categories (en) > name (N articles)", Edit category, New article); /categories/nope -> "No categories found" empty state
 /dashboard/help-center/locales (table; menu w/ disabled items for default locale per buildLocaleMenuItems; Add locale searchable combobox+status; Localize content; Recommended content w/ add/remove + slots left)
 /dashboard/help-center/settings (General: logo upload/remove, fields, URL validation, color picker, Delete portal; Domain: add/edit domain w/ validation, DNS dialog copy+send email validation; Appearance: Classic/Documentation radio cards, social links add/remove; Integrations: live chat widget + 7 analytics providers incl. Clarity/Meta Pixel with format validation)
 /dashboard/help-center/portals (portals table + New portal) and /dashboard/help-center/portals?state=empty (Chatwoot PortalEmptyState); deleting the last portal also shows it on every help-center page
 /dashboard/help-center/articles/new (title creates the article and moves to /articles/[id]); /articles/1 ; /articles/2 (published w/ Pending changes chip -> diff dialog; status change -> Unpublished changes popover Apply/Discard); /articles/101 (Arabic); /articles/999 -> 404
 Portal switcher (chevron next to big title) on every section page; section line tabs Articles/Categories/Locales/Settings with counts. All state is a shared in-memory store (_components/hc-store.ts), toasts use Chatwoot's success strings.
 Declared additions (not in Chatwoot): Portals table page (Chatwoot only has the switcher popover); Locales All/Published/Draft count tabs (Studio pattern); "Written by" footer line in editor; Article-not-found / category-not-found texts.
BUILDER 13:48: FIXED 13:44 — portal-title.tsx section TabsList: overflow-x-auto removed. "Discard changes" row item already in (articles-list.tsx RowActions, shows on article 2 "Understanding your invoice"). Waiting for WATCHER.
WATCHER 14:07: FULL CHECK round 1 — tsc: 0 errors in help-center. curl: 12 routes 200, /articles/999 404 (ok). Shots f-*.png + clicked i-*.png in docs/f159/shots/help-center/: tables, chips, count tabs, bulk bar, row menus, portal switcher, create portal, category create/edit/emoji, locale menus (default disabled items correct), add locale, recommended content, settings 4 tabs, diff dialog, split menu, properties popover all WORK and look Studio. NOT accepted yet — 6 concrete FIX:
 1) article-editor.tsx ~L380-384: on /articles/new the disabled Preview button renders the icon ABOVE the word (the <span> wrapper inside Button) — use <><ArrowUpRight /> Preview</> or span className="inline-flex items-center gap-1.5". See f-new.png.
 2) /articles/new: after typing a title the created article is filled with a generated body ("This guide explains how to export invoices step by step… Steps 1-3…", i-ed-new-created.png). Chatwoot creates the article with title only, content empty + placeholder "Write your content here…". hc-store createArticle / article-editor: start content = "".
 3) /articles/101 (Arabic): body is the English template with the Arabic title pasted inside (f-a101.png). data.ts translatedArticles: give ar/ur articles real Arabic/Urdu body text, and set dir="rtl" on title + editor body when locale is ar/ur.
 4) help-center-dialogs.tsx CategoryDialog: "Description is required" — Chatwoot CategoryForm.vue L85-88 validates only name (required) + slug (required). Make description optional (keep 200-char counter).
 5) portal-settings.tsx General: logo tile shows "WSHC" overflowing the square (f-settings.png). Use max 2 initials (getInitials(...).slice(0,2)) or smaller text.
 6) portal-title.tsx PortalSwitcher: the active portal check icon is clipped at the popover's right edge (i-portal-switcher.png, row "23 articles ✓"). Reserve space for it (pe-3 / fixed-width trailing slot) or widen to w-[27.5rem] like Chatwoot PortalSwitcher.vue.
 Declare in your report (fine to keep): categories "N published" next to "N articles", portals table "Active/Not open" status column, besides the 4 you already listed.
BUILDER 14:08: FIXED round 1 —
 1) article-editor.tsx: Preview on /articles/new is now a plain disabled <Button><ArrowUpRight/> Preview</Button> (no span wrapper); existing articles keep the <a> link.
 2) hc-store.ts createArticle sets body: [] and article-editor bodyParagraphs returns article.body when present -> a new article has title only, empty content + placeholder.
 3) data.ts: Article.body added; translatedArticles 101-106 have Arabic bodies, 107-108 Urdu bodies; article-editor sets dir="rtl" on title + editor body for ar/ur/fa (placeholder uses start-0).
 4) help-center-dialogs.tsx CategoryDialog: description optional (only name + slug required), 200-char counter kept.
 5) portal-settings.tsx logo tile: getInitials(...).slice(0, 2).
 6) portal-title.tsx PortalSwitcher: popover w-[27.5rem] max-w-[calc(100vw-2rem)]; rows w-full min-w-0 ps-2 pe-3, name min-w-0 truncate, domain shrinks, trailing count+check slot shrink-0 -> check no longer clipped.
 Declared additions noted: categories "N published", portals table Active/Not open column.
 curl: /articles/new 200, /articles/101 200, /articles/107 200, /categories 200, /settings 200.
JUDGE 14:09 (supervisor) — RULE FROM FAHAD: Studio buttons that only show design (do not work yet) STAY. Do not delete a Studio button, tab or column just because it does not work; Fahad will make the important ones work later. Remove only what is broken on screen or clearly wrong for Chatwoot.
WATCHER 14:12: ACCEPTED — round-1 fixes verified: tsc 0 help-center errors; curl 11 routes 200 (+999=404); r2-new.png (Preview inline), r2-new-created.png (empty body + placeholder), r2-a101.png (Arabic body, RTL), r2-settings.png ("WS" tile), r2-switcher.png (check visible), r2-cat-validate.png (only name+slug required). Committing src/app/(main)/dashboard/help-center now.
WATCHER 14:13: COMMITTED 1e4066e (19 files, help-center only) + changes.md entry appended. Done.
JUDGE 14:14 (supervisor): ACCEPTED 1e4066e. Checked: 19 files all inside help-center, 7 routes 200 and articles/999 404 on purpose, changes.md has the hash, shot r2-a101.png (Arabic article, right-to-left) matches the Studio pattern. Note for the final pass (not blocking): in the Arabic article the quote bar sits on the left.

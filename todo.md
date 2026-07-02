# RANKMAKER — TODO

General project review (code + SEO). Ordered by importance within each
block. Tasks marked `[x]` are already implemented in this commit.

## 🔎 SEO — why only the home page gets indexed

I went through all the technical aspects (canonical, hreflang, sitemap,
robots.txt, JSON-LD, meta tags, SSR content on template pages, `/search`
listing everything with real `<a href>`) and, honestly, it's **already very
well put together**: there's a dynamic sitemap with real `lastmod`, correct
canonical + hreflang, per-template `ItemList` JSON-LD, images with `alt`,
Core Web Vitals taken care of (LCP preload, self-hosted fonts, CLS fixed on
`/search`)... I haven't found any technical bug that's *blocking*
indexation (no global `noindex`, no content hidden behind JS without an SSR
fallback, sitemap not truncated, robots.txt not blocking anything).

So I agree with your suspicion: with a new domain and few/no backlinks,
Google can decide "Discovered - currently not indexed" for everything that
isn't the home page, even if the HTML is perfect. Still, there are concrete
things that can help:

- [x] **Actually check Google Search Console**: check the coverage report
  ("Discovered - currently not indexed" or "Crawled - currently not
  indexed"? these are different causes). Submit the sitemap manually from
  there if that hasn't been done yet. This matters more than any code
  change.
- [ ] **Backlinks / domain authority** (as you already suspect): list the
  site on tool directories (Product Hunt, AlternativeTo, "web
  tools"/"quiz makers" directories), get 3-5 quality links. This is what
  has the most real impact at this stage.
- [x] **Indexable category pages** (`/category/[name]`, or
  `/search?category=x` with its own canonicalizable URL): right now
  `/search` is a single URL with client-side filtering; a page per category
  with its own unique `<title>`/`<meta description>` would multiply the
  indexable surface with 100% legitimate content (not thin/duplicate) and
  reinforce internal linking to templates.
- [x] **`WebSite` + `SearchAction` and `Organization` JSON-LD** on the home
  page — helps Google understand the site's entity and enables the
  sitelinks search box in results. Cheap to add, zero risk. **Added** as a
  `@graph` (Organization + WebSite w/ SearchAction → `/search?q=`) in
  `index.astro`.
- [ ] **`og:image:width` / `og:image:height`** in `Layout.astro` — currently
  missing; without them some social network crawlers have to download the
  image to calculate its size before showing the card.
- [x] **Reliability bug in `/template/[slug]`**: unlike `index.astro` and
  `search.astro`, this page doesn't wrap its D1 reads in try/catch (see the
  Bugs block below) — a transient D1 failure would bring down with a 500
  exactly the page you want Google to index. **Fixed**: the template load now
  degrades to 503+`Retry-After` (not a 404 that risks de-indexing), and the
  session/count/vote-score reads each fall back gracefully.
- [ ] **Unique content in user templates**: official templates have long
  descriptions (~290 characters on average); encourage (or enforce a
  somewhat higher minimum) so that user templates also have substantial
  descriptions — reduces the risk of Google treating them as thin content
  at scale.

## 🔒 Security

- [x] **IDOR on private templates**: `getTemplateBySlug`/`templateExists`
  didn't check `visibility` in any API endpoint — anyone who
  guessed/obtained the slug of a **private** template could read its full
  comment thread (`GET /api/comments`), comment on it (triggering a
  notification to the owner), vote, and save it, bypassing the "private =
  creator only" rule that was enforced on the page but not in the API.
  **Fixed in this commit** with a shared helper `canAccessTemplate()` in
  `src/lib/templates.ts`, applied in `api/comments/index.ts` (GET+POST),
  `api/templates/vote.ts` (GET+POST) and `api/me/saved.ts` (POST).
- [ ] **Account deletion with a dangerous cascade**: `ON DELETE CASCADE` on
  `comments.parent_id` (`migrations/0007_comments.sql`) + the `DELETE FROM
  users` in `api/auth/delete-account.ts` also deletes replies that **other
  users** wrote on the comments of the account being deleted, even though
  `softDeleteComment` exists specifically to avoid this. Change account
  deletion to soft-delete its comments instead of hitting the `users` table
  directly, or drop the cascade and clean up manually.
- [ ] **No rate limit on comments and follow/unfollow**: unlike
  `/api/templates/describe` (daily limit in KV), any logged-in account can
  script unlimited comment spam (with a notification to the owner) or
  follows.
- [ ] **Existence oracle for private slugs**: `templates/vote.ts` (before the
  fix) returned 404 only if the slug didn't exist, allowing confirmation
  that a guessed private slug *exists* even though its content is
  protected. The fix above normalizes this (404 both when it doesn't exist
  and when you don't have access), but it's worth a pass to confirm no
  other endpoint leaks that state distinction.

## 🐛 Bugs

- [x] **`/template/[slug].astro` missing try/catch around D1**: see the SEO
  note above — `getTemplateBySlug`, `getSessionUser`, the `times_ranked`
  count and the vote score aren't protected, unlike `index.astro`/
  `search.astro`. **Fixed** (all four reads wrapped; degrade to 503 / prior
  count / 0).
- [x] **Race condition on template creation**: `api/templates/index.ts`
  checks `MAX_TEMPLATES_PER_USER` with a `SELECT COUNT(*)` separate from the
  `INSERT`; two concurrent creations by the same user can bypass the limit.
  **Fixed**: the template `INSERT` now re-checks the limit atomically
  (`INSERT … SELECT … WHERE (SELECT COUNT(*) …) < ?` inside the existing
  batch/transaction; option inserts are conditioned on the template row
  existing) and returns 403 when `meta.changes` is 0. The `COUNT(*)`
  pre-check is kept only as a fast path.
- [x] **Hardcoded "VS"** in `src/components/ranking/BattleView.astro` (line
  ~130) instead of using `t("ranking.vs")` (which already exists and is used
  in the history modal). **Fixed**: badge now uses `t("ranking.vs")` with an
  `uppercase` class so it still reads "VS" while being translatable.
- [x] **Ghost text in the results image**: `ranking-share-image.ts` (line
  ~184) draws `ctx.fillText('', ...)` — a leftover from a removed subtitle
  that leaves an empty ~26px gap under the title. **Fixed**: removed the dead
  draw and shrank `HEADER_H` 140→110 to close the gap (test baselines updated).
- [x] **Blocking `alert()`** in `notifications.astro` (~line 368) when saving
  email preferences fails — inconsistent with the rest of the app, which
  uses inline error messages. **Fixed**: replaced with an inline
  `role="status"` error under the email-pref description (announced by
  screen readers, cleared on the next attempt); the `clientT` import is
  gone since the message is SSR-rendered into a `data-msg` attribute.

## ⚡ Performance

- [x] **N+1 in `listSavedTemplates`** (`src/lib/templates.ts` ~280-293): one
  ownership query per non-public saved template, inside a `for` loop.
  **Fixed**: ownership for all hidden slugs resolved in one `IN (...)` query.
- [x] **`listComments` with no limit** (`src/lib/comments.ts`): a popular
  thread grows without bound and there's no pagination. **Fixed** (limit
  half): a recursive CTE now fetches only the top `MAX_ROOT_THREADS` (100)
  root threads — same order the UI displays (vote volume desc, newest) —
  each with all its replies, so no reply is ever orphaned. Real pagination
  + "most upvoted" sorting stays a feature idea below.
- [x] **`dispatchNotification` sequential**: fetched the recipient's row and
  then the actor's row sequentially (`src/lib/notifications.ts` ~216-227).
  **Fixed**: both rows come from `users` in a single `IN (?, ?)` query (better
  than `Promise.all` — one round-trip, opt-out short-circuit preserved).

## 🧹 Best practices

- [x] **`templateExists` duplicated three times** (previously in `vote.ts`,
  `me/saved.ts`, and inline in `history.ts`/`track.ts`) instead of living
  once in `templates.ts` alongside `getTemplateBySlug` — any future
  visibility fix risks being applied inconsistently if it isn't
  consolidated (this commit's security fix already removes two of the three
  copies). **Fixed**: `templateExists(db, slug)` now lives in
  `src/lib/templates.ts` (with a doc note that it deliberately ignores
  visibility — existence-only, for write paths); `history.ts`, `track.ts`
  and `generateUnlistedSlug` all use it.

## ♿ Accessibility

- [ ] **Battle progress without `aria-live`**: `#battle-progress` /
  `#battle-skipped-count` in `BattleView.astro` change via `textContent` on
  every comparison, but there's no `aria-live` region, so a screen reader
  user has no way of knowing a round advanced or a skip was registered —
  exactly the most important feedback in the main flow.
- [ ] **Unannounced "sudden death" banner**: in `[slug].astro`
  (`enterFinalRound`, ~1022-1037) the notice that the rules are changing
  (skip is disabled) is inserted/removed from the DOM without
  `role="status"`/`aria-live`.
- [ ] **Undo/Skip/Finish buttons too small**: `BattleView.astro` (~47-65)
  uses `px-3 py-2 text-xs` (~32px) for the three buttons of the main
  interaction on mobile, below the ~44px recommended touch target size.

## 🎨 UX

- [ ] **"Finish early" doesn't warn about the tie-break criterion**: when
  finishing early, uncompared pairs are ordered with a default 50%
  (`[slug].astro`, `finishEarly`) without telling the user that the final
  queue is an estimate, not an actually measured preference.
- [ ] **No warning if images fail while generating the shareable result**: if
  an option's image fails to load during `downloadRankingImage`, there's no
  toast or warning — the button just finishes and generates an image with
  gaps, without the user knowing why.
- [ ] **No unsaved-changes warning** in `create.astro`/`TemplateForm`: filling
  in a template with a dozen options and accidentally navigating away loses
  it entirely, with no `beforeunload`/confirmation.
- [ ] **Flat visual hierarchy in `ResultsView`**: "Rank Again" (resets the
  view) has the same visual weight as share/save, with nothing reassuring
  the user that their result has already been saved before nudging them to
  redo it.

## 🌍 i18n

- [ ] Besides the hardcoded "VS" above, it's worth a broad grep pass for
  user-facing literals that slipped outside `t()` in recently added
  components (comments, notifications).

## ✨ Feature ideas

- [ ] **Community consensus ranking**: `ranking_results` are already stored
  per user and `votes`/comments per template — showing "how the community
  ranked this" (Borda count or average position) alongside the personal
  podium would fit naturally and reuse data that already exists.
- [ ] **Global win-rate per option**: the `comparisonMap` logic in
  `ranking-sort.ts` already computes wins/losses per session; persisting an
  aggregated win-rate per option at the site level ("Wins 71% of its
  matchups") and showing it as a badge on results/comments would add a
  "stats" layer that fits the product well.
- [ ] **Pagination/limit on comments** once the performance point is fixed —
  while at it, allow sorting by "most upvoted" on long threads.

---

*Generated from a code review (backend, frontend/UX) + a manual audit of the
existing SEO setup.*
</content>

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RANKMAKER (rankmaker.net) — users rank things through 1v1 matchups. Astro 5 + Tailwind 4, deployed to Cloudflare (Workers runtime with static assets) via `@astrojs/cloudflare`. Package manager is **pnpm**. There is no linter; correctness is checked by `pnpm build`, `pnpm check` (`astro check` — type-checks frontmatter + `.ts`; the legacy `[slug].astro` controller script is `@ts-nocheck`'d), `pnpm test` (Vitest unit, `src/scripts/*.test.ts`) and `pnpm test:e2e` (Playwright, `e2e/`).

## Commands

```bash
pnpm dev                    # dev server at http://localhost:4321 (local D1/KV via miniflare)
pnpm build                  # production build — run this to verify changes
pnpm preview                # preview the production build
pnpm check                  # astro check — TypeScript type-check (no emit)
pnpm test                   # Vitest unit tests (src/scripts/*.test.ts)
pnpm test:e2e               # Playwright e2e (e2e/, drives `pnpm dev`); needs browser deps:
                            #   sudo npx playwright install-deps chromium

# D1 migrations use Wrangler's native runner (state tracked in the d1_migrations
# table). One command applies every pending migrations/NNNN_*.sql in order — no
# per-file script. To add one: scaffold, write the SQL, then apply.
pnpm run db:migrate:new <name>  # scaffold migrations/NNNN_<name>.sql
pnpm run db:migrate:list        # show pending migrations (local)
pnpm run db:migrate:local       # apply all pending migrations to local D1
pnpm run db:migrate:remote      # apply all pending migrations to production D1
```

Local secrets live in `.dev.vars` (gitignored): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`. Production secrets are set with `wrangler secret put`.

## Architecture

**Rendering model:** `astro.config.mjs` sets `output: 'static'`, but most pages and all API routes opt into SSR with `export const prerender = false`. Anything touching D1/KV/sessions must be SSR; purely static pages (about, legal) are prerendered. The Vite watcher ignores `.wrangler/**` — miniflare writes SQLite journals there on every query and watching them causes an infinite reload loop in dev.

**Cloudflare bindings** (`wrangler.jsonc`, typed by hand in `src/env.d.ts`, accessed as `Astro.locals.runtime.env` / `locals.runtime.env`):
- `DB` — D1: users, sessions, templates, template_options, rankings
- `rm-times-ranked` — KV: raw "Start Ranking" event log (written by `/api/track`)
- `AI` — Workers AI, used only by `/api/templates/describe`

**Two template sources, one shape.** Official templates live in `src/data/templates.json`; user-created templates live in D1. `src/lib/templates.ts` normalizes both into a single `Template` type (`source: 'official' | 'user'`) so pages treat them identically. Slug lookups check JSON first, then D1; `generateUniqueSlug` deduplicates across both sources. Shared input validation for create/update (`validateTemplateInput`) also lives here — keep server-side limits (option counts, lengths) in sync with any frontend form changes.

**Template visibility** (`templates.visibility`: `public` | `private` | `unlisted`; officials are always public). List queries (`listUserTemplates`, `listTemplatesByUserId`, the sitemap) return public templates only — `/me` passes `includeHidden`. Private pages 404 for anyone but the creator; unlisted pages are reachable by URL only: the slug is random (`generateUnlistedSlug`), the page is `noindex` (meta + `X-Robots-Tag`) and `no-store`. Switching a template TO unlisted regenerates its slug (the old one was public knowledge) and moves its `rankings` rows. **Don't leak hidden slugs through public endpoints** — that's why `getCounts` excludes them by default.

**Times-ranked counts** are NOT the KV log: display counts come from `SELECT slug, COUNT(*) FROM rankings GROUP BY slug` in D1 via `src/lib/counts.ts` (shared by `/api/counts` and the SSR homepage). User templates are mapped with `times_ranked: 0` and pages merge real counts in.

**Per-user history & "played" tracking.** A ranking is attributed to a user at two moments. On **START**, `/api/track` stamps `rankings.user_id` (logged-in) and the client adds the slug to `localStorage` (anonymous) — this is the "played" set used to hide already-played templates from the "You might also like" row (filtering is **client-side** in `RecommendedTemplates.astro` because template pages are publicly cached; the SSR over-fetches so a full row survives). On **completion**, the final ordered result is saved: logged-in users upsert into `ranking_results` (one row per user+template) via `POST /api/me/history`; anonymous users save to `localStorage`. The `/history` page renders DB results SSR for logged-in users and `localStorage` results client-side for anonymous. The shared `localStorage` helper is `src/scripts/history.ts`. `GET /api/me/history` returns the logged-in user's played slugs (for the client recommendation filter). Because `/history` is a top-level route it's in `RESERVED_USERNAMES`.

**Auth** (`src/lib/auth.ts` + `src/pages/api/auth/*`): GitHub OAuth → D1-backed sessions in an httpOnly `rm_session` cookie (30 days, lazily expired). The OAuth state and the signup handoff (new GitHub user → choose username at `/signup`) use short-lived HMAC-signed cookies signed with `SESSION_SECRET`. CSRF protection on mutating endpoints is a same-origin `Origin` header check (`checkOrigin`) combined with SameSite=Lax — preserve that check on any new POST/PUT/DELETE route. Reserved usernames are listed in `auth.ts` because `/u/[username]` shares URL space with top-level routes — adding a new top-level page means adding its name there.

**AI description suggestions** (`src/pages/api/templates/describe.ts`): Workers AI (llama-3.3-70b), auth-required, daily per-user limit. The prompt treats all user content as data (prompt-injection hardening) and the client treats any non-200 as "no suggestion". The prompt has tuning notes inline — read them before adjusting it.

**Battle/ranking logic is client-side** in `src/pages/template/[slug].astro` (~1200 lines: battle state, undo, results, drag-reorder). The page's `<script>` is a bundled module (re-runs `rankingInit` on every `astro:page-load`); it reads options from the inline `#ranking-data` JSON in the swapped DOM, never a global. Logic is extracted to `src/scripts/`: `ranking-sort.ts` (comparison map + transitive inference + generic merge sort) and `ranking-share-image.ts` (results PNG canvas renderer) are pure and unit-tested; `ranking-reorder.ts` wraps SortableJS for the results drag-to-reorder (`supportPointer: false` so it drives the fallback with mouse/touch events, which is reliable under synthetic test input). Components in `src/components/ranking/` are the views it drives.

## Conventions

- Conventional Commits (`feat(scope): ...`, `fix(scope): ...`) — see git log.
- **Commit directly to the current branch — including `main` — unless a branch or PR is explicitly requested.** Do not auto-create a feature branch before committing just because the working branch is the default.
- **Before committing, decide commit granularity deliberately.** Whenever asked to commit, first assess whether the changes belong in one commit or should be split into several. Split when the changes are independently revertable concerns (different features/surfaces/intents); keep as one when they serve a single coherent change. State the chosen split and the reasoning before running `git commit`.
- Components `PascalCase.astro`, pages `kebab-case.astro`, lib/scripts `kebab-case.ts`. Tabs in `.astro` files.
- Tailwind utility classes only; global styles/theme in `src/styles/global.css`.
- D1 types (`D1Database`, `KVNamespace`, `Ai`) are hand-declared in `src/env.d.ts`, not imported from `@cloudflare/workers-types` — extend them there if you use new methods.
- **User-visible strings must not be hardcoded.** All user-facing text goes in the i18n locale files. Use the translation function, never raw strings in components or pages. `en.ts` is the source of truth; the other locales are partial (typed `LocaleDict`, every key optional). Any key missing from a locale falls back to English at runtime (`useTranslations`, `src/i18n/index.ts`), so a locale file only needs the keys it actually translates — never add placeholder copies of the English value just to fill a key.
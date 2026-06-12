# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RANKMAKER (rankmaker.net) — users rank things through 1v1 matchups. Astro 5 + Tailwind 4, deployed to Cloudflare (Workers runtime with static assets) via `@astrojs/cloudflare`. Package manager is **pnpm**. There are no tests or linter; `pnpm build` is the correctness check.

## Commands

```bash
pnpm dev                    # dev server at http://localhost:4321 (local D1/KV via miniflare)
pnpm build                  # production build — run this to verify changes
pnpm preview                # preview the production build

# D1 migrations are plain SQL files run individually (no migration runner):
pnpm run db:migrate:local   # migrations/0001_init.sql (rankings table)
pnpm run db:migrate3:local  # migrations/0003_users_templates.sql (users/sessions/templates)
# :remote variants apply to production D1
```

Local secrets live in `.dev.vars` (gitignored): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`. Production secrets are set with `wrangler secret put`.

## Architecture

**Rendering model:** `astro.config.mjs` sets `output: 'static'`, but most pages and all API routes opt into SSR with `export const prerender = false`. Anything touching D1/KV/sessions must be SSR; purely static pages (about, legal) are prerendered. The Vite watcher ignores `.wrangler/**` — miniflare writes SQLite journals there on every query and watching them causes an infinite reload loop in dev.

**Cloudflare bindings** (`wrangler.jsonc`, typed by hand in `src/env.d.ts`, accessed as `Astro.locals.runtime.env` / `locals.runtime.env`):
- `DB` — D1: users, sessions, templates, template_options, rankings
- `rm-times-ranked` — KV: raw "Start Ranking" event log (written by `/api/track`)
- `AI` — Workers AI, used only by `/api/templates/describe`

**Two template sources, one shape.** Official templates live in `src/data/templates.json`; user-created templates live in D1. `src/lib/templates.ts` normalizes both into a single `Template` type (`source: 'official' | 'user'`) so pages treat them identically. Slug lookups check JSON first, then D1; `generateUniqueSlug` deduplicates across both sources. Shared input validation for create/update (`validateTemplateInput`) also lives here — keep server-side limits (option counts, lengths) in sync with any frontend form changes.

**Times-ranked counts** are NOT the KV log: display counts come from `SELECT slug, COUNT(*) FROM rankings GROUP BY slug` in D1 via `src/lib/counts.ts` (shared by `/api/counts` and the SSR homepage). User templates are mapped with `times_ranked: 0` and pages merge real counts in.

**Auth** (`src/lib/auth.ts` + `src/pages/api/auth/*`): GitHub OAuth → D1-backed sessions in an httpOnly `rm_session` cookie (30 days, lazily expired). The OAuth state and the signup handoff (new GitHub user → choose username at `/signup`) use short-lived HMAC-signed cookies signed with `SESSION_SECRET`. CSRF protection on mutating endpoints is a same-origin `Origin` header check (`checkOrigin`) combined with SameSite=Lax — preserve that check on any new POST/PUT/DELETE route. Reserved usernames are listed in `auth.ts` because `/u/[username]` shares URL space with top-level routes — adding a new top-level page means adding its name there.

**AI description suggestions** (`src/pages/api/templates/describe.ts`): Workers AI (llama-3.3-70b), auth-required, daily per-user limit. The prompt treats all user content as data (prompt-injection hardening) and the client treats any non-200 as "no suggestion". The prompt has tuning notes inline — read them before adjusting it.

**Battle/ranking logic is client-side** in `src/pages/template/[slug].astro` (~1600 lines: battle state, sorting algorithm, undo, results). Components in `src/components/ranking/` are the views it drives.

## Conventions

- Conventional Commits (`feat(scope): ...`, `fix(scope): ...`) — see git log.
- Components `PascalCase.astro`, pages `kebab-case.astro`, lib/scripts `kebab-case.ts`. Tabs in `.astro` files.
- Tailwind utility classes only; global styles/theme in `src/styles/global.css`.
- D1 types (`D1Database`, `KVNamespace`, `Ai`) are hand-declared in `src/env.d.ts`, not imported from `@cloudflare/workers-types` — extend them there if you use new methods.

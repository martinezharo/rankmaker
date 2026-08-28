# Contributing to RANKMAKER

First off, **thank you** for considering contributing to RANKMAKER! Every contribution — whether it's a bug report, a feature suggestion, or a pull request — helps make this project better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting a Pull Request](#submitting-a-pull-request)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind, be constructive, and assume good intentions from others. Harassment, discrimination, or any form of toxic behavior will not be tolerated.

## How Can I Contribute?

### Reporting Bugs

Found a bug? Please [open an issue](../../issues/new) and include:

1. **A clear, descriptive title.**
2. **Steps to reproduce** the problem.
3. **Expected behavior** vs. **actual behavior.**
4. **Screenshots or screen recordings** if applicable.
5. **Browser and OS** information.

### Suggesting Features

Have an idea? [Open an issue](../../issues/new) with:

1. **A clear title** describing the feature.
2. **The problem it solves** — why is this useful?
3. **Your proposed solution** — how should it work?
4. **Alternatives you've considered** (if any).

### Submitting a Pull Request

1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/my-awesome-feature
   ```
2. **Make your changes** following the [code style](#code-style) guidelines.
3. **Test your changes** locally:
   ```bash
   pnpm dev     # try it in the browser
   pnpm check   # types
   pnpm test    # unit + API tests
   ```
4. **Build the project** to make sure nothing breaks:
   ```bash
   pnpm build
   ```
5. **Commit your changes** following the [commit message](#commit-messages) conventions.
6. **Push** to your fork and open a Pull Request against `main`.

#### Pull Request Checklist

- [ ] My code follows the project's code style.
- [ ] `pnpm check`, `pnpm test` and `pnpm build` all pass.
- [ ] New or changed behaviour has a test (see [Testing](#testing)).
- [ ] I have added/updated documentation if needed.
- [ ] My PR has a clear title and description.

## Development Setup

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 8

### Quick Start

```bash
# Clone your fork
git clone https://github.com/martinezharo/rankmaker.git
cd rankmaker

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

The dev server will be available at `http://localhost:4321`. Local Cloudflare bindings (D1, KV, Workers AI) are emulated automatically via miniflare.

If your change touches user accounts, user-created templates, or the times-ranked counters, you'll also need the local D1 migrations and a dev GitHub OAuth App — follow the [Database & Auth setup](README.md#database--auth-setup-user-accounts--user-templates) section in the README.

### Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the local development server |
| `pnpm check` | Type-check every Astro/TS file |
| `pnpm test` | Run the unit and API tests |
| `pnpm test:coverage` | Same, with coverage (enforces the floors in `vitest.config.ts`) |
| `pnpm test:e2e` | Run the Playwright suite against a dev server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview the production build locally |
| `pnpm astro` | Run Astro CLI commands |
| `pnpm run db:migrate:local` | Apply every migration to local D1 |

## Project Architecture

RANKMAKER is built with **Astro 5** (prerendered pages plus SSR routes via the `@astrojs/cloudflare` adapter), styled with **Tailwind CSS 4**, and deployed on **Cloudflare Workers** with D1, KV, and Workers AI bindings.

### Key Concepts

- **Templates** are ranking topics (e.g., "Best Marvel Movies"). Each template has a list of **options** that users compare in 1v1 battles.
- Templates come from **two sources**: official ones in `src/data/templates.json`, and user-created ones stored in **Cloudflare D1**. `src/lib/templates.ts` merges both behind a single `Template` shape so pages treat them identically — keep that contract intact when changing either side.
- **Battle View** presents two options side by side. The user taps their preference, and the sorting algorithm determines the next matchup.
- **Results View** shows the final ranking with a podium (top 3) and a full ordered list.
- Pages that read D1/KV or sessions opt into SSR with `export const prerender = false`; purely static pages (about, legal) stay prerendered.
- Adding or modifying **official** templates still means editing `src/data/templates.json` directly. User templates are created through the app (`/create`, auth required).

## Testing

Three suites, and CI runs all of them on every pull request.

| Where | What it covers | How it runs |
|---|---|---|
| `src/**/*.test.ts` | Modules, next to the code they test | Vitest, plain Node |
| `tests/**/*.test.ts` | The API routes under `src/pages` | Vitest, plain Node |
| `e2e/*.spec.ts` | The ranking and account flows in a real browser | Playwright + `astro dev` |

**Route tests live in `tests/`, never next to the route.** Astro turns every
file under `src/pages` into a route, so a colocated `foo.test.ts` there would
be built and deployed as a live endpoint. `tests/` mirrors the route tree, and
`src/test/no-page-tests.test.ts` fails if one ever slips back in.

### Writing a test that needs the database

`src/test/d1.ts` gives you a real D1 binding: an in-memory SQLite database with
every migration in `migrations/` applied. Nothing is mocked, so a typo in a
column name or a predicate that silently matches nothing shows up as a failing
test rather than a production bug.

```ts
const db = createTestDb();
const alice = await insertUser(db, { username: 'alice' });
await insertTemplate(db, alice.id, { slug: 'best-movies' });
```

`src/test/factories.ts` builds the rows (users, templates, ranking events,
saved results, uploads, sessions); state only what the test is about and let
the defaults fill in the rest.

### Writing a test for an API route

`src/test/api.ts` builds the `APIContext` a route handler expects, plus stubs
for R2 and KV. It defaults to a same-origin POST, so a test opts *out* of the
CSRF check (`origin: null`) rather than having to remember to opt in.

```ts
const response = await POST(
  apiContext({ db, path: '/api/…', body, cookies: await signIn(db, alice.id) })
);
```

Every mutating route should be covered for all four of: cross-site request,
no session, someone else's data, and the happy path.

### Writing an end-to-end test that needs an account

A session only exists after a GitHub OAuth round-trip, which the Worker
performs server-side — no browser-level interception can stand in for it. So
`e2e/fixtures/` seeds the session that the OAuth callback *would* have written,
straight into the miniflare-backed D1 the dev server reads. Nothing else is
faked: every authorization check then runs for real.

```ts
import { expect, test } from './fixtures/test';

test('does something as a signed-in user', async ({ page, signIn, seedTemplateFor }) => {
  const user = await signIn('my-test');           // seeded user + session cookie
  const template = seedTemplateFor(user.id, 'thing');
  await page.goto(`/template/${template.slug}`);
});
```

Everything seeded is named `e2e-…`, and the global teardown deletes only rows
with that prefix — the local database is your own and a test must not touch
your data. `queryOne` / `queryAll` are there for the assertions that have to
look past the UI at what was actually written.

### Coverage

`pnpm test:coverage` enforces floors on `src/lib`, `src/pages/api`,
`src/components` and `src/scripts` (see `vitest.config.ts`). They are floors,
not targets — they exist so a change that quietly stops covering something
fails CI rather than shipping.

## Code Style

- **Language:** TypeScript is preferred. Use proper types instead of `any` when possible.
- **Components:** `.astro` by default. Preact (`.tsx`) is for the surfaces that need real client state or that the browser has to re-render itself — the ranking engine and the listing grids. Keep them focused and reusable.
- **Styling:** Use Tailwind CSS utility classes. Follow existing patterns for colors, spacing, and typography.
- **Formatting:** Use consistent indentation (tabs for `.astro` files, as per the existing codebase).
- **Naming:**
  - Components: `PascalCase.astro`
  - Pages: `kebab-case.astro`
  - Utilities/scripts: `kebab-case.js` / `.ts`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

[optional body]
```

### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, not CSS) |
| `refactor` | Code refactoring (no feature or fix) |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (deps, configs, etc.) |

### Examples

```
feat(search): add fuzzy matching to template search
fix(battle): prevent duplicate matchups in edge cases
docs(readme): update deployment instructions
style(components): consistent tab indentation
```

---

Thanks again for contributing! If you have questions, feel free to open an issue or reach out. 🚀

# AGENTS.md
## Project
RANKMAKER is a website that lets you create accurate rankings for movies, music, video games, sports, etc. through 1v1 battles, instead of the repetitive and inaccurate tier lists.
This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.
## Terminology
* Template / ranking template: The set of options, description, title, images, etc. that you select to create a ranking.
* Ranking: The ordering of the options from a template.
> Note: you may find these terms used interchangeably within the repository, and I might even do the same on occasion myself. I just want you to be aware of this for how YOU communicate and design.
## Product priorities
* Rankings with transitivity that require as few matchups as possible to complete the ranking.
* Users should be able to share their rankings and templates in an easy, intuitive way that favors virality on social media.
## Testing
Every change ships behind three suites; run `pnpm check && pnpm test` before you
call a change done, and `pnpm test:e2e` when you touched the ranking flow.
* `src/**/*.test.ts` — modules, colocated with the code they test.
* `tests/**/*.test.ts` — the API routes. They live here and NOT next to the
  route because Astro turns every file under `src/pages` into a deployed route.
* `e2e/*.spec.ts` — the ranking and account flows in a real browser.
  `e2e/fixtures/` seeds a session into the local D1 so the signed-in flows
  can be driven without a GitHub OAuth round-trip.
`src/test/` holds the harnesses: `d1.ts` (a real D1 binding over in-memory
SQLite with the actual migrations applied), `factories.ts` (row builders),
`api.ts` (an `APIContext` plus R2/KV stubs), `cookies.ts`, `storage.ts`. Reach
for those instead of hand-rolling a mock — a mock only proves a method was
called, while these run the real SQL. A new mutating endpoint needs coverage for
the cross-site request, the missing session, someone else's data, and the happy
path. See CONTRIBUTING.md for the longer version.

## Maintainability
Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.
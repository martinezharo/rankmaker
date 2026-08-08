# RANKMAKER Deep Audit

Audit date: 2026-08-07

Scope: application code, API authorization and validation, browser-visible
flows, D1/KV/R2 lifecycle, dependency health, and build/test configuration.
The changes in this audit deliberately stay within existing product behavior.
Items below are deferred when resolving them would require a product,
deployment, or data-retention decision rather than a safe correctness fix.

## Low-risk issues fixed in this audit

- Inline JSON now escapes HTML-sensitive characters before it is written into
  `<script>` elements. This closes the `</script>` injection path for template,
  history, form, demo, JSON-LD, and ranking data payloads.
- Signed auth payloads now round-trip arbitrary UTF-8 text without deprecated
  `escape`/`unescape` helpers, reject malformed signature lengths before crypto,
  and have regression tests.
- Template slug reads are case-insensitive and new writes resolve to the
  source spelling. Counts and vote aggregates combine legacy case variants,
  and save/history writes remove only stale case-only aliases before upserting.
- Comment vote mutations now verify that the comment exists, is not deleted,
  and belongs to a template the caller can access. Counter values are
  recomputed from vote rows in the same D1 batch instead of applying a stale
  read/modify/write delta.
- Upload endpoints reject unknown kinds, cap chunked request bodies while
  streaming, sniff magic bytes, reserve quota only after cheap validation, and
  remove an R2 object if its D1 ownership row cannot be created. Account
  deletion now removes owned R2 objects before the user row is deleted.
- Deprecated Astro `ViewTransitions` usage was replaced with `ClientRouter`.
  The Font Awesome stylesheet is marked `transition:persist` so the element
  promoted from `rel="preload"` to `rel="stylesheet"` survives the head swap.
  Without it the router reinserted a bare preload link and left every icon
  unstyled for the rest of the session; `e2e/icons.spec.ts` guards this.
- Case-insensitive slug lookups have matching `COLLATE NOCASE` indexes
  (migration 0015). SQLite only uses an index whose collation matches the
  predicate's, so `WHERE slug = ? COLLATE NOCASE` was scanning `comments`,
  `rankings`, `votes`, `ranking_results`, and `template_saves` outright.
  `templates.slug` needed nothing: that column is already declared NOCASE.
- Template votes apply their alias cleanup and upsert in one `batch()`, and no
  longer delete the canonical row they are about to reinsert.
- Slug-keyed aggregates (`getCounts`, `getTemplateVotes`) are keyed only by the
  lowercased slug and read through `slugValue()`, instead of duplicating every
  total under both the lowercased and the raw spelling.
- Playwright tests can target an externally started server, isolate Miniflare
  state from a user's running dev server, establish cookie-consent state before
  page scripts run, and use a stable mouse path for SortableJS fallback drags.
- Mutating follow/save actions reject unknown action values instead of silently
  treating arbitrary input as a valid mutation.

## Findings that require an important decision

### 1. Framework dependency and transitive security upgrade

`pnpm audit --prod` currently reports 36 production vulnerabilities (6 low,
18 moderate, and 12 high). The vulnerable graph includes the Astro 5 /
Cloudflare adapter 12 chain and nested versions of Wrangler/Miniflare/Undici,
as well as Vite, Sharp, WebSocket, and other tooling dependencies.

Blind overrides are not safe here. The supported Astro 6 migration requires
Cloudflare adapter v13 or later, moves development to the `workerd` runtime,
removes `Astro.locals.runtime`, changes the Wrangler entrypoint, and requires
Node 22.12 or newer. RANKMAKER currently reads `Astro.locals.runtime` across
pages and API routes and uses the older Wrangler entrypoint.

Decision needed: schedule a dedicated Astro/Cloudflare migration on a staging
deployment, including the Node runtime, Wrangler entrypoint, bindings, and all
runtime access sites. Do not mark the audit clean by adding unverified package
overrides. References: [Astro v6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/)
and [Cloudflare adapter upgrade guidance](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#upgrading-to-v13-and-astro-6).

### 2. Health-check authentication must leave URLs

`GET /api/health?key=<SESSION_SECRET>` protects detailed readiness output, but
query strings can be copied into proxy/access logs, browser history, monitoring
config, and referrer metadata. Replacing it is operationally safe only after
all probes are migrated.

Decision needed: choose a header-based contract such as `Authorization` or
`X-Health-Key`, decide whether a short-lived dedicated probe secret should
replace the session secret, and then remove query-key compatibility.

### 3. Production image moderation policy

When `OPENAI_API_KEY` is absent, image moderation intentionally allows uploads
with a warning. This is useful for local development but is a fail-open policy
if production configuration drifts. `OPENAI_API_KEY` is currently optional in
the readiness contract.

Decision needed: either make moderation a required production dependency and
fail closed when unavailable, or explicitly keep an unmoderated mode with
separate deployment checks, user/reporting controls, and abuse monitoring.

### 4. CSP hardening and image origin policy

The current CSP permits `unsafe-inline` scripts/styles and `https:`/`data:`/
`blob:` images. Those allowances support the current inline JSON, analytics,
client rendering, previews, and arbitrary user-provided image URLs, but they
reduce the protection gained from CSP. HSTS and a Permissions-Policy are also
deployment-level choices rather than purely local fixes.

Decision needed: choose a nonce/hash migration for inline scripts, an image
proxy or explicit image-origin allowlist, and the production HTTPS/header
policy. Validate analytics, ClientRouter, canvas previews, and uploaded-image
URLs during that rollout.

### 5. Cross-store R2/D1 lifecycle guarantees

The upload path now compensates for a failed D1 ownership insert, and account
deletion removes R2 objects while ownership rows still exist. Template edit and
delete flows still perform R2 deletion and D1 changes as separate operations.
A failure between those systems can leave a dangling object or an ownership
row that points at a missing object; neither R2 nor D1 participates in the
other system's transaction.

Decision needed: choose an idempotent reconciliation strategy (for example an
outbox/retry queue, scheduled inventory reconciliation, or a stronger
compensating state machine), including what the user sees while cleanup is
pending.

### 6. Template deletion, account deletion, and data retention

Account deletion intentionally preserves anonymous aggregate ranking events,
while comments are anonymized/soft-deleted. Template deletion does not have a
single documented policy for historical `ranking_results`, comments, saves,
notifications, votes, and ranking analytics whose slug no longer resolves.
Keeping some records may preserve discussion and aggregate statistics; purging
or anonymizing them may better satisfy deletion expectations and avoid stale
links.

Decision needed: define retention and deletion semantics per record type, then
add a migration/cleanup job and user-facing documentation. This should include
the treatment of comments and ranking results after a template owner deletes a
template.

### 7. Abuse controls and exact rate-limit semantics

The KV rate limiter uses a get-then-put sequence and is deliberately a soft
guard. Uploads, AI description generation, comments, and follows are guarded,
but ranking tracking can still be replayed and concurrent requests can exceed
soft limits. Making limits exact would change identity, cost, and availability
behavior.

Decision needed: define per-action limits, whether anonymous IP/device signals
are acceptable, and whether exact enforcement should use a Durable Object,
Cloudflare Rate Limiting, or another centralized mechanism.

### 8. One-time legacy slug migration

Runtime reads now tolerate case-only slug aliases and aggregate their counts and
votes, and migration 0015 gives those reads NOCASE indexes so the compatibility
layer is not paid for with table scans. Existing databases may still contain
duplicate aliases across ranking results, comments, saves, votes, and
notification references. Automatically merging them requires rules for result
precedence, comment timestamps, vote identity, and notification delivery.

Decision needed: choose whether to keep the compatibility layer permanently or
run a one-time migration with explicit merge rules and a rollback plan.

### 9. SSR pagination and query-shape strategy

Some owner-facing paths resolve saved templates with one template lookup per
saved slug, and comment threads intentionally load all replies beneath selected
root threads. These are reasonable for current early-WIP scale but can become
slow or memory-heavy as users, saves, and discussion grow. Fixing this cleanly
requires an API/UI contract for cursors, thread expansion, freshness, and
possibly materialized counters or caching.

During the migrated local-browser run, the same SSR/API surfaces ranged from
sub-second responses to roughly 4–76 seconds under the existing VPS CPU load.
Part of that was the missing NOCASE indexes now added in migration 0015; the
rest is deployment load and query shape. This is not a production benchmark,
but it is enough evidence to keep both visible rather than assuming the
current parallel requests scale indefinitely.

Decision needed: choose pagination boundaries and freshness guarantees before
changing the response shapes or adding durable aggregate tables.

### 10. Interactive card semantics

`TemplateCard.astro` currently nests save/share controls and a profile control
inside the card's outer anchor. Event delegation stops accidental navigation in
the current browser flow, but nested interactive controls are fragile for
keyboard and assistive-technology semantics.

Decision needed: choose the card hit-area structure (separate link wrapper,
button/card semantics, or a non-nested layout) before changing markup and
interaction behavior across every card surface.

### 11. E2E database fixture lifecycle

The default Playwright command starts Astro against the local persistence
directory, whose D1 schema depends on whether migrations have previously been
applied. A browser run against an empty schema can still pass official-template
UI checks while API calls degrade behind their defensive fallbacks. The
verification harness added here can target a separately started server, but it
does not silently migrate a user's persistent local database.

Decision needed: choose whether CI and local E2E own an ephemeral D1/KV/R2
fixture (including migrations and seed data), or whether developers must start
an explicitly prepared environment. The choice affects isolation, startup
time, and whether API behavior is covered by the default command.

## Verification notes

- `pnpm check`: 0 errors, 0 warnings, 0 hints.
- `pnpm test`: 14 test files and 134 tests passed.
- `pnpm build`: passed. The remaining adapter messages are the existing
  Cloudflare KV/sharp informational warnings, not build failures.
- Playwright: the full UI suite passed against an isolated state directory
  without migrations; that run is not counted as database/API coverage. With
  all 14 migrations applied in a separate D1 state, five tests passed in the
  sustained run before the VPS became CPU-contended and the two
  latency-sensitive tests timed out. Those two tests then passed individually
  after a fresh server restart (remote-history layout test: 1/1; client
  navigation/options test: 1/1). The migrated server returned no missing-table
  errors; its page/API latency ranged from sub-second to tens of seconds under
  the existing VPS load, which is recorded as the SSR performance concern
  above rather than hidden by a retry.
- `pnpm audit --prod`: exit 1 with the 36 vulnerabilities described above;
  this is intentionally not hidden by an override or an unreviewed major
  dependency migration.

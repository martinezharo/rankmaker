<p align="center">
  <img src="public/RANKMAKER-logo.webp" alt="RANKMAKER Logo" width="180" />
</p>

<h1 align="center">RANKMAKER</h1>

<p align="center">
  <strong>Rank your stuff — no tiers, no noise, just accurate 1v1 rankings.</strong>
</p>

RANKMAKER turns preferences into an ordered list through fast head-to-head
comparisons. Browse official templates, create your own, or rank a guest
template locally without an account.

## Highlights

- A comparison-based ranking flow with undo, skip, finish early, battle
  history, and manual reordering.
- Official and community templates with 4–50 options. Signed-in creators can
  create templates with public, unlisted, or private visibility.
- Search and category browsing, public creator profiles, saves, follows, and
  comments.
- Live “Times Ranked” counts, shareable template links, downloadable result
  images, and sharing to X.
- AI-assisted description suggestions for signed-in template creators.
- A multilingual interface with seven locale options.

## Development

Requirements:

- Node.js 22 or newer.
- pnpm 9 or newer.

Install dependencies and start the local Cloudflare-backed development server:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:4321>. Official templates and guest-local workflows can
be explored without an account. To exercise sign-in and account-backed
templates, copy [.dev.vars.example](.dev.vars.example) to `.dev.vars`, set
`SESSION_SECRET` and the credentials of at least one sign-in provider
(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` /
`GITHUB_CLIENT_SECRET`), then apply the local D1 migrations:

```bash
cp .dev.vars.example .dev.vars
pnpm run db:migrate:local
```

Every provider shares one callback URL — use
`http://localhost:4321/api/auth/callback` in both the Google Cloud console and
the development GitHub OAuth App. A provider whose credentials are missing is
simply not offered in the login dialog, so one of the two is enough. Resend is
optional in local development; notifications remain available in the app when
email delivery is not configured.

## Checks and scripts

```bash
pnpm check
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm build
pnpm preview
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and
available database commands.

## Moderation

There is no moderation UI: a template is suspended straight from the
Cloudflare D1 dashboard (or `wrangler d1 execute`). A suspended template drops
out of every public listing while its URL keeps working, and its creator sees a
"suspended" badge with the reason behind the info icon — they cannot lift it.

```bash
pnpm exec wrangler d1 execute rankmaker --remote \
  --command "UPDATE templates SET suspension_reason = 'low_quality' WHERE slug = 'the-slug'"
```

Set `suspension_reason` back to `NULL` to lift it. The valid reasons live in
[src/lib/suspension.ts](src/lib/suspension.ts).

## Deployment

RANKMAKER is deployed to Cloudflare Workers. Bindings and the D1 migration
directory are declared in [wrangler.jsonc](wrangler.jsonc). Before a release,
check production readiness and apply any accepted remote migrations:

```bash
pnpm run check:deploy
pnpm run db:migrate:remote
pnpm build
pnpm exec wrangler deploy
```

Set the production secrets listed in [.dev.vars.example](.dev.vars.example)
through Wrangler or the Cloudflare dashboard.

## License

RANKMAKER is released under the [MIT License](LICENSE).

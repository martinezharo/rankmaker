---
name: verify
description: How to verify changes in this repo by driving the running app (dev server + Playwright script), not by re-running CI.
---

# Verifying rankmaker changes at the surface

## Launch

```bash
pnpm dev   # http://localhost:4321 — local D1/KV via miniflare; first boot ~10-20s
```

Run it in the background and poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/` until 200.

## Drive with Playwright

- Import from `@playwright/test` (it re-exports `chromium`); plain `playwright`
  is NOT a dependency. pnpm's strict node_modules means the script must resolve
  from the repo root — copy the script into the repo (e.g. `./.drive.tmp.mjs`),
  run it with `node`, then delete it.
- Chromium is already installed for the e2e suite.

## Gotchas that eat timeouts

- **Cookie banner**: it intercepts clicks on the floating CTAs. First thing
  after `goto`: `await page.click('#reject-cookies').catch(() => {})`.
  `localStorage.clear()` resurrects the banner — re-dismiss after clearing.
- **Modals** toggle the `hidden` class; wait for close with
  `waitForSelector('#the-modal', { state: 'hidden' })`, never `'#the-modal.hidden'`
  (that waits for visibility and always times out).
- Battle picks animate ~580ms before the next duel renders — wait ~750ms
  between clicks when scripting a full ranking.
- Useful hooks on `/template/[slug]`: `#start-ranking-btn`, `#battle-card-a/b`
  (`data-item-id`), `#battle-progress`, `#results-list .rank-item`
  (`data-item-id`), storage keys `rankmaker_history` / `rankmaker_played` /
  `rankmaker_excluded`.
- Official template with few options for quick runs:
  `/template/best-social-networks-ranking` (9 options).

Attach `page.on('pageerror', ...)` — the ranking controller is untyped DOM glue
and runtime errors are the main failure signal.

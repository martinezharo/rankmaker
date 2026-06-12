<p align="center">
  <img src="public/RANKMAKER-logo.webp" alt="RANKMAKER Logo" width="180" />
</p>

<h1 align="center">RANKMAKER</h1>

<p align="center">
  <strong>Rank your stuff — no tiers, no noise, just accurate 1v1 rankings.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## What is RANKMAKER?

RANKMAKER is a web application that lets users build precise, personalized rankings through fast **1-on-1 matchups**. Instead of dragging items into broad tiers, users are presented with head-to-head battles and their choices are compiled into an ordered ranking using an efficient sorting algorithm.

Pick a template — movies, music, sports, anime, food, and many more — or **create your own** and let the battles decide what *really* comes out on top.

## Demo

> **Live site:** [rankmaker.net](https://rankmaker.net)

## Features

- **1v1 Battle System** — Fast, tap-friendly matchup interface that minimizes decision fatigue.  
- **Smart Sorting Algorithm** — Generates accurate rankings from the fewest comparisons possible.  
- **Pre-built Templates** — Across 18 categories: Movies, Music, Sports, Games, TV, Anime, Food, and more.  
- **User Accounts** — Sign in with GitHub, pick a username and avatar, and manage your account.  
- **User-created Templates** — Logged-in users can create, edit, and delete their own templates (4–50 options each).  
- **AI Description Suggestions** — Workers AI (Llama 3.3 70B) polishes or rewrites template descriptions during creation.  
- **Public Profiles** — Every creator gets a profile page at `/u/<username>` listing their templates.  
- **Live "Times Ranked" Counter** — Real ranking counts per template, shown on cards, search results, and template pages.  
- **Full-text Search** — Search templates by title, description, or individual options.  
- **Podium & Full Results** — Animated podium for the top 3 plus a complete ordered list.  
- **Share & Export** — Download your ranking as an image, share the template link, or post to X (Twitter).  
- **Battle History** — Review every matchup you made during a ranking session.  
- **Undo & Finish Early** — Changed your mind? Undo the last matchup or finish early at any time.  
- **Manual Reorder** — Fine-tune your final ranking by dragging items into position.  
- **Responsive Design** — Fully responsive, looks great on phones, tablets, and desktops.  
- **View Transitions** — Smooth page transitions powered by Astro's View Transitions API.  
- **SEO Optimized** — Dynamic sitemap, proper meta tags, and semantic HTML.  
- **Cookie Consent** — GDPR-compliant cookie consent banner.

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Astro](https://astro.build/) 5 (hybrid: prerendered pages + SSR routes) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) 4 |
| **Language** | TypeScript |
| **Fonts** | [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts) |
| **Icons** | [Font Awesome](https://fontawesome.com/) 6 |
| **Data** | Official templates in `src/data/templates.json` + user templates in [Cloudflare D1](https://developers.cloudflare.com/d1/) |
| **Database** | Cloudflare D1 (users, sessions, templates, ranking counts) |
| **Storage** | [Cloudflare KV](https://developers.cloudflare.com/kv/) (raw tracking event log) |
| **AI** | [Workers AI](https://developers.cloudflare.com/workers-ai/) — Llama 3.3 70B for description suggestions |
| **Auth** | GitHub OAuth + D1-backed sessions |
| **Hosting** | [Cloudflare Workers](https://workers.cloudflare.com/) (static assets + SSR) via `@astrojs/cloudflare` adapter |
| **Package Manager** | [pnpm](https://pnpm.io/) |

## Getting Started

### Prerequisites

- **Node.js** ≥ 18  
- **pnpm** ≥ 8 (install with `npm install -g pnpm` if needed)

### Installation

```bash
# Clone the repository
git clone https://github.com/martinezharo/rankmaker.git
cd rankmaker

# Install dependencies
pnpm install
```

### Database & Auth setup (user accounts + user templates)

User accounts (GitHub OAuth) and user-created templates live in **Cloudflare D1**.

1. Apply the migrations to the local D1 database:

```bash
pnpm run db:migrate:local    # rankings table (times-ranked counts)
pnpm run db:migrate3:local   # users, sessions, templates, template_options (+ RANKMAKER seed)
```

2. Create a **dev GitHub OAuth App** at <https://github.com/settings/developers>:
   - Homepage URL: `http://localhost:4321`
   - Authorization callback URL: `http://localhost:4321/api/auth/callback`

3. Create a `.dev.vars` file (gitignored) in the project root:

```ini
GITHUB_CLIENT_ID=<dev oauth app client id>
GITHUB_CLIENT_SECRET=<dev oauth app client secret>
SESSION_SECRET=<any random 32+ char string>
```

For production, create a second OAuth App with the live callback URL
(`https://rankmaker.net/api/auth/callback`) and set the secrets once:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
pnpm run db:migrate:remote
pnpm run db:migrate3:remote
```

### Development

```bash
# Start the dev server (http://localhost:4321)
# Local D1/KV/AI bindings are emulated via miniflare automatically
pnpm dev
```

### Build

```bash
# Build for production
pnpm build

# Preview the production build locally
pnpm preview
```

## Ranking Tracking & Counts

Whenever a user clicks "Start Ranking", the **`/api/track`** endpoint records the event twice:

- A row in the **D1 `rankings` table**, which powers the live **"Times Ranked" counters** shown across the site (aggregated per template slug).
- A raw entry in **Cloudflare KV** kept as a backup event log.

Counts are read through `/api/counts` and on the SSR homepage, and templates are ordered by popularity.

## Deployment

RANKMAKER deploys to **Cloudflare Workers** (static assets + server-side rendering) using the `@astrojs/cloudflare` adapter. Bindings for D1, KV, and Workers AI are declared in `wrangler.jsonc`.

```bash
# Build the project
pnpm build

# Deploy to Cloudflare
npx wrangler deploy
```

On first deploy, remember to set the production secrets and apply the remote migrations (see [Database & Auth setup](#database--auth-setup-user-accounts--user-templates)).

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <strong><a href="https://olivermartinezharo.com">Oli</a></strong>
</p>

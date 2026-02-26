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
  <a href="#project-structure">Project Structure</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## What is RANKMAKER?

RANKMAKER is a web application that lets users build precise, personalized rankings through fast **1-on-1 matchups**. Instead of dragging items into broad tiers, users are presented with head-to-head battles and their choices are compiled into an ordered ranking using an efficient sorting algorithm.

Pick a template — movies, music, sports, anime, food, and many more — and let the battles decide what *really* comes out on top.

## Demo

> **Live site:** [rankmaker.net](https://rankmaker.net)

## Features

- **1v1 Battle System** — Fast, tap-friendly matchup interface that minimizes decision fatigue.  
- **Smart Sorting Algorithm** — Generates accurate rankings from the fewest comparisons possible.  
- **Pre-built Templates** — Across 18 categories: Movies, Music, Sports, Games, TV, Anime, Food, and more.  
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
| **Framework** | [Astro](https://astro.build/) 5 (static output) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) 4 |
| **Language** | TypeScript |
| **Fonts** | [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts) |
| **Icons** | [Font Awesome](https://fontawesome.com/) 6 |
| **Data Source** | Local JSON file (`src/data/templates.json`) |
| **Hosting** | [Cloudflare Pages](https://pages.cloudflare.com/) via `@astrojs/cloudflare` adapter |
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

#
### Development

```bash
# Start the dev server (http://localhost:4321)
pnpm dev
```

### Build

```bash
# Build for production
pnpm build

# Preview the production build locally
pnpm preview
```

#
## Project Structure

```
rankmaker/
├── public/                     # Static assets (logos, favicons, images)
│   ├── images/                 # Template cover images
│   ├── RANKMAKER-logo.webp
│   ├── robots.txt
│   └── ...
├── src/
│   ├── components/
│   │   ├── ranking/            # Battle & results components
│   │   │   ├── BattleView.astro
│   │   │   ├── ResultsView.astro
│   │   │   ├── FinishEarlyModal.astro
│   │   │   └── BattleHistoryModal.astro
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── TemplateCard.astro
│   │   ├── CategorySection.astro
│   │   ├── SEOContent.astro
│   │   ├── SmartImage.astro
│   │   └── CookieConsent.astro
│   ├── data/
│   │   └── templates.json      # All template data (auto-generated)
│   ├── layouts/
│   │   └── Layout.astro        # Base HTML layout
│   ├── pages/
│   │   ├── index.astro         # Homepage with category sections
│   │   ├── search.astro        # Template search & filter page
│   │   ├── about.astro         # About page
│   │   ├── contact.astro       # Contact page
│   │   ├── template/
│   │   │   └── [slug].astro    # Dynamic template page (battle + results)
│   │   ├── sitemap.xml.ts      # Dynamic XML sitemap
│   │   └── ...                 # Legal pages (privacy, terms, cookies, etc.)
│   └── styles/
│       └── global.css          # Global styles & Tailwind config
├── astro.config.mjs            # Astro configuration
├── wrangler.jsonc              # Cloudflare Workers config
├── tsconfig.json
├── package.json
└── pnpm-lock.yaml
```

## Deployment

RANKMAKER is configured to deploy on **Cloudflare Pages** using the `@astrojs/cloudflare` adapter.

### Deploy with Wrangler

```bash
# Build the project
pnpm build

# Deploy to Cloudflare
npx wrangler pages deploy dist
```

### Deploy via Cloudflare Dashboard

1. Connect your GitHub repository in the Cloudflare Pages dashboard.
2. Set the **build command** to `pnpm build`.
3. Set the **output directory** to `dist`.
4. Add your environment variables if needed.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <strong>Oli</strong>
</p>

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
3. **Test your changes** locally by running the dev server:
   ```bash
   pnpm dev
   ```
4. **Build the project** to make sure nothing breaks:
   ```bash
   pnpm build
   ```
5. **Commit your changes** following the [commit message](#commit-messages) conventions.
6. **Push** to your fork and open a Pull Request against `main`.

#### Pull Request Checklist

- [ ] My code follows the project's code style.
- [ ] I have tested my changes locally.
- [ ] The build completes without errors (`pnpm build`).
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
| `pnpm build` | Build for production |
| `pnpm preview` | Preview the production build locally |
| `pnpm astro` | Run Astro CLI commands |
| `pnpm run db:migrate:local` | Apply the rankings table migration to local D1 |
| `pnpm run db:migrate3:local` | Apply the users/sessions/templates migrations to local D1 |

## Project Architecture

RANKMAKER is built with **Astro 5** (prerendered pages plus SSR routes via the `@astrojs/cloudflare` adapter), styled with **Tailwind CSS 4**, and deployed on **Cloudflare Workers** with D1, KV, and Workers AI bindings.

### Key Concepts

- **Templates** are ranking topics (e.g., "Best Marvel Movies"). Each template has a list of **options** that users compare in 1v1 battles.
- Templates come from **two sources**: official ones in `src/data/templates.json`, and user-created ones stored in **Cloudflare D1**. `src/lib/templates.ts` merges both behind a single `Template` shape so pages treat them identically — keep that contract intact when changing either side.
- **Battle View** presents two options side by side. The user taps their preference, and the sorting algorithm determines the next matchup.
- **Results View** shows the final ranking with a podium (top 3) and a full ordered list.
- Pages that read D1/KV or sessions opt into SSR with `export const prerender = false`; purely static pages (about, legal) stay prerendered.
- Adding or modifying **official** templates still means editing `src/data/templates.json` directly. User templates are created through the app (`/create`, auth required).

## Code Style

- **Language:** TypeScript is preferred. Use proper types instead of `any` when possible.
- **Components:** All components are Astro (`.astro`) files. Keep them focused and reusable.
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

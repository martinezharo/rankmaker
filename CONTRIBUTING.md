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

The dev server will be available at `http://localhost:4321`.

### Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the local development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview the production build locally |
| `pnpm astro` | Run Astro CLI commands |

## Project Architecture

RANKMAKER is built with **Astro 5** using static site generation, styled with **Tailwind CSS 4**, and deployed on **Cloudflare Pages**.

```
src/
├── components/         # Reusable Astro components
│   └── ranking/        # Battle & results components
├── data/               # Static template data (JSON)
├── layouts/            # Base page layout
├── pages/              # File-based routing
│   └── template/       # Dynamic [slug] routes
└── styles/             # Global CSS
```

### Key Concepts

- **Templates** are ranking topics (e.g., "Best Marvel Movies"). Each template has a list of **options** that users compare in 1v1 battles.
- **Battle View** presents two options side by side. The user taps their preference, and the sorting algorithm determines the next matchup.
- **Results View** shows the final ranking with a podium (top 3) and a full ordered list.
- Template data is stored in a static JSON file at `src/data/templates.json`. To add or modify rankings, this file must be updated directly.

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

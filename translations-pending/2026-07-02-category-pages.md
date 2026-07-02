# Category pages — translation handoff

## Feature

Indexable per-category pages at `/category/[slug]` (e.g. `/category/movies`,
`/category/history-culture`). Each page has its own unique `<title>` and
`<meta description>` and lists every template in that category, with
cross-links to all other category pages. This multiplies the indexable
surface with legitimate, non-thin content and reinforces internal linking
to templates.

## New i18n keys (English source of truth)

Added under the `category` object in `src/i18n/locales/en.ts`:

| Key                  | English value                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `category.title`               | `{category} Templates — RANKMAKER`                                                       |
| `category.metaDescription`     | `Browse all {category} ranking templates on RANKMAKER. Rank your favorites head-to-head and share your results.` |
| `category.heading`             | `{category} Templates`                                                                   |
| `category.subtitle`            | `All {category} templates on RANKMAKER — rank your favorites head-to-head.`              |
| `category.browseAll`           | `Browse all templates`                                                                   |
| `category.otherCategories`     | `Other categories`                                                                       |
| `category.notFoundTitle`       | `Category not found`                                                                     |
| `category.notFoundBody`        | `That category doesn't exist. Browse all templates instead.`                             |

Notes:
- `{category}` is interpolated at runtime with the already-translated
  category name from `categories.<Name>` (e.g.
  `t('category.title', { category: t('categories.Movies') })`). So the
  category-name keys under the existing `categories` object must also be
  translated for these strings to render fully localized.
- `category.title` and `category.metaDescription` should keep the
  `— RANKMAKER` brand suffix and the word "RANKMAKER" untranslated.

## Instructions for the translator AI

Add real translations for every key above to each of these locale files:

- `src/i18n/locales/es.ts`
- `src/i18n/locales/fr.ts`
- `src/i18n/locales/de.ts`
- `src/i18n/locales/ms.ts`
- `src/i18n/locales/zh.ts`

Rules (from `CLAUDE.md`):
- Only add the keys this feature actually translates — never add placeholder
  copies of the English value just to fill a key.
- Every key in a locale file is optional (`LocaleDict`); missing keys fall
  back to English at runtime, so the build passes without touching these
  files.
- Keep `{category}` and `RANKMAKER` untranslated. Translate the descriptive
  prose naturally for each language.
- After editing, run `pnpm check` and `pnpm build` to confirm no regressions.

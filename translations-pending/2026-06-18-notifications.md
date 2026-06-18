# Translation handoff — Notifications feature

**Date:** 2026-06-18
**Feature:** In-app notifications + notification emails.

## What it is

Users now get notifications for three events:

1. **`comment_on_template`** — someone comments on a template they own.
2. **`comment_reply`** — someone replies to one of their comments.
3. **`new_template`** — someone they follow publishes a new public template.

There's a new `/notifications` page (chronological, grouped into day blocks with
times, filterable by the three types, with an opt-out toggle for emails), a
badge with the unread count on the header profile button, and a "Notifications"
entry in the profile dropdown. Emails (via Resend) are sent only for the two
**direct** kinds (`comment_on_template`, `comment_reply`).

All English copy is final in `src/i18n/locales/en.ts`. The other five locale
files (`es.ts`, `fr.ts`, `de.ts`, `ms.ts`, `zh.ts`) currently contain **English
placeholders** for every key below (except `nav.notifications`, already added)
and need real translations.

## Instructions for the translator AI

For each locale file (`es`, `fr`, `de`, `ms`, `zh`), translate the **values**
of the keys listed below into that language. Keep:

- the key names and object structure exactly as-is;
- the `{actor}`, `{title}` and `{url}` placeholders verbatim (do not translate
  or reorder them away — they're interpolated at runtime);
- the curly quotes `“ ”` around `{title}` (or substitute the locale's
  conventional quotation marks);
- "RANKMAKER" as a brand name (untranslated);
- tabs for indentation (this codebase uses tabs in source files).

### `nav` namespace

| Key | English |
|-----|---------|
| `nav.notifications` | Notifications |

### `notifications` namespace

| Key | English |
|-----|---------|
| `title` | Notifications — RANKMAKER |
| `heading` | Notifications |
| `subtitle` | Comments on your templates, replies to you, and new templates from people you follow. |
| `loginRequired` | Log in to see your notifications. |
| `login` | Log in |
| `empty` | You're all caught up — nothing here yet. |
| `filterAll` | All |
| `filterComments` | On my templates |
| `filterReplies` | Replies |
| `filterTemplates` | New templates |
| `today` | Today |
| `yesterday` | Yesterday |
| `newBadge` | New |
| `msgCommentOnTemplate` | {actor} commented on your template “{title}” |
| `msgCommentReply` | {actor} replied to your comment on “{title}” |
| `msgNewTemplate` | {actor} published a new template: “{title}” |
| `emailPrefHeading` | Email notifications |
| `emailPrefDesc` | Email me about comments on my templates and replies to my comments. |
| `emailPrefToggle` | Toggle notification emails |
| `emailPrefError` | Couldn't update your preference. Try again. |

### `email` namespace

> Note: emails are currently always sent in **English** (we don't store a
> per-user locale). These keys still live in every locale file for consistency
> and a future per-user-locale switch — translate them anyway.

| Key | English |
|-----|---------|
| `email.cta` | View on RANKMAKER |
| `email.footer` | You received this because notification emails are on for your account. Manage them at {url} |
| `email.commentOnTemplate.subject` | New comment on your template |
| `email.commentOnTemplate.heading` | New comment on “{title}” |
| `email.commentOnTemplate.intro` | {actor} commented on your template “{title}”. |
| `email.commentReply.subject` | {actor} replied to your comment |
| `email.commentReply.heading` | You have a new reply |
| `email.commentReply.intro` | {actor} replied to your comment on “{title}”. |

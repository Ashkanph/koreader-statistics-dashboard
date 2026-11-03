---
name: koreader-data
description: Reference for the data in KOReader's statistics.sqlite3 - tables, the page_stat view, how and when KOReader writes rows, which columns are stale, metadata quirks ("N/A", NUL bytes), and the exact formulas KOReader uses for its own numbers. Use before writing or changing any SQL in src/lib/db.ts, adding a new statistic or chart, explaining why a number differs from what KOReader shows, or handling another KOReader file (e.g. covers from bookinfo_cache.sqlite3).
---

# KOReader statistics data

Source of truth: KOReader's `plugins/statistics.koplugin/` (`main.lua`, `readerprogress.lua`,
`calendarview.lua`) at https://github.com/koreader/koreader. The details below summarize the
schema version **20221111** (`PRAGMA user_version`). Read [reference.md](reference.md) for
the full schema, write path and formulas.

## Rules that matter most

1. **Query the `page_stat` view, not `page_stat_data`,** for anything per page: durations,
   `count(DISTINCT page)`, per-day pages. The view rescales page numbers to the book's
   _current_ page count, so numbers match KOReader's screens. Use `page_stat_data` only
   when you need raw rows (KOReader's daily timeline does).
2. **Don't trust the cached columns** `book.total_read_time` and `book.total_read_pages`. They're
   only updated when KOReader flushes, and they can be stale or 0. Compute from `page_stat`.
   `book.pages` is the page count at the last flush, and it changes with font size and
   layout.
3. **Timestamps are Unix seconds (UTC); KOReader groups by local time** (`'localtime'` in SQL).
   This app buckets in JS with the browser's time zone (`src/lib/dates.ts`). Never use
   `date(start_time, 'unixepoch')` without `'localtime'`.
4. **Missing metadata is stored as the string `"N/A"`** (authors, series, language). Older rows
   may have `''` for authors, and PDF titles/authors can end in `\0`. Normalize with `text()`
   in `db.ts`.
5. **A book is identified by `(title, authors, md5)`** (unique index). `md5` is KOReader's
   _partial_ MD5 of the file, not a full hash. Editing a book's metadata in KOReader rewrites
   `title`/`authors` in place.
6. **Not in this database:** the "finished"/"on hold" status and ratings (they live in each
   book's sidecar `.sdr/metadata.*.lua`, under `summary.status`), covers
   (`settings/bookinfo_cache.sqlite3`, from the cover browser plugin), collections, and the
   plugin settings `min_sec`/`max_sec` (in `settings.reader.lua`, defaults 5 s and 120 s).
   Assume the defaults and say so when a formula needs them.
7. **Durations are already clamped when written.** Page views shorter than `min_sec` are
   dropped, and longer than `max_sec` are stored as `max_sec`. Time while the device is suspended
   isn't counted. So a single row's `duration` is normally `<= 120`.

## Checklist for a new statistic

- Find how KOReader computes the same thing (see "KOReader's own formulas" in reference.md)
  and match it, or name the difference in the UI footnote.
- Decide whether it's uncapped total time (KOReader's "Total time spent") or capped time
  ("Time spent reading", `min(sum(duration), max_sec)` per page).
- Handle books with `pages = 0` or `NULL`, `highlights`/`notes` = `NULL` (a 2020 bug), and
  books with no `page_stat` rows (opened but never read; the app hides them).
- Add a fixture case in `.claude/skills/verify-app/scripts/fixtures.mjs` and a check in
  `verify.mjs`, then run the `verify-app` skill.

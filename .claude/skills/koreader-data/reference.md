# KOReader statistics reference

Summarized from `plugins/statistics.koplugin/main.lua` (DB_SCHEMA_VERSION 20221111). When in
doubt, re-read the upstream source; this file isn't a copy of it.

## File location

`<koreader dir>/settings/statistics.sqlite3`, e.g. `/mnt/us/koreader/settings/` (Kindle),
`/mnt/onboard/.adds/koreader/settings/` (Kobo), `/sdcard/koreader/settings/` (Android).
KOReader opens it in WAL mode when the device supports it, so a copy taken while KOReader is
running may have unflushed data in `statistics.sqlite3-wal`. sql.js can't read WAL, so
`db.ts` patches header bytes 18/19 to 1 and reads only the main file.

## Schema

### `book`

| column                                | notes                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `id`                                  | integer PK autoincrement                                                     |
| `title`                               | `doc_props.display_title`: metadata title, or the file name if there is none |
| `authors`                             | `"N/A"` if unknown (`''` in rows from before June 2021)                      |
| `notes`, `highlights`                 | counts at last flush; can be `NULL` for some 2020 rows                       |
| `last_open`                           | Unix time of the last flush while the book was open                          |
| `pages`                               | page count at last flush (changes with layout/font size)                     |
| `series`                              | `"Name #index"`, or `"N/A"`                                                  |
| `language`                            | metadata language, or `"N/A"`                                                |
| `md5`                                 | partial MD5 of the file (`util.partialMD5`)                                  |
| `total_read_time`, `total_read_pages` | cache of the uncapped totals; stale between flushes                          |

Unique index: `book_title_authors_md5 ON book(title, authors, md5)`.

### `page_stat_data` (raw rows)

| column        | notes                                       |
| ------------- | ------------------------------------------- |
| `id_book`     | → `book.id`                                 |
| `page`        | page number _in the layout at the time_     |
| `start_time`  | Unix time the page was shown                |
| `duration`    | seconds on the page (clamped, see below)    |
| `total_pages` | book page count _when the row was recorded_ |

`UNIQUE (id_book, page, start_time)`, index on `start_time`.

### `numbers` and the `page_stat` view

`numbers` holds 1..1000 and is only used to multiply rows in the view. `page_stat` maps each
raw row to the **current** page count (`book.pages`):

```
first_page = ((page - 1) * pages) / total_pages + 1
last_page  = max(first_page, (page * pages) / total_pages)
-> one row per page in first_page..last_page, duration / (last_page - first_page + 1)
```

(integer division). If the book now has more pages than when it was read, one old page becomes
several new pages with the duration split between them. If it has fewer, several old pages
collapse onto one. Summing `duration` from the view loses a few seconds to integer division
compared with `page_stat_data`. That's expected, and it's what KOReader shows.

### Schema history

- `< 20201010`: `page_stat` was a **table** (`id_book, page, start_time, period`), and there was
  no `page_stat_data`. The app rejects these files with an "old format" message.
- `20201010`: `page_stat_data` table and `page_stat` view introduced; `info` table dropped.
- `20201022`: index `page_stat_data_start_time`.
- `20221111`: duplicate books merged; `(title, authors, md5)` made unique (for cloud sync).

## How rows get written

- On each page turn, the previous page's duration is `now - shown_at`. It's **dropped if
  `< min_sec`** (default 5) and **capped at `max_sec`** (default 120).
- Suspending the device pauses tracking; the pause is added to the current page's start time,
  so it isn't counted.
- Rows are flushed to the DB (`insertDB`) every 50 page turns, on close, on suspend, on the
  periodic settings save, and before showing any statistics screen. Flushing also updates
  `book.pages`, `last_open`, `notes`, `highlights` and the cached totals.
- After a re-layout (font size change), the pending rows are flushed with the _old_ page count
  first, so `total_pages` always matches the layout the row was recorded in.
- A book whose status is "complete" with "Freeze statistics of finished books" enabled gets
  no new rows.
- Cloud sync merges databases from several devices: books are matched by
  `(title, authors, md5)`, and duplicate rows keep `MAX(duration)`.
- Users can delete stats per book, per day, or for "books read < N minutes". Gaps in the data
  are normal.

## KOReader's own formulas

These are the "Current book" / "Book stats" screens in `main.lua`. "Local day" means
`strftime('%Y-%m-%d', start_time, 'unixepoch', 'localtime')`.

| shown as                      | computed as                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Total time spent on this book | `sum(duration)` from `page_stat` for the book (uncapped)                                                      |
| Time spent reading            | `sum(min(sum(duration), max_sec))` grouped by page (capped per page)                                          |
| Pages read                    | `count(DISTINCT page)` from `page_stat`                                                                       |
| Days reading this book        | count of distinct local days                                                                                  |
| Average time per day          | capped time / days                                                                                            |
| Average time per page         | capped time / pages read (while reading it also includes unflushed pages)                                     |
| Time to read rest             | `(total_pages - current_page) * avg_time_per_page`                                                            |
| Book start date               | `min(start_time)`                                                                                             |
| Last read page                | max page among rows with the latest `start_time`                                                              |
| Today / this session          | rows with `start_time >= local midnight` / `>= session start`; pages = count of `(id_book, page)` groups      |
| Daily/weekly/monthly lists    | `strftime('%Y-%m-%d' / '%Y-%W' / '%Y-%m', …, 'localtime')`; pages = count of `(id_book, page, period)` groups |
| Calendar hourly histogram     | `sum(duration)/3600` per local day and hour (optionally shifted by the "day starts at" setting)               |

This app currently uses the **uncapped** total for "Total reading time" and time per page,
matching "Total time spent on this book".

## Related files that aren't in the statistics DB

- **Finished status:** `<book>.sdr/metadata.<ext>.lua` → `summary.status` (`"reading"`,
  `"abandoned"`/on hold, `"complete"`) and `summary.modified` (date). The sidecar may instead be in
  `koreader/docsettings/` or a hash-based folder, depending on the user's setting.
- **Covers:** `settings/bookinfo_cache.sqlite3` (cover browser plugin) has per-file metadata
  and a compressed cover thumbnail stored in KOReader's own image format. Check
  `plugins/coverbrowser.koplugin/bookinfomanager.lua` for the exact schema and image encoding
  before implementing; it isn't verified here.

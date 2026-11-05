# KOReader Statistics Dashboard

A dashboard for the reading statistics that [KOReader](https://github.com/koreader/koreader/) records on your e-reader. Open your `statistics.sqlite3` file and see your reading time, pages, streaks and reading pace as charts.

No server, no backend, no tracking: the file is read in your browser and never uploaded.

You check it online here: https://ashkanph.github.io/koreader-statistics-dashboard/

![The dashboard with example data: stat tiles for books, reading time and streaks, and a weekly reading time chart](https://ashkanph.github.io/koreader-statistics-dashboard/og-image.png)

## What you'll see

- **Overview:** books, fully read books, total reading time, pages read, reading days, averages, your biggest reading day, longest and current streak, highlights and notes.
- **Reading time:** per day, week or month, by hour of the day and by weekday.
- **Reading pace:** how quickly you got through each book you finished.
- **Reading periods:** when you started and last read each book, on one timeline.
- **Every book:** a searchable, sortable table, and a page for each book with its own statistics and charts.

Don't use KOReader, or just curious? Click **Try with example data** on the [start page](https://ashkanph.github.io/koreader-statistics-dashboard/).

## Using your own statistics

1. Copy `statistics.sqlite3` from your e-reader. It's in KOReader's `settings` folder, for example:
   - PocketBook: `applications/koreader/settings/statistics.sqlite3`
   - Android: `koreader/settings/statistics.sqlite3` in the device's internal storage
2. Open the [dashboard](https://ashkanph.github.io/koreader-statistics-dashboard/) and drop the file on the page, or click **Choose file**.

### Why some numbers differ from KOReader

- **Fully read** means at least 95% of a book's pages have reading time recorded. KOReader's own "finished" status is stored in each book's metadata file, which isn't part of the statistics database.
- **Pages** are KOReader's pages, not the printed book's. They depend on the screen, font and margins, so the same book can have a different page count on another device or after a font change.
- **Highlights and notes** are counts only. The statistics database doesn't contain their text.

## Development

```bash
git checkout dev

npm install
npm run dev       # development server
npm run build     # type-check and build into dist/
npm run preview   # serve the built dist/
npm run lint      # ESLint
npm run format    # Prettier
npm run verify    # build, then test in headless Chromium (screenshots in .verify/)


python3 test-data/make_test_db.py OUTPUT.sqlite3 # generates sample databases
```

Built with assistance from **Claude**.

### Technologies

- React, TypeScript and Vite.
  - Requires Node.js 20.19 or newer (for Vite 8).
- The database is read with [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly)
- The charts are hand-made SVG.
- It supports browsers from 2020 on (Chrome/Edge 80, Firefox 72, Safari 13.1).

## License

[Apache License 2.0](LICENSE)

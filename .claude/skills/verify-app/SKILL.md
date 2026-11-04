---
name: verify-app
description: Build the dashboard and check it end-to-end in headless Chromium - error messages for bad files, stat values, every viewport (desktop/tablet/mobile) in light and dark, keyboard access, page overflow, console errors, and that nothing is sent to other sites. Use after any UI, styling, data-loading or stats change, before saying a change works, or when asked to test, verify, screenshot or check the app.
---

# Verify the app

Run from the repo root:

```bash
npm run verify                          # build + full run (~1 min)
npm run verify -- --quick               # desktop only, for fast iteration
npm run verify -- --db path/to/statistics.sqlite3   # also load a real export
```

`npm run verify` runs `npm run build` and then `scripts/verify.mjs`. To re-run the checks
without rebuilding (e.g. after editing only `verify.mjs` or `fixtures.mjs`), run
`node .claude/skills/verify-app/scripts/verify.mjs`. It then tests the existing `dist/`.

## What it does

1. Generates fixtures into `.verify/fixtures/` with `scripts/fixtures.mjs`. They use KOReader's
   real schema, in WAL mode like on-device files, with dates relative to today:
   - `statistics.sqlite3`: 7 read books and 1 that was never read. Includes a 100% book, a
     97% book (counts as finished with the app's >95% rule), "N/A" metadata, a title with a
     trailing NUL, de/fr books, a very long title, and a book read every day up to today.
   - `not-a-database.sqlite3`, `other.sqlite3`, `old-schema.sqlite3`, `empty.sqlite3`: each
     must show its specific error message.
2. Serves `dist/` with `vite preview` and drives it with Playwright (Chromium, `en-US` locale).
3. Checks that the Books/Pages read tiles match values computed directly from the fixture with
   SQL, plus table rows, title cleanup, current streak, focus moving to the `h1`, no horizontal
   overflow, no console errors, and **no requests to other origins** (the app promises the
   data never leaves the device). It also checks the theme switch and that it persists, sorting
   (`aria-sort`), chart keyboard announcements, search, and the unknown-book route.
4. Checks support for browsers from 2020 (see "Browser support" in CLAUDE.md), because headless Chromium is current and wouldn't notice on its own. `scripts/browser-support.mjs` parses `dist/` JS as ES2020 and flags newer syntax, regexes and built-ins, plus unsupported CSS selectors. A run with `WebAssembly.validate` stubbed to `false` must load through the asm.js build of sql.js, with the `.no-flex-gap` margin fallback on (`legacy-mobile-light.png`). If an API match is a false positive, document why in `ALLOWED_APIS`.
5. Writes `.verify/screenshots/*.png` and `.verify/report.json`, and exits 1 if any check fails.

## How to use the results

- A `FAIL` line names the check and shows what it got. Fix the code, not the check, unless the
  change in behavior was intended (e.g. the user changed a rule); then update the check in
  `verify.mjs` in the same change.
- **Always look at the screenshots** (`Read` the PNGs) for anything visual. The checks catch
  overflow and errors, not ugly layouts, overlapping labels or wrong colors. At minimum look at
  `dashboard-desktop-light.png`, `dashboard-mobile-dark.png` and the book page for the area
  you changed.
- When you add a feature, add a check for it in `verify.mjs`, and add fixture data in
  `fixtures.mjs` if the feature needs a case the fixture doesn't cover yet. Keep the PRNG seed
  fixed so the runs stay comparable.
- Report to the user how many checks passed and anything that failed. Don't claim a UI
  change works without having run this.

## Troubleshooting

- `browserType.launch: Executable doesn't exist`: run `npx playwright install chromium`
  (the Chromium version is tied to the `playwright` devDependency).
- Port 4318 in use: Vite picks the next free port automatically. The script reads the
  actual URL.
- A `--db` file from a real device may be missing recent reading if KOReader was running when
  it was copied: unflushed data sits in `statistics.sqlite3-wal`, which the app doesn't read.

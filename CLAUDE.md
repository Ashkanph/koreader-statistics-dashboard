# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A client-only web dashboard for KOReader's reading statistics. The user drops or chooses their `statistics.sqlite3` file (from KOReader's `settings/` folder). It's read entirely in the browser with sql.js (SQLite compiled to WebAssembly); there is no backend, and the data is never uploaded or persisted. The README is still the stock Vite template README.

## Architecture

- **Data loading (`src/lib/db.ts`)**: lazily imports sql.js and its `.wasm` (via `?url`), checks the SQLite header, and forces header bytes 18/19 to 1 because KOReader databases are usually in WAL mode, which sql.js can't open. It then reads everything once into a `Library` (`src/lib/types.ts`): `books` (only those with reading activity) and `events` (sorted by start time). Failures throw `DatabaseError`, whose message is shown to the user as-is.
- **KOReader schema**: the source of truth is the KOReader `statistics.koplugin` source (`main.lua`). The tables are `book` and `page_stat_data`. `page_stat` is a view that rescales page numbers to the book's current page count. Query `page_stat` (not `page_stat_data`) for durations and `count(DISTINCT page)` so the numbers match what KOReader shows. `book.total_read_time`/`total_read_pages` are a cache and can be stale, so they're not used. KOReader stores `"N/A"` for missing metadata, and `text()` in `db.ts` normalizes it to `null`. Databases older than schema 20201010 (no `page_stat_data`) are rejected.
- **Derived stats (`src/lib/stats.ts`, `src/lib/dates.ts`)**: everything is computed in JS from `events`, bucketed in the browser's local time zone (KOReader's SQL uses `'localtime'`). Weeks start on Monday. A book counts as "fully read" when `readPages >= pages`; KOReader's own "finished" status lives in sidecar files, not the database.
- **Pages**: `App.tsx` holds the loaded `Library` in state. Without one it renders `FileDrop` whatever the route. `FileDrop` also has a "Try with example data" button, which fetches `public/example-statistics.sqlite3` from the same origin and loads it like an uploaded file (`openExample` in `App.tsx`). Routing is hash-based (`src/lib/router.ts`: `#/` and `#/book/:id`). `Dashboard` and `BookPage` both use the same `StatTiles` + `ReadingCharts` components; the book page just passes that book's events. Pages call `useFocusOnMount` on their `h1` so focus moves on navigation.
- **Reading pace charts (`src/components/ProgressChart.tsx`)**: one line per book above 95%, built from `Library.firstReads` (the first time each distinct page was read) by `progressCurves()` in `stats.ts`. Curves stay flat on days without reading. The chart uses emphasis rather than one color per book (too many books for a categorical palette): all lines share the series color, and the hovered or pinned book is highlighted while the rest turn gray. The legend and the lines highlight each other. `InfoTip.tsx` is the reusable "?" panel (opens on mouse hover, click or tap pins it, Escape or a click outside closes it, and it shifts sideways to stay on screen). Stat tiles take an optional `info` that shows one in the tile's bottom corner. The texts live in `src/lib/statInfo.ts`.
- **Reading periods timeline (`src/components/TimelineChart/`)**: dashboard only. One row per book (`bookSpans()` in `stats.ts`, sorted by start). A light bar spans the first to last reading day, with a solid mark for each day of reading. Days are at least 6px wide, so long histories scroll sideways inside the chart's own box, which also scrolls vertically, with the date axis and title column pinned using `position: sticky`. It opens scrolled to the most recent end. Rows use the categorical palette `--cat-1…8` (in `index.css`, light and dark) in a repeating order. That's acceptable because each row is labeled with its title, so the color only separates neighboring rows and doesn't identify the book. The title links go to the book page, and focusing one scrolls to its bar and shows the tooltip.
- **Charts (`src/components/BarChart.tsx`)**: hand-rolled responsive SVG (no chart library). Each chart has hover and keyboard tooltips (arrow keys plus a live region) and a `<details>` data table. They follow the dataviz skill's specs: single-series bars capped at 24px wide, with a 4px rounded top, a 2px gap, and no legend.
- **Icons (`src/assets/stat-icons.svg`, `src/components/Icon.tsx`)**: one SVG sprite of 24×24 outline `<symbol>`s with `stroke="currentColor"`, used via `<use href>`, so the whole set costs a single cached request. It's imported with `?url&no-inline` because Vite would otherwise inline the small file as a `data:` URL, which `<use>` can't reference. When you add a symbol, add its id to the `IconName` union too. Stroke styling must be set as attributes on each `<symbol>`, not in a `<style>` block, which isn't applied reliably through an external `<use>`. `public/icons.svg` is an unused leftover from the Vite template. The app logo is `public/favicon.svg`; `AppLogo.tsx` reuses it in the header and on the home page. `public/apple-touch-icon.png` (180×180) is a raster copy of it with square corners, because iOS rounds the corners itself. Re-render it whenever the logo changes.
- **Theming (`src/index.css`, `src/lib/theme.ts`)**: CSS custom properties. Dark values are declared both under `prefers-color-scheme: dark` (guarded by `:not([data-theme='light'])`) and under `[data-theme='dark']`, so keep the two blocks in sync. The preference (system/light/dark) is stored in `localStorage` under `theme`, and an inline script in `index.html` applies it before first paint.

## Browser support

The app supports browsers released from 2020 on: Chrome/Edge 80, Firefox 72, Safari 13.1 (iOS 13.4). The targets are set in `vite.config.ts` (`build.target` and `cssTarget`).

- **The build rewrites these automatically:** newer JS syntax (`?.`, `??=`, class fields, …), CSS nesting, logical shorthands (`padding-inline` → longhands) and `inset`.
- **These can't be rewritten, so don't use them:** `:has()`, `:where()`/`:is()`, `aspect-ratio`, the CSS `translate` property, `Blob.arrayBuffer()` (use `new Response(blob).arrayBuffer()`), `Intl` `dateStyle` (spell the options out), `.at()`, `structuredClone`, `Object.hasOwn`, `replaceAll`.
- **These need fallbacks:**
  - `min()`/`clamp()` (Firefox 75): put a plain declaration before each, or use an `@supports not` block where Lightning CSS merges the fallback away.
  - `:focus-visible`: anything that relies on it for a focus ring also needs a `:focus` rule, plus a `:focus:not(:focus-visible)` rule that undoes it for mouse clicks.
  - Flex `gap` (Chrome 84, Safari 14.1): an inline script in `index.html` adds `.no-flex-gap`, and the "Older browsers" block at the end of `index.css` gives margins instead. A new flex container with `gap` needs an entry there.
- **The app is left-to-right only**, so use `left`/`right` rather than `inset-inline-*`. Lightning CSS turns those into hundreds of `:lang()` selectors.
- **sql.js** (`db.ts`): the WebAssembly build needs `BigInt64Array` (Safari 15) and newer WebAssembly instructions. `loadSqlJs()` checks for both and otherwise loads the asm.js build (`sql.js/dist/sql-asm.js`, 1.3 MB, slower). The build warns that it externalizes `node:fs`/`node:crypto` for that file. Those are only used under Node.js and are harmless.
- `npm run verify` checks `dist/` for unsupported syntax, APIs and selectors (`scripts/browser-support.mjs` in the verify skill). It also runs the app with the WebAssembly build rejected and `.no-flex-gap` on.

## Commands

- `npm run dev`: Vite dev server with HMR
- `npm run build`: type-checks with `tsc -b` (project references), then runs `vite build` into `dist/`
- `npm run lint` / `npm run lint:fix`: ESLint (flat config in `eslint.config.js`)
- `npm run format` / `npm run format:check`: Prettier (`.prettierrc.json`: no semicolons, single quotes, trailing commas, width 100)
- `npm run preview`: serves the built `dist/`

- `npm run verify` (or `npm run verify -- --quick`): builds, then checks the app end to end in headless Chromium and writes screenshots to `.verify/` (see the `verify-app` skill)

There are no unit tests yet. Project skills live in `.claude/skills/`: `verify-app` (end-to-end checks and screenshots) and `koreader-data` (KOReader database schema, quirks and formulas; consult it before changing SQL or adding statistics).

A Husky pre-commit hook (`.husky/pre-commit`) runs `lint-staged`, which applies `eslint --fix` and `prettier --write` to staged files (config is in `package.json`). ESLint extends `eslint-config-prettier`, so formatting is left entirely to Prettier.

## Stack and config notes

- React 19, Vite 8 (`@vitejs/plugin-react`), TypeScript ~6.0, ESLint 10 with `typescript-eslint`, `react-hooks`, and `react-refresh` (Vite preset).
- TypeScript uses project references: `tsconfig.app.json` covers `src/` (browser code) and `tsconfig.node.json` covers the Vite config. `tsconfig.json` only references the two.
- `tsconfig.app.json` sets the following, which affect how code must be written:
  - `verbatimModuleSyntax`: type-only imports must use `import type`.
  - `erasableSyntaxOnly`: no `enum`, no `namespace`, and no constructor parameter properties.
  - `noUnusedLocals` / `noUnusedParameters`: unused variables and parameters fail the build.
  - `allowImportingTsExtensions`: imports carry their `.tsx`/`.ts` extensions, for example `import App from './App.tsx'`.
- The `react-refresh` lint rule warns when a module exports anything other than components, so keep non-component exports in separate files.

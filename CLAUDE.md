# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A client-only web dashboard for KOReader's reading statistics. The user drops or chooses their `statistics.sqlite3` file (from KOReader's `settings/` folder). It's read entirely in the browser with sql.js (SQLite compiled to WebAssembly); there is no backend, and the data is never uploaded or persisted. The README is still the stock Vite template README.

## Architecture

- **Data loading (`src/lib/db.ts`)**: lazily imports sql.js and its `.wasm` (via `?url`), checks the SQLite header, and forces header bytes 18/19 to 1 because KOReader databases are usually in WAL mode, which sql.js can't open. It then reads everything once into a `Library` (`src/lib/types.ts`): `books` (only those with reading activity) and `events` (sorted by start time). Failures throw `DatabaseError`, whose message is shown to the user as-is.
- **KOReader schema**: the source of truth is the KOReader `statistics.koplugin` source (`main.lua`). The tables are `book` and `page_stat_data`. `page_stat` is a view that rescales page numbers to the book's current page count. Query `page_stat` (not `page_stat_data`) for durations and `count(DISTINCT page)` so the numbers match what KOReader shows. `book.total_read_time`/`total_read_pages` are a cache and can be stale, so they're not used. KOReader stores `"N/A"` for missing metadata, and `text()` in `db.ts` normalizes it to `null`. Databases older than schema 20201010 (no `page_stat_data`) are rejected.
- **Derived stats (`src/lib/stats.ts`, `src/lib/dates.ts`)**: everything is computed in JS from `events`, bucketed in the browser's local time zone (KOReader's SQL uses `'localtime'`). Weeks start on Monday. A book counts as "fully read" when `readPages >= pages`; KOReader's own "finished" status lives in sidecar files, not the database.
- **Pages**: `App.tsx` holds the loaded `Library` in state. Without one it renders `FileDrop` whatever the route. Routing is hash-based (`src/lib/router.ts`: `#/` and `#/book/:id`). `Dashboard` and `BookPage` both use the same `StatTiles` + `ReadingCharts` components; the book page just passes that book's events. Pages call `useFocusOnMount` on their `h1` so focus moves on navigation.
- **Charts (`src/components/BarChart.tsx`)**: hand-rolled responsive SVG (no chart library). Each chart has hover and keyboard tooltips (arrow keys plus a live region) and a `<details>` data table. They follow the dataviz skill's specs: single-series bars capped at 24px wide, with a 4px rounded top, a 2px gap, and no legend.
- **Theming (`src/index.css`, `src/lib/theme.ts`)**: CSS custom properties. Dark values are declared both under `prefers-color-scheme: dark` (guarded by `:not([data-theme='light'])`) and under `[data-theme='dark']`, so keep the two blocks in sync. The preference (system/light/dark) is stored in `localStorage` under `theme`, and an inline script in `index.html` applies it before first paint.

## Commands

- `npm run dev`: Vite dev server with HMR
- `npm run build`: type-checks with `tsc -b` (project references), then runs `vite build` into `dist/`
- `npm run lint` / `npm run lint:fix`: ESLint (flat config in `eslint.config.js`)
- `npm run format` / `npm run format:check`: Prettier (`.prettierrc.json`: no semicolons, single quotes, trailing commas, width 100)
- `npm run preview`: serves the built `dist/`

No test framework is configured yet.

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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

A dashboard for KOReader reading statistics. The project is currently just the Vite + React + TypeScript template: `src/App.tsx` renders an empty fragment and nothing domain-specific exists yet. The README is the stock Vite template README.

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

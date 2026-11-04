// Static checks of dist/ for features that browsers from 2020 (Chrome/Edge 80, Firefox 72,
// Safari 13.1) don't have, and that the build doesn't rewrite. Headless Chromium is current, so
// these would otherwise go unnoticed. See "Browser support" in CLAUDE.md.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'acorn'

/** JavaScript: parsed as ES2020, so ES2021+ syntax (??=, class fields, …) fails to parse. */
function jsProblems(code) {
  let ast
  try {
    ast = parse(code, { ecmaVersion: 2020, sourceType: 'module' })
  } catch (error) {
    return [`syntax newer than ES2020: ${error.message}`]
  }
  const found = new Set()
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return
    if (node.type === 'ChainExpression') found.add('optional chaining ?. (Firefox 74)')
    if (node.type === 'Literal' && node.bigint !== undefined)
      found.add('BigInt literal (Safari 14)')
    if (node.type === 'Literal' && node.regex) {
      const { pattern, flags } = node.regex
      if (/\(\?<[=!]/.test(pattern)) found.add(`regex lookbehind /${pattern}/ (Safari 16.4)`)
      if (/\(\?<[A-Za-z]/.test(pattern)) found.add(`regex named group /${pattern}/ (Firefox 78)`)
      if (/\\[pP]\{/.test(pattern)) found.add(`regex \\p{…} /${pattern}/ (Firefox 78)`)
      if (flags.includes('s')) found.add(`regex s flag /${pattern}/s (Firefox 78)`)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(ast)
  return [...found]
}

// Built-ins newer than the targets. Only unguarded uses matter, so this is a list to review:
// a match needs either a fallback next to it or an entry in ALLOWED_APIS below.
const NEW_APIS = [
  ['.at(', 'Array/String.prototype.at (Chrome 92, Safari 15.4)'],
  ['structuredClone', 'structuredClone (Chrome 98, Safari 15.4)'],
  ['Object.hasOwn', 'Object.hasOwn (Chrome 93, Safari 15.4)'],
  ['.replaceAll(', 'String.prototype.replaceAll (Chrome 85, Safari 13.1, Firefox 77)'],
  ['.findLast', 'Array.prototype.findLast (Chrome 97, Safari 15.4)'],
  ['dateStyle', 'Intl dateStyle (Safari 14.1, Firefox 79)'],
  ['.arrayBuffer()', 'Blob.arrayBuffer (Safari 14) — fine on fetch Responses'],
]
// file → API names reviewed and known to be guarded or not on a Blob.
const ALLOWED_APIS = {
  // Response.arrayBuffer (db.ts) and sql.js's own fetch of its .wasm; both are on Responses.
  '.arrayBuffer()': /^(index|sql-wasm-browser)-/,
}

/** CSS: selectors and functions the build passes through unchanged. */
const CSS_FEATURES = [
  [/:has\(/, ':has() (Chrome 105, Firefox 121, Safari 15.4)'],
  [/:where\(|:is\(/, ':where()/:is() (Chrome 88, Safari 14)'],
  [/(^|[^-])\b(aspect-ratio)\s*:/, 'aspect-ratio (Chrome 88, Safari 15)'],
  [/\b(color-mix|oklch|oklab|lab|lch)\(/, 'modern color functions (2023)'],
  [/@container|@layer/, '@container/@layer (2022)'],
  [/\b(dvh|svh|lvh)\b/, 'dynamic viewport units (2022)'],
  [/(^|[;{])translate\s*:/, 'translate property (Chrome 104, Safari 14.1)'],
]

export function browserSupportProblems(distDir) {
  const assets = join(distDir, 'assets')
  const problems = []
  for (const file of readdirSync(assets)) {
    const text = () => readFileSync(join(assets, file), 'utf8')
    if (file.endsWith('.js')) {
      const code = text()
      for (const p of jsProblems(code)) problems.push(`${file}: ${p}`)
      for (const [needle, label] of NEW_APIS) {
        if (code.includes(needle) && !ALLOWED_APIS[needle]?.test(file)) {
          problems.push(`${file}: uses ${label}`)
        }
      }
    } else if (file.endsWith('.css')) {
      const css = text()
      for (const [re, label] of CSS_FEATURES) {
        if (re.test(css)) problems.push(`${file}: uses ${label}`)
      }
    }
  }
  return problems
}

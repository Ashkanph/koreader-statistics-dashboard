import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Supported browsers: everything released from 2020 on. The build rewrites newer JavaScript
// syntax and CSS (nesting, logical properties, …) for these; newer APIs and selectors that
// can't be rewritten are avoided in the code or have fallbacks (see "Browser support" in
// CLAUDE.md).
const TARGETS = ['chrome80', 'edge80', 'firefox72', 'safari13.1', 'ios13.4']

/** Copies README.md into dist/, so the deployed GitHub Pages branch shows it too. */
function copyReadme(): Plugin {
  return {
    name: 'copy-readme',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'README.md',
        // Next to this config file, whatever directory the build is started from.
        source: readFileSync(new URL('README.md', import.meta.url)),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the build works from any folder: GitHub Pages serves it under
  // /koreader-statistics-dashboard/, previews and other hosts at /. This is safe because routing
  // is hash-based, so the page is always the index.html next to assets/.
  base: './',
  plugins: [react(), copyReadme()],
  build: {
    target: TARGETS,
    cssTarget: TARGETS,
  },
})

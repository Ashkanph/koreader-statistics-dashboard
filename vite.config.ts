import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Supported browsers: everything released from 2020 on. The build rewrites newer JavaScript
// syntax and CSS (nesting, logical properties, …) for these; newer APIs and selectors that
// can't be rewritten are avoided in the code or have fallbacks (see "Browser support" in
// CLAUDE.md).
const TARGETS = ['chrome80', 'edge80', 'firefox72', 'safari13.1', 'ios13.4']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: TARGETS,
    cssTarget: TARGETS,
  },
})

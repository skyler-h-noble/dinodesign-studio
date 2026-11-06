import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Shim Node globals used by the linked @dynodesign/components bundle.
  // The lib's rollup build leaves `process.env.NODE_ENV` references in its
  // output; in production they're typically replaced at the consumer's build
  // step, but the symlinked dev-linked module reaches the browser
  // unsubstituted. Defining it here lets Vite swap it for a literal.
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env': '{}',
  },
  test: {
    /* Vitest STUBS css imports by default, so `?raw` on a .css file resolved
       to an empty string — typography-tokens.css came back as "" in every
       test while working in a real build. A stub is indistinguishable from a
       file with no content, so any test of that pipeline passed on nothing. */
    css: true,
    /* Agent worktrees live under .claude/worktrees and are full copies of the
       repo, often mid-change. Without this the suite (and the pre-commit
       hook) ran every copy's tests too, so one unfinished worktree blocked
       commits in the main checkout. */
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  /* brotli-wasm finds its .wasm with `new URL('brotli_wasm_bg.wasm',
     import.meta.url)`. Pre-bundling moves the module into .vite/deps, where
     that URL points at nothing, so the dev server must serve it as it is. The
     production build resolves the URL and emits the .wasm as an asset. */
  optimizeDeps: {
    exclude: ['brotli-wasm'],
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
})

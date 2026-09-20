import { defineConfig } from 'vitest/config'
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

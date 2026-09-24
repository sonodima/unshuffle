// Builds a frozen snapshot of lab/fix-net.html (other teams' edits can't reload it mid-run).
//   npx vite build --config scripts/fix-net/vite.lab.config.mjs
//   npx vite preview --config scripts/fix-net/vite.lab.config.mjs --port 5459 --strictPort
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
const root = fileURLToPath(new URL('../..', import.meta.url))
export default defineConfig({
  root,
  base: './',
  cacheDir: 'node_modules/.vite-fix-net-lab',
  build: {
    outDir: process.env.LAB_OUT ?? 'scripts/fix-net/lab-dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: { input: { lab: 'lab/fix-net.html' } },
  },
  preview: { host: '127.0.0.1' },
})

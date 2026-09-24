// Isolated dev server for the store lab: same config as the app, but no HMR /
// file watching (other engineers edit files concurrently) and deps pre-bundled
// so the page never reloads mid-test.
import { fileURLToPath } from 'node:url'
import base from '../../vite.config'

export default {
  ...base,
  root: fileURLToPath(new URL('../..', import.meta.url)),
  server: { ...base.server, hmr: false, watch: { ignored: ['**/*'] } },
  optimizeDeps: {
    entries: ['lab/store.html'],
    include: ['peerjs', 'zustand', 'zustand/react/shallow', 'react', 'react-dom/client', 'react/jsx-dev-runtime'],
  },
}

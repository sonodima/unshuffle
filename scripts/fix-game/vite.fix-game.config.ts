// Snapshot build for the fix-game E2E: the app + lab/fix-game.html (store handle on window).
import { fileURLToPath } from 'node:url'
import base from '../../vite.config'

const root = fileURLToPath(new URL('../..', import.meta.url))
export default {
  ...base,
  root,
  build: {
    ...base.build,
    outDir: 'scripts/fix-game/dist',
    emptyOutDir: true,
    rollupOptions: { input: { index: `${root}/index.html`, fixgame: `${root}/lab/fix-game.html` } },
  },
}

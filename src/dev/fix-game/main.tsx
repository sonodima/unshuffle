// fix-game E2E entry: the real app, plus a handle on the store / clock / audio for
// scripted multiplayer checks (scripts/fix-game/e2e.mjs). Never part of the app build.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import App from '../../App.tsx'
import { storeDebug, useGame } from '../../game/store'
import { hostNow } from '../../game/clock'
import { audioEngine } from '../../audio/engine'
import { netDebug } from '../../net/transport'

declare global {
  interface Window {
    __fg: { useGame: typeof useGame; hostNow: typeof hostNow; audioEngine: typeof audioEngine; netDebug: typeof netDebug; storeDebug: typeof storeDebug }
  }
}
window.__fg = { useGame, hostNow, audioEngine, netDebug, storeDebug }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n } from './i18n'

const root = document.getElementById('root')
if (!root) throw new Error('UNSHUFFLE: #root missing in index.html')

// The language is loaded before the app module is evaluated: the store creates the
// player's profile (and its random nickname) as soon as it is imported.
await initI18n()
const { default: App } = await import('./App.tsx')

createRoot(root, {
  onRecoverableError: (error) => console.warn('[react] recoverable error', error),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

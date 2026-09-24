import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('UNSHUFFLE: #root mancante in index.html')

createRoot(root, {
  onRecoverableError: (error) => console.warn('[react] recoverable error', error),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

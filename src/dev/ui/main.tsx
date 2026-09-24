// UI lab: renders the styleguide standalone over an animated CSS gradient
// (a stand-in for the WebGL shader). Served at /lab/ui.html by the dev server.
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { StyleguideScreen } from '../../screens/Styleguide'

const css = `
.lab-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: var(--color-ink-950); }
.lab-bg::before, .lab-bg::after { content: ''; position: absolute; inset: -30%; filter: blur(60px); }
.lab-bg::before {
  background:
    radial-gradient(40% 35% at 20% 25%, rgb(123 92 255 / 0.55), transparent 70%),
    radial-gradient(35% 30% at 80% 20%, rgb(255 63 209 / 0.38), transparent 70%),
    radial-gradient(45% 40% at 70% 85%, rgb(46 230 255 / 0.22), transparent 70%),
    radial-gradient(40% 40% at 15% 90%, rgb(255 63 209 / 0.25), transparent 70%);
  animation: lab-drift 18s ease-in-out infinite alternate;
}
.lab-bg::after {
  background: radial-gradient(120% 90% at 50% 40%, transparent 40%, rgb(6 4 15 / 0.85) 100%);
  inset: 0; filter: none;
}
@keyframes lab-drift {
  0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
  50% { transform: translate3d(4%, -3%, 0) rotate(8deg) scale(1.08); }
  100% { transform: translate3d(-3%, 4%, 0) rotate(-6deg) scale(1.02); }
}
`

function Lab() {
  return (
    <MotionConfig reducedMotion="user">
      <style>{css}</style>
      <div className="lab-bg" aria-hidden />
      <div className="grain-fixed" aria-hidden />
      <StyleguideScreen />
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)

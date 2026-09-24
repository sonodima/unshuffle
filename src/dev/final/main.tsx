// Final screen lab: FinalView over a CSS stand-in for the shader, fed by fixtures.
// Query: v=final|hostwins|tie|solo|duo|zero|crowd|fixture · me=<player id> · celebrate=0 · ui=0
import { MotionConfig } from 'motion/react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import '../../index.css'
import { FinalView } from '../../screens/final/FinalView'
import { LAB_ROOMS } from './fixtures'

const params = new URLSearchParams(location.search)

// ?connected=1 renders the real FinalScreen over a seeded store instead of the bare view.
const connected = params.get('connected') === '1'
const Connected = connected
  ? (await import('./ConnectedLab')).ConnectedLab
  : null

const css = `
.lab-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: var(--color-ink-950); }
.lab-bg::before, .lab-bg::after { content: ''; position: absolute; inset: -30%; filter: blur(60px); }
.lab-bg::before {
  background:
    radial-gradient(40% 35% at 20% 25%, rgb(123 92 255 / 0.55), transparent 70%),
    radial-gradient(35% 30% at 80% 20%, rgb(255 63 209 / 0.38), transparent 70%),
    radial-gradient(45% 40% at 70% 85%, rgb(46 230 255 / 0.22), transparent 70%),
    radial-gradient(40% 40% at 15% 90%, rgb(255 63 209 / 0.25), transparent 70%);
}
.lab-bg::after { background: radial-gradient(120% 90% at 50% 40%, transparent 40%, rgb(6 4 15 / 0.85) 100%); inset: 0; filter: none; }
.lab-bar { position: fixed; top: 8px; right: 8px; z-index: 1000; display: flex; gap: 6px; font: 600 11px/1 var(--font-mono); }
.lab-bar select, .lab-bar button { background: #0008; color: #fff; border: 1px solid #fff3; border-radius: 8px; padding: 6px 8px; }
`

function Lab() {
  const [v, setV] = useState(params.get('v') ?? 'final')
  const [me, setMe] = useState(params.get('me') ?? 'p-host')
  const [key, setKey] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const room = LAB_ROOMS[v] ?? LAB_ROOMS.final
  const push = (s: string) => setLog((l) => [...l.slice(-4), s])
  useEffect(() => {
    ;(window as unknown as { __labLog: string[] }).__labLog = log
  }, [log])
  return (
    <MotionConfig reducedMotion="user">
      <style>{css}</style>
      <div className="lab-bg" aria-hidden />
      <div className="grain-fixed" aria-hidden />
      {params.get('ui') !== '0' && (
        <div className="lab-bar">
          <select value={v} onChange={(e) => { setV(e.target.value); setKey((k) => k + 1) }}>
            {Object.keys(LAB_ROOMS).map((k) => <option key={k}>{k}</option>)}
          </select>
          <select value={me} onChange={(e) => { setMe(e.target.value); setKey((k) => k + 1) }}>
            {room.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => setKey((k) => k + 1)}>replay</button>
          {log.length > 0 && <span style={{ alignSelf: 'center' }}>{log[log.length - 1]}</span>}
        </div>
      )}
      {Connected ? (
        <Connected key={key} room={room} me={me} />
      ) : (
      <FinalView
        key={key}
        room={room}
        me={me}
        celebrate={params.get('celebrate') !== '0'}
        onPlayAgain={() => push('backToLobby')}
        onLeave={() => push('leave')}
        onWinnerLanded={() => push('landed')}
      />
      )}
    </MotionConfig>
  )
}

// Reuse the root if HMR re-executes this module (other people's edits can propagate here).
const w = window as unknown as { __finalLabRoot?: Root }
w.__finalLabRoot ??= createRoot(document.getElementById('root')!)
w.__finalLabRoot.render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)

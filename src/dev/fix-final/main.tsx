// Fix-final lab: the final lab plus extra variants used while fixing QA findings.
// Query: v=<variant> · me=<player id> · celebrate=0 · ui=0
import { MotionConfig } from 'motion/react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import '../../index.css'
import { FinalView } from '../../screens/final/FinalView'
import { LAB_ROOMS, labDuo, labFinal, labSolo } from '../final/fixtures'
import { scoreArrangement } from '../../game/scoring'
import type { RoomState, RoundResult } from '../../game/types'

const params = new URLSearchParams(location.search)

function res(playerId: string, order: number[], timeMs: number, timedOut = false): RoundResult {
  return { playerId, order, ...scoreArrangement(order, order.length), timeMs, timedOut }
}
const MESS = [5, 2, 7, 0, 3, 6, 1, 4]

/** Solo game at 0 points, confirming the untouched board after ~3 s. */
const soloZero: RoomState = {
  ...labSolo,
  players: labSolo.players.map((p) => ({ ...p, score: 0 })),
  results: labSolo.results.map((r) => r.map((x) => res(x.playerId, MESS, 2800))),
}

/** Two players with the e2e-style names. */
const duoNames: RoomState = {
  ...labDuo,
  players: labDuo.players.map((p) => (p.id === 'p-2' ? { ...p, name: 'Miss Aragosta' } : { ...p, name: 'Mister Cantucci' })),
}

/** Five players; Sofi confirms the untouched board after 2-3 s every round (0 points). */
const speedy: RoomState = {
  ...labFinal,
  results: labFinal.results.map((r) => r.map((x) => (x.playerId === 'p-3' ? res('p-3', MESS, 2600) : x))),
}
speedy.players = speedy.players.map((p) => ({ ...p, score: speedy.results.reduce((s, r) => s + (r.find((x) => x.playerId === p.id)?.points ?? 0), 0) }))

/** The 16-W name wins (widest possible headline). */
const longW: RoomState = { ...labFinal, players: labFinal.players.map((p) => (p.id === 'p-2' ? { ...p, name: 'WWWWWWWWWWWWWWWW' } : p.id === 'p-3' ? { ...p, name: 'Massimiliano XVI' } : p)) }

const ROOMS: Record<string, RoomState> = { ...LAB_ROOMS, soloZero, duoNames, speedy, longW }

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
.lab-bar { position: fixed; top: 8px; left: 8px; z-index: 1000; display: flex; gap: 6px; font: 600 11px/1 var(--font-mono); }
.lab-bar select, .lab-bar button { background: #0008; color: #fff; border: 1px solid #fff3; border-radius: 8px; padding: 6px 8px; }
`

function Lab() {
  const [v, setV] = useState(params.get('v') ?? 'final')
  const [me, setMe] = useState(params.get('me') ?? 'p-host')
  const [key, setKey] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const room = ROOMS[v] ?? ROOMS.final
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
            {Object.keys(ROOMS).map((k) => <option key={k}>{k}</option>)}
          </select>
          <select value={me} onChange={(e) => { setMe(e.target.value); setKey((k) => k + 1) }}>
            {room.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => setKey((k) => k + 1)}>replay</button>
          {log.length > 0 && <span style={{ alignSelf: 'center' }}>{log[log.length - 1]}</span>}
        </div>
      )}
      <FinalView
        key={key}
        room={room}
        me={me}
        celebrate={params.get('celebrate') !== '0'}
        onPlayAgain={() => push('backToLobby')}
        onLeave={() => push('leave')}
        onWinnerLanded={() => push('landed')}
        onRematch={params.get('rematch') === '1' ? () => push('rematch') : undefined}
        rematchFrom={params.get('rematch') === '1' ? ['p-2', 'p-3', 'p-4'].slice(0, Number(params.get('asks') ?? 2)) : undefined}
      />
    </MotionConfig>
  )
}

const w = window as unknown as { __fixFinalLabRoot?: Root }
w.__fixFinalLabRoot ??= createRoot(document.getElementById('root')!)
w.__fixFinalLabRoot.render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)

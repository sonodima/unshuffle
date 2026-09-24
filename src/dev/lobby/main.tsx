// Lobby lab: LobbyView rendered from fixtures with a fake host loop.
// Served at /lab/lobby.html. URL params:
//   role=host|guest  pl=1|0  n=1..10  catalog=mock|real|pending  tab=players|playlist|rules  fail=1  ui=1
import { MotionConfig } from 'motion/react'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ToastViewport, type ToastViewItem } from '../../components/ui'
import { REACTIONS } from '../../game/constants'
import type { GameSettings, Player, RoomState } from '../../game/types'
import { fxLobby } from '../fixtures'
import { deezerCatalog } from '../../screens/lobby/catalog'
import { LobbyView, type LobbyTab } from '../../screens/lobby/LobbyView'
import { createMockCatalog, pendingCatalog } from './mockCatalog'

const params = new URLSearchParams(location.search)
const role = params.get('role') === 'guest' ? 'guest' : 'host'
const withPlaylist = params.get('pl') !== '0'
const count = Math.max(1, Math.min(10, Number(params.get('n') ?? 5) || 5))
const catalogName = params.get('catalog') ?? 'mock'
const catalog = catalogName === 'real' ? deezerCatalog : catalogName === 'pending' ? pendingCatalog : createMockCatalog()
const tab = (params.get('tab') as LobbyTab | null) ?? undefined
const fail = params.get('fail') === '1'
const showUi = params.get('ui') === '1'

const EXTRA: Player[] = [
  { id: 'p-6', name: 'Lady Vinile', avatar: 19, color: 5, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-7', name: 'Zio Kazoo', avatar: 8, color: 6, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-8', name: 'Bea', avatar: 12, color: 7, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-9', name: 'Capitan Remix', avatar: 22, color: 8, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-10', name: 'Nico', avatar: 5, color: 9, isHost: false, connected: true, score: 0, activeFromRound: 0 },
]

function initialRoom(): RoomState {
  const players = [...fxLobby.players, ...EXTRA].slice(0, count)
  return { ...fxLobby, players, settings: { ...fxLobby.settings, playlist: withPlaylist ? fxLobby.settings.playlist : null } }
}

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
`

function MockReactions() {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {REACTIONS.map((e) => (
        <button key={e} type="button" className="emoji grid size-10 place-items-center rounded-full bg-white/[0.06] text-xl transition-transform hover:scale-110 active:scale-95">
          {e}
        </button>
      ))}
    </div>
  )
}

let toastSeq = 0

function Lab() {
  const [room, setRoom] = useState<RoomState>(initialRoom)
  const [meRole, setMeRole] = useState(role)
  const [toasts, setToasts] = useState<ToastViewItem[]>([])
  const [started, setStarted] = useState(false)
  const me = meRole === 'host' ? 'p-host' : 'p-2'

  const toast = (title: string) => {
    const id = String(++toastSeq)
    setToasts((t) => [...t, { id, tone: 'info', icon: 'link', title }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }
  const update = (patch: Partial<GameSettings>) => setRoom((r) => ({ ...r, settings: { ...r.settings, ...patch }, seq: r.seq + 1 }))

  return (
    <MotionConfig reducedMotion="user">
      <style>{css}</style>
      <div className="lab-bg" aria-hidden />
      <div className="grain-fixed" aria-hidden />
      <LobbyView
        key={meRole}
        room={room}
        me={me}
        catalog={catalog}
        initialTab={tab}
        onUpdateSettings={update}
        onStart={async () => {
          await new Promise((r) => setTimeout(r, 1200))
          if (fail) throw new Error('Questa playlist non ha abbastanza brani con anteprima (servono almeno 5).')
          setStarted(true)
        }}
        onKick={(id) => setRoom((r) => ({ ...r, players: r.players.filter((p) => p.id !== id) }))}
        onLeave={() => toast('Hai lasciato la stanza (lab)')}
        onNotify={toast}
        onEditProfile={(patch) => setRoom((r) => ({ ...r, players: r.players.map((p) => (p.id === me ? { ...p, ...patch } : p)) }))}
        reactions={<MockReactions />}
      />
      <ToastViewport items={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      {started && (
        <div className="fixed inset-x-0 top-4 z-[900] mx-auto w-fit rounded-full bg-lime px-4 py-2 font-bold text-ink-950" data-testid="started">
          Partita avviata (lab)
        </div>
      )}
      {showUi && (
        <div className="fixed bottom-40 left-4 z-[700] flex flex-col gap-2 rounded-2xl bg-ink-900/90 p-3 text-xs font-bold">
          <button type="button" onClick={() => setMeRole((r) => (r === 'host' ? 'guest' : 'host'))}>
            Ruolo: {meRole}
          </button>
          <button type="button" onClick={() => update({ playlist: room.settings.playlist ? null : fxLobby.settings.playlist })}>
            Playlist: {room.settings.playlist ? 'sì' : 'no'}
          </button>
          <button
            type="button"
            onClick={() =>
              setRoom((r) => {
                const pool = [...fxLobby.players, ...EXTRA]
                const next = pool.find((p) => !r.players.some((x) => x.id === p.id))
                return next ? { ...r, players: [...r.players, next] } : r
              })
            }
          >
            + giocatore
          </button>
          <button type="button" onClick={() => setRoom((r) => ({ ...r, players: r.players.length > 1 ? r.players.slice(0, -1) : r.players }))}>
            − giocatore
          </button>
        </div>
      )}
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)

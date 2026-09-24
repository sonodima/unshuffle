// fix-lobby lab (throwaway): LobbyView from fixtures with extra QA states.
// /lab/fix-lobby.html?role=host|guest&pl=1|0|tiny|long&n=1..10&names=long&tab=…&rounds=3|5|7|10&fail=1&url=long
import { MotionConfig } from 'motion/react'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ToastViewport, type ToastViewItem } from '../../components/ui'
import { REACTIONS } from '../../game/constants'
import type { GameSettings, Player, PlaylistRef, RoomState } from '../../game/types'
import { fxLobby } from '../fixtures'
import { LobbyView, type LobbyTab } from '../../screens/lobby/LobbyView'
import { createMockCatalog } from '../lobby/mockCatalog'

const params = new URLSearchParams(location.search)
const role = params.get('role') === 'guest' ? 'guest' : 'host'
const pl = params.get('pl') ?? '1'
const count = Math.max(1, Math.min(10, Number(params.get('n') ?? 5) || 5))
const longNames = params.get('names') === 'long'
const tab = (params.get('tab') as LobbyTab | null) ?? undefined
const fail = params.get('fail') === '1'
const rounds = Number(params.get('rounds') ?? 0) || null
const longUrl = params.get('url') === 'long'
const catalog = createMockCatalog(Number(params.get('latency') ?? 450))

const EXTRA: Player[] = [
  { id: 'p-6', name: 'Lady Vinile', avatar: 19, color: 5, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-7', name: 'Zio Kazoo', avatar: 8, color: 6, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-8', name: 'Bea', avatar: 12, color: 7, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-9', name: 'Capitan Remix', avatar: 22, color: 8, isHost: false, connected: true, score: 0, activeFromRound: 0 },
  { id: 'p-10', name: 'Nico', avatar: 5, color: 9, isHost: false, connected: true, score: 0, activeFromRound: 0 },
]
const LONG = ['WWWWWWWWWWWWWWWW', 'MMMMMMMMMMMMMMMM', 'Wolfgang Amadeus', 'Supercalifragili', 'ÀÈÌÒÙàèìòùÀÈÌÒÙ']

const TINY: PlaylistRef = {
  id: 15779000621,
  title: 'Lumine Frog',
  picture: 'https://cdn-images.dzcdn.net/images/playlist/3e4cdc7e18c4ac1163bc7247f151731c/500x500-000000-80-0-0.jpg',
  nbTracks: 1,
  creator: 'Lumine Frog',
}
const LONG_TITLE: PlaylistRef = {
  ...fxLobby.settings.playlist!,
  title: 'The Ultimate Mega Playlist of 2000s Pop Hits — Summer Party Edition',
}

function initialRoom(): RoomState {
  let players = [...fxLobby.players, ...EXTRA].slice(0, count)
  if (longNames) players = players.map((p, i) => (i < LONG.length ? { ...p, name: LONG[i] } : p))
  const playlist = pl === '0' ? null : pl === 'tiny' ? TINY : pl === 'long' ? LONG_TITLE : /^\d+$/.test(pl) && pl !== '1' ? { ...TINY, title: `Mini playlist (${pl})`, nbTracks: Number(pl) } : fxLobby.settings.playlist
  return { ...fxLobby, players, settings: { ...fxLobby.settings, ...(rounds ? { rounds } : {}), playlist } }
}

const css = `
.lab-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: var(--color-ink-950); }
.lab-bg::before { content: ''; position: absolute; inset: -30%; filter: blur(60px);
  background:
    radial-gradient(40% 35% at 20% 25%, rgb(123 92 255 / 0.55), transparent 70%),
    radial-gradient(35% 30% at 80% 20%, rgb(255 63 209 / 0.38), transparent 70%),
    radial-gradient(45% 40% at 70% 85%, rgb(46 230 255 / 0.22), transparent 70%); }
`

let toastSeq = 0

function Lab() {
  const [room, setRoom] = useState<RoomState>(initialRoom)
  const [toasts, setToasts] = useState<ToastViewItem[]>([])
  const [started, setStarted] = useState(false)
  const me = role === 'host' ? 'p-host' : 'p-2'
  const toast = (title: string) => {
    const id = String(++toastSeq)
    setToasts((t) => [...t, { id, tone: 'info', icon: 'link', title }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }
  const update = (patch: Partial<GameSettings>) => setRoom((r) => ({ ...r, settings: { ...r.settings, ...patch }, seq: r.seq + 1 }))
  const joinUrl = longUrl ? 'https://unshuffle.example-party-games.com/games/unshuffle/#/r/' + room.code : undefined
  return (
    <MotionConfig reducedMotion="user">
      <style>{css}</style>
      <div className="lab-bg" aria-hidden />
      <LobbyView
        room={room}
        me={me}
        catalog={catalog}
        initialTab={tab}
        joinUrl={joinUrl}
        onUpdateSettings={update}
        onStart={async () => {
          await new Promise((r) => setTimeout(r, 800))
          if (fail) throw new Error('Questa playlist non ha abbastanza brani con anteprima (servono almeno 5).')
          setStarted(true)
        }}
        onKick={(id) => setRoom((r) => ({ ...r, players: r.players.filter((p) => p.id !== id) }))}
        onLeave={() => toast('Hai lasciato la stanza (lab)')}
        onNotify={toast}
        onEditProfile={(patch) => setRoom((r) => ({ ...r, players: r.players.map((p) => (p.id === me ? { ...p, ...patch } : p)) }))}
        reactions={
          <div className="flex flex-wrap justify-center gap-1.5">
            {REACTIONS.map((e) => (
              <button key={e} type="button" className="emoji grid size-10 place-items-center rounded-full bg-white/[0.06] text-xl">
                {e}
              </button>
            ))}
          </div>
        }
      />
      <ToastViewport items={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      {started && (
        <div className="fixed inset-x-0 top-4 z-[900] mx-auto w-fit rounded-full bg-lime px-4 py-2 font-bold text-ink-950" data-testid="started">
          Partita avviata (lab)
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

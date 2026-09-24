// Shell lab: the real app chrome (shader, router, overlays, toasts, floating
// reactions, sound controls) over fixture store states. Dev-only.
//   /lab/shell.html            mock screens (to judge overlays in context)
//   /lab/shell.html?real=1     the real screens
//   /lab/shell.html?panel=0    hide the dev panel (screenshots)
// Driven from Playwright through window.__shell.

import { MotionConfig } from 'motion/react'
import { StrictMode, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ShaderBackground } from '../../components/background/ShaderBackground'
import { ReactionBar } from '../../components/reactions/ReactionBar'
import { ConnectionOverlay } from '../../components/shell/ConnectionOverlay'
import { ErrorBoundary, QuietBoundary } from '../../components/shell/ErrorBoundary'
import { FloatingReactions } from '../../components/shell/FloatingReactions'
import { ResumeOverlay } from '../../components/shell/ResumeOverlay'
import { __setResumeStateForLab } from '../../components/shell/resume'
import { ScreenRouter } from '../../components/shell/ScreenRouter'
import type { ScreenKey } from '../../components/shell/routing'
import { SoundControls } from '../../components/shell/SoundControls'
import { ToastLayer } from '../../components/shell/ToastLayer'
import { AnimatedNumber, Avatar, Button, IconButton, Logo, Panel, ProgressDots, TimerBar, TimerRing } from '../../components/ui'
import { REACTIONS } from '../../game/constants'
import { useGame } from '../../game/store'
import type { GameStore } from '../../game/store'
import type { GameEvent, RoomState } from '../../game/types'
import { REJECT_MESSAGES } from '../../net/protocol'
import { FX_NOW, fxFinal, fxIntro, fxLobby, fxPlaying, fxPlayingFinal, fxPreparing, fxReveal } from '../fixtures'

const params = new URLSearchParams(location.search)
const REAL = params.get('real') === '1'
const PANEL = params.get('panel') !== '0'

const FIXTURES: Record<string, RoomState> = {
  lobby: fxLobby,
  preparing: fxPreparing,
  intro: fxIntro,
  playing: fxPlaying,
  finalTimer: fxPlayingFinal,
  reveal: fxReveal,
  final: fxFinal,
}

function live(room: RoomState): RoomState {
  const shift = Date.now() - FX_NOW
  const phase = { ...room.phase } as Record<string, unknown>
  for (const k of ['endsAt', 'startedAt', 'nextAt']) if (typeof phase[k] === 'number') phase[k] = (phase[k] as number) + shift
  return { ...room, phase: phase as RoomState['phase'], seq: room.seq + 1 }
}

// Store actions are replaced by local fakes: no peer, no host.
const fakeActions: Partial<GameStore> = {
  react(emoji: string) {
    setTimeout(() => pushEvent({ type: 'reaction', playerId: useGame.getState().me, emoji }), 60)
  },
  leave() {
    useGame.setState({ role: 'none', connection: 'idle', error: null, room: null, roomCode: null, toasts: [] })
  },
  async rejoin() {
    useGame.setState({ connection: 'connecting' })
    await new Promise((r) => setTimeout(r, 1200))
    useGame.setState({ connection: 'open', error: null })
  },
  clearError() {
    useGame.setState({ error: null })
  },
  dismissToast(id: number) {
    useGame.setState({ toasts: useGame.getState().toasts.filter((t) => t.id !== id) })
  },
  notify(message: string) {
    pushEvent({ type: 'info', message })
  },
  async resumeSession() {
    return false
  },
}
useGame.setState(fakeActions)

let toastId = 100_000
function pushEvent(event: GameEvent, ttl = event.type === 'reaction' ? 2500 : 6000): void {
  const id = ++toastId
  useGame.setState({ toasts: [...useGame.getState().toasts, { id, event, at: Date.now() }].slice(-6) })
  if (ttl > 0) setTimeout(() => useGame.getState().dismissToast(id), ttl)
}

function setFixture(name: string, meId = 'p-host') {
  const room = live(FIXTURES[name])
  useGame.setState({
    role: meId === room.hostId ? 'host' : 'client',
    connection: 'open',
    error: null,
    room,
    roomCode: room.code,
    me: meId,
    toasts: [],
  })
}

function home() {
  useGame.setState({ role: 'none', connection: 'idle', error: null, room: null, roomCode: null, toasts: [] })
}

function setConnection(connection: GameStore['connection'], error: string | null = null) {
  useGame.setState({ connection, error })
}

/** Simulate being dropped out of the room (kicked / closed / failed rejoin). */
function dropOut(reason: 'kicked' | 'closed' | 'failed') {
  const message = reason === 'failed' ? 'Stanza non trovata. Controlla il codice.' : REJECT_MESSAGES[reason]
  useGame.setState({ role: 'none', connection: reason === 'failed' ? 'error' : 'closed', error: message, room: null, roomCode: null, toasts: [] })
}

function demoToasts() {
  pushEvent({ type: 'player-joined', playerId: 'p-3', name: 'DJ Pinguino' }, 0)
  setTimeout(() => pushEvent({ type: 'first-submit', playerId: 'p-2', name: 'Giulia', endsAt: Date.now() + 15_000 }, 0), 120)
  setTimeout(() => pushEvent({ type: 'info', message: 'Audio di “Harder, Better, Faster, Stronger” non disponibile: puoi comunque giocare.' }, 0), 240)
}

function reactions(n = 8) {
  const players = useGame.getState().room?.players ?? []
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const p = players[i % Math.max(1, players.length)]
      pushEvent({ type: 'reaction', playerId: p?.id ?? 'p-2', emoji: REACTIONS[i % REACTIONS.length] })
    }, i * 140)
  }
}

let crash: (() => void) | null = null

declare global {
  interface Window {
    __shell: Record<string, unknown>
  }
}

window.__shell = {
  useGame,
  setFixture,
  home,
  setConnection,
  dropOut,
  pushEvent,
  demoToasts,
  reactions,
  resume: (code = 'KXQPM', role: 'host' | 'client' = 'client') =>
    __setResumeStateForLab({ phase: 'running', code, role, startedAt: Date.now() - 4000, failure: null }),
  resumeDone: () => __setResumeStateForLab({ phase: 'done' }),
  resumeFailed: () => __setResumeStateForLab({ phase: 'done', code: 'KXQPM', failure: 'Stanza non trovata. Controlla il codice.' }),
  crash: () => crash?.(),
}

// ---------------------------------------------------------------------------
// Mock screens: a plausible layout per screen, so overlays are judged in context.

function MockHud() {
  const room = useGame((s) => s.room)
  const endsAt = room && room.phase.kind === 'playing' ? room.phase.endsAt : Date.now() + 60_000
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const remaining = Math.max(0, endsAt - now)
  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col gap-4 px-3 pt-safe-3 pb-safe-4 sm:px-6 sm:pt-safe-5">
      <Panel padding="none" className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="display display-skew text-lg leading-none sm:text-xl">
              Round <span className="text-lime">3</span>
              <span className="text-ink-400"> / 5</span>
            </span>
            <ProgressDots total={5} current={2} size="sm" />
          </div>
          <div className="mx-auto hidden sm:block">
            <TimerRing remainingMs={remaining} totalMs={90_000} size={64} />
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="eyebrow">Punti</span>
            <AnimatedNumber value={13_840} className="text-xl font-bold text-gold sm:text-2xl" />
          </div>
          <SoundControls placement="inline" className="ml-1 sm:ml-3" />
        </div>
        <div className="px-4 pb-3 sm:hidden">
          <TimerBar remainingMs={remaining} totalMs={90_000} />
        </div>
      </Panel>
      <div className="grid flex-1 grid-cols-2 content-center gap-2.5 sm:grid-cols-4">
        {[312, 22, 190, 95, 258, 140, 48, 5].map((h, i) => (
          <div
            key={h}
            className="relative flex h-20 items-center justify-center overflow-hidden rounded-block border border-white/15 sm:h-28"
            style={{
              background: `linear-gradient(160deg, hsl(${h} 95% 64%), hsl(${h} 85% 44%))`,
              boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.4), 0 4px 0 hsl(${h} 70% 28%)`,
            }}
          >
            <span className="display relative text-2xl text-white/90 drop-shadow">{String.fromCharCode(65 + i)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <IconButton icon="play" label="Riproduci tutto" variant="secondary" size="lg" />
        <Button size="lg" fullWidth leftIcon="check" className="sm:ml-auto sm:w-auto">
          Conferma
        </Button>
      </div>
    </div>
  )
}

const NO_PLAYERS: RoomState['players'] = []

function MockLobby() {
  const players = useGame((s) => s.room?.players ?? NO_PLAYERS)
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-3 pt-safe-4 pb-safe-6 sm:px-6 sm:pt-safe-8">
      <div className="flex items-center justify-between">
        <Logo size="sm" animate={false} />
        <span className="w-10" />
      </div>
      <Panel className="flex flex-col items-center gap-2 text-center">
        <span className="eyebrow">Codice stanza</span>
        <span className="num text-5xl font-bold tracking-[0.2em] sm:text-6xl">KXQPM</span>
      </Panel>
      <Panel className="flex flex-col gap-3">
        <span className="eyebrow">Giocatori</span>
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Avatar avatar={p.avatar} color={p.color} host={p.isHost} connected={p.connected} showStatus size="md" />
            <span className="font-bold">{p.name}</span>
          </div>
        ))}
      </Panel>
      <div className="mt-auto flex flex-col items-center gap-4">
        <ReactionBar />
        <Button size="xl" fullWidth leftIcon="play">
          Inizia partita
        </Button>
      </div>
    </div>
  )
}

function MockHome() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Logo size="hero" />
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button size="xl" fullWidth leftIcon="plus">
          Crea stanza
        </Button>
        <Button variant="secondary" size="lg" fullWidth leftIcon="arrow-right">
          Entra
        </Button>
      </div>
    </div>
  )
}

function Crashy() {
  const [boom, setBoom] = useState(false)
  crash = () => setBoom(true)
  if (boom) throw new Error('Lab: crash simulato nella schermata')
  return <MockHud />
}

const MOCK_SCREENS: Partial<Record<ScreenKey, ComponentType>> = {
  home: MockHome,
  lobby: MockLobby,
  round: Crashy,
  final: MockLobby,
}

// ---------------------------------------------------------------------------

function DevPanel() {
  const [open, setOpen] = useState(true)
  const btn = 'rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold hover:bg-white/20'
  if (!open)
    return (
      <button type="button" className={`fixed bottom-3 left-3 z-[2000] ${btn}`} onClick={() => setOpen(true)}>
        lab
      </button>
    )
  return (
    <div className="fixed bottom-3 left-3 z-[2000] flex max-w-[340px] flex-wrap gap-1 rounded-xl bg-black/80 p-2 text-ink-50">
      {Object.keys(FIXTURES).map((k) => (
        <button key={k} type="button" className={btn} onClick={() => setFixture(k)}>
          {k}
        </button>
      ))}
      <button type="button" className={btn} onClick={home}>home</button>
      <button type="button" className={btn} onClick={() => setConnection('reconnecting')}>reconnecting</button>
      <button type="button" className={btn} onClick={() => setConnection('closed', 'Connessione con l’host persa.')}>closed</button>
      <button type="button" className={btn} onClick={() => setConnection('open', 'Connessione al server persa: i nuovi giocatori non possono entrare.')}>host-warn</button>
      <button type="button" className={btn} onClick={() => setConnection('open')}>open</button>
      <button type="button" className={btn} onClick={() => dropOut('kicked')}>kicked</button>
      <button type="button" className={btn} onClick={() => dropOut('closed')}>room closed</button>
      <button type="button" className={btn} onClick={demoToasts}>toasts</button>
      <button type="button" className={btn} onClick={() => reactions()}>reactions</button>
      <button type="button" className={btn} onClick={() => window.__shell.resume && (window.__shell.resume as () => void)()}>resume</button>
      <button type="button" className={btn} onClick={() => (window.__shell.resumeDone as () => void)()}>resume done</button>
      <button type="button" className={btn} onClick={() => crash?.()}>crash</button>
      <button type="button" className={btn} onClick={() => setOpen(false)}>×</button>
    </div>
  )
}

function Lab() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary name="lab">
        <QuietBoundary name="background">
          <ShaderBackground />
        </QuietBoundary>
        <ScreenRouter screens={REAL ? undefined : MOCK_SCREENS} />
        <FloatingReactions />
        <SoundControls />
        <ConnectionOverlay />
        <ResumeOverlay />
        <ToastLayer />
        {PANEL && <DevPanel />}
      </ErrorBoundary>
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)

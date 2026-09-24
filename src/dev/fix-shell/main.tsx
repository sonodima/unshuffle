// Fix-shell lab: the real app chrome over the REAL screens, driven by fixture
// store states, to judge overlays in context. Dev-only.
//   /lab/fix-shell.html               real screens
//   /lab/fix-shell.html?gallery=1     presentational connection dialogs, one at a time
// Driven from Playwright through window.__fx.

import { MotionConfig } from 'motion/react'
import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ShaderBackground } from '../../components/background/ShaderBackground'
import { ConnectionLostDialog, ConnectionOverlay, ExitNoticeDialog } from '../../components/shell/ConnectionOverlay'
import type { ExitNotice, LostCause, LostContext } from '../../components/shell/ConnectionOverlay'
import { ErrorBoundary, QuietBoundary } from '../../components/shell/ErrorBoundary'
import { FloatingReactions } from '../../components/shell/FloatingReactions'
import { ResumeOverlay } from '../../components/shell/ResumeOverlay'
import { ScreenRouter } from '../../components/shell/ScreenRouter'
import { SoundControls } from '../../components/shell/SoundControls'
import { ToastLayer } from '../../components/shell/ToastLayer'
import { useGame } from '../../game/store'
import type { GameStore } from '../../game/store'
import type { GameEvent, RoomState } from '../../game/types'
import { REJECT_MESSAGES } from '../../net/protocol'
import { FX_NOW, fxFinal, fxIntro, fxLobby, fxPlaying, fxPlayingFinal, fxPreparing, fxReveal } from '../fixtures'

const params = new URLSearchParams(location.search)
const GALLERY = params.get('gallery') === '1'

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

let rejoinMode: 'ok' | 'fail' | 'kicked' = 'ok'
const ROOM_NOT_FOUND = 'Stanza non trovata. Controlla il codice.'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Store actions are replaced by local fakes: no peer, no host.
const fakeActions: Partial<GameStore> = {
  react(emoji: string) {
    setTimeout(() => pushEvent({ type: 'reaction', playerId: useGame.getState().me, emoji }), 60)
  },
  leave() {
    useGame.setState({ role: 'none', connection: 'idle', error: null, room: null, roomCode: null, toasts: [] })
  },
  async rejoin() {
    useGame.setState({ role: 'client', connection: 'connecting', error: null })
    await sleep(1200)
    if (rejoinMode === 'fail') {
      useGame.setState({ role: 'none', connection: 'error', error: ROOM_NOT_FOUND, room: null, roomCode: null, toasts: [] })
      throw new Error(ROOM_NOT_FOUND)
    }
    if (rejoinMode === 'kicked') {
      useGame.setState({ role: 'none', connection: 'closed', error: REJECT_MESSAGES.kicked, room: null, roomCode: null, toasts: [] })
      throw new Error(REJECT_MESSAGES.kicked)
    }
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

function setConnection(connection: GameStore['connection'], error: string | null = null) {
  useGame.setState({ connection, error })
}

function demoToasts() {
  pushEvent({ type: 'player-joined', playerId: 'p-3', name: 'DJ Pinguino' }, 0)
  setTimeout(() => pushEvent({ type: 'info', message: 'Audio di “Harder, Better, Faster, Stronger” non disponibile: puoi comunque giocare.' }, 0), 120)
}

// ---------------------------------------------------------------------------
// Dialog gallery (presentational)

interface GalleryState {
  kind: 'lost' | 'notice' | 'none'
  context: LostContext
  cause: LostCause
  retrying: boolean
  failure: ExitNotice | null
  notice: ExitNotice | null
}
let gallery: GalleryState = { kind: 'none', context: 'game', cause: 'network', retrying: false, failure: null, notice: null }
const galleryListeners = new Set<() => void>()
function setGallery(next: Partial<GalleryState>) {
  gallery = { ...gallery, ...next }
  for (const l of galleryListeners) l()
}
function useGallery(): GalleryState {
  return useSyncExternalStore(
    (l) => {
      galleryListeners.add(l)
      return () => galleryListeners.delete(l)
    },
    () => gallery,
  )
}

function Gallery() {
  const g = useGallery()
  return (
    <>
      <ConnectionLostDialog
        open={g.kind === 'lost'}
        role="client"
        code="KXQPM"
        message="Connessione con l’host persa."
        retrying={g.retrying}
        onRetry={() => setGallery({ retrying: true })}
        onHome={() => setGallery({ kind: 'none' })}
        context={g.context}
        cause={g.cause}
        failure={g.failure}
      />
      <ExitNoticeDialog notice={g.notice} open={g.kind === 'notice'} onClose={() => setGallery({ kind: 'none' })} />
    </>
  )
}

declare global {
  interface Window {
    __fx: Record<string, unknown>
  }
}

window.__fx = {
  useGame,
  setFixture,
  home: () => useGame.setState({ role: 'none', connection: 'idle', error: null, room: null, roomCode: null, toasts: [] }),
  setConnection,
  pushEvent,
  demoToasts,
  setRejoinMode: (m: typeof rejoinMode) => (rejoinMode = m),
  gallery: setGallery,
  scrollScreen: (y: number) => {
    const frame = document.querySelector('[data-screen-frame]:not([inert])')
    const all = frame ? [frame, ...frame.querySelectorAll('*')] : []
    const scroller = all.find((el) => el.scrollHeight > el.clientHeight + 1 && el.clientHeight > innerHeight * 0.6 && getComputedStyle(el).overflowY !== 'visible')
    scroller?.scrollTo({ top: y })
    return scroller ? scroller.scrollTop : -1
  },
}

function Lab() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary name="lab">
        <QuietBoundary name="background">
          <ShaderBackground />
        </QuietBoundary>
        {GALLERY ? (
          <Gallery />
        ) : (
          <>
            <ScreenRouter />
            <FloatingReactions />
            <SoundControls />
            <ConnectionOverlay />
            <ResumeOverlay />
            <ToastLayer />
          </>
        )}
      </ErrorBoundary>
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)

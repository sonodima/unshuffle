// Maps store toasts (GameEvent) to the UI-kit ToastViewport with Italian copy.
// Reactions are not toasts: FloatingReactions renders those.
// Also shows a persistent "tap to enable audio" cue while the browser keeps the
// AudioContext suspended in a room (e.g. after a reload, which rejoins with no gesture).

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { audioEngine } from '../../audio/engine'
import { useAudioUnlocked } from '../../audio/usePlayback'
import { hostNow } from '../../game/clock'
import { useGame } from '../../game/store'
import type { Player, PlayerId } from '../../game/types'
import { ToastViewport, useIsWide, useMediaQuery } from '../ui'
import type { ToastViewItem } from '../ui'
import { cn } from '../ui'
import { stackTop, useBannerBox, useHudBottom } from './hudInset'
import { useCurrentScreen } from './shellState'
import { toastForEvent } from './toastCopy'
import type { ToastCopy, ToastCopyContext } from './toastCopy'

export { splitMessage, toastForEvent } from './toastCopy'
export type { ToastCopy, ToastCopyContext } from './toastCopy'

/** Long titles wrap to two lines instead of being cut (the viewport truncates by default). */
function toViewItem(copy: ToastCopy): ToastViewItem {
  const title: ReactNode = copy.title.length > 34 ? <span className="line-clamp-2 whitespace-normal">{copy.title}</span> : copy.title
  return { ...copy, title }
}

/** Events the round screen already shows itself (first-submit banner, ✓ badges in the HUD). */
const ROUND_SCREEN_SILENT = new Set(['first-submit', 'submitted'])
/** Roster news that can wait while a phone player races the clock (the HUD strip shows it). */
const QUIET_WHILE_PLAYING = new Set(['player-joined', 'player-left', 'kicked'])
/** The viewport's sm+ toast column: 380px + 20px gutter, right-aligned. */
const TOAST_COLUMN_PX = 400

function viewportWidth(): number {
  try {
    return document.documentElement.clientWidth || window.innerWidth || 0
  } catch {
    return 0
  }
}

/** Same breakpoint as the play screen's roomy HUD (PlayView WIDE_QUERY). */
const ROOMY_ROUND_QUERY = '(min-width: 768px) and (min-height: 600px)'

// ---------------------------------------------------------------------------
// Audio unlock cue

const CUE_ID = 'audio-unlock'
/** Joining with a tap unlocks within a few ms: only a context still locked after this gets a cue. */
const CUE_DELAY_MS = 1200

function unlockNow(): void {
  try {
    void audioEngine.unlock().catch(() => undefined)
  } catch {
    // no Web Audio: nothing to unlock
  }
}

/** The cue item while in a room with the AudioContext still locked (null otherwise). */
function useAudioUnlockCue(): { item: ToastViewItem | null; dismiss(): void } {
  const unlocked = useAudioUnlocked()
  // Not over the connection dialogs / while the link is down: one thing at a time.
  const inRoom = useGame((s) => s.role !== 'none' && s.room !== null && s.connection === 'open')
  const reveal = useGame((s) => s.room?.phase.kind === 'reveal')
  const coarse = useMediaQuery('(pointer: coarse)')
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const wanted = inRoom && !unlocked

  useEffect(() => {
    if (!wanted) {
      setReady(false)
      return
    }
    // Only count visible time: a tab coming back from the background resumes on its own.
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      setReady(false)
      if (document.visibilityState === 'hidden') return
      timer = setTimeout(() => setReady(true), CUE_DELAY_MS)
    }
    arm()
    document.addEventListener('visibilitychange', arm)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', arm)
    }
  }, [wanted])

  // Unlocked again: a later interruption (iOS call, Bluetooth switch) may show it once more.
  useEffect(() => {
    if (unlocked) setDismissed(false)
  }, [unlocked])

  const item = useMemo<ToastViewItem | null>(() => {
    if (!wanted || !ready || dismissed) return null
    const verb = coarse ? 'Tocca' : 'Clicca'
    return {
      id: CUE_ID,
      tone: 'accent',
      icon: 'headphones',
      title: reveal ? `${verb} per ascoltare la canzone` : `${verb} per attivare l’audio`,
      body: coarse ? 'Il browser tiene l’audio in pausa finché non tocchi lo schermo.' : 'Il browser tiene l’audio in pausa finché non interagisci con la pagina.',
    }
  }, [wanted, ready, dismissed, coarse, reveal])

  return {
    item,
    dismiss: () => {
      unlockNow()
      setDismissed(true)
    },
  }
}

// ---------------------------------------------------------------------------

export function ToastLayer() {
  const toasts = useGame((s) => s.toasts)
  const wide = useIsWide()
  const screen = useCurrentScreen()
  const inRound = screen === 'round'
  const playing = useGame((s) => s.room?.phase.kind === 'playing')
  const hud = useHudBottom()
  const banner = useBannerBox()
  // Stack under whatever is pinned at the top: the play HUD and/or the connection banner
  // (only when the toast column would hit it: phones span the width, sm+ a 380px right column).
  const inset = stackTop(hud, banner, wide ? viewportWidth() - TOAST_COLUMN_PX : 0)
  const roomyRound = useMediaQuery(ROOMY_ROUND_QUERY)
  // Phone / short-landscape play screen: one toast at a time, under the compact HUD.
  const cramped = inRound && hud !== null && !roomyRound
  const cue = useAudioUnlockCue()
  // Every player seen this session, so "X ha lasciato la stanza" still has a name after they left the state.
  const seen = useRef(new Map<PlayerId, Pick<Player, 'name' | 'avatar'>>())
  // Copy is frozen when a toast first shows up (a later join must not rewrite "ora siete in N").
  const cache = useRef(new Map<number, ToastViewItem | null>())

  const items = useMemo(() => {
    // Read the room lazily: the host flushes the state before the event, so it is current.
    const room = useGame.getState().room
    if (room) for (const p of room.players) seen.current.set(p.id, { name: p.name, avatar: p.avatar })
    const ctx: ToastCopyContext = {
      player: (id) => room?.players.find((p) => p.id === id) ?? seen.current.get(id),
      playerCount: room?.players.length ?? 0,
      clockOffset: hostNow() - Date.now(),
    }
    const next = new Map<number, ToastViewItem | null>()
    const out: ToastViewItem[] = []
    for (const t of toasts) {
      let item = cache.current.get(t.id)
      if (item === undefined) {
        const copy = toastForEvent(t, ctx)
        item = copy ? toViewItem(copy) : null
      }
      next.set(t.id, item)
      if (!item) continue
      if (inRound && ROUND_SCREEN_SILENT.has(t.event.type)) continue
      if (cramped && playing && QUIET_WHILE_PLAYING.has(t.event.type)) continue
      out.push(item)
    }
    cache.current = next
    return out
  }, [toasts, inRound, cramped, playing])

  // The cue is the newest item, so it wins the only slot on a cramped screen.
  const shown = useMemo(() => (cue.item ? [...items, cue.item] : items), [items, cue.item])

  const dismiss = (id: string | number) => {
    if (id === CUE_ID) {
      cue.dismiss()
      return
    }
    try {
      useGame.getState().dismissToast(Number(id))
    } catch {
      // ignore
    }
  }

  return (
    // Under a pinned HUD (play screen) / the connection banner when there is one.
    // Otherwise, desktop: below the floating sound control (top-right). The wrapper's
    // transform makes it the containing block of the viewport's fixed stack.
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 bottom-0 z-[900] [transform:translateZ(0)]',
        inset === null && (inRound ? 'md:top-[128px]' : 'sm:top-14'),
      )}
      style={inset !== null ? { top: inset } : undefined}
    >
      <ToastViewport items={shown} onDismiss={dismiss} max={cramped ? 1 : wide ? 4 : 2} className={inset !== null ? 'pt-2!' : undefined} />
    </div>
  )
}

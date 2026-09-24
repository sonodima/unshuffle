import { AnimatePresence, motion, useIsPresent, type Transition } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AvatarGroup, Button, Equalizer, Modal, cn } from '../../components/ui'
import type { Player } from '../../game/types'
import { joinNames } from './stats'

type DockPlacement = 'fixed' | 'inline'

interface ActionDockProps {
  isHost: boolean
  /** Connected players other than me (host: shown in the replay hint / leave warning). */
  othersOnline: number
  onPlayAgain(): void
  onLeave(): void
  /** Seconds before the dock slides in. */
  delay: number
  reduced: boolean
  /**
   * 'fixed' (phones): pinned to the bottom edge, over the page.
   * 'inline' (tablets and up): sits in the flow right under the podium — sticky to the
   * bottom edge while that spot is still below the fold — and comes back as a floating
   * bar once the page is scrolled past it, so Rigioca is always one tap away.
   */
  placement: DockPlacement
  /**
   * Roomy screens: the inline dock has the big (68px) Rigioca and sticks to the bottom edge
   * while below the fold. Landscape phones (false): regular size and simply in the flow, so
   * it never sits on the podium (the floating copy still follows once scrolled past).
   */
  big?: boolean
  /** Extra classes for the inline slot (e.g. its margins). */
  className?: string
  /** Guests: nudge the host for a rematch (hidden when not wired). */
  onRematch?(): void
  /** Host: players who asked for a rematch. */
  rematchFrom?: Player[]
}

/** Guests can nudge again after this long. */
const REMATCH_COOLDOWN_MS = 8000

/** Thumb-reachable action dock: host replays / closes the room, guests wait or leave. */
export function ActionDock({ isHost, othersOnline, onPlayAgain, onLeave, delay, reduced, placement, big = true, className, onRematch, rematchFrom = [] }: ActionDockProps) {
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (busyTimer.current) clearTimeout(busyTimer.current)
  }, [])

  const replay = () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    // The screen normally unmounts as the room returns to the lobby; re-arm if it doesn't.
    busyTimer.current = setTimeout(() => {
      busyRef.current = false
      setBusy(false)
    }, 2500)
    onPlayAgain()
  }

  const leave = () => {
    if (isHost && othersOnline > 0) setConfirmLeave(true)
    else onLeave()
  }

  const [asked, setAsked] = useState(false)
  const askedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (askedTimer.current) clearTimeout(askedTimer.current)
  }, [])
  const rematch = () => {
    if (asked || !onRematch) return
    onRematch()
    setAsked(true)
    askedTimer.current = setTimeout(() => setAsked(false), REMATCH_COOLDOWN_MS)
  }

  const inline = placement === 'inline'
  const slot = useRef<HTMLDivElement>(null)
  // The entrance waits for the podium; later show/hide swaps must not.
  const [settled, setSettled] = useState(false)
  // Inline dock scrolled off the top of the page → show the floating copy.
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = slot.current
    if (!inline || !el || typeof IntersectionObserver === 'undefined') {
      setPast(false)
      return
    }
    // The root extends far below the fold, so "not intersecting" only ever means "scrolled past the
    // top" — and a jump straight from below the fold to past it still crosses the threshold.
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting), { root: scrollParent(el), rootMargin: '0px 0px 100000px 0px', threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [inline])

  const waiting = (
    <>
      <Equalizer bars={4} size={18} label={null} className="shrink-0" />
      <span className="leading-tight">In attesa dell’host per rigiocare…</span>
    </>
  )

  const pill = (big: boolean) => (
    <div
      role="group"
      aria-label="Azioni"
      className={cn(
        'glass-dock pointer-events-auto flex w-full items-center gap-2 rounded-full p-2 sm:gap-3',
        big ? (isHost ? 'max-w-[600px] pb-1.5' : 'max-w-[520px] pb-1.5') : 'max-w-[560px] pb-1',
      )}
    >
      {isHost ? (
        <>
          <Button variant="glass" size="lg" leftIcon="logout" onClick={leave} className="shrink-0 max-[380px]:px-5">
            Esci
          </Button>
          <Button variant="primary" size={big ? 'xl' : 'lg'} leftIcon="refresh" fullWidth loading={busy} onClick={replay} sound="go" className="min-w-0 flex-1">
            Rigioca
          </Button>
        </>
      ) : onRematch ? (
        <>
          <Button variant="secondary" size="lg" leftIcon={asked ? 'check' : 'refresh'} fullWidth disabled={asked} onClick={rematch} sound="pop" className="min-w-0 flex-1 max-[380px]:px-4">
            {asked ? 'Richiesta inviata' : 'Rivincita!'}
          </Button>
          <Button variant="glass" size="lg" leftIcon="logout" onClick={leave} className="shrink-0 max-[380px]:px-5">
            Esci
          </Button>
        </>
      ) : (
        <>
          <div className={cn('mb-1 flex min-w-0 flex-1 items-center gap-2.5 pl-3 font-bold text-ink-100 sm:pl-4', big ? 'text-[15px]' : 'text-[13px] sm:text-sm')} role="status">
            {waiting}
          </div>
          <Button variant="glass" size="lg" leftIcon="logout" onClick={leave} className="shrink-0">
            Esci
          </Button>
        </>
      )}
    </div>
  )

  // Above the pill: guests with a rematch button still see what they're waiting for (in the
  // flow, it's there from the start); the host sees who asked for a rematch (floats above, so
  // a request arriving never shifts the page).
  let caption: ReactNode = null
  let hint: ReactNode = null
  if (!isHost && onRematch) {
    caption = (
      <div role="status" className="glass-flat flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-ink-100">
        {waiting}
      </div>
    )
  } else if (isHost && rematchFrom.length > 0) {
    const names = rematchFrom.length > 2 ? `${rematchFrom.length} giocatori` : joinNames(rematchFrom.map((p) => p.name))
    hint = (
      <motion.div
        key={rematchFrom.length}
        role="status"
        className="glass-flat flex max-w-full items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 text-[13px] font-bold text-ink-50"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 420, damping: 22 }}
      >
        <AvatarGroup players={rematchFrom} size="xs" max={3} className="shrink-0" />
        <span className="min-w-0 truncate">
          {names} {rematchFrom.length === 1 ? 'vuole' : 'vogliono'} la rivincita!
        </span>
      </motion.div>
    )
  }
  const withCaption = (big: boolean) => (
    <div className="relative flex w-full flex-col items-center gap-2">
      {caption && <div className="pointer-events-auto flex max-w-full justify-center">{caption}</div>}
      {hint && <div className="pointer-events-auto absolute bottom-full mb-2 flex max-w-full justify-center">{hint}</div>}
      {pill(big)}
    </div>
  )

  const enter = reduced ? { opacity: 0 } : { opacity: 0, y: 40 }
  const spring = reduced ? { duration: 0.3 } : { type: 'spring' as const, stiffness: 260, damping: 24 }

  return (
    <>
      {inline ? (
        <>
          {/* In the flow under the podium; pinned to the bottom edge only while its spot is below the fold. */}
          <motion.div
            ref={slot}
            className={cn('z-40 mx-auto flex w-full max-w-[600px] justify-center', big ? 'sticky bottom-safe-5' : 'relative', className)}
            // Only one copy of the actions exists for assistive tech (and tests) at a time.
            inert={past}
            aria-hidden={past || undefined}
            initial={enter}
            animate={past ? { opacity: 0, y: 0, transitionEnd: { visibility: 'hidden' } } : { opacity: 1, y: 0, visibility: 'visible' }}
            transition={past ? { duration: 0.15 } : settled ? { duration: 0.2 } : { ...spring, delay }}
            onAnimationComplete={() => setSettled(true)}
          >
            {withCaption(big)}
          </motion.div>
          <AnimatePresence>
            {past && (
              <FloatingDock key="float" reduced={reduced} transition={spring}>
                {withCaption(false)}
              </FloatingDock>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          <div
            aria-hidden
            className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-ink-950/85 via-ink-950/45 to-transparent', caption || hint ? 'h-32' : 'h-24')}
          />
          <motion.div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-safe-3 pb-safe-3"
            initial={enter}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay }}
          >
            {withCaption(false)}
          </motion.div>
        </>
      )}

      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        size="sm"
        title="Chiudere la stanza?"
        description={
          othersOnline === 1
            ? 'L’altro giocatore verrà disconnesso e la partita non potrà essere rigiocata.'
            : `Gli altri ${othersOnline} giocatori verranno disconnessi e la partita non potrà essere rigiocata.`
        }
        footer={
          <>
            <Button variant="glass" onClick={() => setConfirmLeave(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              leftIcon="logout"
              onClick={() => {
                setConfirmLeave(false)
                onLeave()
              }}
            >
              Chiudi stanza
            </Button>
          </>
        }
      />
    </>
  )
}

/** The floating copy of the dock (inline dock scrolled past); leaves the a11y tree as soon as it starts to exit. */
function FloatingDock({ reduced, transition, children }: { reduced: boolean; transition: Transition; children: ReactNode }) {
  const present = useIsPresent()
  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 28, transition: { duration: 0.16 } }}
      transition={transition}
    >
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-ink-950/75 via-ink-950/35 to-transparent" />
      <div className="relative flex justify-center px-safe-4 pb-safe-5">{children}</div>
    </motion.div>
  )
}

function scrollParent(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p
  }
  return null
}

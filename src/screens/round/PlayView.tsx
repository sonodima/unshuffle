// The play phase: HUD on top, the snippet board filling the middle, transport and
// CONFERMA at the bottom. Pure: everything comes from props (+ the board's audio
// context for playback / SFX), so it renders from fixtures in the lab.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SnippetBoard, useAudioBuffer, useBoardAudio, useLocalSegments } from '../../components/board'
import { Icon, cn, useCanHover, useMediaQuery } from '../../components/ui'
import { useBackground } from '../../components/background/useBackground'
import type { AudioStatus } from '../../game/store'
import type { Phase, PlayerId, RoomState } from '../../game/types'
import { useClock, useStepsLeft } from './clock'
import { useOnChange, useStable } from './hooks'
import type { Clock } from './clock'
import { ConfirmDock } from './ConfirmDock'
import type { ConfirmArm, DockState } from './ConfirmDock'
import type { FirstSubmitInfo } from './FirstSubmitBanner'
import { useRoundMenu } from './menuContext'
import { activePlayers, boardOrder, findPlayer, hasSubmitted, isActiveIn, rankOf, roundInfo, roundTotalMs, sameOrder, waitingPlayers } from './model'
import { PlayHud } from './PlayHud'
import './round.css'

// The board only depends on the round and my arrangement, never on the ticking clock.
const Board = memo(SnippetBoard)

type PlayingPhase = Extract<Phase, { kind: 'playing' }>

export interface PlayViewProps {
  room: RoomState
  me: PlayerId
  /** Host clock (ms), refreshed by the parent a few times per second. */
  now: number
  /** Precise host clock; default extrapolates from `now`. */
  clock?: Clock
  /** My arrangement (order[position] = segment index); invalid → the round's initial order. */
  arrangement: readonly number[]
  /** I confirmed this round (optimistic, before the host echoes it). */
  submitted: boolean
  /** Download status of this round's track on this device. */
  audioStatus?: AudioStatus
  onArrange(order: number[]): void
  onSubmit(): void
  /** Download the round's audio again; resolve when decoded. */
  onRetryAudio?(): Promise<unknown>
  /** The link to the host is down (a confirm is queued and sent once it's back). */
  offline?: boolean
}

/** Phone portrait, or any screen too short for the big HUD. */
const WIDE_QUERY = '(min-width: 768px) and (min-height: 600px)'
/** Transport and CONFERMA side by side. */
const ROW_QUERY = '(min-width: 640px)'
const BANNER_MS = 4600
/** Calmer background while people concentrate. */
const PLAY_INTENSITY = 0.55
/** An untouched board asks for a second CONFERMA within this window. */
const ARM_MS = 2600
/** The late joiner's centre card steps aside after this (the dock keeps saying it). */
const SPECTATOR_CARD_MS = 3500

export function PlayView(props: PlayViewProps) {
  const phase = props.room.phase
  if (phase.kind !== 'playing') return null
  const round = props.room.rounds[phase.round]
  if (!round) return <MissingRound />
  return <PlayStage {...props} phase={phase} />
}

function MissingRound() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <p className="rs-breathe display display-skew text-lg text-ink-200">Sincronizzo il round…</p>
    </div>
  )
}

function PlayStage({ room, me, now, clock: clockProp, arrangement, submitted, audioStatus, onArrange, onSubmit, onRetryAudio, offline = false, phase }: PlayViewProps & { phase: PlayingPhase }) {
  const reduce = useReducedMotion()
  const clock = useClock(now, clockProp)
  const { engine, sfx } = useBoardAudio()
  const wide = useMediaQuery(WIDE_QUERY)
  const row = useMediaQuery(ROW_QUERY)
  const canHover = useCanHover()

  const info = roundInfo(room, phase.round)
  const round = info.data!
  const trackKey = `track:${round.track.id}`
  // The host's cut times, re-snapped onto this peer's own decode (Safari decodes ~12 ms early).
  const segments = useLocalSegments(trackKey, useStable(round.segments))
  const hues = useStable(round.hues)
  const initialOrder = useStable(round.initialOrder)
  const order = useMemo(() => boardOrder(arrangement, initialOrder, segments.length), [arrangement, initialOrder, segments.length])

  const mePlayer = findPlayer(room, me)
  const active = isActiveIn(mePlayer, phase.round)
  const iSubmitted = submitted || hasSubmitted(room, me)
  const menu = useRoundMenu()
  const menuOpen = !!menu?.isOpen

  // ---- time ---------------------------------------------------------------
  const secsLeft = useStepsLeft(phase.endsAt, clock)
  const timeUp = secsLeft <= 0
  const remainingMs = Math.max(0, phase.endsAt - clock())
  const totalMs = roundTotalMs(room, phase)

  // ---- audio --------------------------------------------------------------
  const buffer = useAudioBuffer(trackKey)
  const [retry, setRetry] = useState<{ key: string; state: 'pending' | 'failed' } | null>(null)
  const retryState = retry?.key === trackKey ? retry.state : null
  const retrying = retryState === 'pending'
  // Keep the error pill up while retrying (its button shows the spinner) until the buffer is there.
  const audioFailed = !buffer && (audioStatus === 'error' || retryState !== null)
  const retryAudio = useCallback(() => {
    if (!onRetryAudio) return
    setRetry({ key: trackKey, state: 'pending' })
    onRetryAudio().then(
      () => setRetry(null),
      () => setRetry({ key: trackKey, state: 'failed' }),
    )
  }, [onRetryAudio, trackKey])

  const stopOwnAudio = useCallback(() => {
    try {
      const s = engine?.getState()
      if (s?.playing && s.key === trackKey && (s.tag === 'board' || s.tag?.startsWith('block:'))) engine?.stop()
    } catch {
      // Audio is optional.
    }
  }, [engine, trackKey])

  // ---- players ------------------------------------------------------------
  const players = activePlayers(room, phase.round)
  const checked = useMemo(() => {
    const set = new Set<PlayerId>()
    for (const p of room.players) if (hasSubmitted(room, p.id)) set.add(p.id)
    if (iSubmitted) set.add(me)
    return set
  }, [room, iSubmitted, me])
  const waitingNow = waitingPlayers(room, phase.round, me)
  const waiting = useStable(waitingNow)
  const rank = active ? rankOf(room, me) : 0

  // ---- background ---------------------------------------------------------
  useEffect(() => {
    useBackground.getState().setIntensity(PLAY_INTENSITY)
    return () => {
      // The next screen may already have set its own mood while this one animates out.
      const bg = useBackground.getState()
      if (bg.intensity === PLAY_INTENSITY) bg.setIntensity(1)
    }
  }, [])

  // ---- ticks + time up ----------------------------------------------------
  useOnChange(secsLeft, (s, prev) => {
    if (s < prev && s >= 1 && s <= 10) sfx(s <= 3 ? 'tickUrgent' : 'tick', iSubmitted || !active ? { gain: 0.6 } : undefined)
    if (s === 0) stopOwnAudio()
  })

  // ---- first submit ---------------------------------------------------------
  const first = phase.firstSubmit
  const firstKey = first ? `${first.playerId}:${first.at}` : null
  const [bannerGone, setBannerGone] = useState<string | null>(null)
  const bannerUntil = first ? first.at + BANNER_MS : 0
  const showBanner = !!firstKey && bannerGone !== firstKey && bannerUntil > clock() && !timeUp
  useEffect(() => {
    if (!firstKey) return
    const id = setTimeout(() => setBannerGone(firstKey), Math.max(0, bannerUntil - clock()))
    return () => clearTimeout(id)
  }, [firstKey, bannerUntil, clock])
  useOnChange(firstKey, (key) => {
    if (!key || !first || clock() - first.at > 2500) return
    if (first.playerId !== me) {
      sfx('alarm')
      useBackground.getState().pulse(0.8)
      if (active && !iSubmitted) vibrate([30, 60, 30])
    }
  })
  const bannerInfo = useMemo<FirstSubmitInfo | null>(
    () =>
      showBanner && first && firstKey
        ? { key: firstKey, player: findPlayer(room, first.playerId), mine: first.playerId === me, playing: active && !iSubmitted, secondsLeft: secsLeft }
        : null,
    [showBanner, first, firstKey, room, me, active, iSubmitted, secsLeft],
  )

  // ---- confirm --------------------------------------------------------------
  const canSubmit = active && !iSubmitted && !timeUp
  const [burst, setBurst] = useState(0)
  // The starting shuffle scores 0 by construction: confirming it untouched is almost always a
  // slip, and it would still start everyone's final timer. The first press only arms CONFERMA.
  const untouched = sameOrder(order, initialOrder)
  const [arm, setArm] = useState<{ via: Exclude<ConfirmArm, null>; key: string } | null>(null)
  const armKey = `${trackKey}:${order.join(',')}`
  const armed: ConfirmArm = arm && arm.key === armKey && untouched && canSubmit ? arm.via : null
  useEffect(() => {
    if (!arm) return
    const id = setTimeout(() => setArm(null), ARM_MS)
    return () => clearTimeout(id)
  }, [arm])
  const confirm = useCallback(
    (via: 'pointer' | 'key' = 'pointer') => {
      if (!canSubmit || isDragging()) return
      if (untouched && !armed) {
        setArm({ via: via === 'key' ? 'key' : canHover ? 'click' : 'tap', key: armKey })
        sfx('wrong', { gain: 0.5 })
        vibrate(14)
        return
      }
      setArm(null)
      sfx('submit')
      vibrate(24)
      useBackground.getState().pulse(0.9)
      setBurst((b) => b + 1)
      onSubmit()
    },
    [canSubmit, untouched, armed, armKey, canHover, onSubmit, sfx],
  )
  const onConfirmClick = useCallback(() => confirm('pointer'), [confirm])

  // Cmd/Ctrl+Enter confirms from anywhere, captured before a focused block can play itself.
  // Plain Enter is left to whatever has focus (the CONFERMA button itself, a block, a field):
  // a mouse user who clicked a block to listen must not submit by pressing Enter.
  const confirmRef = useRef(confirm)
  useEffect(() => {
    confirmRef.current = confirm
  })
  useEffect(() => {
    if (!canSubmit || menuOpen) return
    const onModEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.repeat || e.isComposing || isTextTarget(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      confirmRef.current('key')
    }
    window.addEventListener('keydown', onModEnter, true)
    return () => window.removeEventListener('keydown', onModEnter, true)
  }, [canSubmit, menuOpen])

  const dockState: DockState = !active ? 'spectator' : iSubmitted ? 'submitted' : timeUp ? 'timeup' : 'ready'
  const locked = !active || iSubmitted || timeUp

  // ---- spectator card: says it once, then steps aside for the board ------------
  const [spectatorCard, setSpectatorCard] = useState(true)
  useEffect(() => {
    if (active || !spectatorCard) return
    const id = setTimeout(() => setSpectatorCard(false), SPECTATOR_CARD_MS)
    return () => clearTimeout(id)
  }, [active, spectatorCard])

  return (
    <div className="relative flex h-full flex-col" data-round-view="playing" data-locked={locked || undefined}>
      <PlayHud
        info={info}
        compact={!wide}
        remainingMs={remainingMs}
        totalMs={totalMs}
        running={!timeUp}
        finalMode={!!first}
        players={players}
        checked={checked}
        me={me}
        score={mePlayer?.score ?? 0}
        rank={rank}
        showPlayers={players.length > 1}
        banner={bannerInfo}
      />

      <main
        className={wide ? 'relative flex min-h-0 flex-1 flex-col px-safe-6 pt-5 pb-4 lg:px-safe-8' : 'relative flex min-h-0 flex-1 flex-col px-safe-3 pt-3 pb-3'}
        onPointerDownCapture={!active && spectatorCard ? () => setSpectatorCard(false) : undefined}
      >
        <motion.div
          className="relative mx-auto min-h-0 w-full max-w-[1240px] flex-1"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 18 }}
          animate={{ opacity: active ? 1 : spectatorCard ? 0.62 : 0.85, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.05 }}
        >
          <Board className="h-full" trackKey={trackKey} segments={segments} hues={hues} order={order} onOrderChange={onArrange} locked={locked} />
        </motion.div>
        <AnimatePresence>{!active && spectatorCard && <SpectatorCard key="spectator" compact={!wide} />}</AnimatePresence>
      </main>

      <ConfirmDock
        state={dockState}
        stacked={!row}
        roomy={wide}
        trackKey={trackKey}
        segments={segments}
        order={order}
        hues={hues}
        audioFailed={audioFailed}
        retrying={retrying}
        onRetry={onRetryAudio ? retryAudio : undefined}
        onConfirm={onConfirmClick}
        waiting={waiting}
        me={me}
        timedOut={timeUp && !iSubmitted}
        burst={burst}
        showHints={canHover}
        armed={armed}
        // My own confirm the host hasn't echoed yet, while the link is down.
        queued={offline && submitted && !hasSubmitted(room, me)}
      />
      <UrgencyVignette seconds={active && !iSubmitted ? secsLeft : 0} />
    </div>
  )
}

function SpectatorCard({ compact }: { compact: boolean }) {
  const reduce = useReducedMotion()
  const canHover = useCanHover()
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8, transition: { duration: 0.28 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.25 }}
        className={cn(
          // Taps go through to the board (and dismiss the card).
          'glass-flat flex flex-col items-center text-center',
          compact ? 'max-w-[300px] gap-2 rounded-[24px] px-5 py-4' : 'max-w-sm gap-3 rounded-panel px-6 py-6',
        )}
      >
        <span
          className={cn(
            'grid place-items-center rounded-full bg-cyan/12 text-cyan shadow-[inset_0_0_0_1px_rgb(46_230_255/0.35),0_0_30px_-6px_rgb(46_230_255/0.6)]',
            compact ? 'size-11' : 'size-14',
          )}
        >
          <Icon name="eye" size={compact ? 22 : 28} strokeWidth={2.2} />
        </span>
        <h2 className={cn('display display-skew text-white', compact ? 'text-base' : 'text-xl')}>Stai guardando</h2>
        <p className={cn('leading-relaxed font-semibold text-ink-200', compact ? 'text-[13px]' : 'text-sm')}>
          Giocherai dal prossimo round. Intanto {canHover ? 'clicca' : 'tocca'} i blocchi per ascoltare gli spezzoni.
        </p>
      </motion.div>
    </div>
  )
}

/** Coral edge glow that throbs once per second in the final ten seconds. */
function UrgencyVignette({ seconds }: { seconds: number }) {
  const reduce = useReducedMotion()
  const on = seconds >= 1 && seconds <= 10
  const strength = on ? 0.5 + (10 - seconds) * 0.05 : 0
  return (
    <AnimatePresence>
      {on && (
        <motion.div
          key="vignette"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          <motion.div
            key={seconds}
            className="absolute inset-0"
            style={{ boxShadow: `inset 0 0 120px 10px rgb(255 84 112 / ${strength.toFixed(2)})` }}
            initial={{ opacity: reduce ? 0.7 : 1 }}
            animate={{ opacity: reduce ? 0.7 : 0.3 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not supported.
  }
}

/** A snippet drag (pointer or keyboard) is in progress. */
function isDragging(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('.sb-board[data-dragging]')
}

function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || !!t.closest('input, textarea, select'))
}

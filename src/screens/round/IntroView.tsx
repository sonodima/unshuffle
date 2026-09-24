// GeoGuessr-style round card: huge "ROUND 3 / 5", progress, round facts, then a
// 3-2-1 countdown synced to the host's phase.endsAt. The "VIA!" burst itself is
// drawn by RoundView (it must outlive this view's exit).
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Icon, ProgressDots, cn, useCanHover } from '../../components/ui'
import { useBackground } from '../../components/background/useBackground'
import { useBoardAudio } from '../../components/board'
import type { PlayerId, RoomState } from '../../game/types'
import { rich, useT } from '../../i18n/react'
import { useClock, useStepsLeft } from './clock'
import { useOnChange } from './hooks'
import type { Clock } from './clock'
import { findPlayer, isActiveIn, roundInfo } from './model'
import './round.css'

interface IntroViewProps {
  room: RoomState
  /** Viewer id: late joiners get a "spectator" note. */
  me?: PlayerId
  /** Host clock (ms), refreshed by the parent a few times per second. */
  now: number
  /** Precise host clock; default extrapolates from `now`. */
  clock?: Clock
  /** Countdown reached zero while this view was on screen. */
  onGo?: () => void
}

const COUNT_FROM = 3
const TICK_PITCH: Record<number, number> = { 3: 1, 2: 1.12, 1: 1.26 }
/** Digit colour + glow per step: violet-white, magenta, lime (then the lime "VIA!"). */
const STEP_TONE: Record<number, { text: string; glow: string; ring: string; ringGlow: string }> = {
  3: { text: 'text-white', glow: '0 0 34px rgb(161 139 255 / 0.65)', ring: 'var(--color-violet-bright)', ringGlow: 'var(--color-violet)' },
  2: { text: 'text-magenta', glow: '0 0 34px rgb(255 63 209 / 0.6)', ring: 'var(--color-magenta)', ringGlow: 'var(--color-magenta)' },
  1: { text: 'text-lime', glow: '0 0 34px rgb(166 255 63 / 0.65)', ring: 'var(--color-lime)', ringGlow: 'var(--color-lime)' },
}

export function IntroView({ room, me, now, clock: clockProp, onGo }: IntroViewProps) {
  const t = useT()
  const phase = room.phase
  const endsAt = phase.kind === 'intro' ? phase.endsAt : 0
  const clock = useClock(now, clockProp)
  const { sfx } = useBoardAudio()
  const reduce = useReducedMotion()
  const canHover = useCanHover()
  const steps = useStepsLeft(endsAt, clock)

  useOnChange(steps, (s) => {
    if (s >= 1 && s <= COUNT_FROM) {
      sfx('tick', { pitch: TICK_PITCH[s] ?? 1 })
      useBackground.getState().pulse(0.35)
    }
    if (s === 0) onGo?.()
  })

  if (phase.kind !== 'intro') return null
  const info = roundInfo(room, phase.round)
  const counting = steps >= 1 && steps <= COUNT_FROM
  // The count owns the stage from "3" until the view leaves (also at 0, while "VIA!" takes over).
  const staged = steps <= COUNT_FROM
  const playlist = room.settings.playlist
  const spectator = me != null && !isActiveIn(findPlayer(room, me), phase.round)

  const item = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { delay } } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28, delay } },
        }

  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-safe-4 pt-safe-4 pb-safe-6" data-round-view="intro">
      {/* Spotlight behind the card */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[min(120vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgb(123 92 255 / 0.28), rgb(255 63 209 / 0.08) 55%, transparent 72%)' }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.3, transition: { duration: 0.4 } }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.div
        className="relative flex w-full max-w-[860px] flex-col items-center text-center"
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, y: -24, filter: 'blur(10px)', transition: { duration: 0.34, ease: [0.4, 0, 1, 1] } }}
      >
        <motion.div {...item(0)} className="mb-4 flex min-h-6 items-center gap-2 sm:mb-6 [@media(max-height:560px)]:mb-2">
          {info.isLast ? (
            <Badge tone="gold" variant="solid" size="md" icon="flag">
              {t('round.intro.lastRound')}
            </Badge>
          ) : playlist ? (
            <span className="eyebrow flex items-center gap-1.5">
              <Icon name="music" size={13} strokeWidth={2.6} />
              <span className="max-w-[60vw] truncate">{playlist.title}</span>
            </span>
          ) : null}
        </motion.div>

        {/* The headline steps back (towards its baseline) when the count takes the stage. */}
        <motion.h1
          aria-label={t('round.intro.headlineLabel', { number: info.number, total: info.total })}
          className="display relative flex origin-bottom items-baseline justify-center leading-none whitespace-nowrap text-white"
          style={{ fontSize: 'clamp(40px, min(13vw, 17vh), 156px)' }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.7, filter: 'blur(14px)' }}
          animate={{ opacity: staged ? 0.92 : 1, scale: staged && !reduce ? 0.64 : 1, filter: 'blur(0px)' }}
          transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: staged ? 26 : 22, mass: 0.9 }}
        >
          {rich(t('round.intro.headline', { number: info.number, total: info.total }), {
            word: (c) => <span className="display-skew inline-block drop-shadow-[0_8px_30px_rgb(123_92_255/0.55)]">{c}</span>,
            n: (c) => <span className="display-skew text-gradient-lime ml-[0.2em] inline-block pr-[0.04em] drop-shadow-[0_0_40px_rgb(166_255_63/0.35)]">{c}</span>,
            total: (c) => <span className="display-skew ml-[0.08em] inline-block text-[0.34em] text-ink-300">{c}</span>,
          })}
        </motion.h1>

        {/* Round facts step back with the headline while the count runs. */}
        <div className={cn('flex flex-col items-center transition-opacity duration-500', staged && 'opacity-55')}>
          <motion.div {...item(0.18)} className="mt-5 sm:mt-7 [@media(max-height:560px)]:mt-3">
            <ProgressDots total={info.total} current={info.index} size="lg" />
          </motion.div>

          <motion.ul
            {...item(0.28)}
            className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-2.5 [@media(max-height:560px)]:mt-3"
            aria-label={t('round.intro.rulesLabel')}
          >
            <Fact icon="scissors">{rich(t('round.intro.snippets', { count: info.snippets }), { b: factNumber })}</Fact>
            <Fact icon="clock">{rich(t('round.intro.seconds', { seconds: info.roundTimeSec }), { b: factNumber })}</Fact>
            {info.difficulty && <Fact icon="bolt">{info.difficulty}</Fact>}
            {info.cuts === 'free' && <Fact icon="wave">{t('game.cut.free')}</Fact>}
          </motion.ul>
        </div>

        <motion.div {...item(0.38)} className="mt-7 sm:mt-10 [@media(max-height:560px)]:mt-3">
          <Countdown steps={steps} counting={counting} staged={staged} stepElapsedMs={counting ? Math.max(0, 1000 - (endsAt - clock() - (steps - 1) * 1000)) : 0} />
        </motion.div>

        <motion.p {...item(0.5)} className="mt-7 max-w-[34ch] text-[13px] leading-relaxed font-semibold text-ink-300 sm:mt-9 sm:text-sm [@media(max-height:560px)]:hidden">
          {spectator ? (
            <span className="inline-flex items-center gap-1.5 text-cyan">
              <Icon name="eye" size={15} strokeWidth={2.4} />
              {t('round.intro.spectator')}
            </span>
          ) : canHover ? (
            t('round.intro.howToHover')
          ) : (
            t('round.intro.howToTouch')
          )}
        </motion.p>
      </motion.div>
    </div>
  )
}

const factNumber = (c: string) => <b className="num text-white">{c}</b>

function Fact({ icon, children }: { icon: 'scissors' | 'clock' | 'bolt' | 'wave'; children: ReactNode }) {
  return (
    <li className="glass-subtle flex h-9 items-center gap-2 rounded-full pr-4 pl-3 text-[13px] font-bold text-ink-200 sm:h-10 sm:text-sm">
      <Icon name={icon} size={15} strokeWidth={2.4} className="text-violet-bright" />
      <span>{children}</span>
    </li>
  )
}

const RING = 44
const RING_C = 2 * Math.PI * RING

/** One second of ring draining; a late mount starts part-way so it stays in sync with the host. */
function DrainArc({ step, elapsedMs }: { step: number; elapsedMs: number }) {
  const [delay] = useState(() => -Math.min(990, Math.max(0, elapsedMs)))
  const tone = STEP_TONE[step] ?? STEP_TONE[3]
  return (
    <circle
      className="rs-drain"
      cx="50"
      cy="50"
      r={RING}
      fill="none"
      stroke={tone.ring}
      strokeWidth="5"
      strokeLinecap="round"
      strokeDasharray={RING_C}
      style={{
        ['--rs-circ' as string]: String(RING_C),
        animationDelay: `${delay}ms`,
        filter: `drop-shadow(0 0 6px ${tone.ringGlow})`,
      }}
    />
  )
}

function Countdown({ steps, counting, staged, stepElapsedMs }: { steps: number; counting: boolean; staged: boolean; stepElapsedMs: number }) {
  const t = useT()
  const reduce = useReducedMotion()
  const tone = STEP_TONE[steps] ?? STEP_TONE[3]
  // A punch on every tick (the ring itself grows via CSS when the count starts).
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  useOnChange(steps, (s) => {
    if (reduce || s < 1 || s > COUNT_FROM || !scope.current) return
    animate(scope.current, { scale: [1, 1.12, 1] }, { duration: 0.2, ease: 'easeOut' })
  })
  return (
    <div className="rs-cd relative grid place-items-center" data-counting={staged || undefined} role="timer" aria-live="off" aria-label={counting ? t('round.intro.countdownLabel', { seconds: steps }) : t('round.intro.readyLabel')}>
      <span ref={scope} aria-hidden className="absolute inset-0">
        <span
          className="absolute inset-0 rounded-full border border-white/10 bg-ink-950/75 transition-shadow duration-300"
          style={{ boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.08), 0 14px 40px -12px rgb(0 0 0 / 0.8), 0 0 ${staged ? 70 : 50}px -10px ${counting ? tone.ringGlow : 'rgb(123 92 255 / 0.6)'}` }}
        />
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90 overflow-visible">
          <circle cx="50" cy="50" r={RING} fill="none" stroke="rgb(161 139 255 / 0.16)" strokeWidth="5" />
          <circle cx="50" cy="50" r={RING - 7} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="1.2" strokeDasharray="0.6 3.9" />
          {counting && <DrainArc key={steps} step={steps} elapsedMs={stepElapsedMs} />}
        </svg>
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        {counting ? (
          <motion.span
            key={steps}
            className="relative block"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.9, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.55, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          >
            <span className={cn('rs-cd-digit display display-skew block pr-[0.06em] leading-none', tone.text)} style={{ textShadow: tone.glow }}>
              {steps}
            </span>
          </motion.span>
        ) : steps > COUNT_FROM ? (
          <motion.span
            key="ready"
            className="rs-breathe display display-skew relative inline-block text-[13px] text-ink-200 sm:text-[15px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            {t('round.intro.ready')}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

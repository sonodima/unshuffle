// Decorative, silent demo of a round: colourful snippet blocks play in
// sequence, get dragged back into order one by one, flash lime when solved,
// then reshuffle. Pure motion/CSS, pauses off-screen and in hidden tabs, and
// parks on the solved board while the user is idle.
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatedNumber, Icon, cn, formatClock, formatNumber } from '../../components/ui'
import type { MessageKey } from '../../i18n'
import { useT } from '../../i18n/react'
import { DEMO_HUES, DEMO_LETTERS, songEnvelope } from './demoScript'
import { DEMO_TIMING, useDemoLoop, type DemoPhase, type DemoState } from './useDemoLoop'
import './home.css'

// ---------------------------------------------------------------- block

interface DemoBlockProps {
  hue: number
  letter: string
  bars: number[]
  playing?: boolean
  playMs?: number
  lifted?: boolean
  solved?: boolean
  /** Stagger of the solved check, ms. */
  delayMs?: number
  compact?: boolean
  className?: string
  style?: CSSProperties
}

/** One decorative snippet block (same look as the real board, fake waveform). */
export const DemoBlock = memo(function DemoBlock({
  hue,
  letter,
  bars,
  playing,
  playMs = DEMO_TIMING.playMs,
  lifted,
  solved,
  delayMs = 0,
  compact,
  className,
  style,
}: DemoBlockProps) {
  const w = bars.length * 10
  const shapes = bars.map((v, i) => {
    const h = Math.max(8, v * 100)
    return <rect key={i} x={i * 10 + 2} y={50 - h / 2} width={6} height={h} rx={3} />
  })
  return (
    <div
      className={cn('hm-block', className)}
      data-playing={playing || undefined}
      data-lifted={lifted || undefined}
      data-solved={solved || undefined}
      data-compact={compact || undefined}
      style={{ '--h': hue, '--d': `${delayMs}ms`, '--play-ms': `${playMs}ms`, ...style } as CSSProperties}
      aria-hidden
    >
      <div className="hm-lift">
        <div className="hm-glow" />
        <div className="hm-rim" />
        <div className="hm-face">
          <div className="hm-gloss" />
          <svg className="hm-wave" viewBox={`0 0 ${w} 100`} preserveAspectRatio="none">
            <g className="hm-wave-base">{shapes}</g>
            <g className="hm-wave-fill">{shapes}</g>
          </svg>
          <span className="hm-letter">{letter}</span>
        </div>
        <div className="hm-check">
          <Icon name="check" size={16} strokeWidth={3.6} />
        </div>
        <div className="hm-touch" />
      </div>
    </div>
  )
})

// ---------------------------------------------------------------- board

const LAYOUT_SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 }
const CARRY_SPRING = { type: 'spring' as const, stiffness: 230, damping: 26, mass: 1 }
const SHUFFLE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 24, mass: 1 }

interface DemoBoardProps {
  state: DemoState
  count: number
  columns: number
  compact?: boolean
  /** Block aspect ratio (width / height). Omit to stretch the rows over the board's height. */
  aspect?: number
  gap: number
  className?: string
}

function DemoBoard({ state, count, columns, compact, aspect, gap, className }: DemoBoardProps) {
  const envelope = useMemo(() => songEnvelope(count, compact ? 9 : 14), [count, compact])
  const solved = state.phase === 'solved'
  const rows = Math.ceil(count / columns)
  return (
    <div
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: aspect ? undefined : `repeat(${rows}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {state.order.map((id, pos) => {
        const lifted = state.lifted === id
        return (
          <motion.div
            key={id}
            layout="position"
            // Measure (and animate) only when this block actually changes slot: the
            // "playing" highlight re-renders the board every ~240ms and would
            // otherwise force two layout passes each time.
            layoutDependency={pos}
            transition={lifted ? CARRY_SPRING : state.phase === 'shuffle' ? { ...SHUFFLE_SPRING, delay: (id % columns) * 0.035 } : LAYOUT_SPRING}
            // Own compositor layer: sliding blocks are moved, not repainted, under the glass blur.
            className="relative will-change-transform"
            style={{ aspectRatio: aspect, zIndex: lifted ? 5 : 1, minHeight: aspect ? undefined : 0 }}
          >
            <DemoBlock
              hue={DEMO_HUES[id % DEMO_HUES.length]}
              letter={DEMO_LETTERS[id % DEMO_LETTERS.length]}
              bars={envelope[id]}
              playing={state.playing === pos}
              lifted={lifted}
              solved={solved}
              delayMs={pos * 70}
              compact={compact}
            />
          </motion.div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- panel (desktop)

const STEPS: { phase: DemoPhase; label: MessageKey; icon: 'headphones' | 'grip' | 'check' }[] = [
  { phase: 'listen', label: 'home.demo.steps.listen', icon: 'headphones' },
  { phase: 'sort', label: 'home.demo.steps.sort', icon: 'grip' },
  { phase: 'solved', label: 'home.demo.steps.confirm', icon: 'check' },
]

/** Fake round clock shown by the desktop demo. */
const DEMO_ROUND_MS = 20_000
/** Points "won" when the demo board is solved. */
const DEMO_POINTS = 5000

const CAPTION: Record<DemoPhase, MessageKey> = {
  shuffle: 'home.demo.caption.shuffle',
  listen: 'home.demo.caption.listen',
  sort: 'home.demo.caption.sort',
  solved: 'home.demo.caption.solved',
}

interface ShuffleDemoProps {
  /** Number of blocks. Default 8. */
  count?: number
  /** Grid columns. Default 4. */
  columns?: number
  /** Freeze the loop (e.g. while an overlay covers it). */
  paused?: boolean
  /** The user is idle: finish the current cycle, then rest on the solved board. */
  idle?: boolean
  className?: string
}

/**
 * The demo's fake round clock. The bar drains with a compositor-only CSS
 * animation (no per-frame layout or paint, unlike a width-driven bar); the
 * digits re-render once per second. `running` false freezes both.
 */
function DemoTimer({ totalMs, running, resetKey, className }: { totalMs: number; running: boolean; resetKey: number; className?: string }) {
  // Both keyed by the cycle: a new cycle starts from a full clock without a reset effect.
  const [shown, setShown] = useState({ key: resetKey, left: totalMs })
  const elapsed = useRef({ key: resetKey, ms: 0 })

  useEffect(() => {
    if (!running) return
    if (elapsed.current.key !== resetKey) elapsed.current = { key: resetKey, ms: 0 }
    const start = performance.now() - elapsed.current.ms
    const nextIn = (ms: number) => ((totalMs - ms) % 1000 || 1000) + 4 // just past the next whole second
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const ms = Math.min(totalMs, performance.now() - start)
      elapsed.current = { key: resetKey, ms }
      setShown({ key: resetKey, left: totalMs - ms })
      if (ms < totalMs) timer = setTimeout(tick, nextIn(ms))
    }
    timer = setTimeout(tick, nextIn(elapsed.current.ms))
    return () => {
      clearTimeout(timer)
      elapsed.current = { key: resetKey, ms: Math.min(totalMs, performance.now() - start) }
    }
  }, [running, totalMs, resetKey])

  const left = shown.key === resetKey ? shown.left : totalMs
  const play: CSSProperties = { animationDuration: `${totalMs}ms`, animationPlayState: running ? 'running' : 'paused' }
  return (
    <div className={cn('flex w-full items-center gap-3', className)} aria-hidden>
      <div className="relative h-1.5 flex-1">
        <div key={`g${resetKey}`} className="hm-timer-glow" style={play} />
        <div className="absolute inset-0 overflow-hidden rounded-full bg-ink-950/60 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.08)]">
          <div key={`f${resetKey}`} className="hm-timer-fill" style={play}>
            <span className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
      <span className="num min-w-[3.2ch] text-right text-sm font-bold text-ink-50">{formatClock(left)}</span>
    </div>
  )
}

/** Desktop showcase: a mini round HUD around the demo board. Memoized: Home re-renders on every keystroke. */
export const ShuffleDemo = memo(function ShuffleDemo({ count = 8, columns = 4, paused = false, idle = false, className }: ShuffleDemoProps) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const state = useDemoLoop(count, ref, paused, idle)
  const active = state.phase === 'shuffle' ? -1 : STEPS.findIndex((s) => s.phase === state.phase)
  const solved = state.phase === 'solved'

  return (
    <div ref={ref} className={cn('flex flex-col', className)} data-demo-rest={state.resting || undefined}>
      <div className="flex items-center justify-between gap-4 pb-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-magenta/35 bg-magenta/15 px-2.5 text-[10px] font-extrabold tracking-[0.16em] text-magenta uppercase">
            <span
              className={cn(
                'size-1.5 rounded-full bg-magenta shadow-[0_0_8px_var(--color-magenta)] transition-opacity duration-500',
                state.resting || state.frozen ? 'opacity-60' : 'animate-blink',
              )}
            />
            {t('home.demo.badge')}
          </span>
          <div className="relative h-6 min-w-0 flex-1 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={state.phase}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className={cn('absolute inset-0 truncate text-[15px] leading-6 font-bold', solved ? 'text-lime' : 'text-ink-50')}
              >
                {t(CAPTION[state.phase])}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <div
          className={cn(
            'num flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition-colors duration-300',
            solved ? 'border-lime/40 bg-lime/12 text-lime' : 'border-white/10 bg-ink-950/40 text-ink-300',
          )}
          aria-hidden
        >
          <Icon name="star" size={14} filled />
          <AnimatedNumber key={state.cycle} value={solved ? DEMO_POINTS : 0} from={0} duration={0.9} signed />
        </div>
      </div>

      <DemoTimer
        totalMs={DEMO_ROUND_MS}
        running={(state.phase === 'listen' || state.phase === 'sort') && !state.frozen}
        resetKey={state.cycle}
        className="mb-5"
      />

      <DemoBoard state={state} count={count} columns={columns} gap={12} className="min-h-[190px] flex-1" />

      <ol className="mt-5 grid grid-cols-3 gap-2" aria-label={t('home.demo.stepsLabel')}>
        {STEPS.map((step, i) => {
          const on = i === active
          const done = active > i
          return (
            <li
              key={step.phase}
              className={cn(
                'relative flex h-11 items-center gap-2 overflow-hidden rounded-2xl border px-3 text-[13px] font-bold transition-[background-color,border-color,color] duration-300',
                on
                  ? i === 2
                    ? 'border-lime/50 bg-lime/14 text-lime'
                    : 'border-violet/60 bg-violet/20 text-white'
                  : done
                    ? 'border-white/8 bg-white/[0.04] text-ink-200'
                    : 'border-white/6 bg-transparent text-ink-400',
              )}
            >
              <span
                className={cn(
                  'num grid size-6 shrink-0 place-items-center rounded-full text-[11px] transition-colors duration-300',
                  on ? (i === 2 ? 'bg-lime text-ink-950' : 'bg-violet text-white') : done ? 'bg-white/12 text-ink-100' : 'bg-white/6 text-ink-400',
                )}
              >
                {done ? <Icon name="check" size={12} strokeWidth={3.4} /> : i + 1}
              </span>
              <span className="truncate">{t(step.label)}</span>
              <Icon name={step.icon} size={16} className={cn('ml-auto shrink-0 transition-opacity', on ? 'opacity-90' : 'opacity-35')} />
            </li>
          )
        })}
      </ol>
    </div>
  )
})

// ---------------------------------------------------------------- strip (phone)

interface DemoStripProps {
  count?: number
  paused?: boolean
  /** The user is idle: finish the current cycle, then rest on the solved board. */
  idle?: boolean
  className?: string
}

/** Compact one-row demo for phones, with a one-line caption. Memoized like ShuffleDemo. */
export const DemoStrip = memo(function DemoStrip({ count = 6, paused = false, idle = false, className }: DemoStripProps) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const state = useDemoLoop(count, ref, paused, idle)
  const solved = state.phase === 'solved'
  return (
    <div ref={ref} className={cn('flex flex-col items-center gap-2.5', className)} data-demo-rest={state.resting || undefined} aria-hidden>
      <DemoBoard state={state} count={count} columns={count} compact aspect={0.82} gap={7} className="w-full" />
      <div className="relative h-5 w-full overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={state.phase}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn('absolute inset-0 truncate text-center text-xs leading-5 font-bold', solved ? 'text-lime' : 'text-ink-300')}
          >
            {solved ? t('home.demo.solvedPoints', { points: formatNumber(DEMO_POINTS) }) : t(CAPTION[state.phase])}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
})

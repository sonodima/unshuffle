import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../ui/cn'

const WORD = 'UNSHUFFLE'
const LETTERS = [...WORD]
const IDENTITY = LETTERS.map((_, i) => i)

export type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

const FONT: Record<LogoSize, string> = {
  sm: '1.125rem',
  md: '1.75rem',
  lg: 'clamp(1.75rem, 8.4vw, 2.75rem)',
  xl: 'clamp(2.4rem, 10.2vw, 5.25rem)',
  hero: 'clamp(2.6rem, 11.4vw, 7.5rem)',
}

export interface LogoProps {
  /** sm 18px · md 28px · lg fluid up to 44px · xl fluid up to 84px · hero fluid up to 120px. Default lg. */
  size?: LogoSize
  /** Play the shuffle → settle intro on mount. Default true (off with reduced motion). */
  animate?: boolean
  /** Extra ms before the letters unshuffle. */
  delay?: number
  /** Change to replay the intro. */
  replayKey?: string | number
  /** Prefix the square mark. */
  mark?: boolean
  onSettled?(): void
  className?: string
}

/** Random permutation that moves most letters (so the unshuffle reads). */
function scramble(): number[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const o = [...IDENTITY]
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[o[i], o[j]] = [o[j], o[i]]
    }
    const displaced = o.filter((v, i) => v !== i).length
    if (displaced >= o.length - 1) return o
  }
  return [4, 8, 1, 6, 0, 3, 7, 2, 5]
}

function bandOffset(seed: number): number {
  // Deterministic-looking jitter in em for each cut band.
  const v = Math.sin(seed * 12.9898) * 43758.5453
  return (v - Math.floor(v) - 0.5) * 0.5
}

/**
 * UNSHUFFLE wordmark: heavy slanted Unbounded, every letter sliced in two like
 * an audio snippet. On mount the letters arrive shuffled, then spring back into
 * order while the slices snap together.
 */
export function Logo({ size = 'lg', animate = true, delay = 0, replayKey, mark = false, onSettled, className }: LogoProps) {
  const reduce = useReducedMotion()
  const play = animate && !reduce
  const [order, setOrder] = useState<number[]>(() => (play ? scramble() : IDENTITY))
  const [settled, setSettled] = useState(!play)
  const [cycle, setCycle] = useState(0)
  const lastKey = useRef(replayKey)

  useEffect(() => {
    if (!play) {
      setOrder(IDENTITY)
      setSettled(true)
      return
    }
    if (lastKey.current !== replayKey) {
      lastKey.current = replayKey
      setOrder(scramble())
      setSettled(false)
      setCycle((c) => c + 1)
    }
    let cancelled = false
    const fonts = typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve()
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    Promise.race([fonts, wait(900)])
      .then(() => wait(420 + delay))
      .then(() => {
        if (cancelled) return
        setOrder(IDENTITY)
        setSettled(true)
      })
    return () => {
      cancelled = true
    }
  }, [play, delay, replayKey])

  useEffect(() => {
    if (!settled || !onSettled) return
    const t = setTimeout(onSettled, play ? 650 : 0)
    return () => clearTimeout(t)
  }, [settled, onSettled, play])

  const spring = { type: 'spring' as const, stiffness: 260, damping: 22, mass: 0.9 }

  return (
    <span
      role="img"
      aria-label={WORD}
      className={cn('inline-flex items-center select-none', className)}
      style={{ fontSize: FONT[size], gap: '0.32em' }}
    >
      {mark && <LogoMark size="1.05em" animate={animate} />}
      <span
        aria-hidden
        className="display-skew relative inline-flex font-display leading-none"
        style={
          {
            // The wordmark is Latin in every language: keep its slant on CJK pages too.
            '--text-skew': '-7deg',
            fontWeight: 900,
            letterSpacing: '-0.035em',
            paddingInline: '0.07em',
            filter: 'drop-shadow(0 0.055em 0 var(--color-violet-deep)) drop-shadow(0 0.14em 0.22em rgb(6 4 15 / 0.55))',
          } as CSSProperties
        }
      >
        {order.map((li, pos) => {
          const ch = LETTERS[li]
          const t = li / (LETTERS.length - 1)
          const bottomFill = `linear-gradient(180deg, color-mix(in oklab, var(--color-magenta) ${Math.round(100 - t * 70)}%, var(--color-violet-bright)) 0%, color-mix(in oklab, var(--color-magenta-deep) ${Math.round(100 - t * 70)}%, var(--color-violet-deep)) 100%)`
          return (
            <motion.span
              key={li}
              layout={play ? 'position' : false}
              transition={{ ...spring, delay: settled ? li * 0.028 : 0 }}
              initial={play ? { opacity: 0, y: '0.35em', scale: 0.85 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="relative inline-block"
              style={{ zIndex: settled ? 1 : 1 + ((pos * 7) % 5) }}
            >
              <span className="invisible">{ch}</span>
              <motion.span
                key={`t${cycle}`}
                className="absolute inset-0 text-transparent"
                style={{
                  clipPath: 'inset(-0.2em -0.1em 50% -0.1em)',
                  backgroundImage: 'linear-gradient(180deg, white 30%, var(--color-ink-100) 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }}
                initial={play ? { x: `${bandOffset(li + 1)}em` } : false}
                animate={{ x: settled ? '0em' : `${bandOffset(li + 1)}em` }}
                transition={{ ...spring, stiffness: 340, delay: settled ? 0.1 + li * 0.03 : 0 }}
              >
                {ch}
              </motion.span>
              <motion.span
                key={`b${cycle}`}
                className="absolute inset-0 text-transparent"
                style={{
                  clipPath: 'inset(calc(50% + 0.045em) -0.1em -0.2em -0.1em)',
                  backgroundImage: bottomFill,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }}
                initial={play ? { x: `${bandOffset(li + 11)}em` } : false}
                animate={{ x: settled ? '0.035em' : `${bandOffset(li + 11)}em` }}
                transition={{ ...spring, stiffness: 300, delay: settled ? 0.16 + li * 0.03 : 0 }}
              >
                {ch}
              </motion.span>
            </motion.span>
          )
        })}
      </span>
    </span>
  )
}

const BAR_HEIGHTS = [0.36, 0.58, 0.8, 1]
const MARK_SCRAMBLE = [2, 0, 3, 1]

export interface LogoMarkProps {
  /** CSS size (px number or any length). Default 44. */
  size?: number | string
  /** Bars start shuffled and sort themselves on mount. Default true. */
  animate?: boolean
  className?: string
}

/** Compact square mark: four equalizer bars that sort themselves into order. */
export function LogoMark({ size = 44, animate = true, className }: LogoMarkProps) {
  const reduce = useReducedMotion()
  const play = animate && !reduce
  const [order, setOrder] = useState<number[]>(() => (play ? MARK_SCRAMBLE : [0, 1, 2, 3]))

  useEffect(() => {
    if (!play) {
      setOrder([0, 1, 2, 3])
      return
    }
    const t = setTimeout(() => setOrder([0, 1, 2, 3]), 650)
    return () => clearTimeout(t)
  }, [play])

  const s = typeof size === 'number' ? `${size}px` : size
  return (
    <span
      role="img"
      aria-label="UNSHUFFLE"
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: s, height: s, fontSize: s }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-[30%]"
        style={{
          background: 'linear-gradient(145deg, var(--color-violet-bright) 0%, var(--color-violet) 38%, var(--color-magenta) 100%)',
          boxShadow:
            'inset 0 0.03em 0 rgb(255 255 255 / 0.55), inset 0 -0.05em 0.08em rgb(0 0 0 / 0.2), 0 0.07em 0 var(--color-violet-deep), 0 0.16em 0.3em -0.06em rgb(255 63 209 / 0.55)',
        }}
      />
      <span aria-hidden className="absolute inset-x-[12%] top-[5%] h-[40%] rounded-[40%] bg-linear-to-b from-white/35 to-white/0" />
      <span aria-hidden className="relative flex h-[58%] w-[58%] -skew-x-[7deg] items-center justify-between">
        {order.map((bar) => (
          <motion.span
            key={bar}
            layout={play ? 'position' : false}
            transition={{ type: 'spring', stiffness: 380, damping: 24, delay: bar * 0.04 }}
            className={cn('block w-[19%] rounded-full', bar === 3 ? 'bg-lime' : 'bg-white')}
            style={{
              height: `${BAR_HEIGHTS[bar] * 100}%`,
              boxShadow: bar === 3 ? '0 0 0.12em rgb(166 255 63 / 0.9)' : '0 0.02em 0 rgb(0 0 0 / 0.15)',
            }}
          />
        ))}
      </span>
    </span>
  )
}

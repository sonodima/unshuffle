import type { CSSProperties } from 'react'
import { cn } from '../ui/cn'

export interface EqualizerProps {
  /** Number of bars. Default 5. */
  bars?: number
  /** Height in px. Default 28. Bar width scales with it. */
  size?: number
  /** Animate (true) or rest at low levels (false). Default true. */
  playing?: boolean
  /** gradient = violet→magenta→cyan (default) · current = currentColor · lime. */
  tone?: 'gradient' | 'current' | 'lime'
  className?: string
  /** Screen-reader label; null = decorative. Default "Caricamento…". */
  label?: string | null
}

// Deterministic per-bar rhythm so neighbours never move in lockstep.
const DURATIONS = [0.92, 1.18, 0.78, 1.04, 0.86, 1.26, 0.98, 0.82]
const DELAYS = [-0.3, -0.75, -0.1, -0.55, -0.9, -0.2, -0.65, -0.4]
const REST = [0.35, 0.55, 0.3, 0.5, 0.4, 0.6, 0.32, 0.45]

/** Animated equalizer bars: loader / "now playing" indicator. */
export function Equalizer({ bars = 5, size = 28, playing = true, tone = 'gradient', className, label = 'Caricamento…' }: EqualizerProps) {
  const w = Math.max(2, Math.round(size / 7))
  const gap = Math.max(2, Math.round(w * 0.7))
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0 items-end', className)}
      style={{ height: size, gap }}
    >
      {Array.from({ length: bars }, (_, i) => {
        const hue = bars > 1 ? i / (bars - 1) : 0
        const style: CSSProperties = {
          width: w,
          height: '100%',
          borderRadius: w,
          transformOrigin: 'bottom',
          transform: `scaleY(${REST[i % REST.length]})`,
          transition: 'transform 0.4s var(--ease-out-expo)',
          animation: playing ? `eq-bar ${DURATIONS[i % DURATIONS.length]}s ease-in-out ${DELAYS[i % DELAYS.length]}s infinite` : undefined,
          background:
            tone === 'gradient'
              ? `linear-gradient(to top, color-mix(in oklab, var(--color-violet) ${100 - hue * 100}%, var(--color-cyan)), color-mix(in oklab, var(--color-magenta) ${100 - hue * 60}%, var(--color-cyan)))`
              : tone === 'lime'
                ? 'linear-gradient(to top, var(--color-lime-deep), var(--color-lime))'
                : 'currentColor',
          boxShadow: tone === 'current' ? undefined : '0 0 10px -1px color-mix(in oklab, var(--color-magenta) 60%, transparent)',
        }
        return <span key={i} data-motion-essential="" style={style} />
      })}
    </span>
  )
}

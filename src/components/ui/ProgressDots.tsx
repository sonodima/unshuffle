import { motion, useReducedMotion } from 'motion/react'
import { useT } from '../../i18n/react'
import { cn } from './cn'

export type DotState = 'done' | 'current' | 'upcoming'

export interface ProgressDotsProps {
  total: number
  /** 0-based index of the current step (-1 = none yet; ≥ total = all done). */
  current: number
  /** Optional per-step color for done dots, e.g. perfect rounds in gold. */
  doneTone?: (index: number) => 'lime' | 'gold' | 'coral' | 'violet' | undefined
  size?: 'sm' | 'md' | 'lg'
  /** Accessible text. Default "Round {current+1} di {total}" (ui.progressDots.label). */
  label?: string
  className?: string
}

const DIM = {
  sm: { h: 6, w: 6, cur: 18, gap: 'gap-1' },
  md: { h: 8, w: 8, cur: 26, gap: 'gap-1.5' },
  lg: { h: 10, w: 10, cur: 34, gap: 'gap-2' },
} as const

const TONE = {
  lime: 'bg-lime shadow-[0_0_8px_rgb(166_255_63/0.55)]',
  gold: 'bg-gold shadow-[0_0_8px_rgb(255_210_63/0.6)]',
  coral: 'bg-coral shadow-[0_0_8px_rgb(255_84_112/0.5)]',
  violet: 'bg-violet-bright shadow-[0_0_8px_rgb(123_92_255/0.6)]',
} as const

/** Round progress: done (filled) · current (wide glowing pill) · upcoming (faint). */
export function ProgressDots({ total, current, doneTone, size = 'md', label, className }: ProgressDotsProps) {
  const t = useT()
  const d = DIM[size]
  const reduce = useReducedMotion()
  return (
    <div
      role="img"
      aria-label={label ?? t('ui.progressDots.label', { current: Math.min(current + 1, total), total })}
      className={cn('flex items-center', d.gap, className)}
    >
      {Array.from({ length: total }, (_, i) => {
        const state: DotState = i < current ? 'done' : i === current ? 'current' : 'upcoming'
        return (
          <motion.span
            key={i}
            aria-hidden
            initial={false}
            animate={{ width: state === 'current' ? d.cur : d.w }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
            className={cn(
              'block rounded-full transition-colors duration-300',
              state === 'done' && TONE[doneTone?.(i) ?? 'lime'],
              state === 'current' && 'bg-white shadow-[0_0_12px_rgb(255_255_255/0.6)]',
              state === 'upcoming' && 'bg-white/18',
            )}
            style={{ height: d.h }}
          />
        )
      })}
    </div>
  )
}

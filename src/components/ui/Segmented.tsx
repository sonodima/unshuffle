import { motion, useReducedMotion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from './cn'
import { playSfx } from './sound'

export interface SegmentedOption<T extends string | number> {
  value: T
  /** Main text, e.g. "8" or "90s". */
  label: ReactNode
  /** Small caption under the label, e.g. "Normale". */
  sublabel?: ReactNode
  disabled?: boolean
  /** Accessible name when label is not plain text. */
  ariaLabel?: string
}

export type SegmentedTone = 'violet' | 'lime' | 'magenta' | 'cyan'

export interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange?(value: NoInfer<T>): void
  /** Accessible group name, e.g. "Numero di round". */
  label: string
  /** Visible but not editable (non-host players). */
  readOnly?: boolean
  disabled?: boolean
  /** md 48px (56 with sublabels) · sm 40px. Default md. */
  size?: 'sm' | 'md'
  tone?: SegmentedTone
  className?: string
}

const THUMB: Record<SegmentedTone, string> = {
  violet:
    'bg-linear-to-b from-violet-bright to-violet-deep shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.2),0_6px_18px_-6px_rgb(123_92_255/0.8)]',
  lime: 'bg-linear-to-b from-[color-mix(in_oklab,var(--color-lime)_65%,white)] to-lime shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(0_0_0/0.12),0_6px_18px_-6px_rgb(166_255_63/0.8)]',
  magenta:
    'bg-linear-to-b from-[color-mix(in_oklab,var(--color-magenta)_70%,white)] to-magenta-deep shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.2),0_6px_18px_-6px_rgb(255_63_209/0.8)]',
  cyan: 'bg-linear-to-b from-[color-mix(in_oklab,var(--color-cyan)_65%,white)] to-cyan-deep shadow-[inset_0_1px_0_rgb(255_255_255/0.5),inset_0_-2px_0_rgb(0_0_0/0.15),0_6px_18px_-6px_rgb(46_230_255/0.8)]',
}
const DARK_TEXT: Record<SegmentedTone, boolean> = { violet: false, lime: true, magenta: false, cyan: true }

/** Pill segmented control with a springy sliding thumb. Radio-group semantics, arrow keys. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  readOnly = false,
  disabled = false,
  size = 'md',
  tone = 'violet',
  className,
}: SegmentedProps<T>) {
  const layoutId = useId()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const hasSub = options.some((o) => o.sublabel != null)
  const interactive = !readOnly && !disabled
  const selectedIndex = options.findIndex((o) => o.value === value)

  const select = (o: SegmentedOption<T>) => {
    if (!interactive || o.disabled || o.value === value) return
    playSfx('click', { pitch: 1.15 })
    onChange?.(o.value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    let i = selectedIndex
    for (let step = 0; step < options.length; step++) {
      i = (i + dir + options.length) % options.length
      if (!options[i].disabled) break
    }
    const o = options[i]
    if (o && !o.disabled) {
      select(o)
      ref.current?.querySelector<HTMLElement>(`[data-seg="${i}"]`)?.focus()
    }
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      aria-readonly={readOnly || undefined}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex w-full rounded-[18px] border border-white/[0.08] bg-ink-950/55 p-1 shadow-well',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel}
            data-seg={i}
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            disabled={disabled || o.disabled}
            onClick={() => select(o)}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-[14px] px-1.5 tap-none',
              size === 'md' ? (hasSub ? 'h-14' : 'h-12') : hasSub ? 'h-12' : 'h-10',
              interactive ? 'cursor-pointer' : 'cursor-default',
              o.disabled && 'opacity-40',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className={cn('absolute inset-0 rounded-[14px]', THUMB[tone], readOnly && 'opacity-55 saturate-50')}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 }}
              />
            )}
            <span
              className={cn(
                'relative truncate font-display leading-none font-bold transition-colors duration-200',
                size === 'md' ? 'text-[15px]' : 'text-[13px]',
                selected ? (DARK_TEXT[tone] && !readOnly ? 'text-ink-950' : 'text-white') : 'text-ink-200',
                interactive && !selected && 'group-hover:text-white',
              )}
            >
              {o.label}
            </span>
            {o.sublabel != null && (
              <span
                className={cn(
                  'relative mt-1 truncate text-[10px] leading-none font-bold tracking-[0.08em] uppercase transition-colors duration-200',
                  selected ? (DARK_TEXT[tone] && !readOnly ? 'text-ink-950/70' : 'text-white/80') : 'text-ink-400',
                )}
              >
                {o.sublabel}
              </span>
            )}
            {interactive && !selected && (
              <span aria-hidden className="absolute inset-0 rounded-[14px] transition-colors hover:bg-white/[0.05]" />
            )}
          </button>
        )
      })}
    </div>
  )
}

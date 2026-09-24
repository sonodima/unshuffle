import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from './cn'
import { formatNumber } from './hooks'

export interface AnimatedNumberProps {
  value: number
  /**
   * Start value on mount. Default = `value` (no animation on mount); pass 0 to
   * count up when the component appears. Later changes always animate from the
   * currently displayed number.
   */
  from?: number
  /** Seconds. Default 1.1. */
  duration?: number
  /** Seconds before starting. Default 0. */
  delay?: number
  /** Prefix "+" for positive values (round points). */
  signed?: boolean
  prefix?: string
  suffix?: string
  /** Default: Italian thousands separator ("13.840"). */
  format?(n: number): string
  /** Fires whenever the displayed integer changes (throttled to ~22/s) — hook sfx 'score' here. */
  onTick?(n: number): void
  onDone?(): void
  className?: string
}

/** Count-up number with ease-out, tabular mono digits. Writes to the DOM directly (no re-renders per frame). */
export function AnimatedNumber({
  value,
  from,
  duration = 1.1,
  delay = 0,
  signed = false,
  prefix = '',
  suffix = '',
  format = formatNumber,
  onTick,
  onDone,
  className,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const spanRef = useRef<HTMLSpanElement>(null)
  const shown = useRef(from ?? value)
  const tickRef = useRef(onTick)
  const doneRef = useRef(onDone)
  tickRef.current = onTick
  doneRef.current = onDone

  const render = (n: number) => {
    const r = Math.round(n)
    const sign = signed && r > 0 ? '+' : ''
    return `${prefix}${sign}${format(r)}${suffix}`
  }
  const [initialText] = useState(() => render(from ?? value))

  useEffect(() => {
    const el = spanRef.current
    if (!el) return
    const start = shown.current
    if (start === value || reduce) {
      shown.current = value
      el.textContent = render(value)
      if (start !== value) doneRef.current?.()
      return
    }
    let lastInt = Math.round(start)
    let lastTick = 0
    const controls = animate(start, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shown.current = v
        el.textContent = render(v)
        const i = Math.round(v)
        const now = performance.now()
        if (i !== lastInt && now - lastTick > 45) {
          lastInt = i
          lastTick = now
          tickRef.current?.(i)
        }
      },
      onComplete: () => {
        shown.current = value
        el.textContent = render(value)
        doneRef.current?.()
      },
    })
    return () => controls.stop()
    // Formatting props are read at animation time; only a new value restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce])

  return (
    <span className={cn('num inline-block', className)}>
      <span className="sr-only">{render(value)}</span>
      <span ref={spanRef} aria-hidden>
        {initialText}
      </span>
    </span>
  )
}

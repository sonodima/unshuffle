import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/react'
import { cn } from './cn'
import { formatClock, formatNumber } from './format'
import { barTransform, shouldWriteArc, timerFraction } from './timerMath'

export type TimerPhase = 'ok' | 'warn' | 'urgent' | 'done'

interface CountdownOpts {
  remainingMs: number
  totalMs: number
  running: boolean
  urgentMs: number
  warnRatio: number
  onFrame(ms: number): void
  onSecond?(secondsLeft: number): void
}

/**
 * Smooth countdown: re-bases on every new `remainingMs` and extrapolates with
 * rAF in between, so a parent updating 4×/s still gets a 60fps ring. Re-renders
 * only when the displayed second changes.
 */
function useCountdown({ remainingMs, totalMs, running, urgentMs, warnRatio, onFrame, onSecond }: CountdownOpts) {
  const base = useRef({ ms: remainingMs, t: 0 })
  const frameRef = useRef(onFrame)
  const secondRef = useRef(onSecond)
  frameRef.current = onFrame
  secondRef.current = onSecond
  const [secs, setSecs] = useState(() => Math.ceil(Math.max(0, remainingMs) / 1000))
  const lastSecs = useRef(secs)

  const lastMs = useRef(-1)
  const publish = (ms: number) => {
    if (ms === lastMs.current) return
    lastMs.current = ms
    frameRef.current(ms)
    const s = Math.ceil(ms / 1000)
    if (s !== lastSecs.current) {
      const prev = lastSecs.current
      lastSecs.current = s
      setSecs(s)
      if (running && s < prev) secondRef.current?.(s)
    }
  }

  useLayoutEffect(() => {
    base.current = { ms: Math.max(0, remainingMs), t: performance.now() }
    publish(base.current.ms)
    // publish is stable in behavior; re-run only when the input changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs])

  useEffect(() => {
    if (!running) return
    let raf = 0
    const loop = () => {
      const ms = Math.max(0, base.current.ms - (performance.now() - base.current.t))
      publish(ms)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const ms = secs * 1000
  const phase: TimerPhase = secs <= 0 ? 'done' : ms <= urgentMs ? 'urgent' : totalMs > 0 && ms / totalMs <= warnRatio ? 'warn' : 'ok'
  return { secs, phase }
}

const STROKE: Record<TimerPhase, string> = {
  ok: 'var(--color-lime)',
  warn: 'var(--color-gold)',
  urgent: 'var(--color-coral)',
  done: 'var(--color-coral)',
}

export interface TimerProps {
  /** Milliseconds left. Update as often as you like (e.g. every 250ms from useHostNow). */
  remainingMs: number
  /** Full duration (for the ring/bar fraction). */
  totalMs: number
  /** Extrapolate smoothly between updates. Default true. Set false when paused/frozen. */
  running?: boolean
  /** Coral + pulse below this. Default 10 000. */
  urgentMs?: number
  /** Gold below this fraction of totalMs. Default 0.3. */
  warnRatio?: number
  /** Called once per second while counting down (for tick SFX). */
  onSecond?(secondsLeft: number): void
  className?: string
}

export interface TimerRingProps extends TimerProps {
  /** Diameter in px. Default 96. */
  size?: number
  /** Caption under the digits, e.g. "SEC". Hidden under 72px. */
  caption?: string
}

/** Circular countdown: lime → gold (under 30%) → coral + heartbeat (last 10s). */
export function TimerRing({
  remainingMs,
  totalMs,
  running = true,
  urgentMs = 10_000,
  warnRatio = 0.3,
  onSecond,
  size = 96,
  caption,
  className,
}: TimerRingProps) {
  const stroke = Math.max(4, Math.round(size * 0.075))
  const r = (size - stroke) / 2 - 1
  const circ = 2 * Math.PI * r
  const t = useT()
  const arcRef = useRef<SVGCircleElement>(null)
  const lastOffset = useRef(Number.NaN)
  const { secs, phase } = useCountdown({
    remainingMs,
    totalMs,
    running,
    urgentMs,
    warnRatio,
    onSecond,
    onFrame: (ms) => {
      const arc = arcRef.current
      if (!arc) return
      const f = timerFraction(ms, totalMs)
      const offset = circ * (1 - f)
      // ≈ 12 writes/s in a 90 s round instead of 60 (see shouldWriteArc).
      if (!shouldWriteArc(offset, lastOffset.current, window.devicePixelRatio, f)) return
      lastOffset.current = offset
      arc.setAttribute('stroke-dashoffset', offset.toFixed(2))
    },
  })
  const urgent = phase === 'urgent' || phase === 'done'
  const text = secs >= 60 ? formatClock(secs * 1000) : formatNumber(secs)
  const tickR = r - stroke * 0.9 - 2
  const tickCirc = 2 * Math.PI * tickR

  return (
    <div
      role="timer"
      aria-label={t('ui.timer.secondsLeft', { count: secs })}
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      {/* Glass disc + urgent glow */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border border-white/10 bg-ink-950/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_10px_30px_-10px_rgb(0_0_0/0.8)]"
      />
      {urgent && (
        <span
          aria-hidden
          className="absolute -inset-1 animate-glow rounded-full"
          style={{ boxShadow: '0 0 28px 2px rgb(255 84 112 / 0.55), inset 0 0 18px rgb(255 84 112 / 0.35)' }}
        />
      )}
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible" className="absolute inset-0 -rotate-90 overflow-visible">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        {tickR > 8 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={tickR}
            fill="none"
            stroke="rgb(255 255 255 / 0.14)"
            strokeWidth={Math.max(2, stroke * 0.4)}
            strokeDasharray={`1 ${tickCirc / 60 - 1}`}
          />
        )}
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[phase]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={0}
          style={{
            transition: 'stroke 0.35s ease',
            filter: `drop-shadow(0 0 ${Math.round(stroke * 0.9)}px ${STROKE[phase]})`,
          }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span
          key={urgent ? secs : 'steady'}
          className={cn('num font-bold tracking-tight', urgent ? 'text-coral' : 'text-ink-50')}
          style={{
            fontSize: Math.round(size * (text.length > 2 ? 0.25 : 0.36)),
            animation: urgent && secs > 0 ? 'timer-beat 0.5s var(--ease-out-expo)' : undefined,
            textShadow: urgent ? '0 0 16px rgb(255 84 112 / 0.7)' : undefined,
          }}
        >
          {text}
        </span>
        {caption && size >= 72 && (
          <span className={cn('mt-1 text-[10px] font-extrabold tracking-[0.18em] uppercase', urgent ? 'text-coral/80' : 'text-ink-400')}>
            {caption}
          </span>
        )}
      </div>
    </div>
  )
}

export interface TimerBarProps extends TimerProps {
  /** Digits on the right. Default true. */
  showLabel?: boolean
  /** sm = 6px track · md = 10px track. Default md. */
  size?: 'sm' | 'md'
}

const BAR_FILL: Record<TimerPhase, string> = {
  ok: 'from-lime-deep to-lime',
  warn: 'from-gold-deep to-gold',
  urgent: 'from-coral-deep to-coral',
  done: 'from-coral-deep to-coral',
}
const BAR_GLOW: Record<TimerPhase, string> = {
  ok: 'shadow-[0_0_14px_rgb(166_255_63/0.55)]',
  warn: 'shadow-[0_0_14px_rgb(255_210_63/0.55)]',
  urgent: 'shadow-[0_0_16px_rgb(255_84_112/0.7)]',
  done: '',
}

/**
 * Horizontal countdown for the mobile HUD. Same color logic as TimerRing.
 * The fill is a full-width bar that slides out to the left of a clipped track
 * (transform only: composited, no per-frame layout or paint); its glow slides
 * the same way in a separate layer so the track clip doesn't cut it off.
 */
export function TimerBar({
  remainingMs,
  totalMs,
  running = true,
  urgentMs = 10_000,
  warnRatio = 0.3,
  onSecond,
  showLabel = true,
  size = 'md',
  className,
}: TimerBarProps) {
  const t = useT()
  const fillRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const { secs, phase } = useCountdown({
    remainingMs,
    totalMs,
    running,
    urgentMs,
    warnRatio,
    onSecond,
    onFrame: (ms) => {
      const transform = barTransform(timerFraction(ms, totalMs))
      if (fillRef.current) fillRef.current.style.transform = transform
      if (glowRef.current) glowRef.current.style.transform = transform
    },
  })
  const urgent = phase === 'urgent' || phase === 'done'

  return (
    <div role="timer" aria-label={t('ui.timer.secondsLeft', { count: secs })} className={cn('flex w-full items-center gap-3', className)}>
      <div
        className={cn(
          'relative flex-1 rounded-full bg-ink-950/60 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.08)]',
          size === 'md' ? 'h-2.5' : 'h-1.5',
        )}
      >
        {/* Glow: clipped only at the track's start (faded in), free to spill above, below and past the head. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-y-5 left-0 -right-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_16px)]"
        >
          <div ref={glowRef} className={cn('absolute inset-y-5 right-5 left-0 rounded-full will-change-transform', BAR_GLOW[phase])} />
        </div>
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div ref={fillRef} className={cn('absolute inset-0 overflow-hidden rounded-full bg-linear-to-r will-change-transform', BAR_FILL[phase])}>
            <span className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/30" />
            {/* The shine only moves while the clock does (an idle infinite animation still costs frames). */}
            {running && (
              <span
                className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/40 to-transparent"
                style={{ animation: 'bar-sweep 2.4s linear infinite' }}
              />
            )}
          </div>
        </div>
      </div>
      {showLabel && (
        <span
          key={urgent ? secs : 'steady'}
          className={cn('num min-w-[3.2ch] text-right text-sm font-bold', urgent ? 'text-coral' : 'text-ink-50')}
          style={{ animation: urgent && secs > 0 ? 'timer-beat 0.5s var(--ease-out-expo)' : undefined }}
        >
          {formatClock(secs * 1000)}
        </span>
      )}
    </div>
  )
}

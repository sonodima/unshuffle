// Play-all transport bar: big round play/stop, position + time, and a mini-map of
// the positions (tap one to play from there). Space toggles play-all.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Segment } from '../../game/types'
import type { PlaybackPosition } from '../../audio/engine'
import { rich, useT } from '../../i18n/react'
import { PLAY_ALL_TAG, scheduledSegmentAt, useBoardAudio } from './boardAudio'
import { usePlayAll } from './usePlayAll'
import { PlayGlyph, StopGlyph } from './icons'
import { formatTime } from './layout'
import './board.css'

export interface TransportBarProps {
  trackKey: string
  segments: Segment[]
  order: number[]
  /** Hue per segment index: colours the position mini-map. */
  hues?: number[]
  disabled?: boolean
  /** Space bar toggles play-all (default true). Disable if another transport owns the hotkey. */
  hotkey?: boolean
  className?: string
}

const RING_R = 30
const RING_C = 2 * Math.PI * RING_R

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  // Buttons/blocks handle Space themselves (click / lift a snippet).
  return !!t.closest('input, textarea, select, button, a[href], [role="button"], [role="slider"], [data-snippet-block]')
}

export function TransportBar({ trackKey, segments, order, hues, disabled = false, hotkey = true, className }: TransportBarProps) {
  const t = useT()
  const { engine } = useBoardAudio()
  const { playing, position, ready, toggle, play } = usePlayAll(trackKey, segments, order)
  const n = order.length
  const canPlay = !disabled && ready && !!engine

  const durations = useMemo(() => segments.map((s) => Math.max(0, s.end - s.start)), [segments])
  const total = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations])

  // Hotkey
  const toggleRef = useRef(toggle)
  const playingRef = useRef(playing)
  // Read live in the hotkey handler: the polled `ready` can lag a decode by a few ms.
  const canPlayNow = useRef<() => boolean>(() => false)
  useLayoutEffect(() => {
    toggleRef.current = toggle
    playingRef.current = playing
    canPlayNow.current = () => {
      if (disabled || !engine) return false
      try {
        return engine.has(trackKey)
      } catch {
        return false
      }
    }
  })
  useEffect(() => {
    if (!hotkey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (isTypingTarget(e.target)) return
      if (!playingRef.current && !canPlayNow.current()) return
      e.preventDefault()
      toggleRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey])

  // Per-frame progress (DOM writes only, no re-render)
  const ringRef = useRef<SVGCircleElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([])
  const orderRef = useRef(order)
  useLayoutEffect(() => {
    orderRef.current = order
  })
  useEffect(() => {
    // Write only what changed: the m:ss label ticks once a second and at most one
    // fill moves per frame (the rest sit at 0 or 1).
    let lastTime = ''
    let lastRing = -1
    const lastFill = new WeakMap<HTMLElement, number>()
    const paint = (elapsed: number, pos: number, progress: number) => {
      const time = formatTime(elapsed)
      if (time !== lastTime && timeRef.current) {
        lastTime = time
        timeRef.current.textContent = time
      }
      if (ringRef.current) {
        const f = total > 0 ? Math.min(1, elapsed / total) : 0
        const off = Math.round(RING_C * (1 - f) * 100) / 100
        if (off !== lastRing) {
          lastRing = off
          ringRef.current.style.strokeDashoffset = String(off)
        }
      }
      fillRefs.current.forEach((el, i) => {
        if (!el) return
        const v = i < pos ? 1 : i === pos ? Math.round(progress * 1000) / 1000 : 0
        if (lastFill.get(el) === v) return
        lastFill.set(el, v)
        el.style.transform = `scaleX(${v})`
      })
    }
    if (!playing || !engine) {
      paint(0, -1, 0)
      return
    }
    let raf = 0
    const tick = () => {
      let p: PlaybackPosition | null = null
      try {
        p = engine.getPosition()
      } catch {
        p = null
      }
      if (p && p.key === trackKey && p.tag === PLAY_ALL_TAG) {
        const ord = orderRef.current
        let before = 0
        for (let i = 0; i < p.index; i++) {
          const seg = scheduledSegmentAt(trackKey, i) ?? ord[i]
          before += durations[seg] ?? 0
        }
        const cur = scheduledSegmentAt(trackKey, p.index) ?? ord[p.index]
        const pr = Math.min(1, Math.max(0, p.progress))
        paint(before + pr * (durations[cur] ?? 0), p.index, pr)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, engine, trackKey, durations, total])

  const label = !ready ? t('ui.loading') : playing ? t('board.transport.playing') : t('board.transport.playAll')
  // Narrow bars (phones) swap in a shorter label so it never ends in an ellipsis.
  const shortLabel = ready && playing ? t('board.transport.playingShort') : label
  const shownPos = playing ? position + 1 : 0

  return (
    <div className={className ? `tb ${className}` : 'tb'} data-playing={playing || undefined}>
      <button
        type="button"
        className="tb-play"
        onClick={toggle}
        disabled={!canPlay && !playing}
        aria-pressed={playing}
        aria-label={playing ? t('board.transport.stopAction') : t('board.transport.playAllAction')}
        title={playing ? t('board.transport.stopTitle') : t('board.transport.playAllTitle')}
      >
        <svg className="tb-ring" viewBox="0 0 72 72" aria-hidden="true">
          <circle className="tb-ring-track" cx="36" cy="36" r={RING_R} />
          <circle
            ref={ringRef}
            className="tb-ring-fill"
            cx="36"
            cy="36"
            r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C}
          />
        </svg>
        <span className="tb-play-face">{playing ? <StopGlyph /> : <PlayGlyph className="tb-play-glyph" />}</span>
      </button>
      <div className="tb-body">
        <div className="tb-meta">
          <span className="tb-label">
            <span className="tb-label-long">{label}</span>
            <span className="tb-label-short" aria-hidden="true">
              {shortLabel}
            </span>
          </span>
          {playing && (
            <span className="tb-pos">{rich(t('board.transport.position', { position: shownPos, total: n }), { b: (c) => <b>{c}</b> })}</span>
          )}
          <span className="tb-time">
            {playing && (
              <>
                <span ref={timeRef}>{formatTime(0)}</span>
                <span className="tb-time-total"> / </span>
              </>
            )}
            <span className={playing ? 'tb-time-total' : undefined}>{formatTime(total)}</span>
          </span>
        </div>
        <div className="tb-map" role="group" aria-label={t('board.transport.positions')}>
          {order.map((seg, pos) => {
            const hue = hues?.[seg]
            const style = (hue != null ? { '--h': Math.round(hue) } : undefined) as CSSProperties | undefined
            return (
              <button
                key={pos}
                type="button"
                className="tb-cell"
                data-hued={hue != null || undefined}
                data-current={pos === position || undefined}
                style={style}
                disabled={!canPlay}
                onClick={() => play(pos)}
                aria-label={t('board.transport.playFrom', { position: pos + 1 })}
              >
                <span className="tb-cell-bar">
                  <span
                    className="tb-cell-fill"
                    ref={(el) => {
                      fillRefs.current[pos] = el
                    }}
                  />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

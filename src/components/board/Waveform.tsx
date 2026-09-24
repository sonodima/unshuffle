// Crisp, DPR-aware mirrored bar waveform of one time range of a decoded buffer.
// Bars are loudness in dB on a scale shared by the whole track (waveLevels.ts), so
// blocks of a loud, compressed master still look different from each other.
// Idle: drawn once per size/peaks change. While `active`, redrawn per frame with a
// progress sweep (played part bright, the rest dim) and a glowing playhead.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAudioBuffer, useBoardAudio } from './boardAudio'
import type { Peaks } from '../../audio/peaks'
import { barHeights, linearHeights, trackLevels } from './waveLevels'
import type { BarHeights } from './waveLevels'

export interface WaveformProps {
  /** Audio buffer key, e.g. 'track:3135556'. */
  trackKey: string
  /** Range inside the buffer, seconds. */
  start: number
  end: number
  /** Run the per-frame progress loop (only while this range is audible). */
  active?: boolean
  /** Read every frame while `active`: 0..1 progress through [start, end), or null when not audible. */
  progress?: () => number | null
  /** Bar colour (any CSS colour). Default white. */
  color?: string
  /** Bar width / gap in CSS px. Default: derived from the width (≈ 2–4px bars). */
  barWidth?: number
  barGap?: number
  /** Vertical fill 0..1 of the tallest possible bar. Default 0.94. */
  scale?: number
  /** Show shimmering placeholder bars until the buffer is decoded. Default true. */
  skeleton?: boolean
  className?: string
}

interface Size {
  w: number
  h: number
  dpr: number
}

function seeded(seed: number): () => number {
  let x = Math.floor(seed * 9301 + 49297) % 233280 || 1
  return () => {
    x = (x * 16807) % 2147483647
    return (x - 1) / 2147483646
  }
}

function placeholderPeaks(bins: number, seed: number): Peaks {
  const rnd = seeded(seed)
  const max = new Float32Array(bins)
  const rms = new Float32Array(bins)
  let v = 0.4
  for (let i = 0; i < bins; i++) {
    v = Math.min(0.85, Math.max(0.15, v + (rnd() - 0.5) * 0.35))
    max[i] = v
    rms[i] = v * 0.6
  }
  return { max, rms }
}

function barPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, Math.min(w / 2, h / 2))
  else ctx.rect(x, y, w, h)
}

/** Mirrored bars, `heights` 0..1 of the full height, snapped to even device pixels. */
function drawBars(
  ctx: CanvasRenderingContext2D,
  heights: Float32Array,
  size: Size,
  bw: number,
  pitch: number,
  x0: number,
  scale: number,
) {
  const H = Math.round(size.h * size.dpr)
  const mid = H / 2
  const full = H * scale
  ctx.beginPath()
  for (let i = 0; i < heights.length; i++) {
    const h = Math.max(bw, Math.round((heights[i] * full) / 2) * 2)
    barPath(ctx, x0 + i * pitch, Math.round(mid - h / 2), bw, h)
  }
  ctx.fill()
}

export const Waveform = memo(function Waveform({
  trackKey,
  start,
  end,
  active = false,
  progress,
  color = '#ffffff',
  barWidth,
  barGap,
  scale = 0.94,
  skeleton = true,
  className,
}: WaveformProps) {
  const { peaks: peaksFn } = useBoardAudio()
  const buffer = useAudioBuffer(trackKey)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<Size | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      setSize((prev) => (prev && prev.w === w && prev.h === h && prev.dpr === dpr ? prev : { w, h, dpr }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Geometry in device pixels, snapped so every bar edge lands on a pixel.
  const geom = useMemo(() => {
    if (!size || size.w < 4 || size.h < 4) return null
    const W = Math.round(size.w * size.dpr)
    const cssBar = barWidth ?? Math.min(4, Math.max(2, size.w / 58))
    const cssGap = barGap ?? cssBar * 0.75
    const bw = Math.max(1, Math.round(cssBar * size.dpr))
    const gap = Math.max(1, Math.round(cssGap * size.dpr))
    const pitch = bw + gap
    const bins = Math.max(1, Math.floor((W + gap) / pitch))
    const x0 = Math.floor((W - (bins * pitch - gap)) / 2)
    return { W, bw, pitch, bins, x0 }
  }, [size, barWidth, barGap])

  const peaks = useMemo<Peaks | null>(() => {
    if (!geom) return null
    if (!buffer) return skeleton ? placeholderPeaks(geom.bins, start * 7 + end) : null
    const s = Math.max(0, Math.min(start, buffer.duration))
    const e = Math.max(s + 0.01, Math.min(end, buffer.duration))
    try {
      return peaksFn(buffer, s, e, geom.bins)
    } catch {
      return null
    }
  }, [geom, buffer, skeleton, start, end, peaksFn])

  // Bar heights on the track-wide loudness scale (placeholders keep the linear look).
  const bars = useMemo<BarHeights | null>(() => {
    if (!peaks || !geom) return null
    if (!buffer) return linearHeights(peaks)
    try {
      const s = Math.max(0, Math.min(start, buffer.duration))
      const e = Math.max(s + 0.01, Math.min(end, buffer.duration))
      const levels = trackLevels(buffer, (e - s) / geom.bins, peaksFn)
      return levels ? barHeights(peaks, levels) : linearHeights(peaks)
    } catch {
      return linearHeights(peaks)
    }
  }, [peaks, geom, buffer, start, end, peaksFn])

  const loading = !buffer && skeleton

  const drawRef = useRef<(p: number | null) => void>(() => {})
  const draw = (p: number | null) => {
    const canvas = canvasRef.current
    if (!canvas || !size || !geom) return
    const W = geom.W
    const H = Math.round(size.h * size.dpr)
    if (canvas.width !== W) canvas.width = W
    if (canvas.height !== H) canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    if (!bars) return
    ctx.fillStyle = color
    const { bw, pitch, x0 } = geom
    if (loading) {
      ctx.globalAlpha = 0.28
      drawBars(ctx, bars.halo, size, bw, pitch, x0, scale)
      ctx.globalAlpha = 1
      return
    }
    const sweeping = p != null && p >= 0
    // Soft envelope (peaks) under a brighter core (RMS): a two-tone, "3D" waveform.
    ctx.globalAlpha = sweeping ? 0.2 : 0.36
    drawBars(ctx, bars.halo, size, bw, pitch, x0, scale)
    ctx.globalAlpha = sweeping ? 0.4 : 0.95
    drawBars(ctx, bars.core, size, bw, pitch, x0, scale)
    if (sweeping) {
      const span = geom.bins * pitch - (pitch - bw)
      const px = x0 + Math.min(1, p) * span
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, px, H)
      ctx.clip()
      ctx.globalAlpha = 0.55
      drawBars(ctx, bars.halo, size, bw, pitch, x0, scale)
      ctx.globalAlpha = 1
      drawBars(ctx, bars.core, size, bw, pitch, x0, scale)
      ctx.restore()
      if (p > 0 && p < 1) {
        const lw = Math.max(2, Math.round(1.5 * size.dpr))
        ctx.globalAlpha = 1
        ctx.shadowColor = color
        ctx.shadowBlur = 10 * size.dpr
        ctx.fillRect(Math.round(px - lw / 2), 0, lw, H)
        ctx.shadowBlur = 0
      }
    }
    ctx.globalAlpha = 1
  }

  const lastP = useRef<number | null>(null)

  // Static draw whenever inputs change (keeps the last progress while active).
  useLayoutEffect(() => {
    drawRef.current = draw
    draw(active ? lastP.current : null)
  })

  useEffect(() => {
    if (!active || !progress) {
      if (lastP.current !== null) {
        lastP.current = null
        drawRef.current(null)
      }
      return
    }
    let raf = 0
    const tick = () => {
      let p: number | null = null
      try {
        p = progress()
      } catch {
        p = null
      }
      const prev = lastP.current
      if (p !== prev && (p == null || prev == null || Math.abs(p - prev) > 0.0015)) {
        lastP.current = p
        drawRef.current(p)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lastP.current = null
      drawRef.current(null)
    }
  }, [active, progress])

  return (
    <div ref={wrapRef} className={className ? `sb-wf ${className}` : 'sb-wf'} data-loading={loading || undefined}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={loading ? 'sb-wf-canvas sb-wf-shimmer' : 'sb-wf-canvas'}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
})
